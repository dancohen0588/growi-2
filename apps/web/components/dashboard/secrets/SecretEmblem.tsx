import { SECRET_EMBLEM_SVG, type SecretEmblemVariant } from '@growi/shared'

import { cn } from '@/lib/utils'

/**
 * Pourquoi `dangerouslySetInnerHTML` est acceptable ici, et **seulement ici** :
 * les chaînes rendues viennent du registre `@growi/shared/secrets/art.ts`,
 * écrit dans le code, relu et versionné. La base ne porte que des **clés**
 * (`eau-cuisson/1`), validées contre ce registre par `isSecretArt` : aucune
 * saisie — admin comprise — ne peut injecter de balisage. Ne jamais passer à
 * ces composants une chaîne venue d'ailleurs que de ce registre.
 *
 * L'enfant `<svg>` n'a ni largeur ni hauteur : il prend celles du conteneur,
 * que l'appelant fixe par `size` ou par ses classes.
 */
export const SVG_FILL = '[&>svg]:block [&>svg]:h-full [&>svg]:w-full'

export const SECRET_EMBLEM_LABEL = 'Emblème des secrets de jardinier'

interface SecretEmblemProps {
  /** `full` dès 40 px, `small` en dessous, `line` (au trait, `currentColor`) pour la navigation. */
  variant?: SecretEmblemVariant
  /** Côté en pixels. Sans lui, les classes de l'appelant fixent la taille. */
  size?: number
  /** Décoratif : l'emblème double un texte déjà lu (entrée de navigation). */
  decorative?: boolean
  label?: string
  className?: string
}

/** L'emblème des secrets : un sceau soleil, une serrure d'où sort une pousse. */
export function SecretEmblem({
  variant,
  size,
  decorative = false,
  label = SECRET_EMBLEM_LABEL,
  className,
}: SecretEmblemProps) {
  const chosen: SecretEmblemVariant = variant ?? (size !== undefined && size < 40 ? 'small' : 'full')
  return (
    <span
      {...(decorative ? { 'aria-hidden': true } : { role: 'img', 'aria-label': label })}
      className={cn('inline-block shrink-0', SVG_FILL, className)}
      style={size !== undefined ? { width: size, height: size } : undefined}
      dangerouslySetInnerHTML={{ __html: SECRET_EMBLEM_SVG[chosen] }}
    />
  )
}

/**
 * Le pictogramme du grimoire, au format des icônes lucide de la navigation
 * (`size`, `className`). Toujours décoratif : le libellé de l'entrée le nomme.
 */
export function GrimoireIcon({
  size = 24,
  className,
}: {
  size?: number
  className?: string
  'aria-hidden'?: boolean | 'true' | 'false'
}) {
  return <SecretEmblem variant="line" size={size} decorative className={className} />
}
