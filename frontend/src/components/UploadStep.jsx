import React, { useState, useRef } from 'react'
import { api } from '../utils/api'

export default function UploadStep({ onComplete }) {
  const [dragging, setDragging] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const inputRef = useRef()

  async function handleFile(file) {
    if (!file || !file.name.endsWith('.docx')) {
      setError('Please upload a .docx file.')
      return
    }
    setError('')
    setLoading(true)
    try {
      const result = await api.parseManuscript(file)
      // Show warnings but still proceed
      if (result.manuscript?.parse_warnings?.length) {
        console.warn('Parse warnings:', result.manuscript.parse_warnings)
      }
      onComplete({
        manuscript: result.manuscript,
        imageMap: result.image_map || {},
        filename: result.filename,
      })
    } catch (e) {
      if (!e.response) {
        // Network error = backend not running
        setError(
          '⚠️ Cannot reach the backend server. Make sure it is running:\n' +
          'cd backend && uvicorn main:app --reload --port 8000'
        )
      } else {
        const detail = e?.response?.data?.detail || ''
        const short = detail.split('\n')[0] // First line only (strip traceback)
        setError(short || 'Failed to parse the document. Please try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="step-card max-w-2xl mx-auto">
      <h2 className="text-xl font-semibold text-slate-800 mb-1">Upload Manuscript</h2>
      <p className="text-sm text-slate-500 mb-6">
        Upload your <strong>.docx</strong> file. The document will be parsed into sections — content will not be modified at this step.
      </p>

      <div
        className={`relative border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-colors
          ${dragging ? 'border-brand-500 bg-brand-50' : 'border-slate-300 hover:border-brand-400 hover:bg-slate-50'}`}
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); handleFile(e.dataTransfer.files[0]) }}
        onClick={() => inputRef.current.click()}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".docx"
          className="hidden"
          onChange={(e) => handleFile(e.target.files[0])}
        />
        {loading ? (
          <div className="flex flex-col items-center gap-3">
            <div className="w-10 h-10 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-brand-600 font-medium">Parsing document…</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3">
            <div className="w-14 h-14 bg-brand-100 rounded-2xl flex items-center justify-center">
              <svg className="w-7 h-7 text-brand-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div>
              <p className="font-medium text-slate-700">Drag & drop your .docx file here</p>
              <p className="text-sm text-slate-400 mt-1">or click to browse</p>
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm whitespace-pre-line">{error}</div>
      )}

      <div className="mt-6 p-4 bg-slate-50 rounded-xl border border-slate-200 text-sm text-slate-600">
        <p className="font-medium mb-1">What gets extracted:</p>
        <ul className="list-disc list-inside space-y-0.5 text-slate-500">
          <li>Title, Abstract, Sections (headings + content)</li>
          <li>References list</li>
          <li>Figure legends</li>
          <li>Word count</li>
        </ul>
      </div>
    </div>
  )
}
