import Link from 'next/link'
import { notFound } from 'next/navigation'
import { sql } from '@/lib/db'
import { requireAdmin } from '@/lib/auth-helpers'
import { DivisionTrendChart } from '@/components/DivisionTrendChart'
import { countOccurrences, formatSignedDelta, isWcagPattern } from '@/lib/metrics'
import type { ViolationPattern } from '@/types'

type SearchParams = { division?: string; days?: string; bucket?: string }

type SiteRow = {
  id: string
  name: string
  division: string | null
  scan_id: string | null
  started_at: string | Date | null
  pages_scanned: number | null
  patterns: ViolationPattern[] | string | null
}

type SiteTrend = {
  siteId: string
  siteName: string
  division: string
  firstStartedAt: string | Date | null
  latestStartedAt: string | Date | null
  firstIssues: number
  latestIssues: number
  delta: number
  resolved: number
}

type DivisionSummary = {
  division: string
  sites: number
  firstIssues: number
  latestIssues: number
  delta: number
  resolved: number
}

type RangeOption = '30' | '60' | '90' | 'all'
type BucketOption = 'week' | 'month'

type TrendPoint = {
  bucket: string
  label: string
  [division: string]: string | number
}

function parsePatterns(value: ViolationPattern[] | string | null): ViolationPattern[] {
  if (!value) return []
  if (Array.isArray(value)) return value
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function countWcagIssues(patterns: ViolationPattern[]): number {
  return countOccurrences(patterns, isWcagPattern)
}

function formatDate(value: string | Date | null): string {
  if (!value) return '—'
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(value))
}

function statusCopy(delta: number): { label: string; className: string } {
  if (delta < 0) return { label: `${Math.abs(delta)} resolved`, className: 'bg-emerald-50 text-emerald-700' }
  if (delta > 0) return { label: `${delta} added`, className: 'bg-red-50 text-red-700' }
  return { label: 'No change', className: 'bg-gray-100 text-gray-600' }
}

function parseRange(value?: string): RangeOption {
  return value === '30' || value === '60' || value === '90' || value === 'all' ? value : '90'
}

function parseBucket(value?: string): BucketOption {
  return value === 'month' ? 'month' : 'week'
}

function rangeStart(days: RangeOption): Date | null {
  if (days === 'all') return null
  const start = new Date()
  start.setDate(start.getDate() - Number(days))
  start.setHours(0, 0, 0, 0)
  return start
}

function bucketStart(value: string | Date, bucket: BucketOption): Date {
  const date = new Date(value)
  const start = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
  if (bucket === 'month') return new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1))
  const day = start.getUTCDay()
  const diff = day === 0 ? -6 : 1 - day
  start.setUTCDate(start.getUTCDate() + diff)
  return start
}

function bucketLabel(bucketKey: string, bucket: BucketOption): string {
  const date = new Date(`${bucketKey}T00:00:00.000Z`)
  return new Intl.DateTimeFormat('en-US', bucket === 'month'
    ? { month: 'short', year: '2-digit', timeZone: 'UTC' }
    : { month: 'short', day: 'numeric', timeZone: 'UTC' }
  ).format(date)
}

