import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import { notFound } from 'next/navigation'
import {
  ChevronRight, Droplets, Sun, Thermometer, Layers, Ruler, Scissors, AlertTriangle, Apple, Leaf,
} from 'lucide-react'
import { prisma } from '@/lib/prisma'
import { cn } from '@/lib/utils'

export const revalidate = 86400 // ISR: 24h
export const dynamicParams = true

export async function generateStaticParams() {
  const plants = await prisma.plantCatalog.findMany({
    where: { slug: { not: null } },
    select: { slug: true },
  })
  return plants
    .filter(p => !!p.slug)
    .map(p => ({ slug: p.slug! }))
}

export async function generateMetadata({
  params,
}: {
  params: { slug: string }
}): Promise<Metadata> {
  const plant = await prisma.plantCatalog.findUnique({
    where: { slug: params.slug },
    select: {
      commonName: true, scientificName: true, descriptionShort: true, imageUrl: true, slug: true,
    },
  })

  if (!plant) return { title: 'Plante introuvable — Growi' }

  const title = `${plant.commonName} | Encyclopédie Growi`
  const description = plant.descriptionShort
    ?? `Fiche complète de ${plant.commonName} (${plant.scientificName}) : entretien, arrosage, exposition et conseils.`

  return {
    title,
    description,
    alternates: { canonical: `/encyclopedie/${plant.slug}` },
    openGraph: {
      title,
      description,
      url: `/encyclopedie/${plant.slug}`,
      type: 'article',
      images: plant.imageUrl ? [{ url: plant.imageUrl, alt: plant.commonName }] : undefined,
    },
  }
}

