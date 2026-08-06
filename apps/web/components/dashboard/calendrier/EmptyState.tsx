interface EmptyStateProps {
  message: string
  icon?: string
}

export function EmptyState({ message, icon = '🌿' }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-2 py-8 text-center">
      <span className="text-2xl" aria-hidden>{icon}</span>
      <p className="font-raleway text-sm text-forest/50">{message}</p>
    </div>
  )
}
