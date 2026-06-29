import { ScanJob, SitePage, PageScanResult, RawViolation, PageScore, ScanProgress } from '@/types'
import { crawlAndScan } from './crawler'
import { deduplicateAndFix } from './deduplicator'
import { calculateScore, impactDeduction, isBestPractice } from '@/lib/score'
import { runKeyboardCheck } from './keyboard'
import { assertPublicUrl } from '@/lib/net/url-guard'
import { AXE_TAGS, browserlessWsEndpoint } from '@/lib/constants'
import { ScanCancelledError, ScanCancellationCheck, throwIfScanCancelled } from './cancel'

async function scanPageList(pages: SitePage[], onProgress?: (progress: ScanProgress) => void, shouldCancel?: ScanCancellationCheck): Promise<{
  results: PageScanResult[]
  pageScores: PageScore[]
  pagesScanned: number
  pagesSkipped: number
}> {
  const { chromium } = await import('playwright')
  const AxeBuilder = (await import('@axe-core/playwright')).default

  let browser = await chromium.connectOverCDP(browserlessWsEndpoint())
  const results: PageScanResult[] = []
  const pageScores: PageScore[] = []

  async function scanOnePage(page: SitePage, retry = false): Promise<{ pageScore: PageScore; result: PageScanResult }> {
    let ctx: Awaited<ReturnType<typeof browser.newContext>> | undefined
    try {
      // SSRF guard: never render a non-public target, even from stored sites/schedules.
      await assertPublicUrl(page.url)
      ctx = await browser.newContext()
      const pw = await ctx.newPage()
      await pw.goto(page.url, { waitUntil: 'domcontentloaded', timeout: 20000 })

      const axeResults = await new AxeBuilder({ page: pw })
        .withTags(AXE_TAGS)
        .analyze()

      // Include incomplete contrast results — axe can't compute ratio when CSS vars are used
      const contrastIncomplete = (axeResults.incomplete ?? [])
        .filter((r: any) => r.id === 'color-contrast')
        .map((r: any) => ({ ...r, impact: r.impact ?? 'serious' }))

      const keyboardViolations = await runKeyboardCheck(pw)

      const violations = [
        ...axeResults.violations,
        ...contrastIncomplete,
        ...keyboardViolations,
      ] as unknown as RawViolation[]

      for (const violation of violations) {
        const firstTarget = violation.nodes[0]?.target?.[0]
        if (firstTarget && typeof firstTarget === 'string') {
          try {
            const el = pw.locator(firstTarget).first()
            const box = await el.boundingBox()
            if (box && box.width > 0 && box.height > 0) {
              const shot = await el.screenshot({ type: 'jpeg', quality: 65 })
              const b64 = shot.toString('base64')
              if (b64.length < 60000) {
                violation.sampleScreenshot = b64
              }
            }
          } catch { /* silently skip — element may not be findable */ }
        }
      }

      // Same formula as calculateScore so page scores are comparable to the
      // overall score — best-practice rules don't count toward the WCAG score.
      let pagePenalty = 0
      for (const v of violations) {
        if (isBestPractice(v.tags)) continue
        pagePenalty += impactDeduction(v.impact)
      }
      const pageScore = Math.max(0, Math.round(100 - pagePenalty))
      const rawForScore = violations.reduce((sum, v) => sum + v.nodes.length, 0)

      await ctx?.close()
      return {
        pageScore: { url: page.url, label: page.label, score: pageScore, violationCount: rawForScore },
        result: { url: page.url, domFingerprint: '', violations, scannedAt: new Date().toISOString(), skipped: false },
      }
    } catch (err) {
      await ctx?.close().catch(() => {})
      // Reconnect and retry once if the browser connection dropped
      if (!retry && err instanceof Error && (
        err.message.includes('Target page') ||
        err.message.includes('browser has been closed') ||
        err.message.includes('newContext') ||
        err.message.includes('context or browser')
      )) {
        try { await browser.close() } catch { /* ignore */ }
        browser = await chromium.connectOverCDP(browserlessWsEndpoint())
        return scanOnePage(page, true)
      }
      throw err
    }
  }

  try {
    for (const [index, page] of pages.entries()) {
      await throwIfScanCancelled(shouldCancel)
      onProgress?.({
        phase: 'scanning',
        message: `Scanning ${page.label || page.url}`,
        currentUrl: page.url,
        currentPage: index,
        totalPages: pages.length,
      })
      try {
        const { pageScore, result } = await scanOnePage(page)
        pageScores.push(pageScore)
        results.push(result)
        onProgress?.({
          phase: 'scanning',
          message: `Scanned ${index + 1} of ${pages.length} pages`,
          currentUrl: page.url,
          currentPage: index + 1,
          totalPages: pages.length,
        })
      } catch (err) {
        if (err instanceof ScanCancelledError) throw err
        const errorMsg = err instanceof Error ? err.message : String(err)
        console.error(`[scanner] Failed to scan ${page.url}:`, errorMsg)
        pageScores.push({
          url: page.url,
          label: page.label,
          score: null,
          violationCount: null,
          error: errorMsg,
        })
        results.push({
          url: page.url,
          domFingerprint: '',
          violations: [],
          scannedAt: new Date().toISOString(),
          skipped: true,
          skippedReason: errorMsg,
        })
        onProgress?.({
          phase: 'scanning',
          message: `Skipped ${index + 1} of ${pages.length} pages`,
          currentUrl: page.url,
          currentPage: index + 1,
          totalPages: pages.length,
        })
      }
    }
  } finally {
    await browser.close()
  }

  return {
    results,
    pageScores,
    pagesScanned: results.filter(r => !r.skipped).length,
    pagesSkipped: results.filter(r => r.skipped).length,
  }
}