export default async function PlantDetailPage({
  params,
}: {
  params: { slug: string }
}) {
  const plant = await prisma.plantCatalog.findUnique({
    where: { slug: params.slug },
  })

  if (!plant) notFound()

  const description = plant.descriptionLong ?? plant.descriptionShort ?? ''

  // Similar plants: same category, exclude self, top 3
  const similar = await prisma.plantCatalog.findMany({
    where: {
      category: plant.category,
      id:       { not: plant.id },
      slug:     { not: null },
    },
    select: {
      id: true, slug: true, commonName: true, emoji: true, imageUrl: true,
    },
    orderBy: { commonName: 'asc' },
    take: 3,
  })

  const addPlantHref = `/login?callbackUrl=${encodeURIComponent(
    `/dashboard/plantes/nouveau?catalogId=${plant.id}`,
  )}`

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Accueil', item: '/' },
      { '@type': 'ListItem', position: 2, name: 'Encyclopédie', item: '/encyclopedie' },
      { '@type': 'ListItem', position: 3, name: plant.commonName, item: `/encyclopedie/${plant.slug}` },
    ],
  }

  return (
    <article className="min-h-screen bg-sand">
      {/* eslint-disable-next-line @next/next/no-head-element */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* Hero image */}
      <section className="relative h-72 md:h-96 w-full overflow-hidden bg-lime/10">
        {plant.imageUrl ? (
          <Image
            src={plant.imageUrl}
            alt={plant.commonName}
            fill
            priority
            sizes="100vw"
            className="object-cover"
            quality={80}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-8xl">
            {plant.emoji ?? '🌿'}
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-forest/90 via-forest/30 to-transparent" />
        <div className="absolute inset-0 flex items-end">
          <div className="mx-auto w-full max-w-5xl px-4 pb-6 md:pb-10">
            <nav aria-label="Fil d'Ariane" className="mb-3">
              <ol className="flex items-center gap-1 font-raleway text-xs text-white/70">
                <li><Link href="/" className="hover:text-white">Accueil</Link></li>
                <li aria-hidden><ChevronRight size={12} /></li>
                <li><Link href="/encyclopedie" className="hover:text-white">Encyclopédie</Link></li>
                <li aria-hidden><ChevronRight size={12} /></li>
                <li className="text-white font-semibold truncate">{plant.commonName}</li>
              </ol>
            </nav>
            <h1 className="font-poppins font-bold text-3xl md:text-5xl text-white leading-tight">
              {plant.emoji ?? '🌿'} {plant.commonName}
            </h1>
            <p className="font-raleway italic text-white/80 mt-1 text-base md:text-lg">
              {plant.scientificName}
              {plant.family && <> · <span className="not-italic">{plant.family}</span></>}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {plant.toxic && <Badge variant="danger">⚠️ Toxique</Badge>}
              {plant.edible && <Badge variant="success">🍽️ Comestible</Badge>}
              {plant.indoor && <Badge>🏠 Intérieur</Badge>}
              {plant.outdoor && <Badge>🌳 Extérieur</Badge>}
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-5xl px-4 py-10">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main content */}
          <div className="lg:col-span-2 space-y-8">
            {/* Description */}
            {description && (
              <section>
                <h2 className="font-poppins font-bold text-xl text-forest mb-3">
                  À propos de cette plante
                </h2>
                <p className="font-raleway text-sm text-forest/80 leading-relaxed whitespace-pre-line">
                  {description}
                </p>
              </section>
            )}

            {/* Care guide */}
            <section className="rounded-2xl bg-white shadow-card p-6">
              <h2 className="font-poppins font-bold text-xl text-forest mb-4 flex items-center gap-2">
                <Leaf size={20} aria-hidden className="text-lime-hover" />
                Guide d&apos;entretien
              </h2>
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <CareRow icon={<Droplets size={16} />} label="Arrosage" value={`Tous les ${plant.wateringFreqDays} jour${plant.wateringFreqDays > 1 ? 's' : ''}`} />
                <CareRow icon={<Sun size={16} />} label="Exposition" value={sunLabel(plant.sunExposure)} />
                <CareRow
                  icon={<Thermometer size={16} />}
                  label="Température"
                  value={
                    plant.minTempCelsius != null && plant.maxTempCelsius != null
                      ? `${plant.minTempCelsius}°C – ${plant.maxTempCelsius}°C`
                      : plant.hardinesZone ?? '—'
                  }
                />
                <CareRow icon={<Layers size={16} />} label="Substrat" value={plant.soilTypes ?? '—'} />
                <CareRow icon={<Ruler size={16} />} label="Difficulté" value={difficultyLabel(plant.wateringDifficulty)} />
                <CareRow icon={<Scissors size={16} />} label="Engrais" value={plant.fertilizerMonths ?? '—'} />
              </dl>
            </section>

            {/* Cultural calendar */}
            {plant.fertilizerMonths && (
              <section className="rounded-2xl bg-white shadow-card p-6">
                <h2 className="font-poppins font-bold text-xl text-forest mb-3">
                  Calendrier cultural
                </h2>
                <CulturalCalendar months={plant.fertilizerMonths} />
              </section>
            )}

            {/* Beneficial associations (placeholder) */}
            <section className="rounded-2xl bg-white shadow-card p-6">
              <h2 className="font-poppins font-bold text-xl text-forest mb-2">
                Associations bénéfiques
              </h2>
              <p className="font-raleway text-sm text-forest/60">
                {plant.tags
                  ? <span className="whitespace-pre-line">{plant.tags}</span>
                  : "Nos recommandations de compagnonnage arrivent bientôt 🌱"}
              </p>
            </section>
          </div>

          {/* Sidebar */}
          <aside className="space-y-6">
            {/* CTA */}
            <div className="rounded-2xl bg-gradient-to-br from-lime/20 to-sand border-2 border-lime/40 p-5 shadow-card">
              <p className="font-poppins font-bold text-sm text-forest mb-1">
                Garde cette plante sous la main
              </p>
              <p className="font-raleway text-xs text-forest/60 mb-4">
                Ajoute-la à ton jardin pour recevoir des rappels d&apos;arrosage personnalisés.
              </p>
              <Link
                href={addPlantHref}
                className="block w-full rounded-xl bg-lime hover:bg-lime-hover text-forest font-poppins font-semibold text-sm text-center py-3 shadow-cta transition-all hover:-translate-y-0.5"
              >
                + Ajouter à mon jardin
              </Link>
            </div>

            {/* Quick facts */}
            <div className="rounded-2xl bg-white shadow-card p-5">
              <h3 className="font-poppins font-bold text-sm text-forest mb-3 uppercase tracking-wide">
                En un coup d&apos;œil
              </h3>
              <dl className="space-y-2">
                <QuickFact label="Catégorie" value={categoryLabel(plant.category)} />
                {plant.family && <QuickFact label="Famille" value={plant.family} />}
                <QuickFact label="Arrosage" value={`Tous les ${plant.wateringFreqDays}j`} />
                <QuickFact label="Difficulté" value={difficultyLabel(plant.wateringDifficulty)} />
                {plant.toxic && (
                  <div className="mt-3 flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 p-2">
                    <AlertTriangle size={14} aria-hidden className="shrink-0 text-red-500 mt-0.5" />
                    <p className="font-raleway text-[11px] text-red-700">
                      Plante toxique — à tenir éloignée des enfants et animaux.
                    </p>
                  </div>
                )}
                {plant.edible && (
                  <div className="mt-3 flex items-start gap-2 rounded-lg bg-lime/10 border border-lime/40 p-2">
                    <Apple size={14} aria-hidden className="shrink-0 text-lime-hover mt-0.5" />
                    <p className="font-raleway text-[11px] text-forest">Plante comestible.</p>
                  </div>
                )}
              </dl>
            </div>

            {/* Similar plants */}
            {similar.length > 0 && (
              <div className="rounded-2xl bg-white shadow-card p-5">
                <h3 className="font-poppins font-bold text-sm text-forest mb-3 uppercase tracking-wide">
                  Plantes similaires
                </h3>
                <ul className="space-y-2">
                  {similar.map(s => (
                    <li key={s.id}>
                      <Link
                        href={`/encyclopedie/${s.slug}`}
                        className="flex items-center gap-3 rounded-lg p-2 hover:bg-sand transition-colors"
                      >
                        <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-lg bg-lime/10">
                          {s.imageUrl ? (
                            <Image
                              src={s.imageUrl}
                              alt=""
                              fill
                              sizes="44px"
                              className="object-cover"
                              quality={60}
                            />
                          ) : (
                            <span className="absolute inset-0 flex items-center justify-center text-xl">{s.emoji ?? '🌿'}</span>
                          )}
                        </div>
                        <span className="font-raleway text-xs font-semibold text-forest truncate">
                          {s.commonName}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </aside>
        </div>
      </div>
    </article>
  )
}

// ── Sub components ────────────────────────────────────────────────────────

function Badge({ children, variant = 'default' }: { children: React.ReactNode; variant?: 'default' | 'success' | 'danger' }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 font-raleway text-[11px] font-semibold backdrop-blur-sm',
        variant === 'default' && 'bg-white/20 text-white',
        variant === 'success' && 'bg-lime/90 text-forest',
        variant === 'danger'  && 'bg-red-500/90 text-white',
      )}
    >
      {children}
    </span>
  )
}

function CareRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3 rounded-lg bg-sand/60 px-3 py-2">
      <span className="shrink-0 text-forest/60 mt-0.5">{icon}</span>
      <div className="min-w-0">
        <dt className="font-raleway text-[10px] font-semibold uppercase tracking-wide text-forest/50">{label}</dt>
        <dd className="font-raleway text-sm text-forest mt-0.5 break-words">{value}</dd>
      </div>
    </div>
  )
}

function QuickFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-forest/5 pb-1.5 last:border-0">
      <dt className="font-raleway text-[11px] text-forest/50">{label}</dt>
      <dd className="font-raleway text-xs font-semibold text-forest">{value}</dd>
    </div>
  )
}

