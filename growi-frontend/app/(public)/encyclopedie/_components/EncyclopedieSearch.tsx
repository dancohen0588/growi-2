'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Search, Loader2 } from 'lucide-react'

export function EncyclopedieSearch() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [value, setValue] = useState(searchParams.get('q') ?? '')
  const [isPending, startTransition] = useTransition()

  // Keep input in sync with URL on back/forward nav
  useEffect(() => {
    setValue(searchParams.get('q') ?? '')
  }, [searchParams])

  // Debounced URL sync (250ms)
  useEffect(() => {
    const current = searchParams.get('q') ?? ''
    if (value === current) return
    const h = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString())
      if (value.trim()) params.set('q', value.trim())
      else params.delete('q')
      params.delete('page')
      startTransition(() => {
        router.replace(`/encyclopedie?${params.toString()}`, { scroll: false })
      })
    }, 250)
    return () => clearTimeout(h)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  return (
    <div className="relative mx-auto w-full max-w-xl">
      <Search
        size={18}
        aria-hidden
        className="absolute left-4 top-1/2 -translate-y-1/2 text-forest/40 pointer-events-none"
      />
      <input
        type="search"
        value={value}
        onChange={e => setValue(e.target.value)}
        placeholder="Rechercher une plante, une espèce…"
        aria-label="Rechercher dans l'encyclopédie"
        className="w-full rounded-full border-2 border-forest/15 bg-white pl-11 pr-11 py-3 font-raleway text-sm text-forest placeholder:text-forest/40 shadow-card focus:outline-none focus:ring-2 focus:ring-lime focus:border-lime transition-all"
      />
      {isPending && (
        <Loader2
          size={16}
          aria-hidden
          className="absolute right-4 top-1/2 -translate-y-1/2 text-forest/40 animate-spin"
        />
      )}
    </div>
  )
}
