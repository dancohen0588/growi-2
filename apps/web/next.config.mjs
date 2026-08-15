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
  // En-têtes de sécurité appliqués à toutes les réponses. Vercel ajoute déjà
  // Strict-Transport-Security ; le reste manquait.
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          // Empêche le navigateur de deviner un type MIME (XSS par upload).
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          // Interdit l'inclusion du site dans une iframe (clickjacking).
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Content-Security-Policy', value: "frame-ancestors 'none'" },
          // Ne divulgue pas l'URL complète aux sites tiers.
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          // Aucune de ces API n'est utilisée côté web.
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(self)' },
        ],
      },
    ]
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
