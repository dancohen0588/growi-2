import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import { authConfig } from '@/auth.config'
import { loginSchema } from '@/lib/auth-schemas'
import { verifyCredentials } from '@/lib/services/user.service'

/**
 * Les callbacks `jwt`, `session` et `authorized` vivent dans `auth.config.ts`,
 * que le middleware instancie de son côté. **Ne pas redéclarer `callbacks` ici** :
 * la clé écraserait celle de la config partagée, et le middleware se
 * retrouverait sans le rôle qu'il doit vérifier.
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  session: { strategy: 'jwt' },
  providers: [
    Credentials({
      async authorize(credentials) {
        const parsed = loginSchema.safeParse(credentials)
        if (!parsed.success) return null

        const { email, password } = parsed.data
        return verifyCredentials(email, password)
      },
    }),
  ],
})
