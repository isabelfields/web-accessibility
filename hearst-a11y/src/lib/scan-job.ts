import { sql } from '@/lib/db'
import { runScan } from '@/lib/scanner'
import { SitePage } from '@/types'

export interface StartScanInput {
  url?: string
  siteId?: string
  scheduleId?: string
}

export type StartScanResult =
  | { ok: true; jobId: string; status: 'complete' | 'cancelled' }
  | { ok: false; jobId?: string; status: 'failed' | 'not_found'; error: string }

/**
 * Creates a scan_jobs record and runs the scan synchronously, persisting the
 * result. Shared by the /api/scan POST handler and the cron job so scheduled
 * scans run in-process instead of via an authenticated HTTP round-trip.
 */
export async function startScan(input: StartScanInput): Promise<StartScanResult> {
  const { url, siteId, scheduleId } = input

  let rootUrl = url ?? ''
  let pages: SitePage[] | undefined

  if (siteId) {
    const [site] = await sql`SELECT * FROM sites WHERE id = ${siteId}`
    if (!site) return { ok: false, status: 'not_found', error: 'Site not found' }
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

  try {
    await sql`UPDATE scan_jobs SET status = 'running' WHERE id = ${jobId}`

    const result = await runScan(jobId, rootUrl, async (update) => {
      if (update.pagesScanned !== undefined) {
        await sql`UPDATE scan_jobs SET pages_scanned = ${update.pagesScanned} WHERE id = ${jobId}`
      }
    }, pages)

    // Check if cancelled mid-scan
    const [current] = await sql`SELECT status FROM scan_jobs WHERE id = ${jobId}`
    if (current?.status === 'cancelled') {
      return { ok: true, jobId, status: 'cancelled' }
    }

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
        page_scores = ${JSON.stringify(result.pageScores)},
        completed_at = NOW()
      WHERE id = ${jobId}
    `
    return { ok: true, jobId, status: 'complete' }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    await sql`
      UPDATE scan_jobs SET status = 'failed', error = ${message}, completed_at = NOW()
      WHERE id = ${jobId}
    `
    return { ok: false, jobId, status: 'failed', error: message }
  }
}
