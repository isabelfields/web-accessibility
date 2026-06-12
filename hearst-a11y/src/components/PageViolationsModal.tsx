'use client'

import { useState, cloneElement, isValidElement } from 'react'
import { ViolationCard } from './ViolationCard'
import { TierSection } from './TierSection'
import { impactToTier, TIER_LABEL, TIER_COLOR } from '@/lib/tiers'
import type { ViolationPattern, PageScore } from '@/types'

interface Props {
  pageScore: PageScore
  patterns: ViolationPattern[]
  children?: React.ReactElement
}

export function PageViolationsModal({ pageScore, patterns, children }: Props) {
  const [open, setOpen] = useState(false)

  const pagePatterns = patterns.filter(p =>
    p.affectedPages?.includes(pageScore.url) ||
    p.nodes?.some(n => n.url === pageScore.url)
  )

  const hasData = pageScore.score != null

  const trigger = children
    ? isValidElement(children)
      ? cloneElement(children as React.ReactElement<React.HTMLAttributes<HTMLElement>>, {
          onClick: () => hasData && setOpen(true),
        })
      : children
    : (
      <button
        onClick={() => hasData && setOpen(true)}
        className={`text-left hover:underline truncate max-w-xs block ${hasData ? 'text-[#007AFF] cursor-pointer' : 'text-[#6B6B6B] cursor-default'}`}
        title={pageScore.url}
        disabled={!hasData}
      >
        {pageScore.url}
      </button>
    )

  const byTier: Record<string, ViolationPattern[]> = { tier1: [], tier2: [], tier3: [], tier4: [] }
  for (const p of pagePatterns) {
    const tier = impactToTier(p.impact)
    byTier[tier].push(p)
  }

  return (
    <>
      {trigger}

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setOpen(false)}>
          <div className="bg-white border border-[#E5E5EA] rounded-xl shadow-xl w-full max-w-3xl mx-4 max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-start justify-between px-6 py-4 border-b border-[#E5E5EA] flex-shrink-0">
              <div>
                <h2 className="text-base font-semibold text-[#1D1D1F]">{pageScore.label ?? 'Page'}</h2>
                <a href={pageScore.url} target="_blank" rel="noopener noreferrer"
                  className="text-sm text-[#007AFF] hover:underline break-all">
                  {pageScore.url}
                </a>
                <div className="flex items-center gap-3 mt-1">
                  <span className="text-sm text-[#6B6B6B]">
                    {pagePatterns.length} issue type{pagePatterns.length !== 1 ? 's' : ''}
                  </span>
                  {pageScore.violationCount != null && (
                    <span className="text-sm text-[#6B6B6B]">· {pageScore.violationCount} total violations</span>
                  )}
                </div>
              </div>
              <button onClick={() => setOpen(false)}
                className="text-[#6B6B6B] hover:text-[#1D1D1F] text-2xl leading-none ml-4 flex-shrink-0">
                &times;
              </button>
            </div>

            {/* Body */}
            <div className="overflow-y-auto px-6 py-5">
              {pagePatterns.length === 0 ? (
                <div className="text-center py-10 text-[#6B6B6B] text-sm">No violations found on this page.</div>
              ) : (
                (['tier1', 'tier2', 'tier3', 'tier4'] as const).map(tier => {
                  const group = byTier[tier]
                  if (group.length === 0) return null
                  const c = TIER_COLOR[tier]
                  return (
                    <TierSection
                      key={tier}
                      tier={tier}
                      label={TIER_LABEL[tier]}
                      color={{ text: c.text, dot: c.dot, hex: c.hex }}
                      patterns={group.map(p => {
                        const pageNodes = p.nodes?.filter(n => n.url === pageScore.url) ?? []
                        return {
                          ...p,
                          nodes: pageNodes.length > 0 ? pageNodes : p.nodes ?? [],
                          affectedPages: [pageScore.url],
                          occurrences: pageNodes.length > 0 ? pageNodes.length : p.occurrences,
                        }
                      })}
                    />
                  )
                })
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
