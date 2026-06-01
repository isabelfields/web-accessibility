import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['playwright', '@axe-core/playwright'],
  },
}

export default nextConfig
