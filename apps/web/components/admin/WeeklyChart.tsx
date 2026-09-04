/**
 * Histogrammes hebdomadaires, en SVG écrit à la main.
 *
 * Aucune bibliothèque de graphes n'est présente dans le projet, et la spec
 * laissait le choix. Quelques barres ne valent pas les ~500 Ko de `recharts`,
 * qui imposerait en plus un composant client là où tout le reste de l'admin
 * est rendu côté serveur.
 *
 * Le SVG s'étire à la largeur disponible (`viewBox` + `preserveAspectRatio`),
 * il n'y a donc aucune mesure à faire dans le navigateur.
 */

type Series = { label: string; color: string; points: number[] }

const WIDTH = 720
const HEIGHT = 180
const PADDING = { top: 12, right: 4, bottom: 22, left: 4 }

/** Le libellé court d'une semaine : `2026-09-01` → `1 sept.` */
function weekLabel(week: string): string {
  const date = new Date(`${week}T00:00:00.000Z`)
  return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', timeZone: 'UTC' })
}

export function WeeklyChart({
  weeks,
  series,
  caption,
  emptyHint,
}: {
  weeks: string[]
  series: Series[]
  caption: string
  emptyHint?: string
}) {
  const total = series.reduce((sum, s) => sum + s.points.reduce((a, b) => a + b, 0), 0)

  if (weeks.length === 0 || total === 0) {
    return (
      <div className="rounded-xl border border-dashed border-forest/15 p-8 text-center text-sm text-forest/50">
        {emptyHint ?? 'Aucune donnée sur la période.'}
      </div>
    )
  }

  // Une échelle commune à toutes les séries : les mettre chacune à son propre
  // maximum rendrait deux courbes visuellement comparables alors qu'elles ne
  // le sont pas.
  const max = Math.max(1, ...series.flatMap((s) => s.points))

  const innerWidth = WIDTH - PADDING.left - PADDING.right
  const innerHeight = HEIGHT - PADDING.top - PADDING.bottom
  const slot = innerWidth / weeks.length
  const barWidth = Math.max(2, (slot - 4) / series.length)

  return (
    <figure className="space-y-2">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        preserveAspectRatio="none"
        className="h-44 w-full"
        role="img"
        aria-label={caption}
      >
        {/* Ligne de base : sans elle, les semaines à zéro n'existent pas. */}
        <line
          x1={PADDING.left}
          y1={PADDING.top + innerHeight}
          x2={WIDTH - PADDING.right}
          y2={PADDING.top + innerHeight}
          stroke="currentColor"
          className="text-forest/15"
          strokeWidth={1}
        />

        {weeks.map((week, index) =>
          series.map((s, seriesIndex) => {
            const value = s.points[index] ?? 0
            const height = (value / max) * innerHeight
            const x = PADDING.left + index * slot + 2 + seriesIndex * barWidth
            const y = PADDING.top + innerHeight - height

            return (
              <rect
                key={`${s.label}-${week}`}
                x={x}
                y={y}
                width={barWidth}
                height={Math.max(value > 0 ? 2 : 0, height)}
                rx={1}
                fill={s.color}
              >
                <title>{`${weekLabel(week)} — ${s.label} : ${value}`}</title>
              </rect>
            )
          }),
        )}

        {/* Une graduation sur quatre : au-delà, les libellés se chevauchent. */}
        {weeks.map((week, index) =>
          index % 4 === 0 || index === weeks.length - 1 ? (
            <text
              key={`label-${week}`}
              x={PADDING.left + index * slot + slot / 2}
              y={HEIGHT - 6}
              textAnchor="middle"
              fontSize={11}
              fill="currentColor"
              className="text-forest/45"
            >
              {weekLabel(week)}
            </text>
          ) : null,
        )}
      </svg>

      <figcaption className="flex flex-wrap items-center gap-4 text-xs text-forest/55">
        <span>{caption}</span>
        <span className="ml-auto flex flex-wrap gap-3">
          {series.map((s) => (
            <span key={s.label} className="flex items-center gap-1.5">
              <span
                className="size-2.5 rounded-sm"
                style={{ backgroundColor: s.color }}
                aria-hidden
              />
              {s.label}
            </span>
          ))}
          <span>max&nbsp;{max.toLocaleString('fr-FR')}</span>
        </span>
      </figcaption>
    </figure>
  )
}

/** Couleurs de la palette Growi, réutilisées telles quelles par les séries. */
export const CHART_COLORS = {
  lime: '#B4DD7F',
  forest: '#1E5631',
  sun: '#F6C445',
} as const
