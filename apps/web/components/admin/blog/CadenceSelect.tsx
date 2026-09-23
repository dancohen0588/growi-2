'use client'

import { useState, useTransition } from 'react'
import { Loader2 } from 'lucide-react'
import type { BlogCadence } from '@growi/shared'

import type { ActionResult } from '@/components/admin/ActionButton'
import { cn } from '@/lib/utils'

const LABELS: Record<BlogCadence, string> = {
  weekly: 'Chaque semaine',
  biweekly: 'Toutes les deux semaines',
  monthly: 'Chaque mois',
}

/**
 * Rythme de la génération automatique. Enregistré dès le choix : il n'y a
 * rien d'autre à valider, et un bouton « Enregistrer » à côté d'un seul menu
 * serait un geste de trop qu'on oublie.
 */
export function CadenceSelect({
  value,
  action,
}: {
  value: BlogCadence
  action: (cadence: string) => Promise<ActionResult>
}) {
  const [current, setCurrent] = useState(value)
  const [result, setResult] = useState<ActionResult | null>(null)
  const [pending, startTransition] = useTransition()

  function onChange(next: BlogCadence) {
    const previous = current
    setCurrent(next)
    startTransition(async () => {
      const outcome = await action(next)
      setResult(outcome)
      // Un refus remet le menu sur ce qui est réellement enregistré.
      if (!outcome.ok) setCurrent(previous)
    })
  }

  return (
    <div className="flex flex-col gap-1">
      <label className="flex items-center gap-2 text-sm text-forest/70">
        Génération automatique
        <select
          value={current}
          disabled={pending}
          onChange={(event) => onChange(event.target.value as BlogCadence)}
          className="rounded-lg border border-forest/15 bg-white px-3 py-2 text-sm text-forest"
        >
          {(Object.keys(LABELS) as BlogCadence[]).map((cadence) => (
            <option key={cadence} value={cadence}>
              {LABELS[cadence]}
            </option>
          ))}
        </select>
        {pending && <Loader2 size={15} className="animate-spin" aria-hidden />}
      </label>
      {result && (
        <p role="status" className={cn('text-xs', result.ok ? 'text-forest/60' : 'text-red-700')}>
          {result.ok ? result.message : result.error}
        </p>
      )}
    </div>
  )
}
