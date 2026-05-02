import React, { useEffect, useState } from 'react'
import { api } from '../utils/api'

// ─── Status config ────────────────────────────────────────────────────────────
const STATUS = {
  ok:        { icon: '✓', label: 'Already compliant',   bg: 'bg-green-50',  border: 'border-green-200', text: 'text-green-700',  dot: 'bg-green-500'  },
  auto:      { icon: '→', label: 'Will be auto-fixed',  bg: 'bg-blue-50',   border: 'border-blue-200',  text: 'text-blue-700',   dot: 'bg-blue-500'   },
  warning:   { icon: '⚠', label: 'Needs attention',     bg: 'bg-amber-50',  border: 'border-amber-200', text: 'text-amber-700',  dot: 'bg-amber-400'  },
  error:     { icon: '✗', label: 'Not compliant',       bg: 'bg-red-50',    border: 'border-red-200',   text: 'text-red-700',    dot: 'bg-red-500'    },
}

// ─── Rule row ─────────────────────────────────────────────────────────────────
function RuleRow({ icon, label, rule, value, status, note }) {
  const s = STATUS[status] || STATUS.auto
  return (
    <div className={`flex items-start gap-4 px-5 py-4 rounded-xl border ${s.bg} ${s.border}`}>
      {/* Status dot + icon */}
      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${s.dot} text-white font-bold text-sm`}>
        {s.icon}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold text-slate-700 text-sm">{label}</span>
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${s.bg} ${s.text} border ${s.border}`}>
            {s.label}
          </span>
        </div>
        <p className="text-sm text-slate-600 mt-0.5">
          <span className="font-medium">Required:</span> {rule}
        </p>
        {value && (
          <p className="text-sm text-slate-500 mt-0.5">
            <span className="font-medium">Your document:</span> {value}
          </p>
        )}
        {note && (
          <p className="text-xs text-slate-400 mt-1 italic">{note}</p>
        )}
      </div>
    </div>
  )
}

