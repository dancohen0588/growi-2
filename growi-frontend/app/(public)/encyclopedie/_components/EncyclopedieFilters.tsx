'use client'

import { cn } from '@/lib/utils'

const CATEGORIES: Array<{ value: string; label: string }> = [
  { value: 'all',          label: 'Toutes' },
  { value: 'INDOOR',       label: 'Intérieur' },
  { value: 'VEGETABLE',    label: 'Potager' },
  { value: 'FLOWERS',      label: 'Fleurs' },
  { value: 'TREES_SHRUBS', label: 'Arbres & arbustes' },
  { value: 'HERBS',        label: 'Aromatiques' },
  { value: 'SUCCULENTS',   label: 'Succulentes' },
  { value: 'AQUATIC',      label: 'Aquatiques' },
  { value: 'CLIMBING',     label: 'Grimpantes' },
]

const SUNS: Array<{ value: string; label: string; icon: string }> = [
  { value: 'all',      label: 'Toutes',       icon: '✨' },
  { value: 'FULL_SUN', label: 'Plein soleil', icon: '☀️' },
  { value: 'PARTIAL',  label: 'Mi-ombre',     icon: '⛅' },
  { value: 'SHADE',    label: 'Ombre',        icon: '🌥️' },
]

const SORTS: Array<{ value: string; label: string }> = [
  { value: 'name_asc',       label: 'Ordre alphabétique' },
  { value: 'difficulty_asc', label: 'Difficulté croissante' },
  { value: 'watering_asc',   label: 'Arrosage le plus fréquent' },
]

interface Props {
  category: string
  sun:      string
  sort:     string
  onCategoryChange: (v: string) => void
  onSunChange:      (v: string) => void
  onSortChange:     (v: string) => void
}

export function EncyclopedieFilters({
  category, sun, sort,
  onCategoryChange, onSunChange, onSortChange,
}: Props) {
  return (
    <div className="flex flex-col gap-4">
      {/* Category pills */}
      <div>
        <p className="font-raleway text-[11px] font-semibold uppercase tracking-wide text-forest/50 mb-2">
          Catégorie
        </p>
        <div className="flex flex-wrap gap-1.5">
          {CATEGORIES.map(c => (
            <button
              key={c.value}
              type="button"
              onClick={() => onCategoryChange(c.value)}
              className={cn(
                'rounded-full px-3 py-1 font-raleway text-xs font-semibold transition-all border',
                category === c.value
                  ? 'bg-forest text-white border-forest'
                  : 'bg-white text-forest/70 border-forest/15 hover:border-lime hover:text-forest',
              )}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      {/* Sun + sort */}
      <div className="flex flex-wrap items-center gap-4">
        <div>
          <p className="font-raleway text-[11px] font-semibold uppercase tracking-wide text-forest/50 mb-2">
            Ensoleillement
          </p>
          <div className="flex gap-1.5">
            {SUNS.map(s => (
              <button
                key={s.value}
                type="button"
                onClick={() => onSunChange(s.value)}
                title={s.label}
                aria-label={s.label}
                className={cn(
                  'inline-flex items-center gap-1 rounded-full px-3 py-1 font-raleway text-xs font-semibold transition-all border',
                  sun === s.value
                    ? 'bg-sun/20 text-forest border-sun'
                    : 'bg-white text-forest/70 border-forest/15 hover:border-lime',
                )}
              >
                <span aria-hidden>{s.icon}</span>
                <span className="hidden sm:inline">{s.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="ml-auto">
          <label
            htmlFor="sort"
            className="block font-raleway text-[11px] font-semibold uppercase tracking-wide text-forest/50 mb-2"
          >
            Tri
          </label>
          <select
            id="sort"
            value={sort}
            onChange={e => onSortChange(e.target.value)}
            className="rounded-full border border-forest/15 bg-white px-4 py-1.5 font-raleway text-xs text-forest focus:outline-none focus:ring-2 focus:ring-lime"
          >
            {SORTS.map(s => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>
      </div>
    </div>
  )
}
