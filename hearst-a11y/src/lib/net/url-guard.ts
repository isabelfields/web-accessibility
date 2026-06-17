import { lookup } from 'node:dns/promises'
import net from 'node:net'

/** Thrown when a URL is not allowed to be scanned (SSRF guard). */
export class UrlNotAllowedError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'UrlNotAllowedError'
  }
}

const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  'metadata.google.internal',
])

/** True if an IPv4 string falls in a private/reserved/link-local range. */
function isBlockedIpv4(ip: string): boolean {
  const parts = ip.split('.').map(Number)
  if (parts.length !== 4 || parts.some(p => Number.isNaN(p) || p < 0 || p > 255)) return true
  const [a, b] = parts
  if (a === 0) return true                         // 0.0.0.0/8 "this network"
  if (a === 10) return true                        // 10/8 private
  if (a === 127) return true                       // loopback
  if (a === 169 && b === 254) return true          // link-local incl. cloud metadata 169.254.169.254
  if (a === 172 && b >= 16 && b <= 31) return true // 172.16/12 private
  if (a === 192 && b === 168) return true          // 192.168/16 private
  if (a === 100 && b >= 64 && b <= 127) return true // 100.64/10 CGNAT
  if (a >= 224) return true                        // multicast + reserved (224/4, 240/4)
  return false
}

/** True if an IPv6 string is loopback/unspecified/link-local/ULA/IPv4-mapped-private. */
function isBlockedIpv6(ip: string): boolean {
  const addr = ip.toLowerCase().split('%')[0] // strip zone id
  if (addr === '::1' || addr === '::') return true
  if (addr.startsWith('fe80')) return true        // link-local
  if (addr.startsWith('fc') || addr.startsWith('fd')) return true // ULA fc00::/7
  if (addr.startsWith('ff')) return true          // multicast
  // IPv4-mapped (::ffff:a.b.c.d) — re-check the embedded v4
  const mapped = addr.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/)
  if (mapped) return isBlockedIpv4(mapped[1])
  return false
}

function isBlockedIp(ip: string): boolean {
  const family = net.isIP(ip)
  if (family === 4) return isBlockedIpv4(ip)
  if (family === 6) return isBlockedIpv6(ip)
  return true // not a valid IP literal — be conservative
}

/**
 * SSRF guard: rejects URLs that aren't safe to fetch/render server-side.
 *
 * Enforces an http(s) scheme and resolves the hostname, rejecting if the host
 * (or any resolved address) is loopback, private, link-local (incl. the cloud
 * metadata endpoint), CGNAT, multicast, or reserved. Resolving and checking the
 * actual IP also defends against DNS rebinding via a public hostname.
 */
export async function assertPublicUrl(rawUrl: string): Promise<void> {
  let url: URL
  try {
    url = new URL(rawUrl)
  } catch {
    throw new UrlNotAllowedError('Invalid URL')
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new UrlNotAllowedError(`Unsupported URL scheme: ${url.protocol}`)
  }

  const hostname = url.hostname.toLowerCase().replace(/\.$/, '')
  if (BLOCKED_HOSTNAMES.has(hostname) || hostname.endsWith('.localhost')) {
    throw new UrlNotAllowedError(`Blocked host: ${hostname}`)
  }

  // If the host is an IP literal, check it directly.
  if (net.isIP(hostname)) {
    if (isBlockedIp(hostname)) throw new UrlNotAllowedError(`Blocked address: ${hostname}`)
    return
  }

  // Otherwise resolve DNS and reject if ANY resolved address is non-public.
  let addresses: { address: string }[]
  try {
    addresses = await lookup(hostname, { all: true })
  } catch {
    throw new UrlNotAllowedError(`Could not resolve host: ${hostname}`)
  }
  if (addresses.length === 0) throw new UrlNotAllowedError(`Could not resolve host: ${hostname}`)
  for (const { address } of addresses) {
    if (isBlockedIp(address)) {
      throw new UrlNotAllowedError(`Host resolves to a non-public address: ${hostname}`)
    }
  }
}

/**
 * Validates a list of page URLs. Returns a "url: reason" string for the first
 * URL that isn't safe to scan, or null if all pass.
 */
export async function findUnscannableUrl(pages: { url: string }[]): Promise<string | null> {
  for (const p of pages) {
    try {
      await assertPublicUrl(p.url)
    } catch (e) {
      if (e instanceof UrlNotAllowedError) return `${p.url}: ${e.message}`
      throw e
    }
  }
  return null
}
