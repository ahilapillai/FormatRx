import React, { useEffect, useState, useRef } from 'react'
import { api } from '../utils/api'

// ── Colour map for index badges ──────────────────────────────────────────────
const INDEX_COLORS = {
  PubMed:         'bg-blue-100 text-blue-700',
  MEDLINE:        'bg-indigo-100 text-indigo-700',
  Scopus:         'bg-orange-100 text-orange-700',
  'Web of Science': 'bg-emerald-100 text-emerald-700',
  DOAJ:           'bg-violet-100 text-violet-700',
  MEDKNOW:        'bg-sky-100 text-sky-700',
}
const INDEX_DEFAULT = 'bg-slate-100 text-slate-600'

// ── Tiny tooltip component ───────────────────────────────────────────────────
function Tooltip({ text, children }) {
  const [show, setShow] = useState(false)
  return (
    <span className="relative inline-flex items-center" onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)}>
      {children}
      {show && (
        <span className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 rounded-lg bg-slate-800 text-white text-xs p-2.5 shadow-lg leading-relaxed pointer-events-none">
          {text}
          <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-800" />
        </span>
      )}
    </span>
  )
}

function InfoIcon() {
  return (
    <svg className="w-3.5 h-3.5 text-slate-400 cursor-help" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  )
}

// ── Journal card ─────────────────────────────────────────────────────────────
function JournalCard({ journal, selected, onClick }) {
  const hasIndexing = journal.indexing && journal.indexing.length > 0
  const hasSJR      = journal.sjr != null
  const hasIF       = journal.impact_factor != null

  return (
    <button
      onClick={onClick}
      className={`w-full text-left p-4 rounded-xl border-2 transition-all
        ${selected
          ? 'border-brand-500 bg-brand-50 shadow-sm'
          : 'border-slate-200 hover:border-brand-300 hover:bg-slate-50'}`}
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className={`font-semibold text-sm ${selected ? 'text-brand-700' : 'text-slate-800'}`}>
              {journal.name}
            </p>
            {journal.open_access && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-green-100 text-green-700 border border-green-200">
                OA
              </span>
            )}
            {journal.new_journal && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-700 border border-amber-200">
                NEW
              </span>
            )}
          </div>
          {journal.publisher && (
            <p className="text-xs text-slate-400 mt-0.5">{journal.publisher}</p>
          )}
        </div>

        {/* Checkmark */}
        {selected && (
          <div className="w-5 h-5 rounded-full bg-brand-500 flex items-center justify-center flex-shrink-0 mt-0.5">
            <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          </div>
        )}
      </div>

      {/* Quick stats */}
      <div className="flex flex-wrap gap-3 mt-2.5 text-xs text-slate-500">
        {journal.word_limit && (
          <span>{journal.word_limit.toLocaleString()} words</span>
        )}
        {journal.reference_style && (
          <span>{journal.reference_style} refs</span>
        )}
        {journal.abstract_type && (
          <span className="capitalize">{journal.abstract_type} abstract</span>
        )}
      </div>

      {/* Indexing badges */}
      {hasIndexing ? (
        <div className="flex flex-wrap gap-1.5 mt-2.5 items-center">
          <Tooltip text="Indexing status indicates whether a journal is scientifically recognised and listed in trusted academic databases.">
            <InfoIcon />
          </Tooltip>
          {journal.indexing.map((idx) => (
            <span
              key={idx}
              className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold ${INDEX_COLORS[idx] || INDEX_DEFAULT}`}
            >
              {idx}
            </span>
          ))}
        </div>
      ) : journal.new_journal ? (
        <p className="mt-2 text-[11px] text-amber-600 italic">
          New journal — indexing pending
        </p>
      ) : null}

      {/* Impact metrics */}
      {(hasIF || hasSJR) && (
        <div className="flex gap-4 mt-2 text-xs text-slate-500 items-center">
          <Tooltip text="Impact Factor reflects how frequently articles from this journal are cited by other researchers on average. Higher = greater scientific reach.">
            <span className="flex items-center gap-1 cursor-help">
              <InfoIcon />
              {hasIF
                ? <span>IF <strong className="text-slate-700">{journal.impact_factor.toFixed(1)}</strong></span>
                : null}
            </span>
          </Tooltip>
          {hasSJR && (
            <Tooltip text="SJR (Scimago Journal Rank) measures journal prestige weighted by the quality of citing journals. A free, peer-reviewed alternative to Impact Factor.">
              <span className="flex items-center gap-1 cursor-help">
                <InfoIcon />
                SJR <strong className="text-slate-700">{journal.sjr.toFixed(2)}</strong>
              </span>
            </Tooltip>
          )}
          {journal.cite_score != null && (
            <span>
              CiteScore <strong className="text-slate-700">{journal.cite_score.toFixed(1)}</strong>
            </span>
          )}
        </div>
      )}
    </button>
  )
}

// ── Main component ───────────────────────────────────────────────────────────
export default function JournalSelectStep({ manuscript, onComplete, onBack }) {
  const [journals, setJournals]   = useState([])
  const [selected, setSelected]   = useState(null)
  const [loading, setLoading]     = useState(true)

  useEffect(() => {
    api.getJournals()
      .then((d) => setJournals(d.journals || []))
      .catch(() => setJournals([]))
      .finally(() => setLoading(false))
  }, [])

  const manuscript_wc = manuscript?.word_count || 0
  const sections      = manuscript?.sections?.map((s) => s.heading).join(', ') || '—'

  return (
    <div className="step-card max-w-2xl mx-auto">
      <h2 className="text-xl font-semibold text-slate-800 mb-1">Select Target Journal</h2>
      <p className="text-sm text-slate-500 mb-6">
        Choose the journal you are submitting to. Formatting rules will be loaded accordingly.
      </p>

      {/* Manuscript summary */}
      <div className="mb-6 p-4 bg-slate-50 rounded-xl border border-slate-200 text-sm">
        <p className="font-medium text-slate-700 mb-2">Parsed Manuscript</p>
        <div className="grid grid-cols-2 gap-2 text-slate-600">
          <span>Title:</span>
          <span className="font-medium truncate">{manuscript?.title || '—'}</span>
          <span>Word count:</span>
          <span className="font-medium">{manuscript_wc.toLocaleString()}</span>
          <span>Sections:</span>
          <span className="font-medium">{sections}</span>
          <span>References:</span>
          <span className="font-medium">{manuscript?.references?.length || 0}</span>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-8">
          <div className="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="grid gap-3">
          {journals.map((j) => (
            <JournalCard
              key={j.id}
              journal={j}
              selected={selected === j.id}
              onClick={() => setSelected(j.id)}
            />
          ))}
        </div>
      )}

      <div className="flex gap-3 mt-8">
        <button className="btn-secondary" onClick={onBack}>← Back</button>
        <button
          className="btn-primary flex-1 justify-center"
          disabled={!selected}
          onClick={() => onComplete({ journalId: selected })}
        >
          Continue →
        </button>
      </div>
    </div>
  )
}
