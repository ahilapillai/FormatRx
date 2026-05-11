import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react'
import { api } from '../utils/api'

// ─── Constants ────────────────────────────────────────────────────────────────
const TYPE_COLORS = {
  formatting: {
    bg: 'bg-blue-100', border: 'border-blue-400', ring: 'ring-blue-300',
    badge: 'bg-blue-100 text-blue-700', dot: 'bg-blue-400',
  },
  grammar: {
    bg: 'bg-purple-100', border: 'border-purple-400', ring: 'ring-purple-300',
    badge: 'bg-purple-100 text-purple-700', dot: 'bg-purple-400',
  },
  compliance: {
    bg: 'bg-orange-100', border: 'border-orange-400', ring: 'ring-orange-300',
    badge: 'bg-orange-100 text-orange-700', dot: 'bg-orange-400',
  },
}

// ─── Inline diff renderer ─────────────────────────────────────────────────────
function InlineDiff({ segments }) {
  if (!segments || segments.length === 0) return null
  return (
    <>
      {segments.map((seg, i) => {
        if (seg.op === 'equal') return <span key={i}>{seg.text}</span>
        if (seg.op === 'insert')
          return <mark key={i} className="bg-green-200 text-green-900 rounded px-0.5 not-italic">{seg.text}</mark>
        if (seg.op === 'delete')
          return <span key={i} className="line-through text-red-400 opacity-60">{seg.text}</span>
        return null
      })}
    </>
  )
}

