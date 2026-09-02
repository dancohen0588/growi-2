/**
 * La mise en forme que l'agent a le droit d'employer : **gras**, puces « - »,
 * paragraphes. Rien d'autre — le prompt le lui interdit.
 *
 * Écrit à la main comme son jumeau mobile, et pour la même raison : une
 * bibliothèque Markdown apporterait des titres, des tableaux et des liens
 * qu'on ne veut pas, avec sa propre typographie par-dessus la nôtre.
 */

/** Découpe une ligne sur ses `**…**`. Une paire non refermée reste du texte. */
function segments(line: string) {
  return line
    .split(/\*\*(.+?)\*\*/g)
    .map((text, index) => ({ text, bold: index % 2 === 1 }))
    .filter((segment) => segment.text.length > 0)
}

function Line({ text }: { text: string }) {
  return (
    <>
      {segments(text).map((segment, index) =>
        segment.bold ? (
          <strong key={index} className="font-semibold">
            {segment.text}
          </strong>
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
