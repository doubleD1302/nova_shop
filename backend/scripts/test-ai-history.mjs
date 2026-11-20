import assert from 'node:assert/strict'
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// Kiểm tra lịch sử trò chuyện Nova AI và cách lấy dữ liệu theo yêu cầu. Data API và Gemini đều là giả lập.
const baseId = String(Date.now()) + String(Math.floor(Math.random() * 10000)).padStart(4, '0')
const ids = { buyer: baseId + '1', other: baseId + '2', admin: baseId + '3' }
const brainDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../data/ai-brains')
const brainFiles = Object.values(ids).map((id) => path.join(brainDir, `account_${id}.json`))

// Kho hội thoại trong bộ nhớ, mô phỏng hợp đồng /internal/v1/ai/conversations của Data API.
const store = { nextConversation: 1, nextMessage: 1, conversations: [], messages: [] }
let failSave = false
let failHistory = false
const productRequests = []
const sendJson = (res, status, body) => { res.statusCode = status; res.setHeader('content-type', 'application/json'); res.end(JSON.stringify(body)) }
const toConversation = (c) => ({ id: String(c.id), title: c.title, messageCount: c.count, lastMessageAt: c.lastMessageAt, createdAt: c.lastMessageAt })

const dataApi = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost')
  let raw = ''
  req.on('data', (chunk) => { raw += chunk })
  req.on('end', () => {
    const body = raw ? JSON.parse(raw) : {}
    const auth = url.pathname.match(/^\/internal\/v1\/users\/(\d+)\/auth-profile$/)
    if (auth) {
      const role = auth[1] === ids.admin ? 'admin' : 'buyer'
      return sendJson(res, 200, { success: true, data: { user: { id: auth[1], username: `t${auth[1]}`, fullName: 'Test', email: null, phone: null, avatarUrl: null, role, status: 'active', shopId: null, address: null } } })
    }
    if (url.pathname.startsWith('/internal/v1/ai/conversations')) {
      if (failHistory) return sendJson(res, 503, { success: false, error: { code: 'DATA_STORAGE_UNAVAILABLE' }, message: 'down' })
      const userId = url.searchParams.get('userId') || body.userId
      const match = url.pathname.match(/^\/internal\/v1\/ai\/conversations(?:\/(\d+))?(\/messages)?$/)
      const conversation = match?.[1] ? store.conversations.find((c) => String(c.id) === match[1] && c.userId === userId) : null
      if (match?.[1] && !conversation) return sendJson(res, 404, { success: false, message: 'x', error: { code: 'CONVERSATION_NOT_FOUND' } })
      if (req.method === 'GET' && !match[1]) {
        const mine = store.conversations.filter((c) => c.userId === userId).sort((a, b) => b.id - a.id)
        const limit = Number(url.searchParams.get('limit'))
        return sendJson(res, 200, { success: true, data: { conversations: mine.slice(0, limit).map(toConversation), total: mine.length, limit, offset: 0 } })
      }
      if (req.method === 'POST' && !match[1]) {
        const created = { id: store.nextConversation++, userId, title: body.title, count: 0, lastMessageAt: new Date().toISOString() }
        store.conversations.push(created)
        return sendJson(res, 201, { success: true, data: { conversation: toConversation(created) } })
      }
      if (req.method === 'GET' && match[2]) {
        const limit = Number(url.searchParams.get('limit'))
        const rows = store.messages.filter((m) => m.conversationId === conversation.id).slice(-limit)
        return sendJson(res, 200, { success: true, data: { conversation: toConversation(conversation), messages: rows.map((m) => ({ id: String(m.id), role: m.role, content: m.content, intent: m.intent, metadata: m.metadata, createdAt: m.createdAt })), hasMore: false } })
      }
      if (req.method === 'POST' && match[2]) {
        if (failSave) return sendJson(res, 503, { success: false, error: { code: 'DATA_STORAGE_UNAVAILABLE' }, message: 'down' })
        for (const message of body.messages) store.messages.push({ id: store.nextMessage++, conversationId: conversation.id, role: message.role, content: message.content, intent: message.intent || null, metadata: message.metadata || null, createdAt: new Date().toISOString() })
        conversation.count += body.messages.length
        conversation.lastMessageAt = new Date().toISOString()
        return sendJson(res, 201, { success: true, data: { conversation: toConversation(conversation) } })
      }
      if (req.method === 'DELETE') {
        store.messages = store.messages.filter((m) => m.conversationId !== conversation.id)
        store.conversations = store.conversations.filter((c) => c.id !== conversation.id)
        return sendJson(res, 200, { success: true, data: { deleted: true } })
      }
    }
    if (url.pathname === '/internal/v1/products') {
      productRequests.push(Object.fromEntries(url.searchParams))
      const products = url.searchParams.get('ids') === '1'
        ? [{ id: '1', name: 'Tai nghe kiểm thử', price: 199000, categoryName: 'Điện tử', shopName: 'Shop A', stock: 7, rating: 4.5, sold: 20, variants: [{ id: '11', name: 'Đen', attributes: { color: 'Đen' }, price: 199000, stock: 7 }] }]
        : url.searchParams.get('location') ? []
          : [{ id: '1', name: 'Tai nghe kiểm thử', price: 199000, categoryName: 'Điện tử', images: [], stock: 7, location: 'TP. Hồ Chí Minh' }]
      return sendJson(res, 200, { success: true, data: { products, total: products.length } })
    }
    if (url.pathname === '/internal/v1/orders') {
      const orders = [
        { code: 'NOVA1ABC', status: 'shipping', total: 350000, createdAt: '2026-11-18T03:00:00.000Z', items: [{ name: 'Áo thun', qty: 2 }], payment: 'cod', shippingUnit: 'GHN', statusHistory: [{ status: 'shipping', at: '2026-11-19T03:00:00.000Z' }] },
        { code: 'NOVA2XYZ', status: 'cancelled', total: 120000, createdAt: '2026-11-10T03:00:00.000Z', items: [] },
      ]
      return sendJson(res, 200, { success: true, data: { orders, total: 2 } })
    }
    if (url.pathname === '/internal/v1/ai/admin/search') {
      return sendJson(res, 200, { success: true, data: { items: [{ id: '5', username: 'khach5', fullName: 'Nguyen Van Bi Mat', email: 'bimat@example.invalid', role: 'buyer', status: 'active' }], total: 1, limit: 20, offset: 0, hasMore: false } })
    }
    return sendJson(res, 404, { success: false })
  })
})
await new Promise((resolve) => dataApi.listen(0, '127.0.0.1', resolve))
Object.assign(process.env, { NODE_ENV: 'test', DOTENV_CONFIG_PATH: 'missing-ai-history-test.env', DATA_API_URL: `http://127.0.0.1:${dataApi.address().port}`, DATA_API_KEY: 'ai-history-test-key', JWT_SECRET: 'ai-history-test-jwt-secret-32-characters', GEMINI_API_KEY: 'mock-test-key', GEMINI_API_KEYS: '' })

