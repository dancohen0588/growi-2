'use server'
// growi-frontend/app/(auth)/register/actions.ts
import { registerSchema } from '@/lib/auth-schemas'
import { createUser } from '@/lib/mock-users'
import { signIn } from '@/auth'
import type { RegisterInput } from '@/lib/auth-schemas'

// TODO: Add "mot de passe oublié" flow when email provider is set up.

export async function registerAction(
  formData: RegisterInput,
): Promise<{ error?: string }> {
  const parsed = registerSchema.safeParse(formData)
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message }
  }

  try {
    await createUser(parsed.data.firstName, parsed.data.email, parsed.data.password)
  } catch (err) {
    if ((err as Error).message === 'EMAIL_TAKEN') {
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
