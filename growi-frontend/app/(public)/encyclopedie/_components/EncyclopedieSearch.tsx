'use client'

import { Search } from 'lucide-react'

interface Props {
  value:    string
  onChange: (value: string) => void
}

export function EncyclopedieSearch({ value, onChange }: Props) {
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
        onChange={e => onChange(e.target.value)}
        placeholder="Rechercher une plante, une espèce…"
        aria-label="Rechercher dans l'encyclopédie"
        className="w-full rounded-full border-2 border-forest/15 bg-white pl-11 pr-11 py-3 font-raleway text-sm text-forest placeholder:text-forest/40 shadow-card focus:outline-none focus:ring-2 focus:ring-lime focus:border-lime transition-all"
      />
    </div>
  )
}
