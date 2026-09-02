'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import {
  ArrowRight,
  Camera,
  ImageIcon,
  Leaf,
  Loader2,
  RefreshCw,
  ScanSearch,
  Search,
  Sparkles,
} from 'lucide-react'

import { prepareImageFile } from '@/lib/image-compression'
import type {
  IdentifyApiResponse,
  IdentifyDifficulty,
  IdentifySuccess,
} from '@/lib/types/identify'

/** Le résultat tel que le voit l'appelant : identifié, fiche encyclopédie comprise. */
export type IdentifiedPlant = IdentifySuccess & {
  encyclopediaSlug: string | null
  encyclopediaName: string | null
}

export interface IdentifyFlowProps {
  title: string
  intro: string
  /**
   * Ce qu'on propose une fois la plante reconnue. C'est le seul point qui
   * diffère entre le tableau de bord (« ajouter à mes plantes ») et la page
   * publique (« créer mon jardin ») — tout le reste du parcours est commun.
   */
  renderActions?: (plant: IdentifiedPlant) => ReactNode
}

type Step = 'upload' | 'loading' | 'result' | 'error'

const LOADING_MESSAGES = [
  'Analyse de la photo en cours…',
  'Identification de l\'espèce…',
  'Consultation de l\'encyclopédie…',
  'Rédaction de la fiche…',
]

const CONFIDENCE_STYLES: Record<
  'high' | 'medium' | 'low',
  { label: string; className: string }
> = {
  high: {
    label: '✓ Identification certaine',
    className: 'bg-lime/20 text-forest',
  },
  medium: {
    label: '~ Identification probable',
    className: 'bg-sun/20 text-forest',
  },
  low: {
    label: '? Identification incertaine',
    className: 'bg-red-50 text-red-700',
  },
}

const DIFFICULTY_STYLES: Record<
  IdentifyDifficulty,
  { label: string; className: string }
> = {
  easy: { label: 'Facile 🟢', className: 'bg-lime/20 text-forest' },
  medium: { label: 'Moyen 🟡', className: 'bg-sun/20 text-forest' },
  demanding: { label: 'Exigeant 🔴', className: 'bg-red-50 text-red-700' },
}

export function IdentifyFlow({ title, intro, renderActions }: IdentifyFlowProps) {
  const [step, setStep] = useState<Step>('upload')
  const [preview, setPreview] = useState<string | null>(null)
  const [result, setResult] = useState<IdentifyApiResponse | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [loadingIdx, setLoadingIdx] = useState(0)

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

  const handleReset = useCallback(() => {
    setStep('upload')
    setPreview(null)
    setResult(null)
    setErrorMsg(null)
    if (cameraInputRef.current) cameraInputRef.current.value = ''
    if (galleryInputRef.current) galleryInputRef.current.value = ''
  }, [])

  const handleFile = useCallback(async (file: File) => {
    const prepared = await prepareImageFile(file)
    if ('error' in prepared) {
      setErrorMsg(prepared.error)
      return
    }
    setErrorMsg(null)
    setPreview(prepared.dataUrl)
  }, [])

  const handleAnalyze = useCallback(async () => {
    if (!preview) return
    setStep('loading')
    setErrorMsg(null)
    try {
      const res = await fetch('/api/identify-plant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: preview }),
      })
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as
          | { error?: string }
          | null
        throw new Error(data?.error ?? 'Erreur serveur')
      }
      const data = (await res.json()) as IdentifyApiResponse
      setResult(data)
      setStep('result')
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Erreur inconnue')
      setStep('error')
    }
  }, [preview])

  return (
    <div className="flex flex-col gap-6 max-w-2xl mx-auto w-full">
      <header className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center justify-center w-9 h-9 rounded-xl bg-forest text-white">
            <ScanSearch size={18} aria-hidden />
          </span>
          <h1 className="font-poppins font-bold text-2xl text-forest">
            {title}
          </h1>
        </div>
        <p className="font-raleway text-sm text-forest/60">{intro}</p>
      </header>

      {step === 'upload' && (
        <UploadStep
          preview={preview}
          errorMsg={errorMsg}
          cameraInputRef={cameraInputRef}
          galleryInputRef={galleryInputRef}
          onFile={handleFile}
          onAnalyze={handleAnalyze}
          onClear={handleReset}
        />
      )}

      {step === 'loading' && (
        <div className="bg-white rounded-2xl shadow-card p-10 flex flex-col items-center gap-4">
          <Loader2
            size={36}
            className="text-forest animate-spin"
            aria-hidden
          />
          <p
            key={loadingIdx}
            className="font-raleway text-sm text-forest/70 animate-in fade-in duration-500"
          >
            {LOADING_MESSAGES[loadingIdx]}
          </p>
        </div>
      )}

      {step === 'result' && result && (
        <ResultStep
          preview={preview}
          result={result}
          onReset={handleReset}
          renderActions={renderActions}
        />
      )}

      {step === 'error' && (
        <div className="bg-white rounded-2xl shadow-card p-8 flex flex-col items-center gap-4 text-center">
          <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center text-2xl">
            ⚠️
          </div>
          <p className="font-poppins font-semibold text-forest">
            Une erreur est survenue
          </p>
          <p className="font-raleway text-sm text-forest/60">
            {errorMsg ?? 'Veuillez réessayer dans quelques instants.'}
          </p>
          <button
            type="button"
            onClick={handleReset}
            className="rounded-xl bg-forest text-white font-poppins font-semibold text-sm px-5 py-2.5 hover:bg-forest/90 transition-colors inline-flex items-center gap-2"
          >
            <RefreshCw size={16} aria-hidden />
            Réessayer
          </button>
        </div>
      )}
    </div>
  )
}

