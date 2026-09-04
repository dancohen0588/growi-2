import NextAuth, { DefaultSession } from 'next-auth'
import { JWT } from 'next-auth/jwt'
import type { UserRole } from '@growi/shared'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      firstName?: string | null
      /**
       * Rôle du compte, recopié du JWT. Sert au middleware à décider d'une
       * redirection ; **jamais** à autoriser une écriture — `requireAdmin()`
       * relit la base pour cela (voir `lib/admin/auth.ts`).
       */
      role?: UserRole
    } & DefaultSession['user']
  }

  /** Ce que le provider Credentials renvoie au callback `jwt`. */
  interface User {
    firstName?: string | null
    role?: string | null
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id?: string
    firstName?: string | null
    role?: UserRole
  }
}
