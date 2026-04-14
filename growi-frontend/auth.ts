import NextAuth from 'next-auth'
import { PrismaAdapter } from '@auth/prisma-adapter'
import Credentials from 'next-auth/providers/credentials'
import { prisma } from '@/lib/prisma'
import { loginSchema } from '@/lib/auth-schemas'
import bcrypt from 'bcryptjs'
import { authConfig } from '@/auth.config'

// TODO: Add Google / GitHub OAuth providers here when ready.

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(prisma),
  session: { strategy: 'jwt' },
  providers: [
    Credentials({
      credentials: {
        email:    { label: 'Email',        type: 'email' },
        password: { label: 'Mot de passe', type: 'password' },
      },
      async authorize(credentials) {
        const parsed = loginSchema.safeParse(credentials)
        if (!parsed.success) return null

        const user = await prisma.user.findUnique({
          where: { email: parsed.data.email },
        })
        if (!user?.password) return null

        const valid = await bcrypt.compare(parsed.data.password, user.password)
        if (!valid) return null

        return {
          id:        user.id,
          email:     user.email,
          name:      user.firstName ?? user.name ?? undefined,
          firstName: user.firstName ?? undefined,
          plan:      user.plan,
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id        = user.id
        token.firstName = (user as any).firstName
        token.plan      = (user as any).plan
      }
      return token
    },
    async session({ session, token }) {
      session.user.id        = token.id as string
      session.user.firstName = token.firstName as string
      session.user.plan      = token.plan as string
      return session
    },
  },
})

// Session type augmentation
declare module 'next-auth' {
  interface Session {
    user: {
      id:        string
      firstName: string
      plan:      string
      email:     string
      name?:     string | null
      image?:    string | null
    }
  }
  interface User {
    firstName?: string
    plan?:      string
  }
}
