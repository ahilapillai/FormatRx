import React, { useEffect, useState } from 'react'
import { api } from '../utils/api'

const JOURNAL_DESCRIPTIONS = {
  cureus: 'Open-access medical journal. Structured abstract, Vancouver refs, Title Case headings, 3000 words.',
  ajsp: 'High-impact pathology journal. Unstructured abstract, Vancouver refs, ALL CAPS headings, 4000 words.',
  jmmcmed: 'Journal of Madras Medical College - Medicine (LWW/Wolters Kluwer). Structured abstract, Vancouver refs, Title Case headings, 3000 words. New journal — rules based on LWW/ICMJE standards.',
}

export default function JournalSelectStep({ manuscript, onComplete, onBack }) {
  const [journals, setJournals] = useState([])
  const [selected, setSelected] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.getJournals()
      .then((d) => setJournals(d.journals || []))
      .catch(() => setJournals([]))
      .finally(() => setLoading(false))
  }, [])

  const manuscript_wc = manuscript?.word_count || 0
  const sections = manuscript?.sections?.map((s) => s.heading).join(', ') || '—'

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
          <span>Title:</span><span className="font-medium truncate">{manuscript?.title || '—'}</span>
          <span>Word count:</span><span className="font-medium">{manuscript_wc.toLocaleString()}</span>
          <span>Sections:</span><span className="font-medium">{sections}</span>
          <span>References:</span><span className="font-medium">{manuscript?.references?.length || 0}</span>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-8">
          <div className="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="grid gap-3">
          {journals.map((j) => (
            <button
              key={j.id}
              onClick={() => setSelected(j.id)}
              className={`w-full text-left p-4 rounded-xl border-2 transition-colors
                ${selected === j.id
                  ? 'border-brand-500 bg-brand-50'
                  : 'border-slate-200 hover:border-brand-300 hover:bg-slate-50'}`}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className={`font-semibold ${selected === j.id ? 'text-brand-700' : 'text-slate-700'}`}>
                    {j.name}
                  </p>
                  <p className="text-sm text-slate-500 mt-0.5">
                    {JOURNAL_DESCRIPTIONS[j.id] || 'Journal formatting guidelines.'}
                  </p>
                </div>
                {selected === j.id && (
                  <div className="w-6 h-6 rounded-full bg-brand-500 flex items-center justify-center flex-shrink-0">
                    <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                )}
              </div>
            </button>
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
