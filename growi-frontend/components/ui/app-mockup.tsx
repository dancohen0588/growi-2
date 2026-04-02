export function AppMockup() {
  return (
    <div className="flex items-center justify-center w-full">
      {/* Phone frame */}
      <div
        className="relative animate-float"
        style={{ width: '220px', height: '440px' }}
        aria-hidden="true"
      >
        <div
          className="absolute inset-0 rounded-[2.5rem] border-4 shadow-2xl overflow-hidden flex flex-col"
          style={{ borderColor: 'rgba(30,86,49,0.2)', background: '#F9F7E8' }}
        >
          {/* Status bar */}
          <div className="h-6 bg-forest flex items-center justify-end px-4">
            <span className="text-white text-[9px]">9:41</span>
          </div>

          {/* App header */}
          <div
            className="flex items-center justify-between px-4 py-3"
            style={{ background: 'linear-gradient(135deg, #1E5631, #2d7a47)' }}
          >
            <div className="flex items-center gap-2">
              <span className="text-base">🌱</span>
              <span className="text-white font-poppins font-bold text-sm">Mes plantes</span>
            </div>
            <div className="w-7 h-7 rounded-full bg-lime flex items-center justify-center text-forest font-bold text-sm">
              +
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 p-3 flex flex-col gap-3 overflow-hidden">

            {/* Plant card */}
            <div className="bg-white rounded-xl p-3 shadow-card">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-9 h-9 rounded-lg bg-lime/20 flex items-center justify-center text-xl">
                  🌿
                </div>
                <div>
                  <div className="font-poppins font-bold text-forest text-xs">Ficus Lyrata</div>
                  <div className="text-forest/50 text-[10px]">Salon · Exposition indirecte</div>
                </div>
              </div>
              {/* Hydration bar */}
              <div className="h-1.5 bg-sand-dark rounded-full overflow-hidden mb-1">
                <div
                  className="h-full bg-lime rounded-full"
                  style={{ width: '65%' }}
                />
              </div>
              <div className="flex justify-between">
                <span className="text-[10px] text-forest/50">Hydratation</span>
                <span className="text-[10px] text-forest font-semibold">65%</span>
              </div>
            </div>

            {/* Weather + alert row */}
            <div className="flex gap-2">
              <div className="flex-none w-20 bg-sun/20 rounded-xl p-2 text-center">
                <div className="text-lg">☀️</div>
                <div className="font-poppins font-bold text-forest text-xs">22°C</div>
                <div className="text-[9px] text-forest/50">Aujourd'hui</div>
              </div>
              <div className="flex-1 bg-lime/15 rounded-xl p-2 flex items-center gap-2">
                <span className="text-sm">🔔</span>
                <div>
                  <div className="font-poppins font-bold text-forest text-[10px]">Arroser dans 2h</div>
                  <div className="text-[9px] text-forest/50">Ficus · 200ml</div>
                </div>
              </div>
            </div>

            {/* IA diagnostic card */}
            <div className="bg-white rounded-xl p-3 shadow-card">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm">📷</span>
                <span className="font-poppins font-bold text-forest text-xs">Diagnostic IA</span>
                <div className="ml-auto bg-lime rounded px-1.5 py-0.5 text-[9px] text-forest font-bold">
                  NEW
                </div>
              </div>
              <div className="text-[10px] text-forest/50">Pointe l'appareil vers ta plante</div>
            </div>
          </div>

          {/* Bottom nav */}
          <div className="bg-white border-t border-sand-dark h-12 flex items-center justify-around px-4">
            <span className="text-xl">🏠</span>
            <span className="text-xl opacity-40">🔍</span>
            <span className="text-xl opacity-40">🛒</span>
            <span className="text-xl opacity-40">👤</span>
          </div>
        </div>
      </div>
    </div>
  )
}
