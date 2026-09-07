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
  plan: (gardenId: string) => [...gardenKeys.all, 'detail', gardenId, 'plan'] as const,
}

export const plantKeys = {
  all: ['plants'] as const,
  detail: (plantId: string) => [...plantKeys.all, 'detail', plantId] as const,
  logs: (plantId: string) => [...plantKeys.all, 'detail', plantId, 'logs'] as const,
}

export const diagnosisKeys = {
  all: ['diagnoses'] as const,
  list: (plantId: string) => [...diagnosisKeys.all, 'list', plantId] as const,
  detail: (plantId: string, diagnosisId: string) =>
    [...diagnosisKeys.all, 'detail', plantId, diagnosisId] as const,
}

/**
 * Les fils sont mis en cache par **ancrage** et non par identifiant : l'écran
 * s'ouvre depuis une plante ou un diagnostic, sans savoir si une conversation
 * existe déjà — c'est le serveur qui le dit.
 */
export const chatKeys = {
  all: ['chat'] as const,
  thread: (anchorKey: string) => [...chatKeys.all, 'thread', anchorKey] as const,
  forPlant: (plantInstanceId: string) => [...chatKeys.all, 'plante', plantInstanceId] as const,
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

export const blogKeys = {
  all: ['blog'] as const,
  list: (tag?: string) => [...blogKeys.all, 'list', tag ?? 'tous'] as const,
  detail: (slug: string) => [...blogKeys.all, 'detail', slug] as const,
}

export const meKeys = {
  all: ['me'] as const,
  profile: () => [...meKeys.all, 'profile'] as const,
}

/**
 * Communauté. Les profils publics sont indexés par **pseudo** et non par
 * identifiant : c'est ce que porte l'URL, et donc ce dont dispose un écran
 * ouvert depuis un lien ou une notification.
 */
export const communityKeys = {
  all: ['community'] as const,
  settings: () => [...communityKeys.all, 'settings'] as const,
  profile: (handle: string) => [...communityKeys.all, 'profile', handle] as const,
  handleCheck: (handle: string) => [...communityKeys.all, 'handle', handle] as const,
  blocked: () => [...communityKeys.all, 'blocked'] as const,
  /**
   * Le fil local dépend du rayon : en changer doit repartir d'une première
   * page, pas empiler deux fils différents. Le fil des abonnements, lui, n'en
   * dépend pas — d'où deux clés distinctes plutôt qu'un rayon factice.
   */
  feed: (radiusKm: number) => [...communityKeys.all, 'feed', 'nearby', radiusKm] as const,
  followingFeed: () => [...communityKeys.all, 'feed', 'following'] as const,
  userPosts: (handle: string) => [...communityKeys.all, 'profile', handle, 'posts'] as const,
  follows: (handle: string, direction: 'followers' | 'following') =>
    [...communityKeys.all, 'profile', handle, direction] as const,
  notifications: () => [...communityKeys.all, 'notifications'] as const,
  unread: () => [...communityKeys.all, 'unread'] as const,
  home: () => [...communityKeys.all, 'home'] as const,
  post: (postId: string) => [...communityKeys.all, 'post', postId] as const,
  comments: (postId: string) => [...communityKeys.all, 'post', postId, 'comments'] as const,
}
