"""
compliance.py — Generates a structured compliance checklist.

Aggregates validation issues from journal_rules.validate_manuscript()
into a display-friendly checklist.
"""

from journal_rules import validate_manuscript


SEVERITY_ORDER = {"error": 0, "warning": 1, "ok": 2}


def generate_checklist(manuscript: dict, rules: dict) -> dict:
    """
    Generate a compliance checklist for display.

    Returns:
    {
      "journal": str,
      "summary": {"errors": int, "warnings": int, "ok": int},
      "checks": [
        {
          "item": str,         # Display label
          "status": "ok" | "warning" | "error",
          "message": str,
          "section": str       # Which section this maps to
        }
      ]
    }
    """
    issues = validate_manuscript(manuscript, rules)

    checks = []
    counts = {"error": 0, "warning": 0, "ok": 0}

    FIELD_LABELS = {
        "word_count": "Word Count",
        "abstract": "Abstract",
        "references": "References",
        "figures": "Figure Count",
    }

    for issue in issues:
        field = issue["field"]
        severity = issue["severity"]
        counts[severity] = counts.get(severity, 0) + 1

        # Derive a display label
        if field.startswith("section:"):
            section_name = field.split(":", 1)[1]
            label = f"Required Section: {section_name}"
            section = section_name
        elif field.startswith("abstract:"):
            sub = field.split(":", 1)[1]
            label = f"Abstract Sub-section: {sub}"
            section = "Abstract"
        elif field.startswith("reference_"):
            label = f"Reference #{field.split('_')[1]}"
            section = "References"
        else:
            label = FIELD_LABELS.get(field, field.replace("_", " ").title())
            section = field.title()

        checks.append({
            "item": label,
            "status": severity,
            "message": issue["message"],
            "section": section,
        })

    # Sort: errors first, then warnings, then ok
    checks.sort(key=lambda c: SEVERITY_ORDER.get(c["status"], 99))

    return {
        "journal": rules.get("journal_name", ""),
        "summary": {
            "errors": counts.get("error", 0),
            "warnings": counts.get("warning", 0),
            "ok": counts.get("ok", 0),
        },
        "checks": checks,
    }
