'use client'

import { cn } from '@/lib/utils'

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')

interface Props {
  currentLetter:  string
  activeLetters:  string[]
  onLetterChange: (letter: string) => void
}

export function AlphaNav({ currentLetter, activeLetters, onLetterChange }: Props) {
  const active = new Set(activeLetters.map(l => l.toUpperCase()))

  return (
    <nav
      aria-label="Navigation alphabétique"
      className="sticky top-[73px] z-20 -mx-4 bg-sand/90 backdrop-blur-sm px-4 py-2"
    >
      <div className="flex flex-wrap gap-1 items-center justify-center">
        <button
          type="button"
          onClick={() => onLetterChange('')}
          className={cn(
            'rounded-md px-2 py-1 font-poppins text-[11px] font-semibold transition-colors',
            !currentLetter
              ? 'bg-forest text-white'
              : 'text-forest/50 hover:text-forest',
          )}
        >
          Tous
        </button>
        {LETTERS.map(letter => {
          const isActive  = active.has(letter)
          const isCurrent = currentLetter.toUpperCase() === letter
          return (
            <button
              key={letter}
              type="button"
              onClick={() => isActive && onLetterChange(letter)}
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