interface UploadStepProps {
  preview: string | null
  errorMsg: string | null
  cameraInputRef: React.RefObject<HTMLInputElement>
  galleryInputRef: React.RefObject<HTMLInputElement>
  onFile: (file: File) => void
  onAnalyze: () => void
  onClear: () => void
}

function UploadStep({
  preview,
  errorMsg,
  cameraInputRef,
  galleryInputRef,
  onFile,
  onAnalyze,
  onClear,
}: UploadStepProps) {
  const [isDragging, setIsDragging] = useState(false)

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault()
      setIsDragging(false)
      const file = e.dataTransfer.files?.[0]
      if (file) onFile(file)
    },
    [onFile],
  )

  return (
    <div className="flex flex-col gap-4">
      <div
        onDragOver={(e) => {
          e.preventDefault()
          setIsDragging(true)
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={`relative rounded-2xl border-2 border-dashed transition-colors bg-white p-8 flex flex-col items-center gap-4 text-center ${
          isDragging
            ? 'border-forest bg-lime/10'
            : 'border-forest/20 hover:border-forest/40'
        }`}
      >
        {preview ? (
          <div className="relative w-full max-w-md aspect-[4/3] rounded-xl overflow-hidden bg-sand">
            <Image
              src={preview}
              alt="Photo à analyser"
              fill
              sizes="(max-width: 768px) 100vw, 32rem"
              className="object-cover"
              unoptimized
            />
          </div>
        ) : (
          <>
            <div className="w-16 h-16 rounded-2xl bg-lime/15 flex items-center justify-center text-forest">
              <Leaf size={28} aria-hidden />
            </div>
            <div className="flex flex-col gap-1">
              <h2 className="font-poppins font-bold text-xl text-forest">
                Identifiez votre plante
              </h2>
              <p className="font-raleway text-sm text-forest/60">
                Prenez ou importez une photo — l&apos;IA fait le reste en quelques
                secondes
              </p>
            </div>
          </>
        )}

        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) onFile(f)
          }}
        />
        <input
          ref={galleryInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) onFile(f)
          }}
        />

        {!preview && (
          <div className="flex flex-col sm:flex-row gap-3 w-full max-w-md">
            <button
              type="button"
              onClick={() => cameraInputRef.current?.click()}
              className="flex-1 rounded-xl bg-forest text-white font-poppins font-semibold text-sm px-4 py-3 hover:bg-forest/90 transition-colors inline-flex items-center justify-center gap-2"
            >
              <Camera size={18} aria-hidden />
              Prendre une photo
            </button>
            <button
              type="button"
              onClick={() => galleryInputRef.current?.click()}
              className="flex-1 rounded-xl bg-lime/20 text-forest font-poppins font-semibold text-sm px-4 py-3 hover:bg-lime/30 transition-colors inline-flex items-center justify-center gap-2"
            >
              <ImageIcon size={18} aria-hidden />
              Choisir depuis la galerie
            </button>
          </div>
        )}
      </div>

      {errorMsg && (
        <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-4 py-2 font-raleway">
          {errorMsg}
        </p>
      )}

      {preview && (
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            type="button"
            onClick={onAnalyze}
            className="flex-1 rounded-xl bg-forest text-white font-poppins font-semibold text-sm px-5 py-3 hover:bg-forest/90 transition-colors inline-flex items-center justify-center gap-2"
          >
            <Sparkles size={18} aria-hidden />
            Analyser cette photo
            <ArrowRight size={16} aria-hidden />
          </button>
          <button
            type="button"
            onClick={onClear}
            className="rounded-xl bg-white border border-forest/20 text-forest font-poppins font-semibold text-sm px-5 py-3 hover:bg-sand transition-colors"
          >
            Changer de photo
          </button>
        </div>
      )}
    </div>
  )
}

interface ResultStepProps {
  preview: string | null
  result: IdentifyApiResponse
  onReset: () => void
  renderActions?: (plant: IdentifiedPlant) => ReactNode
}

