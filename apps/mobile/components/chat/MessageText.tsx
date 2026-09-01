import { Text, View } from 'react-native'

/**
 * Le peu de mise en forme que l'agent a le droit d'employer : **gras**, puces
 * « - », paragraphes.
 *
 * Écrit à la main plutôt qu'avec une bibliothèque Markdown : le prompt
 * n'autorise que ces trois formes, et les bibliothèques du genre pèsent lourd,
 * traitent des tableaux qu'on n'aura jamais, et imposent leur propre
 * typographie là où la nôtre doit valoir.
 */

type Segment = { text: string; bold: boolean }

/** Découpe une ligne sur ses `**…**`. Une paire non refermée reste du texte. */
function segments(line: string): Segment[] {
  const parts = line.split(/\*\*(.+?)\*\*/g)
  return parts
    .map((text, index) => ({ text, bold: index % 2 === 1 }))
    .filter((segment) => segment.text.length > 0)
}

function Line({ text, tone }: { text: string; tone: string }) {
  return (
    <Text className={`font-raleway text-body ${tone}`}>
      {segments(text).map((segment, index) => (
        <Text
          key={index}
          className={segment.bold ? `font-raleway-semibold text-body ${tone}` : undefined}
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
