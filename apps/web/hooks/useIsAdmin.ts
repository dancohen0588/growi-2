'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'

/**
 * Le compte connecté est-il administrateur ?
 *
 * On interroge `/api/admin/status` plutôt que `session.user.role` : ce dernier
 * est écrit dans le JWT à la connexion et n'y bouge plus. Un compte promu ne
 * verrait jamais le lien avant de se reconnecter, et un compte rétrogradé
 * continuerait à le voir.
 *
 * Répond `false` tant qu'on ne sait pas : mieux vaut afficher le lien avec un
 * instant de retard que le montrer à qui n'y a pas droit.
 */
export function useIsAdmin(): boolean {
  const { status } = useSession()
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    if (status !== 'authenticated') {
      setIsAdmin(false)
      return
    }

    // `ignore` protège d'une réponse qui arriverait après une déconnexion ou
    // un démontage : sans lui, le lien pourrait réapparaître tout seul.
    let ignore = false

    fetch('/api/admin/status')
      .then((res) => (res.ok ? res.json() : { isAdmin: false }))
      .then((data) => {
        if (!ignore) setIsAdmin(Boolean(data?.isAdmin))
      })
      // Une panne réseau n'est pas une autorisation.
      .catch(() => {
        if (!ignore) setIsAdmin(false)
      })

    return () => {
      ignore = true
    }
  }, [status])

  return isAdmin
}
