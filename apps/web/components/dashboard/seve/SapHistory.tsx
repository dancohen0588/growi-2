'use client'

import { useState, useTransition } from 'react'
import { formatSapAmount, sapEntryLabel, type SapEntry } from '@growi/shared'

import { loadSapHistoryAction } from '@/app/actions/sap'
import { Button } from '@/components/ui/button'

import { formatSapDay } from './format'
import { SapDrop } from './SapDrop'

/**
 * « Dernières gouttes » — la première page vient du serveur avec l'écran,
 * les suivantes à la demande. Un échec laisse la liste telle quelle et le dit
 * sous le bouton, qu'on peut retaper.
 */
export function SapHistory({ initial, initialCursor }: { initial: SapEntry[]; initialCursor: string | null }) {
  const [entries, setEntries] = useState(initial)
  const [cursor, setCursor] = useState(initialCursor)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-2xl bg-white p-6 text-center shadow-card">
        <SapDrop size={32} />
        <p className="font-raleway text-sm text-forest/60">
          Tes premières gouttes viendront avec ton prochain geste — un arrosage noté suffit 🌱
        </p>
      </div>
    )
  }

  function loadMore() {
    setError(null)
    startTransition(async () => {
      const result = await loadSapHistoryAction(cursor)
      if (!result.ok) {
        setError(result.error)
        return
      }
      setEntries((current) => [...current, ...result.data.items])
      setCursor(result.data.nextCursor ?? null)
    })
  }

  return (
    <div className="flex flex-col gap-2">
      <ul className="flex flex-col gap-2">
        {entries.map((entry) => (
          <li key={entry.id} className="flex items-center gap-3 rounded-xl bg-white px-4 py-3 shadow-card">
            <span className="min-w-[44px] rounded-full bg-lime/40 px-2.5 py-1 text-center font-poppins text-sm font-bold text-forest">
              {formatSapAmount(entry.amount)}
            </span>
            <span className="flex flex-1 flex-col">
              <span className="font-raleway text-sm font-semibold text-forest">{sapEntryLabel(entry)}</span>
              <span className="font-raleway text-xs text-forest/60 first-letter:uppercase">
                {formatSapDay(entry.createdAt)}
              </span>
            </span>
          </li>
        ))}
      </ul>

      {cursor ? (
        <Button variant="ghost" onClick={loadMore} disabled={pending} className="self-center">
          {pending ? 'Chargement…' : 'Voir les gouttes plus anciennes'}
        </Button>
      ) : null}
      {error ? (
        <p role="alert" className="text-center font-raleway text-sm text-red-600">
          {error}
        </p>
      ) : null}
    </div>
  )
}
