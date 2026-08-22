import { manipulateAsync, SaveFormat } from 'expo-image-manipulator'
import * as ImagePicker from 'expo-image-picker'

/**
 * Prise et préparation d'une photo pour l'identification.
 *
 * Les mêmes réglages que le web, qui redimensionne dans le navigateur avant
 * d'envoyer : une photo d'iPhone pèse plusieurs mégaoctets, et la route
 * plafonne à 4 Mo une fois encodée en base64.
 */

const MAX_DIMENSION = 1920
const JPEG_QUALITY = 0.85

export interface Photo {
  /** URI locale, pour l'aperçu. */
  uri: string
  /** Data URL, attendue par l'identification. */
  dataUrl: string
  /** Nom et type, attendus par l'envoi en `multipart/form-data`. */
  name: string
  type: string
}

/** L'utilisateur a refusé l'accès ; l'écran le dit sans faire échouer l'app. */
export class PermissionDeniedError extends Error {
  constructor(readonly source: 'camera' | 'library') {
    super(
      source === 'camera'
        ? "Growi n'a pas accès à l'appareil photo. Tu peux l'autoriser dans les réglages de ton téléphone."
        : "Growi n'a pas accès à tes photos. Tu peux l'autoriser dans les réglages de ton téléphone.",
    )
    this.name = 'PermissionDeniedError'
  }
}

/** Redimensionne et recompresse, puis renvoie la data URL. */
async function prepare(uri: string): Promise<Photo> {
  const result = await manipulateAsync(uri, [{ resize: { width: MAX_DIMENSION } }], {
    compress: JPEG_QUALITY,
    format: SaveFormat.JPEG,
    base64: true,
  })

  return {
    uri: result.uri,
    dataUrl: `data:image/jpeg;base64,${result.base64 ?? ''}`,
    name: 'photo.jpg',
    type: 'image/jpeg',
  }
}

/** Ouvre l'appareil photo. `null` si l'utilisateur renonce. */
export async function takePhoto(): Promise<Photo | null> {
  const permission = await ImagePicker.requestCameraPermissionsAsync()
  if (!permission.granted) throw new PermissionDeniedError('camera')

  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: ['images'],
    quality: 1,
  })
  if (result.canceled || !result.assets[0]) return null

  return prepare(result.assets[0].uri)
}

/** Ouvre la galerie. `null` si l'utilisateur renonce. */
export async function pickPhoto(): Promise<Photo | null> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync()
  if (!permission.granted) throw new PermissionDeniedError('library')

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    quality: 1,
  })
  if (result.canceled || !result.assets[0]) return null

  return prepare(result.assets[0].uri)
}
