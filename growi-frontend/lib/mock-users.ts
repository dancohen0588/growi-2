// growi-frontend/lib/mock-users.ts
// TODO: Replace with Prisma + DB when ready.
// Each user stored as { id, firstName, email, passwordHash }.
// Passwords hashed with Web Crypto API (SHA-256) — NOT bcrypt, no Node runtime needed.

export interface UserAddress {
  street?: string
  city: string
  postalCode?: string
  country: string
  latitude?: number
  longitude?: number
}

export interface MockUser {
  id: string
  firstName: string
  email: string
  passwordHash: string
  address?: UserAddress
}

// In-memory store — resets on server restart (MVP only)
const users: MockUser[] = [
  {
    id: 'seed-user-1',
    firstName: 'Dan',
    email: 'dan0588@gmail.com',
    passwordHash: 'c723ad78fe681b3eaa3a790262f22711c1a0446b5e631348bb4c81faa571d7ef',
    address: {
      street: '1 Rue de Rivoli',
      city: 'Paris',
      postalCode: '75001',
      country: 'France',
      latitude: 48.8566,
      longitude: 2.3522,
    },
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
