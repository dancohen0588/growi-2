'use client'

import { useCallback, useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import {
  CARE_LOG_TYPE_LABELS,
  HEALTH_STATUS_LABELS,
  formatHarvest,
  type CareLog,
  type CareLogType,
  type HealthStatus,
} from '@growi/shared'

import { getPlantLogsAction } from '@/lib/actions/plant.actions'
import { formatLogDate } from '@/lib/plant-dates'

/**
 * Le journal d'entretien de la plante — présent sur la fiche mobile, absent
 * ici jusqu'à présent.
 *
 * Chaque geste est décrit par ce qui le précise : l'état pour une note de
 * santé, la quantité pour une récolte, le produit pour un traitement. Sans
 * cela, une liste de « Traitement » répétés n'apprend rien.
 */

const TYPE_EMOJI: Record<CareLogType, string> = {
  watering: '💧',
  pruning: '✂️',
  fertilizing: '🌱',
  health: '🩺',
  harvest: '🧺',
  treatment: '🛡️',
  repotting: '🪴',
  sowing: '🌾',
  other: '🔧',
}

function describe(log: CareLog): { label: string; detail: string | null } {
  const type = log.type as CareLogType
  let label = CARE_LOG_TYPE_LABELS[type] ?? type

  if (type === 'health' && log.status) {
    label += ` — ${HEALTH_STATUS_LABELS[log.status as HealthStatus] ?? log.status}`
  }
  if (type === 'harvest' && log.quantity) {
    label += ` — ${formatHarvest(log.quantity, log.unit)}`
  }

  return { label, detail: [log.productUsed, log.note].filter(Boolean).join(' · ') || null }
}

export function PlantCareHistory({
  plantId,
  refreshKey = 0,
}: {
  plantId: string
  /** Incrémenté par la fiche après un geste, pour relire le journal. */
  refreshKey?: number
}) {
  const [logs, setLogs] = useState<CareLog[] | null>(null)
  const [failed, setFailed] = useState(false)

  const load = useCallback(async () => {
    try {
      setLogs(await getPlantLogsAction(plantId))
    } catch {
      setFailed(true)
    }
  }, [plantId])

  useEffect(() => {
    load()
  }, [load, refreshKey])

  return (
    <section className="rounded-2xl bg-white shadow-card p-6 flex flex-col gap-3">
      <h2 className="font-poppins font-semibold text-lg text-forest">Historique</h2>

      {failed ? (
        <p className="font-raleway text-sm text-forest/60">
          Le journal n&apos;a pas pu être chargé.
        </p>
      ) : logs === null ? (
        <div className="py-4 flex justify-center">
          <Loader2 size={20} className="text-forest/50 animate-spin" aria-hidden />
        </div>
      ) : logs.length === 0 ? (
        <p className="font-raleway text-sm text-forest/60">
          Aucun geste enregistré pour l&apos;instant. Le premier arrosage lancera
          l&apos;historique 🌱
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {logs.map((log) => {
            const { label, detail } = describe(log)
            return (
              <li key={log.id} className="flex items-start gap-3 rounded-xl bg-sand/60 px-4 py-2.5">
                <span className="text-lg leading-none" aria-hidden>
                  {TYPE_EMOJI[log.type as CareLogType] ?? '🔧'}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="font-raleway text-sm font-medium text-forest">{label}</p>
                  {detail && (
                    <p className="font-raleway text-xs text-forest/60 truncate">{detail}</p>
                  )}
                </div>
                <span className="shrink-0 font-raleway text-xs text-forest/45">
                  {formatLogDate(log.occurredAt)}
                </span>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
