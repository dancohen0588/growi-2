// growi-frontend/components/dashboard/meteo/AddressSearchBar.tsx
'use client'

import { useState, useEffect, useRef, useId } from 'react'
import { Search, Loader2 } from 'lucide-react'
import { geocodeAddress } from '@/lib/weather-api'
import type { GeocodingResult } from '@/types/weather'

interface AddressSearchBarProps {
  onSelect: (result: GeocodingResult) => void
}

export function AddressSearchBar({ onSelect }: AddressSearchBarProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<GeocodingResult[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const [noResults, setNoResults] = useState(false)

  const containerRef = useRef<HTMLDivElement>(null)
  const listId = useId()
  const inputId = useId()

  // Debounced geocode search
  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([])
      setIsOpen(false)
      setNoResults(false)
      return
    }

    setIsLoading(true)
    setNoResults(false)

    const timer = setTimeout(async () => {
      try {
        const res = await geocodeAddress(query)
        setResults(res)
        setIsOpen(true)
        setNoResults(res.length === 0)
      } catch {
        setResults([])
        setNoResults(true)
      } finally {
        setIsLoading(false)
      }
    }, 400)

    return () => clearTimeout(timer)
  }, [query])

  // Close on outside click
  useEffect(() => {
    function handleMouseDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleMouseDown)
    return () => document.removeEventListener('mousedown', handleMouseDown)
  }, [])

  function handleSelect(result: GeocodingResult) {
    setQuery(`${result.name}${result.admin1 ? `, ${result.admin1}` : ''}, ${result.country}`)
    setIsOpen(false)
    setResults([])
    onSelect(result)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Escape') {
      setIsOpen(false)
    }
  }

  return (
    <div ref={containerRef} className="relative w-full max-w-lg mx-auto">
      {/* Input */}
      <div className="relative">
        <label htmlFor={inputId} className="sr-only">
          Rechercher une ville ou adresse
        </label>
        <Search
          size={17}
          aria-hidden
          className="absolute left-3.5 top-1/2 -translate-y-1/2 text-forest/40 pointer-events-none"
        />
        <input
          id={inputId}
          type="search"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={isOpen}
          aria-controls={isOpen ? listId : undefined}
          autoComplete="off"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => results.length > 0 && setIsOpen(true)}
          placeholder="Recherche une ville ou une adresse…"
          className="w-full rounded-xl border border-forest/20 bg-white pl-10 pr-10 py-3 font-raleway text-sm text-forest placeholder:text-forest/40 focus:outline-none focus:ring-2 focus:ring-lime focus:ring-offset-2 focus:border-transparent transition-shadow hover:shadow-card"
        />
        {isLoading && (
          <Loader2
            size={16}
            aria-hidden
            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-forest/40 animate-spin"
          />
        )}
      </div>

      {/* Suggestions dropdown */}
      {isOpen && results.length > 0 && (
        <ul
          id={listId}
          role="listbox"
          aria-label="Suggestions de villes"
          className="absolute z-50 mt-1.5 w-full bg-sand border border-forest/20 rounded-xl shadow-card-hover overflow-hidden"
        >
          {results.map((result, i) => (
            <li
              key={`${result.name}-${result.latitude}-${i}`}
              role="option"
              aria-selected={false}
              tabIndex={0}
              onClick={() => handleSelect(result)}
              onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && handleSelect(result)}
              className="flex flex-col px-4 py-2.5 cursor-pointer font-raleway text-sm text-forest hover:bg-lime/20 focus:bg-lime/20 focus:outline-none transition-colors border-b border-forest/5 last:border-0"
            >
              <span className="font-medium">{result.name}</span>
              <span className="text-xs text-forest/50">
                {[result.admin1, result.country].filter(Boolean).join(', ')}
              </span>
            </li>
          ))}
        </ul>
      )}

      {/* No results state */}
      {noResults && !isLoading && query.trim().length >= 2 && (
        <div className="absolute z-50 mt-1.5 w-full bg-sand border border-forest/20 rounded-xl shadow-card px-4 py-3">
          <p className="font-raleway text-sm text-forest/60 text-center">
            Aucune ville trouvée. Essaie avec un nom de ville plus précis.
          </p>
        </div>
      )}
    </div>
  )
}
