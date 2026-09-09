/**
 * L'émetteur d'événements — l'interface commune au web, au mobile et au
 * serveur.
 *
 * Chaque surface a son SDK PostHog (posthog-js, posthog-react-native,
 * posthog-node) ; ce type est ce qu'elles exposent au reste du code, si bien
 * qu'un écran n'importe jamais un SDK et qu'un test n'a rien à simuler de
 * compliqué.
 *
 * **Rien n'y renvoie de promesse et rien n'y lève** : un événement perdu est
 * une ligne de moins dans un graphique, jamais un geste qui échoue.
 */

import type { GrowiEvent, GrowiEventName, GrowiEventProps, PersonProperties } from './events'

export interface Emitter {
  /** Enregistre un fait. Le nom et les propriétés viennent du catalogue. */
  track<N extends GrowiEventName>(name: N, props: GrowiEventProps<N>): void

  /**
   * Rattache ce qui suit à un compte — **l'identifiant interne**, jamais
   * l'e-mail ni le pseudo.
   */
  identify(userId: string): void

  /** Détache le compte : déconnexion, session perdue, installation neuve. */
  reset(): void

  /** Met à jour l'état du compte (voir `PersonProperties`). */
  setPersonProperties(properties: Partial<PersonProperties>): void

  /** L'utilisateur refuse l'analyse d'usage. Les crashs restent remontés. */
  optOut(): void

  /** L'utilisateur revient sur son refus. */
  optIn(): void
}

/**
 * Un émetteur qui ne fait rien.
 *
 * C'est la valeur par défaut partout : en développement, en test, et dans
 * n'importe quel environnement sans clé. Le code appelant n'a donc jamais à
 * se demander si l'analyse est configurée — il émet, et c'est tout.
 */
export function createNoopEmitter(): Emitter {
  return {
    track: () => {},
    identify: () => {},
    reset: () => {},
    setPersonProperties: () => {},
    optOut: () => {},
    optIn: () => {},
  }
}

/**
 * Enveloppe un émetteur pour qu'aucune de ses défaillances ne remonte.
 *
 * Les SDK savent lever — clé invalide, stockage inaccessible, réseau coupé au
 * mauvais moment. Un `track` posé dans un `onPress` ne doit pas pouvoir
 * empêcher le geste qu'il mesure.
 */
export function createSafeEmitter(emitter: Emitter): Emitter {
  const guard =
    <A extends unknown[]>(fn: (...args: A) => void) =>
    (...args: A): void => {
      try {
        fn(...args)
      } catch (error) {
        // `console` n'est pas dans les typages de ce paquet, qui ne suppose ni
        // le navigateur ni Node : on le prend sur l'objet global s'il existe.
        const globalConsole = (globalThis as { console?: { warn?: (...args: unknown[]) => void } })
          .console
        globalConsole?.warn?.('[analytics] émission impossible', error)
      }
    }

  return {
    track: guard(emitter.track.bind(emitter)) as Emitter['track'],
    identify: guard(emitter.identify.bind(emitter)),
    reset: guard(emitter.reset.bind(emitter)),
    setPersonProperties: guard(emitter.setPersonProperties.bind(emitter)),
    optOut: guard(emitter.optOut.bind(emitter)),
    optIn: guard(emitter.optIn.bind(emitter)),
  }
}

/** Type utilitaire : un couple nom + propriétés, tel qu'on le passe à `track`. */
export type TrackedEvent = GrowiEvent
