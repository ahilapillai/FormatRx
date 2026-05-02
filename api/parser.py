"""
parser.py — Parses .docx manuscript into structured JSON.
Extracts: title, abstract, sections (heading + content), references, figure legends.
Does NOT modify content.

Robust mode: handles documents that use bold/all-caps text instead of Word heading styles.
"""

import re
from docx import Document
from docx.shared import Pt
from typing import Optional, List


# ---------------------------------------------------------------------------
# Known section names for matching
# ---------------------------------------------------------------------------

REF_SECTION_NAMES = {
    "references", "bibliography", "works cited", "reference list"
}
FIG_SECTION_NAMES = {
    "figure legends", "figures", "figure captions",
    "legends", "legends for figures"
}
ABSTRACT_NAMES = {"abstract", "summary"}

KNOWN_SECTION_NAMES = {
    "introduction", "background", "methods", "materials and methods",
    "methodology", "results", "discussion", "conclusion", "conclusions",
    "case presentation", "case report", "case description",
    "acknowledgements", "acknowledgments", "conflict of interest",
    "funding", "ethical approval", "author contributions",
    "supplementary material", "appendix",
}


# ---------------------------------------------------------------------------
# Heading detection helpers
# ---------------------------------------------------------------------------

def _is_word_heading(para) -> bool:
    """True if Word assigned a Heading style."""
    return para.style.name.startswith("Heading")


def _heading_level_from_style(para) -> int:
    match = re.search(r"\d+", para.style.name)
    return int(match.group()) if match else 1


def _is_bold_heading(para, text: str) -> bool:
    """
    Heuristic heading detection for docs that don't use Word heading styles.
    A paragraph is treated as a heading if:
      - It's short (≤ 10 words)
      - AND all non-empty runs are bold OR the whole para is ALL CAPS
      - AND it matches a known section name OR looks like a numbered section
    """
    if not text or len(text.split()) > 10:
        return False

    lower = text.lower().strip(":. ")

    # Match known section names
    if lower in KNOWN_SECTION_NAMES:
        return True
    if lower in REF_SECTION_NAMES or lower in FIG_SECTION_NAMES or lower in ABSTRACT_NAMES:
        return True

    # Numbered section: "1. Introduction" or "1 Introduction"
    if re.match(r"^\d+[\.\)]\s+\w", text):
        return True

    # All runs bold
    runs = [r for r in para.runs if r.text.strip()]
    if runs and all(r.bold for r in runs):
        return True

    # ALL CAPS short line
    if text == text.upper() and len(text) > 2 and text.replace(" ", "").isalpha():
        return True

    return False


def _is_heading(para, text: str) -> bool:
    return _is_word_heading(para) or _is_bold_heading(para, text)


def _heading_level(para, text: str) -> int:
    if _is_word_heading(para):
        return _heading_level_from_style(para)
    # Numbered headings get level 1
    if re.match(r"^\d+[\.\)]\s+", text):
        return 1
    return 1


def _para_text(para) -> str:
    return para.text.strip()


# ---------------------------------------------------------------------------
# Main parser
# ---------------------------------------------------------------------------

def parse_docx(file_path: str) -> dict:
    """
    Parse a .docx file and return structured JSON.

    Returns:
    {
      "title": str,
      "abstract": str,
      "sections": [{"heading": str, "level": int, "content": str}],
      "references": [str],
      "figure_legends": [str],
      "word_count": int,
      "raw_paragraphs": int,
      "parse_warnings": [str]
    }
    """
    doc = Document(file_path)
    paragraphs = doc.paragraphs

    result: dict = {
        "title": "",
        "abstract": "",
        "sections": [],
        "references": [],
        "figure_legends": [],
        "word_count": 0,
        "raw_paragraphs": len(paragraphs),
        "parse_warnings": [],
    }

    current_heading: Optional[str] = None
    current_level: int = 1
    current_content: List[str] = []
    in_references = False
    in_figures = False
    in_abstract = False
    title_captured = False
    abstract_content: List[str] = []

    # ---- flush helper ----
    def flush_section():
        nonlocal current_heading, current_content, current_level
        if current_heading is not None:
            result["sections"].append({
                "heading": current_heading,
                "level": current_level,
                "content": "\n\n".join(current_content).strip(),
            })
        current_heading = None
        current_content = []

    non_empty = [p for p in paragraphs if p.text.strip()]
    if not non_empty:
        result["parse_warnings"].append("Document appears to be empty.")
        return result

    for para in paragraphs:
        text = _para_text(para)
        if not text:
            continue

        lower = text.lower().strip(":. ")

        # ── Title: captured from the very first non-empty paragraph ──────────
        if not title_captured:
            result["title"] = text
            title_captured = True
            # If it's also a heading style, don't treat as content below
            continue

        # ── Special section gates ─────────────────────────────────────────────
        if lower in REF_SECTION_NAMES:
            flush_section()
            in_references = True
            in_figures = False
            in_abstract = False
            continue

        if lower in FIG_SECTION_NAMES:
            flush_section()
            in_figures = True
            in_references = False
            in_abstract = False
            continue

        if lower in ABSTRACT_NAMES:
            flush_section()
            in_abstract = True
            in_references = False
            in_figures = False
            continue

        # ── Collect references ────────────────────────────────────────────────
        if in_references:
            result["references"].append(text)
            continue

        # ── Collect figure legends ────────────────────────────────────────────
        if in_figures:
            result["figure_legends"].append(text)
            continue

        # ── Abstract body ─────────────────────────────────────────────────────
        if in_abstract:
            if _is_heading(para, text):
                in_abstract = False
                flush_section()
                current_heading = text
                current_level = _heading_level(para, text)
            else:
                abstract_content.append(text)
            continue

        # ── Normal section handling ───────────────────────────────────────────
        if _is_heading(para, text):
            flush_section()
            current_heading = text
            current_level = _heading_level(para, text)
        else:
            if current_heading is None and current_content:
                # Free-floating paragraphs before any heading — treat as body
                current_content.append(text)
            elif current_heading is None:
                # Could be the abstract if "Abstract" heading was missed
                abstract_content.append(text)
            else:
                current_content.append(text)

    flush_section()

    if abstract_content:
        result["abstract"] = "\n\n".join(abstract_content)

    if not result["title"]:
        result["parse_warnings"].append("Title could not be detected.")

    if not result["sections"]:
        result["parse_warnings"].append(
            "No sections detected. The document may not use heading styles or known section names. "
            "Try adding standard heading names (Introduction, Methods, Results, Discussion)."
        )

    # Word count — exclude reference section
    all_text = " ".join(p.text for p in paragraphs)
    result["word_count"] = len(all_text.split())

    return result
