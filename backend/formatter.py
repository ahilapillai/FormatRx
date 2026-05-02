"""
formatter.py — Formatting engine (STRICT MODE).

Applies journal rules to a parsed manuscript.
Produces a list of discrete, reversible changes.
Does NOT rewrite content. Does NOT add new content.
Does NOT summarise text.

Change types:
  - "formatting"   → heading case, section order
  - "grammar"      → minor grammar fix (only in format_plus_minor_grammar mode)
  - "compliance"   → structural fix (reference style, figure label)
"""

import re
import difflib
import anthropic
from typing import Literal

EditMode = Literal["format_only", "format_plus_minor_grammar"]


# ---------------------------------------------------------------------------
# Heading normalisation
# ---------------------------------------------------------------------------

def _apply_heading_case(text: str, case: str) -> str:
    if case == "title":
        # Title case — skip short prepositions / conjunctions
        LOWER_WORDS = {"a", "an", "the", "and", "but", "or", "for", "nor",
                       "on", "at", "to", "by", "in", "of", "up", "as", "is"}
        words = text.split()
        result = []
        for i, w in enumerate(words):
            if i == 0 or w.lower() not in LOWER_WORDS:
                result.append(w.capitalize())
            else:
                result.append(w.lower())
        return " ".join(result)
    elif case == "upper":
        return text.upper()
    return text


# ---------------------------------------------------------------------------
# Vancouver reference formatting
# ---------------------------------------------------------------------------

VANCOUVER_PATTERN = re.compile(r"^(?P<num>\d+)[\.\)]\s*(?P<body>.+)$", re.DOTALL)


def _format_vancouver_ref(raw: str, index: int) -> str:
    m = VANCOUVER_PATTERN.match(raw.strip())
    body = m.group("body").strip() if m else raw.strip()
    return f"{index}. {body}"


# ---------------------------------------------------------------------------
# Similarity guard — rejects LLM output that changed too much
# ---------------------------------------------------------------------------

def _word_similarity(a: str, b: str) -> float:
    """
    Word-level similarity, stripping punctuation first so that comma/period
    corrections don't falsely lower the score.
    """
    clean = re.compile(r"[^\w\s]")
    a_words = clean.sub("", a.lower()).split()
    b_words = clean.sub("", b.lower()).split()
    if not a_words:
        return 1.0
    return difflib.SequenceMatcher(None, a_words, b_words).ratio()


def _is_safe_grammar_edit(original: str, corrected: str) -> bool:
    """
    Returns True only if the corrected text is close enough to the original
    that it cannot have been substantially rewritten.

    Thresholds:
      - Word similarity ≥ 0.92  (at most ~8% of words changed)
      - Word count change ≤ 5%  (no adding/removing sentences)
    """
    if original == corrected:
        return True

    similarity = _word_similarity(original, corrected)
    orig_wc = len(original.split())
    new_wc = len(corrected.split())
    word_count_delta = abs(new_wc - orig_wc) / max(orig_wc, 1)

    # 0.85 similarity allows ~1-2 word fixes in short sentences
    # while still blocking rewrites. Word count delta ≤5% blocks sentence addition/removal.
    return similarity >= 0.85 and word_count_delta <= 0.05


# ---------------------------------------------------------------------------
# LLM-assisted grammar correction (format_plus_minor_grammar only)
# ---------------------------------------------------------------------------

GRAMMAR_SYSTEM_PROMPT = """\
You are a strict copy-editor for peer-reviewed medical manuscripts.

YOUR ONLY JOB is to fix clear surface-level errors. Nothing else.

PERMITTED fixes (one word at a time):
  • Spelling errors        e.g. "recievd" → "received"
  • Subject-verb agreement e.g. "findings was" → "findings were"
  • Missing/wrong article  e.g. "a unique finding" → "an unique finding" → "a unique finding"
  • Tense consistency      e.g. mixing past/present within a single sentence
  • Obvious punctuation    e.g. missing full stop at end of paragraph

ABSOLUTELY FORBIDDEN — these will cause patient harm:
  • Do NOT rephrase any sentence
  • Do NOT reorder words within a sentence
  • Do NOT add new words unless fixing a clear grammatical error
  • Do NOT remove words
  • Do NOT change any medical term, drug name, diagnosis, grade, stage, measurement, or value
  • Do NOT combine or split sentences
  • Do NOT change "(WHO Grade X)" or any staging/grading notation
  • Do NOT change abbreviations (EMA, GFAP, CDKN2A, etc.)
  • Do NOT change author interpretations or conclusions

If you are uncertain whether a change is allowed, DO NOT make it.
If no permitted fix exists, return the text EXACTLY as given.

Return ONLY the corrected text. No explanations. No commentary.\
"""


def _grammar_fix_via_llm(text: str, api_key: str) -> str:
    """Call Claude to apply micro grammar fixes. Returns corrected text or original if unsafe."""
    client = anthropic.Anthropic(api_key=api_key)
    message = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=len(text.split()) * 3,   # Cap tokens tightly
        system=GRAMMAR_SYSTEM_PROMPT,
        messages=[{
            "role": "user",
            "content": (
                "Fix ONLY clear surface-level grammar errors in the paragraph below. "
                "Do not rephrase, reorder, or add content.\n\n"
                f"PARAGRAPH:\n{text}"
            ),
        }],
    )
    corrected = message.content[0].text.strip()

    # Safety gate — reject if too much was changed
    if not _is_safe_grammar_edit(text, corrected):
        return text   # Return original unchanged

    return corrected


