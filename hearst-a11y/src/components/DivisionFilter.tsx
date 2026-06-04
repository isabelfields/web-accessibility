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
    <div className="flex items-center gap-2">
      <label htmlFor="division-filter" className="text-[11px] font-medium text-[#9090b0] uppercase tracking-wider">Division</label>
      <select
        id="division-filter"
        value={current}
        onChange={e => select(e.target.value)}
        className="text-sm border border-[#1e1e2a] rounded-md px-3 py-1.5 bg-[#11111a] text-[#e8e8f0] focus:outline-none focus:border-[#3a3a52] cursor-pointer"
      >
        <option value="">All divisions</option>
        {options.map(div => (
          <option key={div} value={div}>{div}</option>
        ))}
      </select>
    </div>
  )
}
