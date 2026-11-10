import crypto from 'node:crypto'
import { env } from '../config/env.js'

// Chỉ chấp nhận đầy đủ hồ sơ mới; client cũ vẫn có thể dùng luồng mở shop cũ.
export function prepareSellerProfile(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null
  const limits = { pickupAddress: 255, province: 120, contactEmail: 254, contactPhone: 20, ownerName: 120, idCard: 12, taxCode: 20, invoiceEmail: 254 }
  const result = {}
  for (const [key, max] of Object.entries(limits)) {
    if (input[key] != null && typeof input[key] !== 'string') return null
    result[key] = (input[key] || '').trim()
    if (result[key].length > max) return null
  }
  if (!result.pickupAddress || !result.province || !result.ownerName ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(result.contactEmail) ||
    !/^[+()\d .-]{8,20}$/.test(result.contactPhone) || !/^\d{9,12}$/.test(result.idCard) ||
    (result.taxCode && !/^\d{10}(?:-\d{3})?$/.test(result.taxCode)) ||
    (result.invoiceEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(result.invoiceEmail)) ||
    !['personal', 'household', 'enterprise'].includes(input.businessType) || input.agreeTerms !== true ||
    !Array.isArray(input.shippingMethods) || !input.shippingMethods.length ||
    input.shippingMethods.some((method) => !['nhanh', 'tietkiem', 'hoatoc'].includes(method)) ||
    new Set(input.shippingMethods).size !== input.shippingMethods.length) return null
  result.businessType = input.businessType
  result.shippingMethods = input.shippingMethods
  return result
}

export function encryptIdentity(idCard) {
  if (!env.sellerIdentityKey) return null
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', env.sellerIdentityKey, iv)
  const encrypted = Buffer.concat([cipher.update(idCard, 'utf8'), cipher.final()])
  return JSON.stringify({ v: 1, iv: iv.toString('base64'), tag: cipher.getAuthTag().toString('base64'), data: encrypted.toString('base64') })
}

export async function saveSellerProfile(query, shopId, profile, encryptedIdentity) {
  await query(`INSERT INTO seller_registration_profiles
    (shop_id, pickup_address, province, contact_email, contact_phone, shipping_methods, business_type, owner_name, identity_encrypted, identity_last4, tax_code, invoice_email, agreed_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, UTC_TIMESTAMP())`,
  [shopId, profile.pickupAddress, profile.province, profile.contactEmail, profile.contactPhone,
    JSON.stringify(profile.shippingMethods), profile.businessType, profile.ownerName, encryptedIdentity,
    profile.idCard.slice(-4), profile.taxCode || null, profile.invoiceEmail || null])
}
