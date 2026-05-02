import React, { useState } from 'react'
import { api } from '../utils/api'

const MODES = [
  {
    id: 'format_only',
    label: 'Format Only',
    tag: 'Recommended',
    tagColor: 'bg-brand-100 text-brand-700',
    description: 'Normalise headings, reorder sections, format references and figure labels. No sentence changes whatsoever.',
    bullets: [
      'Heading case normalisation',
      'Section reordering per journal guidelines',
      'Reference style formatting (Vancouver)',
      'Figure legend label standardisation',
    ],
    warns: [],
  },
  {
    id: 'format_plus_minor_grammar',
    label: 'Format + Minor Grammar',
    tag: 'Optional',
    tagColor: 'bg-amber-100 text-amber-700',
    description: 'All formatting changes plus light grammar corrections. Uses AI — each suggestion is reviewable and reversible.',
    bullets: [
      'Everything in Format Only',
      'Spelling corrections',
      'Tense consistency',
      'Subject-verb agreement',
      'Minor punctuation fixes',
    ],
    warns: ['Scientific meaning is never changed', 'No sentences are rewritten', 'All changes are shown for review'],
  },
]

export default function EditModeStep({ manuscript, journalId, onComplete, onBack }) {
  const [selected, setSelected] = useState('format_only')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleRun() {
    setLoading(true)
    setError('')
    try {
      const result = await api.formatManuscript(manuscript, journalId, selected)
      onComplete({
        formattedManuscript: result.formatted_manuscript,
        changes: result.changes,
        mode: selected,
      })
    } catch (e) {
      setError(e?.response?.data?.detail || 'Formatting failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="step-card max-w-2xl mx-auto">
      <h2 className="text-xl font-semibold text-slate-800 mb-1">Select Edit Level</h2>
      <p className="text-sm text-slate-500 mb-6">
        All changes are visible, reversible, and require your approval before export.
      </p>

      <div className="grid gap-4 mb-8">
        {MODES.map((mode) => (
          <button
            key={mode.id}
            onClick={() => setSelected(mode.id)}
            className={`w-full text-left p-5 rounded-xl border-2 transition-colors
              ${selected === mode.id ? 'border-brand-500 bg-brand-50' : 'border-slate-200 hover:border-brand-300'}`}
          >
            <div className="flex items-center gap-3 mb-2">
              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center
                ${selected === mode.id ? 'border-brand-500 bg-brand-500' : 'border-slate-300'}`}>
                {selected === mode.id && <div className="w-2 h-2 rounded-full bg-white" />}
              </div>
              <span className={`font-semibold ${selected === mode.id ? 'text-brand-700' : 'text-slate-700'}`}>
                {mode.label}
              </span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${mode.tagColor}`}>
                {mode.tag}
              </span>
            </div>
            <p className="text-sm text-slate-600 mb-3 ml-8">{mode.description}</p>
            <ul className="ml-8 space-y-1">
              {mode.bullets.map((b) => (
                <li key={b} className="text-sm text-slate-500 flex items-center gap-2">
                  <span className="text-brand-400">✓</span> {b}
                </li>
              ))}
            </ul>
            {mode.warns.length > 0 && (
              <div className="ml-8 mt-3 p-3 bg-amber-50 rounded-lg border border-amber-200">
                <p className="text-xs font-semibold text-amber-700 mb-1">Safeguards enforced:</p>
                {mode.warns.map((w) => (
                  <p key={w} className="text-xs text-amber-600">• {w}</p>
                ))}
              </div>
            )}
          </button>
        ))}
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>
      )}

      <div className="flex gap-3">
        <button className="btn-secondary" onClick={onBack} disabled={loading}>← Back</button>
        <button className="btn-primary flex-1 justify-center" onClick={handleRun} disabled={loading}>
          {loading ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Applying formatting…
            </>
          ) : (
            'Apply Formatting →'
          )}
        </button>
      </div>
    </div>
  )
}
