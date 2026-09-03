'use client'

import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useRouter } from 'next/navigation'
import { Sparkles, RotateCcw } from 'lucide-react'
import type { PlantCatalog } from '@prisma/client'
import { cn } from '@/lib/utils'
import { plantSchema, type PlantFormValues } from '@/lib/plant-schemas'
import { type Plant } from '@/lib/plant-types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { NativeSelect as Select } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { PlantPhotoField } from './PlantPhotoField'
import { PlantSearchInput } from './PlantSearchInput'

const EMOJI_GRID = ['🌿', '🌹', '🍅', '🌱', '🌸', '🌺', '🌻', '🎋', '🌵', '🍋', '🍃', '💜']

type Mode = 'search' | 'manual'

interface PlantFormProps {
  defaultValues?: Partial<Plant>
  onSubmit: (data: PlantFormValues, catalogPlant: PlantCatalog | null) => void | Promise<void>
  submitLabel?: string
  mode?: Mode
  /** Fiche du catalogue déjà choisie — le formulaire s'ouvre pré-rempli. */
  initialCatalogPlant?: PlantCatalog | null
}

// ── Catalog → form mappers ────────────────────────────────────────────────

function mapSunFromCatalog(sun: string): PlantFormValues['sunExposure'] {
  const m: Record<string, PlantFormValues['sunExposure']> = {
    FULL_SUN: 'full',
    PARTIAL: 'partial',
    SHADE: 'shade',
  }
  return m[sun] ?? 'partial'
}

function mapDifficultyFromCatalog(d: string): PlantFormValues['wateringDifficulty'] {
  const m: Record<string, PlantFormValues['wateringDifficulty']> = {
    EASY: 'easy',
    MEDIUM: 'medium',
    DEMANDING: 'demanding',
  }
  return m[d] ?? 'easy'
}

function mapCategoryFromCatalog(c: string): PlantFormValues['category'] {
  // Catalog categories written by the scraper (plant_scraper/2_enrich_plants.py):
  // INDOOR, VEGETABLE, FLOWERS, TREES_SHRUBS, HERBS, SUCCULENTS, AQUATIC, CLIMBING
  const m: Record<string, PlantFormValues['category']> = {
    INDOOR:       'interieur',
    VEGETABLE:    'potager',
    FLOWERS:      'fleurs',
    TREES_SHRUBS: 'arbres',
    HERBS:        'aromatiques',
    SUCCULENTS:   'interieur',
    AQUATIC:      'fleurs',
    CLIMBING:     'fleurs',
  }
  return m[c] ?? 'interieur'
}

// ── Component ─────────────────────────────────────────────────────────────

