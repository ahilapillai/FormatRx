import React, { useState } from 'react'
import StepIndicator from './components/StepIndicator'
import UploadStep from './components/UploadStep'
import JournalSelectStep from './components/JournalSelectStep'
import JournalRulesStep from './components/JournalRulesStep'
import EditModeStep from './components/EditModeStep'
import DiffViewerStep from './components/DiffViewer'
import CompliancePanel from './components/CompliancePanel'
import ExportPanel from './components/ExportPanel'

const INITIAL_STATE = {
  step: 1,
  manuscript: null,
  filename: '',
  journalId: null,
  mode: 'format_only',
  formattedManuscript: null,
  changes: [],
  finalManuscript: null,
}

export default function App() {
  const [state, setState] = useState(INITIAL_STATE)

  function update(patch) {
    setState((prev) => ({ ...prev, ...patch }))
  }

  function goTo(step) {
    setState((prev) => ({ ...prev, step }))
  }

  function restart() {
    setState(INITIAL_STATE)
  }

  const { step } = state

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-brand-500 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-800 leading-tight">Manuscript Formatter</h1>
              <p className="text-xs text-slate-400">Pathology Journal Compliance Tool</p>
            </div>
          </div>
          {state.filename && (
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-slate-100 rounded-lg">
              <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
              <span className="text-xs text-slate-600 font-medium max-w-[200px] truncate">{state.filename}</span>
            </div>
          )}
        </div>
      </header>

      {/* Core principle banner */}
      {step === 1 && (
        <div className="bg-brand-500 text-white text-center py-2 text-sm font-medium">
          Format only — content is never rewritten. All changes are visible and reversible.
        </div>
      )}

      {/* Main content */}
      <main className={`${step === 5 ? 'max-w-none px-4' : 'max-w-4xl mx-auto px-4'} py-8`}>
        <StepIndicator current={step} />

        {/* Step 1 — Upload */}
        {step === 1 && (
          <UploadStep
            onComplete={({ manuscript, filename }) => update({ manuscript, filename, step: 2 })}
          />
        )}

        {/* Step 2 — Journal selection */}
        {step === 2 && (
          <JournalSelectStep
            manuscript={state.manuscript}
            onComplete={({ journalId }) => update({ journalId, step: 3 })}
            onBack={() => goTo(1)}
          />
        )}

        {/* Step 3 — Format requirements preview */}
        {step === 3 && (
          <JournalRulesStep
            manuscript={state.manuscript}
            journalId={state.journalId}
            onComplete={() => goTo(4)}
            onBack={() => goTo(2)}
          />
        )}

        {/* Step 4 — Edit mode selection + apply formatting */}
        {step === 4 && (
          <EditModeStep
            manuscript={state.manuscript}
            journalId={state.journalId}
            onComplete={({ formattedManuscript, changes, mode }) =>
              update({ formattedManuscript, changes, mode, step: 5 })
            }
            onBack={() => goTo(3)}
          />
        )}

        {/* Step 5 — Side-by-side diff review */}
        {step === 5 && (
          <DiffViewerStep
            originalManuscript={state.manuscript}
            formattedManuscript={state.formattedManuscript}
            initialChanges={state.changes}
            journalId={state.journalId}
            onComplete={({ finalManuscript, changes }) =>
              update({ finalManuscript, changes, step: 6 })
            }
            onBack={() => goTo(4)}
          />
        )}

        {/* Step 6 — Compliance checklist */}
        {step === 6 && (
          <CompliancePanel
            finalManuscript={state.finalManuscript || state.formattedManuscript}
            journalId={state.journalId}
            onComplete={() => goTo(7)}
            onBack={() => goTo(5)}
          />
        )}

        {/* Step 7 — Export */}
        {step === 7 && (
          <ExportPanel
            finalManuscript={state.finalManuscript || state.formattedManuscript}
            changes={state.changes}
            journalId={state.journalId}
            onRestart={restart}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="text-center text-xs text-slate-400 py-6">
        Manuscript Formatter — No content is rewritten. No data is stored after your session.
      </footer>
    </div>
  )
}
