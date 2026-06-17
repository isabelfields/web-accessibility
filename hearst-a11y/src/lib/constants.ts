/** Shared configuration constants for the scanner and AI suggestion pipeline. */

// axe-core tag set scanned on every page.
export const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice']

// Cap on failing-element nodes stored per rule (keeps DB rows bounded).
export const MAX_NODES_PER_RULE = 50

/** AI suggestion model + pricing. Keep MODEL and the per-MTok rates in sync. */
export const AI = {
  MODEL: 'gpt-4o',
  MAX_TOKENS: 4096,
  BATCH_SIZE: 20,
  INPUT_USD_PER_MTOK: 2.5,
  OUTPUT_USD_PER_MTOK: 10,
} as const

/** Browserless CDP endpoint used by both the crawler and page-list scanner. */
export function browserlessWsEndpoint(): string {
  return `wss://chrome.browserless.io?token=${process.env.BROWSERLESS_TOKEN}`
}
