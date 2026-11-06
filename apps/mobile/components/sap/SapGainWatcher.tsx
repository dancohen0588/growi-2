import { useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'expo-router'
import type { SapEntry, SapSummary } from '@growi/shared'

import { useToast } from '@/components/ui/Toast'
import { sapKeys } from '@/lib/queries/keys'
import { useSapSummary } from '@/lib/queries/sap'
import { entryLabel, gainsLabel } from '@/lib/sap'

import { SapDrop } from './SapDrop'
import { SapMomentSheet, type SapMoment } from './SapMomentSheet'

/** Le temps qu'une tournée « Tout arrosé » finisse avant de relire la sève. */
const REFRESH_DELAY_MS = 250

/** Les gains d'une lecture absents de la précédente. */
function freshEntries(before: SapSummary, after: SapSummary): SapEntry[] {
  const known = new Set(before.recent.map((entry) => entry.id))
  return after.recent.filter((entry) => !known.has(entry.id) && entry.amount > 0)
}

/**
 * Annonce la sève gagnée, où que le geste ait été fait.
 *
 * Monté une fois, dans la barre d'onglets : il garde la lecture de la sève
 * active, la relit après **chaque mutation réussie** — arroser, cocher une
 * tâche, publier, répondre, ajouter une plante, dire si un Secret a marché —
 * et compare au total précédent. Le serveur crédite avant de répondre : la
 * relecture trouve donc le gain déjà là.
 *
 * Écouter les mutations plutôt que de brancher la sève sur chacune d'elles :
 * un écran ajouté demain annoncera sa sève sans qu'on y pense. Une mutation
 * qui ne rapporte rien coûte une lecture de trois petites requêtes, et rien
 * ne s'affiche puisque le total ne bouge pas.
 *
 * - **Un toast** pour un gain ordinaire, avec « Voir » vers « Ta sève » ;
 * - **une feuille** pour un cerne formé, ou un retour sur un Secret (+5) ;
 * - **rien** à la première lecture (aucun point de comparaison : ce n'est pas
 *   un gain, c'est l'ouverture de l'app), ni quand le total baisse (un geste
 *   annulé reprend sa sève sans qu'il y ait lieu de le dire).
 *
 * La sève n'est pas dans le cache persisté : une valeur restaurée du disque
 * ferait sinon annoncer au lancement tout ce qui a été gagné ailleurs.
 */
export function SapGainWatcher() {
  const queryClient = useQueryClient()
  const router = useRouter()
  const toast = useToast()
  const summary = useSapSummary()
  const previous = useRef<SapSummary | null>(null)
  const [moment, setMoment] = useState<SapMoment | null>(null)

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null

    const unsubscribe = queryClient.getMutationCache().subscribe((event) => {
      if (event.type !== 'updated' || event.action.type !== 'success') return
      // Offrir une goutte met la sève à jour elle-même.
      if (event.mutation.options.mutationKey?.[0] === sapKeys.all[0]) return

      if (timer) clearTimeout(timer)
      timer = setTimeout(() => {
        void queryClient.invalidateQueries({ queryKey: sapKeys.all })
      }, REFRESH_DELAY_MS)
    })

    return () => {
      unsubscribe()
      if (timer) clearTimeout(timer)
    }
  }, [queryClient])

  useEffect(() => {
    const current = summary.data
    // Plus de données : changement de compte, cache vidé. On repart de zéro.
    if (!current) {
      previous.current = null
      return
    }

    const before = previous.current
    previous.current = current
    if (!before) return

    const gained = current.total - before.total
    if (gained <= 0) return

    const fresh = freshEntries(before, current)

    if (current.rings.count > before.rings.count) {
      setMoment({ kind: 'ring', total: current.total, rings: current.rings })
      return
    }

    const feedback = fresh.find((entry) => entry.kind === 'secret_feedback')
    if (feedback) {
      setMoment({
        kind: 'secret',
        amount: feedback.amount,
        label: entryLabel(feedback),
        total: current.total,
        rings: current.rings,
      })
      return
    }

    toast(gainsLabel(fresh), 'success', {
      emphasis: `+${gained} de sève`,
      icon: <SapDrop size={26} stroke="#F9F7E8" />,
      action: { label: 'Voir', onPress: () => router.push('/(tabs)/accueil/seve') },
    })
  }, [summary.data, toast, router])

  return (
    <SapMomentSheet
      moment={moment}
      onClose={() => setMoment(null)}
      onOpenSeve={() => {
        setMoment(null)
        router.push('/(tabs)/accueil/seve')
      }}
    />
  )
}
