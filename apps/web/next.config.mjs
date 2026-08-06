/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    // ESLint is run separately via `npm run lint`; skip during `next build` to avoid broken node_modules issues
    ignoreDuringBuilds: true,
  },
  staticPageGenerationTimeout: 180,
  // Packages du monorepo consommés en TypeScript source (pas de build préalable)
  transpilePackages: ['@growi/shared'],
  // Treat Prisma and bcryptjs as server-side external packages (not bundled by webpack).
  // Required to prevent build worker timeouts when these packages are imported in Server Components.
  experimental: {
    serverComponentsExternalPackages: ['@prisma/client', 'bcryptjs', '@auth/prisma-adapter'],
  },
  images: {
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [
      { protocol: 'https', hostname: 'inaturalist-open-data.s3.amazonaws.com' },
      { protocol: 'https', hostname: 'static.inaturalist.org' },
      { protocol: 'https', hostname: 'upload.wikimedia.org' },
    ],
  },
  webpack(config) {
    // Konva's Node.js bundle references 'canvas' — stub it out for browser builds
    config.resolve.alias = {
      ...config.resolve.alias,
      canvas: false,
    }
    return config
  },
}

export default nextConfig
