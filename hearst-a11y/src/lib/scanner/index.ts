import { ScanJob, SitePage, PageScanResult, RawViolation, PageScore } from '@/types'
import { crawlAndScan } from './crawler'
import { deduplicateAndFix } from './deduplicator'
import { calculateScore } from '@/lib/score'

async function scanPageList(pages: SitePage[]): Promise<{
  results: PageScanResult[]
  pageScores: PageScore[]
  pagesScanned: number
  pagesSkipped: number
}> {
  const { chromium } = await import('playwright')
  const AxeBuilder = (await import('@axe-core/playwright')).default

  const wsEndpoint = `wss://chrome.browserless.io?token=${process.env.BROWSERLESS_TOKEN}`
  const browser = await chromium.connectOverCDP(wsEndpoint)
  const results: PageScanResult[] = []
  const pageScores: PageScore[] = []

  for (const page of pages) {
    try {
      const ctx = await browser.newContext()
      const pw = await ctx.newPage()
      await pw.goto(page.url, { waitUntil: 'domcontentloaded', timeout: 20000 })

      const axeResults = await new AxeBuilder({ page: pw })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'])
        .analyze()

      const violations = axeResults.violations as unknown as RawViolation[]

      // Take element screenshots for the first node of each violation
      for (const violation of violations) {
        const firstTarget = violation.nodes[0]?.target?.[0]
        if (firstTarget && typeof firstTarget === 'string') {
          try {
            const el = pw.locator(firstTarget).first()
            const box = await el.boundingBox()
            if (box && box.width > 0 && box.height > 0) {
              const shot = await el.screenshot({ type: 'jpeg', quality: 65 })
              const b64 = shot.toString('base64')
              if (b64.length < 60000) { // skip if > ~45KB
                ;(violation as any).sampleScreenshot = b64
              }
            }
          } catch {
            // silently skip — element may not be findable
          }
        }
      }

      // Per-page score
      const pageViolationsForScore = violations.map(v => ({
        url: page.url,
        violations: [v],
      }))
      const rawForScore = violations.reduce((sum, v) => sum + v.nodes.length, 0)
      // Quick score: use violation count by impact directly
      let pagePenalty = 0
      for (const v of violations) {
        const count = v.nodes.length
        if (v.impact === 'critical') pagePenalty += 8 * count
        else if (v.impact === 'serious') pagePenalty += 5 * count
        else if (v.impact === 'moderate') pagePenalty += 2 * count
        else pagePenalty += 0.5 * count
      }
      const pageScore = Math.max(0, Math.round(100 - pagePenalty))

      pageScores.push({
        url: page.url,
        label: page.label,
        score: pageScore,
        violationCount: rawForScore,
      })

      results.push({
        url: page.url,
        domFingerprint: '',
        violations,
        scannedAt: new Date().toISOString(),
        skipped: false,
      })
      await ctx.close()
    } catch (err) {
      pageScores.push({
        url: page.url,
        label: page.label,
        score: null as any,
        violationCount: null as any,
      })
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
    pageScores,
    pagesScanned: results.filter(r => !r.skipped).length,
    pagesSkipped: results.filter(r => r.skipped).length,
  }
}

export async function runScan(
  jobId: string,
  rootUrl: string,
  onProgress?: (update: Partial<ScanJob>) => void,
  pages?: SitePage[]
): Promise<ScanJob> {
  const startedAt = new Date().toISOString()
  onProgress?.({ status: 'running', startedAt })

  let pageScores: PageScore[] = []
  let results: PageScanResult[]
  let pagesScanned: number
  let pagesSkipped: number

  if (pages) {
    const out = await scanPageList(pages)
    results = out.results
    pageScores = out.pageScores
    pagesScanned = out.pagesScanned
    pagesSkipped = out.pagesSkipped
  } else {
    const out = await crawlAndScan(rootUrl)
    results = out.results
    pagesScanned = out.pagesScanned
    pagesSkipped = out.pagesSkipped
  }

  onProgress?.({ pagesScanned, pagesSkipped, totalPages: results.length })

  const scannedResults = results.filter(r => !r.skipped)
  const pageViolations = scannedResults.map(r => ({
    url: r.url,
    violations: r.violations,
  }))

  const rawViolationCount = pageViolations.reduce((sum, p) => sum + p.violations.length, 0)

  const { patterns, claudeCallCount, estimatedCostUsd } = await deduplicateAndFix(pageViolations)

  // Attach sampleHtml and sampleScreenshot to each pattern
  const violationsByFingerprint = new Map<string, { html: string; screenshot?: string }>()
  for (const { violations } of pageViolations) {
    for (const v of violations) {
      const fp = `${v.id}::${v.nodes[0]?.target?.[0] ?? ''}`
      if (!violationsByFingerprint.has(v.id)) {
        violationsByFingerprint.set(v.id, {
          html: v.nodes[0]?.html ?? '',
          screenshot: (v as any).sampleScreenshot,
        })
      }
    }
  }

  for (const pattern of patterns) {
    const ruleId = pattern.fingerprint.split('::')[0]
    const match = violationsByFingerprint.get(ruleId)
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
  }
}
