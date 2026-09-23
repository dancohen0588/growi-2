'use client'

import { useId, useRef, useState, useTransition } from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { Loader2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { DialogOverlay, DialogPortal } from '@/components/ui/dialog'
import { useAnalyticsConsent } from '@/lib/analytics/client'

/**
 * La question du consentement à la mesure d'usage, posée **une fois** par
 * compte, avant toute émission.
 *
 * Trois exigences de la CNIL en dictent la forme :
 * - **aucun choix n'est pré-sélectionné**, et les deux boutons ont le même
 *   poids — même variante, même largeur ; un « non » plus discret que le
 *   « oui » vaudrait consentement forcé ;
 * - la boîte **ne se ferme pas sans réponse** (ni clic à côté, ni Échap) —
 *   sans quoi la question reviendrait à chaque page ;
 * - on dit ce qui est mesuré, et où changer d'avis.
 *
 * Écrit par `/api/user/profile`, comme le reste du compte. Le choix prend
 * effet à l'instant (`setConsent`) ; si l'écriture échoue, la boîte reste et
 * rien n'a été démarré.
 */
export function ConsentDialog() {
  const { consent, setConsent } = useAnalyticsConsent()
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const titleRef = useRef<HTMLHeadingElement>(null)
  const descriptionId = useId()

  function choose(choice: boolean) {
    setError(null)
    startTransition(async () => {
      const result = await saveConsent(choice)
      if (result.error) {
        setError(result.error)
        return
      }
      setConsent(choice)
    })
  }

  return (
    <DialogPrimitive.Root open={consent === null}>
      <DialogPortal>
        <DialogOverlay className="bg-forest/60" />
        <DialogPrimitive.Content
          aria-describedby={descriptionId}
          onEscapeKeyDown={(event) => event.preventDefault()}
          onInteractOutside={(event) => event.preventDefault()}
          // Le focus va au titre : placé sur un bouton, il désignerait un choix.
          onOpenAutoFocus={(event) => {
            event.preventDefault()
            titleRef.current?.focus()
          }}
          className="fixed left-1/2 top-1/2 z-50 flex w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 flex-col gap-5 rounded-2xl bg-white p-6 shadow-card focus:outline-none sm:p-8"
        >
          <DialogPrimitive.Title
            ref={titleRef}
            tabIndex={-1}
            className="font-poppins text-xl font-semibold text-forest focus:outline-none"
          >
            Aider à améliorer Growi ?
          </DialogPrimitive.Title>

          <p id={descriptionId} className="font-raleway text-[15px] leading-relaxed text-forest/80">
            Pour savoir quelles fonctions servent vraiment, Growi peut mesurer les écrans que tu
            ouvres et les gestes que tu fais dans l&apos;app — jamais tes photos, tes messages ni
            ton jardin. Tu peux changer d&apos;avis à tout moment depuis ton profil.
          </p>

          <div className="flex flex-col gap-3 min-[480px]:flex-row">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              disabled={pending}
              onClick={() => choose(true)}
            >
              Oui, j&apos;aide
            </Button>
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              disabled={pending}
              onClick={() => choose(false)}
            >
              Non merci
            </Button>
          </div>

          {pending && (
            <p className="flex items-center gap-2 font-raleway text-sm text-forest/60" role="status">
              <Loader2 size={14} className="animate-spin" aria-hidden />
              Enregistrement…
            </p>
          )}

          {error && (
            <p
              role="alert"
              className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 font-raleway text-sm text-red-700"
            >
              {error}
            </p>
          )}

          <a
            href="/confidentialite#mesure-d-usage"
            target="_blank"
            rel="noopener"
            className="self-start font-raleway text-sm text-forest/70 underline underline-offset-2 hover:text-forest"
          >
            Voir ce qui est mesuré
          </a>
        </DialogPrimitive.Content>
      </DialogPortal>
    </DialogPrimitive.Root>
  )
}

async function saveConsent(analyticsConsent: boolean): Promise<{ error?: string }> {
  try {
    const res = await fetch('/api/user/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ analyticsConsent }),
      // Sans limite, un serveur qui ne répond pas laisserait la boîte en
      // « Enregistrement… » pour toujours — et elle ne se ferme pas sans
      // réponse. Mieux vaut un message et un bouton qu'on peut retaper.
      signal: AbortSignal.timeout(15_000),
    })
    const data = await res.json().catch(() => null)
    if (!res.ok) return { error: data?.error ?? 'Ton choix n’a pas pu être enregistré. Réessaie.' }
    return {}
  } catch {
    return { error: 'Impossible de joindre Growi. Vérifie ta connexion et réessaie.' }
  }
}
