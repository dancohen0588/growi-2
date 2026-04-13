// growi-frontend/components/dashboard/jardin/GardenPropsTab.tsx
'use client'

import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { GardenElement, ElementSun } from '@/lib/garden/types'
import type { Plant } from '@/lib/plant-types'
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogAction, AlertDialogCancel,
} from '@/components/ui/alert-dialog'

const COLOR_OPTIONS = [
  { label: 'Lime',   value: '#B4DD7F' },
  { label: 'Soleil', value: '#F6C445' },
  { label: 'Ciel',   value: '#87CEEB' },
  { label: 'Sable',  value: '#F9F7E8' },
  { label: 'Rose',   value: '#F48FB1' },
  { label: 'Forêt',  value: '#1E5631' },
  { label: 'Rouge',  value: '#E53E3E' },
  { label: 'Violet', value: '#9B59B6' },
]

interface GardenPropsTabProps {
  element: GardenElement
  onChange: (patch: Partial<GardenElement>) => void
  onDelete: () => void
  plants?: Plant[]
}

export function GardenPropsTab({ element, onChange, onDelete, plants = [] }: GardenPropsTabProps) {
  const [deleteOpen, setDeleteOpen] = useState(false)

  const sunOptions: Array<{ value: ElementSun; emoji: string; label: string }> = [
    { value: 'full',  emoji: '☀️', label: 'Plein soleil' },
    { value: 'half',  emoji: '⛅', label: 'Mi-ombre' },
    { value: 'shade', emoji: '🌿', label: 'Ombre' },
  ]

  return (
    <div className="flex flex-col gap-4 p-3 overflow-y-auto h-full">
      {/* Header */}
      <div>
        <p className="font-poppins font-bold text-sm text-forest">
          {element.emoji} {element.label}
          {element.linkedPlantId && <span className="ml-2 text-xs text-lime-hover font-semibold">🔗 Liée</span>}
        </p>
        <p className="font-raleway text-[11px] text-forest/40 mt-0.5">Type : {element.type}</p>
      </div>

      {/* Name */}
      <div className="flex flex-col gap-1">
        <label htmlFor="el-name" className="font-raleway text-[11px] font-semibold text-forest/60">Nom</label>
        <input
          id="el-name"
          value={element.label}
          onChange={e => onChange({ label: e.target.value })}
          className="border border-border rounded-lg px-2.5 py-1.5 font-raleway text-xs text-forest focus:outline-none focus:ring-1 focus:ring-lime"
        />
      </div>

      {/* Dimensions */}
      <div className="flex flex-col gap-1">
        <span className="font-raleway text-[11px] font-semibold text-forest/60">Dimensions (px)</span>
        <div className="flex gap-2">
          <div className="flex flex-col gap-0.5 flex-1">
            <label htmlFor="el-w" className="font-raleway text-[10px] text-forest/40">Largeur</label>
            <input
              id="el-w"
              type="number"
              min={40} max={600} step={20}
              value={element.width}
              onChange={e => onChange({ width: Number(e.target.value) })}
              className="border border-border rounded-lg px-2 py-1 font-raleway text-xs text-forest focus:outline-none focus:ring-1 focus:ring-lime w-full"
            />
          </div>
          <div className="flex flex-col gap-0.5 flex-1">
            <label htmlFor="el-h" className="font-raleway text-[10px] text-forest/40">Hauteur</label>
            <input
              id="el-h"
              type="number"
              min={40} max={600} step={20}
              value={element.height}
              onChange={e => onChange({ height: Number(e.target.value) })}
              className="border border-border rounded-lg px-2 py-1 font-raleway text-xs text-forest focus:outline-none focus:ring-1 focus:ring-lime w-full"
            />
          </div>
        </div>
      </div>

      {/* Sun exposure */}
      <div className="flex flex-col gap-1">
        <span className="font-raleway text-[11px] font-semibold text-forest/60">Ensoleillement</span>
        <div className="flex gap-1.5">
          {sunOptions.map(opt => (
            <button
              key={opt.value}
              onClick={() => onChange({ sun: opt.value })}
              title={opt.label}
              aria-label={opt.label}
              aria-pressed={element.sun === opt.value}
              className={cn(
                'flex-1 flex flex-col items-center gap-0.5 py-1.5 rounded-lg border text-[10px] font-raleway font-semibold transition-all',
                element.sun === opt.value
                  ? opt.value === 'shade'
                    ? 'border-lime bg-lime/20 text-forest'
                    : 'border-[#F6C445] bg-[#F6C445]/20 text-forest'
                  : 'border-border text-forest/50 hover:border-forest/20',
              )}
            >
              <span className="text-base" aria-hidden>{opt.emoji}</span>
              <span className="leading-none text-[9px]">{opt.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Color */}
      <div className="flex flex-col gap-1.5">
        <span className="font-raleway text-[11px] font-semibold text-forest/60">Couleur</span>
        <div className="flex gap-2 flex-wrap">
          {COLOR_OPTIONS.map(c => (
            <button
              key={c.value}
              onClick={() => onChange({ customColor: c.value })}
              title={c.label}
              aria-label={`Couleur ${c.label}`}
              aria-pressed={element.customColor === c.value}
              className={cn(
                'w-6 h-6 rounded-full border-2 transition-all',
                element.customColor === c.value ? 'border-forest ring-2 ring-forest/30 scale-110' : 'border-transparent hover:border-forest/20',
              )}
              style={{ backgroundColor: c.value }}
            />
          ))}
          {/* Reset color */}
          {element.customColor && (
            <button
              onClick={() => onChange({ customColor: undefined })}
              className="text-[10px] font-raleway text-forest/40 hover:text-forest/70 underline"
              aria-label="Supprimer la couleur personnalisée"
            >
              reset
            </button>
          )}
        </div>
      </div>

      {/* Notes */}
      <div className="flex flex-col gap-1">
        <label htmlFor="el-notes" className="font-raleway text-[11px] font-semibold text-forest/60">Notes</label>
        <textarea
          id="el-notes"
          rows={2}
          placeholder="Arrosage, floraison…"
          value={element.notes ?? ''}
          onChange={e => onChange({ notes: e.target.value })}
          className="border border-border rounded-lg px-2.5 py-1.5 font-raleway text-xs text-forest resize-none focus:outline-none focus:ring-1 focus:ring-lime"
        />
      </div>

      {/* Link plant */}
      <div className="flex flex-col gap-1">
        <label htmlFor="el-plant" className="font-raleway text-[11px] font-semibold text-forest/60">
          Lier à une plante
        </label>
        <select
          id="el-plant"
          value={element.linkedPlantId ?? ''}
          onChange={e => onChange({ linkedPlantId: e.target.value || undefined })}
          className="border border-border rounded-lg px-2.5 py-1.5 font-raleway text-xs text-forest focus:outline-none focus:ring-1 focus:ring-lime bg-white"
        >
          <option value="">— Aucune —</option>
          {plants.map(p => (
            <option key={p.id} value={p.id}>{p.emoji} {p.name}</option>
          ))}
        </select>
      </div>

      {/* Delete */}
      <button
        onClick={() => setDeleteOpen(true)}
        className="flex items-center justify-center gap-2 w-full py-2 rounded-lg border border-red-200 text-red-500 font-raleway text-xs font-semibold hover:bg-red-50 transition-colors mt-auto"
      >
        <Trash2 size={13} aria-hidden />
        Supprimer cet élément
      </button>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer {element.emoji} {element.label} ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cet élément sera retiré de ton jardin. Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => setDeleteOpen(false)}
              className="px-4 py-2 rounded-lg font-raleway text-sm text-forest/70 hover:bg-sand transition-colors"
            >
              Annuler
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => { onDelete(); setDeleteOpen(false) }}
              className="px-4 py-2 rounded-lg font-poppins font-semibold text-sm bg-red-500 text-white hover:bg-red-600 transition-colors"
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
