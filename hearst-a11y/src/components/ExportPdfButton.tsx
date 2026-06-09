'use client'

import { useState } from 'react'

export function ExportPdfButton({ scanId }: { scanId: string }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function download() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/scans/${scanId}/export`)
      if (!res.ok) {
        setError('Export failed.')
        return
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `accessibility-report-${scanId.slice(0, 8)}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      setError('Export failed. Try again.')
    }
    setLoading(false)
  }

  return (
    <div className="inline-flex flex-col items-start gap-1">
      <button
        onClick={download}
        disabled={loading}
        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[var(--border)] text-sm font-medium text-[var(--text-muted)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text)] transition-colors disabled:opacity-50"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
        </svg>
        {loading ? 'Exporting…' : 'Export PDF'}
      </button>
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  )
}
