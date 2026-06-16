import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { sql } from '@/lib/db'
import { startScan } from '@/lib/scan-job'

const RequestSchema = z.object({
  url: z.string().url().optional(),
  siteId: z.string().uuid().optional(),
  scheduleId: z.string().uuid().optional(),
}).refine(data => data.url || data.siteId, {
  message: 'Either url or siteId is required',
})

export async function POST(req: NextRequest) {
  const body = await req.json()
  const parsed = RequestSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
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
  const { searchParams } = new URL(req.url)
  const jobId = searchParams.get('jobId')

  if (jobId) {
    const [job] = await sql`SELECT * FROM scan_jobs WHERE id = ${jobId}`
    if (!job) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(job)
  }

  // List recent scans
  const jobs = await sql`
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
  const { searchParams } = new URL(req.url)
  const jobId = searchParams.get('jobId')
  if (!jobId) return NextResponse.json({ error: 'Missing jobId' }, { status: 400 })

  await sql`
    UPDATE scan_jobs SET status = 'cancelled', completed_at = NOW()
    WHERE id = ${jobId} AND status IN ('queued', 'running')
  `
  return NextResponse.json({ cancelled: true })
}
