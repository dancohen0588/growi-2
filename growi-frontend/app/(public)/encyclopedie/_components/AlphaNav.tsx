'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { cn } from '@/lib/utils'

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')

interface AlphaNavProps {
  activeLetters: string[]
}

export function AlphaNav({ activeLetters }: AlphaNavProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const current = searchParams.get('letter') ?? ''
  const active = new Set(activeLetters.map(l => l.toUpperCase()))

  function setLetter(letter: string | null) {
    const params = new URLSearchParams(searchParams.toString())
    if (letter) params.set('letter', letter)
    else params.delete('letter')
    params.delete('page')
    router.replace(`/encyclopedie?${params.toString()}`, { scroll: false })
  }

  return (
    <nav
      aria-label="Navigation alphabétique"
      className="sticky top-[73px] z-20 -mx-4 bg-sand/90 backdrop-blur-sm px-4 py-2"
    >
      <div className="flex flex-wrap gap-1 items-center justify-center">
        <button
          onClick={() => setLetter(null)}
          className={cn(
            'rounded-md px-2 py-1 font-poppins text-[11px] font-semibold transition-colors',
            !current
              ? 'bg-forest text-white'
              : 'text-forest/50 hover:text-forest',
          )}
        >
          Tous
        </button>
        {LETTERS.map(letter => {
          const isActive = active.has(letter)
          const isCurrent = current.toUpperCase() === letter
          return (
            <button
              key={letter}
              onClick={() => isActive && setLetter(letter)}
              disabled={!isActive}
              aria-current={isCurrent ? 'true' : undefined}
              className={cn(
                'rounded-md px-2 py-1 font-poppins text-xs font-semibold transition-colors min-w-[28px]',
                isCurrent && 'bg-lime text-forest',
                !isCurrent && isActive && 'text-forest hover:bg-lime/20',
                !isActive && 'text-forest/20 cursor-not-allowed',
              )}
            >
              {letter}
            </button>
          )
        })}
      </div>
    </nav>
  )
}
