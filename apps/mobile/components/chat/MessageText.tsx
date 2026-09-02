import { Text, View } from 'react-native'

/**
 * Le peu de mise en forme que l'agent a le droit d'employer : **gras**, puces
 * « - », paragraphes.
 *
 * S'y ajoute l'italique simple, que le prompt n'autorise pas mais que le
 * modèle emploie tout de même pour les noms d'espèces.
 *
 * Écrit à la main plutôt qu'avec une bibliothèque Markdown : les bibliothèques
 * du genre pèsent lourd, traitent des tableaux qu'on n'aura jamais, et
 * imposent leur propre typographie là où la nôtre doit valoir.
 */

type Segment = { text: string; emphasis: 'none' | 'bold' | 'italic' }

/**
 * Découpe une ligne sur ses `**gras**` et ses `*italiques*`.
 *
 * L'italique n'est pas dans les formes autorisées par le prompt, mais le
 * modèle en met tout de même pour les noms d'espèces — « *Cereus* ». Le rendre
 * coûte moins cher que de laisser des astérisques à l'écran. Une paire non
 * refermée reste du texte, telle quelle.
 */
function segments(line: string): Segment[] {
  return line
    .split(/(\*\*[^*]+\*\*|\*[^*\s][^*]*\*)/g)
    .filter((token) => token.length > 0)
    .map((token) => {
      if (token.startsWith('**') && token.endsWith('**')) {
        return { text: token.slice(2, -2), emphasis: 'bold' as const }
      }
      if (token.startsWith('*') && token.endsWith('*') && token.length > 2) {
        return { text: token.slice(1, -1), emphasis: 'italic' as const }
      }
      return { text: token, emphasis: 'none' as const }
    })
}

function Line({ text, tone }: { text: string; tone: string }) {
  return (
    <Text className={`font-raleway text-body ${tone}`}>
      {segments(text).map((segment, index) => (
        <Text
          key={index}
          className={
            segment.emphasis === 'bold' ? `font-raleway-semibold text-body ${tone}` : undefined
          }
          style={segment.emphasis === 'italic' ? { fontStyle: 'italic' } : undefined}
        >
          {segment.text}
        </Text>
      ))}
    </Text>
  )
}

export function MessageText({ content, tone = 'text-forest' }: { content: string; tone?: string }) {
  const lines = content.split('\n')

  return (
    <View className="gap-1.5">
      {lines.map((raw, index) => {
        const line = raw.trimEnd()
        if (line.trim() === '') return null

        const bullet = line.match(/^\s*[-*•]\s+(.*)$/)
        if (bullet) {
          return (
            <View key={index} className="flex-row gap-2 pl-1">
              <Text className={`font-raleway text-body ${tone}`}>•</Text>
              <View className="flex-1">
                <Line text={bullet[1]} tone={tone} />
              </View>
            </View>
          )
        }

        return <Line key={index} text={line} tone={tone} />
      })}
    </View>
  )
}
