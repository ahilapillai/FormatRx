import React from 'react'

const STEPS = [
  { id: 1, label: 'Upload' },
  { id: 2, label: 'Journal' },
  { id: 3, label: 'Requirements' },
  { id: 4, label: 'Edit Mode' },
  { id: 5, label: 'Review' },
  { id: 6, label: 'Compliance' },
  { id: 7, label: 'Export' },
]

export default function StepIndicator({ current }) {
  return (
    <div className="flex items-center gap-0 mb-8">
      {STEPS.map((step, i) => {
        const done = step.id < current
        const active = step.id === current
        return (
          <React.Fragment key={step.id}>
            <div className="flex flex-col items-center">
              <div
                className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold transition-colors
                  ${done ? 'bg-brand-500 text-white' : active ? 'bg-brand-500 text-white ring-4 ring-brand-100' : 'bg-slate-200 text-slate-500'}`}
              >
                {done ? (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  step.id
                )}
              </div>
              <span className={`mt-1 text-xs font-medium ${active ? 'text-brand-600' : done ? 'text-slate-600' : 'text-slate-400'}`}>
                {step.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={`flex-1 h-0.5 mt-[-14px] mx-1 ${done ? 'bg-brand-500' : 'bg-slate-200'}`} />
            )}
          </React.Fragment>
        )
      })}
    </div>
  )
}
