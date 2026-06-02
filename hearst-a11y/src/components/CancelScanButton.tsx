'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export function CancelScanButton({ jobId }: { jobId: string }) {
  const router = useRouter()
  const [cancelling, setCancelling] = useState(false)
  const [done, setDone] = useState(false)

  async function handleCancel() {
    setCancelling(true)
    try {
      await fetch(`/api/scan?jobId=${jobId}`, { method: 'DELETE' })
      setDone(true)
      setTimeout(() => router.refresh(), 1000)
    } catch {
      setCancelling(false)
    }
  }

  if (done) return <span className="text-xs text-gray-400">Cancelled</span>

  return (
    <button
      onClick={handleCancel}
      disabled={cancelling}
      className="inline-flex items-center gap-1 px-2 py-1 rounded border border-red-200 text-red-600 text-xs font-medium hover:bg-red-50 disabled:opacity-50 transition-colors"
    >
      {cancelling ? 'Cancelling…' : 'Cancel'}
    </button>
  )
}
