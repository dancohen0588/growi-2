'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Leaf, AlertTriangle, Apple } from 'lucide-react'
import { cn } from '@/lib/utils'
import { EncyclopedieSearch } from './EncyclopedieSearch'
import { EncyclopedieFilters } from './EncyclopedieFilters'
import { AlphaNav } from './AlphaNav'

export interface EncyclopediaPlant {
  id:                 string
  slug:               string
  commonName:         string
  scientificName:     string
  emoji:              string | null
  imageUrl:           string | null
  category:           string
  wateringFreqDays:   number
  wateringDifficulty: string
  sunExposure:        string
  edible:             boolean
  toxic:              boolean
}

interface InitialState {
  category: string
  sun:      string
  q:        string
  letter:   string
  sort:     string
  page:     number
}

const PAGE_SIZE = 48

interface Props {
  plants:  EncyclopediaPlant[]
  initial: InitialState
}

export function EncyclopedieClient({ plants, initial }: Props) {
  const [category, setCategory] = useState(initial.category)
  const [sun, setSun]           = useState(initial.sun)
  const [query, setQuery]       = useState(initial.q)
  const [letter, setLetter]     = useState(initial.letter)
  const [sort, setSort]         = useState(initial.sort)
  const [page, setPage]         = useState(initial.page)
  const [, startTransition]     = useTransition()

  // Pre-compute normalized searchable text once per plant
  const indexed = useMemo(
    () =>
      plants.map(p => ({
        plant: p,
        searchable: (p.commonName + ' ' + p.scientificName)
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, ''),
        firstLetter: p.commonName
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')[0]
          ?.toUpperCase() ?? '',
      })),
    [plants],
  )

  // Active letters (independent of current filters so the nav stays stable)
  const activeLetters = useMemo(
    () => Array.from(new Set(indexed.map(x => x.firstLetter).filter(l => /^[A-Z]$/.test(l)))),
    [indexed],
  )

  // Filter in-memory
  const filtered = useMemo(() => {
    const normQuery = query
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
    return indexed
      .filter(({ plant, searchable, firstLetter }) => {
        if (category !== 'all' && plant.category !== category) return false
        if (sun !== 'all' && plant.sunExposure !== sun) return false
        if (letter && firstLetter !== letter.toUpperCase()) return false
        if (normQuery && !searchable.includes(normQuery)) return false
        return true
      })
      .map(x => x.plant)
  }, [indexed, category, sun, letter, query])

  // Sort
  const sorted = useMemo(() => {
    const arr = [...filtered]
    switch (sort) {
      case 'difficulty_asc':
        arr.sort((a, b) => {
          const da = difficultyRank(a.wateringDifficulty)
          const db = difficultyRank(b.wateringDifficulty)
          return da - db || a.commonName.localeCompare(b.commonName, 'fr')
        })
        break
      case 'watering_asc':
        arr.sort(
          (a, b) =>
            a.wateringFreqDays - b.wateringFreqDays ||
            a.commonName.localeCompare(b.commonName, 'fr'),
        )
        break
      case 'name_asc':
      default:
        arr.sort((a, b) => a.commonName.localeCompare(b.commonName, 'fr'))
    }
    return arr
  }, [filtered, sort])

  // Facet counts — derived from filtered set for contextual stats
  const total       = sorted.length
  const edibleCount = useMemo(() => sorted.filter(p => p.edible).length, [sorted])
  const toxicCount  = useMemo(() => sorted.filter(p => p.toxic).length, [sorted])

  // Pagination
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const clampedPage = Math.min(page, totalPages)
  const pageStart = (clampedPage - 1) * PAGE_SIZE
  const pageItems = sorted.slice(pageStart, pageStart + PAGE_SIZE)

  // Reset to page 1 when filters change
  useEffect(() => {
    setPage(1)
  }, [category, sun, query, letter, sort])

  // Mirror state to URL (no server round-trip)
  useEffect(() => {
    const params = new URLSearchParams()
    if (category !== 'all')   params.set('category', category)
    if (sun !== 'all')        params.set('sun', sun)
    if (query.trim())         params.set('q', query.trim())
    if (letter)               params.set('letter', letter)
    if (sort !== 'name_asc')  params.set('sort', sort)
    if (clampedPage > 1)      params.set('page', String(clampedPage))
    const qs = params.toString()
    const url = qs ? `/encyclopedie?${qs}` : '/encyclopedie'
    startTransition(() => {
      window.history.replaceState(null, '', url)
    })
  }, [category, sun, query, letter, sort, clampedPage, startTransition])

  const hasActiveFilter =
    category !== 'all' || sun !== 'all' || !!query.trim() || !!letter

  function resetFilters() {
    setCategory('all')
    setSun('all')
    setQuery('')
    setLetter('')
    setSort('name_asc')
    setPage(1)
  }

  return (
    <div className="min-h-screen bg-sand">
      {/* Hero */}
      <section className="bg-gradient-to-b from-lime/20 to-sand px-4 pt-16 pb-10 md:pt-24 md:pb-14">
        <div className="mx-auto max-w-5xl text-center">
          <p className="font-raleway text-xs font-semibold uppercase tracking-[0.2em] text-forest/50 mb-3">
            📚 Encyclopédie Growi
          </p>
          <h1 className="font-poppins font-bold text-3xl md:text-5xl text-forest leading-tight mb-3">
            Découvre plus de {plants.length.toLocaleString('fr-FR')} plantes
          </h1>
          <p className="font-raleway text-base md:text-lg text-forest/70 mb-8 max-w-2xl mx-auto">
            Guides d&apos;entretien, arrosage, exposition, toxicité. Une référence libre et
            complète pour tous les amoureux du jardin.
          </p>
          <EncyclopedieSearch value={query} onChange={setQuery} />
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-4 py-8">
        {/* Stats bar */}
        <div className="flex flex-wrap items-center justify-center gap-4 rounded-2xl bg-white shadow-card px-6 py-4 mb-6">
          <StatBadge
            icon={<Leaf size={16} className="text-forest" />}
            label="Plantes"
            value={total.toLocaleString('fr-FR')}
          />
          <div className="h-6 w-px bg-forest/10" aria-hidden />
          <StatBadge
            icon={<Apple size={16} className="text-lime-hover" />}
            label="Comestibles"
            value={edibleCount.toLocaleString('fr-FR')}
          />
          <div className="h-6 w-px bg-forest/10" aria-hidden />
          <StatBadge
            icon={<AlertTriangle size={16} className="text-red-500" />}
            label="Toxiques"
            value={toxicCount.toLocaleString('fr-FR')}
          />
        </div>

        {/* Filters */}
        <div className="rounded-2xl bg-white shadow-card p-5 mb-6">
          <EncyclopedieFilters
            category={category}
            sun={sun}
            sort={sort}
            onCategoryChange={setCategory}
            onSunChange={setSun}
            onSortChange={setSort}
          />
        </div>

        {/* Alpha nav */}
        <AlphaNav
          currentLetter={letter}
          activeLetters={activeLetters}
          onLetterChange={setLetter}
        />

        {/* Results */}
        <div className="mt-6">
          {pageItems.length === 0 ? (
            <div className="rounded-2xl bg-white shadow-card p-10 text-center">
              <span className="block text-5xl mb-3" aria-hidden>🌱</span>
              <p className="font-poppins font-semibold text-forest mb-1">
                Aucune plante ne correspond à tes critères
              </p>
              <p className="font-raleway text-sm text-forest/60">
                Essaie de modifier les filtres ou la recherche.
              </p>
              {hasActiveFilter && (
                <button
                  type="button"
                  onClick={resetFilters}
                  className="mt-4 inline-block rounded-full bg-lime px-5 py-2 font-poppins font-semibold text-xs text-forest hover:bg-lime-hover transition-colors"
                >
                  Réinitialiser les filtres
                </button>
              )}
            </div>
          ) : (
            <>
              <p className="font-raleway text-xs text-forest/50 mb-4">
                {total.toLocaleString('fr-FR')} plante{total > 1 ? 's' : ''} — page {clampedPage} / {totalPages}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                {pageItems.map((plant, i) => (
                  <PlantCard key={plant.id} plant={plant} priority={i < 4} />
                ))}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 mt-10">
                  <PageButton
                    disabled={clampedPage === 1}
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    label="← Précédent"
                  />
                  <span className="font-raleway text-xs text-forest/60 px-3">
                    {clampedPage} / {totalPages}
                  </span>
                  <PageButton
                    disabled={clampedPage === totalPages}
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
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

function PlantCard({ plant, priority }: { plant: EncyclopediaPlant; priority: boolean }) {
  const sunDiff =
    plant.wateringDifficulty === 'EASY'   ? '🟢' :
    plant.wateringDifficulty === 'MEDIUM' ? '🟡' : '🔴'

  return (
    <Link
      href={`/encyclopedie/${plant.slug}`}
      prefetch={false}
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
            quality={60}
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

function PageButton({
  disabled,
  onClick,
  label,
}: {
  disabled: boolean
  onClick: () => void
  label: string
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'rounded-full border px-4 py-2 font-poppins text-xs font-semibold transition-colors',
        disabled
          ? 'border-forest/10 text-forest/30 cursor-not-allowed'
          : 'border-forest/20 text-forest hover:bg-lime hover:border-lime',
      )}
    >
      {label}
    </button>
  )
}

function difficultyRank(d: string): number {
  return ({ EASY: 0, MEDIUM: 1, DEMANDING: 2 } as Record<string, number>)[d] ?? 99
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
