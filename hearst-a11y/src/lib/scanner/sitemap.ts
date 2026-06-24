/**
 * Seeds a crawl from the site's sitemap so coverage isn't limited to links
 * discoverable from the homepage. Fetches /sitemap.xml (following one level of
 * sitemap-index nesting), returns same-origin page URLs deduped by path.
 *
 * Best-effort: any failure (missing/invalid sitemap, network error) returns [].
 */
const FETCH_TIMEOUT_MS = 8000

async function fetchText(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: { 'User-Agent': 'HearstA11yScanner/1.0 (+https://hearst.com/accessibility)' },
    })
    if (!res.ok) return null
    return await res.text()
  } catch {
    return null
  }
}

/** Extract <loc> values from a sitemap or sitemap-index document. */
function extractLocs(xml: string): string[] {
  return [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)].map(m => m[1])
}

export async function fetchSitemapUrls(rootUrl: string, limit: number): Promise<string[]> {
  let origin: string
  try {
    origin = new URL(rootUrl).origin
  } catch {
    return []
  }

  const xml = await fetchText(`${origin}/sitemap.xml`)
  if (!xml) return []

  let locs = extractLocs(xml)

  // If this is a sitemap index, fetch the first child sitemap for actual pages.
  if (/<sitemapindex/i.test(xml)) {
    const firstChild = locs.find(l => l.startsWith(origin))
    locs = firstChild ? extractLocs((await fetchText(firstChild)) ?? '') : []
  }

  const seenPaths = new Set<string>()
  const urls: string[] = []
  for (const loc of locs) {
    let u: URL
    try {
      u = new URL(loc)
    } catch {
      continue
    }
    if (u.origin !== origin) continue
    const key = u.pathname
    if (seenPaths.has(key)) continue
    seenPaths.add(key)
    urls.push(u.origin + u.pathname)
    if (urls.length >= limit) break
  }
  return urls
}
