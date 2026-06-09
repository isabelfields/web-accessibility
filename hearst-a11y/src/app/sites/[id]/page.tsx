import { sql } from '@/lib/db'
import { notFound } from 'next/navigation'

export const dynamic = 'force-dynamic'
import Link from 'next/link'
import { RunScanButton } from '@/components/RunScanButton'
import { CancelScanButton } from '@/components/CancelScanButton'
import { DeleteScanButton } from '@/components/DeleteScanButton'
import { ViolationCard } from '@/components/ViolationCard'
import { EditSiteButton } from '@/components/EditSiteButton'
import { PageViolationsModal } from '@/components/PageViolationsModal'
import { patternsToWorstTier, TIER_LABEL, TIER_COLOR, impactToTier } from '@/lib/tiers'
import type { ViolationPattern, SitePage } from '@/types'

async function getSiteData(id: string) {
  const [site] = await sql`SELECT * FROM sites WHERE id = ${id}`
  if (!site) return null

  const scans = await sql`
    SELECT id, status, pages_scanned, raw_violation_count,
           unique_pattern_count, estimated_cost_usd, started_at, completed_at,
           triggered_by, patterns, page_scores
    FROM scan_jobs
    WHERE site_id = ${id}
    ORDER BY started_at DESC
    LIMIT 20
  `

  return { site, scans }
}

