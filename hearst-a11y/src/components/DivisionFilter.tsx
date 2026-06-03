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
      <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">Division</span>
      <select
        value={current}
        onChange={e => select(e.target.value)}
        className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
      >
        <option value="">All</option>
        {options.map(div => (
          <option key={div} value={div}>{div}</option>
        ))}
      </select>
    </div>
  )
}
