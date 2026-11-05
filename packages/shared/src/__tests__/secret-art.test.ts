import { describe, expect, it } from 'vitest'

import { SECRET_ART, SECRET_EMBLEM_SVG, secretPlancheSchema } from '../index'

// Les dessins sont rendus par le navigateur et par react-native-svg : ce que
// ce dernier ignore (paint-order, <style>, class…) ferait un dessin différent
// sur mobile, sans erreur. La palette est celle de la charte, et rien d'autre.
const PALETTE = new Set([
  '#1e5631', '#b4dd7f', '#a2cf6b', '#f6c445', '#e4b030', '#f9f7e8', '#ede9cc', '#dcefc0', '#fce7a9', '#ffffff',
])

const drawings = Object.entries({ ...SECRET_ART, ...Object.fromEntries(Object.entries(SECRET_EMBLEM_SVG).map(([k, v]) => [`emblem/${k}`, v])) })

describe('dessins des secrets', () => {
  it.each(drawings)('%s reste dans ce que les deux plateformes savent dessiner', (_key, svg) => {
    expect(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg"')).toBe(true)
    expect(svg).not.toMatch(/paint-order|<style|class=|<filter|Gradient|<use|<image|role=|aria-/)
    for (const color of svg.match(/#[0-9a-fA-F]{6}\b/g) ?? []) expect(PALETTE.has(color.toLowerCase()), color).toBe(true)
  })

  it('donne aux cases un format commun', () => {
    for (const [key, svg] of Object.entries(SECRET_ART)) {
      const box = key.endsWith('/caution') ? 'viewBox="0 0 220 130"' : 'viewBox="0 0 320 240"'
      expect(svg, key).toContain(box)
    }
  })

  it('refuse une planche qui cite un dessin absent du registre', () => {
    const planche = { panels: [{ art: 'eau-cuisson/1', caption: 'Garde l’eau de cuisson.' }] }
    expect(secretPlancheSchema.safeParse(planche).success).toBe(true)
    expect(secretPlancheSchema.safeParse({ panels: [{ art: 'inconnu/1', caption: 'Une case.' }] }).success).toBe(false)
  })

  it('exige que le passage en gras figure dans la légende', () => {
    const base = { art: 'eau-cuisson/1', caption: 'Garde l’eau, sans sel ni matière grasse.' }
    expect(secretPlancheSchema.safeParse({ panels: [{ ...base, emphasis: 'sans sel ni matière grasse' }] }).success).toBe(true)
    expect(secretPlancheSchema.safeParse({ panels: [{ ...base, emphasis: 'avec du sel' }] }).success).toBe(false)
  })
})
