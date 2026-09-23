/**
 * Version des textes légaux (CGU et politique de confidentialité).
 *
 * Ici plutôt que dans `apps/web/lib/legal.ts` : c'est la date affichée en tête
 * des pages **et** la version inscrite sur le compte à l'inscription
 * (`termsVersion`), que le service d'auth écrit. Deux constantes finiraient
 * par diverger, et le compte porterait une version qui n'a jamais été publiée.
 */
export const LEGAL_VERSION = '2026-09-23'
