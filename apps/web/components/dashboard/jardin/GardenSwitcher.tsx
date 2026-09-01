'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'
import {
  GARDEN_TYPES,
  GARDEN_TYPE_LABELS,
  type CreateGardenInput,
  type GardenType,
} from '@growi/shared'

import {
  NativeSelect,
  Select, SelectContent, SelectItem, SelectSeparator, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

/** Valeur réservée à l'entrée « Nouveau jardin » de la liste. */
const NEW_GARDEN = '__new__'

export interface GardenSwitcherItem {
  id: string
  name: string
  plantCount: number
}

interface GardenSwitcherProps {
  gardens: GardenSwitcherItem[]
  currentId: string | null
  onSelect: (gardenId: string) => void
  onCreate: (input: CreateGardenInput) => Promise<void>
}

/**
 * Choix du jardin ouvert dans l'éditeur de plan.
 *
 * Le web n'affichait qu'un seul jardin là où l'app en liste plusieurs : un
 * jardin créé depuis le téléphone y restait invisible.
 */
export function GardenSwitcher({ gardens, currentId, onSelect, onCreate }: GardenSwitcherProps) {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [name, setName] = useState('')
  const [type, setType] = useState<GardenType>('OUTDOOR')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function handleChange(value: string) {
    if (value === NEW_GARDEN) {
      setName('')
      setType('OUTDOOR')
      setError(null)
      setDialogOpen(true)
      return
    }
    if (value !== currentId) onSelect(value)
  }

  async function handleCreate() {
    const trimmed = name.trim()
    if (!trimmed) {
      setError('Donne un nom à ton jardin.')
      return
    }

    setSubmitting(true)
    setError(null)
    try {
      await onCreate({ name: trimmed.slice(0, 50), type })
      setDialogOpen(false)
    } catch {
      setError("Le jardin n'a pas pu être créé. Réessaie.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <Select value={currentId ?? undefined} onValueChange={handleChange}>
        <SelectTrigger
          className="h-8 w-auto max-w-[200px] gap-1.5 border-forest/15 px-2 font-poppins text-sm font-semibold"
          aria-label="Jardin affiché"
        >
          <SelectValue placeholder="Chargement…" />
        </SelectTrigger>
        <SelectContent>
          {gardens.map(garden => (
            <SelectItem key={garden.id} value={garden.id}>
              {garden.name}
              <span className="text-forest/50">
                {' · '}
                {garden.plantCount === 0
                  ? 'aucune plante'
                  : `${garden.plantCount} plante${garden.plantCount > 1 ? 's' : ''}`}
              </span>
            </SelectItem>
          ))}
          {gardens.length > 0 && <SelectSeparator />}
          <SelectItem value={NEW_GARDEN}>
            <span className="flex items-center gap-1.5 font-semibold">
              <Plus size={14} aria-hidden />
              Nouveau jardin
            </span>
          </SelectItem>
        </SelectContent>
      </Select>

      <Dialog open={dialogOpen} onOpenChange={open => !submitting && setDialogOpen(open)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nouveau jardin</DialogTitle>
            <DialogDescription>
              Tu le retrouveras aussi dans l&apos;app mobile, avec ses plantes et son planning.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4 py-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="garden-name">Nom</Label>
              <Input
                id="garden-name"
                value={name}
                maxLength={50}
                placeholder="Potager, Balcon, Serre…"
                onChange={e => setName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') void handleCreate() }}
                autoFocus
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="garden-type">Type</Label>
              <NativeSelect
                id="garden-type"
                value={type}
                onChange={e => setType(e.target.value as GardenType)}
              >
                {GARDEN_TYPES.map(t => (
                  <option key={t} value={t}>{GARDEN_TYPE_LABELS[t]}</option>
                ))}
              </NativeSelect>
            </div>

            {error && <p className="font-raleway text-sm text-red-600">{error}</p>}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={submitting}>
              Annuler
            </Button>
            <Button variant="primary" onClick={() => void handleCreate()} disabled={submitting}>
              {submitting ? 'Création…' : 'Créer le jardin'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