export async function runScan(
  jobId: string,
  rootUrl: string,
  onProgress?: (update: Partial<ScanJob>) => void,
  pages?: SitePage[],
  crawl = false,
  shouldCancel?: ScanCancellationCheck
): Promise<ScanJob> {
  const startedAt = new Date().toISOString()
  await throwIfScanCancelled(shouldCancel)
  onProgress?.({ status: 'running', startedAt, progress: { phase: 'starting', message: 'Starting scan…' } })

  let pageScores: PageScore[] = []
  let results: PageScanResult[]
  let pagesScanned: number
  let pagesSkipped: number

  if (crawl) {
    // Discover pages by crawling (seeded from sitemap.xml), capped to keep cost down.
    onProgress?.({ progress: { phase: 'crawling', message: 'Discovering pages from sitemap and links…' } })
    const out = await crawlAndScan(rootUrl, shouldCancel)
    results = out.results
    pagesScanned = out.pagesScanned
    pagesSkipped = out.pagesSkipped
  } else {
    // Scan exactly the given pages — the configured site pages, or just the root URL.
    const list: SitePage[] = pages && pages.length > 0
      ? pages
      : [{ url: rootUrl, label: rootUrl, templateType: 'other' }]
    const out = await scanPageList(list, (progress) => {
      onProgress?.({
        progress,
        pagesScanned: progress.currentPage,
        totalPages: progress.totalPages,
      })
    }, shouldCancel)
    results = out.results
    pageScores = out.pageScores
    pagesScanned = out.pagesScanned
    pagesSkipped = out.pagesSkipped
  }

  await throwIfScanCancelled(shouldCancel)
  onProgress?.({ pagesScanned, pagesSkipped, totalPages: results.length, progress: { phase: 'analyzing', message: 'Analyzing issue patterns…', currentPage: pagesScanned, totalPages: results.length } })

  const scannedResults = results.filter(r => !r.skipped)
  const pageViolations = scannedResults.map(r => ({
    url: r.url,
    violations: r.violations,
  }))

  const { patterns, claudeCallCount, estimatedCostUsd } = await deduplicateAndFix(pageViolations)
  await throwIfScanCancelled(shouldCancel)
  onProgress?.({ progress: { phase: 'saving', message: 'Saving scan results…', currentPage: pagesScanned, totalPages: results.length } })

  // raw_violation_count = total failing elements (Σ occurrences across patterns),
  // matching the "Total Violations" figure shown on the scan detail page.
  const rawViolationCount = patterns.reduce((sum, p) => sum + p.occurrences, 0)

  // Attach sampleHtml and sampleScreenshot to each pattern
  const violationsByRule = new Map<string, { html: string; screenshot?: string }>()
  for (const { violations } of pageViolations) {
    for (const v of violations) {
      if (!violationsByRule.has(v.id)) {
        violationsByRule.set(v.id, {
          html: v.nodes[0]?.html ?? '',
          screenshot: v.sampleScreenshot,
        })
      }
    }
  }

  for (const pattern of patterns) {
    const ruleId = pattern.fingerprint.split('::')[0]
    const match = violationsByRule.get(ruleId)
    if (match) {
      pattern.sampleHtml = match.html
      pattern.sampleScreenshot = match.screenshot
    }
  }

  const score = calculateScore(patterns)
  const completedAt = new Date().toISOString()

  return {
    id: jobId,
    rootUrl,
    status: 'complete',
    score,
    pageScores,
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
    progress: { phase: 'complete', message: 'Scan complete', currentPage: pagesScanned, totalPages: results.length },
  }
}
