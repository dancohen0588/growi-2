/**
 * Corps d'article qui passe tous les contrôles d'`editorial.ts` (≥ 700 mots,
 * trois intertitres, un encadré, tutoiement). Les tests le dégradent ensuite,
 * un défaut à la fois ; `extra` s'ajoute en fin de corps.
 */
export function validMdx(extra = ''): string {
  const paragraph = 'Tu arroses au pied le matin, ton paillage garde la fraîcheur et ta terre reste souple pendant dix jours au moins.'
  const section = (title: string) => [`## ${title}`, '', ...Array.from({ length: 12 }, () => paragraph), ''].join('\n')
  return [
    'En septembre, ton potager se prépare pour l’hiver. Voici les gestes à faire, et quand.',
    '',
    section('Semer les engrais verts'),
    '<Callout tone="conseil" title="Le bon moment">Sème avant le 15 octobre, sur un sol humide.</Callout>',
    '',
    section('Récolter les dernières tomates'),
    section('Protéger les planches libérées'),
    extra,
  ].join('\n')
}

