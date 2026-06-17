'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export function DeleteScanButton({ jobId }: { jobId: string }) {
  const router = useRouter()
  const [deleting, setDeleting] = useState(false)

  async function handleDelete() {
    setDeleting(true)
    try {
      await fetch(`/api/scan/${jobId}`, { method: 'DELETE' })
      router.refresh()
    } catch {
      setDeleting(false)
    }
  }

  return (
    <button
      onClick={handleDelete}
      disabled={deleting}
      title="Remove this scan"
      aria-label="Remove this scan"
      className="p-1 rounded text-gray-300 hover:text-red-500 hover:bg-red-50 disabled:opacity-40 transition-colors"
    >
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
      </svg>
    </button>
  )
}
