'use client'

import { useState } from 'react'
import { ViolationCard } from './ViolationCard'
import type { ViolationPattern, PageScore } from '@/types'

interface Props {
  pageScore: PageScore
  patterns: ViolationPattern[]
  /** If provided, renders as the clickable trigger instead of the default URL button */
  children?: React.ReactNode
}

export function PageViolationsModal({ pageScore, patterns, children }: Props) {
  const [open, setOpen] = useState(false)

  const pagePatterns = patterns.filter(p =>
    p.affectedPages?.includes(pageScore.url) ||
    p.nodes?.some(n => n.url === pageScore.url)
  )

  const hasData = pageScore.score != null

  const trigger = children ?? (
    <button
      onClick={() => hasData && setOpen(true)}
      className={`text-left hover:underline truncate max-w-xs block ${hasData ? 'text-brand-500 cursor-pointer' : 'text-blue-300 cursor-default'}`}
      title={pageScore.url}
      disabled={!hasData}
    >
      {pageScore.url}
    </button>
  )

  return (
    <>
      {children ? (
        <div onClick={() => hasData && setOpen(true)} className={hasData ? 'cursor-pointer' : ''}>
          {children}
        </div>
      ) : trigger}

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setOpen(false)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl mx-4 max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-start justify-between px-6 py-4 border-b flex-shrink-0">
              <div>
                <h2 className="text-base font-semibold text-gray-900">{pageScore.label ?? 'Page'}</h2>
                <a href={pageScore.url} target="_blank" rel="noopener noreferrer"
                  className="text-sm text-brand-500 hover:underline break-all">
                  {pageScore.url}
                </a>
                <div className="flex items-center gap-3 mt-1">
                  {pageScore.score != null && (
                    <span className="text-sm text-gray-500">Score: <strong>{pageScore.score}</strong></span>
                  )}
                  <span className="text-sm text-gray-500">
                    {pagePatterns.length} issue type{pagePatterns.length !== 1 ? 's' : ''}
                  </span>
                </div>
              </div>
              <button onClick={() => setOpen(false)}
                className="text-gray-400 hover:text-gray-600 text-2xl leading-none ml-4 flex-shrink-0">
                &times;
              </button>
            </div>

            {/* Body */}
            <div className="overflow-y-auto px-6 py-5 space-y-5">
              {pagePatterns.length === 0 ? (
                <div className="text-center py-10 text-gray-400 text-sm">No violations found on this page.</div>
              ) : (
                (['critical', 'serious', 'moderate', 'minor'] as const).map(impact => {
                  const group = pagePatterns.filter(p => p.impact === impact)
                  if (group.length === 0) return null
                  const cfg = {
                    critical: { bar: 'bg-red-500',    text: 'text-red-600',    label: 'Critical' },
                    serious:  { bar: 'bg-orange-400', text: 'text-orange-600', label: 'Serious' },
                    moderate: { bar: 'bg-amber-400',  text: 'text-amber-600',  label: 'Moderate' },
                    minor:    { bar: 'bg-blue-400',   text: 'text-blue-600',   label: 'Minor' },
                  }[impact]
                  return (
                    <div key={impact}>
                      <div className="flex items-center gap-2 mb-2 px-1">
                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${cfg.bar}`} />
                        <span className={`text-xs font-semibold uppercase tracking-wider ${cfg.text}`}>{cfg.label}</span>
                        <span className="text-xs text-gray-400">{group.length} issue type{group.length !== 1 ? 's' : ''}</span>
                      </div>
                      <div className="space-y-1.5">
                        {group.map(p => {
                          const pageNodes = p.nodes?.filter(n => n.url === pageScore.url) ?? []
                          const patternForPage = {
                            ...p,
                            nodes: pageNodes.length > 0 ? pageNodes : p.nodes ?? [],
                            affectedPages: [pageScore.url],
                            occurrences: pageNodes.length || p.occurrences,
                          }
                          return <ViolationCard key={p.fingerprint} pattern={patternForPage} />
                        })}
                      </div>
                    </div>
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
