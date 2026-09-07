'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'

import { markNotificationsReadAction } from '@/app/actions/community'

/**
 * « Tout marquer lu ».
 *
 * Tout, et non ligne par ligne : la cloche se consulte d'un coup d'œil, et
 * cocher vingt lignes pour éteindre un badge serait une corvée sans
 * contrepartie.
 *
 * Contrairement au mobile, le marquage n'est **pas** automatique à
 * l'ouverture : sur un grand écran, la liste se parcourt sans qu'on l'ait
 * forcément lue, et la distinction lu/non-lu est ce qui permet de la reprendre
 * plus tard.
 */
export function MarkAllRead() {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await markNotificationsReadAction()
          router.refresh()
        })
      }
      className="inline-flex items-center gap-2 rounded-lg border border-forest/15 bg-white px-3 py-2 font-raleway text-sm text-forest hover:bg-sand disabled:opacity-50"
    >
      {pending && <Loader2 size={15} className="animate-spin" aria-hidden />}
      Tout marquer lu
    </button>
  )
}
