/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    // ESLint is run separately via `npm run lint`; skip during `next build` to avoid broken node_modules issues
    ignoreDuringBuilds: true,
  },
  images: {
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [],
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
