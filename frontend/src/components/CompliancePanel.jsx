import React, { useEffect, useState } from 'react'
import { api } from '../utils/api'

function StatusIcon({ status }) {
  if (status === 'ok') return <span className="text-green-500 text-lg">✓</span>
  if (status === 'warning') return <span className="text-amber-500 text-lg">⚠</span>
  if (status === 'error') return <span className="text-red-500 text-lg">✗</span>
  return null
}

function StatusBadge({ status }) {
  if (status === 'ok') return <span className="badge-ok">OK</span>
  if (status === 'warning') return <span className="badge-warning">Warning</span>
  if (status === 'error') return <span className="badge-error">Error</span>
  return null
}

export default function CompliancePanel({ finalManuscript, journalId, onComplete, onBack }) {
  const [checklist, setChecklist] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState('all') // all | error | warning | ok

  useEffect(() => {
    api.getCompliance(finalManuscript, journalId)
      .then(setChecklist)
      .catch(() => setError('Failed to generate compliance checklist.'))
      .finally(() => setLoading(false))
  }, [finalManuscript, journalId])

  if (loading) {
    return (
      <div className="step-card max-w-2xl mx-auto flex justify-center py-12">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-brand-600">Checking compliance…</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="step-card max-w-2xl mx-auto">
        <p className="text-red-600">{error}</p>
        <button className="btn-secondary mt-4" onClick={onBack}>← Back</button>
      </div>
    )
  }

  const { checks = [], summary = {}, journal = '' } = checklist || {}
  const filtered = filter === 'all' ? checks : checks.filter((c) => c.status === filter)

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div className="step-card">
        <h2 className="text-xl font-semibold text-slate-800 mb-1">Compliance Checklist</h2>
        <p className="text-sm text-slate-500 mb-6">
          Manuscript compliance against <strong>{journal}</strong> guidelines.
        </p>

        {/* Summary pills */}
        <div className="flex gap-3 mb-6">
          <div className="flex-1 text-center p-3 bg-red-50 rounded-xl border border-red-100">
            <p className="text-2xl font-bold text-red-600">{summary.errors || 0}</p>
            <p className="text-xs text-red-400">Errors</p>
          </div>
          <div className="flex-1 text-center p-3 bg-amber-50 rounded-xl border border-amber-100">
            <p className="text-2xl font-bold text-amber-600">{summary.warnings || 0}</p>
            <p className="text-xs text-amber-400">Warnings</p>
          </div>
          <div className="flex-1 text-center p-3 bg-green-50 rounded-xl border border-green-100">
            <p className="text-2xl font-bold text-green-600">{summary.ok || 0}</p>
            <p className="text-xs text-green-400">Passed</p>
          </div>
        </div>

        {/* Filter */}
        <div className="flex gap-1 border-b border-slate-200 mb-4">
          {['all', 'error', 'warning', 'ok'].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-2 text-sm font-medium border-b-2 capitalize transition-colors
                ${filter === f ? 'border-brand-500 text-brand-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
            >
              {f}
            </button>
          ))}
        </div>

        {/* Checklist items */}
        <div className="space-y-2">
          {filtered.map((check, i) => (
            <div
              key={i}
              className={`flex items-start gap-3 p-3 rounded-xl border
                ${check.status === 'error' ? 'bg-red-50 border-red-200' :
                  check.status === 'warning' ? 'bg-amber-50 border-amber-200' :
                  'bg-green-50 border-green-200'}`}
            >
              <div className="mt-0.5">
                <StatusIcon status={check.status} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-sm text-slate-700">{check.item}</span>
                  <StatusBadge status={check.status} />
                </div>
                <p className="text-sm text-slate-500 mt-0.5">{check.message}</p>
                {check.section && (
                  <p className="text-xs text-slate-400 mt-0.5">Section: {check.section}</p>
                )}
              </div>
            </div>
          ))}
        </div>

        {summary.errors > 0 && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
            <strong>Note:</strong> {summary.errors} compliance error{summary.errors > 1 ? 's' : ''} detected.
            You can still export your document — errors indicate items that may need manual attention.
          </div>
        )}
      </div>

      <div className="flex gap-3">
        <button className="btn-secondary" onClick={onBack}>← Back</button>
        <button className="btn-primary flex-1 justify-center" onClick={onComplete}>
          Continue to Export →
        </button>
      </div>
    </div>
  )
}