export function PlantForm({
  defaultValues,
  onSubmit,
  submitLabel = 'Enregistrer',
  mode: initialMode = 'search',
  initialCatalogPlant = null,
}: PlantFormProps) {
  const router = useRouter()
  const [mode, setMode] = useState<Mode>(initialMode)
  const [selectedCatalogPlant, setSelectedCatalogPlant] =
    useState<PlantCatalog | null>(initialCatalogPlant)

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<PlantFormValues>({
    resolver: zodResolver(plantSchema),
    defaultValues: {
      name:                  defaultValues?.name ?? '',
      scientificName:        defaultValues?.scientificName ?? '',
      emoji:                 defaultValues?.emoji ?? '🌿',
      photoUrl:              defaultValues?.photoUrl ?? undefined,
      category:              defaultValues?.category ?? 'interieur',
      location:              defaultValues?.location ?? 'interieur',
      zone:                  defaultValues?.zone ?? '',
      datePlanted:           defaultValues?.datePlanted ?? '',
      wateringFrequencyDays: defaultValues?.wateringFrequencyDays ?? 7,
      sunExposure:           defaultValues?.sunExposure ?? 'partial',
      soilType:              defaultValues?.soilType ?? '',
      wateringDifficulty:    defaultValues?.wateringDifficulty ?? 'easy',
      healthStatus:          defaultValues?.healthStatus ?? 'healthy',
      healthNote:            defaultValues?.healthNote ?? '',
      notes:                 '',
    },
  })

  const watchedEmoji = watch('emoji')
  const watchedPhoto = watch('photoUrl')
  const watchedSun = watch('sunExposure')
  const watchedDifficulty = watch('wateringDifficulty')
  const watchedHealth = watch('healthStatus')

  // Apply catalog values to form when a catalog plant is selected
  useEffect(() => {
    if (!selectedCatalogPlant) return
    const p = selectedCatalogPlant
    setValue('name', p.commonName, { shouldValidate: true })
    setValue('scientificName', p.scientificName, { shouldValidate: true })
    setValue('emoji', p.emoji ?? '🌿', { shouldValidate: true })
    setValue('category', mapCategoryFromCatalog(p.category), { shouldValidate: true })
    setValue('wateringFrequencyDays', p.wateringFreqDays, { shouldValidate: true })
    setValue('sunExposure', mapSunFromCatalog(p.sunExposure), { shouldValidate: true })
    setValue('wateringDifficulty', mapDifficultyFromCatalog(p.wateringDifficulty), { shouldValidate: true })
  }, [selectedCatalogPlant, setValue])

  function handleResetSearch() {
    setSelectedCatalogPlant(null)
    reset({
      name: '',
      scientificName: '',
      emoji: '🌿',
      photoUrl: undefined,
      category: 'interieur',
      location: 'interieur',
      zone: '',
      datePlanted: '',
      wateringFrequencyDays: 7,
      sunExposure: 'partial',
      soilType: '',
      wateringDifficulty: 'easy',
      healthStatus: 'healthy',
      healthNote: '',
      notes: '',
    })
  }

  const isSearchMode = mode === 'search'
  const showPrefilled = isSearchMode && selectedCatalogPlant !== null
  // Lime-tinted styling for catalog-sourced fields
  const prefilledClass = showPrefilled ? 'bg-lime/10 border-lime/60 focus-visible:border-lime' : ''
  const prefilledRadioActive = 'border-lime bg-lime/10 text-forest font-semibold ring-1 ring-lime/40'

  return (
    <form
      onSubmit={handleSubmit(data => onSubmit(data, selectedCatalogPlant))}
      noValidate
      className="space-y-8"
    >
      {/* === Search mode: top-of-form catalog search === */}
      {isSearchMode && (
        <section className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-poppins font-semibold text-base text-forest">
              {selectedCatalogPlant ? 'Plante sélectionnée' : '1. Trouve ta plante'}
            </h2>
            {selectedCatalogPlant && (
              <button
                type="button"
                onClick={handleResetSearch}
                className="inline-flex items-center gap-1 font-raleway text-xs text-forest/60 hover:text-forest underline underline-offset-2"
              >
                <RotateCcw size={12} aria-hidden />
                Changer de plante
              </button>
            )}
          </div>

          {!selectedCatalogPlant && (
            <>
              <PlantSearchInput
                onSelect={setSelectedCatalogPlant}
                onFallback={() => setMode('manual')}
              />
              <button
                type="button"
                onClick={() => setMode('manual')}
                className="font-raleway text-xs text-forest/50 hover:text-forest underline underline-offset-2"
              >
                Plante non trouvée ? Saisie manuelle →
              </button>
            </>
          )}

          {selectedCatalogPlant && (
            <CatalogPreviewCard plant={selectedCatalogPlant} />
          )}
        </section>
      )}

      {/* Show identity/entretien only after a catalog plant is picked in search mode,
          or always in manual mode */}
      {(!isSearchMode || selectedCatalogPlant) && (
        <>
          {isSearchMode && selectedCatalogPlant && (
            <div className="flex items-center gap-2 rounded-lg bg-lime/10 border border-lime/40 px-3 py-2">
              <Sparkles size={14} className="text-lime-hover" aria-hidden />
              <p className="font-raleway text-xs text-forest/70">
                Pré-rempli depuis le catalogue. Clique sur un champ pour l&apos;ajuster.
              </p>
            </div>
          )}

          {/* === Section 1 — Identité === */}
          <section className="space-y-5">
            <h2 className="font-poppins font-semibold text-base text-forest">
              {isSearchMode ? '2. Identité' : 'Identité de la plante'}
            </h2>

            {/* Nom commun */}
            <div>
              <Label htmlFor="name">Nom commun *</Label>
              <Input
                id="name"
                placeholder="ex. Monstera, Tomate cerise…"
                className={prefilledClass}
                aria-describedby={errors.name ? 'name-error' : undefined}
                {...register('name')}
              />
              {errors.name && (
                <p id="name-error" role="alert" className="mt-1 font-raleway text-xs text-red-600">
                  {errors.name.message}
                </p>
              )}
            </div>

            {/* Nom scientifique */}
            <div>
              <Label htmlFor="scientificName">
                Nom scientifique <span className="text-forest/40 font-normal">(optionnel)</span>
              </Label>
              <Input
                id="scientificName"
                placeholder="ex. Monstera deliciosa"
                className={cn('italic', prefilledClass)}
                {...register('scientificName')}
              />
            </div>

            {/* Emoji */}
            <div>
              <Label htmlFor="emoji">Emoji *</Label>
              <Input
                id="emoji"
                maxLength={2}
                className={cn('w-20 text-2xl text-center', prefilledClass)}
                aria-describedby={errors.emoji ? 'emoji-error' : undefined}
                {...register('emoji')}
              />
              {errors.emoji && (
                <p id="emoji-error" role="alert" className="mt-1 font-raleway text-xs text-red-600">
                  {errors.emoji.message}
                </p>
              )}
              <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label="Sélection rapide d'emoji">
                {EMOJI_GRID.map(e => (
                  <button
                    key={e}
                    type="button"
                    onClick={() => setValue('emoji', e, { shouldValidate: true })}
                    aria-pressed={watchedEmoji === e}
                    className={cn(
                      'h-10 w-10 rounded-lg text-xl transition-all border-2',
                      watchedEmoji === e
                        ? 'border-lime bg-lime/10 scale-110'
                        : 'border-transparent bg-sand hover:bg-lime/10',
                    )}
                  >
                    {e}
                  </button>
                ))}
              </div>
            </div>

            {/* Photo — la sienne prime sur celle du catalogue */}
            <PlantPhotoField
              value={watchedPhoto}
              emoji={watchedEmoji || '🌿'}
              onChange={(url) => setValue('photoUrl', url, { shouldDirty: true })}
            />

            {/* Catégorie */}
            <div>
              <Label htmlFor="category">Catégorie *</Label>
              <Select id="category" className={prefilledClass} {...register('category')}>
                <option value="interieur">Intérieur</option>
                <option value="potager">Potager</option>
                <option value="fleurs">Fleurs</option>
                <option value="arbres">Arbres</option>
                <option value="aromatiques">Aromatiques</option>
              </Select>
            </div>
          </section>

          <Separator />
        </>
      )}

      {/* === Section 2 — Localisation (always shown after catalog pick or in manual) === */}
      {(!isSearchMode || selectedCatalogPlant) && (
        <>
          <section className="space-y-5">
            <h2 className="font-poppins font-semibold text-base text-forest">
              {isSearchMode ? '3. Où se trouve-t-elle ?' : 'Localisation'}
            </h2>

            <div>
              <Label htmlFor="location">Emplacement *</Label>
              <Select id="location" {...register('location')}>
                <option value="interieur">🏠 Intérieur</option>
                <option value="exterieur">🌳 Extérieur</option>
                <option value="balcon">🌇 Balcon</option>
                <option value="serre">🏡 Serre</option>
              </Select>
            </div>

            <div>
              <Label htmlFor="zone">
                Zone / Pièce <span className="text-forest/40 font-normal">(optionnel)</span>
              </Label>
              <Input
                id="zone"
                placeholder="ex. Salon, Carré potager Nord…"
                {...register('zone')}
              />
            </div>

            <div>
              <Label htmlFor="datePlanted">
                Date de plantation <span className="text-forest/40 font-normal">(optionnel)</span>
              </Label>
              <Input id="datePlanted" type="date" {...register('datePlanted')} />
            </div>
          </section>

          <Separator />

          {/* === Section 3 — Entretien === */}
          <section className="space-y-5">
            <h2 className="font-poppins font-semibold text-base text-forest">
              {isSearchMode ? '4. Entretien' : 'Entretien'}
            </h2>

            {/* Fréquence arrosage */}
            <div>
              <Label htmlFor="wateringFrequencyDays">Fréquence d&apos;arrosage *</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="wateringFrequencyDays"
                  type="number"
                  min={1}
                  max={365}
                  className={cn('w-24', prefilledClass)}
                  aria-describedby={errors.wateringFrequencyDays ? 'watering-error' : 'watering-hint'}
                  {...register('wateringFrequencyDays', { valueAsNumber: true })}
                />
                <span className="font-raleway text-sm text-forest/60" id="watering-hint">jours</span>
              </div>
              {errors.wateringFrequencyDays && (
                <p id="watering-error" role="alert" className="mt-1 font-raleway text-xs text-red-600">
                  {errors.wateringFrequencyDays.message}
                </p>
              )}
            </div>

            {/* Exposition */}
            <fieldset>
              <legend className="block font-raleway text-sm font-medium text-forest/80 mb-2">
                Exposition *
              </legend>
              <div className="flex gap-3 flex-wrap" role="group">
                {([
                  { value: 'full',    icon: '☀️', label: 'Plein soleil' },
                  { value: 'partial', icon: '⛅', label: 'Mi-ombre' },
                  { value: 'shade',   icon: '🌥️', label: 'Ombre' },
                ] as const).map(opt => (
                  <label
                    key={opt.value}
                    className={cn(
                      'flex cursor-pointer items-center gap-2 rounded-xl border-2 px-4 py-2.5 transition-all font-raleway text-sm select-none',
                      watchedSun === opt.value
                        ? showPrefilled ? prefilledRadioActive : 'border-lime bg-lime/10 text-forest font-semibold'
                        : 'border-forest/15 bg-white text-forest/70 hover:border-lime/60',
                    )}
                  >
                    <input
                      type="radio"
                      value={opt.value}
                      className="sr-only"
                      {...register('sunExposure')}
                    />
                    <span aria-hidden>{opt.icon}</span>
                    {opt.label}
                  </label>
                ))}
              </div>
            </fieldset>

            {/* Type de sol */}
            <div>
              <Label htmlFor="soilType">
                Type de sol <span className="text-forest/40 font-normal">(optionnel)</span>
              </Label>
              <Input
                id="soilType"
                placeholder="ex. Terreau universel + perlite"
                {...register('soilType')}
              />
            </div>

            {/* Difficulté */}
            <fieldset>
              <legend className="block font-raleway text-sm font-medium text-forest/80 mb-2">
                Difficulté d&apos;entretien *
              </legend>
              <div className="flex gap-3 flex-wrap">
                {([
                  { value: 'easy',      icon: '🟢', label: 'Facile' },
                  { value: 'medium',    icon: '🟡', label: 'Moyen' },
                  { value: 'demanding', icon: '🔴', label: 'Exigeant' },
                ] as const).map(opt => (
                  <label
                    key={opt.value}
                    className={cn(
                      'flex cursor-pointer items-center gap-2 rounded-xl border-2 px-4 py-2.5 transition-all font-raleway text-sm select-none',
                      watchedDifficulty === opt.value
                        ? showPrefilled ? prefilledRadioActive : 'border-lime bg-lime/10 text-forest font-semibold'
                        : 'border-forest/15 bg-white text-forest/70 hover:border-lime/60',
                    )}
                  >
                    <input
                      type="radio"
                      value={opt.value}
                      className="sr-only"
                      {...register('wateringDifficulty')}
                    />
                    <span aria-hidden>{opt.icon}</span>
                    {opt.label}
                  </label>
                ))}
              </div>
            </fieldset>

            {/* État de santé */}
            <fieldset>
              <legend className="block font-raleway text-sm font-medium text-forest/80 mb-2">
                État de santé *
              </legend>
              <div className="flex gap-3 flex-wrap">
                {([
                  { value: 'healthy',  icon: '✅', label: 'En bonne santé' },
                  { value: 'warning',  icon: '⚠️', label: 'À surveiller' },
                  { value: 'critical', icon: '🚨', label: 'En danger' },
                ] as const).map(opt => (
                  <label
                    key={opt.value}
                    className={cn(
                      'flex cursor-pointer items-center gap-2 rounded-xl border-2 px-4 py-2.5 transition-all font-raleway text-sm select-none',
                      watchedHealth === opt.value
                        ? 'border-lime bg-lime/10 text-forest font-semibold'
                        : 'border-forest/15 bg-white text-forest/70 hover:border-lime/60',
                    )}
                  >
                    <input
                      type="radio"
                      value={opt.value}
                      className="sr-only"
                      {...register('healthStatus')}
                    />
                    <span aria-hidden>{opt.icon}</span>
                    {opt.label}
                  </label>
                ))}
              </div>
            </fieldset>

            {watchedHealth !== 'healthy' && (
              <div>
                <Label htmlFor="healthNote">Note de santé</Label>
                <Textarea
                  id="healthNote"
                  placeholder="ex. Feuilles qui jaunissent, surveille l'arrosage…"
                  rows={2}
                  {...register('healthNote')}
                />
              </div>
            )}

            <div>
              <Label htmlFor="notes">
                Notes <span className="text-forest/40 font-normal">(optionnel)</span>
              </Label>
              <Textarea
                id="notes"
                placeholder="Tes observations, astuces…"
                rows={3}
                {...register('notes')}
              />
            </div>
          </section>
        </>
      )}

      {/* Actions */}
      {(!isSearchMode || selectedCatalogPlant) && (
        <div className="flex items-center justify-end gap-3 pt-2 border-t border-forest/10">
          <Button type="button" variant="ghost" onClick={() => router.back()}>
            Annuler
          </Button>
          <Button type="submit" variant="primary" loading={isSubmitting}>
            {submitLabel}
          </Button>
        </div>
      )}
    </form>
  )
}

