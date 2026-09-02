'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Camera,
  ImageIcon,
  Loader2,
  RefreshCw,
  ScanSearch,
  Sparkles,
  Stethoscope,
} from 'lucide-react'
import type { DiagnoseApiResponse, DiagnosisSuccess, HealthStatus } from '@growi/shared'

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  diagnosisChatParams,
  useChatPanel,
} from '@/components/dashboard/chat/ChatPanelProvider'
import { DiagnosisResult } from '@/components/diagnosis/DiagnosisResult'
import { prepareImageFile } from '@/lib/image-compression'

/**
 * Parcours de diagnostic d'une plante, en trois temps : choix de la photo,
 * analyse, résultat.
 *
 * Le tout vit dans une modale plutôt que sur une route dédiée : la fiche
 * plante est un composant client nourri par le contexte, et diagnostiquer ne
 * doit pas faire perdre sa place à l'utilisateur.
 */

type Step = 'photo' | 'loading' | 'result'

const LOADING_MESSAGES = [
  'Lecture de la photo…',
  'Croisement avec la fiche de la plante…',
  'Prise en compte de la météo locale…',
  'Rédaction du diagnostic…',
]

export interface DiagnosisFlowProps {
  plantId: string
  plantName: string
  /** Photo de la fiche, si elle en a une : permet de diagnostiquer sans reprendre de photo. */
  plantPhotoUrl?: string
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Appelé après une mise à jour acceptée, pour rafraîchir la fiche. */
  onStatusApplied?: (status: HealthStatus, note: string) => void
  /** Appelé après un diagnostic réussi, pour rafraîchir l'historique. */
  onDiagnosed?: () => void
  /** Appelé après une planification, pour rafraîchir calendrier et historique. */
  onPlanned?: () => void
}

