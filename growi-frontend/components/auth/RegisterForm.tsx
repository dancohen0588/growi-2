// growi-frontend/components/auth/RegisterForm.tsx
'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Eye, EyeOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { registerSchema, type RegisterInput } from '@/lib/auth-schemas'
import { registerAction } from '@/app/(auth)/register/actions'

// Password strength: 0=empty, 1=weak, 2=medium, 3=strong
function getPasswordStrength(password: string): 0 | 1 | 2 | 3 {
  if (!password) return 0
  let score = 0
  if (password.length >= 8) score++
  if (/[A-Z]/.test(password)) score++
  if (/[0-9]/.test(password)) score++
  if (/[^A-Za-z0-9]/.test(password)) score++
  if (score <= 2) return 1
  if (score === 3) return 2
  return 3
}

const strengthLabel: Record<number, string> = {
  0: '',
  1: 'Faible',
  2: 'Moyen',
  3: 'Fort',
}
const strengthColor: Record<number, string> = {
  0: 'bg-transparent',
  1: 'bg-red-400',
  2: 'bg-sun',
  3: 'bg-lime',
}

export function RegisterForm() {
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<RegisterInput>({ resolver: zodResolver(registerSchema) })

  const passwordValue = watch('password', '')
  const strength = getPasswordStrength(passwordValue)

  async function onSubmit(data: RegisterInput) {
    setServerError(null)
    const result = await registerAction(data)
    if (result?.error) {
      setServerError(result.error)
    }
    // On success, registerAction calls signIn() which redirects — no explicit push needed.
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      noValidate
      className="flex flex-col gap-5"
    >
      {/* First Name */}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="firstName" className="font-raleway text-sm font-medium text-forest">
          Prénom
        </label>
        <input
          id="firstName"
          type="text"
          autoComplete="given-name"
          aria-invalid={!!errors.firstName}
          aria-describedby={errors.firstName ? 'firstName-error' : undefined}
          className="h-11 rounded-lg border border-forest/20 bg-white px-4 font-raleway text-sm text-forest placeholder:text-forest/40 focus:outline-none focus:ring-2 focus:ring-lime focus:ring-offset-1 aria-[invalid=true]:border-red-500"
          placeholder="Julie"
          {...register('firstName')}
        />
        {errors.firstName && (
          <p id="firstName-error" role="alert" aria-live="polite" className="text-xs text-red-500">
            {errors.firstName.message}
          </p>
        )}
      </div>

      {/* Email */}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="reg-email" className="font-raleway text-sm font-medium text-forest">
          Email
        </label>
        <input
          id="reg-email"
          type="email"
          autoComplete="email"
          aria-invalid={!!errors.email}
          aria-describedby={errors.email ? 'reg-email-error' : undefined}
          className="h-11 rounded-lg border border-forest/20 bg-white px-4 font-raleway text-sm text-forest placeholder:text-forest/40 focus:outline-none focus:ring-2 focus:ring-lime focus:ring-offset-1 aria-[invalid=true]:border-red-500"
          placeholder="julie@exemple.com"
          {...register('email')}
        />
        {errors.email && (
          <p id="reg-email-error" role="alert" aria-live="polite" className="text-xs text-red-500">
            {errors.email.message}
          </p>
        )}
      </div>

      {/* Password + strength meter */}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="reg-password" className="font-raleway text-sm font-medium text-forest">
          Mot de passe
        </label>
        <div className="relative">
          <input
            id="reg-password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="new-password"
            aria-invalid={!!errors.password}
            aria-describedby="reg-password-strength reg-password-error"
            className="h-11 w-full rounded-lg border border-forest/20 bg-white px-4 pr-12 font-raleway text-sm text-forest placeholder:text-forest/40 focus:outline-none focus:ring-2 focus:ring-lime focus:ring-offset-1 aria-[invalid=true]:border-red-500"
            placeholder="Min. 8 caractères, 1 majuscule, 1 chiffre"
            {...register('password')}
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-forest/50 hover:text-forest transition-colors"
          >
            {showPassword ? <EyeOff size={18} aria-hidden /> : <Eye size={18} aria-hidden />}
          </button>
        </div>
        {/* Strength bar */}
        {passwordValue && (
          <div id="reg-password-strength" aria-live="polite" className="flex items-center gap-2 mt-1">
            <div className="flex gap-1 flex-1">
              {[1, 2, 3].map((level) => (
                <div
                  key={level}
                  className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${
                    strength >= level ? strengthColor[strength] : 'bg-forest/10'
                  }`}
                />
              ))}
            </div>
            <span className="text-xs font-raleway text-forest/60 w-12">
              {strengthLabel[strength]}
            </span>
          </div>
        )}
        {errors.password && (
          <p id="reg-password-error" role="alert" aria-live="polite" className="text-xs text-red-500">
            {errors.password.message}
          </p>
        )}
      </div>

      {/* Confirm password */}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="confirm" className="font-raleway text-sm font-medium text-forest">
          Confirmer le mot de passe
        </label>
        <div className="relative">
          <input
            id="confirm"
            type={showConfirm ? 'text' : 'password'}
            autoComplete="new-password"
            aria-invalid={!!errors.confirm}
            aria-describedby={errors.confirm ? 'confirm-error' : undefined}
            className="h-11 w-full rounded-lg border border-forest/20 bg-white px-4 pr-12 font-raleway text-sm text-forest placeholder:text-forest/40 focus:outline-none focus:ring-2 focus:ring-lime focus:ring-offset-1 aria-[invalid=true]:border-red-500"
            placeholder="••••••••"
            {...register('confirm')}
          />
          <button
            type="button"
            onClick={() => setShowConfirm((v) => !v)}
            aria-label={showConfirm ? 'Masquer la confirmation' : 'Afficher la confirmation'}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-forest/50 hover:text-forest transition-colors"
          >
            {showConfirm ? <EyeOff size={18} aria-hidden /> : <Eye size={18} aria-hidden />}
          </button>
        </div>
        {errors.confirm && (
          <p id="confirm-error" role="alert" aria-live="polite" className="text-xs text-red-500">
            {errors.confirm.message}
          </p>
        )}
      </div>

      {serverError && (
        <p role="alert" aria-live="polite" className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-600">
          {serverError}
        </p>
      )}

      <Button type="submit" variant="primary" size="lg" loading={isSubmitting} className="w-full mt-1">
        Créer mon compte
      </Button>
    </form>
  )
}
