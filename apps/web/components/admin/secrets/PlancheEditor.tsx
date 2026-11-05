'use client'

import { useId, useRef, useState } from 'react'
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react'
import { SECRET_ART_KEYS, isCautionArt, type SecretPlanche } from '@growi/shared'

import { SecretArt } from '@/components/dashboard/secrets/SecretArt'
import { PLANCHE_FIELDS, moveItem } from '@/lib/admin/secret-form'
import { cn } from '@/lib/utils'

/** Les dessins d'étape, et ceux de précaution — deux sélecteurs, jamais mélangés. */
const STEP_KEYS = SECRET_ART_KEYS.filter((key) => !isCautionArt(key))
const CAUTION_KEYS = SECRET_ART_KEYS.filter(isCautionArt)

const MAX_PANELS = 4
const CAPTION_MAX = 140
const EMPHASIS_MAX = 80

const INPUT = 'w-full min-w-0 rounded-lg border border-forest/15 bg-white px-3 py-2 text-sm text-forest'
const SMALL_BUTTON =
  'inline-flex min-h-[36px] items-center gap-1 rounded-lg border border-forest/15 bg-white px-2.5 text-xs font-medium text-forest hover:bg-sand disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime'

type PanelDraft = { key: number; art: string; caption: string; emphasis: string }
type CautionDraft = { art: string; title: string; text: string }

/**
 * La section « Planche » de la fiche d'un secret.
 *
 * Les dessins vivent dans le code (`@growi/shared/secrets/art.ts`) : on
 * choisit une **clé** dans une liste, jamais un SVG. Le service valide le tout
 * avec `secretPlancheSchema` et renvoie ses défauts en français.
 *
 * Les champs sont nommés par position (`planche.panels.0.art`) et renumérotés
 * à chaque déplacement : la lecture (`readPlanche`) n'a qu'à trier.
 */
