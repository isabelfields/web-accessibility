import { sql } from '@/lib/db'
import { runScan } from '@/lib/scanner'
import { ScanCancelledError } from '@/lib/scanner/cancel'
import { ScanProgress, SitePage } from '@/types'

export interface StartScanInput {
  url?: string
  siteId?: string
  scheduleId?: string
  /** Follow links / sitemap to discover pages. Defaults to page-list scanning
   *  when a site's pages are available, crawl otherwise (back-compat). */
  crawl?: boolean
}

export type StartScanResult =
  | { ok: true; jobId: string; status: 'complete' | 'cancelled' }
  | { ok: false; jobId?: string; status: 'failed' | 'not_found'; error: string }

/**
 * Creates a scan_jobs record and runs the scan synchronously, persisting the
 * result. Shared by the /api/scan POST handler and the cron job so scheduled
 * scans run in-process instead of via an authenticated HTTP round-trip.
 */
function scanProgress(phase: ScanProgress['phase'], message: string, extra: Partial<ScanProgress> = {}): ScanProgress {
  return { phase, message, ...extra }
}

export async function startScan(input: StartScanInput): Promise<StartScanResult> {
  const { url, siteId, scheduleId, crawl } = input

  let rootUrl = url ?? ''
  let pages: SitePage[] | undefined

  if (siteId) {
    const [site] = await sql`SELECT * FROM sites WHERE id = ${siteId}`
    if (!site) return { ok: false, status: 'not_found', error: 'Site not found' }
    rootUrl = (site.pages as SitePage[])[0]?.url ?? rootUrl
    pages = site.pages as SitePage[]
  }

  // Honor an explicit toggle; otherwise preserve prior behavior: crawl when
  // there's no configured page list (ad-hoc URL / schedule), page-list otherwise.
  const shouldCrawl = crawl ?? (pages == null || pages.length === 0)

  const queuedProgress = scanProgress('queued', 'Queued scan…')

  // Create the job record
  const [job] = await sql`
    INSERT INTO scan_jobs (root_url, status, triggered_by, schedule_id, site_id, progress)
    VALUES (${rootUrl}, 'queued', ${scheduleId ? 'schedule' : 'manual'}, ${scheduleId ?? null}, ${siteId ?? null}, ${JSON.stringify(queuedProgress)})
    RETURNING id
  `

  const jobId = job.id

  try {
    const isCancelled = async () => {
      const [current] = await sql`SELECT status FROM scan_jobs WHERE id = ${jobId}`
      return current?.status === 'cancelled'
    }

    await sql`UPDATE scan_jobs SET status = 'running', progress = ${JSON.stringify(scanProgress('starting', 'Starting scan…'))} WHERE id = ${jobId}`

    const result = await runScan(jobId, rootUrl, async (update) => {
      if (update.pagesScanned !== undefined) {
        await sql`UPDATE scan_jobs SET pages_scanned = ${update.pagesScanned} WHERE id = ${jobId}`
      }
      if (update.pagesSkipped !== undefined) {
        await sql`UPDATE scan_jobs SET pages_skipped = ${update.pagesSkipped} WHERE id = ${jobId}`
      }
      if (update.totalPages !== undefined) {
        await sql`UPDATE scan_jobs SET total_pages = ${update.totalPages} WHERE id = ${jobId}`
      }
      if (update.progress !== undefined) {
        await sql`UPDATE scan_jobs SET progress = ${JSON.stringify(update.progress)} WHERE id = ${jobId}`
      }
    }, pages, shouldCrawl, isCancelled)

    // Fast path: skip the expensive write if it was already cancelled.
    const [current] = await sql`SELECT status FROM scan_jobs WHERE id = ${jobId}`
    if (current?.status === 'cancelled') {
      return { ok: true, jobId, status: 'cancelled' }
    }

    // Guard the completion write against a cancel landing in the race window
    // between the SELECT above and this UPDATE. If the row was cancelled (or
    // deleted) in the meantime, no row matches and we leave it cancelled.
    const updated = await sql`
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
        progress = ${JSON.stringify(result.progress ?? scanProgress('complete', 'Scan complete'))},
        completed_at = NOW()
      WHERE id = ${jobId} AND status <> 'cancelled'
      RETURNING id
    `
    if (updated.length === 0) {
      return { ok: true, jobId, status: 'cancelled' }
    }
    return { ok: true, jobId, status: 'complete' }
  } catch (err) {
    if (err instanceof ScanCancelledError) {
      await sql`
        UPDATE scan_jobs SET
          status = 'cancelled',
          progress = ${JSON.stringify(scanProgress('cancelled', 'Scan cancelled.'))},
          completed_at = NOW()
        WHERE id = ${jobId} AND status <> 'cancelled'
      `
      return { ok: true, jobId, status: 'cancelled' }
    }

    const message = err instanceof Error ? err.message : 'Unknown error'
    // Don't clobber a cancellation that landed before/while the scan errored.
    const failed = await sql`
      UPDATE scan_jobs SET status = 'failed', error = ${message}, progress = ${JSON.stringify(scanProgress('failed', message))}, completed_at = NOW()
      WHERE id = ${jobId} AND status <> 'cancelled'
      RETURNING id
    `
    if (failed.length === 0) {
      return { ok: true, jobId, status: 'cancelled' }
    }
    return { ok: false, jobId, status: 'failed', error: message }
  }
}
