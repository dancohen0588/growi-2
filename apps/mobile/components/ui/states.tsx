import { Text, View } from 'react-native'

import { Button } from './Button'

/**
 * Les trois états qu'un écran doit savoir afficher en plus du succès.
 * Aucun écran de l'app ne doit pouvoir rester blanc.
 */

/** Bloc gris animé qui préfigure la forme du contenu à venir. */
export function Skeleton({ className = '' }: { className?: string }) {
  return <View className={`rounded-lg bg-sand-dark ${className}`} />
}

/** Silhouette d'une carte, pendant le chargement d'une liste. */
export function CardSkeleton() {
  return (
    <View className="rounded-xl bg-card p-4 gap-2">
      <Skeleton className="h-5 w-1/2" />
      <Skeleton className="h-4 w-1/3" />
    </View>
  )
}

export function ListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <View className="gap-3" accessibilityLabel="Chargement en cours">
      {Array.from({ length: count }, (_, i) => (
        <CardSkeleton key={i} />
      ))}
    </View>
  )
}

export interface ErrorStateProps {
  /** Dit quoi faire, jamais le code technique. */
  message: string
  onRetry?: () => void
}

export function ErrorState({ message, onRetry }: ErrorStateProps) {
  return (
    <View className="items-center justify-center gap-3 py-10 px-4">
      <Text className="text-4xl">🌧️</Text>
      <Text className="font-raleway text-body text-forest text-center">{message}</Text>
      {onRetry ? (
        <View className="mt-1 w-full max-w-xs">
          <Button label="Réessayer" variant="outline" onPress={onRetry} />
        </View>
      ) : null}
    </View>
  )
}

export interface EmptyStateProps {
  emoji: string
  title: string
  /** Oriente vers l'action suivante — jamais « aucune donnée ». */
  message: string
  cta?: { label: string; onPress: () => void }
}

export function EmptyState({ emoji, title, message, cta }: EmptyStateProps) {
  return (
    <View className="items-center justify-center gap-3 py-10 px-4">
      <Text className="text-5xl">{emoji}</Text>
      <Text className="font-poppins text-section text-forest text-center">{title}</Text>
      <Text className="font-raleway text-body text-muted-foreground text-center max-w-xs">
        {message}
      </Text>
      {cta ? (
        <View className="mt-1 w-full max-w-xs">
          <Button label={cta.label} onPress={cta.onPress} />
        </View>
      ) : null}
    </View>
  )
}
