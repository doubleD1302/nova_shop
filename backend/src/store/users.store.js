import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { scryptSync, randomBytes, timingSafeEqual } from 'node:crypto'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const DATA_DIR = join(__dirname, '..', '..', 'data')
const USERS_FILE = join(DATA_DIR, 'users.json')
const SHOPS_FILE = join(DATA_DIR, 'shops.json')

// Password hashing parameters
const SCRYPT_KEYLEN = 64
const SCRYPT_SALT_LEN = 32

/**
 * Ensure the data directory and JSON files exist.
 */
function ensureDataFiles() {
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true })
  }
  if (!existsSync(USERS_FILE)) {
    writeFileSync(USERS_FILE, '[]', 'utf8')
  }
  if (!existsSync(SHOPS_FILE)) {
    writeFileSync(SHOPS_FILE, '[]', 'utf8')
  }
}

ensureDataFiles()

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

export function loadUsers() {
  try {
    const raw = readFileSync(USERS_FILE, 'utf8')
    return JSON.parse(raw)
  } catch {
    return []
  }
}

export function saveUsers(users) {
  writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), 'utf8')
}

export function findUserByUsername(username) {
  const users = loadUsers()
  const needle = username.toLowerCase()
  return users.find((u) => u.username.toLowerCase() === needle) || null
}

export function findUserByEmail(email) {
  const users = loadUsers()
  const needle = email.toLowerCase()
  return users.find((u) => u.email && u.email.toLowerCase() === needle) || null
}

export function findUserById(id) {
  const users = loadUsers()
  return users.find((u) => String(u.id) === String(id)) || null
}

/**
 * Hash a password using Node.js built-in scrypt.
 * Returns a string in the format: salt:hash (both hex-encoded).
 */
export function hashPassword(password) {
  const salt = randomBytes(SCRYPT_SALT_LEN)
  const derived = scryptSync(password, salt, SCRYPT_KEYLEN)
  return `${salt.toString('hex')}:${derived.toString('hex')}`
}

/**
 * Verify a password against a stored hash.
 */
export function verifyPassword(storedHash, password) {
  const [saltHex, hashHex] = storedHash.split(':')
  if (!saltHex || !hashHex) return false
  const salt = Buffer.from(saltHex, 'hex')
  const stored = Buffer.from(hashHex, 'hex')
  const derived = scryptSync(password, salt, SCRYPT_KEYLEN)
  if (stored.length !== derived.length) return false
  return timingSafeEqual(stored, derived)
}

/**
 * Create a new user and persist to disk.
 */
export function createUser({ username, password, fullName, email, phone, role, shopName, shopTagline }) {
  const users = loadUsers()

  // Auto-increment string id
  let maxId = 0
  for (const u of users) {
    const n = parseInt(u.id, 10)
    if (n > maxId) maxId = n
  }
  const newId = String(maxId + 1)

  let shopId = null

  // If seller, create a shop entry
  if (role === 'seller') {
    const shop = createShop({ name: shopName || username, tagline: shopTagline || '' })
    shopId = shop.id
  }

  const user = {
    id: newId,
    username: username.trim().toLowerCase(),
    passwordHash: hashPassword(password),
    fullName: fullName || username,
    email: email ? email.trim().toLowerCase() : null,
    phone: phone || null,
    role: role || 'buyer',
    status: 'active',
    shopId,
    avatarUrl: null,
    address: null,
  }

  users.push(user)
  saveUsers(users)
  return user
}

/**
 * Update user fields by id and persist to disk.
 */
export function updateUser(id, updates) {
  const users = loadUsers()
  const idx = users.findIndex((u) => String(u.id) === String(id))
  if (idx === -1) return null

  // Only allow updating safe fields
  const allowedFields = ['fullName', 'email', 'phone', 'avatarUrl', 'address', 'role', 'shopId', 'status']
  for (const key of allowedFields) {
    if (updates[key] !== undefined) {
      users[idx][key] = updates[key]
    }
  }

  saveUsers(users)
  return users[idx]
}

// ---------------------------------------------------------------------------
// Shops
// ---------------------------------------------------------------------------

export function loadShops() {
  try {
    const raw = readFileSync(SHOPS_FILE, 'utf8')
    return JSON.parse(raw)
  } catch {
    return []
  }
}

export function saveShops(shops) {
  writeFileSync(SHOPS_FILE, JSON.stringify(shops, null, 2), 'utf8')
}

export function createShop({ name, tagline }) {
  const shops = loadShops()

  let maxId = 0
  for (const s of shops) {
    const n = parseInt(s.id, 10)
    if (n > maxId) maxId = n
  }
  const newId = String(maxId + 1)

  const shop = {
    id: newId,
    name: name || 'My Shop',
    tagline: tagline || '',
    createdAt: new Date().toISOString(),
  }

  shops.push(shop)
  saveShops(shops)
  return shop
}