// ─── Hover popover ────────────────────────────────────────────────────────────
function ChangePopover({ change, pos, onAccept, onReject, onEdit, onClose }) {
  const [editMode, setEditMode] = useState(false)
  const [editValue, setEditValue] = useState(change.updated || '')
  const ref = useRef()

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) onClose()
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [onClose])

  // Update editValue when change prop updates
  useEffect(() => { setEditValue(change.updated || '') }, [change.id])

  const colors = TYPE_COLORS[change.type] || TYPE_COLORS.formatting
  const status = change.accepted === true ? 'accepted' : change.accepted === false ? 'rejected' : 'pending'

  const safeX = Math.min(pos.x, window.innerWidth - 340)
  const safeY = pos.y + 8 + window.scrollY

  return (
    <div
      ref={ref}
      className="fixed z-50 w-80 bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden"
      style={{ left: safeX, top: pos.y + 8 }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header */}
      <div className={`px-3 py-2 flex items-center gap-2 ${colors.bg}`}>
        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${colors.badge}`}>{change.type}</span>
        <span className="text-xs text-slate-600 truncate flex-1">{change.description}</span>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-600 flex-shrink-0">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {editMode ? (
        <div className="p-3">
          <p className="text-xs text-slate-500 mb-1.5">Edit the formatted text:</p>
          <textarea
            className="w-full text-sm border border-slate-300 rounded-lg p-2 resize-none focus:outline-none focus:ring-2 focus:ring-brand-400"
            rows={4}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            autoFocus
          />
          <div className="flex gap-2 mt-2">
            <button
              className="flex-1 px-3 py-1.5 bg-brand-500 text-white text-xs font-semibold rounded-lg hover:bg-brand-600 transition-colors"
              onClick={() => { onEdit(change.id, editValue); setEditMode(false); onClose() }}
            >
              Save & Accept
            </button>
            <button
              className="px-3 py-1.5 bg-slate-100 text-slate-600 text-xs font-semibold rounded-lg hover:bg-slate-200 transition-colors"
              onClick={() => setEditMode(false)}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Before / After */}
          <div className="p-3 grid grid-cols-2 gap-2 text-xs border-b border-slate-100">
            <div>
              <p className="text-slate-400 font-semibold uppercase mb-1">Before</p>
              <div className="bg-red-50 border border-red-100 rounded p-2 text-slate-600 max-h-24 overflow-auto leading-relaxed">
                {change.original || <span className="italic text-slate-400">—</span>}
              </div>
            </div>
            <div>
              <p className="text-slate-400 font-semibold uppercase mb-1">After</p>
              <div className="bg-green-50 border border-green-100 rounded p-2 text-slate-700 max-h-24 overflow-auto leading-relaxed font-medium">
                {change.updated || <span className="italic text-slate-400">—</span>}
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="px-3 py-2.5 flex gap-2">
            {status === 'accepted' ? (
              <button onClick={() => { onReject(change.id) }}
                className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 text-sm font-semibold rounded-lg transition-colors">
                ↩ Undo Accept
              </button>
            ) : (
              <button onClick={() => { onAccept(change.id); onClose() }}
                className="flex-1 py-2 bg-green-500 hover:bg-green-600 text-white text-sm font-semibold rounded-lg transition-colors flex items-center justify-center gap-1">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
                Accept
              </button>
            )}
            {status === 'rejected' ? (
              <button onClick={() => { onAccept(change.id) }}
                className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 text-sm font-semibold rounded-lg transition-colors">
                ↩ Undo Reject
              </button>
            ) : (
              <button onClick={() => { onReject(change.id); onClose() }}
                className="flex-1 py-2 bg-red-50 hover:bg-red-100 text-red-600 text-sm font-semibold rounded-lg border border-red-200 transition-colors flex items-center justify-center gap-1">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                </svg>
                Reject
              </button>
            )}
            <button onClick={() => setEditMode(true)}
              className="w-10 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 text-sm font-semibold rounded-lg border border-slate-200 transition-colors"
              title="Edit manually">
              ✎
            </button>
          </div>
        </>
      )}
    </div>
  )
}

// ─── Highlighted span wrapping changed content ────────────────────────────────
function HighlightedBlock({ change, children, onOpen }) {
  if (!change) return <>{children}</>
  const colors = TYPE_COLORS[change.type] || TYPE_COLORS.formatting
  const status = change.accepted === true ? 'accepted' : change.accepted === false ? 'rejected' : 'pending'

  const ring = status === 'accepted'
    ? 'bg-green-50 border-green-400 ring-green-100'
    : status === 'rejected'
    ? 'bg-red-50 border-red-300 ring-red-100 opacity-50 line-through'
    : `${colors.bg} ${colors.border} ${colors.ring}`

  return (
    <span
      className={`relative cursor-pointer rounded px-1 py-0.5 border-b-2 ring-1 ring-inset transition-all hover:brightness-95 group ${ring}`}
      onClick={(e) => { e.stopPropagation(); onOpen(e, change) }}
    >
      {children}
      {/* Tiny indicator dot */}
      <span className={`absolute -top-1.5 -right-1.5 w-2.5 h-2.5 rounded-full border-2 border-white shadow
        ${status === 'accepted' ? 'bg-green-500' : status === 'rejected' ? 'bg-red-400' : colors.dot}`}
      />
      {/* Hover hint */}
      <span className="absolute -top-7 left-0 hidden group-hover:flex items-center gap-1 bg-slate-800 text-white text-xs rounded px-2 py-1 whitespace-nowrap shadow-lg z-10">
        ✓ Accept &nbsp;·&nbsp; ✗ Reject &nbsp;·&nbsp; ✎ Edit
      </span>
    </span>
  )
}

// ─── One aligned row (left original | right formatted) ───────────────────────
function SectionRow({ left, right, isHeading = false }) {
  return (
    <div className={`grid grid-cols-2 border-b border-slate-100 ${isHeading ? 'bg-slate-50' : ''}`}>
      <div className="px-6 py-4 border-r border-slate-200">{left}</div>
      <div className="px-6 py-4">{right}</div>
    </div>
  )
}

// ─── Image-aware content renderer ────────────────────────────────────────────
// Splits text on [[IMG:id]] tokens and renders images inline.
function ContentWithImages({ text, imageMap, className = '' }) {
  if (!text) return <span className="text-slate-400 text-sm">—</span>
  if (!imageMap || Object.keys(imageMap).length === 0) {
    return <span className={`whitespace-pre-wrap text-slate-600 text-sm leading-relaxed ${className}`}>{text}</span>
  }

  const parts = text.split(/(\[\[IMG:[^\]]+\]\])/g)
  if (parts.length === 1) {
    return <span className={`whitespace-pre-wrap text-slate-600 text-sm leading-relaxed ${className}`}>{text}</span>
  }

  return (
    <span className={`text-sm leading-relaxed ${className}`}>
      {parts.map((part, i) => {
        const m = part.match(/^\[\[IMG:([^\]]+)\]\]$/)
        if (m) {
          const src = imageMap[m[1]]
          if (!src) return null
          return (
            <span key={i} className="block my-3">
              <img
                src={src}
                alt="Figure from document"
                className="max-w-full h-auto rounded border border-slate-200 shadow-sm"
                style={{ maxHeight: '400px', objectFit: 'contain' }}
              />
            </span>
          )
        }
        return part
          ? <span key={i} className="whitespace-pre-wrap text-slate-600">{part}</span>
          : null
      })}
    </span>
  )
}

// ─── Main DiffViewerStep ──────────────────────────────────────────────────────
export default function DiffViewerStep({
  originalManuscript,
  formattedManuscript,
  initialChanges,
  journalId,
  imageMap = {},
  onComplete,
  onBack,
}) {
  const [changes, setChanges] = useState(
    (initialChanges || []).map((c) => ({ ...c, accepted: null }))
  )
  const [popover, setPopover] = useState(null)
  const [saving, setSaving] = useState(false)

  const orig = originalManuscript || {}
  const fmt  = formattedManuscript || {}

  // ── Robust change lookup ──────────────────────────────────────────────────
  // Build a multi-value map to handle duplicate section headings gracefully.
  // Each key maps to a list of changes; we pop from the front as we consume them.
  const changePool = useRef({})
  useEffect(() => {
    const pool = {}
    changes.forEach((c) => {
      const key = `${(c.section || '').toLowerCase()}::${c.field}`
      if (!pool[key]) pool[key] = []
      pool[key].push(c.id)
    })
    changePool.current = pool
  }, [changes.map(c => c.id).join(',')])

  // Consumed map tracks which change IDs have already been matched to a row.
  // We rebuild section pairs once per render using a local consumed set.
  const changeById = useMemo(() => {
    const m = {}
    changes.forEach(c => { m[c.id] = c })
    return m
  }, [changes])

  // Build section pairs: match fmt sections → orig sections + their changes.
  // Handles: heading renames, reordering, duplicate headings.
  const sectionPairs = useMemo(() => {
    const consumed = new Set()

    function pickChange(section, field) {
      const key = `${(section || '').toLowerCase()}::${field}`
      const pool = (changePool.current[key] || [])
      const id = pool.find(id => !consumed.has(id))
      if (id) { consumed.add(id); return changeById[id] }
      return null
    }

    // Build orig section index (by heading, accounting for duplicates)
    const origByHeading = {}
    ;(orig.sections || []).forEach((s) => {
      const k = s.heading.toLowerCase()
      if (!origByHeading[k]) origByHeading[k] = []
      origByHeading[k].push(s)
    })
    const origUsed = {}

    // All heading changes: original → updated
    const headingChanges = changes.filter(c => c.field === 'heading')

    return (fmt.sections || []).map((fmtSec, i) => {
      // Find if this heading was renamed (original name is in headingChange.original)
      const headingCh = headingChanges.find(c =>
        c.updated?.toLowerCase() === fmtSec.heading.toLowerCase()
      ) || null

      const origHeadingKey = headingCh
        ? headingCh.original.toLowerCase()
        : fmtSec.heading.toLowerCase()

      if (!origUsed[origHeadingKey]) origUsed[origHeadingKey] = 0
      const origSec =
        (origByHeading[origHeadingKey] || [])[origUsed[origHeadingKey]++] ||
        (orig.sections || [])[i] ||
        {}

      // Find content change by section heading (formatted heading)
      const contentCh = changes.find(c =>
        c.field === 'content' &&
        c.section?.toLowerCase() === fmtSec.heading.toLowerCase() &&
        !consumed.has(c.id)
      ) || null
      if (contentCh) consumed.add(contentCh.id)

      return { origSec, fmtSec, headingCh, contentCh, index: i }
    })
  }, [fmt.sections, orig.sections, changes])

  // ── Actions ──────────────────────────────────────────────────────────────
  const accept = useCallback((id) => {
    setChanges((p) => p.map((c) => c.id === id ? { ...c, accepted: true } : c))
  }, [])
  const reject = useCallback((id) => {
    setChanges((p) => p.map((c) => c.id === id ? { ...c, accepted: false } : c))
  }, [])
  const editChange = useCallback((id, val) => {
    setChanges((p) => p.map((c) =>
      c.id === id ? { ...c, updated: val, accepted: true, inline_diff: null } : c
    ))
  }, [])
  const acceptAll = () => setChanges((p) => p.map((c) => ({ ...c, accepted: true })))
  const rejectAll = () => setChanges((p) => p.map((c) => ({ ...c, accepted: false })))

  const pending  = changes.filter((c) => c.accepted === null).length
  const accepted = changes.filter((c) => c.accepted === true).length
  const rejected = changes.filter((c) => c.accepted === false).length

  function openPopover(e, change) {
    e.stopPropagation()
    const rect = e.currentTarget.getBoundingClientRect()
    setPopover({ changeId: change.id, x: rect.left, y: rect.bottom })
  }

  const liveChange = popover ? changes.find((c) => c.id === popover.changeId) : null

  // ── Render helpers ────────────────────────────────────────────────────────
  function renderRight(text, change) {
    if (!change) return <span className="whitespace-pre-wrap">{text}</span>
    // Always wrap in HighlightedBlock — even if inline_diff is missing
    const inner = change.inline_diff && change.inline_diff.length > 0
      ? <InlineDiff segments={change.inline_diff} />
      : <span className="whitespace-pre-wrap">{change.updated ?? text}</span>
    return <HighlightedBlock change={change} onOpen={openPopover}>{inner}</HighlightedBlock>
  }
  function renderOrig(text) {
    return <ContentWithImages text={text || '—'} imageMap={imageMap} />
  }

  // Abstract change
  const abstractChange = changes.find(c => c.field === 'content' && c.section?.toLowerCase() === 'abstract') || null

  async function handleContinue() {
    setSaving(true)
    try {
      const result = await api.applyChanges(fmt, changes)
      onComplete({ finalManuscript: result.final_manuscript, changes })
    } catch {
      onComplete({ finalManuscript: fmt, changes })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="flex flex-col bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden"
      style={{ height: 'calc(100vh - 140px)' }}
      onClick={() => setPopover(null)}
    >
      {/* ── Toolbar ── */}
      <div className="flex-shrink-0 flex items-center gap-3 px-5 py-3 border-b border-slate-200 bg-white z-10">
        <button className="btn-secondary text-sm py-1.5" onClick={onBack}>← Back</button>

        {/* Stats */}
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-slate-600">{changes.length} changes</span>
          <span className="text-xs px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full">{pending} pending</span>
          <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded-full">{accepted} accepted</span>
          <span className="text-xs px-2 py-0.5 bg-red-100 text-red-600 rounded-full">{rejected} rejected</span>
        </div>

        {/* Legend */}
        <div className="hidden lg:flex items-center gap-3 text-xs text-slate-500 border-l border-slate-200 pl-3">
          {Object.entries(TYPE_COLORS).map(([t, c]) => (
            <span key={t} className="flex items-center gap-1">
              <span className={`w-2 h-2 rounded-full ${c.dot}`} />{t}
            </span>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-2">
          <button onClick={rejectAll}
            className="text-xs px-3 py-1.5 rounded-lg border border-red-200 bg-red-50 hover:bg-red-100 text-red-600 font-medium transition-colors">
            ✗ Reject All
          </button>
          <button onClick={acceptAll}
            className="text-xs px-3 py-1.5 rounded-lg border border-green-200 bg-green-50 hover:bg-green-100 text-green-700 font-medium transition-colors">
            ✓ Accept All
          </button>
          <button className="btn-primary text-sm py-1.5" onClick={handleContinue} disabled={saving}>
            {saving
              ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Saving…</>
              : 'Continue →'}
          </button>
        </div>
      </div>

      {/* ── Column headers ── */}
      <div className="flex-shrink-0 grid grid-cols-2 bg-slate-100 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
        <div className="px-6 py-2 border-r border-slate-200">Original</div>
        <div className="px-6 py-2 flex items-center gap-2">
          Formatted
          <span className="normal-case tracking-normal font-normal text-slate-400">
            — click highlighted text to accept / reject / edit
          </span>
        </div>
      </div>

      {/* ── Document panels ── */}
      <div className="flex-1 overflow-y-auto">

        {/* Title */}
        {(() => {
          const titleChange = changes.find(c =>
            c.field === 'heading' &&
            c.section?.toLowerCase() === 'title'
          ) || null
          return (
            <SectionRow
              isHeading
              left={<h1 className="text-lg font-bold text-slate-800">{orig.title || '—'}</h1>}
              right={
                <h1 className="text-lg font-bold text-slate-800">
                  {renderRight(fmt.title, titleChange)}
                </h1>
              }
            />
          )
        })()}

        {/* Abstract */}
        {(orig.abstract || fmt.abstract) && <>
          <SectionRow
            isHeading
            left={<p className="text-xs font-bold uppercase tracking-widest text-slate-500">Abstract</p>}
            right={<p className="text-xs font-bold uppercase tracking-widest text-slate-500">Abstract</p>}
          />
          <SectionRow
            left={renderOrig(orig.abstract)}
            right={<p className="text-sm leading-relaxed">{renderRight(fmt.abstract, abstractChange)}</p>}
          />
        </>}

        {/* Body sections — using pre-computed pairs for correct alignment */}
        {sectionPairs.map(({ origSec, fmtSec, headingCh, contentCh, index }) => (
          <React.Fragment key={fmtSec.heading + index}>
            <SectionRow
              isHeading
              left={<p className="font-semibold text-slate-700">{origSec.heading || fmtSec.heading}</p>}
              right={<p className="font-semibold text-slate-700">{renderRight(fmtSec.heading, headingCh)}</p>}
            />
            <SectionRow
              left={renderOrig(origSec.content)}
              right={
                contentCh
                  ? <p className="text-sm leading-relaxed">{renderRight(fmtSec.content, contentCh)}</p>
                  : <ContentWithImages text={fmtSec.content} imageMap={imageMap} />
              }
            />
          </React.Fragment>
        ))}

        {/* References */}
        {(fmt.references || []).length > 0 && <>
          <SectionRow
            isHeading
            left={<p className="font-semibold text-slate-700">References</p>}
            right={<p className="font-semibold text-slate-700">References</p>}
          />
          {(fmt.references || []).map((ref, i) => {
            const refCh = changes.find(c => c.field === `reference_${i + 1}` && c.section?.toLowerCase() === 'references') || null
            return (
              <SectionRow
                key={i}
                left={<p className="text-sm text-slate-600">{(orig.references || [])[i] || ''}</p>}
                right={<p className="text-sm">{renderRight(ref, refCh)}</p>}
              />
            )
          })}
        </>}

        {/* Figure legends */}
        {(fmt.figure_legends || []).length > 0 && <>
          <SectionRow
            isHeading
            left={<p className="font-semibold text-slate-700">Figure Legends</p>}
            right={<p className="font-semibold text-slate-700">Figure Legends</p>}
          />
          {(fmt.figure_legends || []).map((fig, i) => {
            const figCh = changes.find(c => c.field === `figure_${i + 1}`) || null
            return (
              <SectionRow
                key={i}
                left={<p className="text-sm text-slate-600">{(orig.figure_legends || [])[i] || ''}</p>}
                right={<p className="text-sm">{renderRight(fig, figCh)}</p>}
              />
            )
          })}
        </>}

        <div className="h-12" />
      </div>

      {/* ── Popover ── */}
      {popover && liveChange && (
        <ChangePopover
          change={liveChange}
          pos={{ x: popover.x, y: popover.y }}
          onAccept={accept}
          onReject={reject}
          onEdit={editChange}
          onClose={() => setPopover(null)}
        />
      )}
    </div>
  )
}
