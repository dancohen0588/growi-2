'use client'

import { useCallback, useEffect, useState } from 'react'
import { Loader2, MapPin } from 'lucide-react'
import type { ParcelCandidate, ParcelDetail } from '@growi/shared'

import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { AddressAutocompleteField } from '@/components/dashboard/compte/AddressAutocompleteField'
import { cn } from '@/lib/utils'

/**
 * Import du terrain depuis le cadastre, en trois écrans : l'adresse (quand le
 * compte n'en a pas), le choix de la parcelle, puis ce qui va être posé.
 *
 * Chaque écran a une sortie qui ramène à la saisie manuelle sans rien perdre :
 * le cadastre est un raccourci, jamais un passage obligé. Aucun écran d'erreur
 * n'écrit quoi que ce soit dans le plan.
 */

/** Au-delà, la parcelle est probablement celle d'un immeuble entier. */
const LARGE_PARCEL_M2 = 5_000

type Screen = 'address' | 'candidates' | 'summary'
type Failure = 'unavailable' | 'outside-france' | 'no-parcel'

export interface CadastreImportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Coordonnées du compte, quand il en a : l'écran adresse est alors sauté. */
  latitude?: number | null
  longitude?: number | null
  address?: string | null
  /** Enregistre l'adresse dans le compte (case cochée de l'écran A). */
  onSaveAddress?: (address: string, lat: number, lon: number) => Promise<void>
  /** Le plan contient déjà des éléments : on le dit avant de poser. */
  hasElements: boolean
  onImport: (parcels: ParcelDetail[], options: { withOutline: boolean; withBuildings: boolean }) => void
  /** Signale une adresse hors de France, pour ne plus proposer l'import. */
  onOutsideFrance?: () => void
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: 'no-store' })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return (await res.json() as { data: T }).data
}

