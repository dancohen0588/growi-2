import { describe, expect, it } from 'vitest'

import { isIdSegment, normalizeApiPath, normalizeUrl } from '../observability/routes'
import { scrubEvent } from '../observability/scrub'

describe('scrubEvent', () => {
  it("retire le cookie et l'autorisation des en-têtes", () => {
    const event = scrubEvent({
      request: {
        headers: {
          cookie: 'session=secret',
          Authorization: 'Bearer eyJ…',
          'user-agent': 'Growi/1.0',
        },
      },
    })

    expect(event.request?.headers).toEqual({ 'user-agent': 'Growi/1.0' })
  })

  it('remplace la photo du corps de requête par un marqueur', () => {
    const event = scrubEvent({
      request: { data: { imageBase64: 'data:image/jpeg;base64,AAAA', gardenId: 'g1' } },
    })

    expect(event.request?.data).toEqual({ imageBase64: '[image]', gardenId: 'g1' })
  })

  it("écarte un corps sérialisé qui contient l'image", () => {
    const event = scrubEvent({ request: { data: '{"imageBase64":"data:image/jpeg;base64,AAAA"}' } })
    expect(event.request?.data).toBe('[image]')
  })

  it('filtre e-mail, mot de passe et jetons, à toute profondeur', () => {
    const event = scrubEvent({
      extra: {
        email: 'jardinier@exemple.fr',
        payload: { passwordHash: '$2a$…', accessToken: 'eyJ…', plantsCount: 3 },
      },
      contexts: { compte: { user_email: 'jardinier@exemple.fr', plan: 'FREE' } },
    })

    expect(event.extra).toEqual({
      email: '[filtré]',
      payload: { passwordHash: '[filtré]', accessToken: '[filtré]', plantsCount: 3 },
    })
    expect(event.contexts).toEqual({ compte: { user_email: '[filtré]', plan: 'FREE' } })
  })

  it('laisse passer un événement sans rien de sensible', () => {
    const event = scrubEvent({ extra: { route: '/api/v1/plants/[id]', plantsCount: 12 } })
    expect(event.extra).toEqual({ route: '/api/v1/plants/[id]', plantsCount: 12 })
  })

  it('survit à une structure cyclique', () => {
    const cyclic: Record<string, unknown> = { name: 'boucle' }
    cyclic.self = cyclic

    expect(() => scrubEvent({ extra: { cyclic } })).not.toThrow()
  })
})

describe('isIdSegment', () => {
  it('reconnaît un cuid, un UUID et un nombre', () => {
    expect(isIdSegment('clx8f2k9a0001qw3x7m2p8z1v')).toBe(true)
    expect(isIdSegment('3f2504e0-4f89-11d3-9a0c-0305e82c3301')).toBe(true)
    expect(isIdSegment('42')).toBe(true)
  })

  it("laisse tranquille ce qui nomme une route ou un contenu", () => {
    // Le slug d'un article dit *quel* article a été lu : c'est la mesure
    // qu'on cherche, pas du bruit à masquer.
    expect(isIdSegment('arroser-en-ete')).toBe(false)
    expect(isIdSegment('plants')).toBe(false)
    expect(isIdSegment('communaute')).toBe(false)
  })
})

describe('normalizeApiPath', () => {
  it('remplace les identifiants par un segment stable', () => {
    expect(normalizeApiPath('/api/v1/plants/clx8f2k9a0001qw3x7m2p8z1v/logs')).toBe(
      '/api/v1/plants/[id]/logs',
    )
  })

  it('écarte la chaîne de requête', () => {
    expect(normalizeApiPath('/api/v1/community/feed?scope=nearby&cursor=abc')).toBe(
      '/api/v1/community/feed',
    )
  })

  it('rend inchangé un chemin sans identifiant', () => {
    expect(normalizeApiPath('/api/v1/planning/today')).toBe('/api/v1/planning/today')
  })
})

describe('normalizeUrl', () => {
  it("garde l'hôte, pour distinguer notre API d'un tiers", () => {
    expect(normalizeUrl('https://growi-garden.fr/api/v1/plants/clx8f2k9a0001qw3x7m2p8z1v')).toBe(
      'https://growi-garden.fr/api/v1/plants/[id]',
    )
  })

  it("traite ce qui n'est pas une URL comme un chemin", () => {
    expect(normalizeUrl('/api/v1/gardens/42')).toBe('/api/v1/gardens/[id]')
  })
})
