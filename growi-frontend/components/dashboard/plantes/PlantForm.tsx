'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { plantSchema, type PlantFormValues } from '@/lib/plant-schemas'
import { type Plant } from '@/lib/plant-types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { NativeSelect as Select } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'

const EMOJI_GRID = ['🌿', '🌹', '🍅', '🌱', '🌸', '🌺', '🌻', '🎋', '🌵', '🍋', '🍃', '💜']

interface PlantFormProps {
  defaultValues?: Partial<Plant>
  onSubmit: (data: PlantFormValues) => void | Promise<void>
  submitLabel?: string
}

export function PlantForm({ defaultValues, onSubmit, submitLabel = 'Enregistrer' }: PlantFormProps) {
  const router = useRouter()

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<PlantFormValues>({
    resolver: zodResolver(plantSchema),
    defaultValues: {
      name:                  defaultValues?.name ?? '',
      scientificName:        defaultValues?.scientificName ?? '',
      emoji:                 defaultValues?.emoji ?? '🌿',
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
  const watchedSun = watch('sunExposure')
  const watchedDifficulty = watch('wateringDifficulty')
  const watchedHealth = watch('healthStatus')

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-8">

      {/* === Section 1 — Identité === */}
      <section className="space-y-5">
        <h2 className="font-poppins font-semibold text-base text-forest">
          Identité de la plante
        </h2>

        {/* Nom commun */}
        <div>
          <Label htmlFor="name">Nom commun *</Label>
          <Input
            id="name"
            placeholder="ex. Monstera, Tomate cerise…"
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
          <Label htmlFor="scientificName">Nom scientifique <span className="text-forest/40 font-normal">(optionnel)</span></Label>
          <Input
            id="scientificName"
            placeholder="ex. Monstera deliciosa"
            {...register('scientificName')}
          />
        </div>

        {/* Emoji */}
        <div>
          <Label htmlFor="emoji">Emoji *</Label>
          <Input
            id="emoji"
            maxLength={2}
            className="w-20 text-2xl text-center"
            aria-describedby={errors.emoji ? 'emoji-error' : undefined}
            {...register('emoji')}
          />
          {errors.emoji && (
            <p id="emoji-error" role="alert" className="mt-1 font-raleway text-xs text-red-600">
              {errors.emoji.message}
            </p>
          )}
          {/* Quick emoji grid */}
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

        {/* Catégorie */}
        <div>
          <Label htmlFor="category">Catégorie *</Label>
          <Select id="category" {...register('category')}>
            <option value="interieur">Intérieur</option>
            <option value="potager">Potager</option>
            <option value="fleurs">Fleurs</option>
            <option value="arbres">Arbres</option>
            <option value="aromatiques">Aromatiques</option>
          </Select>
        </div>
      </section>

      <Separator />

      {/* === Section 2 — Localisation === */}
      <section className="space-y-5">
        <h2 className="font-poppins font-semibold text-base text-forest">
          Localisation
        </h2>

        {/* Emplacement */}
        <div>
          <Label htmlFor="location">Emplacement *</Label>
          <Select id="location" {...register('location')}>
            <option value="interieur">🏠 Intérieur</option>
            <option value="exterieur">🌳 Extérieur</option>
            <option value="balcon">🌇 Balcon</option>
            <option value="serre">🏡 Serre</option>
          </Select>
        </div>

        {/* Zone / pièce */}
        <div>
          <Label htmlFor="zone">Zone / Pièce <span className="text-forest/40 font-normal">(optionnel)</span></Label>
          <Input
            id="zone"
            placeholder="ex. Salon, Carré potager Nord…"
            {...register('zone')}
          />
        </div>

        {/* Date plantation */}
        <div>
          <Label htmlFor="datePlanted">Date de plantation <span className="text-forest/40 font-normal">(optionnel)</span></Label>
          <Input
            id="datePlanted"
            type="date"
            {...register('datePlanted')}
          />
        </div>
      </section>

      <Separator />

      {/* === Section 3 — Entretien === */}
      <section className="space-y-5">
        <h2 className="font-poppins font-semibold text-base text-forest">
          Entretien
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
              className="w-24"
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

        {/* Exposition solaire */}
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
                    ? 'border-lime bg-lime/10 text-forest font-semibold'
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
          <Label htmlFor="soilType">Type de sol <span className="text-forest/40 font-normal">(optionnel)</span></Label>
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
                    ? 'border-lime bg-lime/10 text-forest font-semibold'
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

        {/* Note de santé — visible seulement si warning ou critical */}
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

        {/* Notes libres */}
        <div>
          <Label htmlFor="notes">Notes <span className="text-forest/40 font-normal">(optionnel)</span></Label>
          <Textarea
            id="notes"
            placeholder="Tes observations, astuces…"
            rows={3}
            {...register('notes')}
          />
        </div>
      </section>

      {/* Actions */}
      <div className="flex items-center justify-end gap-3 pt-2 border-t border-forest/10">
        <Button
          type="button"
          variant="ghost"
          onClick={() => router.back()}
        >
          Annuler
        </Button>
        <Button
          type="submit"
          variant="primary"
          loading={isSubmitting}
        >
          {submitLabel}
        </Button>
      </div>
    </form>
  )
}
