/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    instrumentationHook: true,
  },
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // Don't bundle these Node-only modules for the client
      config.resolve.fallback = {
        ...config.resolve.fallback,
        net:           false,
        tls:           false,
        fs:            false,
        'fs/promises': false,
        crypto:        false,
        child_process: false,
      };
    }

    // Tell webpack to skip mongodb and basic-ftp entirely — they're Node-only
    config.externals = [
      ...(Array.isArray(config.externals) ? config.externals : [config.externals].filter(Boolean)),
      'mongodb',
      'basic-ftp',
    ];

    return config;
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