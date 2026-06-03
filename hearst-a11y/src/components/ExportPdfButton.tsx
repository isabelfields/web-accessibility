'use client'

import { useState } from 'react'

const STORAGE_KEY = 'hearst_admin_secret'

export function ExportPdfButton({ scanId }: { scanId: string }) {
  const [secret, setSecret] = useState(() =>
    typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY) ?? '' : ''
  )
  const [showPrompt, setShowPrompt] = useState(false)
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function download(s: string) {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/scans/${scanId}/export?secret=${encodeURIComponent(s)}`)
      if (res.status === 401) {
        setError('Incorrect admin secret.')
        localStorage.removeItem(STORAGE_KEY)
        setSecret('')
        setLoading(false)
        return
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `accessibility-report-${scanId.slice(0, 8)}.pdf`
      a.click()
      URL.revokeObjectURL(url)
      setShowPrompt(false)
    } catch {
      setError('Export failed. Try again.')
    }
    setLoading(false)
  }

  function handleUnlock() {
    if (!input.trim()) return
    localStorage.setItem(STORAGE_KEY, input.trim())
    setSecret(input.trim())
    download(input.trim())
  }

  if (!secret) {
    return (
      <>
        <button
          onClick={() => setShowPrompt(true)}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v2m0 4h.01M5.07 19H19a2 2 0 001.75-2.97L13.75 4a2 2 0 00-3.5 0L3.25 16A2 2 0 005.07 19z" />
          </svg>
          Export PDF
        </button>

        {showPrompt && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowPrompt(false)}>
            <div className="bg-white rounded-xl shadow-xl p-6 w-80" onClick={e => e.stopPropagation()}>
              <h3 className="text-sm font-semibold text-gray-900 mb-1">Admin access required</h3>
              <p className="text-xs text-gray-400 mb-4">Enter the admin secret to export scan reports.</p>
              <input
                type="password"
                autoFocus
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleUnlock()}
                placeholder="Admin secret"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
              {error && <p className="text-xs text-red-500 mb-2">{error}</p>}
              <div className="flex gap-2">
                <button
                  onClick={handleUnlock}
                  className="flex-1 bg-brand-500 text-white text-sm font-medium py-2 rounded-lg hover:bg-blue-600 transition-colors"
                >
                  Export
                </button>
                <button
                  onClick={() => setShowPrompt(false)}
                  className="flex-1 border border-gray-200 text-sm font-medium py-2 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </>
    )
  }

  return (
    <button
      onClick={() => download(secret)}
      disabled={loading}
      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50"
    >
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
      </svg>
      {loading ? 'Exporting…' : 'Export PDF'}
    </button>
  )
}
