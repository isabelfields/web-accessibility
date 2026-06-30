import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { requireAdmin } from '@/lib/auth-helpers'
import { countOccurrences, formatSignedDelta, isWcagPattern } from '@/lib/metrics'
import type { ViolationPattern } from '@/types'

type SiteRow = {
  id: string
  name: string
  division: string | null
  scan_id: string | null
  started_at: string | Date | null
  patterns: ViolationPattern[] | string | null
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

function csvCell(value: string | number | null): string {
  const text = String(value ?? '')
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}

function formatDate(value: string | Date | null): string {
  if (!value) return ''
  return new Date(value).toISOString().slice(0, 10)
}

function rangeStart(value: string | null): Date | null {
  if (value !== '30' && value !== '60' && value !== '90') return null
  const start = new Date()
  start.setDate(start.getDate() - Number(value))
  start.setHours(0, 0, 0, 0)
  return start
}

export async function GET(req: NextRequest) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const selectedDivision = req.nextUrl.searchParams.get('division') || undefined
  const start = rangeStart(req.nextUrl.searchParams.get('days'))
  const rows = await sql`
    SELECT
      s.id,
      s.name,
      s.division,
      sj.id AS scan_id,
      sj.started_at,
      COALESCE(sj.patterns, '[]'::jsonb) AS patterns
    FROM sites s
    LEFT JOIN scan_jobs sj ON sj.site_id = s.id AND sj.status = 'complete'
    ORDER BY s.name ASC, sj.started_at ASC
  `

  const bySite = new Map<string, SiteRow[]>()
  for (const row of rows as SiteRow[]) {
    const division = row.division ?? 'Unassigned'
    if (selectedDivision && division !== selectedDivision) continue
    if (start && row.started_at && new Date(row.started_at) < start) continue
    if (!bySite.has(row.id)) bySite.set(row.id, [])
    bySite.get(row.id)!.push(row)
  }

  const csvRows = [[
    'Division',
    'Site',
    'First scan date',
    'Latest scan date',
    'First scan issues',
    'Latest issues',
    'Net delta',
    'Resolved',
  ]]

  for (const siteRows of bySite.values()) {
    const scans = siteRows.filter(row => row.scan_id)
    if (scans.length === 0) continue
    const first = scans[0]
    const latest = scans[scans.length - 1]
    const firstIssues = countWcagIssues(parsePatterns(first.patterns))
    const latestIssues = countWcagIssues(parsePatterns(latest.patterns))
    const delta = latestIssues - firstIssues
    csvRows.push([
      first.division ?? 'Unassigned',
      first.name,
      formatDate(first.started_at),
      formatDate(latest.started_at),
      String(firstIssues),
      String(latestIssues),
      formatSignedDelta(delta),
      String(Math.max(0, -delta)),
    ])
  }

  const body = csvRows.map(row => row.map(csvCell).join(',')).join('\n')
  return new NextResponse(body, {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="resolution-report${selectedDivision ? `-${selectedDivision}` : ''}.csv"`,
    },
  })
}
