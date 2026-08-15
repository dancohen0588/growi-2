import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import {
  ACCESS_TOKEN_TTL_SECONDS,
  generateRefreshToken,
  hashRefreshToken,
  parseBearerToken,
  refreshTokenExpiry,
  refreshTokenHashEquals,
  signAccessToken,
  verifyAccessToken,
} from '../tokens'

const ORIGINAL_SECRET = process.env.JWT_SECRET

beforeEach(() => {
  process.env.JWT_SECRET = 'secret-de-test-suffisamment-long-pour-hs256'
})

afterEach(() => {
  process.env.JWT_SECRET = ORIGINAL_SECRET
})

describe('access token', () => {
  it('signe puis vérifie, en restituant le porteur', async () => {
    const token = await signAccessToken('user_42')
    await expect(verifyAccessToken(token)).resolves.toBe('user_42')
  })

  it('rejette un jeton signé avec une autre clé', async () => {
    const token = await signAccessToken('user_42')
    process.env.JWT_SECRET = 'une-tout-autre-cle-de-signature-hs256'

    await expect(verifyAccessToken(token)).rejects.toMatchObject({
      code: 'UNAUTHENTICATED',
    })
  })

  it('rejette un jeton malformé', async () => {
    await expect(verifyAccessToken('pas.un.jwt')).rejects.toMatchObject({
      code: 'UNAUTHENTICATED',
    })
  })

  it('ne dit pas pourquoi le jeton est refusé', async () => {
    const err = await verifyAccessToken('pas.un.jwt').catch((e: unknown) => e)
    expect((err as Error).message).toBe('Jeton invalide ou expiré')
  })

  it("échoue clairement si JWT_SECRET n'est pas configuré", async () => {
    delete process.env.JWT_SECRET
    await expect(signAccessToken('user_42')).rejects.toMatchObject({ code: 'INTERNAL' })
  })

  it('expire au bout de 15 minutes', async () => {
    const token = await signAccessToken('user_42')
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString())
    expect(payload.exp - payload.iat).toBe(ACCESS_TOKEN_TTL_SECONDS)
    expect(payload.sub).toBe('user_42')
    // Émetteur et audience évitent qu'un JWT d'un autre service soit accepté.
    expect(payload.iss).toBe('growi')
    expect(payload.aud).toBe('growi-mobile')
  })
})

describe('refresh token', () => {
  it('produit 256 bits d\'aléa, jamais deux fois le même', () => {
    const tokens = new Set(Array.from({ length: 100 }, () => generateRefreshToken()))
    expect(tokens.size).toBe(100)
    // 32 octets en base64url
    expect(Buffer.from([...tokens][0], 'base64url')).toHaveLength(32)
  })

  it('hache de façon déterministe, sans laisser fuiter le jeton', () => {
    const token = generateRefreshToken()
    const hash = hashRefreshToken(token)

    expect(hash).toBe(hashRefreshToken(token))
    expect(hash).toHaveLength(64)
    expect(hash).not.toContain(token)
    expect(hashRefreshToken(generateRefreshToken())).not.toBe(hash)
  })

  it('compare deux empreintes à temps constant', () => {
    const hash = hashRefreshToken('abc')
    expect(refreshTokenHashEquals(hash, hash)).toBe(true)
    expect(refreshTokenHashEquals(hash, hashRefreshToken('abd'))).toBe(false)
    expect(refreshTokenHashEquals(hash, 'trop-court')).toBe(false)
  })

  it('expire dans 60 jours', () => {
    const from = new Date('2026-08-15T00:00:00.000Z')
    expect(refreshTokenExpiry(from).toISOString()).toBe('2026-10-14T00:00:00.000Z')
  })
})

describe('en-tête Authorization', () => {
  it('extrait le jeton, quelle que soit la casse ou les espaces', () => {
    expect(parseBearerToken('Bearer abc123')).toBe('abc123')
    expect(parseBearerToken('bearer abc123')).toBe('abc123')
    expect(parseBearerToken('  Bearer   abc123  ')).toBe('abc123')
  })

  it('ignore les en-têtes absents ou d\'un autre schéma', () => {
    expect(parseBearerToken(null)).toBeNull()
    expect(parseBearerToken(undefined)).toBeNull()
    expect(parseBearerToken('')).toBeNull()
    expect(parseBearerToken('Basic abc123')).toBeNull()
    expect(parseBearerToken('Bearer')).toBeNull()
  })
})
