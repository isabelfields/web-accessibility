'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'

export function RunScanButton({ siteId }: { siteId: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [jobId, setJobId] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [cancelling, setCancelling] = useState(false)

  const pollStatus = useCallback(async (id: string) => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/scan?jobId=${id}`)
        if (!res.ok) return
        const job = await res.json()
        if (job.status === 'complete' || job.status === 'failed' || job.status === 'cancelled') {
          clearInterval(interval)
          setLoading(false)
          setJobId(null)
          if (job.status === 'complete') {
            setMessage('Scan complete!')
          } else if (job.status === 'cancelled') {
            setMessage('Scan cancelled.')
          } else {
            setMessage(`Scan failed: ${job.error ?? 'Unknown error'}`)
          }
          setTimeout(() => { router.refresh(); setMessage(null) }, 2000)
        }
      } catch {
        clearInterval(interval)
        setLoading(false)
        setJobId(null)
      }
    }, 3000)
    return interval
  }, [router])

  async function handleRun() {
    setLoading(true)
    setMessage(null)
    try {
      const res = await fetch('/api/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ siteId }),
      })
      if (!res.ok) {
        const data = await res.json()
        setMessage(`Error: ${data.error ?? 'Unknown error'}`)
        setLoading(false)
        return
      }
      const data = await res.json()
      setJobId(data.jobId)
      setMessage('Scan running…')
      pollStatus(data.jobId)
    } catch {
      setMessage('Network error. Please try again.')
      setLoading(false)
    }
  }

  async function handleCancel() {
    if (!jobId) return
    setCancelling(true)
    try {
      await fetch(`/api/scan?jobId=${jobId}`, { method: 'DELETE' })
      setMessage('Cancelling…')
    } catch {
      setMessage('Failed to cancel.')
    } finally {
      setCancelling(false)
    }
  }

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={handleRun}
        disabled={loading}
        style={{ background: '#007AFF', color: '#FFFFFF', fontSize: '14px', fontWeight: 500, padding: '8px 16px', borderRadius: '8px', border: 'none', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.5 : 1, display: 'inline-flex', alignItems: 'center', gap: '8px', transition: 'background 0.15s' }}
        className="inline-flex items-center gap-2"
      >
        {loading ? (
          <>
            <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Running…
          </>
        ) : (
          <>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Run Scan
          </>
        )}
      </button>

      {loading && jobId && (
        <button
          onClick={handleCancel}
          disabled={cancelling}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-red-200 text-red-600 text-sm font-medium hover:bg-red-50 disabled:opacity-50 transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
          {cancelling ? 'Cancelling…' : 'Cancel'}
        </button>
      )}

      {message && (
        <span className={`text-sm ${message.startsWith('Error') || message.startsWith('Scan failed') ? 'text-red-600' : message.startsWith('Scan complete') ? 'text-green-600' : 'text-gray-500'}`}>
          {message}
        </span>
      )}
    </div>
  )
}
