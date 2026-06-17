import { createHash, timingSafeEqual } from 'node:crypto'

/**
 * Constant-time string comparison. Hashing both inputs to a fixed length first
 * avoids leaking length information and satisfies timingSafeEqual's equal-length
 * requirement. Returns false if either value is null/undefined.
 */
export function safeEqual(a: string | undefined | null, b: string | undefined | null): boolean {
  if (a == null || b == null) return false
  const ha = createHash('sha256').update(a).digest()
  const hb = createHash('sha256').update(b).digest()
  return timingSafeEqual(ha, hb)
}

/** Hex SHA-256 digest — used to store invite tokens hashed at rest. */
export function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

/** Validates a `Bearer <secret>` Authorization header against an expected secret, in constant time. */
export function isValidBearer(authHeader: string | null, expectedSecret: string | undefined): boolean {
  if (!expectedSecret) return false
  if (!authHeader || !authHeader.startsWith('Bearer ')) return false
  return safeEqual(authHeader.slice('Bearer '.length), expectedSecret)
}
