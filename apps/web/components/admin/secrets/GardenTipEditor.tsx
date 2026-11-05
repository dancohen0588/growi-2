'use client'

import { useState, useTransition } from 'react'
import { Loader2, Save } from 'lucide-react'
import {
  HEALTH_STATUSES,
  HEALTH_STATUS_LABELS,
  PLANT_CATEGORIES,
  PLANT_CATEGORY_LABELS,
  PLANT_LOCATIONS,
  PLANT_LOCATION_LABELS,
  SECRET_EVIDENCES,
  SECRET_EVIDENCE_HINTS,
  SECRET_EVIDENCE_LABELS,
  type SecretConditions,
  type SecretPlanche,
} from '@growi/shared'

import type { ActionResult } from '@/components/admin/ActionButton'
import { PlancheEditor } from '@/components/admin/secrets/PlancheEditor'
import { CONDITION_FIELDS, MONTH_SHORT } from '@/lib/admin/secret-form'
import { cn } from '@/lib/utils'

export type GardenTipFormValues = {
  slug: string
  title: string
  teaser: string
  story: string | null
  recipe: string
  ingredients: string[]
  evidence: string
  cautions: string | null
  prepDays: number
  effortMinutes: number | null
  cooldownDays: number
  conditions: SecretConditions
  /** `null` : pas de planche, ou une planche illisible que l'enregistrement remplacera. */
  planche: SecretPlanche | null
}

const TITLE_MAX = 80
const TEASER_MAX = 160

const INPUT = 'w-full min-w-0 rounded-lg border border-forest/15 bg-white px-3 py-2 text-sm text-forest'

/** Accents retirés, minuscules, tirets : la forme qu'exige `secretSlugSchema`. */
function slugify(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/œ/g, 'oe')
    .replace(/æ/g, 'ae')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64)
    .replace(/-+$/, '')
}

/**
 * Édition d'un secret — et création, avec le champ identifiant en plus.
 *
 * Les conditions sont saisies en champs structurés, pas en JSON : une virgule
 * oubliée ne doit pas retirer un secret du tirage. Le service valide tout et
 * renvoie ses défauts en français ; l'aperçu, à côté, montre la version
 * **enregistrée**.
 */
