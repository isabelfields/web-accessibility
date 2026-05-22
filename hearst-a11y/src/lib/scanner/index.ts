import { ScanJob } from '@/types'
import { crawlAndScan } from './crawler'
import { deduplicateAndFix } from './deduplicator'

/**
 * Full scan pipeline:
 * 1. Crawl site (BFS, max 50 pages, skip near-dupes)
 * 2. Deduplicate violations across all pages
 * 3. Apply known fixes (free) or call Claude (batched, stripped)
 * 4. Return complete ScanJob result
 */
export async function runScan(
  jobId: string,
  rootUrl: string,
  onProgress?: (update: Partial<ScanJob>) => void
): Promise<ScanJob> {
  const startedAt = new Date().toISOString()

  onProgress?.({ status: 'running', startedAt })

  // Phase 1: Crawl
  const { results, pagesScanned, pagesSkipped } = await crawlAndScan(rootUrl)

  onProgress?.({
    pagesScanned,
    pagesSkipped,
    totalPages: results.length,
  })

  // Phase 2: Deduplicate + fix
  const scannedResults = results.filter(r => !r.skipped)
  const pageViolations = scannedResults.map(r => ({
    url: r.url,
    violations: r.violations,
  }))

  const rawViolationCount = pageViolations.reduce(
    (sum, p) => sum + p.violations.length, 0
  )

  const { patterns, claudeCallCount, estimatedCostUsd } =
    await deduplicateAndFix(pageViolations)

  const completedAt = new Date().toISOString()

  return {
    id: jobId,
    rootUrl,
    status: 'complete',
    pagesScanned,
    pagesSkipped,
    totalPages: results.length,
    patterns,
    rawViolationCount,
    uniquePatternCount: patterns.length,
    claudeCallCount,
    estimatedCostUsd,
    startedAt,
    completedAt,
  }
}
