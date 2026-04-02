function AppleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
    </svg>
  )
}

function PlayIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M3.18 23.76A2 2 0 0 1 1 21.9V2.1A2 2 0 0 1 3.18.24l19.1 9.9a2 2 0 0 1 0 3.52l-19.1 9.9a2.01 2.01 0 0 1-.9.2z"/>
    </svg>
  )
}

export function FinalCTA() {
  return (
    <section
      className="bg-gradient-to-r from-lime to-forest py-20 md:py-28"
      aria-label="Télécharger l'application"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <h2 className="font-poppins font-bold text-white text-3xl md:text-[2.5rem] leading-tight mb-4">
          Rejoignez la communauté des jardiniers connectés.
        </h2>
        <p className="font-raleway text-white/80 text-lg mb-10">
          Gratuit pour commencer. Disponible sur iOS et Android.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          {/* App Store button */}
          <a
            href="/"
            className="inline-flex items-center gap-3 border-2 border-white text-white rounded-xl px-6 py-3.5 font-raleway font-semibold hover:bg-white/20 transition-colors min-h-[44px]"
          >
            <AppleIcon />
            <div className="text-left">
              <div className="text-[10px] text-white/70 leading-none">Disponible sur</div>
              <div className="text-base font-poppins font-semibold leading-tight">App Store</div>
            </div>
          </a>

          {/* Google Play button */}
          <a
            href="/"
            className="inline-flex items-center gap-3 border-2 border-white text-white rounded-xl px-6 py-3.5 font-raleway font-semibold hover:bg-white/20 transition-colors min-h-[44px]"
          >
            <PlayIcon />
            <div className="text-left">
              <div className="text-[10px] text-white/70 leading-none">Disponible sur</div>
              <div className="text-base font-poppins font-semibold leading-tight">Google Play</div>
            </div>
          </a>
        </div>
      </div>
    </section>
  )
}
