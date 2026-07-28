'use client'

import { useState } from 'react'
import { ViolationCard } from './ViolationCard'
import type { ViolationPattern } from '@/types'

interface Props {
  tier: string
  label: string
  color: { text: string; dot: string; hex: string }
  patterns: ViolationPattern[]
  defaultOpen?: boolean
  siteId?: string
}

export function TierSection({ tier, label, color, patterns, defaultOpen = true, siteId }: Props) {
  const [open, setOpen] = useState(defaultOpen)

  // Dismissed section: collapsible with its own card wrapper
  if (!defaultOpen) {
    return (
      <div className="mt-2">
        <button
          onClick={() => setOpen(o => !o)}
          className="flex items-center gap-2 mb-2 px-1 w-full hover:opacity-80 transition-opacity"
        >
          <span className="w-2 h-2 rounded-full shrink-0" style={{ background: color.hex }} />
          <span className="text-[11px] font-bold uppercase tracking-[0.06em] text-[#57575A]">{label}</span>
          <svg
            className={`ml-auto w-3.5 h-3.5 text-[#8E8E93] transition-transform ${open ? 'rotate-180' : ''}`}
            fill="none" stroke="currentColor" viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        {open && (
          <div className="bg-white rounded-xl border border-[#E5E5EA] shadow-[0_1px_4px_rgba(0,0,0,0.06)] overflow-hidden divide-y divide-[#F2F2F7]">
            {patterns.map(p => (
              <ViolationCard key={p.fingerprint} pattern={p} siteId={siteId} />
            ))}
          </div>
        )}
      </div>
    )
  }

  // Active tiers: bare rows — parent page provides the shared card container
  return (
    <>
      {patterns.map(p => (
        <ViolationCard key={p.fingerprint} pattern={p} siteId={siteId} />
      ))}
    </>
  )
}