function buildTrendPoints(siteTrends: SiteTrend[], rows: SiteRow[], selectedDivision: string | undefined, days: RangeOption, bucket: BucketOption) {
  const start = rangeStart(days)
  const latestBySiteBucket = new Map<string, { division: string; issues: number; startedAt: Date }>()
  const divisions = new Set<string>()

  for (const row of rows) {
    if (!row.scan_id || !row.started_at) continue
    const startedAt = new Date(row.started_at)
    if (start && startedAt < start) continue

    const division = row.division ?? 'Unassigned'
    if (selectedDivision && division !== selectedDivision) continue

    const bucketKey = bucketStart(startedAt, bucket).toISOString().slice(0, 10)
    const key = `${division}::${bucketKey}::${row.id}`
    const existing = latestBySiteBucket.get(key)
    if (existing && existing.startedAt >= startedAt) continue

    divisions.add(division)
    latestBySiteBucket.set(key, {
      division,
      issues: countWcagIssues(parsePatterns(row.patterns)),
      startedAt,
    })
  }

  const bucketDivisionTotals = new Map<string, Map<string, number>>()
  for (const [key, value] of latestBySiteBucket) {
    const bucketKey = key.split('::')[1]
    const byDivision = bucketDivisionTotals.get(bucketKey) ?? new Map<string, number>()
    byDivision.set(value.division, (byDivision.get(value.division) ?? 0) + value.issues)
    bucketDivisionTotals.set(bucketKey, byDivision)
  }

  const trendDivisions = selectedDivision
    ? [selectedDivision]
    : [...divisions].sort((a, b) => {
      const aDelta = siteTrends.filter(site => site.division === a).reduce((sum, site) => sum + site.delta, 0)
      const bDelta = siteTrends.filter(site => site.division === b).reduce((sum, site) => sum + site.delta, 0)
      return Math.abs(bDelta) - Math.abs(aDelta) || a.localeCompare(b)
    }).slice(0, 8)

  const points: TrendPoint[] = [...bucketDivisionTotals.keys()].sort().map(bucketKey => {
    const point: TrendPoint = { bucket: bucketKey, label: bucketLabel(bucketKey, bucket) }
    const byDivision = bucketDivisionTotals.get(bucketKey)!
    for (const division of trendDivisions) point[division] = byDivision.get(division) ?? 0
    return point
  })

  return { points, divisions: trendDivisions }
}

async function getResolutionData(selectedDivision: string | undefined, days: RangeOption, bucket: BucketOption) {
  const rows = await sql`
    SELECT
      s.id,
      s.name,
      s.division,
      sj.id AS scan_id,
      sj.started_at,
      sj.pages_scanned,
      COALESCE(sj.patterns, '[]'::jsonb) AS patterns
    FROM sites s
    LEFT JOIN scan_jobs sj ON sj.site_id = s.id AND sj.status = 'complete'
    ORDER BY s.name ASC, sj.started_at ASC
  `

  const bySite = new Map<string, SiteRow[]>()
  const activeDivisions = new Set<string>()

  for (const row of rows as SiteRow[]) {
    const division = row.division ?? 'Unassigned'
    activeDivisions.add(division)
    if (selectedDivision && division !== selectedDivision) continue
    if (!bySite.has(row.id)) bySite.set(row.id, [])
    bySite.get(row.id)!.push(row)
  }

  const siteTrends: SiteTrend[] = []

  for (const siteRows of bySite.values()) {
    const scans = siteRows.filter(row => row.scan_id)
    if (scans.length === 0) continue

    const first = scans[0]
    const latest = scans[scans.length - 1]
    const firstIssues = countWcagIssues(parsePatterns(first.patterns))
    const latestIssues = countWcagIssues(parsePatterns(latest.patterns))
    const delta = latestIssues - firstIssues

    siteTrends.push({
      siteId: first.id,
      siteName: first.name,
      division: first.division ?? 'Unassigned',
      firstStartedAt: first.started_at,
      latestStartedAt: latest.started_at,
      firstIssues,
      latestIssues,
      delta,
      resolved: Math.max(0, -delta),
    })
  }

  siteTrends.sort((a, b) => a.delta - b.delta || a.siteName.localeCompare(b.siteName))

  const divisions = new Map<string, DivisionSummary>()
  for (const site of siteTrends) {
    const current = divisions.get(site.division) ?? {
      division: site.division,
      sites: 0,
      firstIssues: 0,
      latestIssues: 0,
      delta: 0,
      resolved: 0,
    }
    current.sites += 1
    current.firstIssues += site.firstIssues
    current.latestIssues += site.latestIssues
    current.delta += site.delta
    current.resolved += site.resolved
    divisions.set(site.division, current)
  }

  const trend = buildTrendPoints(siteTrends, rows as SiteRow[], selectedDivision, days, bucket)

  return {
    activeDivisions: [...activeDivisions].sort(),
    siteTrends,
    divisionSummaries: [...divisions.values()].sort((a, b) => a.delta - b.delta || a.division.localeCompare(b.division)),
    trend,
  }
}

