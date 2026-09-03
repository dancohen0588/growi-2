// growi-frontend/components/dashboard/jardin/GardenEmptyState.tsx
interface GardenEmptyStateProps {
  /** Absent pour un jardin où l'import n'a pas de sens (balcon, serre, intérieur). */
  onImportCadastre?: () => void
}

export function GardenEmptyState({ onImportCadastre }: GardenEmptyStateProps) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none select-none">
      <span className="text-7xl opacity-20" aria-hidden>🌱</span>
      <p className="font-poppins font-semibold text-forest/30 text-sm mt-3 text-center px-4">
        Glisse un élément depuis la palette pour créer ton jardin
      </p>
      {onImportCadastre && (
        // Seul élément cliquable de l'état vide : le reste laisse passer les
        // clics vers le canevas, qui doit rester manipulable.
        <button
          onClick={onImportCadastre}
          className="pointer-events-auto mt-1 font-raleway text-xs text-forest/50 underline hover:text-forest transition-colors"
        >
          … ou importe ton terrain depuis le cadastre
        </button>
      )}
    </div>
  )
}
