// growi-frontend/lib/mock-users.ts
// TODO: Replace with Prisma + DB when ready.
// Each user stored as { id, firstName, email, passwordHash }.
// Passwords hashed with Web Crypto API (SHA-256) — NOT bcrypt, no Node runtime needed.

export interface MockUser {
  id: string
  firstName: string
  email: string
  passwordHash: string
  address?: string // Plain string address, e.g. "1 Rue de Rivoli, Paris 75001, France"
}

// In-memory store — resets on server restart (MVP only)
const users: MockUser[] = [
  {
    id: 'seed-user-1',
    firstName: 'Dan',
    email: 'dan0588@gmail.com',
    passwordHash: 'c723ad78fe681b3eaa3a790262f22711c1a0446b5e631348bb4c81faa571d7ef',
    address: '1 Rue de Rivoli, Paris 75001, France',
  },
]

/** Get a user by ID (sync). */
export function getUserById(id: string): MockUser | undefined {
  return users.find((u) => u.id === id)
}

/** Hash a plain password with SHA-256 (hex). */
async function hashPassword(plain: string): Promise<string> {
  const buffer = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(plain),
  )
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

/** Create a new user. Throws if email already exists. */
export async function createUser(
  firstName: string,
  email: string,
  password: string,
): Promise<MockUser> {
  const existing = users.find(
    (u) => u.email.toLowerCase() === email.toLowerCase(),
  )
  if (existing) throw new Error('EMAIL_TAKEN')

  const user: MockUser = {
    id: crypto.randomUUID(),
    firstName,
    email: email.toLowerCase(),
    passwordHash: await hashPassword(password),
  }
  users.push(user)
  return user
}

/** Verify credentials. Returns user or null. */
export async function verifyUser(
  email: string,
  password: string,
): Promise<MockUser | null> {
  const user = users.find(
    (u) => u.email.toLowerCase() === email.toLowerCase(),
  )
  if (!user) return null
  const hash = await hashPassword(password)
  return hash === user.passwordHash ? user : null
}

// ─── UserProfile — stored in localStorage key 'growi_user_profile' ───────────

export type NotificationChannel = 'push' | 'email' | 'both' | 'none'
export type AlertFrequency = 'immediate' | 'daily_digest' | 'weekly_digest'

export interface AlertConfig {
  // Alertes météo jardinage
  frostAlert: boolean
  frostThreshold: number           // seuil °C, défaut 2
  heatAlert: boolean
  rainAlert: boolean
  windAlert: boolean
  // Alertes plantes & entretien
  wateringReminder: boolean
  wateringFrequencyDays: number    // défaut 2
  repottingReminder: boolean
  pruningReminder: boolean
  // Alertes calendrier
  seedingAlerts: boolean
  harvestAlerts: boolean
  // Canaux & fréquence
  channel: NotificationChannel
  frequency: AlertFrequency
  quietHoursEnabled: boolean
  quietHoursStart: string          // "HH:MM"
  quietHoursEnd: string            // "HH:MM"
}

export interface UserProfile {
  firstName: string
  lastName: string
  email: string
  address?: string                 // plain string, same as MockUser.address
  city?: string                    // display city
  avatarColor?: string             // hex, e.g. '#B4DD7F'
  gardenType?: 'potager' | 'ornement' | 'mixte' | 'interieur' | 'balcon'
  timezone?: string
  alertConfig: AlertConfig
}

export const defaultAlertConfig: AlertConfig = {
  frostAlert: true,
  frostThreshold: 2,
  heatAlert: true,
  rainAlert: false,
  windAlert: false,
  wateringReminder: true,
  wateringFrequencyDays: 2,
  repottingReminder: true,
  pruningReminder: false,
  seedingAlerts: true,
  harvestAlerts: true,
  channel: 'push',
  frequency: 'immediate',
  quietHoursEnabled: false,
  quietHoursStart: '22:00',
  quietHoursEnd: '07:00',
}