export function GardenTipEditor({
  mode,
  tip,
  action,
}: {
  mode: 'create' | 'edit'
  tip: GardenTipFormValues
  action: (formData: FormData) => Promise<ActionResult>
}) {
  const [title, setTitle] = useState(tip.title)
  const [teaser, setTeaser] = useState(tip.teaser)
  const [slug, setSlug] = useState(tip.slug)
  const [slugTouched, setSlugTouched] = useState(Boolean(tip.slug))
  const [evidence, setEvidence] = useState(tip.evidence)
  const [result, setResult] = useState<ActionResult | null>(null)
  const [pending, startTransition] = useTransition()

  const c = tip.conditions

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    startTransition(async () => setResult(await action(formData)))
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <Field label="Titre" htmlFor="tip-title" hint={<Counter value={title} max={TITLE_MAX} />}>
        <input
          id="tip-title"
          name="title"
          value={title}
          onChange={(event) => {
            setTitle(event.target.value)
            if (mode === 'create' && !slugTouched) setSlug(slugify(event.target.value))
          }}
          required
          className={INPUT}
        />
      </Field>

      {mode === 'create' && (
        <Field
          label="Identifiant"
          htmlFor="tip-slug"
          help="Figé après la création : il est recopié dans le journal des jardiniers."
        >
          <input
            id="tip-slug"
            name="slug"
            value={slug}
            onChange={(event) => {
              setSlugTouched(true)
              setSlug(event.target.value)
            }}
            required
            maxLength={64}
            pattern="[a-z0-9]+(-[a-z0-9]+)*"
            className={cn(INPUT, 'font-mono')}
          />
        </Field>
      )}

      <Field
        label="Accroche"
        htmlFor="tip-teaser"
        hint={<Counter value={teaser} max={TEASER_MAX} />}
        help="Seul texte visible avant le dévoilement : donner envie, sans livrer la recette."
      >
        <textarea
          id="tip-teaser"
          name="teaser"
          rows={2}
          value={teaser}
          onChange={(event) => setTeaser(event.target.value)}
          required
          className={INPUT}
        />
      </Field>

      <Field label="Niveau de preuve" htmlFor="tip-evidence" help={SECRET_EVIDENCE_HINTS[evidence as keyof typeof SECRET_EVIDENCE_HINTS]}>
        <select
          id="tip-evidence"
          name="evidence"
          value={evidence}
          onChange={(event) => setEvidence(event.target.value)}
          className={INPUT}
        >
          {SECRET_EVIDENCES.map((value) => (
            <option key={value} value={value}>
              {SECRET_EVIDENCE_LABELS[value]}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Histoire" htmlFor="tip-story" help="Le pourquoi de la tradition. Facultatif, 800 caractères au plus.">
        <textarea id="tip-story" name="story" rows={4} defaultValue={tip.story ?? ''} className={INPUT} />
      </Field>

      <Field label="Recette" htmlFor="tip-recipe" help="Une étape par ligne ; les lignes vides sont retirées.">
        <textarea id="tip-recipe" name="recipe" rows={7} defaultValue={tip.recipe} required className={INPUT} />
      </Field>

      <Field label="Ingrédients" htmlFor="tip-ingredients" help="Un par ligne, douze au plus.">
        <textarea
          id="tip-ingredients"
          name="ingredients"
          rows={4}
          defaultValue={tip.ingredients.join('\n')}
          className={INPUT}
        />
      </Field>

      <Field label="Précautions" htmlFor="tip-cautions" help="Dès qu’un geste peut abîmer : sel, cendres, marc sur semis…">
        <textarea id="tip-cautions" name="cautions" rows={3} defaultValue={tip.cautions ?? ''} className={INPUT} />
      </Field>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Préparation (jours)" htmlFor="tip-prep" help="> 0 : une carte « c’est prêt » suivra.">
          <input id="tip-prep" name="prepDays" type="number" min={0} max={60} defaultValue={tip.prepDays} required className={INPUT} />
        </Field>
        <Field label="Effort (minutes)" htmlFor="tip-effort" help="Facultatif.">
          <input
            id="tip-effort"
            name="effortMinutes"
            type="number"
            min={1}
            max={240}
            defaultValue={tip.effortMinutes ?? ''}
            className={INPUT}
          />
        </Field>
        <Field label="Reproposer après (jours)" htmlFor="tip-cooldown" help="Après un essai.">
          <input
            id="tip-cooldown"
            name="cooldownDays"
            type="number"
            min={7}
            max={730}
            defaultValue={tip.cooldownDays}
            required
            className={INPUT}
          />
        </Field>
      </div>

      <fieldset className="space-y-4 rounded-2xl border border-forest/10 p-4">
        <legend className="px-1 font-poppins text-sm font-semibold text-forest">À qui le proposer</legend>
        <p className="text-xs text-forest/60">
          Toutes les conditions remplies doivent l’être ensemble ; une condition laissée vide ne filtre rien.
        </p>

        <CheckboxGroup
          legend="Catégories du catalogue"
          name={CONDITION_FIELDS.categories}
          options={withExtras(PLANT_CATEGORIES, c.categories).map((value) => ({
            value,
            label: PLANT_CATEGORY_LABELS[value as keyof typeof PLANT_CATEGORY_LABELS] ?? value,
          }))}
          selected={c.categories}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Familles"
            htmlFor="cond-families"
            help="En latin (Rosaceae) ; séparées par des virgules."
          >
            <input id="cond-families" name={CONDITION_FIELDS.families} defaultValue={c.families?.join(', ') ?? ''} className={INPUT} />
          </Field>
          <Field label="Genres" htmlFor="cond-genera" help="Rosa, Hydrangea… Familles et genres : l’un ou l’autre suffit.">
            <input id="cond-genera" name={CONDITION_FIELDS.genera} defaultValue={c.genera?.join(', ') ?? ''} className={INPUT} />
          </Field>
          <Field label="Familles exclues" htmlFor="cond-ex-families">
            <input
              id="cond-ex-families"
              name={CONDITION_FIELDS.excludeFamilies}
              defaultValue={c.excludeFamilies?.join(', ') ?? ''}
              className={INPUT}
            />
          </Field>
          <Field label="Genres exclus" htmlFor="cond-ex-genera" help="Les plantes de terre de bruyère, par exemple.">
            <input
              id="cond-ex-genera"
              name={CONDITION_FIELDS.excludeGenera}
              defaultValue={c.excludeGenera?.join(', ') ?? ''}
              className={INPUT}
            />
          </Field>
        </div>

        <CheckboxGroup
          legend="Mois"
          name={CONDITION_FIELDS.months}
          options={MONTH_SHORT.map((label, index) => ({ value: String(index + 1), label }))}
          selected={c.months?.map(String)}
          columns="grid grid-cols-3 gap-x-3 gap-y-2 sm:grid-cols-6"
        />

        <CheckboxGroup
          legend="Emplacements"
          name={CONDITION_FIELDS.locations}
          options={PLANT_LOCATIONS.map((value) => ({ value, label: PLANT_LOCATION_LABELS[value] }))}
          selected={c.locations}
        />

        <CheckboxGroup
          legend="Santé de la plante"
          name={CONDITION_FIELDS.healthStatus}
          options={withExtras(HEALTH_STATUSES, c.healthStatus).map((value) => ({
            value,
            label: HEALTH_STATUS_LABELS[value as keyof typeof HEALTH_STATUS_LABELS] ?? value,
          }))}
          selected={c.healthStatus}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Comestible" htmlFor="cond-edible">
            <select
              id="cond-edible"
              name={CONDITION_FIELDS.edible}
              defaultValue={c.edible === true ? 'true' : c.edible === false ? 'false' : ''}
              className={INPUT}
            >
              <option value="">Indifférent</option>
              <option value="true">Comestibles seulement</option>
              <option value="false">Non comestibles seulement</option>
            </select>
          </Field>
          <div className="flex flex-col justify-end gap-2">
            <Check name={CONDITION_FIELDS.notToxic} defaultChecked={!!c.notToxic} label="Jamais une plante toxique" />
            <Check
              name={CONDITION_FIELDS.lunarOnly}
              defaultChecked={!!c.lunarOnly}
              label="Seulement avec le calendrier lunaire activé"
            />
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium text-forest">Météo du moment</p>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Max. au-dessus de (°C)" htmlFor="cond-tmax">
              <input
                id="cond-tmax"
                name={CONDITION_FIELDS.tempMaxAbove}
                type="number"
                step="any"
                defaultValue={c.weather?.tempMaxAbove ?? ''}
                className={INPUT}
              />
            </Field>
            <Field label="Min. sous (°C)" htmlFor="cond-tmin">
              <input
                id="cond-tmin"
                name={CONDITION_FIELDS.tempMinBelow}
                type="number"
                step="any"
                defaultValue={c.weather?.tempMinBelow ?? ''}
                className={INPUT}
              />
            </Field>
            <div className="flex items-end">
              <Check name={CONDITION_FIELDS.rainyRecently} defaultChecked={!!c.weather?.rainyRecently} label="Après de la pluie" />
            </div>
          </div>
          <p className="text-xs text-forest/55">
            Une condition météo rend le secret « du moment » : sans prévision connue pour le jardin, il n’est pas tiré.
          </p>
        </div>
      </fieldset>

      <PlancheEditor planche={tip.planche} />

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex items-center gap-2 rounded-lg bg-forest px-4 py-2 text-sm font-medium text-white hover:bg-forest/90 disabled:opacity-50"
        >
          {pending ? <Loader2 size={15} className="animate-spin" aria-hidden /> : <Save size={15} aria-hidden />}
          {mode === 'create' ? 'Créer le brouillon' : 'Enregistrer'}
        </button>
        {result && (
          <p role="status" className={cn('min-w-0 break-words text-sm', result.ok ? 'text-forest/70' : 'text-red-700')}>
            {result.ok ? result.message : result.error}
          </p>
        )}
      </div>
    </form>
  )
}

/**
 * Les valeurs connues, plus celles déjà en base qui n'y figurent pas : sans
 * elles, enregistrer la fiche effacerait en silence une valeur qu'on ne voit pas.
 */
function withExtras(known: readonly string[], current: readonly string[] | undefined): string[] {
  return [...known, ...(current ?? []).filter((value) => !known.includes(value))]
}

function Counter({ value, max }: { value: string; max: number }) {
  return (
    <span className={cn(value.trim().length > max && 'font-semibold text-red-700')}>
      {value.trim().length} / {max}
    </span>
  )
}

function Check({ name, label, defaultChecked }: { name: string; label: string; defaultChecked: boolean }) {
  return (
    <label className="flex items-center gap-2 text-sm text-forest/80">
      <input type="checkbox" name={name} defaultChecked={defaultChecked} className="h-4 w-4 shrink-0 accent-forest" />
      {label}
    </label>
  )
}

function CheckboxGroup({
  legend,
  name,
  options,
  selected,
  columns = 'flex flex-wrap gap-x-4 gap-y-2',
}: {
  legend: string
  name: string
  options: Array<{ value: string; label: string }>
  selected: readonly string[] | undefined
  columns?: string
}) {
  return (
    <fieldset>
      <legend className="mb-1.5 text-sm font-medium text-forest">{legend}</legend>
      <div className={columns}>
        {options.map((option) => (
          <label key={option.value} className="flex items-center gap-2 text-sm text-forest/80">
            <input
              type="checkbox"
              name={name}
              value={option.value}
              defaultChecked={selected?.includes(option.value) ?? false}
              className="h-4 w-4 shrink-0 accent-forest"
            />
            {option.label}
          </label>
        ))}
      </div>
    </fieldset>
  )
}

function Field({
  label,
  htmlFor,
  hint,
  help,
  children,
}: {
  label: string
  htmlFor: string
  hint?: React.ReactNode
  help?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className="min-w-0 space-y-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={htmlFor} className="text-sm font-medium text-forest">
          {label}
        </label>
        {hint && <span className="text-right text-xs text-forest/55">{hint}</span>}
      </div>
      {children}
      {help && <p className="text-xs text-forest/55">{help}</p>}
    </div>
  )
}