export default async function ResolutionDashboard({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const admin = await requireAdmin()
  if (!admin) notFound()

  const { division, days: daysParam, bucket: bucketParam } = await searchParams
  const selectedDivision = division || undefined
  const days = parseRange(daysParam)
  const bucket = parseBucket(bucketParam)
  const { activeDivisions, siteTrends, divisionSummaries, trend } = await getResolutionData(selectedDivision, days, bucket)

  const totals = siteTrends.reduce((acc, site) => {
    acc.firstIssues += site.firstIssues
    acc.latestIssues += site.latestIssues
    acc.delta += site.delta
    acc.resolved += site.resolved
    return acc
  }, { firstIssues: 0, latestIssues: 0, delta: 0, resolved: 0 })

  const netStatus = statusCopy(totals.delta)

  return (
    <div className="p-8">
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="mb-2 flex items-center gap-2 text-sm text-[#57575A]">
            <Link href="/" className="hover:text-[#1D1D1F]">Dashboard</Link>
            <span>/</span>
            <span>Admin</span>
          </div>
          <h1 className="text-2xl font-bold text-[#1D1D1F]">Resolution Dashboard</h1>
          <p className="mt-1 text-sm text-[#57575A]">
            Track whether WCAG issue counts have gone up or down from each site's first completed scan to its latest completed scan.
          </p>
        </div>

        <form className="flex items-center gap-2 rounded-xl border border-[#E5E5EA] bg-white px-3 py-2 shadow-sm">
          <label htmlFor="division" className="text-xs font-semibold uppercase tracking-wider text-[#57575A]">Division</label>
          <select
            id="division"
            name="division"
            defaultValue={selectedDivision ?? ''}
            className="rounded-lg border border-[#D1D1D6] bg-white px-3 py-1.5 text-sm font-medium text-[#1D1D1F] focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All divisions</option>
            {activeDivisions.map(div => <option key={div} value={div}>{div}</option>)}
          </select>
          <select name="days" defaultValue={days} aria-label="Date range" className="rounded-lg border border-[#D1D1D6] bg-white px-3 py-1.5 text-sm font-medium text-[#1D1D1F] focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="30">30 days</option>
            <option value="60">60 days</option>
            <option value="90">90 days</option>
            <option value="all">All time</option>
          </select>
          <select name="bucket" defaultValue={bucket} aria-label="Grouping" className="rounded-lg border border-[#D1D1D6] bg-white px-3 py-1.5 text-sm font-medium text-[#1D1D1F] focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="week">Weekly</option>
            <option value="month">Monthly</option>
          </select>
          <button className="rounded-lg bg-[#1D1D1F] px-3 py-1.5 text-sm font-semibold text-white hover:bg-black" type="submit">Apply</button>
          <Link href={`/admin/resolutions/export?${new URLSearchParams({ ...(selectedDivision ? { division: selectedDivision } : {}), days, bucket }).toString()}`} className="rounded-lg border border-[#D1D1D6] px-3 py-1.5 text-sm font-semibold text-[#1D1D1F] hover:bg-[#F5F5F7]">Export CSV</Link>
          {selectedDivision && <Link href="/admin/resolutions" className="text-sm font-medium text-[#007AFF] hover:underline">Clear</Link>}
        </form>
      </div>

      <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
        <div className="rounded-xl border border-[#E5E5EA] bg-white p-5 shadow-sm">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-[#57575A]">Net change</div>
          <div className={`mt-3 inline-flex rounded-full px-3 py-1 text-sm font-bold ${netStatus.className}`}>{netStatus.label}</div>
          <div className="mt-3 text-xs text-[#57575A]">{formatSignedDelta(totals.delta)} issue delta since first scans</div>
        </div>
        <div className="rounded-xl border border-[#E5E5EA] bg-white p-5 shadow-sm">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-[#57575A]">Resolved</div>
          <div className="mt-2 text-4xl font-bold text-emerald-600 tabular-nums">{totals.resolved}</div>
          <div className="mt-1 text-xs text-[#57575A]">issues reduced across improving sites</div>
        </div>
        <div className="rounded-xl border border-[#E5E5EA] bg-white p-5 shadow-sm">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-[#57575A]">First scan issues</div>
          <div className="mt-2 text-4xl font-bold text-[#1D1D1F] tabular-nums">{totals.firstIssues}</div>
          <div className="mt-1 text-xs text-[#57575A]">baseline WCAG issue instances</div>
        </div>
        <div className="rounded-xl border border-[#E5E5EA] bg-white p-5 shadow-sm">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-[#57575A]">Latest issues</div>
          <div className="mt-2 text-4xl font-bold text-[#1D1D1F] tabular-nums">{totals.latestIssues}</div>
          <div className="mt-1 text-xs text-[#57575A]">current completed-scan total</div>
        </div>
        <div className="rounded-xl border border-[#E5E5EA] bg-white p-5 shadow-sm">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-[#57575A]">Sites tracked</div>
          <div className="mt-2 text-4xl font-bold text-[#1D1D1F] tabular-nums">{siteTrends.length}</div>
          <div className="mt-1 text-xs text-[#57575A]">with completed scans</div>
        </div>
      </div>

      <div className="mb-8 rounded-xl border border-[#E5E5EA] bg-white p-5 shadow-sm">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-[#1D1D1F]">Division trend over time</h2>
            <p className="mt-1 text-xs text-[#57575A]">Latest completed scan per site, rolled up by division for each {bucket === 'month' ? 'month' : 'week'}.</p>
          </div>
          <div className="text-xs font-medium text-[#57575A]">{days === 'all' ? 'All time' : `Last ${days} days`}</div>
        </div>
        <DivisionTrendChart points={trend.points} divisions={trend.divisions} />
      </div>

      <div className="mb-8 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-[#E5E5EA] bg-white p-5 shadow-sm">
          <h2 className="text-base font-semibold text-[#1D1D1F]">Best movement</h2>
          <div className="mt-4 space-y-3">
            {siteTrends.filter(site => site.delta < 0).slice(0, 3).map(site => (
              <div key={site.siteId} className="flex items-center justify-between rounded-lg bg-emerald-50 px-3 py-2">
                <Link href={`/sites/${site.siteId}`} className="text-sm font-semibold text-emerald-800 hover:underline">{site.siteName}</Link>
                <span className="text-sm font-bold text-emerald-700">{Math.abs(site.delta)} resolved</span>
              </div>
            ))}
            {siteTrends.filter(site => site.delta < 0).length === 0 && <div className="text-sm text-[#57575A]">No improving sites in this filter yet.</div>}
          </div>
        </div>
        <div className="rounded-xl border border-[#E5E5EA] bg-white p-5 shadow-sm">
          <h2 className="text-base font-semibold text-[#1D1D1F]">Needs attention</h2>
          <div className="mt-4 space-y-3">
            {[...siteTrends].filter(site => site.delta > 0).sort((a, b) => b.delta - a.delta).slice(0, 3).map(site => (
              <div key={site.siteId} className="flex items-center justify-between rounded-lg bg-red-50 px-3 py-2">
                <Link href={`/sites/${site.siteId}`} className="text-sm font-semibold text-red-800 hover:underline">{site.siteName}</Link>
                <span className="text-sm font-bold text-red-700">+{site.delta} added</span>
              </div>
            ))}
            {siteTrends.filter(site => site.delta > 0).length === 0 && <div className="text-sm text-[#57575A]">No worsening sites in this filter.</div>}
          </div>
        </div>
      </div>

      <div className="mb-8 rounded-xl border border-[#E5E5EA] bg-white shadow-sm">
        <div className="border-b border-[#E5E5EA] px-5 py-4">
          <h2 className="text-base font-semibold text-[#1D1D1F]">By division</h2>
          <p className="mt-1 text-xs text-[#57575A]">Positive deltas mean issue counts increased; negative deltas mean issues were resolved.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-[#F5F5F7]">
              <tr>
                <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-[#57575A]">Division</th>
                <th className="px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-[#57575A]">Sites</th>
                <th className="px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-[#57575A]">First scan</th>
                <th className="px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-[#57575A]">Latest</th>
                <th className="px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-[#57575A]">Net</th>
                <th className="px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-[#57575A]">Resolved</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F0F0F0]">
              {divisionSummaries.length === 0 ? (
                <tr><td colSpan={6} className="px-5 py-8 text-center text-sm text-[#57575A]">No completed scans found for this filter.</td></tr>
              ) : divisionSummaries.map(row => {
                const status = statusCopy(row.delta)
                return (
                  <tr key={row.division} className="hover:bg-[#F5F5F7]/60">
                    <td className="px-5 py-3 font-semibold text-[#1D1D1F]">{row.division}</td>
                    <td className="px-5 py-3 text-right tabular-nums text-[#3A3A3C]">{row.sites}</td>
                    <td className="px-5 py-3 text-right tabular-nums text-[#3A3A3C]">{row.firstIssues}</td>
                    <td className="px-5 py-3 text-right tabular-nums text-[#3A3A3C]">{row.latestIssues}</td>
                    <td className="px-5 py-3 text-right"><span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${status.className}`}>{formatSignedDelta(row.delta)}</span></td>
                    <td className="px-5 py-3 text-right tabular-nums font-semibold text-emerald-700">{row.resolved}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-xl border border-[#E5E5EA] bg-white shadow-sm">
        <div className="border-b border-[#E5E5EA] px-5 py-4">
          <h2 className="text-base font-semibold text-[#1D1D1F]">Site movement since first scan</h2>
          <p className="mt-1 text-xs text-[#57575A]">Sorted by best improvement first, then by site name.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-[#F5F5F7]">
              <tr>
                <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-[#57575A]">Site</th>
                <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-[#57575A]">Division</th>
                <th className="px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-[#57575A]">First scan</th>
                <th className="px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-[#57575A]">Latest scan</th>
                <th className="px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-[#57575A]">Net</th>
                <th className="px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-[#57575A]">Resolved</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F0F0F0]">
              {siteTrends.length === 0 ? (
                <tr><td colSpan={6} className="px-5 py-8 text-center text-sm text-[#57575A]">No completed scans found for this filter.</td></tr>
              ) : siteTrends.map(site => {
                const status = statusCopy(site.delta)
                return (
                  <tr key={site.siteId} className="hover:bg-[#F5F5F7]/60">
                    <td className="px-5 py-3">
                      <Link href={`/sites/${site.siteId}`} className="font-semibold text-[#007AFF] hover:underline">{site.siteName}</Link>
                      <div className="mt-0.5 text-xs text-[#57575A]">{formatDate(site.firstStartedAt)} → {formatDate(site.latestStartedAt)}</div>
                    </td>
                    <td className="px-5 py-3 text-[#3A3A3C]">{site.division}</td>
                    <td className="px-5 py-3 text-right tabular-nums text-[#3A3A3C]">{site.firstIssues}</td>
                    <td className="px-5 py-3 text-right tabular-nums text-[#3A3A3C]">{site.latestIssues}</td>
                    <td className="px-5 py-3 text-right"><span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${status.className}`}>{formatSignedDelta(site.delta)}</span></td>
                    <td className="px-5 py-3 text-right tabular-nums font-semibold text-emerald-700">{site.resolved}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
