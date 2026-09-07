import { describe, expect, it } from 'vitest'

import { findBlockedTerm } from '../constants/moderation'

// La liste noire est un filet, pas un rempart : ce qui compte, c'est qu'elle
// n'attrape pas le vocabulaire du jardin.

describe('findBlockedTerm', () => {
  it('laisse passer un texte ordinaire', () => {
    expect(findBlockedTerm('Mon monstera a doublé de taille cet été 🌿')).toBeNull()
  })

  it('attrape une insulte, quelle que soit la casse ou les accents', () => {
    expect(findBlockedTerm('espèce de CONNARD')).toBe('connard')
    expect(findBlockedTerm('sale énculé')).not.toBeNull()
  })

  it('attrape une expression à plusieurs mots', () => {
    expect(findBlockedTerm('ta   gueule')).toBe('ta gueule')
  })

  it('attrape une sollicitation commerciale évidente', () => {
    expect(findBlockedTerm('paiement en bitcoin uniquement')).toBe('bitcoin')
  })

  it('ne bloque pas un mot qui en contient un autre', () => {
    // « pute » dans « réputé » et « dispute » : c'est le faux positif qui
    // ferait rejeter une annonce parfaitement honnête.
    expect(findBlockedTerm('Une variété très réputée dans la région')).toBeNull()
    expect(findBlockedTerm('sans dispute, on s’arrange')).toBeNull()
  })

  it('ne censure pas une opinion négative', () => {
    // Dire qu'un terreau est mauvais est un avis ; la modération n'est pas là
    // pour le faire taire.
    expect(findBlockedTerm('Ce terreau est vraiment mauvais, à éviter')).toBeNull()
  })

  it('laisse passer les cucurbitacées', () => {
    expect(findBlockedTerm('J’ai semé des cucurbites et des courges')).toBeNull()
  })

  it('rend null sur une chaîne vide', () => {
    expect(findBlockedTerm('   ')).toBeNull()
  })
})
