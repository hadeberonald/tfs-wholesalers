/** @type {import('next').NextConfig} */
const nextConfig = {
  serverComponentsExternalPackages: ['mongodb', 'basic-ftp'],  // ← top level, NOT inside experimental
  experimental: {
    instrumentationHook: true,
  },
  images: {
    domains: ['localhost'],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
}

module.exports = nextConfig