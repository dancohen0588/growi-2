import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { AppMockup } from '@/components/ui/app-mockup'

const featureBadges = [
  { icon: '🌧️', label: 'Météo connectée', className: 'bg-white shadow-card' },
  { icon: '✅', label: 'Rappel arrosage',   className: 'bg-lime/20' },
  { icon: '📷', label: 'Diagnostic IA',      className: 'bg-sun/20' },
]

export function HeroSection() {
  return (
    <section
      className="bg-gradient-to-br from-sand via-sand to-lime/30 py-20 md:py-28"
      aria-label="Hero"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">

          {/* Left column: text */}
          <div className="flex flex-col gap-6">
            <h1 className="font-poppins font-bold text-forest text-4xl md:text-[3.5rem] leading-tight">
              Ton jardin,<br />ta croissance.
            </h1>
            <p className="font-raleway text-forest/70 text-xl max-w-lg leading-relaxed">
              L&apos;assistant intelligent qui t&apos;aide à entretenir ton jardin
              jour après jour, selon la météo et tes plantes.
            </p>

            {/* CTAs */}
            <div className="flex flex-wrap gap-4">
              <Button variant="primary" size="lg" asChild>
                <Link href="/tarifs">Essayer gratuitement</Link>
              </Button>
              <Button variant="outline" size="lg" asChild>
                <Link href="/fonctionnalites">Voir les fonctionnalités</Link>
              </Button>
            </div>

            {/* Feature badges */}
            <div className="flex flex-wrap gap-3">
              {featureBadges.map((badge) => (
                <span
                  key={badge.label}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-raleway font-semibold text-forest ${badge.className}`}
                >
                  <span aria-hidden="true">{badge.icon}</span>
                  {badge.label}
                </span>
              ))}
            </div>

            {/* Social proof */}
            <p className="text-sm text-forest/60 font-raleway" aria-label="Avis utilisateurs">
              <span aria-hidden="true">⭐⭐⭐⭐⭐</span>
              {' '}+12 000 jardiniers nous font confiance
            </p>
          </div>

          {/* Right column: mockup */}
          <div className="flex items-center justify-center">
            <AppMockup />
          </div>
        </div>
      </div>
    </section>
  )
}
