import Image from 'next/image'

/**
 * Ex-`AppPreview`. Même mécanique — téléphone au centre, cartes autour — mais
 * le mockup était codé à la main et ne ressemblait pas à l'app : il montrait un
 * onglet 🛒 vers un store qui n'existe pas. On a des captures réelles.
 *
 * Les quatre cartes ne décrivent que des fonctions livrées, et leurs exemples
 * sortent des règles du moteur (gel, pluie abondante), pas de l'imagination.
 */
const cards = [
  {
    icon: '📅',
    title: 'Les gestes du jour',
    detail: (
      <p className="font-raleway text-[13px] leading-snug text-white/70">
        Récolter le basilic · Semer la mâche · Pas d&apos;arrosage, pluie prévue
      </p>
    ),
  },
  {
    icon: '☀️',
    title: 'Météo locale',
    detail: (
      <p className="font-raleway text-[13px] leading-snug text-white/70">
        22 °C · Ensoleillé · 14 mm demain matin
      </p>
    ),
  },
  {
    icon: '🔔',
    title: 'Alertes météo',
    detail: (
      <>
        <p className="font-raleway text-[13px] leading-snug text-white/70">
          Gel, canicule, pluie abondante : prévenu la veille.
        </p>
        <span className="mt-2 inline-block rounded-md bg-sun px-2 py-0.5 font-poppins text-[11px] font-semibold text-forest">
          Gel cette nuit · &minus;2 °C
        </span>
      </>
    ),
  },
  {
    icon: '💬',
    title: 'Tes questions, ses réponses',
    detail: (
      <p className="mt-1 rounded-lg bg-lime/15 px-2.5 py-2 font-raleway text-[12.5px] leading-snug text-white">
        « Je taille la lavande maintenant ou après la floraison ? »
      </p>
    ),
  },
]

function NeedCard({ card }: { card: (typeof cards)[number] }) {
  return (
    <div className="rounded-2xl border border-white/12 bg-white/[0.06] p-4">
      <div className="mb-1.5 text-xl" aria-hidden>
        {card.icon}
      </div>
      <h3 className="mb-1.5 font-poppins text-[15px] font-semibold text-white">
        {card.title}
      </h3>
      {card.detail}
    </div>
  )
}

export function PlantsNeeds() {
  return (
    <section className="bg-forest py-20 md:py-28" aria-label="Tout ce dont tes plantes ont besoin">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-12 text-center">
          <h2 className="mb-4 font-poppins text-3xl font-bold text-white md:text-4xl">
            Tout ce dont tes plantes ont besoin
          </h2>
          <p className="mx-auto max-w-xl font-raleway text-lg text-white/70">
            Tout ce dont ton jardin a besoin, au bon moment.
          </p>
        </div>

        <div className="flex flex-col items-center justify-center gap-8 lg:flex-row lg:gap-11">
          <div className="grid w-full grid-cols-1 gap-4 sm:grid-cols-2 lg:w-[230px] lg:grid-cols-1">
            {cards.slice(0, 2).map((card) => (
              <NeedCard key={card.title} card={card} />
            ))}
          </div>

          <div className="w-[220px] shrink-0 overflow-hidden rounded-[1.75rem] bg-black shadow-[0_30px_60px_rgba(0,0,0,0.35)]">
            <Image
              src="/images/app/app-calendrier.webp"
              alt="L'écran Calendrier de l'app Growi, avec les gestes du jour"
              width={800}
              height={1694}
              sizes="220px"
              className="block h-auto w-full"
            />
          </div>

          <div className="grid w-full grid-cols-1 gap-4 sm:grid-cols-2 lg:w-[230px] lg:grid-cols-1">
            {cards.slice(2).map((card) => (
              <NeedCard key={card.title} card={card} />
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
