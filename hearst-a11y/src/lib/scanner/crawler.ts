import { chromium } from 'playwright'
import { PageScanResult } from '@/types'
import { computeDomFingerprint, isNearDuplicate } from './fingerprint'

const MAX_PAGES = 50
const PAGE_TIMEOUT = 30_000 // 30s per page
const SCAN_CONCURRENCY = 3  // parallel pages

/**
 * Crawls a website BFS-style up to MAX_PAGES.
 * For each page:
 * 1. Render with Playwright (full JS execution)
 * 2. Compute DOM fingerprint
 * 3. Skip if near-duplicate of a seen template (optimization 1)
 * 4. Run axe-core accessibility audit
 * 5. Extract internal links for the queue
 */
export async function crawlAndScan(rootUrl: string): Promise<{
  results: PageScanResult[]
  pagesScanned: number
  pagesSkipped: number
}> {
  const root = new URL(rootUrl)
  const origin = root.origin

  const visited = new Set<string>()
  const queue: string[] = [rootUrl]
  const seenFingerprints = new Set<string>()
  const results: PageScanResult[] = []
  let pagesSkipped = 0

  const wsEndpoint = `wss://chrome.browserless.io?token=${process.env.BROWSERLESS_TOKEN}`
  const browser = await chromium.connectOverCDP(wsEndpoint)

  try {
    while (queue.length > 0 && visited.size < MAX_PAGES) {
      // Process up to SCAN_CONCURRENCY pages at once
      const batch = queue.splice(0, SCAN_CONCURRENCY)

      await Promise.all(
        batch.map(async (url) => {
          if (visited.has(url) || visited.size >= MAX_PAGES) return
          visited.add(url)

          let context: Awaited<ReturnType<typeof browser.newContext>> | undefined
          try {
            context = await browser.newContext({
              userAgent: 'HearstA11yScanner/1.0 (+https://hearst.com/accessibility)',
            })
            const page = await context.newPage()

            await page.goto(url, {
              waitUntil: 'domcontentloaded',
              timeout: PAGE_TIMEOUT,
            })

            // Get full rendered HTML for fingerprinting
            const html = await page.content()
            const fingerprint = computeDomFingerprint(html)

            // OPTIMIZATION 1: Skip near-duplicate templates
            if (isNearDuplicate(fingerprint, seenFingerprints)) {
              pagesSkipped++
              results.push({
                url,
                domFingerprint: fingerprint,
                violations: [],
                scannedAt: new Date().toISOString(),
                skipped: true,
                skippedReason: 'Near-duplicate page template — violations would be identical to a previously scanned page.',
              })
              return
            }

            seenFingerprints.add(fingerprint)

            // Run axe-core via CDP injection
            await page.addScriptTag({
              url: 'https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.9.1/axe.min.js',
            })

            const violations = await page.evaluate(async () => {
              // @ts-ignore axe is injected
              const results = await window.axe.run(document, {
                runOnly: {
                  type: 'tag',
                  values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'],
                },
              })
              return results.violations
            })

            results.push({
              url,
              domFingerprint: fingerprint,
              violations,
              scannedAt: new Date().toISOString(),
              skipped: false,
            })

            // Extract internal links for BFS queue
            const links = await page.evaluate((origin: string) => {
              return [...document.querySelectorAll('a[href]')]
                .map(a => {
                  try {
                    const href = (a as HTMLAnchorElement).href
                    const url = new URL(href)
                    // Same origin only, no anchors, no query params that likely create infinite pages
                    if (url.origin === origin && !url.hash) {
                      return url.origin + url.pathname
                    }
                  } catch {}
                  return null
                })
                .filter(Boolean) as string[]
            }, origin)

            const newLinks = [...new Set(links)].filter(
              link => !visited.has(link) && !queue.includes(link)
            )
            queue.push(...newLinks)

          } catch (err) {
            // Don't fail the whole scan for one bad page
            results.push({
              url,
              domFingerprint: '',
              violations: [],
              scannedAt: new Date().toISOString(),
              skipped: true,
              skippedReason: `Failed to scan: ${err instanceof Error ? err.message : 'Unknown error'}`,
            })
          } finally {
            await context?.close()
          }
        })
      )
    }
  } finally {
    await browser.close()
  }

  return {
    results,
    pagesScanned: results.filter(r => !r.skipped).length,
    pagesSkipped,
  }
}
