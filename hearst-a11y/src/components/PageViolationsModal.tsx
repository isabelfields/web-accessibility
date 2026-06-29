'use client'

import { useState, cloneElement, isValidElement } from 'react'
import { TierSection } from './TierSection'
import { Modal } from './Modal'
import { impactToTier, TIER_LABEL, TIER_COLOR } from '@/lib/tiers'
import type { ViolationPattern, PageScore } from '@/types'
import { isWcagPattern } from '@/lib/metrics'

interface Props {
  pageScore: PageScore
  patterns: ViolationPattern[]
  children?: React.ReactElement
}

export function PageViolationsModal({ pageScore, patterns, children }: Props) {
  const [open, setOpen] = useState(false)

  const pagePatterns = patterns.filter(p =>
    isWcagPattern(p) && (
      p.affectedPages?.includes(pageScore.url) ||
      p.nodes?.some(n => n.url === pageScore.url)
    )
  )
  const pageErrorCount = pagePatterns.reduce((sum, pattern) => {
    const pageOccurrenceCount = pattern.pageOccurrences?.[pageScore.url]
    if (pageOccurrenceCount != null) return sum + pageOccurrenceCount

    const pageNodeCount = pattern.nodes?.filter(node => node.url === pageScore.url).length ?? 0
    return sum + (pageNodeCount || 1)
  }, 0)

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
        className={`text-left hover:underline truncate max-w-xs block ${hasData ? 'text-[#007AFF] cursor-pointer' : 'text-[#57575A] cursor-default'}`}
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
        <Modal
          size="xl"
          onClose={() => setOpen(false)}
          title={
            <div>
              <div className="text-base font-semibold text-[#1D1D1F]">{pageScore.label ?? 'Page'}</div>
              <a href={pageScore.url} target="_blank" rel="noopener noreferrer"
                className="text-sm text-[#007AFF] hover:underline break-all">
                {pageScore.url}
              </a>
              <div className="flex items-center gap-3 mt-1">
                <span className="text-sm text-[#57575A]">
                  {pagePatterns.length} issue type{pagePatterns.length !== 1 ? 's' : ''}
                </span>
                {pageScore.violationCount != null && (
                  <span className="text-sm text-[#57575A]">· {pageErrorCount} component issue{pageErrorCount !== 1 ? 's' : ''}</span>
                )}
              </div>
            </div>
          }
        >
          <div className="px-6 py-5">
            {pagePatterns.length === 0 ? (
              <div className="text-center py-10 text-[#57575A] text-sm">No component issues found on this page.</div>
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
                        occurrences: p.pageOccurrences?.[pageScore.url] ?? (pageNodes.length > 0 ? pageNodes.length : 1),
                      }
                    })}
                  />
                )
              })
            )}
          </div>
        </Modal>
      )}
    </>
  )
}
