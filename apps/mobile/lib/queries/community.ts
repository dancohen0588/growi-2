import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type InfiniteData,
} from '@tanstack/react-query'
import type {
  CommunityCommentPage,
  CommunityFeed,
  CommunityNotificationPage,
  CommunityPostDetail,
  CommunityPostPage,
  CommunityProfile,
  CommunityUserPage,
  CreateCommentInput,
  CreatePostInput,
  CreateReportInput,
  UpdateCommunitySettingsInput,
} from '@growi/shared'
import { HANDLE_MIN_LENGTH } from '@growi/shared'

import { api } from '@/lib/api'
import { communityKeys } from '@/lib/queries/keys'

/**
 * Communauté — phase 0 : réglages du profil public, profils, abonnements,
 * blocage, signalement.
 */

export function useCommunitySettings(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: communityKeys.settings(),
    queryFn: () => api.community.getSettings(),
    enabled: options?.enabled ?? true,
  })
}

export function useUpdateCommunitySettings() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: UpdateCommunitySettingsInput) => api.community.updateSettings(input),
    onSuccess: (settings) => {
      queryClient.setQueryData(communityKeys.settings(), settings)
      // Changer de pseudo ou quitter la communauté change ce que les autres
      // voient de nous : les profils en cache ne valent plus rien.
      void queryClient.invalidateQueries({ queryKey: communityKeys.all })
    },
  })
}

/**
 * Disponibilité d'un pseudo, interrogée à la frappe.
 *
 * La valeur doit arriver **déjà débouncée** (`useDebouncedValue`) : ce hook ne
 * temporise pas, il se contente de ne rien demander tant que la saisie est
 * trop courte pour être valide.
 */
export function useHandleAvailability(handle: string) {
  const trimmed = handle.trim().toLowerCase()

  return useQuery({
    queryKey: communityKeys.handleCheck(trimmed),
    queryFn: () => api.community.checkHandle(trimmed),
    enabled: trimmed.length >= HANDLE_MIN_LENGTH,
    // Un pseudo pris ne se libère pas d'une seconde à l'autre.
    staleTime: 30_000,
  })
}

// ─── Publications ──────────────────────────────────────────────────────────

/**
 * Le fil « Autour de moi », en pagination infinie.
 *
 * Le curseur porte le rayon **effectif** : si le serveur a élargi de lui-même
 * parce que le voisinage était vide, les pages suivantes gardent ce rayon.
 * Le rayon est aussi dans la clé de cache — en changer doit repartir d'une
 * première page, pas empiler deux fils différents.
 */
export function useFeed(radiusKm: number, options?: { enabled?: boolean }) {
  return useInfiniteQuery({
    queryKey: communityKeys.feed(radiusKm),
    queryFn: ({ pageParam }) =>
      api.community.feed({ scope: 'nearby', radiusKm, cursor: pageParam ?? undefined }),
    initialPageParam: null as string | null,
    getNextPageParam: (last: CommunityFeed) => last.nextCursor ?? undefined,
    enabled: options?.enabled ?? true,
  })
}

/**
 * Le fil « Abonnements » — sans rayon, donc sans clé de rayon.
 *
 * Chargé seulement quand l'onglet est ouvert : la plupart des comptes n'ont
 * encore d'abonnement à personne, et le demander d'office ne servirait rien.
 */
export function useFollowingFeed(options?: { enabled?: boolean }) {
  return useInfiniteQuery({
    queryKey: communityKeys.followingFeed(),
    queryFn: ({ pageParam }) =>
      api.community.feed({ scope: 'following', cursor: pageParam ?? undefined }),
    initialPageParam: null as string | null,
    getNextPageParam: (last: CommunityFeed) => last.nextCursor ?? undefined,
    enabled: options?.enabled ?? true,
  })
}

// ─── Profil public d'un autre compte ───────────────────────────────────────

export function useCommunityProfile(handle: string) {
  return useQuery({
    queryKey: communityKeys.profile(handle),
    queryFn: () => api.community.getProfile(handle),
    enabled: handle.length > 0,
  })
}

