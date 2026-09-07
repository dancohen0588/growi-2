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
  CommunityPostDetail,
  CreateCommentInput,
  CreatePostInput,
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
      api.community.feed({ radiusKm, cursor: pageParam ?? undefined }),
    initialPageParam: null as string | null,
    getNextPageParam: (last: CommunityFeed) => last.nextCursor ?? undefined,
    enabled: options?.enabled ?? true,
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
