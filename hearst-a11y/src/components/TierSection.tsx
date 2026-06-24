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

  return (
    <div style={{ marginBottom: 24 }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '6px 0',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          textAlign: 'left',
          marginBottom: 8,
        }}
      >
        <span style={{ width: 10, height: 10, borderRadius: '50%', background: color.hex, flexShrink: 0 }} />
        <span style={{ fontSize: 12, fontWeight: 700, color: '#1D1D1F', letterSpacing: '0.06em', textTransform: 'uppercase' }}>{label}</span>
        <span style={{ fontSize: 12, color: '#6B6B6B' }}>
          {patterns.length} issue type{patterns.length !== 1 ? 's' : ''}
        </span>
        <svg
          style={{ marginLeft: 'auto', width: 14, height: 14, color: '#6B6B6B', transition: 'transform 0.15s', transform: open ? 'rotate(180deg)' : 'rotate(0deg)', flexShrink: 0 }}
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {patterns.map((p) => (
            <ViolationCard key={p.fingerprint} pattern={p} siteId={siteId} />
          ))}
        </div>
      )}
    </div>
  )
}
