// growi-frontend/app/(auth)/register/page.tsx
import type { Metadata } from 'next'
import Link from 'next/link'
import { Suspense } from 'react'
import { RegisterForm } from '@/components/auth/RegisterForm'

export const metadata: Metadata = {
  title: 'Inscription',
}

export default function RegisterPage() {
  return (
    <div className="w-full max-w-md bg-white rounded-2xl shadow-card p-8 flex flex-col gap-8">
      {/* Logo */}
      <div className="text-center">
        <Link
          href="/"
          className="font-poppins font-bold text-2xl text-forest hover:text-forest-light transition-colors"
          aria-label="Retour à l'accueil Growi"
        >
          Growi 🌱
        </Link>
      </div>

      {/* Heading */}
      <div className="text-center flex flex-col gap-2">
        <h1 className="font-poppins font-bold text-[1.75rem] leading-tight text-forest">
          Crée ton compte Growi.
        </h1>
        <p className="font-raleway text-sm text-forest/70">
          Gratuit pour commencer. Aucune carte requise.
        </p>
      </div>

      {/* `RegisterForm` lit `?plant=…` : sans cette frontière, `useSearchParams`
          empêcherait le prérendu statique de la page. */}
      <Suspense fallback={<div className="h-[26rem]" aria-hidden />}>
        <RegisterForm />
      </Suspense>

      {/* L'inscription vaut acceptation : la mention le dit sous le bouton, et
          le serveur en garde la trace (`termsAcceptedAt`, `termsVersion`). Pas
          de case à cocher — la loi ne l'exige pas (spec 13, D8). */}
      <p className="-mt-4 text-center font-raleway text-sm text-forest/60">
        En créant ton compte, tu acceptes les{' '}
        <Link
          href="/cgu"
          className="text-forest underline underline-offset-2 hover:text-forest-light"
        >
          CGU
        </Link>{' '}
        et la{' '}
        <Link
          href="/confidentialite"
          className="text-forest underline underline-offset-2 hover:text-forest-light"
        >
          politique de confidentialité
        </Link>
        .
      </p>

      {/* Login link */}
      <p className="text-center font-raleway text-sm text-forest/60">
        Déjà un compte ?{' '}
        <Link
          href="/login"
          className="text-forest font-medium underline underline-offset-2 hover:text-forest-light transition-colors"
        >
          Me connecter
        </Link>
      </p>
    </div>
  )
}
