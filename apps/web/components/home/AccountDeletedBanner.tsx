'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { X } from 'lucide-react'

/**
 * Confirme la suppression du compte, au retour sur l'accueil
 * (`/?compte=supprime`, posé par `deleteAccountAction`).
 *
 * Rien n'est retenu nulle part : la fermer retire le paramètre de l'URL, et
 * une page rechargée ne la montre plus. La page d'accueil est statique — le
 * paramètre n'est lu qu'ici, côté client, sans la rendre dynamique.
 */
export function AccountDeletedBanner() {
  const params = useSearchParams()
  const router = useRouter()
  const [open, setOpen] = useState(true)

  if (!open || params.get('compte') !== 'supprime') return null

  function close() {
    setOpen(false)
    router.replace('/', { scroll: false })
  }

  return (
    <div
      role="status"
      className="fixed inset-x-4 bottom-4 z-50 mx-auto flex max-w-md items-center gap-3 rounded-2xl bg-forest px-5 py-4 text-sand shadow-card"
    >
      <p className="flex-1 font-raleway text-sm">Ton compte a été supprimé.</p>
      <button
        type="button"
        onClick={close}
        aria-label="Fermer"
        className="grid h-11 w-11 shrink-0 place-items-center rounded-full hover:bg-forest-light"
      >
        <X size={18} aria-hidden />
      </button>
    </div>
  )
}