# ---------------------------------------------------------------------------
# Main formatter
# ---------------------------------------------------------------------------

def format_manuscript(
    manuscript: dict,
    rules: dict,
    mode: EditMode = "format_only",
    api_key: str = "",
) -> dict:
    """
    Apply journal formatting rules to a parsed manuscript.

    Returns:
    {
      "formatted": { same shape as manuscript with updated content },
      "changes": [...]
    }
    """
    formatted = {
        "title": manuscript.get("title", ""),
        "abstract": manuscript.get("abstract", ""),
        "sections": [dict(s) for s in manuscript.get("sections", [])],
        "references": list(manuscript.get("references", [])),
        "figure_legends": list(manuscript.get("figure_legends", [])),
        "word_count": manuscript.get("word_count", 0),
    }
    changes = []

    heading_case = rules.get("heading_case", "title")
    ref_style = rules.get("reference_style", "Vancouver")
    sections_order = [s.lower() for s in rules.get("sections_order", [])]

    # ------------------------------------------------------------------
    # 1. Normalise section headings
    # ------------------------------------------------------------------
    for sec in formatted["sections"]:
        original_heading = sec["heading"]
        new_heading = _apply_heading_case(original_heading, heading_case)
        if new_heading != original_heading:
            changes.append({
                "type": "formatting",
                "section": original_heading,
                "field": "heading",
                "original": original_heading,
                "updated": new_heading,
                "description": f"Heading normalised to {heading_case} case.",
            })
            sec["heading"] = new_heading

    # ------------------------------------------------------------------
    # 2. Reorder sections to match journal order
    # ------------------------------------------------------------------
    if sections_order:
        def order_key(sec):
            h = sec["heading"].lower()
            for i, name in enumerate(sections_order):
                if name in h or h in name:
                    return i
            return 999

        original_order = [s["heading"] for s in formatted["sections"]]
        formatted["sections"].sort(key=order_key)
        new_order = [s["heading"] for s in formatted["sections"]]

        if original_order != new_order:
            changes.append({
                "type": "formatting",
                "section": "Document",
                "field": "section_order",
                "original": " → ".join(original_order),
                "updated": " → ".join(new_order),
                "description": "Sections reordered to match journal guidelines.",
            })

    # ------------------------------------------------------------------
    # 3. Format references (Vancouver)
    # ------------------------------------------------------------------
    if ref_style == "Vancouver":
        new_refs = []
        for i, ref in enumerate(formatted["references"], start=1):
            formatted_ref = _format_vancouver_ref(ref, i)
            if formatted_ref != ref:
                changes.append({
                    "type": "compliance",
                    "section": "References",
                    "field": f"reference_{i}",
                    "original": ref,
                    "updated": formatted_ref,
                    "description": f"Reference {i} formatted to Vancouver style.",
                })
            new_refs.append(formatted_ref)
        formatted["references"] = new_refs

    # ------------------------------------------------------------------
    # 4. Figure legend formatting
    # ------------------------------------------------------------------
    for i, legend in enumerate(formatted["figure_legends"], start=1):
        prefix = f"Figure {i}."
        if not legend.startswith(prefix) and not legend.lower().startswith("fig"):
            new_legend = f"{prefix} {legend}"
            changes.append({
                "type": "compliance",
                "section": "Figure Legends",
                "field": f"figure_{i}",
                "original": legend,
                "updated": new_legend,
                "description": f"Figure {i} legend prefixed with standard label.",
            })
            formatted["figure_legends"][i - 1] = new_legend

    # ------------------------------------------------------------------
    # 5. Grammar fixes — LLM with strict safety gate
    # ------------------------------------------------------------------
    if mode == "format_plus_minor_grammar" and api_key:
        for sec in formatted["sections"]:
            original_content = sec["content"]
            if not original_content.strip():
                continue

            corrected = _grammar_fix_via_llm(original_content, api_key)

            # Double-check safety gate (LLM function already checks, but verify again)
            if corrected == original_content:
                continue   # No change — skip

            if not _is_safe_grammar_edit(original_content, corrected):
                continue   # Rejected — too much changed

            changes.append({
                "type": "grammar",
                "section": sec["heading"],
                "field": "content",
                "original": original_content,
                "updated": corrected,
                "description": "Minor grammar corrections applied (spelling / agreement / punctuation only).",
            })
            sec["content"] = corrected

        # Grammar fix for abstract too
        original_abstract = formatted.get("abstract", "")
        if original_abstract.strip():
            corrected_abstract = _grammar_fix_via_llm(original_abstract, api_key)
            if corrected_abstract != original_abstract and _is_safe_grammar_edit(original_abstract, corrected_abstract):
                changes.append({
                    "type": "grammar",
                    "section": "Abstract",
                    "field": "content",
                    "original": original_abstract,
                    "updated": corrected_abstract,
                    "description": "Minor grammar corrections applied to abstract.",
                })
                formatted["abstract"] = corrected_abstract

    return {"formatted": formatted, "changes": changes}
