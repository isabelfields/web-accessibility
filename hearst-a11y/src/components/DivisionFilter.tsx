'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { HEARST_DIVISIONS, HearstDivision } from '@/types'

export function DivisionFilter({ activeDivisions }: { activeDivisions: string[] }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const current = searchParams.get('division') ?? ''

  function select(div: string) {
    const params = new URLSearchParams(searchParams.toString())
    if (div) {
      params.set('division', div)
    } else {
      params.delete('division')
    }
    router.push(`/?${params.toString()}`)
  }

  const options = HEARST_DIVISIONS.filter(d => activeDivisions.includes(d))

  return (
    <div className="flex flex-wrap gap-2 items-center">
      <span className="text-sm text-gray-500 mr-1">Filter by division:</span>
      <button
        onClick={() => select('')}
        className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
          !current
            ? 'bg-brand-500 text-white'
            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
        }`}
      >
        All
      </button>
      {options.map(div => (
        <button
          key={div}
          onClick={() => select(div)}
          className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
            current === div
              ? 'bg-brand-500 text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          {div}
        </button>
      ))}
    </div>
  )
}
