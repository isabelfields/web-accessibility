import type { NextConfig } from 'next'
import path from 'path'

const isDev = process.env.NODE_ENV === 'development'

// App Router hydration needs inline scripts; Recharts/Next emit inline styles.
// 'unsafe-eval' is only required by the dev React refresh runtime.
const csp = [
  `default-src 'self'`,
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''}`,
  `style-src 'self' 'unsafe-inline'`,
  `img-src 'self' data: blob:`,
  `font-src 'self' data:`,
  `connect-src 'self'`,
  `frame-ancestors 'none'`,
  `base-uri 'self'`,
  `form-action 'self'`,
  `object-src 'none'`,
].join('; ')

const securityHeaders = [
  { key: 'Content-Security-Policy', value: csp },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
]

const nextConfig: NextConfig = {
  // playwright/axe need to be external (native binary deps).
  // @boxyhq/saml-jackson is intentionally NOT in this list: we need webpack to
  // bundle it so the patched static require('jose') resolves via the alias below
  // and gets inlined into .next/ — making Lambda's cached node_modules irrelevant.
  serverExternalPackages: ['playwright', '@axe-core/playwright'],
  eslint: { ignoreDuringBuilds: true },
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }]
  },
  webpack(config, { isServer }) {
    if (isServer) {
      // Resolve the patched static require('jose') to our vendored shim.
      // Jackson's utils.js is patched by scripts/install-jose-shim.js (prebuild)
      // to use require('jose') instead of new Function('return import(pkg)')(),
      // so webpack can see and bundle this alias at build time.
      config.resolve.alias = {
        ...config.resolve.alias,
        jose: path.resolve(__dirname, 'local_modules/jose/index.js'),
      }
    }
    return config
  },
}

export default nextConfig
