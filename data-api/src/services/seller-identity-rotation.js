import { env } from '../config/env.js'
import { decryptIdentity, encryptIdentity } from '../utils/seller-profile.js'

export async function rotateSellerIdentities({ query, transaction, mode }) {
  let lastId = '0'
  let scanned = 0
  let oldCount = 0
  let changed = 0
  while (true) {
    const rows = await query('SELECT CAST(shop_id AS CHAR) AS id FROM seller_registration_profiles WHERE shop_id > ? ORDER BY shop_id LIMIT 100', [lastId])
    if (!rows.length) break
    for (const row of rows) {
      const id = String(row.id)
      const result = await transaction(async (lockedQuery) => {
        const profiles = await lockedQuery('SELECT identity_encrypted FROM seller_registration_profiles WHERE shop_id = ? FOR UPDATE', [id])
        if (!profiles.length) return 'missing'
        const payload = profiles[0].identity_encrypted
        try { decryptIdentity(payload, [env.sellerIdentityKey]); return 'current' } catch {}
        const identity = decryptIdentity(payload)
        if (mode === 'apply') {
          await lockedQuery('UPDATE seller_registration_profiles SET identity_encrypted = ? WHERE shop_id = ?', [encryptIdentity(identity), id])
          return 'changed'
        }
        return 'old'
      })
      scanned++
      if (result === 'old' || result === 'changed') oldCount++
      if (result === 'changed') changed++
      lastId = id
    }
  }
  return { mode, scanned, oldCount, changed }
}
