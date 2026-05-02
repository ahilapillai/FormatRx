# Manuscript Formatter — Pathology Journal Compliance Tool

A web application for pathologists to format manuscripts to journal guidelines.
**No content is rewritten. Every change is visible, reversible, and user-approved.**

---

## Quick Start

### 1. Backend (Python / FastAPI)

```bash
cd backend

# Install dependencies
pip install -r requirements.txt

# Optional: set your Anthropic API key if using "Format + Minor Grammar" mode
export ANTHROPIC_API_KEY=sk-ant-...

# Run
uvicorn main:app --reload --port 8000
```

API docs available at: http://localhost:8000/docs

### 2. Frontend (React / Vite)

```bash
cd frontend

# Install dependencies
npm install

# Run dev server
npm run dev
```

App available at: http://localhost:5173

---

## Project Structure

```
manuscript-formatter/
├── backend/
│   ├── main.py            # FastAPI app + all endpoints
│   ├── parser.py          # .docx → structured JSON
│   ├── journal_rules.py   # Journal config loader + validation
│   ├── formatter.py       # Formatting engine (strict mode)
│   ├── diff_engine.py     # Inline diff generation + change application
│   ├── compliance.py      # Compliance checklist generator
│   ├── exporter.py        # Structured JSON → .docx (clean + tracked)
│   ├── requirements.txt
│   └── journals/
│       ├── cureus.json    # Cureus journal rules
│       └── ajsp.json      # AJSP journal rules
│
└── frontend/
    ├── src/
    │   ├── App.jsx                        # Main app + step state machine
    │   ├── components/
    │   │   ├── StepIndicator.jsx          # Progress indicator (steps 1–6)
    │   │   ├── UploadStep.jsx             # Drag-and-drop .docx upload
    │   │   ├── JournalSelectStep.jsx      # Journal template picker
    │   │   ├── EditModeStep.jsx           # Format Only vs Format+Grammar
    │   │   ├── DiffViewer.jsx             # Per-change accept/reject UI
    │   │   ├── CompliancePanel.jsx        # Compliance checklist display
    │   │   └── ExportPanel.jsx            # Clean + tracked .docx export
    │   └── utils/
    │       └── api.js                     # All API calls (axios)
    ├── index.html
    ├── vite.config.js
    ├── tailwind.config.js
    └── package.json
```

---

## User Flow

1. **Upload** — Drop a `.docx` manuscript. Parsed into JSON (title, abstract, sections, references, figures). No changes made.
2. **Select Journal** — Choose Cureus or AJSP. Rules are loaded (heading case, ref style, required sections, word limit, etc.).
3. **Edit Mode** — `Format Only` (safe default) or `Format + Minor Grammar` (AI-assisted, reviewable).
4. **Review Diffs** — Every change shown with inline diff (red = deleted, green = added). Accept/reject individually or by type. Bulk-accept by category.
5. **Compliance** — Structured checklist: errors, warnings, passed items. Sections mapped to their document location.
6. **Export** — Clean `.docx` (submission-ready) or Tracked Changes `.docx` (for co-author review).

---

## Adding a New Journal

Create a new file in `backend/journals/<journal_id>.json`:

```json
{
  "journal_name": "Journal of Pathology",
  "journal_id": "jpath",
  "abstract_type": "structured",
  "abstract_word_limit": 250,
  "word_limit": 3500,
  "reference_style": "Vancouver",
  "sections_required": ["Introduction", "Materials and Methods", "Results", "Discussion"],
  "sections_order": ["Abstract", "Introduction", "Materials and Methods", "Results", "Discussion", "References"],
  "heading_case": "title",
  "figure_limit": 8,
  "table_limit": 6,
  "reference_format": {
    "style": "Vancouver",
    "numbered": true,
    "brackets": "superscript"
  },
  "abstract_sections": ["Background", "Methods", "Results", "Conclusions"]
}
```

The journal will automatically appear in the frontend dropdown. No code changes required.

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/journals` | List available journal templates |
| POST | `/parse` | Upload + parse `.docx` → JSON |
| POST | `/format` | Apply formatting rules, get changes + diffs |
| POST | `/apply-changes` | Apply accepted changes to manuscript |
| POST | `/compliance` | Generate compliance checklist |
| POST | `/export/clean` | Download clean `.docx` |
| POST | `/export/tracked` | Download tracked-changes `.docx` |

---

## Core Constraints (by design)

- Formatter **never rewrites** paragraphs or changes scientific meaning
- Formatter **never adds** new content
- In `format_only` mode, **zero sentence modifications** are made
- In `format_plus_minor_grammar` mode, the LLM prompt explicitly forbids meaning changes and content rewrites
- All changes are **diff-tracked** and require **explicit user approval**
- No data is persisted server-side between requests

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `ANTHROPIC_API_KEY` | Only for grammar mode | API key for Claude (grammar fixes) |
