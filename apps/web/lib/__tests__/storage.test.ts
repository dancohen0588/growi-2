import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ServiceError } from '@/lib/services/errors'
import { deletePhotoByUrl, pathFromUrl, publicUrl, uploadPhoto } from '@/lib/storage'

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
