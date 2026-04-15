import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import { Leaf, AlertTriangle, Apple } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import { cn } from '@/lib/utils'
import { EncyclopedieSearch } from './_components/EncyclopedieSearch'
import { EncyclopedieFilters } from './_components/EncyclopedieFilters'
import { AlphaNav } from './_components/AlphaNav'

export const revalidate = 86400 // ISR: 24h

export const metadata: Metadata = {
  title: 'Encyclopédie des plantes — Growi',
  description:
    "Explore plus de 527 plantes de jardin et d'intérieur : guide d'entretien, arrosage, exposition, toxicité. Une encyclopédie gratuite et complète signée Growi.",
  alternates: { canonical: '/encyclopedie' },
  openGraph: {
    title: 'Encyclopédie des plantes — Growi',
    description:
      "Explore plus de 527 plantes de jardin et d'intérieur. Conseils d'entretien, arrosage, exposition.",
    url: '/encyclopedie',
    type: 'website',
  },
}

const PAGE_SIZE = 48

interface PageProps {
  searchParams?: {
    category?: string
    sun?:      string
    q?:        string
    letter?:   string
    sort?:     string
    page?:     string
  }
}

function buildOrderBy(sort: string) {
  switch (sort) {
    case 'difficulty_asc':
      return [{ wateringDifficulty: 'asc' as const }, { commonName: 'asc' as const }]
    case 'watering_asc':
      return [{ wateringFreqDays: 'asc' as const }, { commonName: 'asc' as const }]
    case 'name_asc':
    default:
      return { commonName: 'asc' as const }
  }
}

