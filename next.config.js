/** @type {import('next').NextConfig} */
const nextConfig = {
  // Required for instrumentation.ts to run on server start
  // This is what boots the POS sync scheduler
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