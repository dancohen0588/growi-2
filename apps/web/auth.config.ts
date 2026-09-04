import type { NextAuthConfig } from 'next-auth'
import { DEFAULT_USER_ROLE } from '@growi/shared'
import { isUserRole } from '@/lib/admin/role'

/**
 * Configuration partagée par `auth.ts` et le middleware.
 *
 * Elle s'exécute dans le **runtime Edge** : ni Prisma, ni bcrypt, ni rien qui
 * touche à Node ne doit y entrer. C'est la raison d'être de ce fichier séparé.
 *
 * ⚠️ **Les trois callbacks doivent rester ici, ensemble.** Le middleware
 * instancie NextAuth avec ce seul objet : un `jwt` ou un `session` déclaré dans
 * `auth.ts` ne s'y exécuterait pas, et `auth.user` y serait réduit à ce que
 * NextAuth sait déduire par défaut, sans `id`.
 *
 * Le `role` qu'on y pose sert à l'affichage (montrer ou non une entrée « Admin »).
 * **Il ne décide de rien** : il date de la connexion et peut donc être périmé.
 * Voir `authorized` et `lib/admin/auth.ts`.
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
        //
        // On s'arrête là : **le middleware ne juge pas du rôle**. Il ne dispose
        // que du JWT, où `role` n'est écrit qu'à la connexion — un compte promu
        // porterait son ancien rôle jusqu'à sa prochaine ouverture de session,
        // et se verrait refuser l'entrée sans pouvoir rien y faire. Filtrer ici
        // priverait en plus `requireAdmin()` de la seule occasion de lire la
        // base, puisque le layout ne serait jamais atteint.
        //
        // C'est donc `app/admin/layout.tsx` qui tranche, sur l'état réel du
        // compte, et qui renvoie un non-administrateur vers /dashboard.
        return isLoggedIn
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
