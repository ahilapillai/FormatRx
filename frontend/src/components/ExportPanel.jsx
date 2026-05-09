import React, { useState, useMemo } from 'react'
import { api, downloadBlob } from '../utils/api'

// ── Summarise changes by category ───────────────────────────────────────────
function buildChangeSummary(changes) {
  const accepted = changes.filter((c) => c.accepted !== false)
  const summary  = { headings: 0, references: 0, sectionOrder: 0, grammar: 0, figures: 0 }

  for (const c of accepted) {
    if (c.field === 'heading')             summary.headings++
    else if (c.field === 'section_order')  summary.sectionOrder++
    else if ((c.field || '').startsWith('reference_')) summary.references++
    else if ((c.field || '').startsWith('figure_'))    summary.figures++
    else if (c.type === 'grammar')         summary.grammar++
  }
  return summary
}

function SummaryLine({ icon, label, count }) {
  if (!count) return null
  return (
    <div className="flex items-center gap-2 text-sm text-slate-600">
      <span className="text-base">{icon}</span>
      <span>{count} {label}</span>
    </div>
  )
}

// ── Main component ───────────────────────────────────────────────────────────
export default function ExportPanel({ finalManuscript, changes, journalId, onRestart }) {
  const [loadingClean,   setLoadingClean]   = useState(false)
  const [loadingTracked, setLoadingTracked] = useState(false)
  const [error, setError]   = useState('')
  const [done,  setDone]    = useState({ clean: false, tracked: false })
  const [showSafetyNote, setShowSafetyNote] = useState(false)

  const acceptedCount  = changes.filter((c) => c.accepted === true).length
  const rejectedCount  = changes.filter((c) => c.accepted === false).length
  const summary        = useMemo(() => buildChangeSummary(changes), [changes])
  const hasGrammar     = summary.grammar > 0
  const totalFormatting = summary.headings + summary.references + summary.sectionOrder + summary.figures

  async function handleExport(type) {
    setError('')
    if (type === 'clean') {
      setLoadingClean(true)
      try {
        const blob = await api.exportClean(finalManuscript, changes, journalId)
        downloadBlob(blob, 'formatted_manuscript.docx')
        setDone((d) => ({ ...d, clean: true }))
      } catch {
        setError('Export failed. Please try again.')
      } finally {
        setLoadingClean(false)
      }
    } else {
      setLoadingTracked(true)
      try {
        const blob = await api.exportTracked(finalManuscript, changes, journalId)
        downloadBlob(blob, 'formatted_manuscript_tracked.docx')
        setDone((d) => ({ ...d, tracked: true }))
      } catch {
        setError('Export failed. Please try again.')
      } finally {
        setLoadingTracked(false)
      }
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-4">

      {/* ── Change summary ── */}
      <div className="step-card">
        <h2 className="text-xl font-semibold text-slate-800 mb-1">Export Document</h2>
        <p className="text-sm text-slate-500 mb-6">
          Download your formatted manuscript. Choose clean (submission-ready) or tracked-changes version.
        </p>

        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="text-center p-3 bg-slate-50 rounded-xl">
            <p className="text-xl font-bold text-slate-700">{changes.length}</p>
            <p className="text-xs text-slate-400">Changes made</p>
          </div>
          <div className="text-center p-3 bg-green-50 rounded-xl">
            <p className="text-xl font-bold text-green-600">{acceptedCount}</p>
            <p className="text-xs text-green-400">Accepted</p>
          </div>
          <div className="text-center p-3 bg-red-50 rounded-xl">
            <p className="text-xl font-bold text-red-500">{rejectedCount}</p>
            <p className="text-xs text-red-400">Rejected</p>
          </div>
        </div>

        {/* Breakdown */}
        {changes.length > 0 && (
          <div className="mb-6 p-4 bg-slate-50 rounded-xl border border-slate-100 space-y-1.5">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">What was changed</p>
            <SummaryLine icon="🔡" label="section headings reformatted" count={summary.headings} />
            <SummaryLine icon="📚" label="references reformatted to journal style" count={summary.references} />
            <SummaryLine icon="🔀" label="section order adjusted" count={summary.sectionOrder} />
            <SummaryLine icon="🖼️" label="figure legend(s) updated" count={summary.figures} />
            <SummaryLine icon="✏️" label="minor grammar correction(s)" count={summary.grammar} />
            {!totalFormatting && !hasGrammar && (
              <p className="text-sm text-slate-400">No structural changes were required.</p>
            )}
          </div>
        )}

        {/* Export options */}
        <div className="grid gap-4">
          {/* Clean export */}
          <div className="p-5 rounded-xl border-2 border-slate-200 hover:border-brand-300 transition-colors">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-brand-100 rounded-xl flex items-center justify-center flex-shrink-0">
                <svg className="w-6 h-6 text-brand-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div className="flex-1">
                <p className="font-semibold text-slate-700">Clean Document</p>
                <p className="text-sm text-slate-500 mt-0.5">
                  Submission-ready .docx with all accepted changes applied. No markup or annotations.
                </p>
                <button
                  className="btn-primary mt-3"
                  onClick={() => handleExport('clean')}
                  disabled={loadingClean}
                >
                  {loadingClean ? (
                    <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Generating…</>
                  ) : done.clean ? '✓ Downloaded' : '↓ Download Clean .docx'}
                </button>
              </div>
            </div>
          </div>

          {/* Tracked changes export */}
          <div className="p-5 rounded-xl border-2 border-slate-200 hover:border-brand-300 transition-colors">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center flex-shrink-0">
                <svg className="w-6 h-6 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                    d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </div>
              <div className="flex-1">
                <p className="font-semibold text-slate-700">Tracked Changes Document</p>
                <p className="text-sm text-slate-500 mt-0.5">
                  .docx with all changes visible: deletions in red strikethrough, additions in green underline.
                  Useful for co-author review and institutional audit.
                </p>
                <button
                  className="btn-secondary mt-3"
                  onClick={() => handleExport('tracked')}
                  disabled={loadingTracked}
                >
                  {loadingTracked ? (
                    <><div className="w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />Generating…</>
                  ) : done.tracked ? '✓ Downloaded' : '↓ Download Tracked .docx'}
                </button>
              </div>
            </div>
          </div>
        </div>

        {error && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>
        )}
      </div>

      {/* ── AI & Plagiarism Safety Notice ── */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <button
          className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-slate-50 transition-colors"
          onClick={() => setShowSafetyNote((v) => !v)}
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-green-100 flex items-center justify-center flex-shrink-0">
              <svg className="w-4.5 h-4.5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{width:'18px',height:'18px'}}>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-700">Safe for journal submission</p>
              <p className="text-xs text-slate-400">FormatRx only modifies formatting — not your scientific content</p>
            </div>
          </div>
          <svg
            className={`w-4 h-4 text-slate-400 transition-transform ${showSafetyNote ? 'rotate-180' : ''}`}
            fill="none" stroke="currentColor" viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {showSafetyNote && (
          <div className="px-5 pb-5 border-t border-slate-100 pt-4 space-y-3 text-sm text-slate-600">
            <p>
              <strong className="text-slate-700">Will this trigger plagiarism or AI detection tools?</strong>
            </p>
            <p>
              No. Plagiarism checkers (e.g. iThenticate, Turnitin) compare text similarity against databases.
              FormatRx does not rewrite sentences or add new text — it reformats references, adjusts heading
              capitalisation, and reorders sections. These structural edits do not change similarity scores.
            </p>
            <p>
              AI detection tools (e.g. GPTZero, Turnitin AI) look for AI-generated prose patterns in
              your writing. FormatRx never rewrites your prose. Your scientific content — every sentence,
              result, and conclusion — remains exactly as you wrote it.
            </p>
            <p>
              <strong className="text-slate-700">For institutional review or co-author transparency</strong>, use the
              Tracked Changes export above. It shows precisely what was changed and proves every edit was
              structural, not content-level.
            </p>
            <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg text-green-800 text-xs leading-relaxed">
              ✅ FormatRx makes only the changes shown in this diff viewer. No hidden edits, no
              AI-generated sentences, no paraphrasing. Your authorship and originality are fully preserved.
            </div>
          </div>
        )}
      </div>

      {/* Start over */}
      <div className="text-center">
        <button
          className="text-sm text-slate-400 hover:text-slate-600 transition-colors"
          onClick={onRestart}
        >
          ↩ Format another manuscript
        </button>
      </div>
    </div>
  )
}
