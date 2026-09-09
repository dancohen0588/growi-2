import { describe, expect, it, vi } from 'vitest'

import { createNoopEmitter, createSafeEmitter, type Emitter } from '../analytics/emitter'
import {
  COMMON_PROPS_KEYS,
  MAX_PROP_LENGTH,
  assertNoFreeText,
  type GrowiEvent,
} from '../analytics/events'

/**
 * Un échantillon représentatif du catalogue : un événement de chaque famille,
 * avec les valeurs les plus longues qu'on puisse réellement rencontrer (un
 * slug d'article, un nom de modèle, une liste d'outils).
 */
const SAMPLE: GrowiEvent[] = [
  { name: 'signup_completed', props: { method: 'apple' } },
  { name: 'onboarding_completed', props: { duration_s: 96, skipped: false } },
  { name: 'garden_created', props: { has_location: true, from_cadastre: true, zones_count: 4 } },
  { name: 'plant_added', props: { source: 'identify', garden_id: 'clx1', plants_total: 12 } },
  {
    name: 'identify_completed',
    props: {
      model: 'gemini-2.5-flash-lite',
      latency_ms: 4200,
      input_tokens: 1200,
      output_tokens: 300,
      image_bytes: 850_000,
      candidates_count: 3,
      top_confidence: 0.82,
      quota_remaining: 4,
    },
  },
  { name: 'identify_result_accepted', props: { rank: 2 } },
  {
    name: 'diagnosis_completed',
    props: {
      model: 'gemini-2.5-flash',
      latency_ms: 11_500,
      input_tokens: 2100,
      output_tokens: 640,
      severity: 'WARNING',
      actions_proposed: 3,
    },
  },
  { name: 'planning_viewed', props: { horizon: 'today', actions_today: 5 } },
  {
    name: 'planning_action_done',
    props: { type: 'watering', bulk: true, count: 4, overdue_days: 2 },
  },
  {
    name: 'assistant_reply_completed',
    props: {
      model: 'gemini-2.5-flash',
      latency_ms: 3100,
      input_tokens: 900,
      output_tokens: 240,
      tools_called: ['proposePlanTask', 'proposeMarkDone'],
      truncated: false,
    },
  },
  { name: 'listing_published', props: { kind: 'swap' } },
  { name: 'content_reported', props: { reason: 'spam' } },
  { name: 'push_sent', props: { kind: 'planning', tokens_count: 87 } },
  {
    name: 'article_viewed',
    props: { slug: 'rentrer-ses-plantes-avant-les-premieres-fraiches', from: 'home' },
  },
]

describe('catalogue', () => {
  it("aucun événement de l'échantillon ne porte de texte libre", () => {
    for (const event of SAMPLE) {
      expect(() => assertNoFreeText(event.props, event.name)).not.toThrow()
    }
  })

  it('refuse une propriété qui ressemble à une phrase saisie', () => {
    expect(() =>
      assertNoFreeText(
        { message: 'Mon citronnier perd ses feuilles depuis deux semaines, que faire ?' },
        'assistant_message_sent',
      ),
    ).toThrow(/texte saisi/)
  })

  it('inspecte aussi les valeurs des tableaux', () => {
    expect(() => assertNoFreeText({ tools_called: ['a'.repeat(MAX_PROP_LENGTH + 1)] })).toThrow()
  })

  it("nomme l'événement et la propriété fautive", () => {
    expect(() => assertNoFreeText({ bio: 'x'.repeat(200) }, 'post_published')).toThrow(
      /post_published\.bio/,
    )
  })

  it('déclare les quatre propriétés communes', () => {
    expect([...COMMON_PROPS_KEYS]).toEqual(['surface', 'app_version', 'platform', 'environment'])
  })
})

describe('émetteurs', () => {
  it("l'émetteur muet accepte tout sans rien faire", () => {
    const emitter = createNoopEmitter()
    expect(() => {
      emitter.track('post_liked', {})
      emitter.identify('clx1')
      emitter.setPersonProperties({ plants_count: 3 })
      emitter.reset()
    }).not.toThrow()
  })

  it("une défaillance du SDK ne remonte jamais à l'appelant", () => {
    const boom = () => {
      throw new Error('SDK cassé')
    }
    const broken: Emitter = {
      track: boom,
      identify: boom,
      reset: boom,
      setPersonProperties: boom,
      optOut: boom,
      optIn: boom,
    }
    // Ce paquet ne suppose ni le navigateur ni Node : `console` n'est pas
    // dans ses typages, on le prend sur l'objet global comme le fait
    // `createSafeEmitter`.
    const globalConsole = (globalThis as unknown as { console: { warn: () => void } }).console
    vi.spyOn(globalConsole, 'warn').mockImplementation(() => {})

    const safe = createSafeEmitter(broken)

    // Un `track` posé dans un `onPress` ne doit pas pouvoir empêcher le geste
    // qu'il mesure.
    expect(() => safe.track('post_liked', {})).not.toThrow()
    expect(() => safe.identify('clx1')).not.toThrow()
    expect(() => safe.optOut()).not.toThrow()
  })

  it('transmet nom et propriétés tels quels', () => {
    const track = vi.fn()
    const safe = createSafeEmitter({ ...createNoopEmitter(), track })

    safe.track('identify_result_accepted', { rank: 1 })

    expect(track).toHaveBeenCalledWith('identify_result_accepted', { rank: 1 })
  })
})
