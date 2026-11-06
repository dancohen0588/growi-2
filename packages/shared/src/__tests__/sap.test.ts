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
  SAP_RULE_DISPLAY,
  SAP_HOME_THEMES,
  SAP_THEME_RINGS,
  sapRingReward,
  sapRingRewardPromise,
  sapRewardPendingLine,
  sapRewardUnlockedLine,
  formatSapAmount,
  sapEntryLabel,
  sapFormingLine,
  sapGainsLabel,
  sapRingsLabel,
  sapRingsLine,
  SAP_RULES,
  sapRingName,
  sapRingOrdinal,
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
    const summary = { total: 340, rings: sapRings(340), giftsLeft: 3, giftsPerWeek: 3, recent: [], rewards: [], homeTheme: null }
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

describe('affichage du barème', () => {
  it('décrit chaque type de gain', () => {
    expect(Object.keys(SAP_RULE_DISPLAY).sort()).toEqual([...SAP_KINDS].sort())
  })

  it('cite les plafonds que le serveur applique', () => {
    for (const kind of SAP_KINDS) {
      const cap = SAP_RULES[kind].dailyCap
      const hint = SAP_RULE_DISPLAY[kind].hint ?? ''
      const cited = hint.match(/^(\d+) par jour/)
      if (cited) expect(Number(cited[1])).toBe(cap)
      if (/une par jour/i.test(hint)) expect(cap).toBe(1)
    }
  })

  it('nomme les cernes', () => {
    expect(sapRingName(1)).toBe('Premier cerne')
    expect(sapRingName(4)).toBe('Quatrième cerne')
    expect(sapRingName(11)).toBe('11ᵉ cerne')
    expect(sapRingOrdinal(1)).toBe('1ᵉʳ')
    expect(sapRingOrdinal(4)).toBe('4ᵉ')
  })
})

describe('phrases de la sève', () => {
  const rings = sapRings(340)

  it('dit où en est le tronc', () => {
    expect(sapFormingLine(rings)).toBe('Ton 4ᵉ cerne se forme · encore 160')
    expect(sapRingsLine(rings)).toBe('3 cernes · ton 4ᵉ se forme')
    expect(sapRingsLabel(rings)).toBe('Coupe de ton tronc : 3 cernes formés, le 4ᵉ à 20 %')
    expect(sapRingsLine(sapRings(0))).toBe('Ton 1ᵉʳ cerne se forme')
  })

  it('nomme un gain, et en regroupe plusieurs', () => {
    expect(sapEntryLabel({ kind: 'care', label: 'Arrosage' })).toBe('Arrosage')
    expect(sapEntryLabel({ kind: 'care', label: '  ' })).toBe(SAP_KIND_LABELS.care)
    expect(sapGainsLabel([{ kind: 'care' }, { kind: 'care' }])).toBe(`${SAP_KIND_LABELS.care} ×2`)
    expect(sapGainsLabel([{ kind: 'care' }, { kind: 'post' }])).toBe('Merci pour tes gestes')
    expect(formatSapAmount(2)).toBe('+2')
  })
})

describe('récompenses des cernes', () => {
  it('donne un thème aux cernes 2, 4 et 6, un secret partout ailleurs', () => {
    expect(sapRingReward(1)).toEqual({ kind: 'secret' })
    expect(sapRingReward(2)).toEqual({ kind: 'theme', theme: 'sous-bois' })
    expect(sapRingReward(4)).toEqual({ kind: 'theme', theme: 'prairie' })
    expect(sapRingReward(6)).toEqual({ kind: 'theme', theme: 'crepuscule' })
    expect(sapRingReward(7)).toEqual({ kind: 'secret' })
    expect(sapRingReward(40)).toEqual({ kind: 'secret' })
  })

  it('un cerne par thème, jamais deux thèmes au même', () => {
    const rings = SAP_HOME_THEMES.map((theme) => SAP_THEME_RINGS[theme])
    expect(new Set(rings).size).toBe(rings.length)
  })

  it('dit ce qu’un cerne a donné', () => {
    expect(sapRewardUnlockedLine({ kind: 'theme', value: 'sous-bois', title: 'Sous-bois' })).toBe(
      'Débloqué : le thème d’Accueil « Sous-bois »',
    )
    expect(sapRewardUnlockedLine({ kind: 'secret', value: 'cendres', title: 'Les cendres' })).toBe(
      'Débloqué : « Les cendres » en avant-première',
    )
    expect(sapRewardUnlockedLine({ kind: 'secret', value: null })).toBe('Ton grimoire était déjà complet')
    expect(sapRewardPendingLine(4)).toBe('À débloquer : le thème d’Accueil « Prairie »')
  })

  it('annonce ce qui vient', () => {
    expect(sapRingRewardPromise(1)).toBe('un Secret en avant-première')
    expect(sapRingRewardPromise(2)).toBe('le thème d’Accueil « Sous-bois »')
  })

  it('un résumé sans récompenses (serveur antérieur) se lit comme une liste vide', () => {
    const parsed = sapSummarySchema.parse({
      total: 0,
      rings: sapRings(0),
      giftsLeft: 3,
      giftsPerWeek: 3,
      recent: [],
    })
    expect(parsed.rewards).toEqual([])
  })
})

describe('dessin des thèmes d’Accueil', () => {
  it('est déterministe et reste dans le bloc', async () => {
    const { sapThemeArt } = await import('../sap/themes')
    for (const theme of SAP_HOME_THEMES) {
      const first = sapThemeArt(theme, 390, 470)
      expect(sapThemeArt(theme, 390, 470)).toEqual(first)
      expect(first.shapes.length).toBeGreaterThan(5)
      for (const shape of first.shapes) {
        if (shape.kind === 'circle') {
          expect(shape.cx).toBeGreaterThanOrEqual(-20)
          expect(shape.cx).toBeLessThanOrEqual(410)
        }
        expect(Number.isFinite(shape.kind === 'circle' ? shape.r : shape.fillOpacity)).toBe(true)
      }
    }
  })

  it('rien à dessiner dans un bloc sans taille', async () => {
    const { sapThemeArt } = await import('../sap/themes')
    expect(sapThemeArt('prairie', 0, 0).shapes).toEqual([])
  })
})
