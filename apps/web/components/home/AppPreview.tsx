import { AppMockup } from '@/components/ui/app-mockup'

const featureCards = [
  {
    icon: '🌡️',
    title: 'Santé de tes plantes',
    detail: (
      <div className="mt-2 h-1.5 bg-sand rounded-full overflow-hidden">
        <div className="h-full bg-lime rounded-full" style={{ width: '72%' }} />
      </div>
    ),
  },
  {
    icon: '☀️',
    title: 'Météo du jour',
    detail: <p className="text-xs text-forest/60 mt-1">22°C · Ensoleillé</p>,
  },
  {
    icon: '🔔',
    title: 'Alertes intelligentes',
    detail: (
      <span className="inline-flex mt-1 bg-red-500 text-white text-[10px] font-bold rounded-full w-5 h-5 items-center justify-center">
        3
      </span>
    ),
  },
  {
    icon: '📅',
    title: 'Calendrier jardin',
    detail: (
      <div className="grid grid-cols-7 gap-0.5 mt-2">
        {['L','M','M','J','V','S','D'].map((d) => (
          <div key={d} className="text-[9px] text-center text-forest/40">{d}</div>
        ))}
        {[...Array(7)].map((_, i) => (
          <div
            key={i}
            className={`text-[10px] text-center rounded py-0.5 ${i === 2 ? 'bg-lime text-forest font-bold' : 'text-forest/60'}`}
          >
            {i + 1}
          </div>
        ))}
      </div>
    ),
  },
]

export function AppPreview() {
  return (
    <section className="bg-forest py-20 md:py-28" aria-label="Aperçu de l'application">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="font-poppins font-bold text-white text-3xl md:text-4xl mb-4">
            Tout ce dont tes plantes ont besoin
          </h2>
          <p className="font-raleway text-white/70 text-lg max-w-xl mx-auto">
            Suivez la santé de vos plantes et recevez des alertes personnalisées.
          </p>
        </div>

        <div className="relative flex items-center justify-center">
          {/* Feature cards: left column */}
          <div className="hidden lg:flex flex-col gap-4 mr-12 w-52">
            {featureCards.slice(0, 2).map((card) => (
              <div key={card.title} className="bg-white rounded-2xl p-4 shadow-card">
                <div className="text-2xl mb-1">{card.icon}</div>
                <h3 className="font-poppins font-semibold text-forest text-sm">{card.title}</h3>
                {card.detail}
              </div>
            ))}
          </div>

          {/* Mockup */}
          <div className="flex-shrink-0">
            <AppMockup />
          </div>

          {/* Feature cards: right column */}
          <div className="hidden lg:flex flex-col gap-4 ml-12 w-52">
            {featureCards.slice(2, 4).map((card) => (
              <div key={card.title} className="bg-white rounded-2xl p-4 shadow-card">
                <div className="text-2xl mb-1">{card.icon}</div>
                <h3 className="font-poppins font-semibold text-forest text-sm">{card.title}</h3>
                {card.detail}
              </div>
            ))}
          </div>
        </div>

        {/* Mobile: cards below mockup */}
        <div className="lg:hidden grid grid-cols-2 gap-4 mt-8">
          {featureCards.map((card) => (
            <div key={card.title} className="bg-white rounded-2xl p-4 shadow-card">
              <div className="text-2xl mb-1">{card.icon}</div>
              <h3 className="font-poppins font-semibold text-forest text-sm">{card.title}</h3>
              {card.detail}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
