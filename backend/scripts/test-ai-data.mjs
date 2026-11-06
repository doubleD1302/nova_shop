import assert from 'node:assert/strict'
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
const baseId = String(Date.now()) + String(Math.floor(Math.random() * 10000)).padStart(4, '0')
const ids = { buyer: baseId + '1', seller: baseId + '2', admin: baseId + '3', other: baseId + '4' }
const brainDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../data/ai-brains')
const brainFiles = Object.values(ids).map(id => path.join(brainDir, `account_${id}.json`))
for (const file of brainFiles) assert.equal(fs.existsSync(file), false)
let failCatalog = false
const dataApi = http.createServer((req, res) => {
  res.setHeader('content-type', 'application/json')
  const auth = req.url.match(/^\/internal\/v1\/users\/(\d+)\/auth-profile$/)
  if (auth) {
    const id = auth[1]
    const role = id === ids.admin ? 'admin' : id === ids.seller || id === ids.other ? 'seller' : 'buyer'
    return res.end(JSON.stringify({ success: true, data: { user: { id, username:`test${id}`, fullName:'Test', email:null, phone:null, avatarUrl:null, role, status:'active', shopId: role === 'seller' ? id : null, address:null } } }))
  }
  if (req.url.startsWith('/internal/v1/orders?')) {
    const id = new URL(req.url, 'http://localhost').searchParams.get('userId')
    return res.end(JSON.stringify({success:true,data:{orders:[{code:`ORDER-${id}`,status:'shipping'}]}}))
  }
  if (req.url.startsWith('/internal/v1/seller/orders?')) return res.end(JSON.stringify({success:true,data:{summary:{total:1},orders:[]}}))
  if (req.url === '/internal/v1/admin/users') return res.end(JSON.stringify({success:true,data:{users:Array.from({length:25}, (_, i) => ({id:String(i + 1),username:`sample${i + 1}`,fullName:`Test User ${i + 1}`,email:'test@example.invalid',phone:'000',role:'buyer',status:'active'}))}}))
  if (req.url.startsWith('/internal/v1/seller/products')) {
    const id = new URL(req.url,'http://localhost').searchParams.get('userId')
    return res.end(JSON.stringify({success:true,data:{total:1,products:[{id, name:`Sản phẩm shop ${id}`, price:100, stock:2,status:'active',approvalStatus:'approved', sensitive:'PRIVATE_SHOULD_NOT_SEND'}]}}))
  }
  if (req.url === '/internal/v1/admin/stats') return res.end(JSON.stringify({success:true,data:{stats:{totalShops:4,totalProducts:5,totalOrders:6,totalCustomers:7,totalRevenue:8},orderStatusCounts:{pending:1},recentOrders:[{recipientName:'PRIVATE_SHOULD_NOT_SEND'}]}}))
  if (req.url.startsWith('/internal/v1/products') && failCatalog) return res.writeHead(503).end(JSON.stringify({success:false}))
  if (req.url.startsWith('/internal/v1/products')) return res.end(JSON.stringify({ success: true, data: { products: [
    { id: '1', name: 'Tai nghe kiểm thử', price: 199000, categoryName: 'Điện tử', stock: 2, images: [] },
    { id: '2', name: 'Áo kiểm thử', price: 99000, categoryName: 'Thời trang', stock: 1, images: [] },
  ] } }))
  return res.writeHead(404).end(JSON.stringify({ success: false }))
})
await new Promise(resolve => dataApi.listen(0, '127.0.0.1', resolve))
Object.assign(process.env, { NODE_ENV:'test', DOTENV_CONFIG_PATH:'missing-ai-data-test.env', DATA_API_URL:`http://127.0.0.1:${dataApi.address().port}`, DATA_API_KEY:'ai-data-test-key', JWT_SECRET:'ai-data-test-jwt-secret-32-characters', GEMINI_API_KEY:'mock-test-key', GEMINI_API_KEYS:'' })
const realFetch = globalThis.fetch
let providerRequest
let failProvider = false
globalThis.fetch = async (url, options) => {
  if (String(url).startsWith('https://generativelanguage.googleapis.com/')) {
    providerRequest = {url:String(url), body:JSON.parse(options.body)}
    if (failProvider) return new Response('{}',{status:503})
    return Response.json({candidates:[{content:{parts:[{text:'Đây là sản phẩm từ ShopNova.'}]}}]})
  }
  return realFetch(url, options)
}
const { default: app } = await import('../src/app.js')
const { signAccessToken } = await import('../src/middlewares/auth.middleware.js')
const server = http.createServer(app)
await new Promise(resolve => server.listen(0,'127.0.0.1',resolve))
const base=`http://127.0.0.1:${server.address().port}/api/v1/ai/chat`
const call=async (message, id, context={})=>{const r=await realFetch(base,{method:'POST',headers:{'content-type':'application/json',...(id ? {authorization:`Bearer ${signAccessToken({id,role:'admin'})}`} : {})},body:JSON.stringify({message,context})});return {status:r.status,body:await r.json()}}
try {
  const result=await call('Tìm tai nghe dưới 300 nghìn')
  assert.equal(result.status,200)
  assert.equal(result.body.data.products.length,1)
  assert.equal(result.body.data.products[0].id,'1')
  const shippingProduct = await call('Tìm tai nghe giao hàng')
  assert.equal(shippingProduct.body.data.intent, 'product_recommendation')
  assert.ok(providerRequest.url.includes('/models/gemini-3.1-flash-lite:generateContent'))
  assert.ok(providerRequest.body.systemInstruction?.parts?.[0]?.text.includes('ShopNova'))
  assert.ok(JSON.stringify(providerRequest.body).includes('Tai nghe kiểm thử'))
  assert.ok(!JSON.stringify(providerRequest.body).includes('Áo kiểm thử'))
  const order=await call('Đơn hàng của tôi')
  assert.equal(order.status,200)
  assert.equal(order.body.data.orderInfo,undefined)
  assert.equal((await call('Thống kê sàn', ids.buyer, {role:'admin'})).status,403)
  assert.equal((await call('Shop của tôi', ids.buyer, {role:'seller'})).status,403)
  assert.equal((await call('Shop của tôi')).status,401)
  assert.equal((await call('Shop của tôi', ids.seller, {userId:ids.other})).status,200)
  assert.ok(JSON.stringify(providerRequest.body).includes(`Sản phẩm shop ${ids.seller}`))
  assert.ok(!JSON.stringify(providerRequest.body).includes(`Sản phẩm shop ${ids.other}`))
  assert.ok(!JSON.stringify(providerRequest.body).includes('PRIVATE_SHOULD_NOT_SEND'))
  assert.equal((await call('Thống kê sàn', ids.admin)).status,200)
  assert.ok(JSON.stringify(providerRequest.body).includes('totalShops'))
  assert.ok(!JSON.stringify(providerRequest.body).includes('PRIVATE_SHOULD_NOT_SEND'))
  const myOrders=await call('Đơn hàng của tôi', ids.buyer, {userId:ids.other})
  assert.ok(myOrders.body.data.reply.includes(`ORDER-${ids.buyer}`))
  assert.ok(!myOrders.body.data.reply.includes(`ORDER-${ids.other}`))
  assert.equal((await call('Đơn hàng shop của tôi', ids.seller)).status,200)
  assert.equal((await call('Danh sách khách hàng', ids.admin)).status,200)
  assert.ok(!JSON.stringify(providerRequest.body).includes('test@example.invalid'))
  assert.equal((await call('Tra cứu tài khoản mã 25 và email', ids.admin)).status,200)
  assert.ok(JSON.stringify(providerRequest.body).includes('test@example.invalid'))
  assert.ok(!providerRequest.body.contents[0].parts[0].text.includes('\"phone\"'))
  assert.ok(JSON.stringify(providerRequest.body).includes('sample25'))
  assert.ok(!JSON.stringify(providerRequest.body).includes('sample24'))
  const beforeMissing = providerRequest
  const missing = await call('Tra cứu tài khoản mã 999', ids.admin)
  assert.equal(missing.status, 200)
  assert.ok(missing.body.data.reply.includes('Không tìm thấy'))
  assert.equal(providerRequest, beforeMissing)
  failCatalog=true
  const unavailableCatalog=await call('Tìm tai nghe')
  assert.equal(unavailableCatalog.status,503)
  assert.equal(unavailableCatalog.body.error.code,'DATA_API_UNAVAILABLE')
  failCatalog=false
  failProvider=true
  const unavailable=await call('Tìm tai nghe')
  assert.equal(unavailable.status,503)
  assert.equal(unavailable.body.error.code,'AI_UNAVAILABLE')
  console.log('PASS: chỉ gọi 3.1 Flash-Lite, phân quyền buyer/seller/admin, không dựng đơn hàng, báo lỗi AI (mock).')
} finally {
  globalThis.fetch=realFetch
  await new Promise(resolve=>server.close(resolve))
  await new Promise(resolve=>dataApi.close(resolve))
  for (const file of brainFiles) if (fs.existsSync(file)) fs.unlinkSync(file)
}
