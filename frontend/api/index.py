"""
api/index.py — Vercel serverless entry point for the Manuscript Formatter API.

All routes are prefixed with /api to match the frontend's BASE = '/api'.
"""

import os
import sys
import tempfile
import json

# Ensure modules in this directory are importable
sys.path.insert(0, os.path.dirname(__file__))

from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
import io

from parser import parse_docx
from journal_rules import load_rules, list_journals
from formatter import format_manuscript
from diff_engine import enrich_changes_with_diffs, apply_accepted_changes
from compliance import generate_checklist
from exporter import export_docx

# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------

app = FastAPI(
    title="Manuscript Formatter API",
    description="Format pathology manuscripts to journal guidelines. No content rewriting.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
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
    mode: str = "format_only"


class ComplianceRequest(BaseModel):
    manuscript: dict
    journal_id: str


class ExportRequest(BaseModel):
    manuscript: dict
    changes: list
    journal_id: str
    export_mode: str = "clean"


class AcceptChangesRequest(BaseModel):
    manuscript: dict
    changes: list


# ---------------------------------------------------------------------------
# Routes — prefixed /api to match frontend BASE = '/api'
# ---------------------------------------------------------------------------

@app.get("/api/journals")
def get_journals():
    return {"journals": list_journals()}


@app.get("/api/journals/{journal_id}")
def get_journal_rules(journal_id: str):
    rules = load_rules(journal_id)
    if not rules:
        raise HTTPException(status_code=404, detail=f"Journal '{journal_id}' not found.")
    return rules


@app.post("/api/journals/{journal_id}/precheck")
def precheck_manuscript(journal_id: str, req: ComplianceRequest):
    rules = load_rules(journal_id)
    if not rules:
        raise HTTPException(status_code=404, detail=f"Journal '{journal_id}' not found.")
    return generate_checklist(req.manuscript, rules)


@app.post("/api/parse")
async def parse_manuscript(file: UploadFile = File(...)):
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

    if not parsed.get("sections") and not parsed.get("abstract"):
        parsed.setdefault("parse_warnings", []).append(
            "No structured content detected. The document may lack proper section headings."
        )

    return {"manuscript": parsed, "filename": file.filename}


@app.post("/api/format")
def format_endpoint(req: FormatRequest):
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


@app.post("/api/apply-changes")
def apply_changes_endpoint(req: AcceptChangesRequest):
    final = apply_accepted_changes(req.manuscript, req.changes)
    return {"final_manuscript": final}


@app.post("/api/compliance")
def compliance_endpoint(req: ComplianceRequest):
    rules = load_rules(req.journal_id)
    if not rules:
        raise HTTPException(status_code=404, detail=f"Journal '{req.journal_id}' not found.")
    return generate_checklist(req.manuscript, rules)


@app.post("/api/export/clean")
def export_clean(req: ExportRequest):
    try:
        doc_bytes = export_docx(req.manuscript, req.changes, mode="clean")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Export error: {str(e)}")

    return StreamingResponse(
        io.BytesIO(doc_bytes),
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={"Content-Disposition": "attachment; filename=formatted_manuscript.docx"},
    )


@app.post("/api/export/tracked")
def export_tracked(req: ExportRequest):
    try:
        doc_bytes = export_docx(req.manuscript, req.changes, mode="tracked")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Export error: {str(e)}")

    return StreamingResponse(
        io.BytesIO(doc_bytes),
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={"Content-Disposition": "attachment; filename=formatted_manuscript_tracked.docx"},
    )


@app.get("/api/health")
def health():
    return {"status": "ok"}
