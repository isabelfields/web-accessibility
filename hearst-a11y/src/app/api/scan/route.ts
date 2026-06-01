import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { sql } from '@/lib/db'
import { runScan } from '@/lib/scanner'
import { SitePage } from '@/types'

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

  const { url, siteId, scheduleId } = parsed.data

  let rootUrl = url ?? ''
  let pages: SitePage[] | undefined

  if (siteId) {
    const [site] = await sql`SELECT * FROM sites WHERE id = ${siteId}`
    if (!site) return NextResponse.json({ error: 'Site not found' }, { status: 404 })
    rootUrl = (site.pages as SitePage[])[0]?.url ?? rootUrl
    pages = site.pages as SitePage[]
  }

  // Create the job record
  const [job] = await sql`
    INSERT INTO scan_jobs (root_url, status, triggered_by, schedule_id, site_id)
    VALUES (${rootUrl}, 'queued', ${scheduleId ? 'schedule' : 'manual'}, ${scheduleId ?? null}, ${siteId ?? null})
    RETURNING id
  `

  const jobId = job.id

  // Run scan async
  runScan(jobId, rootUrl, async (update) => {
    const sets: string[] = []
    const values: unknown[] = []
    let i = 1

    if (update.status) { sets.push(`status = $${i++}`); values.push(update.status) }
    if (update.pagesScanned !== undefined) { sets.push(`pages_scanned = $${i++}`); values.push(update.pagesScanned) }
    if (update.pagesSkipped !== undefined) { sets.push(`pages_skipped = $${i++}`); values.push(update.pagesSkipped) }

    if (sets.length > 0) {
      await sql`UPDATE scan_jobs SET ${sql.unsafe(sets.join(', '))} WHERE id = ${jobId}`
    }
  }, pages).then(async (result) => {
    await sql`
      UPDATE scan_jobs SET
        status = 'complete',
        score = ${result.score},
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
