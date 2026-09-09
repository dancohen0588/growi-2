import { withSentryConfig } from '@sentry/nextjs'

/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    // ESLint is run separately via `npm run lint`; skip during `next build` to avoid broken node_modules issues
    ignoreDuringBuilds: true,
  },
  staticPageGenerationTimeout: 180,
  // Packages du monorepo consommés en TypeScript source (pas de build préalable)
  transpilePackages: ['@growi/shared', '@growi/api-client'],
  // Treat Prisma and bcryptjs as server-side external packages (not bundled by webpack).
  // Required to prevent build worker timeouts when these packages are imported in Server Components.
  experimental: {
    serverComponentsExternalPackages: ['@prisma/client', 'bcryptjs', '@auth/prisma-adapter'],
    // Autorise `instrumentation.ts`, qui initialise Sentry côté serveur. En
    // Next 14 le fichier est ignoré sans ce drapeau — et Sentry serait muet
    // sur toute l'API, sans la moindre erreur pour le signaler.
    instrumentationHook: true,
  },
  // `/tarifs` et `/pro` ont été retirées : rien n'existe derrière (ni paiement,
  // ni offre B2B) et la première était la cible du CTA principal du site. Les
  // deux URL sont indexées, d'où la redirection permanente plutôt qu'une 404 —
  // vers ce que le visiteur cherchait : commencer, ou nous joindre.
  async redirects() {
    return [
      { source: '/tarifs', destination: '/register', permanent: true },
      { source: '/pro',    destination: '/contact',  permanent: true },
    ]
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
      // Photos déposées par les utilisateurs (bucket public `plant-photos`).
      { protocol: 'https', hostname: '*.supabase.co', pathname: '/storage/v1/object/public/**' },
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

/**
 * Enveloppe Sentry : injection des trois `sentry.*.config.ts` et téléversement
 * des source maps au build.
 *
 * - `org` / `project` / `authToken` viennent de l'environnement : rien de
 *   sensible dans ce fichier versionné. Sans `SENTRY_AUTH_TOKEN` — le cas en
 *   local — le plugin saute simplement le téléversement, le build passe.
 * - `tunnelRoute` fait transiter les événements par notre propre domaine :
 *   sans lui, un bloqueur de publicité avale les erreurs de ceux qui en ont un,
 *   c'est-à-dire précisément celles qu'on ne verrait jamais autrement.
 * - Les source maps ne sont pas servies au public : depuis la v9 du SDK, elles
 *   sont supprimées du build après téléversement (`deleteSourcemapsAfterUpload`,
 *   vrai par défaut). L'ancienne option `hideSourceMaps` n'existe plus.
 */
export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  // Notre organisation est stockée en région UE : ses API répondent sur
  // `de.sentry.io`, pas sur `sentry.io` (le défaut du SDK, valable pour les
  // organisations américaines). Avec la mauvaise valeur, le build passe et
  // les source maps ne sont jamais téléversées — on ne s'en aperçoit qu'en
  // lisant une pile de production illisible. `SENTRY_URL` permet de la
  // changer sans toucher au code.
  sentryUrl: process.env.SENTRY_URL ?? 'https://de.sentry.io/',
  // Bavard en CI (les logs y sont la seule trace d'un téléversement raté),
  // silencieux en local.
  silent: !process.env.CI,
  widenClientFileUpload: true,
  tunnelRoute: '/monitoring',
})
