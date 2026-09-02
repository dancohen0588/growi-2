/**
 * Informations légales de Growi.
 *
 * Les pages `/mentions-legales`, `/confidentialite` et `/cgu` lisent ce
 * fichier : une seule chose à tenir à jour. Les valeurs marquées À COMPLÉTER
 * ne peuvent pas être devinées depuis le code — elles dépendent du statut de
 * l'éditeur (personne physique ou société) et doivent être exactes : les deux
 * boutiques et la loi française les exigent.
 */

export const LEGAL_TODO = 'À COMPLÉTER' as const

export const EDITOR = {
  /** Dénomination : nom et prénom en entreprise individuelle, raison sociale sinon. */
  name: LEGAL_TODO,
  /** « Entreprise individuelle », « SAS au capital de X € », etc. */
  legalForm: LEGAL_TODO,
  /** Adresse du siège ou du domicile de l'éditeur. */
  address: LEGAL_TODO,
  /** SIREN ou SIRET. Absent tant que l'activité n'est pas immatriculée. */
  registration: LEGAL_TODO,
  /** Numéro de TVA intracommunautaire, si assujetti. */
  vat: LEGAL_TODO,
  /** Directeur de la publication — la personne physique responsable. */
  publisher: LEGAL_TODO,
  /** Adresse de contact, aussi utilisée pour les demandes RGPD. */
  email: 'info@growi-garden.fr',
} as const

/**
 * Hébergeurs, vérifiés sur leurs pages légales respectives.
 *
 * La mention de l'hébergeur est obligatoire en France (LCEN, article 6).
 */
export const HOSTS = [
  {
    role: 'Site et application',
    name: 'Vercel Inc.',
    address: '440 N Barranca Avenue #4133, Covina, CA 91723, États-Unis',
    site: 'https://vercel.com',
  },
  {
    role: 'Base de données et photos',
    name: 'Supabase, Inc.',
    address: 'Données hébergées dans la région eu-west-1 (Irlande) — privacy@supabase.com',
    site: 'https://supabase.com',
  },
] as const

/**
 * Ce que Growi collecte réellement, relevé dans le schéma Prisma et les
 * services. À reprendre si un champ apparaît ou disparaît.
 */
export const DATA_COLLECTED = [
  {
    category: 'Compte',
    items: 'Adresse e-mail, prénom, nom, mot de passe (jamais en clair : empreinte bcrypt).',
    why: 'Créer ton compte, t\'identifier, te contacter au sujet du service.',
    retention: 'Jusqu\'à la suppression du compte.',
  },
  {
    category: 'Localisation',
    items: 'Ville, adresse si tu la renseignes, latitude et longitude approximatives.',
    why: 'Obtenir la météo de ton jardin et adapter les conseils d\'entretien.',
    retention: 'Jusqu\'à la suppression du compte ou de la localisation.',
  },
  {
    category: 'Jardin',
    items: 'Jardins, zones, plantes, gestes d\'entretien, notes et photos.',
    why: 'Le service lui-même : suivre tes plantes et te rappeler quoi faire.',
    retention: 'Jusqu\'à la suppression de l\'élément concerné ou du compte.',
  },
  {
    category: 'Photos',
    items: 'Les photos que tu prends de tes plantes ou de leurs symptômes.',
    why: 'Illustrer tes fiches, et identifier une espèce quand tu le demandes.',
    retention:
      'Supprimées du stockage en même temps que la plante, le geste, ou lors d\'un remplacement.',
  },
  {
    category: 'Connexion',
    items:
      'Empreintes des jetons de session mobile, type d\'appareil, dates de connexion. Le jeton lui-même n\'est jamais stocké.',
    why: 'Te garder connecté sans redemander ton mot de passe, et détecter un vol de jeton.',
    retention: '60 jours, ou immédiatement à la déconnexion.',
  },
  {
    category: 'Préférences',
    items: 'Réglages d\'alertes, fuseau horaire, type de jardin, couleur d\'avatar.',
    why: 'Adapter les rappels et l\'affichage.',
    retention: 'Jusqu\'à la suppression du compte.',
  },
] as const

/**
 * Prestataires qui traitent des données pour Growi.
 *
 * Relevé dans le code : Gemini pour l'identification, Resend pour les emails
 * du formulaire de contact, Open-Meteo et Nominatim pour la météo.
 */
export const PROCESSORS = [
  {
    name: 'Google (Gemini API)',
    role: 'Identification des plantes par photo',
    data: 'La photo envoyée, sans ton identité ni ta position.',
    location: 'États-Unis',
  },
  {
    name: 'Supabase, Inc.',
    role: 'Base de données et stockage des photos',
    data: 'L\'ensemble des données de ton compte.',
    location: 'Union européenne (Irlande)',
  },
  {
    name: 'Vercel Inc.',
    role: 'Hébergement du site et de l\'API',
    data: 'Données transitant par les requêtes, journaux techniques.',
    location: 'États-Unis',
  },
  {
    name: 'Resend',
    role: 'Envoi des e-mails du formulaire de contact',
    data: 'Ton adresse e-mail et le contenu de ton message.',
    location: 'États-Unis',
  },
  {
    name: 'Open-Meteo et OpenStreetMap (Nominatim)',
    role: 'Météo et conversion des coordonnées en nom de lieu',
    data: 'Des coordonnées approximatives, sans identifiant de compte.',
    location: 'Union européenne',
  },
] as const

/** Dernière révision des textes légaux, affichée en tête de page. */
export const LEGAL_UPDATED_AT = '2026-08-22'

/** Vrai tant que l'identité de l'éditeur n'est pas renseignée. */
export function hasLegalPlaceholders(): boolean {
  return Object.values(EDITOR).includes(LEGAL_TODO)
}
