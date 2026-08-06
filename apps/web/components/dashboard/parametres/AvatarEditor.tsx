// growi-frontend/components/dashboard/parametres/AvatarEditor.tsx
'use client'

import { cn } from '@/lib/utils'

const AVATAR_COLORS = [
  { hex: '#B4DD7F', label: 'Lime' },
  { hex: '#F6C445', label: 'Soleil' },
  { hex: '#1E5631', label: 'Forêt' },
  { hex: '#93C5FD', label: 'Ciel' },
  { hex: '#FCA5A5', label: 'Rose' },
] as const

interface AvatarEditorProps {
  initials: string
  color: string
  onChange: (color: string) => void
}

export function AvatarEditor({ initials, color, onChange }: AvatarEditorProps) {
  return (
    <div className="flex flex-col items-center gap-4">
      {/* Avatar circle */}
      <div
        aria-label={`Avatar avec les initiales ${initials}`}
        className="w-20 h-20 rounded-full flex items-center justify-center font-poppins font-bold text-2xl text-forest select-none"
        style={{ backgroundColor: color }}
      >
        {initials}
      </div>

      {/* Colour swatches */}
      <div className="flex gap-2" role="radiogroup" aria-label="Couleur de l'avatar">
        {AVATAR_COLORS.map(({ hex, label }) => (
          <button
            key={hex}
            type="button"
            role="radio"
            aria-checked={color === hex}
            aria-label={label}
            onClick={() => onChange(hex)}
            className={cn(
              'w-7 h-7 rounded-full border-2 transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest focus-visible:ring-offset-2',
              color === hex ? 'border-forest scale-110' : 'border-transparent',
            )}
            style={{ backgroundColor: hex }}
          />
        ))}
      </div>

      {/* TODO: Ajouter upload photo avec next/image */}
    </div>
  )
}
