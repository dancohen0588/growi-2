import { GrowiLoader } from '@/components/ui/growi-loader'
import { cn } from '@/lib/utils'

/**
 * Squelettes des pages du tableau de bord, montrés par `app/dashboard/
 * loading.tsx` pendant qu'une page se calcule côté serveur.
 *
 * Chacun reprend l'encombrement de la page réelle (grille de cartes, colonnes,
 * fil) : à l'arrivée des données, rien ne saute. Le titre est déjà écrit — il
 * ne dépend d'aucune donnée — pour que l'on sache tout de suite où l'on va.
 */

function Block({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-lg bg-sand-dark', className)} />
}

function Header({ title }: { title: string }) {
  return (
    <div className="flex items-start justify-between gap-4 flex-wrap">
      <div className="flex flex-col gap-2">
        <h1 className="font-poppins font-bold text-[1.75rem] text-forest">{title}</h1>
        <Block className="h-4 w-56 max-w-[70vw]" />
      </div>
      <GrowiLoader motion="balance" size={36} label={null} className="mt-1 opacity-80" />
    </div>
  )
}

/** Grille de cartes avec vignette : Mes plantes, catalogue. */
export function CardGridSkeleton({ title, count = 6 }: { title: string; count?: number }) {
  return (
    <div className="flex flex-col gap-6" aria-busy="true">
      <Header title={title} />
      <div className="flex flex-wrap gap-2">
        <Block className="h-10 w-28 rounded-full" />
        <Block className="h-10 w-28 rounded-full" />
        <Block className="h-10 w-28 rounded-full" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: count }, (_, i) => (
          <div key={i} className="flex flex-col gap-3 rounded-2xl bg-white p-4 shadow-card">
            <Block className="aspect-[4/3] w-full rounded-xl" />
            <Block className="h-5 w-2/3" />
            <Block className="h-4 w-1/2" />
          </div>
        ))}
      </div>
    </div>
  )
}

/** Calendrier : trois horizons, des cartes d'action. */
export function CalendarSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true">
      <Header title="Calendrier" />
      {['Aujourd’hui', 'Cette semaine', 'Ce mois-ci'].map((label, section) => (
        <section key={label} className="flex flex-col gap-3">
          <h2 className="font-poppins font-semibold text-lg text-forest">{label}</h2>
          <div className={section === 0 ? 'grid gap-4 sm:grid-cols-2 xl:grid-cols-3' : 'flex flex-col gap-3'}>
            {Array.from({ length: section === 0 ? 3 : 2 }, (_, i) => (
              <div key={i} className="flex items-center gap-3 rounded-2xl bg-white p-4 shadow-card">
                <Block className="h-12 w-12 shrink-0 rounded-xl" />
                <div className="flex flex-1 flex-col gap-2">
                  <Block className="h-4 w-3/4" />
                  <Block className="h-3 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}

/** Fil de la communauté : publications photo. */
export function FeedSkeleton() {
  return (
    <div className="flex flex-col gap-6 max-w-2xl" aria-busy="true">
      <Header title="Communauté" />
      {Array.from({ length: 2 }, (_, i) => (
        <article key={i} className="flex flex-col gap-3 rounded-2xl bg-white p-4 shadow-card">
          <div className="flex items-center gap-3">
            <Block className="h-10 w-10 rounded-full" />
            <div className="flex flex-col gap-2">
              <Block className="h-4 w-32" />
              <Block className="h-3 w-20" />
            </div>
          </div>
          <Block className="aspect-square w-full rounded-xl" />
          <Block className="h-4 w-4/5" />
        </article>
      ))}
    </div>
  )
}

/** Fiche d'une plante : photo, gestes rapides, sections. */
export function DetailSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true">
      <div className="flex items-center justify-between gap-4">
        <Block className="h-8 w-64 max-w-[60vw]" />
        <GrowiLoader motion="balance" size={36} label={null} className="opacity-80" />
      </div>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <Block className="aspect-[4/3] w-full rounded-2xl" />
        <div className="flex flex-col gap-4">
          <div className="flex gap-2">
            <Block className="h-11 flex-1 rounded-xl" />
            <Block className="h-11 flex-1 rounded-xl" />
            <Block className="h-11 flex-1 rounded-xl" />
          </div>
          <Block className="h-28 w-full rounded-2xl" />
          <Block className="h-40 w-full rounded-2xl" />
        </div>
      </div>
    </div>
  )
}

/** Toute autre page : un titre, un bloc, une grille. */
export function PageSkeleton({ title }: { title?: string }) {
  return (
    <div className="flex flex-col gap-6" aria-busy="true">
      {title ? <Header title={title} /> : (
        <div className="flex items-center justify-between gap-4">
          <Block className="h-8 w-64 max-w-[60vw]" />
          <GrowiLoader motion="balance" size={36} label={null} className="opacity-80" />
        </div>
      )}
      <Block className="h-32 w-full rounded-2xl" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 3 }, (_, i) => (
          <Block key={i} className="h-28 rounded-2xl" />
        ))}
      </div>
    </div>
  )
}

/** Le plan du jardin : un seul grand plan, la pousse au milieu. */
export function GardenSkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-busy="true">
      <Header title="Mon jardin" />
      <div className="flex min-h-[420px] items-center justify-center rounded-2xl bg-white shadow-card">
        <GrowiLoader motion="balance" size={64} label="Chargement de ton jardin" />
      </div>
    </div>
  )
}
