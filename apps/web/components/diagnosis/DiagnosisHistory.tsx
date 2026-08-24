'use client'

import { useCallback, useEffect, useState } from 'react'
import { ChevronDown, Loader2 } from 'lucide-react'
import {
  HEALTH_STATUS_LABELS,
  type DiagnosisDetail,
  type DiagnosisListItem,
  type HealthStatus,
} from '@growi/shared'

import { DiagnosisResult } from '@/components/diagnosis/DiagnosisResult'

/**
 * Historique des diagnostics d'une plante.
 *
 * La section ne s'affiche qu'à partir du premier diagnostic : une rubrique
 * vide sur chaque fiche donnerait l'impression d'un manque plutôt que d'une
 * possibilité.
 */

const STATUS_DOT: Record<HealthStatus, string> = {
  HEALTHY: 'bg-emerald-500',
  WARNING: 'bg-amber-400',
  CRITICAL: 'bg-red-500',
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

export interface DiagnosisHistoryProps {
  plantId: string
  /** Incrémenté par la fiche après un nouveau diagnostic, pour relire la liste. */
  refreshKey?: number
}

export function DiagnosisHistory({ plantId, refreshKey = 0 }: DiagnosisHistoryProps) {
  const [items, setItems] = useState<DiagnosisListItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [openId, setOpenId] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    fetch(`/api/v1/plants/${encodeURIComponent(plantId)}/diagnoses`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error('load'))))
      .then((payload: { data: DiagnosisListItem[] }) => {
        if (!cancelled) setItems(payload.data)
      })
      // Un historique qui ne charge pas n'est pas une raison de casser la fiche :
      // la section reste simplement absente.
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [plantId, refreshKey])

  if (isLoading || items.length === 0) return null

  return (
    <section className="rounded-2xl bg-white shadow-card p-6 flex flex-col gap-4">
      <h2 className="font-poppins font-semibold text-lg text-forest">
        Historique des diagnostics
      </h2>

      <ul className="flex flex-col gap-2">
        {items.map((item) => (
          <li key={item.id} className="rounded-xl border border-forest/10">
            <button
              type="button"
              onClick={() => setOpenId((id) => (id === item.id ? null : item.id))}
              aria-expanded={openId === item.id}
              className="w-full p-3 flex items-center gap-3 text-left hover:bg-sand/60 transition-colors rounded-xl"
            >
              <span
                className={`shrink-0 w-2.5 h-2.5 rounded-full ${STATUS_DOT[item.status]}`}
                aria-hidden
              />
              <span className="flex-1 flex flex-col gap-0.5 min-w-0">
                <span className="font-poppins text-sm font-semibold text-forest">
                  {HEALTH_STATUS_LABELS[item.status]}
                  {item.statusApplied && (
                    <span className="ml-2 font-raleway text-[11px] font-normal text-forest/50">
                      appliqué à la fiche
                    </span>
                  )}
                </span>
                <span className="font-raleway text-xs text-forest/60 truncate">
                  {item.summary}
                </span>
              </span>
              <span className="shrink-0 font-raleway text-xs text-forest/45">
                {formatDate(item.createdAt)}
              </span>
              <ChevronDown
                size={16}
                className={`shrink-0 text-forest/40 transition-transform ${openId === item.id ? 'rotate-180' : ''}`}
                aria-hidden
              />
            </button>

            {openId === item.id && (
              <div className="px-3 pb-3">
                <DiagnosisDetailView plantId={plantId} diagnosisId={item.id} />
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}

/** Le détail n'est chargé qu'à l'ouverture : la liste porte déjà l'essentiel. */
function DiagnosisDetailView({
  plantId,
  diagnosisId,
}: {
  plantId: string
  diagnosisId: string
}) {
  const [detail, setDetail] = useState<DiagnosisDetail | null>(null)
  const [failed, setFailed] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/v1/plants/${encodeURIComponent(plantId)}/diagnoses/${encodeURIComponent(diagnosisId)}`,
      )
      if (!res.ok) throw new Error('load')
      const payload = (await res.json()) as { data: DiagnosisDetail }
      setDetail(payload.data)
    } catch {
      setFailed(true)
    }
  }, [plantId, diagnosisId])

  useEffect(() => {
    load()
  }, [load])

  if (failed) {
    return (
      <p className="font-raleway text-sm text-forest/60">
        Ce diagnostic n&apos;a pas pu être relu.
      </p>
    )
  }

  if (!detail) {
    return (
      <div className="py-4 flex justify-center">
        <Loader2 size={20} className="text-forest/50 animate-spin" aria-hidden />
      </div>
    )
  }

  return (
    <DiagnosisResult
      result={detail.result}
      photoUrl={detail.photoUrl}
      // En relecture, la comparaison n'a plus de sens : on masque la
      // proposition de mise à jour en donnant le statut du diagnostic lui-même.
      currentHealthStatus={detail.status}
    />
  )
}
