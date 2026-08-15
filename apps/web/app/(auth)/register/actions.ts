'use server'

import { registerSchema, type RegisterInput } from '@growi/shared'

import { signIn } from '@/auth'
import { isServiceError } from '@/lib/services/errors'
import { createUser } from '@/lib/services/user.service'

// TODO: Add "mot de passe oublié" flow when email provider is set up.

export async function registerAction(
  formData: RegisterInput,
): Promise<{ error?: string }> {
  const parsed = registerSchema.safeParse(formData)
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message }
  }

  try {
    await createUser({
      email: parsed.data.email,
      password: parsed.data.password,
      firstName: parsed.data.firstName,
    })
  } catch (err) {
    if (isServiceError(err) && err.code === 'CONFLICT') {
      return { error: err.message }
    }
    console.error('[registerAction] prisma.user.create failed:', err)
    return { error: 'Erreur lors de la création du compte.' }
  }

  try {
    await signIn('credentials', {
      email: parsed.data.email,
      password: parsed.data.password,
      redirectTo: '/dashboard',
    })
  } catch (err) {
    // NextAuth throws NEXT_REDIRECT on success — let it bubble up.
    if (err && typeof err === 'object' && 'digest' in err && typeof (err as { digest?: string }).digest === 'string' && (err as { digest: string }).digest.startsWith('NEXT_REDIRECT')) {
      throw err
    }
    console.error('[registerAction] signIn after register failed:', err)
    return { error: 'Compte créé, mais connexion automatique échouée. Connecte-toi manuellement.' }
  }

  return {}
}
