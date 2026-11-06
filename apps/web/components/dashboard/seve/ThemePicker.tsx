'use client'

import { useState, useTransition } from 'react'
import { Check, Lock } from 'lucide-react'
import {
  SAP_HOME_THEME_LABELS,
  SAP_HOME_THEMES,
  SAP_THEME_RINGS,
  sapRingOrdinal,
  type SapHomeTheme,
} from '@growi/shared'

import { setHomeThemeAction } from '@/app/actions/sap'
import { cn } from '@/lib/utils'

import { ThemeArt } from './ThemeArt'

type Choice = SapHomeTheme | null

/**
 * Le choix du thème d'Accueil, sur « Ta sève ». Bascule immédiate, retour en
 * arrière si le serveur refuse — comme le cœur d'une publication. Un thème
 * pas encore débloqué reste visible, grisé, avec le cerne qui l'apporte.
 */
export function ThemePicker({ current, unlocked }: { current: Choice; unlocked: SapHomeTheme[] }) {
  const [selected, setSelected] = useState<Choice>(current)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const open = new Set<Choice>([null, ...unlocked])

  function choose(theme: Choice) {
    if (theme === selected || !open.has(theme)) return
    const before = selected
    setSelected(theme)
    setError(null)
    startTransition(async () => {
      const result = await setHomeThemeAction({ theme })
      if (!result.ok) {
        setSelected(before)
        setError(result.error)
      }
    })
  }

  return (
    <div className="flex flex-col gap-3">
      <div role="radiogroup" aria-label="Thème d’Accueil" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {([null, ...SAP_HOME_THEMES] as Choice[]).map((theme) => {
          const available = open.has(theme)
          const isSelected = theme === selected
          const name = theme ? SAP_HOME_THEME_LABELS[theme] : 'Classique'
          const hint = available ? (isSelected ? 'Choisi' : 'Disponible') : `Au ${sapRingOrdinal(SAP_THEME_RINGS[theme!])} cerne`
          return (
            <button
              key={theme ?? 'classique'}
              type="button"
              role="radio"
              aria-checked={isSelected}
              aria-disabled={!available}
              disabled={!available || pending}
              onClick={() => choose(theme)}
              className={cn(
                'overflow-hidden rounded-xl border-2 bg-white text-left shadow-card transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime',
                isSelected ? 'border-forest' : 'border-transparent hover:border-forest/30',
                !available && 'cursor-not-allowed opacity-60',
              )}
            >
              <span className="relative block h-20 bg-forest">
                {theme ? <ThemeArt theme={theme} width={240} height={80} className="absolute inset-0 h-full w-full" /> : null}
                {!available ? (
                  <span className="absolute inset-0 grid place-items-center text-sand">
                    <Lock size={20} aria-hidden />
                  </span>
                ) : null}
              </span>
              <span className="flex items-center gap-2 px-3 py-2">
                <span className="flex flex-1 flex-col">
                  <span className="font-raleway text-sm font-semibold text-forest">{name}</span>
                  <span className="font-raleway text-xs text-forest/60">{hint}</span>
                </span>
                {isSelected ? <Check size={18} aria-hidden className="text-forest" /> : null}
              </span>
            </button>
          )
        })}
      </div>
      {error ? (
        <p role="alert" className="font-raleway text-sm text-red-600">
          {error}
        </p>
      ) : null}
    </div>
  )
}
