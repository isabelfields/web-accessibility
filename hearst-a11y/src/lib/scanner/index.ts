import { ScanJob, SitePage, PageScanResult, RawViolation } from '@/types'
import { crawlAndScan } from './crawler'
import { deduplicateAndFix } from './deduplicator'
import { calculateScore } from '@/lib/score'

async function scanPageList(pages: SitePage[]): Promise<{
  results: PageScanResult[]
  pagesScanned: number
  pagesSkipped: number
}> {
  const { chromium } = await import('playwright')
  const AxeBuilder = (await import('@axe-core/playwright')).default

  const browser = await chromium.launch({ headless: true })
  const results: PageScanResult[] = []

  for (const page of pages) {
    try {
      const ctx = await browser.newContext()
      const pw = await ctx.newPage()
      await pw.goto(page.url, { waitUntil: 'networkidle', timeout: 30000 })
      const results_axe = await new AxeBuilder({ page: pw })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
        .analyze()
      const violations = results_axe.violations
      results.push({
        url: page.url,
        domFingerprint: '',
        violations: violations as unknown as RawViolation[],
        scannedAt: new Date().toISOString(),
        skipped: false,
      })
      await ctx.close()
    } catch (err) {
      results.push({
        url: page.url,
        domFingerprint: '',
        violations: [],
        scannedAt: new Date().toISOString(),
        skipped: true,
        skippedReason: err instanceof Error ? err.message : 'Unknown error',
      })
    }
  }

  await browser.close()
  return {
    results,
    pagesScanned: results.filter(r => !r.skipped).length,
    pagesSkipped: results.filter(r => r.skipped).length,
  }
}

/**
 * Full scan pipeline:
 * 1. Crawl site (BFS, max 50 pages, skip near-dupes) OR scan explicit page list
 * 2. Deduplicate violations across all pages
 * 3. Apply known fixes (free) or call Claude (batched, stripped)
 * 4. Return complete ScanJob result
 */
export async function runScan(
  jobId: string,
  rootUrl: string,
  onProgress?: (update: Partial<ScanJob>) => void,
  pages?: SitePage[]
): Promise<ScanJob> {
  const startedAt = new Date().toISOString()

  onProgress?.({ status: 'running', startedAt })

  // Phase 1: Crawl or scan explicit pages
  const { results, pagesScanned, pagesSkipped } = pages
    ? await scanPageList(pages)
    : await crawlAndScan(rootUrl)

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
    (sum, p) => sum + p.violations.length,
    0
  )

  const { patterns, claudeCallCount, estimatedCostUsd } =
    await deduplicateAndFix(pageViolations)

  const score = calculateScore(patterns)
  const completedAt = new Date().toISOString()

  return {
    id: jobId,
    rootUrl,
    status: 'complete',
    score,
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