export function CadastreImportDialog({
  open,
  onOpenChange,
  latitude,
  longitude,
  address,
  onSaveAddress,
  hasElements,
  onImport,
  onOutsideFrance,
}: CadastreImportDialogProps) {
  const hasAccountCoords = typeof latitude === 'number' && typeof longitude === 'number'

  const [screen, setScreen] = useState<Screen>(hasAccountCoords ? 'candidates' : 'address')
  const [failure, setFailure] = useState<Failure | null>(null)
  const [loading, setLoading] = useState(false)

  // Écran A — adresse
  const [draftAddress, setDraftAddress] = useState(address ?? '')
  const [draftCoords, setDraftCoords] = useState<{ lat: number; lon: number } | null>(null)
  const [draftOutsideFrance, setDraftOutsideFrance] = useState(false)
  const [saveToAccount, setSaveToAccount] = useState(true)

  // Écran B — candidates
  const [candidates, setCandidates] = useState<ParcelCandidate[]>([])
  const [selected, setSelected] = useState<string[]>([])
  const [multi, setMulti] = useState(false)

  // Écran C — récapitulatif
  const [parcels, setParcels] = useState<ParcelDetail[]>([])
  const [withOutline, setWithOutline] = useState(true)
  const [withBuildings, setWithBuildings] = useState(true)

  const search = useCallback(async (lat: number, lon: number) => {
    setLoading(true)
    setFailure(null)
    try {
      const found = await fetchJson<ParcelCandidate[]>(
        `/api/v1/cadastre/parcels?lat=${lat}&lon=${lon}`,
      )
      if (found.length === 0) {
        setFailure('no-parcel')
        return
      }
      setCandidates(found)
      setSelected([found[0].idu])
      setMulti(false)
      setScreen('candidates')
    } catch {
      setFailure('unavailable')
    } finally {
      setLoading(false)
    }
  }, [])

  // À l'ouverture : on cherche tout de suite si le compte a une adresse.
  useEffect(() => {
    if (!open) return
    setFailure(null)
    setParcels([])
    setWithOutline(true)
    setWithBuildings(true)
    if (hasAccountCoords) {
      setScreen('candidates')
      void search(latitude!, longitude!)
    } else {
      setScreen('address')
    }
  }, [open, hasAccountCoords, latitude, longitude, search])

  async function handleAddressSubmit() {
    if (draftOutsideFrance) {
      setFailure('outside-france')
      onOutsideFrance?.()
      return
    }
    if (!draftCoords) return
    if (saveToAccount && onSaveAddress) {
      await onSaveAddress(draftAddress, draftCoords.lat, draftCoords.lon).catch(() => {
        // Une adresse non enregistrée n'empêche pas l'import : elle aura servi
        // à cette recherche, c'est déjà ce que l'utilisateur demandait.
      })
    }
    await search(draftCoords.lat, draftCoords.lon)
  }

  async function handleCandidatesSubmit() {
    setLoading(true)
    setFailure(null)
    try {
      const details = await Promise.all(
        selected.map(idu => fetchJson<ParcelDetail>(`/api/v1/cadastre/parcels/${idu}`)),
      )
      setParcels(details)
      setScreen('summary')
    } catch {
      setFailure('unavailable')
    } finally {
      setLoading(false)
    }
  }

  function toggleCandidate(idu: string) {
    if (!multi) {
      setSelected([idu])
      return
    }
    setSelected(prev => (prev.includes(idu) ? prev.filter(i => i !== idu) : [...prev, idu]))
  }

  function backToAddress() {
    setFailure(null)
    setDraftAddress(address ?? '')
    setDraftCoords(null)
    setDraftOutsideFrance(false)
    setScreen('address')
  }

  const contenanceM2 = parcels.reduce((sum, p) => sum + p.contenanceM2, 0)
  const builtM2 = parcels.some(p => p.builtM2 === null)
    ? null
    : parcels.reduce((sum, p) => sum + (p.builtM2 ?? 0), 0)
  const buildingCount = parcels.reduce((n, p) => n + (p.buildings?.length ?? 0), 0)
  const gardenM2 = parcels.reduce((sum, p) => sum + p.gardenM2, 0)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        {failure ? (
          <CadastreFailure
            failure={failure}
            onRetry={
              hasAccountCoords && failure === 'unavailable'
                ? () => void search(latitude!, longitude!)
                : undefined
            }
            onOtherAddress={backToAddress}
            onManual={() => onOpenChange(false)}
          />
        ) : screen === 'address' ? (
          <>
            <DialogHeader>
              <DialogTitle>Où est ton jardin ?</DialogTitle>
              <DialogDescription>
                Ton adresse sert à retrouver ta parcelle sur le plan cadastral.
              </DialogDescription>
            </DialogHeader>

            <div className="flex flex-col gap-3 py-2">
              <Label htmlFor="cadastre-address">Adresse</Label>
              <AddressAutocompleteField
                id="cadastre-address"
                value={draftAddress}
                onChange={(label, lat, lon, citycode) => {
                  setDraftAddress(label)
                  setDraftCoords(lat !== null && lon !== null ? { lat, lon } : null)
                  // Une adresse sans code commune n'est pas en France : le
                  // cadastre n'aura rien à en dire.
                  setDraftOutsideFrance(lat !== null && citycode === null)
                }}
              />
              <label className="flex items-start gap-2 font-raleway text-sm text-forest/70">
                <input
                  type="checkbox"
                  checked={saveToAccount}
                  onChange={e => setSaveToAccount(e.target.checked)}
                  className="mt-0.5 accent-lime"
                />
                Enregistrer cette adresse dans mon compte (elle sert aussi à la météo
                et au calendrier)
              </label>
            </div>

            <DialogFooter>
              <Button variant="ghost" onClick={() => onOpenChange(false)}>
                Renseigner à la main
              </Button>
              <Button
                variant="primary"
                onClick={() => void handleAddressSubmit()}
                disabled={loading || (!draftCoords && !draftOutsideFrance)}
              >
                {loading ? <Loader2 size={15} className="animate-spin" aria-hidden /> : null}
                Chercher ma parcelle
              </Button>
            </DialogFooter>
          </>
        ) : screen === 'candidates' ? (
          <>
            <DialogHeader>
              <DialogTitle>Laquelle est ta parcelle ?</DialogTitle>
              <DialogDescription>
                Les parcelles les plus proches de ton adresse. La photo t&apos;aide à
                reconnaître ton terrain.
              </DialogDescription>
            </DialogHeader>

            {loading ? (
              <CadastreLoading label="Recherche des parcelles autour de ton adresse…" />
            ) : (
              <>
                <ul className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  {candidates.map(candidate => {
                    const isSelected = selected.includes(candidate.idu)
                    return (
                      <li key={candidate.idu}>
                        <button
                          type="button"
                          onClick={() => toggleCandidate(candidate.idu)}
                          aria-pressed={isSelected}
                          className={cn(
                            'w-full overflow-hidden rounded-xl border-2 bg-white text-left transition-colors',
                            isSelected
                              ? 'border-lime shadow-card'
                              : 'border-forest/10 hover:border-forest/30',
                          )}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={candidate.thumbnailUrl}
                            alt={`Vue aérienne de la parcelle n° ${candidate.numero}`}
                            width={480}
                            height={360}
                            className="aspect-[4/3] w-full bg-sand object-cover"
                            loading="lazy"
                          />
                          <div className="p-2.5">
                            <p className="font-poppins text-xs font-semibold text-forest">
                              Section {candidate.section} · n° {candidate.numero}
                            </p>
                            <p className="font-raleway text-[11px] text-forest/60">
                              {candidate.contenanceM2} m² · à {candidate.distanceM} m de ton adresse
                            </p>
                            {candidate.contenanceM2 > LARGE_PARCEL_M2 && (
                              <p className="mt-1 font-raleway text-[11px] text-amber-700">
                                Parcelle très grande — s&apos;il s&apos;agit d&apos;un immeuble,
                                préfère la saisie manuelle.
                              </p>
                            )}
                          </div>
                        </button>
                      </li>
                    )
                  })}
                </ul>

                <label className="flex items-center gap-2 font-raleway text-sm text-forest/70">
                  <input
                    type="checkbox"
                    checked={multi}
                    onChange={e => {
                      setMulti(e.target.checked)
                      if (!e.target.checked) setSelected(prev => prev.slice(0, 1))
                    }}
                    className="accent-lime"
                  />
                  Mon terrain est sur plusieurs parcelles
                </label>
              </>
            )}

            <DialogFooter>
              <Button variant="ghost" onClick={backToAddress}>
                Ce n&apos;est pas ici
              </Button>
              <Button
                variant="primary"
                onClick={() => void handleCandidatesSubmit()}
                disabled={loading || selected.length === 0}
              >
                {selected.length > 1 ? `Continuer avec ${selected.length} parcelles` : 'Continuer'}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Voici ce qu&apos;on va poser sur ton plan</DialogTitle>
            </DialogHeader>

            <div className="flex flex-col gap-4 sm:flex-row">
              {parcels[0] && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={parcels[0].thumbnailUrl}
                  alt={`Vue aérienne de la parcelle n° ${parcels[0].numero}`}
                  width={480}
                  height={360}
                  className="aspect-[4/3] w-full rounded-xl bg-sand object-cover sm:w-1/2"
                />
              )}

              <div className="flex flex-1 flex-col gap-1.5 font-raleway text-sm text-forest">
                <p>
                  Parcelle cadastrale : <b>{contenanceM2} m²</b>
                </p>
                {builtM2 === null ? (
                  <p className="text-forest/60">Bâti inconnu — la BD TOPO n&apos;a pas répondu.</p>
                ) : (
                  <p>
                    Bâti ({buildingCount} bâtiment{buildingCount > 1 ? 's' : ''}) :{' '}
                    <b>{builtM2} m²</b>
                  </p>
                )}
                <p>
                  Terrain hors bâti : <b>environ {gardenM2} m²</b>
                </p>
                <p className="text-forest/60">
                  Emprise : {Math.ceil(Math.max(...parcels.map(p => p.bboxM.width)))} ×{' '}
                  {Math.ceil(Math.max(...parcels.map(p => p.bboxM.height)))} m
                </p>
                <p className="mt-1 font-raleway text-xs italic text-forest/50">
                  Estimation d&apos;après le plan cadastral et les bâtiments connus de
                  l&apos;IGN. Tu pourras tout ajuster.
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <label className="flex items-center gap-2 font-raleway text-sm text-forest/80">
                <input
                  type="checkbox"
                  checked={withOutline}
                  onChange={e => setWithOutline(e.target.checked)}
                  className="accent-lime"
                />
                Le contour du terrain
              </label>
              <label className="flex items-center gap-2 font-raleway text-sm text-forest/80">
                <input
                  type="checkbox"
                  checked={withBuildings}
                  onChange={e => setWithBuildings(e.target.checked)}
                  disabled={builtM2 === null}
                  className="accent-lime"
                />
                La maison et les annexes
              </label>
              {hasElements && (
                <p className="font-raleway text-xs text-forest/60">
                  Ton plan garde ses éléments ; seuls le contour et le bâti sont ajoutés.
                </p>
              )}
            </div>

            <DialogFooter>
              <Button variant="ghost" onClick={() => setScreen('candidates')}>
                Choisir une autre parcelle
              </Button>
              <Button
                variant="primary"
                disabled={!withOutline && !withBuildings}
                onClick={() => {
                  onImport(parcels, { withOutline, withBuildings })
                  onOpenChange(false)
                }}
              >
                Poser sur mon plan
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

function CadastreLoading({ label }: { label: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex items-center justify-center gap-2 py-10 font-raleway text-sm text-forest/60"
    >
      <Loader2 size={16} className="animate-spin" aria-hidden />
      {label}
    </div>
  )
}

const FAILURE_MESSAGES: Record<Failure, string> = {
  unavailable:
    'Le cadastre ne répond pas pour le moment. Réessaie, ou renseigne ton terrain à la main.',
  'outside-france':
    "Le cadastre n'est disponible qu'en France. Renseigne ton terrain à la main.",
  'no-parcel': 'Aucune parcelle trouvée autour de cette adresse.',
}

function CadastreFailure({
  failure,
  onRetry,
  onOtherAddress,
  onManual,
}: {
  failure: Failure
  onRetry?: () => void
  onOtherAddress: () => void
  onManual: () => void
}) {
  return (
    <>
      <DialogHeader>
        <DialogTitle>Le cadastre n&apos;a rien pu proposer</DialogTitle>
      </DialogHeader>

      {/* L'échec arrive après coup, sur un dialogue déjà ouvert : sans région
          annoncée, un lecteur d'écran ne dirait rien de ce changement. */}
      <p
        role="status"
        aria-live="polite"
        className="flex items-start gap-2 font-raleway text-sm text-forest/80"
      >
        <MapPin size={16} className="mt-0.5 shrink-0 text-forest/40" aria-hidden />
        {FAILURE_MESSAGES[failure]}
      </p>

      <DialogFooter>
        <Button variant="ghost" onClick={onManual} autoFocus>
          Renseigner à la main
        </Button>
        {failure === 'unavailable' && onRetry && (
          <Button variant="primary" onClick={onRetry}>
            Réessayer
          </Button>
        )}
        {failure !== 'unavailable' && (
          <Button variant="outline" onClick={onOtherAddress}>
            Autre adresse
          </Button>
        )}
      </DialogFooter>
    </>
  )
}
