import { useMutation } from '@tanstack/react-query'
import type { PhotoKind } from '@growi/shared'

import { api } from '@/lib/api'
import type { Photo } from '@/lib/photo'

/**
 * Dépose une photo et renvoie son URL.
 *
 * L'envoi et le rattachement restent deux gestes : c'est l'appelant qui écrit
 * ensuite l'URL sur la plante ou sur le geste concerné.
 */
export function useUploadPhoto() {
  return useMutation({
    mutationFn: ({ photo, kind }: { photo: Photo; kind?: PhotoKind }) =>
      api.uploads.photo({ uri: photo.uri, name: photo.name, type: photo.type }, kind ?? 'plant'),
    retry: false,
  })
}
