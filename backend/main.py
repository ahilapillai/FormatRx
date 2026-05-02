"""
main.py — FastAPI application entry point.

Endpoints:
  GET  /journals              → list available journals
  POST /parse                 → upload + parse .docx
  POST /format                → apply formatting rules
  POST /compliance            → generate compliance checklist
  POST /export/clean          → download clean .docx
  POST /export/tracked        → download .docx with tracked changes
"""

import os
import tempfile
import json
from typing import Optional

from fastapi import FastAPI, File, UploadFile, HTTPException, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, JSONResponse
from pydantic import BaseModel
import io

from parser import parse_docx
from journal_rules import load_rules, list_journals
from formatter import format_manuscript
from diff_engine import enrich_changes_with_diffs, apply_accepted_changes
from compliance import generate_checklist
from exporter import export_docx


# ---------------------------------------------------------------------------
# App setup
# ---------------------------------------------------------------------------

app = FastAPI(
    title="Manuscript Formatter API",
    description="Format pathology manuscripts to journal guidelines. No content rewriting.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY", "")


# ---------------------------------------------------------------------------
# Request / Response models
# ---------------------------------------------------------------------------

class FormatRequest(BaseModel):
    manuscript: dict
    journal_id: str
    mode: str = "format_only"  # "format_only" | "format_plus_minor_grammar"


class ComplianceRequest(BaseModel):
    manuscript: dict
    journal_id: str


class ExportRequest(BaseModel):
    manuscript: dict          # Final manuscript (with accepted changes applied by frontend)
    changes: list             # Enriched change list (for tracked export)
    journal_id: str
    export_mode: str = "clean"  # "clean" | "tracked"


class AcceptChangesRequest(BaseModel):
    manuscript: dict          # Original formatted manuscript
    changes: list             # Changes with accepted=true/false set by user


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@app.get("/journals")
def get_journals():
    """List all available journal templates."""
    return {"journals": list_journals()}


@app.get("/journals/{journal_id}")
def get_journal_rules(journal_id: str):
    """Return the full rule config for a journal."""
    rules = load_rules(journal_id)
    if not rules:
        raise HTTPException(status_code=404, detail=f"Journal '{journal_id}' not found.")
    return rules


@app.post("/journals/{journal_id}/precheck")
def precheck_manuscript(journal_id: str, req: ComplianceRequest):
    """
    Run a quick pre-check of the manuscript against journal rules.
    Returns per-rule status before any formatting is applied.
    """
    rules = load_rules(journal_id)
    if not rules:
        raise HTTPException(status_code=404, detail=f"Journal '{journal_id}' not found.")
    from compliance import generate_checklist
    return generate_checklist(req.manuscript, rules)


@app.post("/parse")
async def parse_manuscript(file: UploadFile = File(...)):
    """
    Upload a .docx file, parse it, and return structured JSON.
    No modifications are made to the content at this step.
    """
    if not file.filename.endswith(".docx"):
        raise HTTPException(status_code=400, detail="Only .docx files are supported.")

    with tempfile.NamedTemporaryFile(suffix=".docx", delete=False) as tmp:
        contents = await file.read()
        tmp.write(contents)
        tmp_path = tmp.name

    try:
        parsed = parse_docx(tmp_path)
    except Exception as e:
        import traceback
        tb = traceback.format_exc()
        raise HTTPException(
            status_code=422,
            detail=f"Failed to parse document: {str(e)}\n\nTrace:\n{tb}"
        )
    finally:
        try:
            os.unlink(tmp_path)
        except Exception:
            pass

    # Warn if parse produced no useful content
    if not parsed.get("sections") and not parsed.get("abstract"):
        parsed.setdefault("parse_warnings", []).append(
            "No structured content detected. The document may lack proper section headings."
        )

    return {"manuscript": parsed, "filename": file.filename}


@app.post("/format")
def format_endpoint(req: FormatRequest):
    """
    Apply journal formatting rules to a parsed manuscript.
    Returns formatted manuscript + list of changes with inline diffs.
    """
    rules = load_rules(req.journal_id)
    if not rules:
        raise HTTPException(status_code=404, detail=f"Journal '{req.journal_id}' not found.")

    if req.mode not in ("format_only", "format_plus_minor_grammar"):
        raise HTTPException(status_code=400, detail="Invalid mode.")

    api_key = ANTHROPIC_API_KEY if req.mode == "format_plus_minor_grammar" else ""

    try:
        result = format_manuscript(req.manuscript, rules, mode=req.mode, api_key=api_key)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Formatting error: {str(e)}")

    enriched_changes = enrich_changes_with_diffs(result["changes"])

    return {
        "formatted_manuscript": result["formatted"],
        "changes": enriched_changes,
        "change_count": len(enriched_changes),
    }


@app.post("/apply-changes")
def apply_changes_endpoint(req: AcceptChangesRequest):
    """
    Apply accepted changes to the manuscript.
    Frontend sends manuscript + changes with accepted=true/false.
    Returns the final manuscript.
    """
    final = apply_accepted_changes(req.manuscript, req.changes)
    return {"final_manuscript": final}


@app.post("/compliance")
def compliance_endpoint(req: ComplianceRequest):
    """Generate a compliance checklist for a manuscript against journal rules."""
    rules = load_rules(req.journal_id)
    if not rules:
        raise HTTPException(status_code=404, detail=f"Journal '{req.journal_id}' not found.")

    checklist = generate_checklist(req.manuscript, rules)
    return checklist


@app.post("/export/clean")
def export_clean(req: ExportRequest):
    """Export clean .docx (no tracked changes)."""
    try:
        doc_bytes = export_docx(req.manuscript, req.changes, mode="clean")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Export error: {str(e)}")

    return StreamingResponse(
        io.BytesIO(doc_bytes),
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={"Content-Disposition": "attachment; filename=formatted_manuscript.docx"},
    )


@app.post("/export/tracked")
def export_tracked(req: ExportRequest):
    """Export .docx with tracked changes (visual: red strikethrough / green underline)."""
    try:
        doc_bytes = export_docx(req.manuscript, req.changes, mode="tracked")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Export error: {str(e)}")

    return StreamingResponse(
        io.BytesIO(doc_bytes),
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={"Content-Disposition": "attachment; filename=formatted_manuscript_tracked.docx"},
    )


@app.get("/health")
def health():
    return {"status": "ok"}
