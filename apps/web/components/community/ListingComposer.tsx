'use client'

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Camera, Loader2, MapPin, Trash2 } from 'lucide-react'
import type { ListingCategory, ListingKind } from '@growi/shared'
import {
  LISTING_CATEGORIES,
  LISTING_CATEGORY_LABELS,
  LISTING_DESCRIPTION_MAX_LENGTH,
  LISTING_KINDS,
  LISTING_KIND_LABELS,
  LISTING_QUANTITY_MAX_LENGTH,
  LISTING_TITLE_MAX_LENGTH,
  LISTING_WANTS_MAX_LENGTH,
} from '@growi/shared'

import { createListingAction } from '@/app/actions/community'
import { prepareImageFile } from '@/lib/image-compression'
import { cn } from '@/lib/utils'

/**
 * Composer une annonce depuis le web.
 *
 * Le pendant de la modale mobile — mais c'est ici que l'écriture est la plus
 * confortable : une annonce est surtout du texte, et sa photo est facultative.
 *
 * La photo part **dès qu'elle est choisie**, comme dans le formulaire d'une
 * plante : la soumission ne transporte alors qu'une URL. Une photo déposée puis
 * abandonnée reste orpheline dans le stockage, sans conséquence — rien ne la
 * référence.
 */

/**
 * Data URL → `File`, pour l'envoi en `multipart/form-data`.
 *
 * `compressImage` rend un data URL ; la route d'envoi attend un fichier. Sans
 * cette conversion il faudrait envoyer l'original, et une photo d'iPhone
 * dépasse à elle seule le plafond de 5 Mo de la route.
 */
function dataUrlToFile(dataUrl: string, name: string): File {
  const [header, encoded] = dataUrl.split(',')
  const mime = header.match(/:(.*?);/)?.[1] ?? 'image/jpeg'
  const binary = atob(encoded)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)

  return new File([bytes], name, { type: mime })
}

function Choice<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: readonly T[]
  value: T
  onChange: (next: T) => void
  label: (option: T) => string
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => onChange(option)}
          aria-pressed={value === option}
          className={cn(
            'rounded-lg border px-4 py-2 font-raleway text-sm transition-colors',
            value === option
              ? 'border-forest bg-lime font-medium text-forest'
              : 'border-forest/15 bg-white text-forest/60 hover:bg-sand',
          )}
        >
          {label(option)}
        </button>
      ))}
    </div>
  )
}

