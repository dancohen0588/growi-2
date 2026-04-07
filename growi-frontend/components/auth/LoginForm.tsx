// growi-frontend/components/auth/LoginForm.tsx
'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Eye, EyeOff } from 'lucide-react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { loginSchema, type LoginInput } from '@/lib/auth-schemas'

export function LoginForm() {
  const router = useRouter()
  const [showPassword, setShowPassword] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({ resolver: zodResolver(loginSchema) })

  async function onSubmit(data: LoginInput) {
    setServerError(null)
    const result = await signIn('credentials', {
      email: data.email,
      password: data.password,
      redirect: false,
    })

    if (result?.error) {
      setServerError('Email ou mot de passe incorrect. Réessaie.')
      return
    }
    router.push('/dashboard')
    router.refresh()
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      noValidate
      className="flex flex-col gap-5"
    >
      {/* Email */}
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="email"
          className="font-raleway text-sm font-medium text-forest"
        >
          Email
        </label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          aria-invalid={!!errors.email}
          aria-describedby={errors.email ? 'email-error' : undefined}
          className="h-11 rounded-lg border border-forest/20 bg-white px-4 font-raleway text-sm text-forest placeholder:text-forest/40 focus:outline-none focus:ring-2 focus:ring-lime focus:ring-offset-1 aria-[invalid=true]:border-red-500"
          placeholder="julie@exemple.com"
          {...register('email')}
        />
        {errors.email && (
          <p
            id="email-error"
            role="alert"
            aria-live="polite"
            className="text-xs text-red-500"
          >
            {errors.email.message}
          </p>
        )}
      </div>

      {/* Password */}
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="password"
          className="font-raleway text-sm font-medium text-forest"
        >
          Mot de passe
        </label>
        <div className="relative">
          <input
            id="password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="current-password"
            aria-invalid={!!errors.password}
            aria-describedby={errors.password ? 'password-error' : undefined}
            className="h-11 w-full rounded-lg border border-forest/20 bg-white px-4 pr-12 font-raleway text-sm text-forest placeholder:text-forest/40 focus:outline-none focus:ring-2 focus:ring-lime focus:ring-offset-1 aria-[invalid=true]:border-red-500"
            placeholder="••••••••"
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
        {errors.password && (
          <p
            id="password-error"
            role="alert"
            aria-live="polite"
            className="text-xs text-red-500"
          >
            {errors.password.message}
          </p>
        )}
      </div>

      {/* Server error */}
      {serverError && (
        <p
          role="alert"
          aria-live="polite"
          className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-600"
        >
          {serverError}
        </p>
      )}

      <Button
        type="submit"
        variant="primary"
        size="lg"
        loading={isSubmitting}
        className="w-full mt-1"
      >
        Se connecter
      </Button>
    </form>
  )
}
