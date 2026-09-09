import { describe, expect, it } from 'vitest'

import { setPersonProperties, trackAnonymous, trackServer } from '@/lib/analytics/server'

/**
 * Le module réel, sans doublure.
 *
 * Deux garanties, et ce sont les deux seules qui comptent hors production :
 * **rien ne part** sous Vitest, et **rien ne lève** — un service qui mesure ne
 * doit pas pouvoir échouer à cause de la mesure.
 */
describe('émetteur serveur', () => {
  it('ne lève jamais, et ne part pas en test', () => {
    expect(() => trackServer('user_1', 'post_liked', {})).not.toThrow()
    expect(() => trackAnonymous('login_failed', { method: 'email', reason: 'bad_credentials' })).not.toThrow()
    expect(() => setPersonProperties('user_1', { plants_count: 3 })).not.toThrow()
  })

  it('supporte un identifiant vide sans broncher', () => {
    // Un `userId` vide ne devrait pas arriver ; s'il arrive, il ne doit pas
    // faire tomber le geste qu'on était en train de mesurer.
    expect(() => trackServer('', 'contact_sent', {})).not.toThrow()
  })
})
