import { describe, expect, it } from 'vitest'

import {
  SAP_GIFT_MESSAGE_MAX_LENGTH,
  SAP_GIFT_REASON_LABELS,
  SAP_GIFT_REASON_PHRASES,
  SAP_GIFT_REASONS,
  SAP_KIND_LABELS,
  SAP_KINDS,
  SAP_RING_STEP_AFTER,
  SAP_RING_THRESHOLDS,
  SAP_RULES,
  sapRings,
  sapRingThreshold,
} from '../constants/sap'
import { giveSapDropSchema, sapSummarySchema } from '../schemas/sap'

describe('barème de la sève', () => {
  it('chaque type a sa règle et son libellé', () => {
    for (const kind of SAP_KINDS) {
      expect(SAP_RULES[kind].amount).toBeGreaterThan(0)
      expect(SAP_KIND_LABELS[kind]).toBeTruthy()
    }
  })

  it('un plafond, quand il existe, est un entier positif', () => {
    for (const kind of SAP_KINDS) {
      const cap = SAP_RULES[kind].dailyCap
      if (cap !== null) expect(Number.isInteger(cap) && cap > 0).toBe(true)
    }
  })

  it('partager rapporte plus que l’usage solo', () => {
    expect(SAP_RULES.secret_feedback.amount).toBeGreaterThan(SAP_RULES.care.amount)
    expect(SAP_RULES.listing_done.amount).toBeGreaterThan(SAP_RULES.post.amount)
  })

  it('chaque motif d’une goutte a sa pastille et sa phrase', () => {
    for (const reason of SAP_GIFT_REASONS) {
      expect(SAP_GIFT_REASON_LABELS[reason]).toBeTruthy()
      expect(SAP_GIFT_REASON_PHRASES[reason]).toMatch(/^pour /)
    }
  })
})

describe('sapRingThreshold', () => {
  it('suit la liste, puis avance d’un pas fixe', () => {
    expect(sapRingThreshold(0)).toBe(0)
    expect(sapRingThreshold(1)).toBe(50)
    expect(sapRingThreshold(4)).toBe(500)
    const last = SAP_RING_THRESHOLDS[SAP_RING_THRESHOLDS.length - 1]
    expect(sapRingThreshold(SAP_RING_THRESHOLDS.length)).toBe(last)
    expect(sapRingThreshold(SAP_RING_THRESHOLDS.length + 2)).toBe(last + 2 * SAP_RING_STEP_AFTER)
  })

  it('est strictement croissante', () => {
    for (let n = 1; n < 20; n++) expect(sapRingThreshold(n + 1)).toBeGreaterThan(sapRingThreshold(n))
  })
})

describe('sapRings', () => {
  it('avant le premier cerne', () => {
    expect(sapRings(0)).toEqual({ count: 0, floor: 0, next: 50, progress: 0, remaining: 50 })
  })

  it('reprend l’exemple des maquettes : 340 de sève, le 4ᵉ cerne à 20 %', () => {
    const rings = sapRings(340)
    expect(rings.count).toBe(3)
    expect(rings.floor).toBe(300)
    expect(rings.next).toBe(500)
    expect(rings.progress).toBeCloseTo(0.2)
    expect(rings.remaining).toBe(160)
  })

  it('un seuil atteint forme le cerne', () => {
    expect(sapRings(500)).toMatchObject({ count: 4, floor: 500, next: 800, progress: 0 })
    expect(sapRings(499).count).toBe(3)
  })

  it('va au-delà de la liste des seuils', () => {
    const rings = sapRings(5500)
    expect(rings.count).toBe(SAP_RING_THRESHOLDS.length + 1)
    expect(rings.floor).toBe(5000)
    expect(rings.next).toBe(6000)
    expect(rings.progress).toBeCloseTo(0.5)
  })

  it('ne lève jamais sur une valeur absurde', () => {
    expect(sapRings(-12).count).toBe(0)
    expect(sapRings(Number.NaN).count).toBe(0)
    expect(sapRings(12.9).remaining).toBe(38)
  })

  it('le résultat passe le schéma du résumé', () => {
    const summary = { total: 340, rings: sapRings(340), giftsLeft: 3, giftsPerWeek: 3, recent: [] }
    expect(sapSummarySchema.parse(summary)).toEqual(summary)
  })
})

describe('giveSapDropSchema', () => {
  it('normalise le pseudo comme le reste de la Communauté', () => {
    const input = giveSapDropSchema.parse({ handle: '  Camille_Jardine ', reason: 'bouture' })
    expect(input.handle).toBe('camille_jardine')
  })

  it('refuse un motif inconnu et un mot trop long', () => {
    expect(giveSapDropSchema.safeParse({ handle: 'camille', reason: 'argent' }).success).toBe(false)
    expect(
      giveSapDropSchema.safeParse({
        handle: 'camille',
        reason: 'conseil',
        message: 'a'.repeat(SAP_GIFT_MESSAGE_MAX_LENGTH + 1),
      }).success,
    ).toBe(false)
  })

  it('le mot et la publication sont facultatifs', () => {
    expect(giveSapDropSchema.safeParse({ handle: 'camille', reason: 'aide', message: null }).success).toBe(true)
  })
})