function ResultStep({ preview, result, onReset, renderActions }: ResultStepProps) {
  if (!result.identified) {
    return (
      <div className="bg-white rounded-2xl shadow-card p-8 flex flex-col items-center gap-4 text-center">
        <div className="w-16 h-16 rounded-full bg-sand flex items-center justify-center text-3xl">
          <Search className="text-forest" size={28} aria-hidden />
        </div>
        <h2 className="font-poppins font-bold text-xl text-forest">
          Nous n&apos;avons pas pu identifier cette plante
        </h2>
        <p className="font-raleway text-sm text-forest/60 max-w-md">
          {result.reason}
        </p>
        <button
          type="button"
          onClick={onReset}
          className="rounded-xl bg-forest text-white font-poppins font-semibold text-sm px-5 py-2.5 hover:bg-forest/90 transition-colors inline-flex items-center gap-2"
        >
          <RefreshCw size={16} aria-hidden />
          Réessayer avec une autre photo
        </button>
      </div>
    )
  }

  const confidence = CONFIDENCE_STYLES[result.confidence]
  const difficulty = DIFFICULTY_STYLES[result.careGuide.difficulty]

  return (
    <div className="flex flex-col gap-5">
      {preview && (
        <div className="relative w-full h-[200px] rounded-2xl overflow-hidden bg-sand">
          <Image
            src={preview}
            alt={result.commonName}
            fill
            sizes="(max-width: 768px) 100vw, 42rem"
            className="object-cover"
            unoptimized
          />
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-card p-6 flex flex-col gap-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-poppins font-bold text-2xl text-forest flex items-center gap-2">
              <span aria-hidden>{result.emoji}</span>
              {result.commonName}
            </h2>
            <p className="font-raleway italic text-sm text-forest/60 mt-1">
              {result.scientificName}
              {result.family ? ` · ${result.family}` : ''}
            </p>
          </div>
          <span
            className={`shrink-0 rounded-full px-3 py-1 font-poppins text-xs font-semibold ${confidence.className}`}
          >
            {confidence.label}
          </span>
        </div>

        <p className="font-raleway text-sm text-forest/80 leading-relaxed">
          {result.shortDescription}
        </p>

        <div className="flex flex-col gap-3">
          <h3 className="font-poppins font-semibold text-sm text-forest">
            Guide d&apos;entretien
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <CareItem icon="💧" label="Arrosage" value={result.careGuide.watering} />
            <CareItem icon="☀️" label="Lumière" value={result.careGuide.light} />
            <CareItem icon="🪴" label="Substrat" value={result.careGuide.soil} />
            <CareItem
              icon="🌡️"
              label="Températures"
              value={result.careGuide.temperature}
            />
          </div>
          <div>
            <span
              className={`inline-flex rounded-full px-3 py-1 font-poppins text-xs font-semibold ${difficulty.className}`}
            >
              Difficulté · {difficulty.label}
            </span>
          </div>
        </div>

        <div className="rounded-xl bg-sand p-4 font-raleway text-sm text-forest/80">
          <span className="font-poppins font-semibold text-forest">
            💡 Le saviez-vous&nbsp;?
          </span>{' '}
          {result.funFact}
        </div>

        {result.warnings.length > 0 && (
          <div className="rounded-xl bg-red-50 border border-red-200 p-4 flex flex-col gap-2">
            <span className="font-poppins font-semibold text-sm text-red-700">
              ⚠️ Points d&apos;attention
            </span>
            <ul className="list-disc list-inside font-raleway text-sm text-red-700/90 space-y-1">
              {result.warnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          </div>
        )}

        {result.tags.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {result.tags.map((t) => (
              <span
                key={t}
                className="rounded-full bg-lime/15 text-forest font-poppins text-[11px] font-semibold px-2.5 py-1"
              >
                #{t}
              </span>
            ))}
          </div>
        )}
      </div>

      {renderActions?.(result)}

      {result.encyclopediaSlug && (
        <Link
          href={`/encyclopedie/${result.encyclopediaSlug}`}
          className="rounded-xl bg-white border border-forest/20 text-forest font-poppins font-semibold text-sm px-5 py-3 hover:bg-sand transition-colors inline-flex items-center justify-center gap-2"
        >
          Voir la fiche complète dans l&apos;encyclopédie
          <ArrowRight size={16} aria-hidden />
        </Link>
      )}

      <button
        type="button"
        onClick={onReset}
        className="rounded-xl bg-white border border-forest/20 text-forest font-poppins font-semibold text-sm px-5 py-3 hover:bg-sand transition-colors inline-flex items-center justify-center gap-2"
      >
        <RefreshCw size={16} aria-hidden />
        Identifier une autre plante
      </button>
    </div>
  )
}

function CareItem({
  icon,
  label,
  value,
}: {
  icon: string
  label: string
  value: string
}) {
  return (
    <div className="rounded-xl bg-sand p-3 flex flex-col gap-1">
      <span className="font-poppins text-xs font-semibold text-forest/70">
        <span aria-hidden>{icon}</span> {label}
      </span>
      <span className="font-raleway text-sm text-forest/80">{value}</span>
    </div>
  )
}
