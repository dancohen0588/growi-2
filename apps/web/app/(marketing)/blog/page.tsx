import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Blog — Growi',
  description: 'Conseils jardinage, guides saisonniers et actualités Growi. Bientôt disponible !',
}

export default function BlogPage() {
  return (
    <section className="bg-sand min-h-[70vh] flex items-center justify-center relative overflow-hidden">
      {/* Decorative blobs */}
      <div
        aria-hidden
        className="absolute -top-20 -right-20 w-80 h-80 rounded-full bg-gradient-to-bl from-lime/20 to-forest/10 blur-3xl pointer-events-none"
      />
      <div
        aria-hidden
        className="absolute bottom-0 left-0 w-64 h-64 rounded-full bg-gradient-to-tr from-sun/15 to-lime/10 blur-2xl pointer-events-none"
      />

      <div className="relative max-w-lg mx-auto px-6 py-20 text-center flex flex-col items-center gap-6">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-lime/20 text-4xl">
          📖
        </div>

        <div className="flex flex-col gap-3">
          <h1 className="font-poppins font-bold text-forest text-3xl md:text-4xl leading-tight">
            Blog
          </h1>
          <p className="font-raleway text-forest/70 text-base md:text-lg leading-relaxed">
            Cette section arrive bientôt. Reste connecté pour ne pas rater le lancement&nbsp;!
          </p>
        </div>

        <Link
          href="/"
          className="inline-block rounded-lg bg-forest text-sand font-poppins font-semibold text-sm px-6 py-3 hover:bg-forest/90 transition-colors shadow-cta"
        >
          ← Retour à l'accueil
        </Link>
      </div>
    </section>
  )
}
