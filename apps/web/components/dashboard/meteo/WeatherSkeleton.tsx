// growi-frontend/components/dashboard/meteo/WeatherSkeleton.tsx

export function WeatherSkeleton() {
  return (
    <div className="space-y-4 animate-pulse" aria-busy="true" aria-label="Chargement de la météo">
      {/* Current card skeleton */}
      <div className="rounded-2xl border border-forest/10 bg-white p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="h-4 w-40 rounded-full bg-forest/10" />
          <div className="h-4 w-24 rounded-full bg-forest/10" />
        </div>
        <div className="flex items-end gap-4">
          <div className="h-16 w-16 rounded-xl bg-forest/10" />
          <div className="space-y-2">
            <div className="h-14 w-28 rounded-xl bg-forest/10" />
            <div className="h-4 w-36 rounded-full bg-forest/10" />
          </div>
        </div>
        <div className="flex gap-4">
          <div className="h-4 w-28 rounded-full bg-forest/10" />
          <div className="h-4 w-28 rounded-full bg-forest/10" />
          <div className="h-4 w-24 rounded-full bg-forest/10" />
        </div>
        <div className="rounded-xl bg-forest/10 h-16 w-full" />
      </div>

      {/* Context card skeleton */}
      <div className="rounded-2xl border border-forest/10 bg-white p-6 space-y-4">
        <div className="h-5 w-48 rounded-full bg-forest/10" />
        <div className="flex gap-2">
          <div className="h-7 w-32 rounded-full bg-forest/10" />
          <div className="h-7 w-24 rounded-full bg-forest/10" />
          <div className="h-7 w-20 rounded-full bg-forest/10" />
        </div>
        <div className="flex gap-4">
          <div className="flex-1 h-24 rounded-xl bg-forest/10" />
          <div className="flex-1 h-24 rounded-xl bg-forest/10" />
        </div>
      </div>

      {/* Forecast row skeleton */}
      <div className="rounded-2xl border border-forest/10 bg-white p-4">
        <div className="h-4 w-32 rounded-full bg-forest/10 mb-4" />
        <div className="flex gap-3 overflow-hidden">
          {Array.from({ length: 7 }).map((_, i) => (
            <div
              key={i}
              className="min-w-[90px] h-28 rounded-xl bg-forest/10 shrink-0"
            />
          ))}
        </div>
      </div>
    </div>
  )
}