export function PlancheEditor({ planche }: { planche: SecretPlanche | null }) {
  const nextKey = useRef(0)
  const newKey = () => nextKey.current++
  const idPrefix = useId()

  const [enabled, setEnabled] = useState(planche !== null)
  const [panels, setPanels] = useState<PanelDraft[]>(() =>
    (planche?.panels ?? []).map((panel) => ({
      key: newKey(),
      art: panel.art,
      caption: panel.caption,
      emphasis: panel.emphasis ?? '',
    })),
  )
  const [withCaution, setWithCaution] = useState(Boolean(planche?.caution))
  const [caution, setCaution] = useState<CautionDraft>({
    art: planche?.caution?.art ?? CAUTION_KEYS[0] ?? '',
    title: planche?.caution?.title ?? '',
    text: planche?.caution?.text ?? '',
  })

  function enable() {
    setEnabled(true)
    // Une planche a au moins une case : on en propose une plutôt qu'un vide.
    if (panels.length === 0) setPanels([{ key: newKey(), art: STEP_KEYS[0] ?? '', caption: '', emphasis: '' }])
  }

  function update(index: number, patch: Partial<PanelDraft>) {
    setPanels((list) => list.map((panel, i) => (i === index ? { ...panel, ...patch } : panel)))
  }

  return (
    <fieldset className="space-y-4 rounded-2xl border border-forest/10 p-4">
      <legend className="px-1 font-poppins text-sm font-semibold text-forest">Planche</legend>
      <input type="hidden" name={PLANCHE_FIELDS.mode} value={enabled ? 'set' : 'none'} />

      <div className="flex flex-wrap gap-x-5 gap-y-2" role="radiogroup" aria-label="Affichage du secret">
        <label className="flex items-center gap-2 text-sm text-forest/80">
          <input
            type="radio"
            name={`${idPrefix}-mode`}
            checked={!enabled}
            onChange={() => setEnabled(false)}
            className="h-4 w-4 accent-forest"
          />
          Pas de planche — le secret s’affiche en texte
        </label>
        <label className="flex items-center gap-2 text-sm text-forest/80">
          <input
            type="radio"
            name={`${idPrefix}-mode`}
            checked={enabled}
            onChange={enable}
            className="h-4 w-4 accent-forest"
          />
          Planche dessinée
        </label>
      </div>

      {enabled && (
        <>
          <p className="text-xs text-forest/60">
            De une à quatre cases, dans l’ordre de lecture. Les dessins viennent du registre du code ; un nouveau
            dessin demande un déploiement. La légende sert aussi de texte alternatif au dessin.
          </p>

          <ol className="space-y-3">
            {panels.map((panel, index) => {
              const base = `${idPrefix}-panel-${panel.key}`
              const emphasisMissing = panel.emphasis.trim() !== '' && !panel.caption.includes(panel.emphasis.trim())
              return (
                <li key={panel.key} className="rounded-xl border border-forest/10 bg-sand/50 p-3">
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <p className="font-poppins text-sm font-semibold text-forest">Case {index + 1}</p>
                    <div className="flex gap-1.5">
                      <button
                        type="button"
                        className={SMALL_BUTTON}
                        disabled={index === 0}
                        onClick={() => setPanels((list) => moveItem(list, index, -1))}
                        aria-label={`Monter la case ${index + 1}`}
                      >
                        <ArrowUp size={14} aria-hidden />
                      </button>
                      <button
                        type="button"
                        className={SMALL_BUTTON}
                        disabled={index === panels.length - 1}
                        onClick={() => setPanels((list) => moveItem(list, index, 1))}
                        aria-label={`Descendre la case ${index + 1}`}
                      >
                        <ArrowDown size={14} aria-hidden />
                      </button>
                      <button
                        type="button"
                        className={SMALL_BUTTON}
                        disabled={panels.length === 1}
                        onClick={() => setPanels((list) => list.filter((_, i) => i !== index))}
                        aria-label={`Retirer la case ${index + 1}`}
                      >
                        <Trash2 size={14} aria-hidden /> Retirer
                      </button>
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-[120px_minmax(0,1fr)]">
                    <div className="aspect-[4/3] w-full overflow-hidden rounded-md border-2 border-forest bg-white sm:w-[120px]">
                      <SecretArt artKey={panel.art} />
                    </div>
                    <div className="min-w-0 space-y-2">
                      <Labelled label="Dessin" htmlFor={`${base}-art`}>
                        <select
                          id={`${base}-art`}
                          name={PLANCHE_FIELDS.panel(index, 'art')}
                          value={panel.art}
                          onChange={(event) => update(index, { art: event.target.value })}
                          className={cn(INPUT, 'font-mono')}
                        >
                          {withCurrent(STEP_KEYS, panel.art).map((key) => (
                            <option key={key} value={key}>
                              {key}
                            </option>
                          ))}
                        </select>
                      </Labelled>
                      <Labelled
                        label="Légende"
                        htmlFor={`${base}-caption`}
                        hint={`${panel.caption.trim().length} / ${CAPTION_MAX}`}
                      >
                        <textarea
                          id={`${base}-caption`}
                          name={PLANCHE_FIELDS.panel(index, 'caption')}
                          rows={2}
                          value={panel.caption}
                          onChange={(event) => update(index, { caption: event.target.value })}
                          required
                          className={INPUT}
                        />
                      </Labelled>
                      <Labelled
                        label="Passage en gras"
                        htmlFor={`${base}-emphasis`}
                        help="Facultatif. Recopié tel quel depuis la légende."
                        error={emphasisMissing ? 'Ce passage ne figure pas dans la légende.' : undefined}
                      >
                        <input
                          id={`${base}-emphasis`}
                          name={PLANCHE_FIELDS.panel(index, 'emphasis')}
                          value={panel.emphasis}
                          maxLength={EMPHASIS_MAX}
                          onChange={(event) => update(index, { emphasis: event.target.value })}
                          aria-invalid={emphasisMissing || undefined}
                          className={INPUT}
                        />
                      </Labelled>
                    </div>
                  </div>
                </li>
              )
            })}
          </ol>

          <button
            type="button"
            className={SMALL_BUTTON}
            disabled={panels.length >= MAX_PANELS}
            onClick={() =>
              setPanels((list) => [...list, { key: newKey(), art: STEP_KEYS[0] ?? '', caption: '', emphasis: '' }])
            }
          >
            <Plus size={14} aria-hidden /> Ajouter une case
            {panels.length >= MAX_PANELS && <span className="text-forest/60"> (quatre au plus)</span>}
          </button>

          <div className="space-y-3 rounded-xl border border-forest/10 p-3">
            <label className="flex items-center gap-2 text-sm font-medium text-forest">
              <input
                type="checkbox"
                checked={withCaution}
                onChange={(event) => setWithCaution(event.target.checked)}
                className="h-4 w-4 shrink-0 accent-forest"
              />
              Case de précaution (fond forest)
            </label>

            {withCaution && (
              <div className="grid gap-3 sm:grid-cols-[120px_minmax(0,1fr)]">
                <div className="aspect-[22/13] w-full overflow-hidden rounded-md bg-forest p-1 sm:w-[120px]">
                  <SecretArt artKey={caution.art} />
                </div>
                <div className="min-w-0 space-y-2">
                  <Labelled label="Dessin" htmlFor={`${idPrefix}-caution-art`}>
                    <select
                      id={`${idPrefix}-caution-art`}
                      name={PLANCHE_FIELDS.cautionArt}
                      value={caution.art}
                      onChange={(event) => setCaution((c) => ({ ...c, art: event.target.value }))}
                      className={cn(INPUT, 'font-mono')}
                    >
                      {withCurrent(CAUTION_KEYS, caution.art).map((key) => (
                        <option key={key} value={key}>
                          {key}
                        </option>
                      ))}
                    </select>
                  </Labelled>
                  <Labelled label="Titre" htmlFor={`${idPrefix}-caution-title`} hint={`${caution.title.trim().length} / 60`}>
                    <input
                      id={`${idPrefix}-caution-title`}
                      name={PLANCHE_FIELDS.cautionTitle}
                      value={caution.title}
                      onChange={(event) => setCaution((c) => ({ ...c, title: event.target.value }))}
                      required
                      className={INPUT}
                    />
                  </Labelled>
                  <Labelled label="Texte" htmlFor={`${idPrefix}-caution-text`} hint={`${caution.text.trim().length} / 200`}>
                    <textarea
                      id={`${idPrefix}-caution-text`}
                      name={PLANCHE_FIELDS.cautionText}
                      rows={2}
                      value={caution.text}
                      onChange={(event) => setCaution((c) => ({ ...c, text: event.target.value }))}
                      required
                      className={INPUT}
                    />
                  </Labelled>
                </div>
              </div>
            )}
            {!withCaution && (
              <p className="text-xs text-forest/60">
                Sans case de précaution, la planche affiche le champ « Précautions » du secret, s’il est rempli.
              </p>
            )}
          </div>
        </>
      )}
    </fieldset>
  )
}

/**
 * Les clés connues, plus la valeur en base si le registre l'a perdue : sans
 * elle, le sélecteur basculerait en silence sur un autre dessin. Le service
 * refusera l'enregistrement, avec son message.
 */
function withCurrent(keys: readonly string[], current: string): string[] {
  return current && !keys.includes(current) ? [current, ...keys] : [...keys]
}

function Labelled({
  label,
  htmlFor,
  hint,
  help,
  error,
  children,
}: {
  label: string
  htmlFor: string
  hint?: string
  help?: string
  error?: string
  children: React.ReactNode
}) {
  return (
    <div className="min-w-0 space-y-1">
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={htmlFor} className="text-sm font-medium text-forest">
          {label}
        </label>
        {hint && <span className="text-xs text-forest/55">{hint}</span>}
      </div>
      {children}
      {error ? (
        <p className="text-xs text-red-700">{error}</p>
      ) : (
        help && <p className="text-xs text-forest/55">{help}</p>
      )}
    </div>
  )
}
