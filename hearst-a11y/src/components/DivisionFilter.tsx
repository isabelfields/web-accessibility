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
    <div className="flex items-center gap-3">
      <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">Division</span>
      <div className="inline-flex bg-gray-100 rounded-lg p-0.5">
        <button
          onClick={() => select('')}
          className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
            !current
              ? 'bg-white shadow-sm text-gray-900'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          All
        </button>
        {options.map(div => (
          <button
            key={div}
            onClick={() => select(div)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
              current === div
                ? 'bg-white shadow-sm text-gray-900'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {div}
          </button>
        ))}
      </div>
    </div>
  )
}