function CulturalCalendar({ months }: { months: string }) {
  const MONTHS = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D']
  const active = new Set(
    months
      .split(/[,\s]+/)
      .map(s => parseInt(s, 10))
      .filter(n => n >= 1 && n <= 12),
  )
  return (
    <div className="flex gap-1">
      {MONTHS.map((m, i) => {
        const monthIdx = i + 1
        const isActive = active.has(monthIdx)
        return (
          <div
            key={i}
            className={cn(
              'flex-1 h-10 rounded-md flex items-center justify-center font-poppins text-xs font-semibold',
              isActive ? 'bg-lime text-forest' : 'bg-sand text-forest/30',
            )}
            aria-label={`Mois ${monthIdx}${isActive ? ' actif' : ''}`}
          >
            {m}
          </div>
        )
      })}
    </div>
  )
}

function sunLabel(s: string): string {
  return ({ FULL_SUN: '☀️ Plein soleil', PARTIAL: '⛅ Mi-ombre', SHADE: '🌥️ Ombre' } as Record<string, string>)[s] ?? s
}

function difficultyLabel(d: string): string {
  return ({ EASY: '🟢 Facile', MEDIUM: '🟡 Moyen', DEMANDING: '🔴 Exigeant' } as Record<string, string>)[d] ?? d
}

function categoryLabel(c: string): string {
  const map: Record<string, string> = {
    INDOOR:       'Intérieur',
    VEGETABLE:    'Potager',
    FLOWERS:      'Fleurs',
    TREES_SHRUBS: 'Arbres & arbustes',
    HERBS:        'Aromatiques',
    SUCCULENTS:   'Succulentes',
    AQUATIC:      'Aquatiques',
    CLIMBING:     'Grimpantes',
  }
  return map[c] ?? c
}
