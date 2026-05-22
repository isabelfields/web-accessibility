import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { neon } from '@neondatabase/serverless'
import { runScan } from '@/lib/scanner'

const RequestSchema = z.object({
  url: z.string().url(),
  scheduleId: z.string().uuid().optional(),
})

export async function POST(req: NextRequest) {
  const body = await req.json()
  const parsed = RequestSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid URL' }, { status: 400 })
  }

  const { url, scheduleId } = parsed.data
  const sql = neon(process.env.DATABASE_URL!)

  // Create the job record
  const [job] = await sql`
    INSERT INTO scan_jobs (root_url, status, triggered_by, schedule_id)
    VALUES (${url}, 'queued', ${scheduleId ? 'schedule' : 'manual'}, ${scheduleId ?? null})
    RETURNING id
  `

  const jobId = job.id

  // Run scan async (in production this would be a queue worker)
  // For Vercel, use background functions or an external queue
  runScan(jobId, url, async (update) => {
    const sets: string[] = []
    const values: unknown[] = []
    let i = 1

    if (update.status) { sets.push(`status = $${i++}`); values.push(update.status) }
    if (update.pagesScanned !== undefined) { sets.push(`pages_scanned = $${i++}`); values.push(update.pagesScanned) }
    if (update.pagesSkipped !== undefined) { sets.push(`pages_skipped = $${i++}`); values.push(update.pagesSkipped) }

    if (sets.length > 0) {
      await sql`UPDATE scan_jobs SET ${sql.unsafe(sets.join(', '))} WHERE id = ${jobId}`
    }
  }).then(async (result) => {
    await sql`
      UPDATE scan_jobs SET
        status = 'complete',
        pages_scanned = ${result.pagesScanned},
        pages_skipped = ${result.pagesSkipped},
        total_pages = ${result.totalPages},
        raw_violation_count = ${result.rawViolationCount},
        unique_pattern_count = ${result.uniquePatternCount},
        claude_call_count = ${result.claudeCallCount},
        estimated_cost_usd = ${result.estimatedCostUsd},
        patterns = ${JSON.stringify(result.patterns)},
        completed_at = NOW()
      WHERE id = ${jobId}
    `
  }).catch(async (err) => {
    await sql`
      UPDATE scan_jobs SET status = 'failed', error = ${err.message} WHERE id = ${jobId}
    `
  })

  return NextResponse.json({ jobId, status: 'queued' }, { status: 202 })
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const jobId = searchParams.get('jobId')
  const sql = neon(process.env.DATABASE_URL!)

  if (jobId) {
    const [job] = await sql`SELECT * FROM scan_jobs WHERE id = ${jobId}`
    if (!job) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(job)
  }

  // List recent scans
  const jobs = await sql`
    SELECT id, root_url, status, pages_scanned, pages_skipped,
           raw_violation_count, unique_pattern_count, estimated_cost_usd,
           started_at, completed_at, triggered_by
    FROM scan_jobs
    ORDER BY started_at DESC
    LIMIT 50
  `
  return NextResponse.json(jobs)
}
