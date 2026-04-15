'use client'

import { useEffect, useRef, useState } from 'react'
import type { PlantCatalog } from '@prisma/client'
import { Search, Loader2, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { searchCatalog } from '@/lib/actions/catalog.actions'

interface PlantSearchInputProps {
  onSelect: (plant: PlantCatalog | null) => void
  onFallback: () => void
  placeholder?: string
  autoFocus?: boolean
}

export function PlantSearchInput({
  onSelect,
  onFallback,
  placeholder = 'Rechercher une plante dans le catalogue…',
  autoFocus = false,
}: PlantSearchInputProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<PlantCatalog[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const [hasSearched, setHasSearched] = useState(false)

  const wrapperRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const listId = useRef(`plant-search-${Math.random().toString(36).slice(2)}`).current

  // Debounced search
  useEffect(() => {
    const trimmed = query.trim()
    if (trimmed.length < 2) {
      setResults([])
      setHasSearched(false)
      setLoading(false)
      return
    }

    setLoading(true)
    const handle = setTimeout(async () => {
      try {
        const data = await searchCatalog(trimmed)
        setResults(data)
        setHasSearched(true)
        setActiveIndex(0)
        setOpen(true)
      } finally {
        setLoading(false)
      }
    }, 250)

    return () => clearTimeout(handle)
  }, [query])

  // Close on outside click
  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  function handleSelect(plant: PlantCatalog) {
    onSelect(plant)
    setQuery(`${plant.emoji ?? '🌿'} ${plant.commonName}`)
    setOpen(false)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || results.length === 0) {
      if (e.key === 'ArrowDown' && results.length > 0) {
        setOpen(true)
        e.preventDefault()
      }
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex(i => Math.min(i + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex(i => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const plant = results[activeIndex]
      if (plant) handleSelect(plant)
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  const showDropdown = open && query.trim().length >= 2

  return (
    <div ref={wrapperRef} className="relative">
      <div className="relative">
        <Search
          size={16}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-forest/40 pointer-events-none"
          aria-hidden
        />
        <input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-expanded={showDropdown}
          aria-controls={listId}
          aria-activedescendant={showDropdown && results[activeIndex] ? `${listId}-${activeIndex}` : undefined}
          autoFocus={autoFocus}
          value={query}
          placeholder={placeholder}
          onChange={e => {
            setQuery(e.target.value)
            onSelect(null)
            setOpen(true)
          }}
          onFocus={() => query.trim().length >= 2 && setOpen(true)}
          onKeyDown={handleKeyDown}
          className="w-full rounded-xl border border-forest/15 bg-white pl-9 pr-9 py-2.5 font-raleway text-sm text-forest placeholder:text-forest/40 focus:outline-none focus:ring-2 focus:ring-lime focus:border-lime transition-all"
        />
        {loading && (
          <Loader2
            size={16}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-forest/40 animate-spin"
            aria-hidden
          />
        )}
      </div>

      {showDropdown && (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-50 mt-1 w-full max-h-80 overflow-y-auto rounded-xl border border-forest/10 bg-white shadow-card-hover py-1"
        >
          {results.length === 0 && !loading && hasSearched && (
            <li className="px-4 py-3">
              <p className="font-raleway text-xs text-forest/50 mb-2">
                Plante non trouvée dans le catalogue.
              </p>
              <button
                type="button"
                onClick={() => {
                  setOpen(false)
                  onFallback()
                }}
                className="font-raleway text-xs font-semibold text-forest underline underline-offset-2 hover:text-lime-hover"
              >
                Saisie manuelle →
              </button>
            </li>
          )}

          {results.map((plant, i) => {
            const isActive = i === activeIndex
            return (
              <li
                key={plant.id}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={isActive}
                onMouseEnter={() => setActiveIndex(i)}
                onMouseDown={e => {
                  e.preventDefault()
                  handleSelect(plant)
                }}
                className={cn(
                  'flex items-start gap-3 px-3 py-2.5 cursor-pointer transition-colors',
                  isActive ? 'bg-lime/10' : 'hover:bg-sand',
                )}
              >
                <span className="text-2xl leading-none mt-0.5" aria-hidden>
                  {plant.emoji ?? '🌿'}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-poppins font-semibold text-sm text-forest truncate">
                      {plant.commonName}
                    </span>
                    {plant.toxic && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-1.5 py-0.5 font-raleway text-[10px] font-semibold text-red-600">
                        <AlertTriangle size={10} aria-hidden />
                        Toxique
                      </span>
                    )}
                  </div>
                  <p className="font-raleway text-[11px] italic text-forest/50 truncate">
                    {plant.scientificName}
                  </p>
                  <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                    <Tag>{plant.category}</Tag>
                    <Tag>💧 {plant.wateringFreqDays}j</Tag>
                    <Tag>{formatDifficulty(plant.wateringDifficulty)}</Tag>
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-md bg-sand px-1.5 py-0.5 font-raleway text-[10px] font-medium text-forest/60">
      {children}
    </span>
  )
}

function formatDifficulty(d: string): string {
  const map: Record<string, string> = {
    EASY: '🟢 Facile',
    MEDIUM: '🟡 Moyen',
    DEMANDING: '🔴 Exigeant',
  }
  return map[d] ?? d
}
