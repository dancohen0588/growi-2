import Link from 'next/link'

export function ContactInfo() {
  return (
    <div className="sticky top-8">
      <div className="bg-white/60 backdrop-blur-sm border border-border rounded-2xl shadow-card p-6 space-y-5">
        <h3 className="font-poppins font-semibold text-forest text-lg">Nos coordonnées</h3>

        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <span className="text-xl mt-0.5" aria-hidden>📧</span>
            <div>
              <p className="font-medium text-forest text-sm">Email</p>
              <a
                href="mailto:contact@growi.app"
                className="text-forest/70 text-sm hover:text-forest transition-colors"
              >
                contact@growi.app
              </a>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <span className="text-xl mt-0.5" aria-hidden>⏱️</span>
            <div>
              <p className="font-medium text-forest text-sm">Délai de réponse</p>
              <p className="text-forest/70 text-sm">Sous 48h en semaine</p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <span className="text-xl mt-0.5" aria-hidden>🌱</span>
            <div>
              <p className="font-medium text-forest text-sm">On est là pour toi</p>
              <p className="text-forest/70 text-sm leading-relaxed">
                On répond à toutes les questions,<br />
                même les plus basiques !
              </p>
            </div>
          </div>
        </div>

        <div className="bg-lime/10 rounded-xl p-4 space-y-2">
          <p className="text-forest text-sm leading-relaxed">
            💬 Tu cherches une réponse rapide ? Consulte notre centre d&apos;aide — la plupart des réponses s&apos;y trouvent déjà.
          </p>
          <Link
            href="/aide"
            className="text-forest text-sm underline underline-offset-4 hover:text-forest/70 transition-colors inline-block font-raleway"
          >
            Voir le centre d&apos;aide →
          </Link>
        </div>
      </div>
    </div>
  )
}
