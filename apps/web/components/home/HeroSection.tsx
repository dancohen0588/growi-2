import Image from 'next/image'
import Link from 'next/link'
import { ScanSearch } from 'lucide-react'
import { Button } from '@/components/ui/button'

const featureBadges = [
  { icon: '🌧️', label: 'Météo connectée',        className: 'bg-white shadow-card' },
  { icon: '🔔', label: 'Rappels au bon moment',  className: 'bg-lime/25' },
  { icon: '📷', label: 'Diagnostic photo',       className: 'bg-sun/25' },
]

export function HeroSection() {
  return (
    <section
      className="relative isolate overflow-hidden bg-forest py-16 md:py-24"
      aria-label="Hero"
    >
      {/* La photo occupe tout le hero, dans le bon sens. L'ancien dégradé blanc
          opaque effaçait son tiers gauche : on voyait une page blanche avec une
          photo collée à droite, alors que c'est un vrai potager. */}
      <Image
        src="/images/homepage-hero.png"
        alt=""
        fill
        priority
        sizes="100vw"
        quality={85}
        className="-z-10 object-cover object-center"
      />

      {/* Voile forest en haut pour asseoir le header, fondu vers le sable en bas
          pour éviter la coupure nette avec la section suivante. */}
      <div
        aria-hidden
        className="absolute inset-0 -z-10 bg-[linear-gradient(180deg,rgba(21,63,36,0.35)_0%,rgba(21,63,36,0)_30%,rgba(249,247,232,0)_78%,#F9F7E8_100%)]"
      />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 items-center gap-10 md:grid-cols-[1.05fr_0.95fr]">

          {/* Panneau sable translucide : la lisibilité sans cacher l'image. */}
          <div className="rounded-3xl border border-white/50 bg-sand/[0.86] p-7 shadow-[0_20px_60px_rgba(21,63,36,0.25)] backdrop-blur-lg sm:p-10">
            <h1 className="font-poppins text-4xl font-bold leading-tight text-forest md:text-[3.5rem]">
              Tes plantes,<br />ta croissance.
            </h1>
            <p className="mt-4 max-w-lg font-raleway text-xl leading-relaxed text-forest/70">
              L&apos;assistant intelligent qui t&apos;aide à entretenir ton jardin
              jour après jour, selon la météo et tes plantes.
            </p>

            <div className="mt-6 flex flex-wrap gap-4">
              <Button variant="primary" size="lg" asChild>
                <Link href="/register">Créer mon jardin</Link>
              </Button>
              <Button variant="outline" size="lg" asChild>
                <Link href="/fonctionnalites">Voir les fonctionnalités</Link>
              </Button>
            </div>

            {/* Le teaser menait à `/dashboard/identifier`, donc au login : on
                promettait « gratuit » et on demandait un compte. Il mène
                maintenant à la page publique, où c'est vrai. */}
            <Link
              href="/identifier"
              className="group mt-6 flex max-w-md items-center gap-3.5 rounded-2xl border border-forest/15 bg-white p-3 pr-4 shadow-card transition-colors hover:border-forest/40"
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-forest text-white">
                <ScanSearch size={22} aria-hidden />
              </span>
              <span className="flex flex-col">
                <span className="font-poppins text-sm font-semibold text-forest">
                  Identifie une plante en photo
                </span>
                <span className="font-raleway text-xs text-forest/80">
                  Sans compte · gratuit · résultat en quelques secondes
                </span>
              </span>
              <span className="ml-auto shrink-0 text-lg text-forest/40 transition-colors group-hover:text-forest">
                →
              </span>
            </Link>

            <div className="mt-5 flex flex-wrap gap-2.5">
              {featureBadges.map((badge) => (
                <span
                  key={badge.label}
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 font-raleway text-sm font-semibold text-forest ${badge.className}`}
                >
                  <span aria-hidden="true">{badge.icon}</span>
                  {badge.label}
                </span>
              ))}
            </div>

            <p className="mt-4 font-raleway text-sm text-forest/80">
              Gratuit · Sans carte bancaire · Sur le web aujourd&apos;hui, sur
              iPhone bientôt
            </p>
          </div>

          {/* Capture réelle de l'écran Calendrier. Le cadre du téléphone est
              fait ici : l'image ne porte que le contenu de l'écran. */}
          <div className="relative flex justify-center">
            <div className="w-[240px] overflow-hidden rounded-[2rem] bg-black shadow-[0_40px_80px_rgba(0,0,0,0.45),0_0_0_1px_rgba(255,255,255,0.15)] sm:w-[280px]">
              <Image
                src="/images/app/app-calendrier.webp"
                alt="L'écran Calendrier de Growi : les gestes à faire aujourd'hui, demain et plus tard"
                width={800}
                height={1694}
                sizes="(max-width: 640px) 240px, 280px"
                className="block h-auto w-full"
                priority
              />
            </div>

            <div className="mt-4 max-w-[260px] rounded-2xl bg-white p-4 shadow-card md:absolute md:-left-2 md:top-16 md:mt-0">
              <p className="mb-1.5 flex items-center gap-1.5 font-poppins text-xs font-semibold uppercase tracking-wide text-forest/80">
                <span className="h-2 w-2 rounded-full bg-sun" aria-hidden />
                Ce soir · alerte gel
              </p>
              <p className="font-raleway text-sm leading-snug text-forest/80">
                &minus;2 °C prévus cette nuit à Lyon. Le citronnier et le basilic
                sont à rentrer.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
