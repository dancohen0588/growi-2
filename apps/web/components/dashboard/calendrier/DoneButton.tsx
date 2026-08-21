'use client'

import { useState } from 'react'
import { Check, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface DoneButtonProps {
  actionId: string
  actionLabel: string
  variant?: 'full' | 'outline' | 'icon'
  onDone: (id: string) => void
  className?: string
}

export function DoneButton({
  actionId,
  actionLabel,
  variant = 'full',
  onDone,
  className,
}: DoneButtonProps) {
  const [phase, setPhase] = useState<'idle' | 'loading' | 'done'>('idle')

  function handleClick() {
    if (phase !== 'idle') return
    setPhase('loading')
    // Simulate async (will be replaced by API call)
    // TODO: remplacer par API call PATCH /actions/:id { done: true }
    setTimeout(() => {
      setPhase('done')
      setTimeout(() => onDone(actionId), 200)
    }, 200)
  }

  if (variant === 'icon') {
    return (
      <Button
        variant="ghost"
        size="icon"
        aria-label={`Marquer comme fait : ${actionLabel}`}
        onClick={handleClick}
        disabled={phase !== 'idle'}
        className={cn('shrink-0', className)}
      >
        {phase === 'loading' ? (
          <svg
            className="animate-spin h-4 w-4"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden
          >
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        ) : phase === 'done' ? (
          <CheckCircle2 className="h-4 w-4 text-lime animate-in zoom-in-50 duration-200" aria-hidden />
        ) : (
          <Check className="h-4 w-4" aria-hidden />
        )}
      </Button>
    )
  }

  const buttonVariant = variant === 'outline' ? 'outline' : 'primary'
  const label =
    phase === 'loading'
      ? 'En cours…'
      : phase === 'done'
      ? '✓ Fait !'
      : // Même formulation que le bouton de l'app mobile.
        "✓ C'est fait"

  return (
    <Button
      variant={buttonVariant}
      size="default"
      aria-label={`Marquer comme fait : ${actionLabel}`}
      onClick={handleClick}
      loading={phase === 'loading'}
      disabled={phase !== 'idle'}
      className={cn('w-full', className)}
    >
      {phase === 'done' ? (
        <>
          <CheckCircle2 className="h-4 w-4 animate-in zoom-in-50 duration-200" aria-hidden />
          {label}
        </>
      ) : (
        label
      )}
    </Button>
  )
}
