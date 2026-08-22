'use client'

import { useRef, useState } from 'react'
import Image from 'next/image'
import { Camera, Loader2, Trash2 } from 'lucide-react'
import { Label } from '@/components/ui/label'

/**
 * Photo d'une plante, dans le formulaire.
 *
 * Le fichier part dès qu'il est choisi : le formulaire ne manipule qu'une URL,
 * ce qui garde sa soumission identique à ce qu'elle était. Une photo déposée
 * puis abandonnée reste orpheline dans le stockage — sans conséquence, rien ne
 * la référence.
 */
export function PlantPhotoField({
  value,
  emoji,
  onChange,
}: {
  value?: string
  emoji: string
  onChange: (url: string | undefined) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function upload(file: File) {
    setUploading(true)
    setError(null)

    try {
      const form = new FormData()
      form.append('file', file)
      form.append('kind', 'plant')

      // La session par cookie suffit : la route accepte le web comme le mobile.
      const response = await fetch('/api/v1/uploads', { method: 'POST', body: form })
      const body = await response.json()

      if (!response.ok) {
        throw new Error(body?.error?.message ?? "La photo n'a pas pu être envoyée.")
      }
      onChange(body.data.url)
    } catch (err) {
      setError(err instanceof Error ? err.message : "La photo n'a pas pu être envoyée.")
    } finally {
      setUploading(false)
      // Permet de resélectionner le même fichier après une erreur.
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <div>
      <Label htmlFor="plant-photo">Photo</Label>

      <div className="mt-1 flex items-center gap-4">
        <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-xl bg-sand">
          {value ? (
            <Image src={value} alt="" fill sizes="96px" className="object-cover" />
          ) : (
            <span className="flex h-full items-center justify-center text-4xl" aria-hidden>
              {emoji}
            </span>
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
            id="plant-photo"
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
            disabled={uploading}
            className="inline-flex items-center gap-2 rounded-lg border border-forest/20 bg-white px-3 py-2 font-poppins text-sm font-semibold text-forest transition-colors hover:bg-sand disabled:opacity-60"
          >
            <Camera size={16} aria-hidden />
            {value ? 'Changer la photo' : 'Ajouter une photo'}
          </button>

          {value && (
            <button
              type="button"
              onClick={() => onChange(undefined)}
              className="inline-flex items-center gap-2 font-raleway text-xs text-forest/60 underline-offset-2 hover:text-red-600 hover:underline"
            >
              <Trash2 size={13} aria-hidden />
              Retirer la photo
            </button>
          )}

          <p className="font-raleway text-xs text-forest/40">JPEG, PNG ou WebP — 5 Mo maximum.</p>
        </div>
      </div>

      {error && (
        <p role="alert" className="mt-2 font-raleway text-xs text-red-600">
          {error}
        </p>
      )}
    </div>
  )
}
