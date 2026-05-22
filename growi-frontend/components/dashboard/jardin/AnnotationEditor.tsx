'use client'

import { useEffect, useRef, useState } from 'react'
import { Trash2 } from 'lucide-react'

// Commentaires (P3) — saisie flottante du texte d'une annotation.
// Position en pixels relatifs au conteneur du canevas.

interface AnnotationEditorProps {
  x: number
  y: number
  text: string
  isExisting: boolean
  onCommit: (text: string) => void
  onClose: () => void
  onDelete: () => void
}

export function AnnotationEditor({ x, y, text, isExisting, onCommit, onClose, onDelete }: AnnotationEditorProps) {
  const [val, setVal] = useState(text)
  const ref = useRef<HTMLTextAreaElement>(null)
  const done = useRef(false)

  useEffect(() => {
    ref.current?.focus()
    ref.current?.select()
  }, [])

  function commit() {
    if (done.current) return
    done.current = true
    onCommit(val)
  }

  return (
    <div className="absolute z-40" style={{ left: x + 20, top: y - 14 }}>
      <div className="w-[208px] overflow-hidden rounded-lg border-2 border-forest bg-sand shadow-card-hover">
        <textarea
          ref={ref}
          value={val}
          onChange={e => setVal(e.target.value)}
          onBlur={commit}
          onKeyDown={e => {
            if (e.key === 'Escape') { done.current = true; onClose() }
          }}
          rows={3}
          placeholder="Écris ton commentaire…"
          aria-label="Commentaire"
          className="w-full resize-none bg-transparent px-2.5 py-2 font-raleway text-xs text-forest placeholder:text-forest/40 focus:outline-none"
        />
        {isExisting && (
          <div className="flex justify-end border-t border-forest/10 px-1.5 py-1">
            <button
              onMouseDown={e => e.preventDefault()}
              onClick={() => { done.current = true; onDelete() }}
              className="flex items-center gap-1 rounded px-1.5 py-0.5 font-poppins text-[10px] text-red-500 hover:bg-red-50"
            >
              <Trash2 size={11} aria-hidden /> Supprimer
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
