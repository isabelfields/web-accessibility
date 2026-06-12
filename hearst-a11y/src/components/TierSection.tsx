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
}

export function TierSection({ tier, label, color, patterns, defaultOpen = true }: Props) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div style={{ marginBottom: 24 }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '10px 16px',
          borderRadius: open ? '10px 10px 0 0' : 10,
          background: color.hex,
          border: 'none',
          cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        <span style={{ fontSize: 13, fontWeight: 700, color: '#fff', letterSpacing: '0.04em' }}>{label}</span>
        <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.8)', fontWeight: 500 }}>
          · {patterns.length} issue type{patterns.length !== 1 ? 's' : ''}
        </span>
        <svg
          style={{ marginLeft: 'auto', width: 16, height: 16, color: '#fff', transition: 'transform 0.15s', transform: open ? 'rotate(180deg)' : 'rotate(0deg)', flexShrink: 0 }}
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div style={{ border: '1px solid #E5E5EA', borderTop: 'none', borderRadius: '0 0 10px 10px', overflow: 'hidden' }}>
          {patterns.map((p, i) => (
            <div key={p.fingerprint} style={{ borderTop: i > 0 ? '1px solid #F0F0F5' : undefined }}>
              <ViolationCard pattern={p} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
