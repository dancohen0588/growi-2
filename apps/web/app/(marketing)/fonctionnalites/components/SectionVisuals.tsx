import type { ReactNode } from 'react'

/**
 * Les quatre sections montraient un dégradé gris avec un emoji au centre et le
 * mot « Aperçu » — un placeholder, pas un visuel.
 *
 * Ces compositions reprennent les vignettes de la maquette. Elles sont en JSX
 * plutôt qu'en captures : elles restent nettes à toute densité, se traduisent,
 * et ne demandent pas d'entretenir un compte de démo pour être régénérées. Le
 * bloc Identification, lui, montre une vraie capture de l'app.
 *
 * Ce sont des illustrations : `aria-hidden`, le texte des sections dit déjà
 * tout ce qu'elles montrent.
 */
function Shot({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div
      aria-hidden
      className={`w-full max-w-md rounded-3xl bg-white p-5 shadow-card ${className}`}
    >
      {children}
    </div>
  )
}

function TitleBar() {
  return (
    <div className="mb-4 flex gap-1.5">
      {[0, 1, 2].map((i) => (
        <span key={i} className="h-2 w-2 rounded-full bg-forest/15" />
      ))}
    </div>
  )
}

/** Cartographie : plan de zones, puis extrait du journal d'entretien. */
export function MapVisual() {
  return (
    <Shot>
      <div className="relative h-52 overflow-hidden rounded-2xl bg-sand-dark/60">
        <div className="absolute left-[6%] top-[8%] flex h-[46%] w-[52%] items-start justify-start rounded-xl bg-lime/60 p-2 font-poppins text-xs font-semibold text-forest">
          Potager 🍅🥬🌶️
        </div>
        <div className="absolute right-[6%] top-[8%] flex h-[30%] w-[32%] items-start rounded-xl bg-sun/45 p-2 font-poppins text-xs font-semibold text-forest">
          Véranda 🌿🍋
        </div>
        <div className="absolute bottom-[8%] left-[6%] flex h-[30%] w-[40%] items-start rounded-xl bg-forest/25 p-2 font-poppins text-xs font-semibold text-forest">
          Massif 🌹🌷
        </div>
        <div className="absolute bottom-[8%] right-[6%] flex h-[46%] w-[42%] items-start rounded-xl border border-dashed border-forest/20 bg-sand p-2 font-poppins text-xs font-semibold text-forest/70">
          Pelouse
        </div>
      </div>

      <ul className="mt-3">
        {[
          { date: '2 sept.',  kind: 'Récolte',    text: 'Basilic · 2 poignées' },
          { date: '31 août',  kind: 'Arrosage',   text: 'Tomates · 5 L' },
          { date: '28 août',  kind: 'Traitement', text: 'Courgette · bicarbonate' },
          { date: '15 août',  kind: 'Taille',     text: 'Lavande · après floraison' },
        ].map((row) => (
          <li
            key={row.date}
            className="grid grid-cols-[68px_1fr] gap-2.5 border-b border-forest/[0.08] py-2 text-sm last:border-0"
          >
            <span className="font-poppins text-xs font-semibold tabular-nums text-forest/50">
              {row.date}
            </span>
            <span className="font-raleway text-forest/80">
              <span className="mr-1.5 rounded-md bg-lime/25 px-1.5 py-0.5 font-poppins text-[11px] font-semibold text-forest">
                {row.kind}
              </span>
              {row.text}
            </span>
          </li>
        ))}
      </ul>
    </Shot>
  )
}

