"""
journal_rules.py — Loads and validates journal rule configs from JSON files.
Provides helpers to check manuscript against a set of rules.
"""

import json
import os
from pathlib import Path
from typing import Optional

JOURNALS_DIR = Path(__file__).parent / "journals"


def list_journals() -> list[dict]:
    """Return a list of available journals with id, name, and metadata for the selector UI."""
    journals = []
    for f in sorted(JOURNALS_DIR.glob("*.json")):
        try:
            data = json.loads(f.read_text())
            journals.append({
                "id": data["journal_id"],
                "name": data["journal_name"],
                "publisher": data.get("publisher"),
                "indexing": data.get("indexing", []),
                "impact_factor": data.get("impact_factor"),
                "sjr": data.get("sjr"),
                "cite_score": data.get("cite_score"),
                "open_access": data.get("open_access", False),
                "new_journal": data.get("new_journal", False),
                "word_limit": data.get("word_limit"),
                "reference_style": data.get("reference_style"),
                "abstract_type": data.get("abstract_type"),
            })
        except Exception:
            pass
    return journals


def load_rules(journal_id: str) -> Optional[dict]:
    """Load the rule config for a given journal_id. Returns None if not found."""
    path = JOURNALS_DIR / f"{journal_id}.json"
    if not path.exists():
        return None
    return json.loads(path.read_text())


def validate_manuscript(manuscript: dict, rules: dict) -> list[dict]:
    """
    Validate the parsed manuscript against journal rules.
    Returns a list of compliance issues.

    Each issue: {"field": str, "severity": "error"|"warning"|"ok", "message": str}
    """
    issues = []
    sections = {s["heading"].strip().lower(): s for s in manuscript.get("sections", [])}

    # --- Word count ---
    wc = manuscript.get("word_count", 0)
    limit = rules.get("word_limit", 0)
    if limit and wc > limit:
        issues.append({
            "field": "word_count",
            "severity": "error",
            "message": f"Word count {wc} exceeds journal limit of {limit}.",
        })
    elif limit and wc > limit * 0.9:
        issues.append({
            "field": "word_count",
            "severity": "warning",
            "message": f"Word count {wc} is close to the journal limit of {limit}.",
        })
    else:
        issues.append({
            "field": "word_count",
            "severity": "ok",
            "message": f"Word count {wc} is within the journal limit of {limit}.",
        })

    # --- Required sections ---
    for req in rules.get("sections_required", []):
        found = req.lower() in sections
        issues.append({
            "field": f"section:{req}",
            "severity": "ok" if found else "error",
            "message": f"Required section '{req}' {'found' if found else 'is MISSING'}.",
        })

    # --- Abstract ---
    abstract = manuscript.get("abstract", "")
    abstract_limit = rules.get("abstract_word_limit", 0)
    abstract_wc = len(abstract.split()) if abstract else 0

    if not abstract:
        issues.append({
            "field": "abstract",
            "severity": "error",
            "message": "Abstract is missing.",
        })
    elif abstract_limit and abstract_wc > abstract_limit:
        issues.append({
            "field": "abstract",
            "severity": "error",
            "message": f"Abstract word count {abstract_wc} exceeds limit of {abstract_limit}.",
        })
    else:
        issues.append({
            "field": "abstract",
            "severity": "ok",
            "message": f"Abstract present ({abstract_wc} words).",
        })

    # --- Structured abstract sections ---
    if rules.get("abstract_type") == "structured":
        required_subsections = rules.get("abstract_sections", [])
        for sub in required_subsections:
            found_sub = sub.lower() in abstract.lower()
            issues.append({
                "field": f"abstract:{sub}",
                "severity": "ok" if found_sub else "warning",
                "message": f"Abstract sub-section '{sub}' {'found' if found_sub else 'may be missing'}.",
            })

    # --- References ---
    refs = manuscript.get("references", [])
    if not refs:
        issues.append({
            "field": "references",
            "severity": "warning",
            "message": "No references detected. Verify reference section heading.",
        })
    else:
        issues.append({
            "field": "references",
            "severity": "ok",
            "message": f"{len(refs)} references detected.",
        })

    # --- Figure count ---
    fig_limit = rules.get("figure_limit", 0)
    fig_count = len(manuscript.get("figure_legends", []))
    if fig_limit and fig_count > fig_limit:
        issues.append({
            "field": "figures",
            "severity": "error",
            "message": f"Figure count {fig_count} exceeds journal limit of {fig_limit}.",
        })
    elif fig_count > 0:
        issues.append({
            "field": "figures",
            "severity": "ok",
            "message": f"{fig_count} figure legend(s) detected.",
        })

    return issues
