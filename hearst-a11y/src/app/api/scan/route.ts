import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { sql } from '@/lib/db'
import { startScan } from '@/lib/scan-job'
import { getSessionUser, canAccessDivision, type SessionUser } from '@/lib/auth-helpers'
import { assertPublicUrl, UrlNotAllowedError } from '@/lib/net/url-guard'
import { rateLimit } from '@/lib/rate-limit'
import { SCAN_LIMITS } from '@/lib/constants'

const RequestSchema = z.object({
  url: z.string().url().optional(),
  siteId: z.string().uuid().optional(),
  scheduleId: z.string().uuid().optional(),
}).refine(data => data.url || data.siteId, {
  message: 'Either url or siteId is required',
})

// Restricted = a non-admin who has an explicit division allowlist. Admins and
// users with no restriction see everything (mirrors GET /api/sites).
function isRestricted(user: SessionUser): boolean {
  return user.role !== 'admin' && (user.allowedDivisions?.length ?? 0) > 0
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Soft per-user burst limit (best-effort, in-memory).
  if (user.id && !rateLimit(`scan:${user.id}`, SCAN_LIMITS.PER_USER_MAX, SCAN_LIMITS.PER_USER_WINDOW_MS)) {
    return NextResponse.json({ error: 'Too many scans — please wait a few minutes.' }, { status: 429 })
  }

  // Hard global concurrency cap (DB-backed) to bound paid Browserless/OpenAI usage.
  const [{ active }] = await sql`
    SELECT COUNT(*)::int AS active FROM scan_jobs
    WHERE status IN ('queued', 'running') AND started_at > NOW() - INTERVAL '15 minutes'
  `
  if (active >= SCAN_LIMITS.MAX_CONCURRENT) {
    return NextResponse.json({ error: 'Too many scans running right now — try again shortly.' }, { status: 429 })
  }

  const body = await req.json()
  const parsed = RequestSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  // Scanning a registered site is limited to users who can access its division.
  // Ad-hoc URL scans have no division owner and are open to any signed-in user.
  if (parsed.data.siteId) {
    const [site] = await sql`SELECT division FROM sites WHERE id = ${parsed.data.siteId}`
    if (!site || !canAccessDivision(user, site.division)) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
  }

  // SSRF guard: validate an ad-hoc URL before kicking off a scan.
  if (parsed.data.url) {
    try {
      await assertPublicUrl(parsed.data.url)
    } catch (e) {
      if (e instanceof UrlNotAllowedError) {
        return NextResponse.json({ error: e.message }, { status: 400 })
      }
      throw e
    }
  }

  // Run scan synchronously within the request (Vercel kills background work after response)
  const result = await startScan(parsed.data)

  if (!result.ok) {
    if (result.status === 'not_found') {
      return NextResponse.json({ error: result.error }, { status: 404 })
    }
    return NextResponse.json({ jobId: result.jobId, status: 'failed' }, { status: 500 })
  }

  return NextResponse.json({ jobId: result.jobId, status: result.status })
}

export async function GET(req: NextRequest) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const jobId = searchParams.get('jobId')

  if (jobId) {
    const [job] = await sql`
      SELECT j.*, s.division AS site_division
      FROM scan_jobs j LEFT JOIN sites s ON s.id = j.site_id
      WHERE j.id = ${jobId}
    `
    // 404 (not 403) for jobs outside the caller's divisions, to avoid leaking existence.
    if (!job || (job.site_id && !canAccessDivision(user, job.site_division))) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    delete job.site_division
    return NextResponse.json(job)
  }

  // List recent scans, scoped to the caller's divisions (ad-hoc scans have no
  // division owner and are visible to any signed-in user).
  const allowed = user.allowedDivisions ?? []
  const jobs = isRestricted(user)
    ? await sql`
        SELECT j.id, j.root_url, j.site_id, j.status, j.score, j.pages_scanned, j.pages_skipped,
               j.raw_violation_count, j.unique_pattern_count, j.estimated_cost_usd,
               j.started_at, j.completed_at, j.triggered_by
        FROM scan_jobs j LEFT JOIN sites s ON s.id = j.site_id
        WHERE j.site_id IS NULL OR s.division = ANY(${allowed}::text[])
        ORDER BY j.started_at DESC
        LIMIT 50
      `
    : await sql`
        SELECT id, root_url, site_id, status, score, pages_scanned, pages_skipped,
               raw_violation_count, unique_pattern_count, estimated_cost_usd,
               started_at, completed_at, triggered_by
        FROM scan_jobs
        ORDER BY started_at DESC
        LIMIT 50
      `
  return NextResponse.json(jobs)
}

export async function DELETE(req: NextRequest) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const jobId = searchParams.get('jobId')
  if (!jobId) return NextResponse.json({ error: 'Missing jobId' }, { status: 400 })

  // Scope cancellation to the job's parent-site division (ad-hoc scans are open).
  const [job] = await sql`
    SELECT s.division AS division, j.site_id AS site_id
    FROM scan_jobs j LEFT JOIN sites s ON s.id = j.site_id
    WHERE j.id = ${jobId}
  `
  if (!job) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (job.site_id && !canAccessDivision(user, job.division)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  await sql`
    UPDATE scan_jobs SET status = 'cancelled', completed_at = NOW()
    WHERE id = ${jobId} AND status IN ('queued', 'running')
  `
  return NextResponse.json({ cancelled: true })
}
