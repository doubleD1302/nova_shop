import { signAccessToken } from '../src/middlewares/auth.middleware.js'

const token13 = signAccessToken({ id: 13, role: 'buyer' })
const token5 = signAccessToken({ id: 5, role: 'admin' })
const token8 = signAccessToken({ id: 8, role: 'seller' })

console.log('Testing requests...')

// Test 1: User 13 (buyer) calls POST /api/v1/auth/seller-shop with name "starfly"
const res1 = await fetch('http://localhost:3000/api/v1/auth/seller-shop', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token13 },
  body: JSON.stringify({ shopName: 'starfly' }),
})
console.log('Test 1 (Buyer with name starfly):', res1.status, await res1.json())

// Test 2: User 5 (admin) calls POST /api/v1/auth/seller-shop with name "starfly"
const res2 = await fetch('http://localhost:3000/api/v1/auth/seller-shop', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token5 },
  body: JSON.stringify({ shopName: 'starfly' }),
})
console.log('Test 2 (Admin with name starfly):', res2.status, await res2.json())

// Test 3: User 13 (buyer) calls PUT /api/v1/seller/shop
const res3 = await fetch('http://localhost:3000/api/v1/seller/shop', {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token13 },
  body: JSON.stringify({ name: 'starfly' }),
})
console.log('Test 3 (Buyer calling /seller/shop):', res3.status, await res3.json())

// Test 4: User 13 (buyer) calls POST /api/v1/auth/seller-shop with a brand new unique name "starfly_new_123"
const res4 = await fetch('http://localhost:3000/api/v1/auth/seller-shop', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token13 },
  body: JSON.stringify({ shopName: 'starfly_new_123' }),
})
console.log('Test 4 (Buyer with unique name):', res4.status, await res4.json())

