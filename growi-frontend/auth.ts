// growi-frontend/auth.ts
import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import { loginSchema } from '@/lib/auth-schemas'
import { verifyUser } from '@/lib/mock-users'

// TODO: Add Google / GitHub OAuth providers here when ready.

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Credentials({
      credentials: {
        email:    { label: 'Email',        type: 'email' },
        password: { label: 'Mot de passe', type: 'password' },
      },
      async authorize(credentials) {
        const parsed = loginSchema.safeParse(credentials)
        if (!parsed.success) return null

        const user = await verifyUser(parsed.data.email, parsed.data.password)
        if (!user) return null

        return { id: user.id, name: user.firstName, email: user.email }
      },
    }),
  ],
  session: { strategy: 'jwt' },
  pages: {
    signIn: '/login',
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.firstName = user.name
        token.id = user.id
      }
      return token
    },
    async session({ session, token }) {
      session.user.firstName = token.firstName as string
      session.user.id = token.id as string
      return session
    },
  },
})

// Augment session types for TypeScript strict mode
declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      firstName: string
      email: string
      name?: string | null
      image?: string | null
    }
  }
  interface User {
    firstName?: string
  }
}