const realFetch = globalThis.fetch
let providerRequest
globalThis.fetch = async (url, options) => {
  if (String(url).startsWith('https://generativelanguage.googleapis.com/')) {
    providerRequest = JSON.parse(options.body)
    return Response.json({ candidates: [{ content: { parts: [{ text: 'Nova trả lời kiểm thử.' }] } }] })
  }
  return realFetch(url, options)
}
const { default: app } = await import('../src/app.js')
const { signAccessToken } = await import('../src/middlewares/auth.middleware.js')
const server = http.createServer(app)
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
const api = `http://127.0.0.1:${server.address().port}/api/v1/ai`
const call = async (method, route, { user, body } = {}) => {
  const response = await realFetch(api + route, {
    method,
    headers: { 'content-type': 'application/json', ...(user ? { authorization: `Bearer ${signAccessToken({ id: user, role: 'buyer' })}` } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
  return { status: response.status, body: await response.json() }
}
const chat = (message, user, extra = {}) => call('POST', '/chat', { user, body: { message, ...extra } })
const promptOf = () => providerRequest.contents.at(-1).parts[0].text

try {
  // 1. Khách chưa đăng nhập: không có lịch sử
  const guest = await chat('Tìm tai nghe')
  assert.equal(guest.status, 200)
  assert.equal(guest.body.data.conversationId, undefined)
  assert.equal(store.conversations.length, 0)
  assert.equal((await call('GET', '/conversations')).status, 401)

  // 2. Người đăng nhập: tự tạo cuộc trò chuyện và lưu cả câu hỏi lẫn trả lời, kèm thẻ sản phẩm
  const first = await chat('Tìm tai nghe', ids.buyer)
  assert.equal(first.status, 200)
  assert.equal(first.body.data.historySaved, true)
  const conversationId = first.body.data.conversationId
  assert.equal(store.conversations.length, 1)
  assert.equal(store.conversations[0].title, 'Tìm tai nghe')
  assert.deepEqual(store.messages.map((m) => m.role), ['user', 'assistant'])
  assert.equal(store.messages[1].metadata.products[0].id, '1')
  assert.deepEqual(store.messages[1].metadata.catalog, { page: 1, hasMore: false })
  assert.equal(providerRequest.generationConfig.temperature, 0.3)
  assert.equal(providerRequest.generationConfig.maxOutputTokens, 1024)

  // 3. Tin tiếp theo (không gửi conversationId) nối vào cuộc cũ và Gemini nhận lịch sử theo từng lượt user/model;
  //    lịch sử client gửi bị bỏ qua vì server đã có bản đáng tin hơn. Hỏi về giá nạp dữ liệu sản phẩm thật kèm biến thể.
  productRequests.length = 0
  const second = await chat('Giá bao nhiêu?', ids.buyer, { history: [{ isUser: true, text: 'LICH_SU_GIA_TU_CLIENT' }] })
  assert.equal(second.body.data.conversationId, conversationId)
  assert.equal(store.conversations.length, 1)
  assert.deepEqual(providerRequest.contents.map((c) => c.role), ['user', 'model', 'user'])
  assert.equal(providerRequest.contents[0].parts[0].text, 'Tìm tai nghe')
  assert.ok(!JSON.stringify(providerRequest).includes('LICH_SU_GIA_TU_CLIENT'))
  assert.ok(productRequests.some((request) => request.ids === '1'), 'phải nạp sản phẩm đang bàn tới theo id')
  assert.ok(promptOf().includes('"variants":[{"name":"Đen"'))
  assert.equal(store.conversations[0].count, 4)

  // 4. Xem lại lịch sử qua API của Backend
  const list = await call('GET', '/conversations', { user: ids.buyer })
  assert.equal(list.body.data.conversations.length, 1)
  assert.equal(list.body.data.pagination.total, 1)
  const messages = await call('GET', `/conversations/${conversationId}/messages`, { user: ids.buyer })
  assert.equal(messages.body.data.messages.length, 4)
  assert.equal(messages.body.data.messages[3].role, 'assistant')
  assert.equal((await call('GET', '/conversations?limit=51', { user: ids.buyer })).status, 400)
  assert.equal((await call('GET', '/conversations/abc/messages', { user: ids.buyer })).status, 400)

  // 5. Người khác không dùng được cuộc trò chuyện này
  assert.equal((await call('GET', `/conversations/${conversationId}/messages`, { user: ids.other })).status, 404)
  const stolen = await chat('Xin chào', ids.other, { conversationId })
  assert.equal(stolen.status, 404)
  assert.equal(stolen.body.error.code, 'CONVERSATION_NOT_FOUND')
  assert.equal((await call('DELETE', `/conversations/${conversationId}`, { user: ids.other })).status, 404)
  assert.equal((await chat('Xin chào', ids.buyer, { conversationId: 'abc' })).status, 400)
  assert.equal((await chat('Xin chào', ids.buyer, { newConversation: 'yes' })).status, 400)

  // 6. newConversation tách cuộc mới, ngữ cảnh không lẫn cuộc cũ
  const fresh = await chat('Xin chào Nova', ids.buyer, { newConversation: true })
  assert.notEqual(fresh.body.data.conversationId, conversationId)
  assert.deepEqual(providerRequest.contents.map((c) => c.role), ['user'])
  assert.equal(store.conversations.length, 2)

  // 7. Lỗi lưu không làm hỏng câu trả lời
  failSave = true
  const unsaved = await chat('Xin chào lần nữa', ids.buyer)
  assert.equal(unsaved.status, 200)
  assert.equal(unsaved.body.data.historySaved, false)
  failSave = false
  // Lỗi tải lịch sử: vẫn trả lời, dùng history client gửi
  failHistory = true
  const degraded = await chat('Xin chào', ids.buyer, { history: [{ isUser: true, text: 'Tôi cần tư vấn' }, { isUser: false, text: 'Nova có thể giúp gì?' }] })
  assert.equal(degraded.status, 200)
  assert.equal(degraded.body.data.historySaved, false)
  assert.deepEqual(providerRequest.contents.map((c) => c.role), ['user', 'model', 'user'])
  failHistory = false

  // 8. Tra cứu quản trị không lưu nội dung chứa dữ liệu người khác
  const adminBefore = store.messages.length
  const lookup = await chat('Tra cứu tài khoản mã 5 và email', ids.admin)
  assert.equal(lookup.status, 200)
  assert.equal(lookup.body.data.historySaved, true)
  const stored = JSON.stringify(store.messages.slice(adminBefore))
  assert.ok(!stored.includes('bimat@example.invalid'))
  assert.ok(!stored.includes('Tra cứu tài khoản'))
  assert.ok(JSON.stringify(providerRequest).includes('bimat@example.invalid'), 'Gemini vẫn nhận dữ liệu để trả lời ngay lượt này')

  // 9. Lọc theo giá và sắp xếp được chuyển cho Data API, giữ đúng thứ tự khách yêu cầu
  productRequests.length = 0
  await chat('Tìm tai nghe dưới 300 nghìn', ids.buyer, { newConversation: true })
  assert.ok(productRequests.length > 0 && productRequests.every((request) => request.maxPrice === '300000'))
  assert.ok(promptOf().includes('giá tối đa 300.000₫'))
  productRequests.length = 0
  await chat('Tìm tai nghe rẻ nhất', ids.buyer, { newConversation: true })
  assert.ok(productRequests.every((request) => request.sort === 'price-asc'))
  // Câu nối tiếp không có tên sản phẩm dùng lại câu tìm trước đó
  productRequests.length = 0
  await chat('Tìm tai nghe dưới 500k', ids.buyer, { newConversation: true })
  productRequests.length = 0
  await chat('có mẫu rẻ hơn không', ids.buyer)
  assert.ok(productRequests.some((request) => request.q === 'tai') && productRequests.every((request) => request.sort === 'price-asc'))

  // 9b. Địa điểm là ưu tiên mềm: không có ở Hà Nội thì gợi ý nơi khác và Nova được dặn nói rõ
  productRequests.length = 0
  const relaxed = await chat('Tìm tai nghe ở Hà Nội', ids.buyer, { newConversation: true })
  assert.equal(relaxed.body.data.catalogLocationRelaxed, true)
  assert.equal(relaxed.body.data.products[0].location, 'TP. Hồ Chí Minh')
  assert.ok(productRequests.some((request) => request.location === 'Hà Nội') && productRequests.some((request) => !request.location))
  assert.ok(promptOf().includes('KHÔNG có sản phẩm khớp ở đó') && promptOf().includes('Hà Nội'))
  // "tai nghe khác" giữ khu vực và giá của câu trước
  productRequests.length = 0
  await chat('có tai nghe khác không', ids.buyer)
  assert.ok(productRequests.some((request) => request.location === 'Hà Nội'))

  // 10. Đơn hàng của người mua: theo mã, theo trạng thái, đúng nhãn tiếng Việt
  const byCode = await chat('Đơn NOVA1ABC đến đâu rồi?', ids.buyer)
  assert.ok(byCode.body.data.reply.includes('Đang giao') && byCode.body.data.reply.includes('Áo thun x2') && byCode.body.data.reply.includes('GHN'))
  assert.ok(!byCode.body.data.reply.includes('NOVA2XYZ'))
  const missingCode = await chat('Kiểm tra đơn hàng NOVA9NONE', ids.buyer)
  assert.ok(missingCode.body.data.reply.includes('không thấy đơn mã NOVA9NONE'))
  const shipping = await chat('Đơn hàng đang giao của tôi', ids.buyer)
  assert.ok(shipping.body.data.reply.includes('NOVA1ABC') && !shipping.body.data.reply.includes('NOVA2XYZ'))

  // 11. Xóa cuộc trò chuyện
  const before = store.messages.length
  assert.equal((await call('DELETE', `/conversations/${conversationId}`, { user: ids.buyer })).status, 200)
  assert.ok(store.messages.length < before)
  assert.equal((await call('GET', `/conversations/${conversationId}/messages`, { user: ids.buyer })).status, 404)
  console.log('PASS: lịch sử Nova AI theo tài khoản, ngữ cảnh đa lượt, lọc giá/sắp xếp, dữ liệu sản phẩm cho câu nối tiếp, đơn hàng (Data API và Gemini giả lập).')
} finally {
  globalThis.fetch = realFetch
  await new Promise((resolve) => server.close(resolve))
  await new Promise((resolve) => dataApi.close(resolve))
  for (const file of brainFiles) if (fs.existsSync(file)) fs.unlinkSync(file)
}