/** Assistant : deux alertes météo, puis un échange avec une carte d'action. */
export function AssistantVisual() {
  return (
    <Shot>
      <TitleBar />

      <div className="flex items-center gap-3 rounded-xl bg-sun/15 p-3">
        <span className="text-xl">❄️</span>
        <span className="font-raleway text-sm">
          <b className="block font-poppins font-semibold text-forest">
            Gel annoncé cette nuit · &minus;2 °C
          </b>
          <span className="text-forest/60">Citronnier et basilic à rentrer</span>
        </span>
      </div>

      <div className="mt-2 flex items-center gap-3 rounded-xl bg-sand p-3">
        <span className="text-xl">💧</span>
        <span className="font-raleway text-sm">
          <b className="block font-poppins font-semibold text-forest/70">
            Pas d&apos;arrosage aujourd&apos;hui
          </b>
          <span className="text-forest/50">14 mm de pluie prévus à midi</span>
        </span>
      </div>

      <div className="mt-4 flex flex-col gap-2">
        <div className="ml-8 rounded-2xl rounded-br-md bg-forest p-3">
          <span className="mb-1 block font-poppins text-[10.5px] uppercase tracking-wider text-white/50">
            Toi · depuis le rosier du massif
          </span>
          <span className="font-raleway text-[13px] leading-snug text-white">
            Des points noirs sur les feuilles, ça s&apos;étale. Tu conseilles quoi ?
          </span>
        </div>

        <div className="mr-8 rounded-2xl rounded-bl-md bg-sand p-3">
          <span className="mb-1 block font-poppins text-[10.5px] uppercase tracking-wider text-forest/40">
            Growi
          </span>
          <span className="font-raleway text-[13px] leading-snug text-forest/80">
            Ça ressemble à la maladie des taches noires, fréquente après une fin
            d&apos;été humide. Retire les feuilles atteintes et évite d&apos;arroser
            le feuillage.
          </span>
          <div className="mt-2.5 flex items-center gap-2 rounded-xl bg-white p-2.5">
            <span className="font-raleway text-[12.5px] leading-tight text-forest/70">
              <b className="block font-poppins font-semibold text-forest">
                Planifier « Retirer les feuilles atteintes »
              </b>
              Rosier du massif · demain
            </span>
            <span className="ml-auto shrink-0 rounded-lg bg-lime px-3 py-1.5 font-poppins text-xs font-semibold text-forest">
              Oui
            </span>
          </div>
        </div>
      </div>
    </Shot>
  )
}

/** Diagnostic : la carte de résultat, à côté de la capture de l'app. */
export function DiagnosisCard() {
  return (
    <Shot className="max-w-[260px] p-4">
      <div className="h-24 rounded-xl bg-gradient-to-br from-lime/40 to-forest/20" />
      <div className="mt-3 flex items-center gap-2">
        <span className="rounded-md bg-sun/30 px-1.5 py-0.5 font-poppins text-[10.5px] font-semibold uppercase tracking-wider text-forest">
          Probable
        </span>
        <b className="font-poppins text-forest">Oïdium</b>
      </div>
      <p className="mt-1.5 font-raleway text-[13px] leading-snug text-forest/70">
        Feutrage blanc sur les feuilles âgées, classique après des nuits fraîches
        et humides.
      </p>
      <div className="mt-3 flex flex-col gap-1.5">
        {[
          { when: 'Demain', what: 'Retirer les feuilles atteintes' },
          { when: 'Samedi', what: 'Bicarbonate + savon noir' },
        ].map((step) => (
          <p key={step.when} className="font-raleway text-[12.5px] text-forest/80">
            <span className="mr-1.5 font-poppins text-[11px] font-semibold text-forest/50">
              {step.when}
            </span>
            {step.what}
          </p>
        ))}
      </div>
      <span className="mt-3 inline-block rounded-lg bg-lime px-3 py-1.5 font-poppins text-xs font-semibold text-forest">
        Ajouter au calendrier
      </span>
    </Shot>
  )
}

/** Calendrier : la liste des gestes, cochables. */
export function CalendarVisual() {
  const rows = [
    { icon: '🌱', title: 'Semer en pleine terre', detail: 'Mâche · fenêtre idéale jusqu’au 20 sept.' },
    { icon: '🧺', title: 'Récolter',              detail: 'Basilic dans la véranda · aujourd’hui' },
    { icon: '✂️', title: 'Tailler',               detail: 'Lavande · après floraison' },
    { icon: '🪴', title: 'Rempoter',              detail: 'Monstera · avant l’hiver' },
    { icon: '🌶️', title: 'Semer à l’intérieur', detail: 'Piment · à partir de février', muted: true },
  ]

  return (
    <Shot>
      <TitleBar />
      <div className="flex flex-col gap-2">
        {rows.map((row) => (
          <div
            key={row.title}
            className={`flex items-center gap-3 rounded-xl p-3 ${row.muted ? 'bg-sand/60' : 'bg-sand'}`}
          >
            <span className="text-xl">{row.icon}</span>
            <span className="font-raleway text-sm">
              <b
                className={`block font-poppins font-semibold ${row.muted ? 'text-forest/50' : 'text-forest'}`}
              >
                {row.title}
              </b>
              <span className={row.muted ? 'text-forest/40' : 'text-forest/60'}>
                {row.detail}
              </span>
            </span>
            {!row.muted && (
              <span className="ml-auto shrink-0 rounded-lg bg-lime/25 px-2.5 py-1 font-poppins text-[11px] font-semibold text-forest">
                ✓ Fait
              </span>
            )}
          </div>
        ))}
      </div>
    </Shot>
  )
}
