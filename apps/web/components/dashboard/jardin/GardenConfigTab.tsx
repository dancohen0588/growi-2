// growi-frontend/components/dashboard/jardin/GardenConfigTab.tsx
'use client'

import { cn } from '@/lib/utils'
import type { GardenConfig, SolType, GardenOrientation, MicroClimat, ClimateZone, SlopeDirection } from '@/lib/garden/types'
import { SOL_INFOS, ORIENTATION_LABELS, ORIENTATION_TO_DEG } from '@/lib/garden/defaults'
import { generateReco } from '@/lib/garden/garden-reco'

interface GardenConfigTabProps {
  config: GardenConfig
  onChange: (patch: Partial<GardenConfig>) => void
}

// Generic chip group for mono- or multi-select
function ChipGroup<T extends string>({
  options,
  value,
  onChange,
  multi = false,
}: {
  options: Array<{ value: T; label: string }>
  value: T | T[]
  onChange: (v: T | T[]) => void
  multi?: boolean
}) {
  function isActive(v: T) {
    return multi ? (value as T[]).includes(v) : value === v
  }
  function toggle(v: T) {
    if (!multi) return onChange(v)
    const arr = value as T[]
    onChange(arr.includes(v) ? arr.filter(x => x !== v) : [...arr, v])
  }
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map(opt => (
        <button
          key={opt.value}
          onClick={() => toggle(opt.value)}
          aria-pressed={isActive(opt.value)}
          className={cn(
            'px-2.5 py-1 rounded-lg font-raleway text-[11px] font-semibold border transition-all',
            isActive(opt.value)
              ? 'bg-lime/20 border-lime text-forest'
              : 'bg-white border-border text-forest/50 hover:border-forest/20',
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2 pb-4 border-b border-forest/10 last:border-0">
      <p className="font-poppins font-bold text-[11px] uppercase tracking-wide text-forest/50">{title}</p>
      {children}
    </div>
  )
}

export function GardenConfigTab({ config, onChange }: GardenConfigTabProps) {
  const reco = generateReco(config)

  const slopeLabel =
    config.slopeDeg === 0 ? '✅ Terrain plat — drainage standard'
    : config.slopeDeg <= 10 ? '🔽 Légère pente — bon drainage naturel'
    : config.slopeDeg <= 25 ? '⚠️ Pente modérée — prévoir des terrasses'
    : '🚨 Forte pente — aménagement indispensable'

  return (
    <div className="flex flex-col gap-4 p-3 overflow-y-auto h-full text-xs">

      <Section title="🧭 Orientation principale">
        <ChipGroup<GardenOrientation>
          options={(Object.keys(ORIENTATION_LABELS) as GardenOrientation[]).map(k => ({
            value: k,
            label: ORIENTATION_LABELS[k],
          }))}
          value={config.orientation}
          onChange={v => onChange({
            orientation: v as GardenOrientation,
            compassDeg: ORIENTATION_TO_DEG[v as GardenOrientation],
          })}
        />
      </Section>

      <Section title="🌍 Type de sol">
        <ChipGroup<SolType>
          options={[
            { value: 'argileux', label: '🧱 Argileux' },
            { value: 'sableux',  label: '🏖️ Sableux' },
            { value: 'limoneux', label: '🌾 Limoneux' },
            { value: 'calcaire', label: '⛰️ Calcaire' },
            { value: 'tourbeux', label: '🌑 Tourbeux' },
            { value: 'fertile',  label: '🌱 Fertile' },
          ]}
          value={config.solType}
          onChange={v => onChange({ solType: v as SolType })}
        />
        <p className="font-raleway text-[10px] text-forest/50 italic">{SOL_INFOS[config.solType]}</p>
      </Section>

      <Section title="📐 Inclinaison du terrain">
        <div className="flex items-center gap-2">
          <input
            id="slope-range"
            type="range"
            min={0} max={45} step={1}
            value={config.slopeDeg}
            onChange={e => onChange({ slopeDeg: Number(e.target.value) })}
            className="flex-1 accent-lime"
            aria-label="Inclinaison du terrain en degrés"
          />
          <span className="font-poppins font-bold text-forest w-8 text-right shrink-0">{config.slopeDeg}°</span>
        </div>
        <p className="font-raleway text-[10px] text-forest/60">{slopeLabel}</p>
        <div>
          <p className="font-raleway text-[10px] text-forest/50 mb-1">Direction de la pente</p>
          <ChipGroup<SlopeDirection>
            options={[
              { value: 'N', label: 'N' }, { value: 'S', label: 'S' },
              { value: 'E', label: 'E' }, { value: 'O', label: 'O' },
            ]}
            value={config.slopeDirection}
            onChange={v => onChange({ slopeDirection: v as SlopeDirection })}
          />
        </div>
      </Section>

      <Section title="🌤️ Micro-climat">
        <ChipGroup<MicroClimat>
          options={[
            { value: 'abrite', label: '🌿 Abrité' },
            { value: 'vent',   label: '💨 Venté' },
            { value: 'humide', label: '💧 Humide' },
            { value: 'sec',    label: '☀️ Sec' },
            { value: 'gel',    label: '❄️ Risque gel' },
            { value: 'urban',  label: '🏙️ Urbain' },
          ]}
          value={config.microclimats}
          onChange={v => onChange({ microclimats: v as MicroClimat[] })}
          multi
        />
      </Section>

      <Section title="📏 Superficie">
        <div className="flex gap-2">
          <div className="flex flex-col gap-0.5 flex-1">
            <label htmlFor="conf-w" className="font-raleway text-[10px] text-forest/40">Largeur (m)</label>
            <input
              id="conf-w"
              type="number"
              min={1} max={500} step={1}
              value={config.widthMeters}
              onChange={e => onChange({ widthMeters: Number(e.target.value) })}
              className="border border-border rounded-lg px-2 py-1 font-raleway text-xs text-forest focus:outline-none focus:ring-1 focus:ring-lime"
            />
          </div>
          <div className="flex flex-col gap-0.5 flex-1">
            <label htmlFor="conf-h" className="font-raleway text-[10px] text-forest/40">Longueur (m)</label>
            <input
              id="conf-h"
              type="number"
              min={1} max={500} step={1}
              value={config.heightMeters}
              onChange={e => onChange({ heightMeters: Number(e.target.value) })}
              className="border border-border rounded-lg px-2 py-1 font-raleway text-xs text-forest focus:outline-none focus:ring-1 focus:ring-lime"
            />
          </div>
        </div>
        <p className="font-raleway text-[10px] text-forest/50 font-semibold">
          📐 Surface : {config.widthMeters * config.heightMeters} m²
        </p>
      </Section>

      <Section title="🌍 Zone climatique">
        <ChipGroup<ClimateZone>
          options={[
            { value: 'oceanique',   label: '🌧️ Océanique' },
            { value: 'continental', label: '❄️ Continental' },
            { value: 'mediterr',    label: '🌊 Méditerranéen' },
            { value: 'montagne',    label: '🏔️ Montagne' },
          ]}
          value={config.climateZone}
          onChange={v => onChange({ climateZone: v as ClimateZone })}
        />
      </Section>

      {/* Growi reco */}
      <div className="rounded-xl bg-lime/10 border border-lime/30 p-3">
        <p className="font-poppins font-bold text-[11px] text-forest mb-1.5">🤖 Recommandation Growi</p>
        <p className="font-raleway text-[11px] text-forest/70 leading-relaxed">{reco}</p>
      </div>
    </div>
  )
}
