import type { NextAuthConfig } from 'next-auth'

// Edge-safe auth config — no Node.js-only imports (no Prisma, no bcrypt).
// Used by middleware.ts to protect routes.
// The full auth.ts (with PrismaAdapter + bcrypt) is used for server-side operations.
export const authConfig: NextAuthConfig = {
  pages: {
    signIn: '/login',
    error:  '/login',
  },
  callbacks: {
    authorized({ auth }) {
      return !!auth?.user
    },
  },
  providers: [],
}
