// growi-frontend/app/(auth)/login/page.tsx
import type { Metadata } from 'next'
import Link from 'next/link'
import { LoginForm } from '@/components/auth/LoginForm'

export const metadata: Metadata = {
  title: 'Connexion',
}

export default function LoginPage() {
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
          Bon retour dans ton jardin.
        </h1>
      </div>

      <LoginForm />

      {/* Register link */}
      <p className="text-center font-raleway text-sm text-forest/60">
        Pas encore de compte ?{' '}
        <Link
          href="/register"
          className="text-forest font-medium underline underline-offset-2 hover:text-forest-light transition-colors"
        >
          Créer mon compte
        </Link>
      </p>
    </div>
  )
}