export function useUserPosts(handle: string) {
  return useInfiniteQuery({
    queryKey: communityKeys.userPosts(handle),
    queryFn: ({ pageParam }) =>
      api.community.userPosts(handle, { cursor: pageParam ?? undefined }),
    initialPageParam: null as string | null,
    getNextPageParam: (last: CommunityPostPage) => last.nextCursor ?? undefined,
    enabled: handle.length > 0,
  })
}

export function useFollows(handle: string, direction: 'followers' | 'following') {
  return useInfiniteQuery({
    queryKey: communityKeys.follows(handle, direction),
    queryFn: ({ pageParam }) =>
      api.community.follows(handle, direction, { cursor: pageParam ?? undefined }),
    initialPageParam: null as string | null,
    getNextPageParam: (last: CommunityUserPage) => last.nextCursor ?? undefined,
    enabled: handle.length > 0,
  })
}

/**
 * Suivre / ne plus suivre, avec bascule immédiate.
 *
 * Attendre le serveur pour un bouton « Suivre » se verrait. Un échec le remet
 * dans sa position d'avant, compteur compris.
 */
export function useToggleFollow(handle: string) {
  const queryClient = useQueryClient()
  const key = communityKeys.profile(handle)

  return useMutation({
    mutationFn: (next: boolean) =>
      next ? api.community.follow(handle) : api.community.unfollow(handle),

    onMutate: async (next) => {
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData<CommunityProfile>(key)

      queryClient.setQueryData<CommunityProfile>(key, (profile) =>
        profile
          ? {
              ...profile,
              isFollowing: next,
              followerCount: profile.followerCount + (next ? 1 : -1),
            }
          : profile,
      )

      return { previous }
    },

    onError: (_error, _next, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous)
    },

    onSuccess: (result) => {
      queryClient.setQueryData<CommunityProfile>(key, (profile) =>
        profile
          ? { ...profile, isFollowing: result.isFollowing, followerCount: result.followerCount }
          : profile,
      )
      // Mon compteur d'abonnements a bougé, et le fil « Abonnements » aussi.
      void queryClient.invalidateQueries({ queryKey: communityKeys.settings() })
      void queryClient.invalidateQueries({ queryKey: communityKeys.followingFeed() })
    },
  })
}

/**
 * Bloquer / débloquer depuis un profil.
 *
 * Sans optimisme, à la différence du suivi : bloquer rompt aussi les
 * abonnements des deux côtés, et afficher le résultat avant de le savoir
 * acquis donnerait un faux sentiment de protection.
 */
export function useToggleBlock(handle: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (next: boolean) =>
      next ? api.community.block(handle) : api.community.unblock(handle),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: communityKeys.all })
    },
  })
}

// ─── Notifications ─────────────────────────────────────────────────────────

export function useNotifications() {
  return useInfiniteQuery({
    queryKey: communityKeys.notifications(),
    queryFn: ({ pageParam }) =>
      api.community.notifications({ cursor: pageParam ?? undefined }),
    initialPageParam: null as string | null,
    getNextPageParam: (last: CommunityNotificationPage) => last.nextCursor ?? undefined,
  })
}

/**
 * Le badge de la cloche.
 *
 * Rafraîchi à chaque retour sur l'accueil plutôt que par une minuterie : un
 * compteur qui interroge le serveur en boucle coûte de la batterie pour une
 * information qui n'a rien d'urgent.
 */
export function useUnreadCount(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: communityKeys.unread(),
    queryFn: () => api.community.unreadCount(),
    enabled: options?.enabled ?? true,
  })
}

/** Tout marquer lu — à l'ouverture de l'écran des notifications. */
export function useMarkNotificationsRead() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: () => api.community.markNotificationsRead(),
    onSuccess: (result) => {
      queryClient.setQueryData(communityKeys.unread(), result)
      void queryClient.invalidateQueries({ queryKey: communityKeys.notifications() })
    },
  })
}

