import { useState } from 'react'
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native'
import Svg, { Circle, Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg'
import { sapThemeArt, type SapHomeTheme } from '@growi/shared'

/**
 * Le thème d'Accueil débloqué par un cerne, posé par-dessus la photo du hero
 * et sous son texte. La géométrie vient de `sapThemeArt` (`@growi/shared`) :
 * le web dessine exactement la même chose.
 *
 * Dessiné aux dimensions réelles du bloc, mesurées à la mise en page — sans
 * elles, rien n'est rendu plutôt qu'un dessin étiré.
 */
export function HomeThemeLayer({ theme, id = 'hero' }: { theme: SapHomeTheme; id?: string }) {
  const [size, setSize] = useState<{ width: number; height: number } | null>(null)

  const onLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout
    if (!size || Math.abs(size.width - width) > 1 || Math.abs(size.height - height) > 1) {
      setSize({ width, height })
    }
  }

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none" onLayout={onLayout} accessible={false}>
      {size ? <ThemeArt theme={theme} width={size.width} height={size.height} gradientId={`theme-${id}`} /> : null}
    </View>
  )
}

/** Le dessin seul, à une taille connue — sert aussi aux vignettes du sélecteur. */
export function ThemeArt({
  theme,
  width,
  height,
  gradientId,
}: {
  theme: SapHomeTheme
  width: number
  height: number
  gradientId: string
}) {
  const art = sapThemeArt(theme, width, height)

  return (
    <Svg width={width} height={height}>
      {art.glow ? (
        <Defs>
          <LinearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={art.glow.color} stopOpacity={art.glow.opacity} />
            <Stop offset={art.glow.stop} stopColor={art.glow.color} stopOpacity={0} />
          </LinearGradient>
        </Defs>
      ) : null}
      {art.veil ? (
        <Rect x={0} y={0} width={width} height={height} fill={art.veil.color} fillOpacity={art.veil.opacity} />
      ) : null}
      {art.glow ? <Rect x={0} y={0} width={width} height={height} fill={`url(#${gradientId})`} /> : null}
      {art.shapes.map((shape, index) =>
        shape.kind === 'circle' ? (
          <Circle key={index} cx={shape.cx} cy={shape.cy} r={shape.r} fill={shape.fill} fillOpacity={shape.fillOpacity} />
        ) : (
          <Path
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
    </Svg>
  )
}