// ─── Section tag ──────────────────────────────────────────────────────────────
function SectionTag({ name, present }) {
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border
      ${present
        ? 'bg-green-50 border-green-300 text-green-700'
        : 'bg-red-50 border-red-300 text-red-700'}`}>
      {present ? '✓' : '✗'} {name}
    </span>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function JournalRulesStep({ manuscript, journalId, onComplete, onBack }) {
  const [rules, setRules] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    Promise.all([
      api.getJournalRules(journalId),
    ])
      .then(([r]) => setRules(r))
      .catch(() => setError('Could not load journal rules.'))
      .finally(() => setLoading(false))
  }, [journalId])

  if (loading) return (
    <div className="step-card max-w-2xl mx-auto flex justify-center py-16">
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-slate-500 text-sm">Loading journal requirements…</p>
      </div>
    </div>
  )

  if (error) return (
    <div className="step-card max-w-2xl mx-auto">
      <p className="text-red-600 text-sm">{error}</p>
      <button className="btn-secondary mt-4" onClick={onBack}>← Back</button>
    </div>
  )

  // ── Derive manuscript facts ──────────────────────────────────────────────
  const wc = manuscript?.word_count || 0
  const sectionNames = (manuscript?.sections || []).map((s) => s.heading.toLowerCase())
  const abstractPresent = !!(manuscript?.abstract)
  const refCount = (manuscript?.references || []).length
  const figCount = (manuscript?.figure_legends || []).length

  const requiredSections = rules.sections_required || []
  const sectionOrder = rules.sections_order || []

  // Check which required sections are present
  const sectionChecks = requiredSections.map((req) => ({
    name: req,
    present: sectionNames.some((s) => s.includes(req.toLowerCase()) || req.toLowerCase().includes(s)),
  }))
  const missingSections = sectionChecks.filter((s) => !s.present)

  // Word count status
  const wordLimit = rules.word_limit || 0
  const wcStatus = wordLimit
    ? wc > wordLimit ? 'error' : wc > wordLimit * 0.9 ? 'warning' : 'ok'
    : 'ok'

  // Current heading cases
  const headingCase = rules.heading_case
  const headingCaseLabel = headingCase === 'title' ? 'Title Case' : headingCase === 'upper' ? 'ALL CAPS' : headingCase

  // Determine which current headings are already in correct case
  const headingsNeedFix = (manuscript?.sections || []).some((s) => {
    if (headingCase === 'title') return s.heading !== s.heading.replace(/\w\S*/g, (t) => t.charAt(0).toUpperCase() + t.slice(1))
    if (headingCase === 'upper') return s.heading !== s.heading.toUpperCase()
    return false
  })

  // Abstract status
  const abstractType = rules.abstract_type
  const abstractWordLimit = rules.abstract_word_limit || 0
  const abstractWC = (manuscript?.abstract || '').split(' ').filter(Boolean).length
  const abstractStatus = !abstractPresent ? 'error'
    : abstractWordLimit && abstractWC > abstractWordLimit ? 'warning'
    : 'ok'

  // Section order — check if current order matches journal order
  const currentOrder = sectionNames
  const orderMismatch = sectionOrder.length > 0 && currentOrder.some((s, i) => {
    const expected = sectionOrder.findIndex((o) => o.toLowerCase().includes(s) || s.includes(o.toLowerCase()))
    return expected !== -1 && expected !== i
  })

  // Summarise what will be auto-done vs. manual
  const autoFixes = []
  const manualItems = []

  if (headingsNeedFix) autoFixes.push('Heading case')
  if (orderMismatch) autoFixes.push('Section order')
  if (refCount > 0) autoFixes.push('Reference formatting (Vancouver)')
  if (figCount > 0) autoFixes.push('Figure legend labels')
  if (missingSections.length > 0) manualItems.push(`Missing sections: ${missingSections.map((s) => s.name).join(', ')}`)
  if (wcStatus === 'error') manualItems.push('Word count exceeds limit — manual trimming required')
  if (!abstractPresent) manualItems.push('Abstract is missing')

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      {/* Header card */}
      <div className="step-card">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 bg-brand-100 rounded-xl flex items-center justify-center flex-shrink-0">
            <svg className="w-6 h-6 text-brand-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
          </div>
          <div>
            <h2 className="text-xl font-semibold text-slate-800">{rules.journal_name}</h2>
            <p className="text-sm text-slate-500 mt-0.5">
              Format requirements for your manuscript. Review what will be changed before proceeding.
            </p>
          </div>
        </div>

        {/* Summary pills */}
        <div className="mt-5 flex flex-wrap gap-2">
          {autoFixes.length > 0 && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 border border-blue-200 rounded-lg">
              <span className="w-2 h-2 rounded-full bg-blue-500" />
              <span className="text-xs font-medium text-blue-700">{autoFixes.length} item{autoFixes.length > 1 ? 's' : ''} will be auto-formatted</span>
            </div>
          )}
          {manualItems.length > 0 && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-lg">
              <span className="w-2 h-2 rounded-full bg-amber-400" />
              <span className="text-xs font-medium text-amber-700">{manualItems.length} item{manualItems.length > 1 ? 's' : ''} need{manualItems.length === 1 ? 's' : ''} manual attention</span>
            </div>
          )}
          {autoFixes.length === 0 && manualItems.length === 0 && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-green-50 border border-green-200 rounded-lg">
              <span className="w-2 h-2 rounded-full bg-green-500" />
              <span className="text-xs font-medium text-green-700">Manuscript already meets all requirements</span>
            </div>
          )}
        </div>
      </div>

      {/* ── Rules checklist ── */}
      <div className="step-card space-y-3">
        <h3 className="font-semibold text-slate-700 mb-4">Formatting Requirements</h3>

        {/* Word count */}
        <RuleRow
          label="Word Limit"
          rule={wordLimit ? `Maximum ${wordLimit.toLocaleString()} words` : 'No limit specified'}
          value={`Current: ${wc.toLocaleString()} words`}
          status={wcStatus === 'ok' ? 'ok' : wcStatus === 'warning' ? 'warning' : 'error'}
          note={wcStatus === 'error' ? 'Manual trimming required — the tool will not cut content automatically.' : undefined}
        />

        {/* Abstract */}
        <RuleRow
          label="Abstract"
          rule={`${abstractType === 'structured' ? 'Structured' : 'Unstructured'} abstract${abstractWordLimit ? `, max ${abstractWordLimit} words` : ''}`}
          value={abstractPresent
            ? `Present (${abstractWC} words${abstractType === 'structured' ? `, ${rules.abstract_sections?.join(' / ')}` : ''})`
            : 'Not detected'}
          status={abstractStatus}
          note={abstractType === 'structured' && abstractPresent
            ? `Required sub-sections: ${(rules.abstract_sections || []).join(', ')}`
            : undefined}
        />

        {/* Required sections */}
        <div className={`px-5 py-4 rounded-xl border ${missingSections.length > 0 ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'}`}>
          <div className="flex items-center gap-3 mb-3">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-white font-bold text-sm ${missingSections.length > 0 ? 'bg-red-500' : 'bg-green-500'}`}>
              {missingSections.length > 0 ? '✗' : '✓'}
            </div>
            <div>
              <span className="font-semibold text-slate-700 text-sm">Required Sections</span>
              <span className={`ml-2 text-xs px-2 py-0.5 rounded-full font-medium border ${missingSections.length > 0 ? 'bg-red-50 border-red-300 text-red-700' : 'bg-green-50 border-green-300 text-green-700'}`}>
                {missingSections.length > 0 ? STATUS.error.label : STATUS.ok.label}
              </span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 ml-11">
            {sectionChecks.map((s) => (
              <SectionTag key={s.name} name={s.name} present={s.present} />
            ))}
          </div>
          {missingSections.length > 0 && (
            <p className="text-xs text-red-600 mt-2 ml-11">
              Missing sections must be added manually before submission.
            </p>
          )}
        </div>

        {/* Section order */}
        {sectionOrder.length > 0 && (
          <RuleRow
            label="Section Order"
            rule={sectionOrder.filter(s => !['Figure Legends', 'Tables'].includes(s)).join(' → ')}
            value={orderMismatch ? 'Order differs from journal requirement' : 'Order matches'}
            status={orderMismatch ? 'auto' : 'ok'}
            note={orderMismatch ? 'Sections will be reordered automatically.' : undefined}
          />
        )}

        {/* Heading case */}
        <RuleRow
          label="Heading Style"
          rule={`${headingCaseLabel} headings`}
          value={headingsNeedFix ? `Some headings need case adjustment` : `All headings already in ${headingCaseLabel}`}
          status={headingsNeedFix ? 'auto' : 'ok'}
          note={headingsNeedFix ? `All section headings will be converted to ${headingCaseLabel} automatically.` : undefined}
        />

        {/* Reference style */}
        <RuleRow
          label="Reference Style"
          rule={`${rules.reference_style || 'Vancouver'} — numbered, ${rules.reference_format?.brackets === 'superscript' ? 'superscript' : 'inline'}`}
          value={refCount > 0 ? `${refCount} references detected` : 'No references detected'}
          status={refCount > 0 ? 'auto' : 'warning'}
          note={refCount > 0
            ? 'References will be numbered and formatted to the required style automatically.'
            : 'No reference section was detected. Ensure your references section heading is labelled "References".'}
        />

        {/* Figure limit */}
        {rules.figure_limit > 0 && (
          <RuleRow
            label="Figure Limit"
            rule={`Maximum ${rules.figure_limit} figures`}
            value={figCount > 0 ? `${figCount} figure legend${figCount > 1 ? 's' : ''} detected` : 'No figure legends detected'}
            status={figCount > rules.figure_limit ? 'error' : 'ok'}
            note={figCount > rules.figure_limit
              ? `You have ${figCount} figures — ${figCount - rules.figure_limit} must be removed before submission.`
              : figCount > 0 ? 'Figure legend labels will be standardised automatically.' : undefined}
          />
        )}
      </div>

      {/* ── What will be edited ── */}
      {(autoFixes.length > 0 || manualItems.length > 0) && (
        <div className="step-card">
          <h3 className="font-semibold text-slate-700 mb-3">Editing Plan</h3>
          {autoFixes.length > 0 && (
            <div className="mb-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-blue-600 mb-2">Auto-formatted by tool</p>
              <div className="space-y-1">
                {autoFixes.map((f) => (
                  <div key={f} className="flex items-center gap-2 text-sm text-slate-700">
                    <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-bold flex-shrink-0">→</span>
                    {f}
                  </div>
                ))}
              </div>
            </div>
          )}
          {manualItems.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-amber-600 mb-2">Requires your attention</p>
              <div className="space-y-1">
                {manualItems.map((f) => (
                  <div key={f} className="flex items-center gap-2 text-sm text-slate-700">
                    <span className="w-5 h-5 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center text-xs font-bold flex-shrink-0">⚠</span>
                    {f}
                  </div>
                ))}
              </div>
            </div>
          )}
          <p className="mt-4 text-xs text-slate-400">
            All auto-formatted changes will be shown one by one in the next step — you can accept, reject, or edit each individually.
          </p>
        </div>
      )}

      <div className="flex gap-3">
        <button className="btn-secondary" onClick={onBack}>← Back</button>
        <button className="btn-primary flex-1 justify-center" onClick={onComplete}>
          Proceed to Formatting →
        </button>
      </div>
    </div>
  )
}