// ── Preview card ──────────────────────────────────────────────────────────

function CatalogPreviewCard({ plant }: { plant: PlantCatalog }) {
  const [imgFailed, setImgFailed] = useState(false)
  const showBanner = plant.imageUrl && !imgFailed

  return (
    <div className="overflow-hidden rounded-2xl border-2 border-lime/60 bg-lime/10">
      <div className="relative aspect-[3/1] w-full bg-lime/10">
        {showBanner ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={plant.imageUrl!}
              alt=""
              loading="lazy"
              decoding="async"
              onError={() => setImgFailed(true)}
              className="absolute inset-0 h-full w-full object-cover"
            />
            <div
              aria-hidden
              className="absolute inset-0 bg-gradient-to-t from-white/85 via-white/0 to-transparent"
            />
            {plant.toxic && (
              <span className="absolute top-2 right-2 inline-flex items-center gap-1 rounded-full bg-red-500/90 text-white px-2 py-0.5 font-raleway text-[10px] font-semibold shadow-sm">
                ⚠️ Toxique
              </span>
            )}
          </>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-6xl leading-none" aria-hidden>
              {plant.emoji ?? '🌿'}
            </span>
          </div>
        )}
      </div>

      <div className="p-4">
        <h3 className="font-poppins font-bold text-base text-forest">
          {plant.emoji ?? '🌿'} {plant.commonName}
        </h3>
        <p className="font-raleway text-xs italic text-forest/60 mb-2">
          {plant.scientificName}
        </p>
        {plant.descriptionShort && (
          <p className="font-raleway text-xs text-forest/70 leading-relaxed">
            {plant.descriptionShort}
          </p>
        )}
        <div className="mt-3 flex flex-wrap gap-1.5">
          <MetaBadge>💧 Arrosage tous les {plant.wateringFreqDays}j</MetaBadge>
          <MetaBadge>{sunLabel(plant.sunExposure)}</MetaBadge>
          <MetaBadge>{difficultyLabel(plant.wateringDifficulty)}</MetaBadge>
          {plant.toxic && !showBanner && (
            <span className="inline-flex items-center rounded-md bg-red-50 border border-red-200 px-2 py-0.5 font-raleway text-[10px] font-semibold text-red-600">
              ⚠️ Toxique
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

function MetaBadge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-md bg-white border border-lime/40 px-2 py-0.5 font-raleway text-[10px] font-medium text-forest/70">
      {children}
    </span>
  )
}

function sunLabel(s: string): string {
  return { FULL_SUN: '☀️ Plein soleil', PARTIAL: '⛅ Mi-ombre', SHADE: '🌥️ Ombre' }[s] ?? s
}

function difficultyLabel(d: string): string {
  return { EASY: '🟢 Facile', MEDIUM: '🟡 Moyen', DEMANDING: '🔴 Exigeant' }[d] ?? d
}
