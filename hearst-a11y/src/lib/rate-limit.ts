/**
 * Best-effort in-memory fixed-window rate limiter.
 *
 * Note: serverless instances don't share memory, so this is a soft guard
 * against rapid-fire bursts within a warm instance. The hard limit on expensive
 * scans is the DB-backed concurrency cap in the scan route.
 */
const buckets = new Map<string, { count: number; resetAt: number }>()

/** Returns true if the action is allowed; false if the key has hit its limit for the window. */
export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now()
  const bucket = buckets.get(key)
  if (!bucket || now > bucket.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    return true
  }
  if (bucket.count >= limit) return false
  bucket.count++
  return true
}
