import { SECRET_ART, isSecretArt } from '@growi/shared'

import { cn } from '@/lib/utils'
import { SVG_FILL } from './SecretEmblem'

interface SecretArtProps {
  /** Une clé du registre (`eau-cuisson/1`). Inconnue : rien n'est rendu. */
  artKey: string
  /** Le texte alternatif — la légende de la case. Absent : dessin décoratif. */
  alt?: string
  className?: string
}

/**
 * Un dessin de planche, tiré du registre `SECRET_ART`. Voir la note de
 * `SecretEmblem.tsx` sur `dangerouslySetInnerHTML` : la chaîne vient du code,
 * jamais de la base — qui ne porte que la clé.
 */
export function SecretArt({ artKey, alt, className }: SecretArtProps) {
  if (!isSecretArt(artKey)) return null
  return (
    <span
      {...(alt ? { role: 'img', 'aria-label': alt } : { 'aria-hidden': true })}
      className={cn('block', SVG_FILL, className)}
      dangerouslySetInnerHTML={{ __html: SECRET_ART[artKey] }}
    />
  )
}