export function ListingComposer() {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)

  const [kind, setKind] = useState<ListingKind>('give')
  const [category, setCategory] = useState<ListingCategory>('seeds')
  const [description, setDescription] = useState('')
  const [photoUrl, setPhotoUrl] = useState<string | null>(null)

  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  async function upload(file: File) {
    setUploading(true)
    setError(null)

    try {
      const prepared = await prepareImageFile(file)
      if ('error' in prepared) throw new Error(prepared.error)

      const form = new FormData()
      form.append('file', dataUrlToFile(prepared.dataUrl, 'annonce.jpg'))
      form.append('kind', 'listing')

      // La session par cookie suffit : la route accepte le web comme le mobile.
      const response = await fetch('/api/v1/uploads', { method: 'POST', body: form })
      const body = await response.json()
      if (!response.ok) {
        throw new Error(body?.error?.message ?? "La photo n'a pas pu être envoyée.")
      }

      setPhotoUrl(body.data.url)
    } catch (err) {
      setError(err instanceof Error ? err.message : "La photo n'a pas pu être envoyée.")
    } finally {
      setUploading(false)
      // Permet de resélectionner le même fichier après une erreur.
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    formData.set('kind', kind)
    formData.set('category', category)
    if (photoUrl) formData.set('photoUrl', photoUrl)

    startTransition(async () => {
      const result = await createListingAction(formData)
      if (result.ok) {
        router.push(`/dashboard/communaute/bourse/${result.listingId}`)
      } else {
        setError(result.error)
      }
    })
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      <fieldset className="space-y-2">
        <legend className="font-raleway text-sm font-medium text-forest">Type d’annonce</legend>
        <Choice
          options={LISTING_KINDS}
          value={kind}
          onChange={setKind}
          label={(option) => LISTING_KIND_LABELS[option]}
        />
      </fieldset>

      <fieldset className="space-y-2">
        <legend className="font-raleway text-sm font-medium text-forest">Catégorie</legend>
        <Choice
          options={LISTING_CATEGORIES}
          value={category}
          onChange={setCategory}
          label={(option) => LISTING_CATEGORY_LABELS[option]}
        />
      </fieldset>

      <label className="block space-y-1">
        <span className="font-raleway text-sm font-medium text-forest">Titre</span>
        <input
          name="title"
          required
          maxLength={LISTING_TITLE_MAX_LENGTH}
          placeholder="Graines de tomate cœur de bœuf"
          className="w-full rounded-lg border border-forest/15 px-3 py-2 font-raleway text-forest"
        />
      </label>

      <label className="block space-y-1">
        <span className="font-raleway text-sm font-medium text-forest">
          Quantité <span className="font-normal text-forest/50">(facultatif)</span>
        </span>
        <input
          name="quantity"
          maxLength={LISTING_QUANTITY_MAX_LENGTH}
          placeholder="~30 graines"
          className="w-full rounded-lg border border-forest/15 px-3 py-2 font-raleway text-forest"
        />
      </label>

      {/* La contrepartie ne s'affiche que sur un échange : sur un don ou une
          recherche, la question ne se pose pas. */}
      {kind === 'swap' && (
        <label className="block space-y-1">
          <span className="font-raleway text-sm font-medium text-forest">
            En échange de <span className="font-normal text-forest/50">(facultatif)</span>
          </span>
          <input
            name="wants"
            maxLength={LISTING_WANTS_MAX_LENGTH}
            placeholder="Des boutures de romarin, ou ce qui te fait plaisir"
            className="w-full rounded-lg border border-forest/15 px-3 py-2 font-raleway text-forest"
          />
        </label>
      )}

      <label className="block space-y-1">
        <span className="font-raleway text-sm font-medium text-forest">
          Description <span className="font-normal text-forest/50">(facultatif)</span>
        </span>
        <textarea
          name="description"
          rows={4}
          maxLength={LISTING_DESCRIPTION_MAX_LENGTH}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="Récoltées cet été, variété ancienne, très productives…"
          className="w-full rounded-lg border border-forest/15 px-3 py-2 font-raleway text-forest"
        />
        <span className="block font-raleway text-xs text-forest/50">
          {description.length}/{LISTING_DESCRIPTION_MAX_LENGTH}
        </span>
      </label>

      <div className="space-y-2">
        <span className="block font-raleway text-sm font-medium text-forest">
          Photo <span className="font-normal text-forest/50">(facultatif)</span>
        </span>

        <div className="flex items-center gap-4">
          <div className="relative h-24 w-32 shrink-0 overflow-hidden rounded-xl bg-sand">
            {photoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={photoUrl} alt="" className="h-full w-full object-cover" />
            )}
            {uploading && (
              <span className="absolute inset-0 grid place-items-center bg-forest/40">
                <Loader2 size={20} className="animate-spin text-white" aria-hidden />
              </span>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <input
              ref={inputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0]
                if (file) void upload(file)
              }}
            />

            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={uploading || pending}
              className="inline-flex items-center gap-2 rounded-lg border border-forest/20 bg-white px-3 py-2 font-raleway text-sm font-medium text-forest hover:bg-sand disabled:opacity-60"
            >
              <Camera size={16} aria-hidden />
              {photoUrl ? 'Changer la photo' : 'Ajouter une photo'}
            </button>

            {photoUrl && (
              <button
                type="button"
                onClick={() => setPhotoUrl(null)}
                className="inline-flex items-center gap-2 font-raleway text-xs text-forest/60 underline-offset-2 hover:text-red-600 hover:underline"
              >
                <Trash2 size={13} aria-hidden />
                Retirer la photo
              </button>
            )}

            <p className="font-raleway text-xs text-forest/40">
              Redimensionnée avant l’envoi. JPEG, PNG ou WebP.
            </p>
          </div>
        </div>
      </div>

      <p className="flex items-start gap-2 rounded-2xl bg-sand p-4 font-raleway text-sm text-forest/70">
        <MapPin size={18} className="mt-0.5 shrink-0 text-forest" aria-hidden />
        Visible par les jardiniers autour de toi, à ~1 km près. L’annonce expire dans 60 jours —
        tu pourras la prolonger. Don et troc uniquement : Growi ne gère aucun paiement.
      </p>

      {error && (
        <p role="alert" className="font-raleway text-sm text-red-700">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending || uploading}
        className="inline-flex items-center gap-2 rounded-lg bg-lime px-5 py-2.5 font-raleway text-sm font-semibold text-forest hover:bg-lime/80 disabled:opacity-50"
      >
        {pending && <Loader2 size={15} className="animate-spin" aria-hidden />}
        Publier l’annonce
      </button>
    </form>
  )
}
