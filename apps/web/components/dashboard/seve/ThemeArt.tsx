import { sapThemeArt, type SapHomeTheme } from '@growi/shared'

/**
 * Le dessin d'un thème d'Accueil, en SVG du DOM — même géométrie que l'app
 * mobile (`sapThemeArt`, `@growi/shared`). Dessiné à une taille de référence
 * puis recadré (`slice`) : un bandeau fluide garde ses proportions sans
 * mesurer sa largeur, au prix de bords rognés en petit écran.
 */
export function ThemeArt({
  theme,
  width,
  height,
  className,
}: {
  theme: SapHomeTheme
  width: number
  height: number
  className?: string
}) {
  const art = sapThemeArt(theme, width, height)
  const gradientId = `sap-theme-${theme}-${width}x${height}`

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      {art.glow ? (
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={art.glow.color} stopOpacity={art.glow.opacity} />
            <stop offset={art.glow.stop} stopColor={art.glow.color} stopOpacity={0} />
          </linearGradient>
        </defs>
      ) : null}
      {art.veil ? <rect width={width} height={height} fill={art.veil.color} fillOpacity={art.veil.opacity} /> : null}
      {art.glow ? <rect width={width} height={height} fill={`url(#${gradientId})`} /> : null}
      {art.shapes.map((shape, index) =>
        shape.kind === 'circle' ? (
          <circle key={index} cx={shape.cx} cy={shape.cy} r={shape.r} fill={shape.fill} fillOpacity={shape.fillOpacity} />
        ) : (
          <path
            key={index}
            d={shape.d}
            fill={shape.fill}
            fillOpacity={shape.fillOpacity}
            stroke={shape.stroke}
            strokeOpacity={shape.strokeOpacity}
            strokeWidth={shape.strokeWidth}
          />
        ),
      )}
    </svg>
  )
}
