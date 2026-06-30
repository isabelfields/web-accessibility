import { NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { requireAdmin } from '@/lib/auth-helpers'

export const dynamic = 'force-dynamic'

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

export async function GET() {
  // Admin-only: this endpoint exposes database contents.
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const results: Record<string, unknown> = {}

  // Don't leak stack traces — return only the step and message.
  try {
    results.db_sites = await sql`SELECT COUNT(*) FROM sites`
  } catch (e) {
    return NextResponse.json({ step: 'db_sites', error: errorMessage(e) })
  }

  try {
    results.db_scans = await sql`SELECT COUNT(*) FROM scan_jobs`
  } catch (e) {
    return NextResponse.json({ step: 'db_scans', error: errorMessage(e) })
  }

  try {
    results.db_patterns = await sql`
      SELECT id, patterns IS NOT NULL as has_patterns FROM scan_jobs LIMIT 1
    `
  } catch (e) {
    return NextResponse.json({ step: 'db_patterns', error: errorMessage(e) })
  }

  try {
    results.db_site_scan = await sql`
      SELECT sj.status, sj.started_at, sj.unique_pattern_count, sj.raw_violation_count,
             COALESCE(sj.patterns, '[]'::jsonb) as patterns
      FROM scan_jobs sj
      ORDER BY sj.started_at DESC LIMIT 1
    `
  } catch (e) {
    return NextResponse.json({ step: 'db_site_scan', error: errorMessage(e) })
  }

  return NextResponse.json({ ok: true, results })
}
