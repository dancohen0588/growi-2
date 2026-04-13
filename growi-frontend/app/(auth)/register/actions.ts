'use server'

import { registerSchema } from '@/lib/auth-schemas'
import { signIn } from '@/auth'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { Prisma } from '@prisma/client'
import type { RegisterInput } from '@/lib/auth-schemas'

// TODO: Add "mot de passe oublié" flow when email provider is set up.

export async function registerAction(
  formData: RegisterInput,
): Promise<{ error?: string }> {
  const parsed = registerSchema.safeParse(formData)
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message }
  }

  const hashedPassword = await bcrypt.hash(parsed.data.password, 12)

  try {
    await prisma.user.create({
      data: {
        email: parsed.data.email,
        firstName: parsed.data.firstName,
        name: parsed.data.firstName,
        password: hashedPassword,
        plan: 'FREE',
      },
    })
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === 'P2002'
    ) {
      return { error: 'Un compte existe déjà avec cet email.' }
    }
    return { error: 'Erreur lors de la création du compte.' }
  }

  // Auto sign-in after registration
  await signIn('credentials', {
    email: parsed.data.email,
    password: parsed.data.password,
    redirectTo: '/dashboard',
  })

  return {}
}
