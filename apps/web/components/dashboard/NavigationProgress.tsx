'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'

/**
 * Fine barre lime en haut de page pendant une navigation interne.
 *
 * L'App Router de Next 14 n'expose aucun événement de navigation : on part
 * donc du clic sur un lien interne (et de « précédent »/« suivant »), et l'on
 * conclut quand l'URL rendue change. Ce n'est pas une mesure de progression —
 * la largeur avance à l'aveugle vers 85 % — mais une réponse immédiate au
 * clic, ce qui manquait : sans elle, un lien du menu ne donnait aucun signe de
 * vie tant que le serveur n'avait pas fini.
 *
 * - Rien ne s'affiche avant 120 ms : une navigation instantanée (page en
 *   cache) ne doit pas faire clignoter la barre.
 * - Une navigation qui n'aboutit jamais (lien vers la même page, erreur) est
 *   abandonnée au bout de 12 s plutôt que de laisser la barre figée.
 *
 * À monter sous un `<Suspense>` : `useSearchParams` l'exige.
 */
export function NavigationProgress() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [width, setWidth] = useState(0)
  const [visible, setVisible] = useState(false)
  const timers = useRef<{ show?: number; trickle?: number; giveUp?: number; hide?: number }>({})
  const active = useRef(false)

  function clearTimers() {
    const t = timers.current
    window.clearTimeout(t.show)
    window.clearInterval(t.trickle)
    window.clearTimeout(t.giveUp)
    window.clearTimeout(t.hide)
    timers.current = {}
  }

  function start() {
    if (active.current) return
    active.current = true
    clearTimers()
    setWidth(0)
    timers.current.show = window.setTimeout(() => {
      setVisible(true)
      setWidth(15)
      timers.current.trickle = window.setInterval(() => {
        // Chaque pas couvre une part de ce qui reste : on ralentit à
        // l'approche de 85 % sans jamais l'atteindre.
        setWidth((w) => w + (85 - w) * 0.12)
      }, 250)
    }, 120)
    timers.current.giveUp = window.setTimeout(done, 12_000)
  }

  function done() {
    if (!active.current) return
    active.current = false
    clearTimers()
    setWidth(100)
    timers.current.hide = window.setTimeout(() => {
      setVisible(false)
      setWidth(0)
    }, 350)
  }

  // L'URL rendue a changé : la navigation est arrivée.
  useEffect(() => {
    done()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, searchParams])

  useEffect(() => {
    function onClick(event: MouseEvent) {
      if (event.defaultPrevented || event.button !== 0) return
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
      const anchor = (event.target as Element | null)?.closest?.('a')
      if (!anchor || !anchor.href) return
      if (anchor.target && anchor.target !== '_self') return
      if (anchor.hasAttribute('download')) return

      const url = new URL(anchor.href, window.location.href)
      if (url.origin !== window.location.origin) return
      // Même page (ancre, ou lien vers soi) : aucune navigation à attendre.
      if (url.pathname === window.location.pathname && url.search === window.location.search) return
      start()
    }
    function onPopState() {
      start()
    }

    document.addEventListener('click', onClick, true)
    window.addEventListener('popstate', onPopState)
    return () => {
      document.removeEventListener('click', onClick, true)
      window.removeEventListener('popstate', onPopState)
      clearTimers()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-x-0 top-0 z-[60] h-[3px]"
    >
      <div
        className="nav-progress h-full rounded-r-full bg-lime shadow-[0_0_8px_rgba(180,221,127,0.9)]"
        style={{ width: `${width}%`, opacity: visible ? 1 : 0 }}
      />
    </div>
  )
}
