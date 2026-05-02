"""
diff_engine.py — Generates human-readable, character-level diffs for each change.

Uses diff-match-patch to compute inline diffs that the frontend can render.
Each change gets an `inline_diff` field: a list of [op, text] segments.
  op: "equal" | "insert" | "delete"
"""

import diff_match_patch as dmp_module


_dmp = dmp_module.diff_match_patch()


def _compute_inline_diff(original: str, updated: str) -> list[dict]:
    """
    Return character-level diff segments between original and updated.
    Each segment: {"op": "equal"|"insert"|"delete", "text": str}
    """
    diffs = _dmp.diff_main(original, updated)
    _dmp.diff_cleanupSemantic(diffs)

    op_map = {
        _dmp.DIFF_EQUAL: "equal",
        _dmp.DIFF_INSERT: "insert",
        _dmp.DIFF_DELETE: "delete",
    }

    return [{"op": op_map[op], "text": text} for op, text in diffs]


def enrich_changes_with_diffs(changes: list[dict]) -> list[dict]:
    """
    Given a list of change dicts (from formatter.py), add `inline_diff` to each.
    Returns the enriched list. Does not mutate originals.
    """
    enriched = []
    for i, change in enumerate(changes):
        c = dict(change)
        c["id"] = f"change_{i}"
        c["accepted"] = None  # None = pending, True = accepted, False = rejected
        original = c.get("original", "")
        updated = c.get("updated", "")
        c["inline_diff"] = _compute_inline_diff(original, updated)
        enriched.append(c)
    return enriched


def apply_accepted_changes(manuscript: dict, changes: list[dict]) -> dict:
    """
    Apply only accepted changes back to a manuscript copy.
    Rejected changes are left as original. Pending changes default to original.

    Returns a new manuscript dict with accepted changes applied.
    """
    import copy
    result = copy.deepcopy(manuscript)

    for change in changes:
        if change.get("accepted") is not True:
            continue  # Only apply explicitly accepted changes

        ctype = change.get("type")
        section_name = change.get("section", "")
        field = change.get("field", "")
        updated = change.get("updated", "")

        if field == "heading":
            for sec in result.get("sections", []):
                if sec["heading"] == change.get("original"):
                    sec["heading"] = updated

        elif field == "section_order":
            # Already applied during format step; skip re-applying
            pass

        elif field == "content":
            for sec in result.get("sections", []):
                if sec["heading"].lower() == section_name.lower():
                    sec["content"] = updated

        elif field.startswith("reference_"):
            idx = int(field.split("_")[1]) - 1
            refs = result.get("references", [])
            if 0 <= idx < len(refs):
                refs[idx] = updated

        elif field.startswith("figure_"):
            idx = int(field.split("_")[1]) - 1
            figs = result.get("figure_legends", [])
            if 0 <= idx < len(figs):
                figs[idx] = updated

    return result
