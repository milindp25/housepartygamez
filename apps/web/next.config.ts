import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  transpilePackages: ['@hpg/shared'],
  /**
   * Baseline security headers for every route. A full CSP is deliberately
   * deferred — Next's inline runtime scripts need nonce plumbing that isn't
   * worth it pre-launch; revisit alongside the auth work (plan 4).
   */
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ]
  },
}

export default nextConfig
