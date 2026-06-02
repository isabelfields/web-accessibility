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
export interface ViolationPattern {
  fingerprint: string    // "color-contrast::a.nav-link"
  rule: string
  impact: ImpactLevel
  description: string
  fixSuggestion: string  // from Claude or hardcoded rules
  isHardcoded: boolean   // true = came from KNOWN_FIXES, false = Claude generated
  occurrences: number
  affectedPages: string[]
  sampleHtml?: string        // raw HTML of one failing element
  sampleScreenshot?: string  // base64 JPEG of the element
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
  templateType: 'homepage' | 'article' | 'gallery' | 'category' | 'other'
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

export interface Site {
  id: string
  name: string
  division?: HearstDivision
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
