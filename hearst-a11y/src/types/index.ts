export type ImpactLevel = 'critical' | 'serious' | 'moderate' | 'minor'

export interface ViolationNode {
  html: string
  target: string[]
  failureSummary?: string
}

export interface RawViolation {
  id: string
  impact: ImpactLevel
  description: string
  help: string
  helpUrl: string
  nodes: ViolationNode[]
}

// Stripped-down violation we send to Claude (NOT raw HTML)
export interface StrippedViolation {
  rule: string
  impact: ImpactLevel
  description: string
  selector: string       // normalized CSS selector only
  context: string        // e.g. "img without alt", "button without label"
}

// Fingerprint key = rule::normalizedSelector
export interface PatternNode {
  html: string
  url: string            // which page this element was found on
  screenshot?: string    // base64 JPEG
}

export interface ViolationPattern {
  fingerprint: string
  rule: string
  impact: ImpactLevel
  description: string
  fixSuggestion: string  // from Claude or hardcoded rules
  isHardcoded: boolean
  occurrences: number
  affectedPages: string[]
  nodes: PatternNode[]   // every failing element, each individually fixable
  sampleHtml?: string    // kept for backwards compat with old scan records
  sampleScreenshot?: string
}

export interface PageScore {
  url: string
  label?: string
  score: number | null
  violationCount: number | null
  error?: string
}

export interface PageScanResult {
  url: string
  domFingerprint: string   // structural hash for near-dupe detection
  violations: RawViolation[]
  scannedAt: string
  skipped: boolean         // true = near-duplicate of another page
  skippedReason?: string
}

export interface ScanJob {
  id: string
  siteId?: string
  rootUrl: string
  status: 'queued' | 'running' | 'complete' | 'failed' | 'cancelled'
  score: number
  pageScores: PageScore[]
  pagesScanned: number
  pagesSkipped: number
  totalPages: number
  patterns: ViolationPattern[]
  rawViolationCount: number
  uniquePatternCount: number
  claudeCallCount: number
  estimatedCostUsd: number
  startedAt: string
  completedAt?: string
  error?: string
}

export interface Schedule {
  id: string
  rootUrl: string
  cadence: 'daily' | 'weekly' | 'monthly'
  dayOfWeek?: number    // 0-6 for weekly
  dayOfMonth?: number   // 1-31 for monthly
  lastRunAt?: string
  nextRunAt: string
  enabled: boolean
  createdAt: string
}

export interface SitePage {
  url: string
  label: string       // e.g. "Homepage", "Article Template"
  templateType: 'homepage' | 'article' | 'gallery' | 'category' | 'commerce' | 'video' | 'search' | 'other'
}

export type HearstDivision =
  | 'Corporate'
  | 'Fitch'
  | 'Magazines'
  | 'Television'
  | 'Newspapers'
  | 'Transportation'
  | 'Healthcare'
  | 'HearstLab'
  | 'Level Up'
  | 'Hearst Ventures'
  | 'Western Properties'

export const HEARST_DIVISIONS: HearstDivision[] = [
  'Corporate', 'Fitch', 'Magazines', 'Television', 'Newspapers',
  'Transportation', 'Healthcare', 'HearstLab', 'Level Up',
  'Hearst Ventures', 'Western Properties',
]

export const HEARST_BRANDS: Record<HearstDivision, string[]> = {
  Corporate:          ['Hearst.com', 'Hearst360', 'HearstMade'],
  Fitch:              ['Fitch Ratings', 'Fitch Solutions', 'CreditSights'],
  Magazines:          ['Elle', 'Esquire', "Harper's Bazaar", "Town & Country", 'House Beautiful', 'Cosmopolitan', 'Good Housekeeping', "Woman's Day", 'Popular Mechanics', 'Road & Track', 'Car and Driver', "Men's Health", "Women's Health", 'Prevention', 'Delish', 'Country Living', 'Marie Claire', 'Bicycling', "Runner's World"],
  Television:         ['KQCA', 'KSAT', 'KCRA', 'WMTW', 'WGAL', 'WTAE', 'WLWT', 'KOAT', 'WPTZ', 'KHBS'],
  Newspapers:         ['San Francisco Chronicle', 'Houston Chronicle', 'Albany Times Union', 'Connecticut Media Group', 'Midland Reporter-Telegram', 'San Antonio Express-News'],
  Transportation:     ['BlackBook', 'Car and Driver', 'Road & Track'],
  Healthcare:         ['Hearst Health', 'Zynx Health'],
  HearstLab:          ['HearstLab'],
  'Level Up':         ['Level Up'],
  'Hearst Ventures':  ['Hearst Ventures'],
  'Western Properties': ['Western Properties'],
}

export const HEARST_REGIONS = ['US', 'UK', 'EMEA', 'APAC', 'LATAM'] as const
export type HearstRegion = typeof HEARST_REGIONS[number]

export interface Site {
  id: string
  name: string
  division?: HearstDivision
  brand?: string
  region?: HearstRegion
  pages: SitePage[]
  scheduleId?: string
  createdAt: string
  updatedAt: string
}

export interface ScanSummary {
  id: string
  siteId?: string
  rootUrl: string
  status: string
  score: number
  pagesScanned: number
  rawViolationCount: number
  uniquePatternCount: number
  estimatedCostUsd: number
  startedAt: string
  completedAt?: string
  triggeredBy: string
}
