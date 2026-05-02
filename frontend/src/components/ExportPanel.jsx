import React, { useState } from 'react'
import { api, downloadBlob } from '../utils/api'

export default function ExportPanel({ finalManuscript, changes, journalId, onRestart }) {
  const [loadingClean, setLoadingClean] = useState(false)
  const [loadingTracked, setLoadingTracked] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState({ clean: false, tracked: false })

  const acceptedCount = changes.filter((c) => c.accepted === true).length
  const rejectedCount = changes.filter((c) => c.accepted === false).length

  async function handleExport(type) {
    setError('')
    if (type === 'clean') {
      setLoadingClean(true)
      try {
        const blob = await api.exportClean(finalManuscript, changes, journalId)
        downloadBlob(blob, 'formatted_manuscript.docx')
        setDone((d) => ({ ...d, clean: true }))
      } catch (e) {
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
      } catch (e) {
        setError('Export failed. Please try again.')
      } finally {
        setLoadingTracked(false)
      }
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div className="step-card">
        <h2 className="text-xl font-semibold text-slate-800 mb-1">Export Document</h2>
        <p className="text-sm text-slate-500 mb-6">
          Download your formatted manuscript. Choose clean (submission-ready) or tracked-changes version.
        </p>

        {/* Summary */}
        <div className="grid grid-cols-3 gap-3 mb-8">
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
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Generating…
                    </>
                  ) : done.clean ? (
                    '✓ Downloaded'
                  ) : (
                    '↓ Download Clean .docx'
                  )}
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
                  Useful for co-author review.
                </p>
                <button
                  className="btn-secondary mt-3"
                  onClick={() => handleExport('tracked')}
                  disabled={loadingTracked}
                >
                  {loadingTracked ? (
                    <>
                      <div className="w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
                      Generating…
                    </>
                  ) : done.tracked ? (
                    '✓ Downloaded'
                  ) : (
                    '↓ Download Tracked .docx'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>

        {error && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>
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
