'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { HEARST_DIVISIONS } from '@/types'

export function DivisionFilter({ activeDivisions }: { activeDivisions: string[] }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const current = searchParams.get('division') ?? ''

  function select(div: string) {
    const params = new URLSearchParams(searchParams.toString())
    if (div) params.set('division', div)
    else params.delete('division')
    router.push(`/?${params.toString()}`)
  }

  const options = HEARST_DIVISIONS.filter(d => activeDivisions.includes(d))

  return (
    <div className="relative">
      <select
        value={current}
        onChange={e => select(e.target.value)}
        style={{
          appearance: 'none',
          background: '#1D1D1F',
          color: '#fff',
          border: 'none',
          borderRadius: 8,
          padding: '8px 36px 8px 14px',
          fontSize: 13,
          fontWeight: 600,
          cursor: 'pointer',
          outline: 'none',
        }}
      >
        <option value="">All divisions</option>
        {options.map(div => (
          <option key={div} value={div}>{div}</option>
        ))}
      </select>
      <svg style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} width="14" height="14" fill="none" stroke="#fff" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
      </svg>
    </div>
  )
}
