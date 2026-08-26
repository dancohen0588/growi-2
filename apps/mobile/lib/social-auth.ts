import { Platform } from 'react-native'
import * as AppleAuthentication from 'expo-apple-authentication'
import * as AuthSession from 'expo-auth-session'
import * as Crypto from 'expo-crypto'
import type { SocialLoginInput } from '@growi/shared'

/**
 * Connexion par Apple et par Google.
 *
 * Ces deux parcours ne font que **récolter un jeton d'identité** ; c'est le
 * serveur qui le vérifie et ouvre la session. Rien de ce qui est décidé ici
 * n'est digne de confiance — l'app pourrait présenter n'importe quoi.
 *
 * Un abandon n'est pas une erreur : on rend `null`, et l'écran ne montre rien.
 * Fermer une feuille de connexion est un geste ordinaire, pas un échec.
 */

/** Chaîne à usage unique, réinscrite par le fournisseur dans le jeton. */
function makeNonce(): string {
  return Crypto.randomUUID()
}

/** Identifie l'appareil dans la liste des sessions, sans rien de personnel. */
function deviceInfo(): string {
  return `${Platform.OS} ${Platform.Version}`
}

// ─── Apple ─────────────────────────────────────────────────────────────────

/**
 * Sur Android, et sur les iPhone trop anciens, le bouton n'a pas lieu d'être.
 *
 * L'appel lui-même peut échouer : dans un build antérieur à l'ajout du module
 * natif, il n'y a personne au bout. On répond alors « indisponible » plutôt
 * que de laisser une promesse rejetée sans preneur.
 */
export async function isAppleSignInAvailable(): Promise<boolean> {
  if (Platform.OS !== 'ios') return false

  try {
    return await AppleAuthentication.isAvailableAsync()
  } catch {
    return false
  }
}

/**
 * Demande une identité à Apple.
 *
 * Le nom n'est transmis qu'à la **toute première** autorisation : on le fait
 * suivre au serveur tel quel, faute de quoi il est perdu définitivement. Les
 * fois suivantes, `fullName` est vide et c'est normal.
 *
 * @returns `null` si l'utilisateur a renoncé.
 */
export async function requestAppleIdentity(): Promise<SocialLoginInput | null> {
  const nonce = makeNonce()

  try {
    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
      nonce,
    })

    if (!credential.identityToken) return null

    return {
      identityToken: credential.identityToken,
      nonce,
      firstName: credential.fullName?.givenName ?? null,
      lastName: credential.fullName?.familyName ?? null,
      deviceInfo: deviceInfo(),
    }
  } catch (error) {
    if ((error as { code?: string }).code === 'ERR_REQUEST_CANCELED') return null
    throw error
  }
}

// ─── Google ────────────────────────────────────────────────────────────────

/**
 * Points d'entrée OAuth de Google, écrits en dur.
 *
 * Ils sont stables depuis des années, et les découvrir demanderait un
 * aller-retour réseau avant même d'ouvrir la feuille de connexion.
 */
const GOOGLE_DISCOVERY = {
  authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
  tokenEndpoint: 'https://oauth2.googleapis.com/token',
}

/**
 * Identifiant client de la plateforme courante.
 *
 * Google en exige un par plateforme, et refuse un jeton demandé avec celui
 * d'une autre. Ils ne sont pas secrets : ils voyagent dans chaque requête
 * d'autorisation et sont lisibles dans le binaire.
 */
function googleClientId(): string | null {
  const id =
    Platform.OS === 'ios'
      ? process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID
      : process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID

  return id && id.length > 0 ? id : null
}

/** La connexion Google est-elle configurée sur ce build ? */
export function isGoogleSignInAvailable(): boolean {
  return googleClientId() !== null
}

/**
 * Adresse de retour, imposée par Google pour un client natif : l'identifiant
 * client lu à l'envers, suivi du chemin. `123-abc.apps.googleusercontent.com`
 * donne `com.googleusercontent.apps.123-abc:/oauthredirect`.
 *
 * Ce schéma doit aussi être déclaré dans `app.json`, sinon iOS ne saura pas à
 * qui remettre la réponse.
 */
function googleRedirectUri(clientId: string): string {
  const [id] = clientId.split('.apps.googleusercontent.com')
  return `com.googleusercontent.apps.${id}:/oauthredirect`
}

/**
 * Demande une identité à Google.
 *
 * Flux « code d'autorisation avec PKCE », le seul que Google accepte d'une
 * app installée : la feuille de connexion rend un code à usage unique, qu'on
 * échange ensuite contre le jeton d'identité. Le vérificateur PKCE, gardé en
 * mémoire, empêche une autre app d'exploiter ce code si elle l'interceptait.
 *
 * @returns `null` si l'utilisateur a renoncé.
 */
export async function requestGoogleIdentity(): Promise<SocialLoginInput | null> {
  const clientId = googleClientId()
  if (!clientId) {
    throw new Error("La connexion Google n'est pas configurée sur cette version de l'app.")
  }

  const redirectUri = googleRedirectUri(clientId)
  const nonce = makeNonce()

  const request = new AuthSession.AuthRequest({
    clientId,
    redirectUri,
    scopes: ['openid', 'profile', 'email'],
    responseType: AuthSession.ResponseType.Code,
    usePKCE: true,
    extraParams: { nonce },
  })

  const result = await request.promptAsync(GOOGLE_DISCOVERY)

  // `dismiss` (feuille fermée), `cancel` (retour), `locked` : autant de renoncements.
  if (result.type !== 'success') {
    if (result.type === 'error') {
      throw new Error(result.error?.message ?? 'Connexion Google interrompue.')
    }
    return null
  }

  const tokens = await AuthSession.exchangeCodeAsync(
    {
      clientId,
      code: result.params.code,
      redirectUri,
      extraParams: { code_verifier: request.codeVerifier ?? '' },
    },
    GOOGLE_DISCOVERY,
  )

  if (!tokens.idToken) return null

  return {
    identityToken: tokens.idToken,
    nonce,
    // Google renseigne le nom dans le jeton lui-même : rien à faire suivre.
    firstName: null,
    lastName: null,
    deviceInfo: deviceInfo(),
  }
}
