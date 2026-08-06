// growi-frontend/components/dashboard/jardin/GardenEmptyState.tsx
export function GardenEmptyState() {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none select-none">
      <span className="text-7xl opacity-20" aria-hidden>🌱</span>
      <p className="font-poppins font-semibold text-forest/30 text-sm mt-3 text-center px-4">
        Glisse un élément depuis la palette pour créer ton jardin
      </p>
    </div>
  )
}
