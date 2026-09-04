import type { NextAuthConfig } from 'next-auth'
import { NextResponse } from 'next/server'
import { DEFAULT_USER_ROLE } from '@growi/shared'
import { isAdminRole, isUserRole } from '@/lib/admin/role'

/**
 * Configuration partagée par `auth.ts` et le middleware.
 *
 * Elle s'exécute dans le **runtime Edge** : ni Prisma, ni bcrypt, ni rien qui
 * touche à Node ne doit y entrer. C'est la raison d'être de ce fichier séparé.
 *
 * ⚠️ **Les trois callbacks doivent rester ici, ensemble.** Le middleware
 * instancie NextAuth avec ce seul objet : un `jwt` ou un `session` déclaré dans
 * `auth.ts` ne s'y exécuterait pas, et `auth.user` y serait réduit à ce que
 * NextAuth sait déduire par défaut — sans `id` ni `role`. `authorized` renverrait
 * alors tout le monde, y compris les administrateurs, hors de `/admin`.
 */
export const authConfig = {
  pages: {
    signIn: '/login',
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.name = user.name
        token.firstName = user.name
        // Un rôle qu'on ne sait pas lire n'ouvre rien : on retombe sur `USER`.
        token.role = isUserRole(user.role) ? user.role : DEFAULT_USER_ROLE
      }
      return token
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string
        session.user.name = token.name as string | null
        session.user.firstName = (token.firstName as string | null | undefined) ?? null
        session.user.role = isUserRole(token.role) ? token.role : DEFAULT_USER_ROLE
      }
      return session
    },
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user
      const isOnDashboard = nextUrl.pathname.startsWith('/dashboard')
      const isOnAdmin = nextUrl.pathname.startsWith('/admin')

      if (isOnAdmin) {
        // Anonyme : `false` renvoie vers /login avec le callback d'origine.
        if (!isLoggedIn) return false
        if (isAdminRole(auth?.user?.role)) return true
        // Connecté mais sans les droits : on renvoie au dashboard plutôt que
        // vers /login, qui ferait croire à une session expirée. `/admin` reste
        // ainsi indistinguable d'une page inexistante pour un compte ordinaire.
        return NextResponse.redirect(new URL('/dashboard', nextUrl))
      }

      if (isOnDashboard) {
        if (isLoggedIn) return true
        return false
      }
      return true
    },
  },
  providers: [],
} satisfies NextAuthConfig