export default async function EncyclopediePage({ searchParams = {} }: PageProps) {
  const category = searchParams.category ?? 'all'
  const sun      = searchParams.sun ?? 'all'
  const q        = (searchParams.q ?? '').trim()
  const letter   = (searchParams.letter ?? '').trim()
  const sort     = searchParams.sort ?? 'name_asc'
  const page     = Math.max(1, Number(searchParams.page) || 1)

  const where = {
    AND: [
      category !== 'all' ? { category } : {},
      sun !== 'all'      ? { sunExposure: sun } : {},
      q
        ? {
            OR: [
              { commonName:     { contains: q, mode: 'insensitive' as const } },
              { scientificName: { contains: q, mode: 'insensitive' as const } },
            ],
          }
        : {},
      letter ? { commonName: { startsWith: letter, mode: 'insensitive' as const } } : {},
      { slug: { not: null } },
    ],
  }

  const [plants, total, edibleCount, toxicCount, lettersData] = await Promise.all([
    prisma.plantCatalog.findMany({
      where,
      select: {
        id: true, slug: true, commonName: true, scientificName: true,
        emoji: true, imageUrl: true, category: true,
        wateringFreqDays: true, wateringDifficulty: true,
        edible: true, toxic: true,
      },
      orderBy: buildOrderBy(sort),
      take: PAGE_SIZE,
      skip: (page - 1) * PAGE_SIZE,
    }),
    prisma.plantCatalog.count({ where }),
    prisma.plantCatalog.count({ where: { ...where, edible: true } }),
    prisma.plantCatalog.count({ where: { ...where, toxic: true } }),
    prisma.plantCatalog.findMany({
      where: { slug: { not: null } },
      select: { commonName: true },
      orderBy: { commonName: 'asc' },
    }),
  ])

  // Compute active letters from the full catalog (independent of filters so the nav stays useful)
  const activeLetters = Array.from(
    new Set(
      lettersData
        .map(p => p.commonName.normalize('NFD').replace(/[\u0300-\u036f]/g, '')[0]?.toUpperCase())
        .filter((c): c is string => !!c && /^[A-Z]$/.test(c)),
    ),
  )

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const hasActiveFilter = category !== 'all' || sun !== 'all' || !!q || !!letter

  return (
    <div className="min-h-screen bg-sand">
      {/* Hero */}
      <section className="bg-gradient-to-b from-lime/20 to-sand px-4 pt-16 pb-10 md:pt-24 md:pb-14">
        <div className="mx-auto max-w-5xl text-center">
          <p className="font-raleway text-xs font-semibold uppercase tracking-[0.2em] text-forest/50 mb-3">
            📚 Encyclopédie Growi
          </p>
          <h1 className="font-poppins font-bold text-3xl md:text-5xl text-forest leading-tight mb-3">
            Découvre plus de {lettersData.length.toLocaleString('fr-FR')} plantes
          </h1>
          <p className="font-raleway text-base md:text-lg text-forest/70 mb-8 max-w-2xl mx-auto">
            Guides d&apos;entretien, arrosage, exposition, toxicité. Une référence libre et
            complète pour tous les amoureux du jardin.
          </p>
          <EncyclopedieSearch />
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-4 py-8">
        {/* Stats bar */}
        <div className="flex flex-wrap items-center justify-center gap-4 rounded-2xl bg-white shadow-card px-6 py-4 mb-6">
          <StatBadge icon={<Leaf size={16} className="text-forest" />} label="Plantes" value={total.toLocaleString('fr-FR')} />
          <div className="h-6 w-px bg-forest/10" aria-hidden />
          <StatBadge icon={<Apple size={16} className="text-lime-hover" />} label="Comestibles" value={edibleCount.toLocaleString('fr-FR')} />
          <div className="h-6 w-px bg-forest/10" aria-hidden />
          <StatBadge icon={<AlertTriangle size={16} className="text-red-500" />} label="Toxiques" value={toxicCount.toLocaleString('fr-FR')} />
        </div>

        {/* Filters */}
        <div className="rounded-2xl bg-white shadow-card p-5 mb-6">
          <EncyclopedieFilters />
        </div>

        {/* Alpha nav */}
        <AlphaNav activeLetters={activeLetters} />

        {/* Results */}
        <div className="mt-6">
          {plants.length === 0 ? (
            <div className="rounded-2xl bg-white shadow-card p-10 text-center">
              <span className="block text-5xl mb-3" aria-hidden>🌱</span>
              <p className="font-poppins font-semibold text-forest mb-1">
                Aucune plante ne correspond à tes critères
              </p>
              <p className="font-raleway text-sm text-forest/60">
                Essaie de modifier les filtres ou la recherche.
              </p>
              {hasActiveFilter && (
                <Link
                  href="/encyclopedie"
                  className="mt-4 inline-block rounded-full bg-lime px-5 py-2 font-poppins font-semibold text-xs text-forest hover:bg-lime-hover transition-colors"
                >
                  Réinitialiser les filtres
                </Link>
              )}
            </div>
          ) : (
            <>
              <p className="font-raleway text-xs text-forest/50 mb-4">
                {total.toLocaleString('fr-FR')} plante{total > 1 ? 's' : ''} — page {page} / {totalPages}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                {plants.map((plant, i) => (
                  <PlantCard key={plant.id} plant={plant} priority={i < 4} />
                ))}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 mt-10">
                  <PageLink
                    searchParams={searchParams}
                    page={Math.max(1, page - 1)}
                    disabled={page === 1}
                    label="← Précédent"
                  />
                  <span className="font-raleway text-xs text-forest/60 px-3">
                    {page} / {totalPages}
                  </span>
                  <PageLink
                    searchParams={searchParams}
                    page={Math.min(totalPages, page + 1)}
                    disabled={page === totalPages}
                    label="Suivant →"
                  />
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Card component ────────────────────────────────────────────────────────

type PlantCardData = {
  id: string
  slug: string | null
  commonName: string
  scientificName: string
  emoji: string | null
  imageUrl: string | null
  category: string
  wateringFreqDays: number
  wateringDifficulty: string
  edible: boolean
  toxic: boolean
}

function PlantCard({ plant, priority }: { plant: PlantCardData; priority: boolean }) {
  const sunDiff =
    plant.wateringDifficulty === 'EASY' ? '🟢' :
    plant.wateringDifficulty === 'MEDIUM' ? '🟡' : '🔴'

  return (
    <Link
      href={`/encyclopedie/${plant.slug}`}
      className="group flex flex-col rounded-2xl bg-white shadow-card hover:shadow-card-hover transition-all overflow-hidden"
    >
      <div className="relative aspect-[3/2] w-full bg-lime/10 overflow-hidden">
        {plant.imageUrl ? (
          <Image
            src={plant.imageUrl}
            alt={plant.commonName}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
            className="object-cover group-hover:scale-105 transition-transform duration-300"
            quality={75}
            priority={priority}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-5xl">
            {plant.emoji ?? '🌿'}
          </div>
        )}
        {plant.toxic && (
          <span className="absolute top-2 right-2 inline-flex items-center gap-1 rounded-md bg-red-500/90 text-white px-1.5 py-0.5 font-raleway text-[10px] font-semibold backdrop-blur-sm">
            ⚠️ Toxique
          </span>
        )}
        {plant.edible && !plant.toxic && (
          <span className="absolute top-2 right-2 inline-flex items-center gap-1 rounded-md bg-lime-hover/90 text-forest px-1.5 py-0.5 font-raleway text-[10px] font-semibold backdrop-blur-sm">
            🍽️ Comestible
          </span>
        )}
      </div>
      <div className="flex-1 p-4">
        <h3 className="font-poppins font-bold text-sm text-forest leading-tight group-hover:text-lime-hover transition-colors">
          {plant.emoji ?? '🌿'} {plant.commonName}
        </h3>
        <p className="font-raleway italic text-[11px] text-forest/50 mt-0.5 truncate">
          {plant.scientificName}
        </p>
        <div className="mt-3 flex flex-wrap gap-1">
          <Tag>{categoryLabel(plant.category)}</Tag>
          <Tag>💧 {plant.wateringFreqDays}j</Tag>
          <Tag>{sunDiff}</Tag>
        </div>
      </div>
    </Link>
  )
}

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-md bg-sand px-1.5 py-0.5 font-raleway text-[10px] font-medium text-forest/60">
      {children}
    </span>
  )
}

function StatBadge({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="shrink-0">{icon}</span>
      <div>
        <p className="font-poppins font-bold text-base text-forest leading-none">{value}</p>
        <p className="font-raleway text-[10px] uppercase tracking-wide text-forest/50">{label}</p>
      </div>
    </div>
  )
}

function PageLink({
  searchParams,
  page,
  disabled,
  label,
}: {
  searchParams: PageProps['searchParams']
  page: number
  disabled: boolean
  label: string
}) {
  const params = new URLSearchParams()
  for (const [k, v] of Object.entries(searchParams ?? {})) {
    if (v && k !== 'page') params.set(k, String(v))
  }
  if (page > 1) params.set('page', String(page))

  return (
    <Link
      href={`/encyclopedie${params.toString() ? `?${params.toString()}` : ''}`}
      aria-disabled={disabled}
      tabIndex={disabled ? -1 : 0}
      className={cn(
        'rounded-full border px-4 py-2 font-poppins text-xs font-semibold transition-colors',
        disabled
          ? 'border-forest/10 text-forest/30 pointer-events-none'
          : 'border-forest/20 text-forest hover:bg-lime hover:border-lime',
      )}
    >
      {label}
    </Link>
  )
}

function categoryLabel(c: string): string {
  const map: Record<string, string> = {
    INDOOR:       'Intérieur',
    VEGETABLE:    'Potager',
    FLOWERS:      'Fleurs',
    TREES_SHRUBS: 'Arbre',
    HERBS:        'Aromatique',
    SUCCULENTS:   'Succulente',
    AQUATIC:      'Aquatique',
    CLIMBING:     'Grimpante',
  }
  return map[c] ?? c
}
