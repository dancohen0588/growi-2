/**
 * Clés de cache de l'app, réunies ici.
 *
 * Hiérarchiques : invalider `all` couvre listes, détails et sous-ressources
 * d'un coup, utile après une écriture dont on ne sait pas tout ce qu'elle
 * remue. Elles vivent à part des hooks parce que les écritures se croisent —
 * noter un geste touche la plante, son jardin et le planning du jour — et que
 * des `queries/*` s'important l'un l'autre finiraient en cycle.
 */

export const gardenKeys = {
  all: ['gardens'] as const,
  list: () => [...gardenKeys.all, 'list'] as const,
  detail: (gardenId: string) => [...gardenKeys.all, 'detail', gardenId] as const,
  plants: (gardenId: string) => [...gardenKeys.all, 'detail', gardenId, 'plants'] as const,
}

export const plantKeys = {
  all: ['plants'] as const,
  detail: (plantId: string) => [...plantKeys.all, 'detail', plantId] as const,
  logs: (plantId: string) => [...plantKeys.all, 'detail', plantId, 'logs'] as const,
}

export const planningKeys = {
  all: ['planning'] as const,
  today: () => [...planningKeys.all, 'today'] as const,
}

export const summaryKeys = {
  all: ['summary'] as const,
}

export const weatherKeys = {
  all: ['weather'] as const,
}

export const meKeys = {
  all: ['me'] as const,
  profile: () => [...meKeys.all, 'profile'] as const,
}
