'use client'

import { useEffect, useState } from 'react'

interface JiraStatus {
  connected: boolean
  configured: boolean
  siteUrl?: string | null
}

export function JiraConnectionBadge() {
  const [status, setStatus] = useState<JiraStatus | null>(null)
  const [disconnecting, setDisconnecting] = useState(false)

  useEffect(() => {
    fetch('/api/integrations/jira/status')
      .then(r => r.json())
      .then(setStatus)
      .catch(() => {})
  }, [])

  if (!status || !status.configured) return null

  if (status.connected) {
    return (
      <div className="inline-flex items-center gap-1.5">
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-[#E5E5EA] bg-white text-xs font-medium text-[#3A3A3C]">
          <svg className="w-3 h-3 text-emerald-500 shrink-0" fill="currentColor" viewBox="0 0 8 8">
            <circle cx="4" cy="4" r="4" />
          </svg>
          Jira connected
        </span>
        <button
          onClick={async () => {
            if (!confirm('Disconnect your Jira account?')) return
            setDisconnecting(true)
            await fetch('/api/integrations/jira/disconnect', { method: 'DELETE' })
            setStatus(s => s ? { ...s, connected: false } : s)
            setDisconnecting(false)
          }}
          disabled={disconnecting}
          className="text-xs text-[#57575A] hover:text-red-600 transition-colors disabled:opacity-50"
        >
          {disconnecting ? 'Disconnecting…' : 'Disconnect'}
        </button>
      </div>
    )
  }

  return (
    <a
      href={`/api/integrations/jira/oauth/start?returnTo=${encodeURIComponent(typeof window !== 'undefined' ? window.location.pathname : '')}`}
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-[#E5E5EA] bg-white text-xs font-medium text-[#3A6FB5] hover:border-[#3A6FB5] transition-colors"
    >
      <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
      </svg>
      Connect Jira
    </a>
  )
}
