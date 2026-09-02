/**
 * La mise en forme que l'agent a le droit d'employer : **gras**, puces « - »,
 * paragraphes — plus l'italique simple, que le prompt n'autorise pas mais que
 * le modèle emploie tout de même pour les noms d'espèces.
 *
 * Écrit à la main comme son jumeau mobile, et pour la même raison : une
 * bibliothèque Markdown apporterait des titres, des tableaux et des liens
 * qu'on ne veut pas, avec sa propre typographie par-dessus la nôtre.
 */

/**
 * Découpe une ligne sur ses `**gras**` et ses `*italiques*`.
 *
 * L'italique n'est pas dans les formes autorisées par le prompt, mais le
 * modèle en met tout de même pour les noms d'espèces — « *Cereus* ». Le rendre
 * coûte moins cher que de laisser des astérisques à l'écran. Une paire non
 * refermée reste du texte, telle quelle.
 */
function segments(line: string) {
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

function Line({ text }: { text: string }) {
  return (
    <>
      {segments(text).map((segment, index) =>
        segment.emphasis === 'bold' ? (
          <strong key={index} className="font-semibold">
            {segment.text}
          </strong>
        ) : segment.emphasis === 'italic' ? (
          <em key={index} className="italic">
            {segment.text}
          </em>
        ) : (
          <span key={index}>{segment.text}</span>
        ),
      )}
    </>
  )
}

export function MessageText({ content }: { content: string }) {
  const lines = content.split('\n').filter((line) => line.trim() !== '')

  return (
    <div className="flex flex-col gap-1.5 font-raleway text-sm leading-relaxed">
      {lines.map((raw, index) => {
        const bullet = raw.match(/^\s*[-*•]\s+(.*)$/)

        return bullet ? (
          <p key={index} className="flex gap-2 pl-1">
            <span aria-hidden>•</span>
            <span className="flex-1">
              <Line text={bullet[1]} />
            </span>
          </p>
        ) : (
          <p key={index}>
            <Line text={raw.trimEnd()} />
          </p>
        )
      })}
    </div>
  )
}
