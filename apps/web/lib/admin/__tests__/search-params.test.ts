import { describe, expect, it } from 'vitest'

import {
  buildQuery,
  encodeCursor,
  readBoolean,
  readCursor,
  readDate,
  readString,
  readUserFilters,
} from '../search-params'

/**
 * Ces lectures encaissent n'importe quelle URL : un paramètre absurde vaut
 * « pas de filtre », jamais une erreur. Une URL tronquée dans un message ne
 * doit pas donner un écran rouge.
 */

describe('lectures élémentaires', () => {
  it('prend la première valeur d’un paramètre répété', () => {
    expect(readString({ q: ['un', 'deux'] }, 'q')).toBe('un')
  })

  it('traite une valeur blanche comme absente', () => {
    expect(readString({ q: '   ' }, 'q')).toBeUndefined()
    expect(readString({}, 'q')).toBeUndefined()
  })

  it('ne lit que des booléens explicites', () => {
    expect(readBoolean({ x: '1' }, 'x')).toBe(true)
    expect(readBoolean({ x: 'true' }, 'x')).toBe(true)
    expect(readBoolean({ x: '0' }, 'x')).toBe(false)
    expect(readBoolean({ x: 'peut-être' }, 'x')).toBeUndefined()
    expect(readBoolean({}, 'x')).toBeUndefined()
  })

  it('ignore une date invalide plutôt que de la propager', () => {
    expect(readDate({ d: '2026-09-04' }, 'd')?.toISOString()).toBe('2026-09-04T00:00:00.000Z')
    expect(readDate({ d: 'hier' }, 'd')).toBeUndefined()
  })
})

describe('curseur', () => {
  it('fait l’aller-retour', () => {
    const cursor = { createdAt: new Date('2026-09-04T10:00:00.000Z'), id: 'user_1' }
    expect(readCursor({ apres: encodeCursor(cursor) })).toEqual(cursor)
  })

  it('accepte un id contenant le séparateur', () => {
    // On coupe à la **première** barre : l'identifiant peut en contenir.
    const cursor = { createdAt: new Date('2026-09-04T10:00:00.000Z'), id: 'a|b' }
    expect(readCursor({ apres: encodeCursor(cursor) })).toEqual(cursor)
  })

  it('rejette un curseur malformé sans lever', () => {
    expect(readCursor({ apres: 'nimportequoi' })).toBeNull()
    expect(readCursor({ apres: '|user_1' })).toBeNull()
    expect(readCursor({ apres: '2026-09-04T10:00:00.000Z|' })).toBeNull()
    expect(readCursor({ apres: 'pas-une-date|user_1' })).toBeNull()
    expect(readCursor({})).toBeNull()
  })
})

describe('readUserFilters', () => {
  it('ne retient qu’un rôle du domaine', () => {
    expect(readUserFilters({ role: 'ADMIN' }).role).toBe('ADMIN')
    expect(readUserFilters({ role: 'SUPERADMIN' }).role).toBeUndefined()
    expect(readUserFilters({ role: 'admin' }).role).toBeUndefined()
  })

  it('lit tous les filtres de l’URL', () => {
    const filters = readUserFilters({
      q: 'dupont',
      plan: 'PREMIUM',
      onboarde: '1',
      desactive: '0',
      inactif_depuis: '2026-08-01',
    })

    expect(filters.search).toBe('dupont')
    expect(filters.plan).toBe('PREMIUM')
    expect(filters.onboarded).toBe(true)
    expect(filters.disabled).toBe(false)
    expect(filters.inactiveSince?.toISOString()).toBe('2026-08-01T00:00:00.000Z')
  })
})

describe('buildQuery', () => {
  it('conserve les paramètres existants', () => {
    expect(buildQuery({ q: 'dupont', role: 'ADMIN' }, {})).toContain('q=dupont')
  })

  it('retire une clé passée à undefined', () => {
    // C'est ainsi qu'un changement de filtre remet la pagination à zéro.
    expect(buildQuery({ q: 'dupont', apres: 'x|y' }, { apres: undefined })).toBe('?q=dupont')
  })

  it('écrase une clé existante', () => {
    expect(buildQuery({ apres: 'ancien' }, { apres: 'nouveau' })).toBe('?apres=nouveau')
  })

  it('renvoie une chaîne vide quand il ne reste rien', () => {
    expect(buildQuery({ apres: 'x' }, { apres: undefined })).toBe('')
  })

  it('laisse tomber les valeurs vides existantes', () => {
    // Un `<select>` non renseigné poste `role=` : le garder ferait une URL
    // pleine de clés inutiles.
    expect(buildQuery({ q: 'a', role: '' }, {})).toBe('?q=a')
  })
})