export function DiagnosisFlow({
  plantId,
  plantName,
  plantPhotoUrl,
  open,
  onOpenChange,
  onStatusApplied,
  onDiagnosed,
  onPlanned,
}: DiagnosisFlowProps) {
  const openChat = useChatPanel()
  const [step, setStep] = useState<Step>('photo')
  const [preview, setPreview] = useState<string | null>(null)
  const [response, setResponse] = useState<DiagnoseApiResponse | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [loadingIdx, setLoadingIdx] = useState(0)

  const [isApplying, setIsApplying] = useState(false)
  const [applied, setApplied] = useState(false)
  const [applyError, setApplyError] = useState<string | null>(null)
  const [applyDismissed, setApplyDismissed] = useState(false)

  const [isPlanning, setIsPlanning] = useState(false)
  const [plannedAt, setPlannedAt] = useState<string | null>(null)
  const [planError, setPlanError] = useState<string | null>(null)

  const cameraInputRef = useRef<HTMLInputElement>(null)
  const galleryInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (step !== 'loading') return
    setLoadingIdx(0)
    const id = window.setInterval(() => {
      setLoadingIdx((i) => (i + 1) % LOADING_MESSAGES.length)
    }, 2000)
    return () => window.clearInterval(id)
  }, [step])

  const reset = useCallback(() => {
    setStep('photo')
    setPreview(null)
    setResponse(null)
    setErrorMsg(null)
    setApplied(false)
    setApplyError(null)
    setApplyDismissed(false)
    setPlannedAt(null)
    setPlanError(null)
    if (cameraInputRef.current) cameraInputRef.current.value = ''
    if (galleryInputRef.current) galleryInputRef.current.value = ''
  }, [])

  // Rouvrir la modale doit repartir d'une page blanche, jamais du diagnostic
  // précédent — l'historique est là pour le relire.
  useEffect(() => {
    if (!open) reset()
  }, [open, reset])

  const handleFile = useCallback(async (file: File) => {
    const prepared = await prepareImageFile(file)
    if ('error' in prepared) {
      setErrorMsg(prepared.error)
      return
    }
    setErrorMsg(null)
    setPreview(prepared.dataUrl)
  }, [])

  const analyze = useCallback(
    async (body: { imageBase64: string } | { useExistingPhoto: true }) => {
      setStep('loading')
      setErrorMsg(null)
      try {
        const res = await fetch(`/api/v1/plants/${encodeURIComponent(plantId)}/diagnose`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
        const payload = (await res.json().catch(() => null)) as
          | { data?: DiagnoseApiResponse; error?: { message?: string } }
          | null

        if (!res.ok || !payload?.data) {
          throw new Error(payload?.error?.message ?? "Le diagnostic n'a pas abouti.")
        }

        setResponse(payload.data)
        setStep('result')
        if (payload.data.diagnosed) onDiagnosed?.()
      } catch (err) {
        setErrorMsg(err instanceof Error ? err.message : 'Erreur inconnue')
        setStep('photo')
      }
    },
    [plantId, onDiagnosed],
  )

  const handleApply = useCallback(async () => {
    if (!response?.diagnosed || !response.diagnosisId) return
    setIsApplying(true)
    setApplyError(null)
    try {
      const res = await fetch(
        `/api/v1/plants/${encodeURIComponent(plantId)}/diagnoses/${encodeURIComponent(response.diagnosisId)}/apply`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ apply: true }),
        },
      )
      if (!res.ok) throw new Error("L'état n'a pas pu être mis à jour.")

      setApplied(true)
      onStatusApplied?.(response.status, response.summary)
    } catch (err) {
      setApplyError(err instanceof Error ? err.message : 'Erreur inconnue')
    } finally {
      setIsApplying(false)
    }
  }, [plantId, response, onStatusApplied])

  const handlePlan = useCallback(async () => {
    if (!response?.diagnosed || !response.diagnosisId) return
    setIsPlanning(true)
    setPlanError(null)
    try {
      const res = await fetch(
        `/api/v1/plants/${encodeURIComponent(plantId)}/diagnoses/${encodeURIComponent(response.diagnosisId)}/plan`,
        { method: 'POST' },
      )
      if (!res.ok) throw new Error("Les actions n'ont pas pu être planifiées.")

      const payload = (await res.json()) as { data: { tasksPlannedAt: string } }
      setPlannedAt(payload.data.tasksPlannedAt)
      onPlanned?.()
    } catch (err) {
      setPlanError(err instanceof Error ? err.message : 'Erreur inconnue')
    } finally {
      setIsPlanning(false)
    }
  }, [plantId, response, onPlanned])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-poppins text-forest flex items-center gap-2">
            <Stethoscope size={18} aria-hidden />
            Diagnostiquer {plantName}
          </DialogTitle>
        </DialogHeader>

        {step === 'photo' && (
          <div className="flex flex-col gap-4">
            <p className="font-raleway text-sm text-forest/60">
              Une photo nette, en pleine lumière, feuilles bien visibles. L&apos;analyse
              tient compte de la fiche de la plante, de son jardin et de la météo.
            </p>

            {preview && (
              // eslint-disable-next-line @next/next/no-img-element -- data URL local
              <img
                src={preview}
                alt="Photo à analyser"
                className="w-full h-44 object-cover rounded-xl bg-sand"
              />
            )}

            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              data-testid="diagnosis-camera-input"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) handleFile(f)
              }}
            />
            <input
              ref={galleryInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              data-testid="diagnosis-gallery-input"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) handleFile(f)
              }}
            />

            {errorMsg && (
              <p className="font-raleway text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-4 py-2">
                {errorMsg}
              </p>
            )}

            {preview ? (
              <div className="flex flex-col sm:flex-row gap-2">
                <button
                  type="button"
                  onClick={() => analyze({ imageBase64: preview })}
                  className="flex-1 rounded-xl bg-forest text-white font-poppins font-semibold text-sm px-4 py-3 hover:bg-forest/90 transition-colors inline-flex items-center justify-center gap-2"
                >
                  <Sparkles size={16} aria-hidden />
                  Analyser cette photo
                </button>
                <button
                  type="button"
                  onClick={() => setPreview(null)}
                  className="rounded-xl bg-white border border-forest/20 text-forest font-poppins font-semibold text-sm px-4 py-3 hover:bg-sand transition-colors"
                >
                  Changer
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => cameraInputRef.current?.click()}
                  className="rounded-xl bg-forest text-white font-poppins font-semibold text-sm px-4 py-3 hover:bg-forest/90 transition-colors inline-flex items-center justify-center gap-2"
                >
                  <Camera size={16} aria-hidden />
                  Prendre une photo
                </button>
                <button
                  type="button"
                  onClick={() => galleryInputRef.current?.click()}
                  className="rounded-xl bg-lime/20 text-forest font-poppins font-semibold text-sm px-4 py-3 hover:bg-lime/30 transition-colors inline-flex items-center justify-center gap-2"
                >
                  <ImageIcon size={16} aria-hidden />
                  Choisir une photo
                </button>
                {plantPhotoUrl && (
                  <button
                    type="button"
                    onClick={() => analyze({ useExistingPhoto: true })}
                    className="rounded-xl bg-white border border-forest/20 text-forest font-poppins font-semibold text-sm px-4 py-3 hover:bg-sand transition-colors inline-flex items-center justify-center gap-2"
                  >
                    <ScanSearch size={16} aria-hidden />
                    Utiliser la photo de la fiche
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {step === 'loading' && (
          <div className="py-10 flex flex-col items-center gap-4">
            <Loader2 size={32} className="text-forest animate-spin" aria-hidden />
            <p
              key={loadingIdx}
              className="font-raleway text-sm text-forest/70 animate-in fade-in duration-500"
            >
              {LOADING_MESSAGES[loadingIdx]}
            </p>
          </div>
        )}

        {step === 'result' && response && (
          <>
            {response.diagnosed ? (
              <DiagnosisResult
                result={response as DiagnosisSuccess}
                photoUrl={response.photoUrl ?? preview}
                currentHealthStatus={response.currentHealthStatus}
                onApply={applyDismissed ? undefined : handleApply}
                onDismissApply={() => setApplyDismissed(true)}
                isApplying={isApplying}
                applied={applied}
                applyError={applyError}
                onPlan={handlePlan}
                isPlanning={isPlanning}
                tasksPlannedAt={plannedAt ?? response.tasksPlannedAt}
                planError={planError}
                onAsk={
                  response.diagnosisId
                    ? (draft) =>
                        openChat(diagnosisChatParams(plantId, response.diagnosisId!, draft))
                    : undefined
                }
              />
            ) : (
              <div className="py-6 flex flex-col items-center gap-4 text-center">
                <div className="w-14 h-14 rounded-full bg-sand flex items-center justify-center">
                  <ScanSearch size={26} className="text-forest" aria-hidden />
                </div>
                <p className="font-poppins font-semibold text-forest">
                  Diagnostic impossible
                </p>
                <p className="font-raleway text-sm text-forest/60 max-w-sm">
                  {response.reason}
                </p>
                <button
                  type="button"
                  onClick={reset}
                  className="rounded-xl bg-forest text-white font-poppins font-semibold text-sm px-5 py-2.5 hover:bg-forest/90 transition-colors inline-flex items-center gap-2"
                >
                  <RefreshCw size={16} aria-hidden />
                  Réessayer
                </button>
              </div>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
