'use client'

import { useRef, useState } from 'react'
import { Save, Camera, Trash2, Undo2, Redo2, Ruler, MessageSquarePlus, Eye, EyeOff, Tag } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogAction, AlertDialogCancel,
} from '@/components/ui/alert-dialog'
import { useToast } from '@/components/ui/toast'

interface GardenToolbarProps {
  name: string
  onNameChange: (name: string) => void
  onSave: () => void
  onExport: () => void
  onClear: () => void
  onUndo: () => void
  onRedo: () => void
  canUndo: boolean
  canRedo: boolean
  cotesOn: boolean
  onToggleCotes: () => void
  labelsOn: boolean
  onToggleLabels: () => void
  commentMode: boolean
  onToggleComment: () => void
  commentsVisible: boolean
  onToggleCommentsVisible: () => void
  hasComments: boolean
  isSaving: boolean
}

export function GardenToolbar({ name, onNameChange, onSave, onExport, onClear, onUndo, onRedo, canUndo, canRedo, cotesOn, onToggleCotes, labelsOn, onToggleLabels, commentMode, onToggleComment, commentsVisible, onToggleCommentsVisible, hasComments, isSaving }: GardenToolbarProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(name)
  const [clearOpen, setClearOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const { toast } = useToast()

  function commitName() {
    setEditing(false)
    const trimmed = draft.trim() || 'Mon jardin'
    setDraft(trimmed)
    onNameChange(trimmed)
  }

  function handleSave() {
    try {
      onSave()
      toast('✅ Ton jardin a été sauvegardé 🌱')
    } catch {
      toast('❌ Erreur lors de la sauvegarde')
    }
  }

  return (
    <>
      <div className="flex items-center justify-between px-4 h-[52px] shrink-0 bg-white border-b border-forest/10">
        {/* Left: breadcrumb + name */}
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-lg shrink-0" aria-hidden>🌱</span>
          <span className="font-raleway text-xs text-forest/40 hidden sm:block shrink-0">Mon Jardin /</span>
          {editing ? (
            <input
              ref={inputRef}
              value={draft}
              onChange={e => setDraft(e.target.value)}
              onBlur={commitName}
              onKeyDown={e => { if (e.key === 'Enter') commitName() }}
              className="font-poppins font-semibold text-sm text-forest bg-transparent border-0 border-b-2 border-lime focus:outline-none min-w-0 max-w-[180px]"
              aria-label="Nom du jardin"
              autoFocus
            />
          ) : (
            <button
              onDoubleClick={() => { setDraft(name); setEditing(true) }}
              className="font-poppins font-semibold text-sm text-forest hover:text-forest/70 truncate max-w-[180px]"
              title="Double-clic pour renommer"
            >
              {name}
            </button>
          )}

          {/* Annuler / Rétablir */}
          <div className="flex items-center gap-0.5 pl-2 ml-0.5 border-l border-forest/10 shrink-0">
            <button
              onClick={onUndo}
              disabled={!canUndo}
              title="Annuler — Ctrl/Cmd + Z"
              aria-label="Annuler la dernière action"
              className={cn(
                'p-1.5 rounded-lg text-forest/60 transition-colors',
                canUndo ? 'hover:bg-sand hover:text-forest' : 'opacity-30 cursor-not-allowed',
              )}
            >
              <Undo2 size={15} aria-hidden />
            </button>
            <button
              onClick={onRedo}
              disabled={!canRedo}
              title="Rétablir — Ctrl/Cmd + Maj + Z"
              aria-label="Rétablir l'action annulée"
              className={cn(
                'p-1.5 rounded-lg text-forest/60 transition-colors',
                canRedo ? 'hover:bg-sand hover:text-forest' : 'opacity-30 cursor-not-allowed',
              )}
            >
              <Redo2 size={15} aria-hidden />
            </button>
          </div>
        </div>

        {/* Right: actions */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={onToggleCotes}
            aria-pressed={cotesOn}
            className={cn(
              'hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-raleway text-xs transition-colors',
              cotesOn ? 'bg-lime/30 text-forest font-semibold' : 'text-forest/60 hover:bg-sand hover:text-forest',
            )}
            title="Afficher les cotes de tous les éléments"
            aria-label="Afficher les cotes de tous les éléments"
          >
            <Ruler size={14} aria-hidden />
            <span>Cotes</span>
          </button>
          <button
            onClick={onToggleLabels}
            aria-pressed={!labelsOn}
            className={cn(
              'hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-raleway text-xs transition-colors',
              !labelsOn ? 'bg-lime/30 text-forest font-semibold' : 'text-forest/60 hover:bg-sand hover:text-forest',
            )}
            title={labelsOn ? 'Masquer les noms des éléments' : 'Afficher les noms des éléments'}
            aria-label={labelsOn ? 'Masquer les noms des éléments' : 'Afficher les noms des éléments'}
          >
            {labelsOn ? <Tag size={14} aria-hidden /> : <EyeOff size={14} aria-hidden />}
            <span>Noms</span>
          </button>
          <button
            onClick={onToggleComment}
            aria-pressed={commentMode}
            className={cn(
              'hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-raleway text-xs transition-colors',
              commentMode ? 'bg-lime/30 text-forest font-semibold' : 'text-forest/60 hover:bg-sand hover:text-forest',
            )}
            title="Ajouter un commentaire sur le plan"
            aria-label="Ajouter un commentaire sur le plan"
          >
            <MessageSquarePlus size={14} aria-hidden />
            <span>Commentaire</span>
          </button>
          {hasComments && (
            <button
              onClick={onToggleCommentsVisible}
              aria-pressed={!commentsVisible}
              className="hidden sm:flex items-center p-1.5 rounded-lg text-forest/60 hover:bg-sand hover:text-forest transition-colors"
              title={commentsVisible ? 'Masquer les commentaires' : 'Afficher les commentaires'}
              aria-label={commentsVisible ? 'Masquer les commentaires' : 'Afficher les commentaires'}
            >
              {commentsVisible ? <Eye size={14} aria-hidden /> : <EyeOff size={14} aria-hidden />}
            </button>
          )}
          <button
            onClick={() => setClearOpen(true)}
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-raleway text-xs text-forest/60 hover:bg-sand hover:text-forest transition-colors"
            title="Effacer le canvas"
            aria-label="Effacer tous les éléments"
          >
            <Trash2 size={14} aria-hidden />
            <span>Effacer</span>
          </button>
          <button
            onClick={onExport}
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-raleway text-xs text-forest/60 hover:bg-sand hover:text-forest transition-colors"
            title="Exporter en PNG"
            aria-label="Exporter la carte en image PNG"
          >
            <Camera size={14} aria-hidden />
            <span>Exporter</span>
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            aria-busy={isSaving}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-raleway text-xs text-forest/70 border border-forest/15 bg-white hover:bg-sand hover:text-forest transition-colors',
              isSaving && 'opacity-70 cursor-not-allowed',
            )}
            title="Sauvegarder"
            aria-label="Sauvegarder"
          >
            <Save size={14} aria-hidden />
            <span className="hidden md:inline">Sauvegarder</span>
          </button>
        </div>
      </div>

      {/* Clear confirmation dialog */}
      <AlertDialog open={clearOpen} onOpenChange={setClearOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Effacer le jardin ?</AlertDialogTitle>
            <AlertDialogDescription>
              Tous les éléments seront supprimés. Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => setClearOpen(false)}
              className="px-4 py-2 rounded-lg font-raleway text-sm text-forest/70 hover:bg-sand transition-colors"
            >
              Annuler
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => { onClear(); setClearOpen(false) }}
              className="px-4 py-2 rounded-lg font-poppins font-semibold text-sm bg-red-500 text-white hover:bg-red-600 transition-colors"
            >
              Effacer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
