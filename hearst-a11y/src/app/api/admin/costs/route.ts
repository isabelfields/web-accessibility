import { NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { requireAdmin } from '@/lib/auth-helpers'

export async function GET() {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Total spend and calls all-time
  const [totals] = await sql`
    SELECT
      COALESCE(SUM(estimated_cost_usd), 0) AS total_cost,
      COALESCE(SUM(claude_call_count), 0)  AS total_calls,
      COUNT(*) FILTER (WHERE status = 'complete') AS total_scans
    FROM scan_jobs
  `

  // Monthly spend (last 12 months)
  const monthly = await sql`
    SELECT
      TO_CHAR(DATE_TRUNC('month', started_at), 'YYYY-MM') AS month,
      COALESCE(SUM(estimated_cost_usd), 0)                AS cost,
      COALESCE(SUM(claude_call_count), 0)                 AS calls,
      COUNT(*) FILTER (WHERE status = 'complete')         AS scans
    FROM scan_jobs
    WHERE started_at >= NOW() - INTERVAL '12 months'
    GROUP BY 1
    ORDER BY 1
  `

  // Per-site spend (top 20)
  const bySite = await sql`
    SELECT
      s.name                                              AS site_name,
      s.division,
      COALESCE(SUM(j.estimated_cost_usd), 0)             AS cost,
      COALESCE(SUM(j.claude_call_count), 0)              AS calls,
      COUNT(*) FILTER (WHERE j.status = 'complete')      AS scans
    FROM scan_jobs j
    LEFT JOIN sites s ON s.id = j.site_id
    GROUP BY s.id, s.name, s.division
    ORDER BY cost DESC
    LIMIT 20
  `

  // Per-division spend
  const byDivision = await sql`
    SELECT
      COALESCE(s.division, 'Unassigned')                 AS division,
      COALESCE(SUM(j.estimated_cost_usd), 0)             AS cost,
      COALESCE(SUM(j.claude_call_count), 0)              AS calls,
      COUNT(*) FILTER (WHERE j.status = 'complete')      AS scans
    FROM scan_jobs j
    LEFT JOIN sites s ON s.id = j.site_id
    GROUP BY 1
    ORDER BY cost DESC
  `

  return NextResponse.json({ totals, monthly, bySite, byDivision })
}
