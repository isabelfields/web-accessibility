'use client'

import { useState, cloneElement, isValidElement } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { ViolationCard } from './ViolationCard'
import type { ViolationPattern, PageScore } from '@/types'

interface Props {
  pageScore: PageScore
  patterns: ViolationPattern[]
  pageTrend?: Array<{ date: string; violationCount: number | null }>
  /** If provided, renders as the clickable trigger instead of the default URL button */
  children?: React.ReactElement
}

export function PageViolationsModal({ pageScore, patterns, pageTrend, children }: Props) {
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
        className={`text-left hover:underline truncate max-w-xs block ${hasData ? 'text-[#5b9bd6] cursor-pointer' : 'text-[var(--text-muted)] cursor-default'}`}
        title={pageScore.url}
        disabled={!hasData}
      >
        {pageScore.url}
      </button>
    )

  return (
    <>
      {trigger}

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70" onClick={() => setOpen(false)}>
          <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl shadow-xl w-full max-w-3xl mx-4 max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-start justify-between px-6 py-4 border-b border-[var(--border)] flex-shrink-0">
              <div>
                <h2 className="text-base font-semibold text-[var(--text)]">{pageScore.label ?? 'Page'}</h2>
                <a href={pageScore.url} target="_blank" rel="noopener noreferrer"
                  className="text-sm text-[#5b9bd6] hover:underline break-all">
                  {pageScore.url}
                </a>
                <div className="flex items-center gap-3 mt-1">
                  {pageScore.score != null && (
                    <span className="text-sm text-[var(--text-muted)]">Score: <strong className="text-[var(--text)]">{pageScore.score}</strong></span>
                  )}
                  <span className="text-sm text-[var(--text-muted)]">
                    {pagePatterns.length} issue type{pagePatterns.length !== 1 ? 's' : ''}
                  </span>
                  {pageScore.violationCount != null && (
                    <span className="text-sm text-[var(--text-muted)]">· {pageScore.violationCount} total violations</span>
                  )}
                </div>
              </div>
              <button onClick={() => setOpen(false)}
                className="text-[var(--text-muted)] hover:text-[var(--text)] text-2xl leading-none ml-4 flex-shrink-0">
                &times;
              </button>
            </div>

            {/* Body */}
            <div className="overflow-y-auto px-6 py-5 space-y-5">
              {pageTrend && pageTrend.filter(d => d.violationCount != null).length >= 2 && (
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>
                    WCAG Errors Over Time
                  </div>
                  <ResponsiveContainer width="100%" height={140}>
                    <LineChart data={pageTrend} margin={{ top: 4, right: 8, left: -20, bottom: 4 }}>
                      <CartesianGrid strokeDasharray="0" stroke="rgba(10,22,40,0.08)" vertical={false} />
                      <XAxis
                        dataKey="date"
                        tick={{ fontSize: 10, fill: '#718096', fontFamily: 'JetBrains Mono, monospace' }}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(v) => new Date(v).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      />
                      <YAxis
                        allowDecimals={false}
                        tick={{ fontSize: 10, fill: '#718096', fontFamily: 'JetBrains Mono, monospace' }}
                        tickLine={false}
                        axisLine={false}
                      />
                      <Tooltip
                        contentStyle={{ background: '#fff', border: '1px solid #DDE3EC', borderRadius: 8, fontSize: 12 }}
                        labelFormatter={(v) => new Date(v).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        formatter={(val: any) => [val, 'Errors']}
                      />
                      <Line
                        type="monotone"
                        dataKey="violationCount"
                        stroke="#0057B8"
                        strokeWidth={2}
                        dot={false}
                        activeDot={{ r: 4, strokeWidth: 0 }}
                        connectNulls
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
              {pagePatterns.length === 0 ? (
                <div className="text-center py-10 text-[var(--text-muted)] text-sm">No violations found on this page.</div>
              ) : (
                (['critical', 'serious', 'moderate', 'minor'] as const).map(impact => {
                  const group = pagePatterns.filter(p => p.impact === impact)
                  if (group.length === 0) return null
                  const cfg = {
                    critical: { bar: 'bg-red-500',    text: 'text-red-400',    label: 'Critical' },
                    serious:  { bar: 'bg-red-400',    text: 'text-red-400',    label: 'Serious' },
                    moderate: { bar: 'bg-amber-400',  text: 'text-amber-400',  label: 'Moderate' },
                    minor:    { bar: 'bg-blue-400',   text: 'text-blue-400',   label: 'Minor' },
                  }[impact]
                  return (
                    <div key={impact}>
                      <div className="flex items-center gap-2 mb-2 px-1">
                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${cfg.bar}`} />
                        <span className={`text-xs font-semibold uppercase tracking-wider ${cfg.text}`}>{cfg.label}</span>
                        <span className="text-xs text-[var(--text-muted)]">{group.length} issue type{group.length !== 1 ? 's' : ''}</span>
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
