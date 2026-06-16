'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'

export function RunScanButton({ siteId }: { siteId: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [jobId, setJobId] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [cancelling, setCancelling] = useState(false)

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Stop any running poll/refresh timers (on unmount or before starting a new poll)
  const stopPolling = useCallback(() => {
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null }
    if (timeoutRef.current) { clearTimeout(timeoutRef.current); timeoutRef.current = null }
  }, [])

  useEffect(() => stopPolling, [stopPolling])

  const pollStatus = useCallback((id: string) => {
    // Never run two polls at once — clear any existing interval first.
    stopPolling()
    intervalRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/scan?jobId=${id}`)
        if (!res.ok) return
        const job = await res.json()
        if (job.status === 'complete' || job.status === 'failed' || job.status === 'cancelled') {
          stopPolling()
          setLoading(false)
          setJobId(null)
          if (job.status === 'complete') {
            setMessage('Scan complete!')
          } else if (job.status === 'cancelled') {
            setMessage('Scan cancelled.')
          } else {
            setMessage(`Scan failed: ${job.error ?? 'Unknown error'}`)
          }
          timeoutRef.current = setTimeout(() => { router.refresh(); setMessage(null) }, 2000)
        }
      } catch {
        stopPolling()
        setLoading(false)
        setJobId(null)
      }
    }, 3000)
  }, [router, stopPolling])

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
        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
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
