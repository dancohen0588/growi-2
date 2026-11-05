import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { SECRET_EMBLEM_SVG } from '@growi/shared'

import { SecretArt } from '../SecretArt'
import { SecretEmblem } from '../SecretEmblem'
import { SecretPlanche } from '../SecretPlanche'

describe('SecretArt', () => {
  it('ne rend rien pour une clé hors du registre — jamais un balisage venu d’ailleurs', () => {
    expect(renderToStaticMarkup(<SecretArt artKey="<svg onload=alert(1)>" alt="x" />)).toBe('')
    expect(renderToStaticMarkup(<SecretArt artKey="inconnu/1" alt="x" />)).toBe('')
  })

  it('nomme le dessin par sa légende, ou le cache quand il est décoratif', () => {
    const named = renderToStaticMarkup(<SecretArt artKey="eau-cuisson/1" alt="Garde l’eau de cuisson." />)
    expect(named).toMatch(/^<span role="img" aria-label="Garde l’eau de cuisson\."/)
    expect(named).toContain('<svg')

    expect(renderToStaticMarkup(<SecretArt artKey="eau-cuisson/1" />)).toMatch(/^<span aria-hidden="true"/)
  })
})

describe('SecretEmblem', () => {
  it('porte role="img" et son nom sur le conteneur', () => {
    const html = renderToStaticMarkup(<SecretEmblem variant="full" />)
    expect(html).toContain('role="img"')
    expect(html).toContain('aria-label="Emblème des secrets de jardinier"')
    expect(html).toContain(SECRET_EMBLEM_SVG.full)
  })

  it('choisit la petite variante sous 40 px', () => {
    expect(renderToStaticMarkup(<SecretEmblem size={28} />)).toContain(SECRET_EMBLEM_SVG.small)
    expect(renderToStaticMarkup(<SecretEmblem size={48} />)).toContain(SECRET_EMBLEM_SVG.full)
  })
})

describe('SecretPlanche', () => {
  const planche = {
    panels: [
      { art: 'eau-cuisson/1', caption: 'Garde l’eau, sans sel ni matière grasse.', emphasis: 'sans sel ni matière grasse' },
      { art: 'eau-cuisson/2', caption: 'Laisse-la refroidir.' },
    ],
  }

  it('numérote les cases, met le passage en gras, et garde une précaution écrite en texte', () => {
    const html = renderToStaticMarkup(
      <SecretPlanche
        planche={planche}
        story="Une partie des minéraux passe dans l’eau."
        ingredients={['eau de cuisson non salée']}
        evidence="FOLK"
        cautions="Jamais salée."
      />,
    )
    expect(html).toContain('<strong>sans sel ni matière grasse</strong>')
    expect(html).toContain('Étape 2 : ')
    expect(html).toContain('Eau de cuisson non salée')
    // Pas de case précaution dessinée : le texte du secret la remplace.
    expect(html).toContain('aria-label="Précaution"')
    expect(html).toContain('Jamais salée.')
  })
})
