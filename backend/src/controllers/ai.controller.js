import { randomUUID } from 'node:crypto'
import { callDataApi } from '../clients/data.client.js'
import { aiBrainService } from '../services/ai-brain.service.js'
import { generateGeminiShoppingAdvice } from '../services/gemini.service.js'
import { findCatalogProducts } from '../services/ai-catalog.service.js'

function extractUserKey(req) {
  return req.user?.id ? `account_${req.user.id}` : `guest_ephemeral_${randomUUID().replace(/-/g, '')}`
}

export async function chatWithAi(req, res, next) {
  let guestKey = null
  try {
    const { message = '', context = {}, history = [] } = req.body || {}
    const validHistory = (value) => Array.isArray(value) && value.length <= 20 && value.every((turn) =>
      turn && typeof turn === 'object' && !Array.isArray(turn) && typeof turn.isUser === 'boolean' &&
      typeof turn.text === 'string' && turn.text.length <= 4000)
    if (typeof message !== 'string' || message.trim().length > 4000 || !context || typeof context !== 'object' ||
        Array.isArray(context) || !validHistory(history) || (context.history !== undefined && !validHistory(context.history))) {
      return res.status(400).json({ success: false, message: 'Dữ liệu hội thoại không hợp lệ.', error: { code: 'VALIDATION_ERROR' } })
    }
    const query = message.trim()
    if (!query) return res.status(400).json({ success: false, message: 'Nội dung tin nhắn không được để trống.', error: { code: 'EMPTY_MESSAGE' } })

    const userKey = extractUserKey(req)
    if (!req.user) guestKey = userKey
    const { brain, newlyLearned, consultantInsights } = aiBrainService.learnFromMessage(userKey, query)
    const lower = query.toLowerCase()
    const sellerQuestion = ['shop của tôi', 'cửa hàng của tôi', 'gian hàng của tôi', 'sản phẩm của tôi', 'sản phẩm shop', 'đơn hàng shop', 'đơn hàng của shop'].some((text) => lower.includes(text))
    const adminQuestion = ['tra cứu tài khoản', 'tra cứu khách hàng', 'tra cứu người dùng', 'thống kê sàn', 'tổng quan sàn', 'toàn sàn', 'quản trị sàn', 'danh sách khách hàng', 'danh sách người dùng', 'danh sách tài khoản', 'danh sách shop', 'danh sách gian hàng', 'danh sách sản phẩm toàn sàn', 'báo cáo vi phạm', 'đánh giá toàn sàn'].some((text) => lower.includes(text))
    const isOrderQuestion = ['đơn hàng', 'đơn của tôi', 'mã đơn', 'vận đơn'].some((text) => lower.includes(text))
    const privilegedQuestion = sellerQuestion || adminQuestion
    let aiResult

    if (privilegedQuestion) {
      const role = req.user?.role
      const allowed = adminQuestion ? role === 'admin' : role === 'seller'
      if (!allowed) {
        return res.status(req.user ? 403 : 401).json({ success: false, message: 'Bạn không có quyền xem dữ liệu này.', error: { code: req.user ? 'FORBIDDEN' : 'AUTH_REQUIRED' } })
      }
      let businessContext
      const idMatch = query.match(/(?:#|mã\s*(?:số)?\s*)([1-9]\d{0,19})/i)
      const emailMatch = lower.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i)
      const phoneMatch = query.match(/\b0\d{8,10}\b/)
      const selectRecords = (records, idField = 'id') => {
        const matching = records.filter((record) => {
          if (idMatch && String(record[idField]) !== idMatch[1]) return false
          if (emailMatch && String(record.email || record.ownerEmail || '').toLowerCase() !== emailMatch[0]) return false
          if (phoneMatch && String(record.phone || record.ownerPhone || record.recipientPhone || '') !== phoneMatch[0]) return false
          return true
        })
        return matching.slice(0, 20)
      }
      const includeEmail = lower.includes('email') || lower.includes('liên hệ')
      const includePhone = lower.includes('điện thoại') || lower.includes('liên hệ')
      if (adminQuestion && ['khách hàng', 'người dùng', 'tài khoản'].some((term) => lower.includes(term))) {
        const result = await callDataApi('/internal/v1/admin/users')
        if (!Array.isArray(result?.users)) throw new Error('Invalid admin users')
        businessContext = { note: 'Tra cứu trong tối đa 500 tài khoản gần đây; mỗi lượt tối đa 20 kết quả', users: selectRecords(result.users).map((user) => ({ id: user.id, username: user.username, fullName: user.fullName, ...(includeEmail ? { email: user.email } : {}), ...(includePhone ? { phone: user.phone } : {}), role: user.role, status: user.status })) }
      } else if (adminQuestion && lower.includes('đơn hàng')) {
        const result = await callDataApi('/internal/v1/admin/orders')
        if (!Array.isArray(result?.orders)) throw new Error('Invalid admin orders')
        businessContext = { note: 'Tra cứu trong tối đa 200 đơn shop gần đây; mỗi lượt tối đa 20 kết quả', orders: selectRecords(result.orders, 'orderId').map((order) => ({ orderId: order.orderId, code: order.code, recipientName: order.recipientName, ...(includePhone ? { recipientPhone: order.recipientPhone } : {}), shopName: order.shopName, total: order.total, status: order.status })) }
      } else if (adminQuestion && ['danh sách shop', 'danh sách gian hàng', 'sản phẩm toàn sàn', 'báo cáo vi phạm', 'đánh giá toàn sàn'].some((term) => lower.includes(term))) {
        let resource
        let fields
        if (lower.includes('sản phẩm')) { resource = 'products'; fields = ['id', 'name', 'shopName', 'price', 'stock', 'status', 'approvalStatus'] }
        else if (lower.includes('báo cáo')) { resource = 'reports'; fields = ['id', 'targetType', 'targetName', 'shopName', 'reason', 'details', 'status'] }
        else if (lower.includes('đánh giá')) { resource = 'reviews'; fields = ['id', 'productName', 'shopName', 'username', 'rating', 'comment', 'status'] }
        else { resource = 'shops'; fields = ['id', 'name', 'ownerName', ...(includeEmail ? ['ownerEmail'] : []), ...(includePhone ? ['ownerPhone'] : []), 'status', 'productCount'] }
        const result = await callDataApi(`/internal/v1/admin/${resource}`)
        if (!Array.isArray(result?.[resource])) throw new Error('Invalid admin resource')
        businessContext = { note: 'Tra cứu trong tối đa 500 bản ghi gần đây; mỗi lượt tối đa 20 kết quả', [resource]: selectRecords(result[resource]).map((item) => Object.fromEntries(fields.filter((key) => item[key] !== undefined).map((key) => [key, item[key]]))) }
      } else if (adminQuestion) {
        const result = await callDataApi('/internal/v1/admin/stats')
        if (!result?.stats || !result?.orderStatusCounts) throw new Error('Invalid admin stats')
        const keys = ['totalShops', 'totalProducts', 'totalOrders', 'totalCustomers', 'totalRevenue']
        const statuses = ['pending', 'confirmed', 'shipping', 'delivered', 'cancelled']
        businessContext = { stats: Object.fromEntries(keys.filter((key) => Number.isFinite(result.stats[key])).map((key) => [key, result.stats[key]])), orderStatusCounts: Object.fromEntries(statuses.filter((key) => Number.isFinite(result.orderStatusCounts[key])).map((key) => [key, result.orderStatusCounts[key]])) }
      } else if (lower.includes('đơn hàng')) {
        const result = await callDataApi(`/internal/v1/seller/orders?userId=${encodeURIComponent(req.user.id)}&limit=20`)
        if (!result?.summary || !Array.isArray(result.orders)) throw new Error('Invalid seller orders')
        businessContext = { summary: result.summary, orders: result.orders.slice(0, 20).map((order) => ({ code: order.code, status: order.status, total: order.total, createdAt: order.createdAt })) }
      } else {
        const result = await callDataApi(`/internal/v1/seller/products?userId=${encodeURIComponent(req.user.id)}&limit=100`)
        if (!Array.isArray(result?.products)) throw new Error('Invalid seller products')
        businessContext = { total: result.total, products: result.products.slice(0, 20).map((product) => ({ id: product.id, name: product.name, price: product.price, stock: product.stock, status: product.status, approvalStatus: product.approvalStatus })) }
      }
      const selectedRecords = adminQuestion && (idMatch || emailMatch || phoneMatch)
        ? Object.values(businessContext).find(Array.isArray)
        : null
      if (selectedRecords && selectedRecords.length === 0) {
        aiResult = { reply: 'Không tìm thấy bản ghi phù hợp trong phạm vi dữ liệu đã truy vấn. Vui lòng kiểm tra mã hoặc tìm trong trang quản trị.', intent: 'business_info', intentTitle: 'Tra cứu quản trị', products: [] }
      } else {
        const response = await generateGeminiShoppingAdvice({ query, businessContext })
        if (!response?.reply) return res.status(503).json({ success: false, message: 'Nova AI tạm thời không khả dụng. Bạn hãy thử lại sau.', error: { code: 'AI_UNAVAILABLE' } })
        aiResult = { reply: response.reply, intent: 'business_info', intentTitle: adminQuestion ? 'Tổng quan ShopNova' : 'Gian hàng của bạn', poweredBy: response.modelUsed, products: [] }
      }
    } else if (isOrderQuestion) {
      if (!req.user) {
        aiResult = { reply: 'Bạn hãy đăng nhập và mở mục Đơn hàng để xem trạng thái đơn của mình.', intent: 'order_tracking', intentTitle: 'Thông tin đơn hàng', products: [] }
      } else {
        const result = await callDataApi(`/internal/v1/orders?userId=${encodeURIComponent(req.user.id)}&limit=5`)
        if (!Array.isArray(result?.orders)) throw new Error('Invalid orders')
        const orders = result.orders.map((order) => `${order.code}: ${order.status}`).join('; ')
        aiResult = { reply: orders ? `Các đơn gần đây của bạn: ${orders}. Bạn có thể xem chi tiết trong mục Đơn hàng.` : 'Bạn chưa có đơn hàng để hiển thị.', intent: 'order_tracking', intentTitle: 'Thông tin đơn hàng', products: [] }
      }
    } else {
      const catalog = await findCatalogProducts(query)
      const products = catalog.products
      const catalogAvailable = catalog.available
      if (catalogAvailable === false) return res.status(503).json({ success: false, message: 'Chưa thể lấy dữ liệu sản phẩm ShopNova. Bạn hãy thử lại sau.', error: { code: 'DATA_API_UNAVAILABLE' } })
      const ranked = aiBrainService.rankProductsByUserHabits(userKey, products, consultantInsights).slice(0, 5)
      const recentHistory = (context.history || history).map((turn) => ({
        userQuery: turn.isUser ? turn.text : undefined,
        aiReply: turn.isUser ? undefined : turn.text,
      }))
      const response = await generateGeminiShoppingAdvice({
        query,
        conversationHistory: [...(brain.conversationHistory || []), ...recentHistory],
        brainProfile: brain.profile,
        catalogProducts: ranked,
        catalogPartial: catalog.partial,
        consultantInsights,
      })
      if (!response?.reply) {
        return res.status(503).json({ success: false, message: 'Nova AI tạm thời không khả dụng. Bạn hãy thử lại sau.', error: { code: 'AI_UNAVAILABLE' } })
      }
      aiResult = {
        reply: response.reply,
        intent: 'product_recommendation',
        intentTitle: 'Tư vấn mua sắm ShopNova',
        poweredBy: response.modelUsed,
        catalogAvailable,
        catalogPartial: catalog.partial,
        products: ranked.map((product) => ({
          id: product.id, name: product.name, price: product.price,
          originalPrice: product.originalPrice, rating: product.rating, sold: product.sold,
          mall: product.shopMall, imageUrl: product.images?.[0]?.url, categoryName: product.categoryName,
        })),
      }
    }
    if (!privilegedQuestion && !isOrderQuestion) aiBrainService.recordConversationTurn(userKey, { userQuery: query, aiReply: aiResult.reply, intent: aiResult.intent, products: aiResult.products })
    aiResult.brain = {
      learnedFacts: brain.profile.learnedFacts, preferredStyles: brain.profile.preferredStyles,
      location: brain.profile.location, stats: brain.stats, newlyLearned, consultantInsights,
    }
    return res.status(200).json({ success: true, data: aiResult })
  } catch (err) {
    return next(err)
  } finally {
    if (guestKey) aiBrainService.forgetEphemeral(guestKey)
  }
}

/**
 * Lấy hồ sơ bộ não AI đã học được về người dùng
 * GET /api/v1/ai/brain/profile
 */
export function getAiBrainProfile(req, res) {
  const userKey = extractUserKey(req)
  const brain = aiBrainService.getBrain(userKey)
  return res.status(200).json({
    success: true,
    data: {
      userId: userKey,
      profile: brain.profile,
      confirmedCriteria: brain.confirmedCriteria,
      activeFocus: brain.activeFocus,
      stats: brain.stats,
      recentTurnsCount: brain.conversationHistory.length,
      updatedAt: brain.updatedAt,
    },
  })
}

/**
 * Ghi nhận phản hồi (Thích / Không thích / Thêm giỏ) để AI tự điều chỉnh
 * POST /api/v1/ai/brain/feedback
 */
export function recordAiBrainFeedback(req, res) {
  const userKey = extractUserKey(req)
  const { action = 'like', query = '', productId = null, helpful = true } = req.body || {}
  if (!['like', 'dislike', 'add_to_cart'].includes(action) || typeof query !== 'string' || query.length > 4000 ||
      (productId !== null && (typeof productId !== 'string' || productId.length > 160)) || typeof helpful !== 'boolean') {
    return res.status(400).json({ success: false, message: 'Phản hồi không hợp lệ.', error: { code: 'VALIDATION_ERROR' } })
  }
  const stats = aiBrainService.recordFeedback(userKey, { action, query, productId, helpful })
  return res.status(200).json({
    success: true,
    message: 'Đã lưu phản hồi vào bộ não AI thành công.',
    data: { stats },
  })
}

/**
 * Xóa hoặc đặt lại ký ức bộ não AI
 * DELETE /api/v1/ai/brain/reset
 */
export function resetAiBrain(req, res) {
  const userKey = extractUserKey(req)
  const newBrain = aiBrainService.resetBrain(userKey)
  return res.status(200).json({
    success: true,
    message: 'Đã làm mới ký ức của Nova AI thành công.',
    data: {
      profile: newBrain.profile,
      confirmedCriteria: newBrain.confirmedCriteria,
      stats: newBrain.stats,
    },
  })
}
