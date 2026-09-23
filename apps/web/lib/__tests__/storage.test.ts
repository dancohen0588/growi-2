import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ServiceError } from '@/lib/services/errors'
import {
  deleteCoverByUrl,
  deletePhotoByUrl,
  deletePhotosByUrl,
  deleteUserFolder,
  pathFromUrl,
  publicUrl,
  uploadCover,
  uploadPhoto,
} from '@/lib/storage'

// Le stockage est la seule porte par laquelle un fichier entre dans Growi :
// ce qu'elle refuse compte autant que ce qu'elle accepte.

const SUPABASE_URL = 'https://projet.supabase.co'
const PUBLIC_PREFIX = `${SUPABASE_URL}/storage/v1/object/public/plant-photos/`

const USER = 'user_1'

/** Octets d'un JPEG valide : seule la signature est lue. */
function jpeg(size = 64): ArrayBuffer {
  const bytes = new Uint8Array(size)
  bytes.set([0xff, 0xd8, 0xff])
  return bytes.buffer
}

function png(): ArrayBuffer {
  const bytes = new Uint8Array(32)
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  return bytes.buffer
}

let fetchMock: ReturnType<typeof vi.fn>

beforeEach(() => {
  vi.stubEnv('SUPABASE_URL', SUPABASE_URL)
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service-role-key')

  fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 200 }))
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe('uploadPhoto', () => {
  it('range la photo sous l\'identifiant de son propriétaire', async () => {
    const result = await uploadPhoto(USER, 'plant', {
      bytes: jpeg(),
      contentType: 'image/jpeg',
    })

    expect(result.path).toMatch(/^users\/user_1\/plant\/[0-9a-f-]{36}\.jpg$/)
    expect(result.url).toBe(`${PUBLIC_PREFIX}${result.path}`)

    // Le chemin est choisi par le serveur, et n'écrase jamais rien.
    const [, init] = fetchMock.mock.calls[0]
    expect(init.method).toBe('POST')
    expect(init.headers['x-upsert']).toBe('false')
  })

  it('déduit l\'extension du contenu réel, pas du type annoncé', async () => {
    const result = await uploadPhoto(USER, 'plant', {
      bytes: png(),
      // Le client annonce du JPEG : les octets disent PNG, ils font foi.
      contentType: 'image/jpeg',
    })

    expect(result.path.endsWith('.png')).toBe(true)
  })

  it('refuse un fichier qui n\'est pas une image, même bien étiqueté', async () => {
    const notAnImage = new TextEncoder().encode('#!/bin/sh\nrm -rf /\n')

    await expect(
      uploadPhoto(USER, 'plant', { bytes: notAnImage.buffer, contentType: 'image/jpeg' }),
    ).rejects.toThrow(ServiceError)

    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('refuse au-delà de 5 Mo et refuse le vide', async () => {
    await expect(
      uploadPhoto(USER, 'plant', { bytes: jpeg(6 * 1024 * 1024), contentType: 'image/jpeg' }),
    ).rejects.toThrow(/5 Mo/)

    await expect(
      uploadPhoto(USER, 'plant', { bytes: new ArrayBuffer(0), contentType: 'image/jpeg' }),
    ).rejects.toThrow(/vide/)

    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('traduit un refus du stockage en indisponibilité', async () => {
    fetchMock.mockResolvedValue(new Response('quota exceeded', { status: 507 }))
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

    await expect(
      uploadPhoto(USER, 'plant', { bytes: jpeg(), contentType: 'image/jpeg' }),
    ).rejects.toMatchObject({ code: 'UNAVAILABLE' })

    consoleError.mockRestore()
  })
})

describe('pathFromUrl', () => {
  it('reconnaît nos URL et ignore celles des autres', () => {
    expect(pathFromUrl(`${PUBLIC_PREFIX}users/u/plant/a.jpg`)).toBe('users/u/plant/a.jpg')

    // Une photo du catalogue ne nous appartient pas : ne jamais la supprimer.
    expect(pathFromUrl('https://inaturalist-open-data.s3.amazonaws.com/photos/1/medium.jpg'))
      .toBeNull()
    expect(pathFromUrl(null)).toBeNull()
    expect(pathFromUrl(undefined)).toBeNull()
  })

  it('compose une URL publique à partir d\'un chemin', () => {
    expect(publicUrl('users/u/plant/a.jpg')).toBe(`${PUBLIC_PREFIX}users/u/plant/a.jpg`)
  })
})

describe('deletePhotoByUrl', () => {
  it('ne touche pas à une URL étrangère', async () => {
    await deletePhotoByUrl('https://upload.wikimedia.org/photo.jpg')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('n\'échoue jamais : un orphelin vaut mieux qu\'une suppression bloquée', async () => {
    fetchMock.mockRejectedValue(new Error('réseau coupé'))
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

    await expect(
      deletePhotoByUrl(`${PUBLIC_PREFIX}users/u/plant/a.jpg`),
    ).resolves.toBeUndefined()

    consoleError.mockRestore()
  })
})

describe('couvertures du blog', () => {
  const COVERS_PREFIX = `${SUPABASE_URL}/storage/v1/object/public/blog-covers/`

  it('dépose le JPEG sous le slug, dans son propre bucket', async () => {
    const result = await uploadCover('pailler-ses-massifs', new Uint8Array(jpeg()))

    expect(result.path).toMatch(/^pailler-ses-massifs\/cover-\d+\.jpg$/)
    expect(result.url).toBe(`${COVERS_PREFIX}${result.path}`)

    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toContain('/storage/v1/object/blog-covers/')
    expect(init.headers['x-upsert']).toBe('false')
  })

  it('refuse un slug qui sortirait du dossier, et ce qui n\'est pas un JPEG', async () => {
    await expect(uploadCover('../users/u', new Uint8Array(jpeg()))).rejects.toThrow(ServiceError)
    await expect(uploadCover('pailler', new Uint8Array(png()))).rejects.toThrow(/JPEG/)

    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('ne supprime jamais une photo d\'utilisateur par ce biais', async () => {
    await deleteCoverByUrl(`${PUBLIC_PREFIX}users/u/plant/a.jpg`)
    expect(fetchMock).not.toHaveBeenCalled()

    await deleteCoverByUrl(`${COVERS_PREFIX}pailler/cover-1.jpg`)
    expect(fetchMock.mock.calls[0][0]).toContain('/storage/v1/object/blog-covers/pailler/cover-1.jpg')
  })
})

// ─── Suppression de compte ─────────────────────────────────────────────────

describe('deleteUserFolder', () => {
  /** Réponse de l'API de liste : un dossier a un `id` nul, un fichier non. */
  function listing(entries: Array<{ name: string; folder?: boolean }>) {
    return new Response(
      JSON.stringify(entries.map((e) => ({ name: e.name, id: e.folder ? null : `id-${e.name}` }))),
      { status: 200 },
    )
  }

  it('descend dans les sous-dossiers et supprime tout en un appel groupé', async () => {
    fetchMock
      .mockResolvedValueOnce(listing([{ name: 'plant', folder: true }, { name: 'chat', folder: true }]))
      .mockResolvedValueOnce(listing([{ name: 'a.jpg' }, { name: 'b.jpg' }]))
      .mockResolvedValueOnce(listing([{ name: 'c.webp' }]))
      .mockResolvedValueOnce(new Response(null, { status: 200 }))

    expect(await deleteUserFolder(USER)).toBe(0)

    const [listUrl, listInit] = fetchMock.mock.calls[0]
    expect(listUrl).toBe(`${SUPABASE_URL}/storage/v1/object/list/plant-photos`)
    expect(JSON.parse(listInit.body).prefix).toBe(`users/${USER}/`)

    const [deleteUrl, deleteInit] = fetchMock.mock.calls[3]
    expect(deleteUrl).toBe(`${SUPABASE_URL}/storage/v1/object/plant-photos`)
    expect(deleteInit.method).toBe('DELETE')
    expect(JSON.parse(deleteInit.body).prefixes).toEqual([
      `users/${USER}/plant/a.jpg`,
      `users/${USER}/plant/b.jpg`,
      `users/${USER}/chat/c.webp`,
    ])
  })

  it("ne lève pas quand la liste échoue : le compte est déjà supprimé", async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 500 }))

    await expect(deleteUserFolder(USER)).resolves.toBe(-1)
  })

  it("n'appelle pas la suppression pour un dossier vide", async () => {
    fetchMock.mockResolvedValueOnce(listing([]))

    expect(await deleteUserFolder(USER)).toBe(0)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})

describe('deletePhotosByUrl', () => {
  it('ne supprime que nos propres photos, jamais une URL étrangère', async () => {
    await deletePhotosByUrl([
      `${PUBLIC_PREFIX}users/autre/chat/x.jpg`,
      'https://ailleurs.example/photo.jpg',
      null,
    ])

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).prefixes).toEqual([
      'users/autre/chat/x.jpg',
    ])
  })
})