function formatDate(d: string | Date | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function relativeTime(d: string | Date | null) {
  if (!d) return null
  const ms = Date.now() - new Date(d).getTime()
  const mins = Math.floor(ms / 60000)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days} day${days !== 1 ? 's' : ''} ago`
}

function TierBadge({ tier }: { tier: string | null }) {
  if (!tier) return <span style={{ color: 'var(--color-text-muted)' }}>—</span>
  const map: Record<string, string> = { tier1: 't1', tier2: 't2', tier3: 't3', tier4: 't4' }
  const cls = map[tier] ?? 't4'
  const label = tier.replace('tier', 'T')
  return <span className={`badge-${cls}`}>{label}</span>
}

export default async function SiteDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const data = await getSiteData(id)
  if (!data) notFound()

  const { site, scans } = data
  const pages: SitePage[] = (site.pages as SitePage[]) ?? []

  const completedScans = scans.filter((s: any) => s.status === 'complete')
  const latestScan = completedScans[0] ?? null
  const pageScores: Array<{ url: string; label?: string; score: number | null; violationCount: number | null; error?: string }> =
    latestScan?.page_scores ?? []

  const patterns: ViolationPattern[] = latestScan?.patterns ?? []
  const byTier: Record<string, ViolationPattern[]> = { tier1: [], tier2: [], tier3: [], tier4: [] }
  for (const p of patterns) {
    const t = impactToTier(p.impact)
    byTier[t].push(p)
  }
  const worstTier = patternsToWorstTier(patterns)

  const hasTiers = (['tier1', 'tier2', 'tier3', 'tier4'] as const).some(t => byTier[t].length > 0)

  return (
    <div className="min-h-screen" style={{ background: 'var(--color-bg-base)' }}>
      {/* Top bar */}
      <div
        className="px-8 py-4 flex items-center justify-between sticky top-0 z-10 backdrop-blur-sm"
        style={{ background: 'rgba(255,255,255,0.92)', borderBottom: '1px solid var(--color-border)' }}
      >
        {/* Breadcrumb */}
        <nav aria-label="Breadcrumb">
          <ol className="flex items-center gap-2 text-[14px]">
            <li>
              <Link href="/sites" className="font-medium hover:underline" style={{ color: 'var(--color-hearst-blue)' }}>
                Sites
              </Link>
            </li>
            <li aria-hidden="true" style={{ color: 'var(--color-border-strong)' }}>/</li>
            <li className="font-bold" style={{ color: 'var(--color-text-primary)' }} aria-current="page">
              {site.name}
            </li>
          </ol>
        </nav>
        <div className="flex items-center gap-2">
          <EditSiteButton site={{ id: site.id, name: site.name, division: site.division, pages }} />
          <RunScanButton siteId={site.id} />
        </div>
      </div>

      <div className="px-8 py-7">
        {/* Page header */}
        <div className="mb-7">
          <h1 className="text-[28px] font-bold leading-tight" style={{ color: 'var(--color-text-primary)' }}>{site.name}</h1>
          {latestScan && (
            <p className="text-[13px] mt-1" style={{ color: 'var(--color-text-muted)' }}>
              Last scanned{' '}
              <span title={formatDate(latestScan.started_at)}>
                {relativeTime(latestScan.started_at)}
              </span>
            </p>
          )}
        </div>

        {/* Summary stat cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-7">
          <div className="card p-5">
            <div className="text-[11px] font-semibold uppercase tracking-[0.07em] mb-3" style={{ color: 'var(--color-text-muted)' }}>Priority</div>
            {worstTier ? (
              <>
                <TierBadge tier={worstTier} />
                <div className="text-[12px] mt-2" style={{ color: 'var(--color-text-muted)' }}>highest tier found</div>
              </>
            ) : (
              <div className="text-[15px] font-semibold mt-1" style={{ color: 'var(--color-tier4)' }}>
                {latestScan ? 'No issues' : 'No scans yet'}
              </div>
            )}
          </div>

          <div className="card p-5" style={latestScan?.raw_violation_count > 0 ? { borderLeft: '4px solid var(--color-tier1)' } : undefined}>
            <div className="text-[11px] font-semibold uppercase tracking-[0.07em] mb-3" style={{ color: 'var(--color-text-muted)' }}>WCAG Errors</div>
            <div className="mono font-bold text-[36px] leading-none tabular-nums" style={{ color: 'var(--color-text-primary)' }}>
              {latestScan?.raw_violation_count ?? '—'}
            </div>
            <div className="text-[12px] mt-2" style={{ color: 'var(--color-text-muted)' }}>
              {latestScan?.unique_pattern_count ?? 0} issue types
            </div>
          </div>

          <div className="card p-5">
            <div className="text-[11px] font-semibold uppercase tracking-[0.07em] mb-3" style={{ color: 'var(--color-text-muted)' }}>Pages Scanned</div>
            <div className="mono font-bold text-[36px] leading-none tabular-nums" style={{ color: 'var(--color-text-primary)' }}>
              {latestScan?.pages_scanned ?? '—'}
            </div>
            <div className="text-[12px] mt-2" style={{ color: 'var(--color-text-muted)' }}>{pages.length} configured</div>
          </div>

          <div className="card p-5">
            <div className="text-[11px] font-semibold uppercase tracking-[0.07em] mb-3" style={{ color: 'var(--color-text-muted)' }}>Total Scans</div>
            <div className="mono font-bold text-[36px] leading-none tabular-nums" style={{ color: 'var(--color-text-primary)' }}>
              {scans.length}
            </div>
            <div className="text-[12px] mt-2" style={{ color: 'var(--color-text-muted)' }}>{completedScans.length} completed</div>
          </div>
        </div>

        <div className="space-y-8">

          {/* Per-page breakdown */}
          {pageScores.length > 0 && (
            <section aria-labelledby="page-breakdown-heading">
              <div className="flex items-center justify-between mb-4">
                <h2 id="page-breakdown-heading" className="text-[15px] font-bold" style={{ color: 'var(--color-text-primary)' }}>
                  Page Breakdown
                </h2>
                <span className="text-[13px]" style={{ color: 'var(--color-text-muted)' }}>
                  {pageScores.length} page{pageScores.length !== 1 ? 's' : ''} · click row to see violations
                </span>
              </div>
              <div className="card overflow-hidden">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th scope="col">Page</th>
                      <th scope="col">URL</th>
                      <th scope="col" style={{ textAlign: 'center' }}>Tier</th>
                      <th scope="col" style={{ textAlign: 'right' }}>WCAG Errors</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...pageScores]
                      .sort((a, b) => (b.violationCount ?? 0) - (a.violationCount ?? 0))
                      .map((ps, i) => {
                        const pagePatterns = patterns.filter(p =>
                          p.affectedPages?.includes(ps.url) || p.nodes?.some(n => n.url === ps.url)
                        )
                        const pageTier = patternsToWorstTier(pagePatterns)
                        return (
                          <PageViolationsModal key={i} pageScore={ps} patterns={patterns}>
                            <tr className={ps.score != null ? 'cursor-pointer' : ''}>
                              <td className="font-semibold">{ps.label ?? '—'}</td>
                              <td>
                                <span
                                  className="mono text-[12px] truncate block max-w-sm"
                                  style={{ color: 'var(--color-hearst-blue)' }}
                                  title={ps.url}
                                >
                                  {ps.url}
                                </span>
                                {ps.error && (
                                  <div className="text-[12px] mt-0.5" style={{ color: 'var(--color-tier1)' }}>
                                    ⚠ {ps.error.slice(0, 80)}
                                  </div>
                                )}
                              </td>
                              <td style={{ textAlign: 'center' }}>
                                <TierBadge tier={pageTier} />
                              </td>
                              <td style={{ textAlign: 'right' }}>
                                <span className="mono font-semibold text-[14px]" style={{ color: 'var(--color-text-primary)' }}>
                                  {ps.violationCount ?? (ps.score == null ? (
                                    <span style={{ color: 'var(--color-tier1)', fontSize: 12 }}>Failed</span>
                                  ) : '—')}
                                </span>
                              </td>
                            </tr>
                          </PageViolationsModal>
                        )
                      })}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* WCAG Violations */}
          <section aria-labelledby="violations-heading">
            <div className="flex items-start justify-between mb-4">
              <h2 id="violations-heading" className="text-[15px] font-bold" style={{ color: 'var(--color-text-primary)' }}>
                WCAG Errors
              </h2>
              {/* Jump nav */}
              {hasTiers && (
                <nav aria-label="Jump to tier" className="flex items-center gap-1">
                  <span className="text-[12px] mr-2" style={{ color: 'var(--color-text-muted)' }}>Jump to:</span>
                  {(['tier1', 'tier2', 'tier3', 'tier4'] as const).map(tier => {
                    if (byTier[tier].length === 0) return null
                    const label = tier.replace('tier', 'T')
                    return (
                      <a
                        key={tier}
                        href={`#${tier}`}
                        className={`badge-${tier.replace('tier', 't')} hover:opacity-80 transition-opacity`}
                        style={{ textDecoration: 'none' }}
                      >
                        {label}
                      </a>
                    )
                  })}
                </nav>
              )}
            </div>

            {patterns.length === 0 ? (
              <div
                className="rounded-lg p-10 text-center text-[14px]"
                style={{ border: '1px dashed var(--color-border-strong)', color: 'var(--color-text-muted)' }}
              >
                {latestScan ? 'No violations found. Great job!' : 'Run a scan to see violations.'}
              </div>
            ) : (
              <div className="space-y-6">
                {(['tier1', 'tier2', 'tier3', 'tier4'] as const).map(tier => {
                  const group = byTier[tier]
                  if (group.length === 0) return null
                  const tierLabel = tier.replace('tier', 'T')
                  return (
                    <div key={tier} id={tier}>
                      <div className="flex items-center gap-2.5 mb-3">
                        <span className={`badge-${tier.replace('tier', 't')}`}>{tierLabel}</span>
                        <span className="text-[13px] font-medium" style={{ color: 'var(--color-text-muted)' }}>
                          {group.length} issue type{group.length !== 1 ? 's' : ''}
                        </span>
                      </div>
                      <div className="space-y-2">
                        {group.map(p => (
                          <ViolationCard key={p.fingerprint} pattern={p} />
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </section>

          {/* Scan History */}
          <section aria-labelledby="scan-history-heading">
            <h2 id="scan-history-heading" className="text-[15px] font-bold mb-4" style={{ color: 'var(--color-text-primary)' }}>
              Scan History
            </h2>
            <div className="card overflow-hidden">
              <table className="data-table">
                <thead>
                  <tr>
                    <th scope="col">Started</th>
                    <th scope="col">Status</th>
                    <th scope="col" style={{ textAlign: 'right' }}>Pages</th>
                    <th scope="col" style={{ textAlign: 'right' }}>Issues</th>
                    <th scope="col">Triggered By</th>
                    <th scope="col" className="w-20"></th>
                  </tr>
                </thead>
                <tbody>
                  {scans.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-10" style={{ color: 'var(--color-text-muted)' }}>No scans yet.</td>
                    </tr>
                  ) : (
                    scans.map((scan: any) => (
                      <tr key={scan.id} className="group cursor-pointer relative">
                        <td>
                          <Link href={`/scans/${scan.id}`} className="absolute inset-0" aria-label={`View scan from ${formatDate(scan.started_at)}`} />
                          <span className="text-[13px]" style={{ color: 'var(--color-text-primary)' }}>
                            {formatDate(scan.started_at)}
                          </span>
                        </td>
                        <td><ScanStatusBadge status={scan.status} /></td>
                        <td style={{ textAlign: 'right' }}>
                          <span className="mono font-medium">{scan.pages_scanned ?? 0}</span>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <span className="mono font-semibold">{scan.raw_violation_count ?? 0}</span>
                        </td>
                        <td className="capitalize text-[13px]" style={{ color: 'var(--color-text-secondary)' }}>
                          {scan.triggered_by}
                        </td>
                        <td style={{ textAlign: 'right', position: 'relative', zIndex: 10 }} className="opacity-0 group-hover:opacity-100 transition-opacity">
                          <div className="flex items-center justify-end gap-1">
                            {(scan.status === 'running' || scan.status === 'queued') && (
                              <CancelScanButton jobId={scan.id} />
                            )}
                            {scan.status !== 'running' && scan.status !== 'queued' && (
                              <DeleteScanButton jobId={scan.id} />
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>

          {/* Configured Pages */}
          {pages.length > 0 && (
            <section aria-labelledby="configured-pages-heading">
              <h2 id="configured-pages-heading" className="text-[15px] font-bold mb-4" style={{ color: 'var(--color-text-primary)' }}>
                Configured Pages
              </h2>
              <div className="card overflow-hidden">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th scope="col">Label</th>
                      <th scope="col">URL</th>
                      <th scope="col">Template</th>
                      <th scope="col" style={{ textAlign: 'right' }}>WCAG Errors</th>
                      <th scope="col" style={{ textAlign: 'right' }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pages.map((page, i) => {
                      const ps = pageScores.find(s => s.url === page.url)
                      return (
                        <tr key={i}>
                          <td className="font-semibold">{page.label}</td>
                          <td>
                            <PageViolationsModal
                              pageScore={ps ?? { url: page.url, label: page.label, score: null as any, violationCount: null as any }}
                              patterns={patterns}
                            />
                          </td>
                          <td>
                            <span
                              className="inline-flex items-center px-2 py-0.5 rounded-full text-[12px] font-medium capitalize"
                              style={{ background: 'var(--color-bg-elevated)', color: 'var(--color-text-secondary)' }}
                            >
                              {page.templateType}
                            </span>
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <span className="mono font-semibold">{ps ? (ps.violationCount ?? '—') : '—'}</span>
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            {!ps
                              ? <span style={{ color: 'var(--color-text-muted)', fontSize: 12 }}>—</span>
                              : ps.score == null
                                ? <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[12px] font-semibold" style={{ background: 'rgba(200,0,42,0.10)', color: '#C8002A' }}>Failed</span>
                                : <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[12px] font-semibold" style={{ background: 'rgba(58,125,68,0.10)', color: '#3A7D44' }}>Scanned</span>
                            }
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  )
}

function ScanStatusBadge({ status }: { status: string }) {
  const s: Record<string, { bg: string; color: string }> = {
    complete: { bg: 'rgba(58,125,68,0.10)',  color: '#3A7D44' },
    running:  { bg: 'rgba(0,87,184,0.10)',   color: '#0057B8' },
    failed:   { bg: 'rgba(200,0,42,0.10)',   color: '#C8002A' },
    queued:   { bg: 'rgba(176,132,0,0.10)',  color: '#B08400' },
  }
  const style = s[status] ?? { bg: 'var(--color-bg-elevated)', color: 'var(--color-text-muted)' }
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[12px] font-semibold"
      style={{ background: style.bg, color: style.color }}>
      {status}
    </span>
  )
}
