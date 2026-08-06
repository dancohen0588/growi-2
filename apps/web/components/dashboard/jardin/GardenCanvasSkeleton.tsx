export function GardenCanvasSkeleton() {
  return (
    <div className="flex-1 bg-sand animate-pulse flex items-center justify-center">
      <div className="flex flex-col items-center gap-3 opacity-40">
        <span className="text-5xl">🌱</span>
        <p className="font-raleway text-sm text-forest">Chargement de ton jardin…</p>
      </div>
    </div>
  )
}
