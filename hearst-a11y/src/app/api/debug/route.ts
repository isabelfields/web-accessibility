import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/auth'
import { sql } from '@/lib/db/index'

export const dynamic = 'force-dynamic'

export async function GET() {
  // Admin-only: this endpoint exposes database contents.
  const session = await getServerSession(authOptions)
  if (session?.user?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const results: Record<string, unknown> = {}

  // Don't leak stack traces — return only the step and message.
  try {
    results.db_sites = await sql`SELECT COUNT(*) FROM sites`
  } catch (e: any) {
    return NextResponse.json({ step: 'db_sites', error: e?.message })
  }

  try {
    results.db_scans = await sql`SELECT COUNT(*) FROM scan_jobs`
  } catch (e: any) {
    return NextResponse.json({ step: 'db_scans', error: e?.message })
  }

  try {
    results.db_patterns = await sql`
      SELECT id, patterns IS NOT NULL as has_patterns FROM scan_jobs LIMIT 1
    `
  } catch (e: any) {
    return NextResponse.json({ step: 'db_patterns', error: e?.message })
  }

  try {
    results.db_site_scan = await sql`
      SELECT sj.status, sj.started_at, sj.unique_pattern_count, sj.raw_violation_count,
             COALESCE(sj.patterns, '[]'::jsonb) as patterns
      FROM scan_jobs sj
      ORDER BY sj.started_at DESC LIMIT 1
    `
  } catch (e: any) {
    return NextResponse.json({ step: 'db_site_scan', error: e?.message })
  }

  return NextResponse.json({ ok: true, results })
}
