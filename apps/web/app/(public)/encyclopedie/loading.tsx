export default function Loading() {
  return (
    <div className="min-h-screen bg-sand">
      {/* Hero skeleton */}
      <section className="bg-gradient-to-b from-lime/20 to-sand px-4 pt-16 pb-10 md:pt-24 md:pb-14">
        <div className="mx-auto max-w-5xl text-center animate-pulse">
          <div className="mx-auto h-3 w-40 rounded bg-forest/10 mb-4" />
          <div className="mx-auto h-10 md:h-14 w-4/5 max-w-2xl rounded-lg bg-forest/15 mb-4" />
          <div className="mx-auto h-4 w-3/5 max-w-xl rounded bg-forest/10 mb-8" />
          <div className="mx-auto h-12 w-full max-w-xl rounded-full bg-white shadow-card" />
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-4 py-8">
        {/* Stats bar skeleton */}
        <div className="flex flex-wrap items-center justify-center gap-4 rounded-2xl bg-white shadow-card px-6 py-4 mb-6 animate-pulse">
          {[0, 1, 2].map(i => (
            <div key={i} className="flex items-center gap-2">
              <div className="h-4 w-4 rounded bg-forest/10" />
              <div>
                <div className="h-4 w-10 rounded bg-forest/15" />
                <div className="h-2 w-12 rounded bg-forest/10 mt-1.5" />
              </div>
            </div>
          ))}
        </div>

        {/* Filters skeleton */}
        <div className="rounded-2xl bg-white shadow-card p-5 mb-6 animate-pulse">
          <div className="flex flex-wrap gap-2">
            {[...Array(9)].map((_, i) => (
              <div key={i} className="h-7 w-20 rounded-full bg-forest/10" />
            ))}
          </div>
        </div>

        {/* Alpha nav skeleton */}
        <div className="flex flex-wrap justify-center gap-1 mb-6 animate-pulse">
          {[...Array(27)].map((_, i) => (
            <div key={i} className="h-7 w-7 rounded-md bg-forest/10" />
          ))}
        </div>

        {/* Grid skeleton */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {[...Array(12)].map((_, i) => (
            <div
              key={i}
              className="rounded-2xl bg-white shadow-card overflow-hidden animate-pulse"
            >
              <div className="aspect-[3/2] w-full bg-lime/10" />
              <div className="p-4">
                <div className="h-4 w-3/4 rounded bg-forest/15" />
                <div className="h-3 w-1/2 rounded bg-forest/10 mt-2" />
                <div className="flex gap-1.5 mt-3">
                  <div className="h-4 w-12 rounded bg-forest/10" />
                  <div className="h-4 w-10 rounded bg-forest/10" />
                  <div className="h-4 w-8 rounded bg-forest/10" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
