'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { AddScheduleForm } from './AddScheduleForm'

export function RunScanButton({ siteId }: { siteId: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [jobId, setJobId] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [cancelling, setCancelling] = useState(false)
  const [crawl, setCrawl] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [showSchedule, setShowSchedule] = useState(false)

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  // Stop any running poll/refresh timers (on unmount or before starting a new poll)
  const stopPolling = useCallback(() => {
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null }
    if (timeoutRef.current) { clearTimeout(timeoutRef.current); timeoutRef.current = null }
  }, [])

  useEffect(() => stopPolling, [stopPolling])

  // Close the options menu on outside click or Escape.
  useEffect(() => {
    if (!menuOpen) return
    function onDown(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false)
    }
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') setMenuOpen(false) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [menuOpen])

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
    setMenuOpen(false)
    setLoading(true)
    setMessage(null)
    try {
      const res = await fetch('/api/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ siteId, crawl }),
      })
      if (!res.ok) {
        const data = await res.json()
        setMessage(`Error: ${data.error ?? 'Unknown error'}`)
        setLoading(false)
        return
      }
      const data = await res.json()
      setJobId(data.jobId)
      setMessage(crawl ? 'Crawling…' : 'Scan running…')
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
      {/* Split button: Run Scan + options caret */}
      <div ref={menuRef} className="relative inline-flex">
        <button
          onClick={handleRun}
          disabled={loading}
          className="inline-flex items-center gap-2 pl-4 pr-3 py-2 rounded-l-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {loading ? (
            <>
              <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              {crawl ? 'Crawling…' : 'Running…'}
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {crawl ? 'Run Crawl' : 'Run Scan'}
            </>
          )}
        </button>
        <button
          onClick={() => setMenuOpen(o => !o)}
          disabled={loading}
          aria-label="Scan options"
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          className="inline-flex items-center px-1.5 py-2 rounded-r-lg bg-blue-600 text-white border-l border-blue-500 hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          <svg className={`w-4 h-4 transition-transform ${menuOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {menuOpen && (
          <div
            role="menu"
            className="absolute right-0 top-full mt-1 w-60 rounded-lg border border-[#E5E5EA] bg-white shadow-lg z-20 py-1"
          >
            <label className="flex items-start gap-2 px-3 py-2 text-sm text-[#1D1D1F] hover:bg-[#F5F5F7] cursor-pointer select-none">
              <input
                type="checkbox"
                checked={crawl}
                onChange={e => setCrawl(e.target.checked)}
                className="mt-0.5 rounded border-gray-300 text-blue-600"
              />
              <span>
                Crawl site
                <span className="block text-xs text-[#57575A]">Discover &amp; scan up to 5 pages via links and sitemap.xml</span>
              </span>
            </label>
            <div className="my-1 border-t border-[#F0F0F0]" />
            <button
              type="button"
              role="menuitem"
              onClick={() => { setMenuOpen(false); setShowSchedule(true) }}
              className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm text-[#1D1D1F] hover:bg-[#F5F5F7]"
            >
              <svg className="w-4 h-4 text-[#57575A]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              Set a schedule…
            </button>
          </div>
        )}
      </div>

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

      {showSchedule && (
        <AddScheduleForm initialSiteId={siteId} onClose={() => { setShowSchedule(false); router.refresh() }} />
      )}
    </div>
  )
}