/** Signaler un contenu ou un compte. Idempotent côté serveur. */
export function useReport() {
  return useMutation({
    mutationFn: (input: CreateReportInput) => api.community.report(input),
  })
}

/** La carte « Autour de toi » de l'accueil. */
export function useCommunityHome(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: communityKeys.home(),
    queryFn: () => api.community.home(),
    enabled: options?.enabled ?? true,
  })
}

export function useCommunityPost(postId: string) {
  return useQuery({
    queryKey: communityKeys.post(postId),
    queryFn: () => api.community.getPost(postId),
    enabled: postId.length > 0,
  })
}

export function useCreatePost() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: CreatePostInput) => api.community.createPost(input),
    onSuccess: () => {
      // Le fil, l'accueil et le compteur du profil ont tous bougé.
      void queryClient.invalidateQueries({ queryKey: communityKeys.all })
    },
  })
}

export function useDeletePost() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (postId: string) => api.community.deletePost(postId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: communityKeys.all })
    },
  })
}

/**
 * Le cœur, avec bascule immédiate.
 *
 * Le fil est une liste paginée : la mise à jour optimiste doit parcourir les
 * pages déjà chargées pour retrouver la carte, sans quoi le compteur du fil et
 * celui du détail se contrediraient sous les yeux de l'utilisateur.
 */
export function useToggleLike() {
  const queryClient = useQueryClient()

  const patch = (postId: string, liked: boolean, delta: number) => {
    queryClient.setQueriesData<InfiniteData<CommunityFeed>>(
      { queryKey: communityKeys.all },
      (data) =>
        data?.pages
          ? {
              ...data,
              pages: data.pages.map((page) => ({
                ...page,
                items: page.items.map((post) =>
                  post.id === postId
                    ? { ...post, likedByMe: liked, likeCount: post.likeCount + delta }
                    : post,
                ),
              })),
            }
          : data,
    )

    queryClient.setQueryData<CommunityPostDetail>(communityKeys.post(postId), (post) =>
      post ? { ...post, likedByMe: liked, likeCount: post.likeCount + delta } : post,
    )
  }

  return useMutation({
    mutationFn: ({ postId, liked }: { postId: string; liked: boolean }) =>
      api.community.setLike(postId, liked),

    onMutate: async ({ postId, liked }) => {
      await queryClient.cancelQueries({ queryKey: communityKeys.post(postId) })
      patch(postId, liked, liked ? 1 : -1)
      return { postId, liked }
    },

    onError: (_error, { postId, liked }) => {
      patch(postId, !liked, liked ? -1 : 1)
    },
  })
}

export function useComments(postId: string) {
  return useInfiniteQuery({
    queryKey: communityKeys.comments(postId),
    queryFn: ({ pageParam }) =>
      api.community.listComments(postId, { cursor: pageParam ?? undefined }),
    initialPageParam: null as string | null,
    getNextPageParam: (last: CommunityCommentPage) => last.nextCursor ?? undefined,
    enabled: postId.length > 0,
  })
}

export function useAddComment(postId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: CreateCommentInput) => api.community.addComment(postId, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: communityKeys.comments(postId) })
      void queryClient.invalidateQueries({ queryKey: communityKeys.post(postId) })
    },
  })
}

export function useDeleteComment(postId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (commentId: string) => api.community.deleteComment(commentId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: communityKeys.comments(postId) })
      void queryClient.invalidateQueries({ queryKey: communityKeys.post(postId) })
    },
  })
}

// ─── Blocage ───────────────────────────────────────────────────────────────

export function useBlockedAccounts() {
  return useQuery({
    queryKey: communityKeys.blocked(),
    queryFn: () => api.community.listBlocked(),
  })
}

/**
 * Débloquer un compte, depuis la liste des comptes bloqués.
 *
 * Sans optimisme, à la différence des interrupteurs de réglages : lever une
 * protection avant de la savoir levée pour de bon donnerait une fausse
 * information sur ce que l'autre peut voir.
 */
export function useUnblock() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (handle: string) => api.community.unblock(handle),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: communityKeys.all })
    },
  })
}
