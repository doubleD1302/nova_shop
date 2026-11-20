import { randomUUID } from 'node:crypto'
import { callDataApi, DataApiClientError } from '../clients/data.client.js'
import { aiBrainService } from '../services/ai-brain.service.js'
import { generateGeminiShoppingAdvice } from '../services/gemini.service.js'
import { extractSearchTerms, findCatalogProducts, findProductsByIds } from '../services/ai-catalog.service.js'
import { analyzeConsultantNeeds } from '../services/consultant-knowledge.js'
import { loadConversation, saveTurn } from '../services/ai-history.service.js'
import { buildBuyerOrderReply } from '../services/ai-orders.service.js'

function extractUserKey(req) {
  return req.user?.id ? `account_${req.user.id}` : `guest_ephemeral_${randomUUID().replace(/-/g, '')}`
}

const PAGE_FOLLOW_UP = /^\s*(?:xem\s+)?trang\s+\d+\s*$/i
const validId = (value) => (typeof value === 'string' || Number.isSafeInteger(value)) && /^[1-9]\d{0,19}$/.test(String(value))

// Câu hỏi tìm sản phẩm gần nhất có tên sản phẩm cụ thể, để hiểu các câu nối tiếp như "gợi ý thêm".
function lastProductQuestion(turns) {
  const turn = [...turns].reverse().find((item) => item.isUser && !PAGE_FOLLOW_UP.test(item.text) &&
    extractSearchTerms(item.text).length > 0 && analyzeConsultantNeeds(item.text.toLowerCase(), {}).wantsProductRecommendations)
  return turn?.text || ''
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

    // conversationId/newConversation chỉ có tác dụng với tài khoản đã đăng nhập; khách không được lưu lịch sử.
    const conversationId = req.body?.conversationId ?? context.conversationId
    const newConversation = req.body?.newConversation ?? context.newConversation ?? false
    if ((conversationId != null && !validId(conversationId)) || typeof newConversation !== 'boolean' ||
        (context.productId != null && !validId(context.productId))) {
      return res.status(400).json({ success: false, message: 'Dữ liệu hội thoại không hợp lệ.', error: { code: 'VALIDATION_ERROR' } })
    }

    const userKey = extractUserKey(req)
    if (!req.user) guestKey = userKey

    // Tài khoản đăng nhập: ngữ cảnh lấy từ lịch sử đã lưu trên server (không tin client). Khách hoặc lỗi tải: dùng history client gửi.
    let conversation = { conversationId: null, turns: [], productIds: [] }
    if (req.user) {
      try {
        conversation = await loadConversation(req.user.id, { conversationId: conversationId == null ? null : String(conversationId), newConversation })
      } catch (err) {
        // Cuộc trò chuyện không thuộc tài khoản phải báo lỗi; lỗi dịch vụ khác thì vẫn trả lời bằng ngữ cảnh client gửi.
        if (err instanceof DataApiClientError && err.code === 'CONVERSATION_NOT_FOUND') throw err
      }
    }
    const clientTurns = context.history || history
    const turns = conversation.turns.length ? conversation.turns : clientTurns
    const allTurns = [...conversation.turns, ...clientTurns]
    const previousQuestion = [...allTurns].reverse().find(turn => turn.isUser && !PAGE_FOLLOW_UP.test(turn.text))?.text || ''
    const isPageFollowUp = PAGE_FOLLOW_UP.test(query)
    const searchQuery = isPageFollowUp && previousQuestion ? `${previousQuestion} ${query}` : query
    const lower = searchQuery.toLowerCase()
    const sellerQuestion = ['shop của tôi', 'shop của mình', 'cửa hàng của tôi', 'cửa hàng của mình', 'gian hàng của tôi', 'sản phẩm của tôi', 'sản phẩm shop', 'sản phẩm trong shop', 'đơn hàng shop', 'đơn hàng của shop', 'đơn shop'].some((text) => lower.includes(text))
    const adminQuestion = (req.user?.role === 'admin' && ['khách hàng', 'người dùng', 'tài khoản'].some(term => lower.includes(term))) || ['tra cứu tài khoản', 'tra cứu khách hàng', 'tra cứu người dùng', 'thống kê sàn', 'tổng quan sàn', 'toàn sàn', 'quản trị sàn', 'danh sách khách hàng', 'danh sách người dùng', 'danh sách tài khoản', 'danh sách shop', 'danh sách gian hàng', 'danh sách sản phẩm toàn sàn', 'báo cáo vi phạm', 'đánh giá toàn sàn'].some((text) => lower.includes(text))
    const buyerOrderCode = searchQuery.match(/\b(?:NOVA|ORD)[A-Z0-9-]{4,40}\b/i)?.[0] || null
    const isOrderQuestion = ['đơn hàng', 'đơn của tôi', 'mã đơn', 'vận đơn'].some((text) => lower.includes(text)) || buyerOrderCode !== null
    const privilegedQuestion = sellerQuestion || adminQuestion
    const pageMatch = query.toLowerCase().match(/\btrang\s+(\d+)\b/)
    const page = pageMatch ? Number(pageMatch[1]) : 1
    const offset = (page - 1) * 20
    if (!Number.isSafeInteger(offset) || page < 1) return res.status(400).json({ success: false, message: 'Trang không hợp lệ.', error: { code: 'VALIDATION_ERROR' } })
    if (privilegedQuestion) {
      const allowed = adminQuestion ? req.user?.role === 'admin' : req.user?.role === 'seller'
      if (!allowed) return res.status(req.user ? 403 : 401).json({ success: false, message: 'Bạn không có quyền xem dữ liệu này.', error: { code: req.user ? 'FORBIDDEN' : 'AUTH_REQUIRED' } })
    }
    const { brain, newlyLearned, consultantInsights } = aiBrainService.learnFromMessage(userKey, query)
    let aiResult

    if (privilegedQuestion) {
      let businessContext
      const idMatch = searchQuery.match(/(?:#|mã\s*(?:(?:số|đơn(?:\s+hàng)?|tài\s+khoản|sản\s+phẩm)\s*)?)([1-9]\d{0,19})/i)
      const emailMatch = lower.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i)
      const phoneMatch = searchQuery.match(/\b0\d{8,10}\b/)
      const codeMatch = searchQuery.match(/\bORD-[A-Za-z0-9-]{1,28}\b/i)
      const includeEmail = lower.includes('email') || lower.includes('liên hệ')
      const includePhone = lower.includes('điện thoại') || lower.includes('liên hệ')
      const includeAddress = lower.includes('địa chỉ')
      if (adminQuestion && ['khách hàng', 'người dùng', 'tài khoản', 'đơn hàng', 'danh sách shop', 'danh sách gian hàng', 'sản phẩm toàn sàn', 'báo cáo vi phạm', 'đánh giá toàn sàn'].some((term) => lower.includes(term))) {
        let resource
        let fields
        if (['khách hàng', 'người dùng', 'tài khoản'].some(term => lower.includes(term))) { resource = 'users'; fields = ['id', 'username', 'fullName', ...(includeEmail ? ['email'] : []), ...(includePhone ? ['phone'] : []), 'role', 'status'] }
        else if (lower.includes('đơn hàng')) { resource = 'orders'; fields = ['orderId', 'shopOrderId', 'code', 'recipientName', ...(includePhone ? ['recipientPhone'] : []), ...(includeAddress ? ['address', 'province', 'district', 'ward'] : []), 'shopName', 'total', 'status'] }
        else if (lower.includes('sản phẩm')) { resource = 'products'; fields = ['id', 'name', 'shopName', 'status', 'description', 'specs', 'price', 'stock'] }
        else if (lower.includes('báo cáo')) { resource = 'reports'; fields = ['id', 'targetType', 'targetId', 'shopId', 'reason', 'details', 'status'] }
        else if (lower.includes('đánh giá')) { resource = 'reviews'; fields = ['id', 'productName', 'shopName', 'username', 'rating', 'comment', 'status'] }
        else { resource = 'shops'; fields = ['id', 'name', 'ownerName', 'description', ...(includeAddress ? ['address', 'location'] : []), ...(includeEmail ? ['ownerEmail'] : []), ...(includePhone ? ['ownerPhone'] : []), 'status'] }
        const params = new URLSearchParams({ actorId: String(req.user.id), resource, limit: '20', offset: String(offset) })
        if (idMatch) params.set('id', idMatch[1])
        if (emailMatch) params.set('email', emailMatch[0])
        if (phoneMatch) params.set('phone', phoneMatch[0])
        if (codeMatch && resource === 'orders') params.set('code', codeMatch[0].toUpperCase())
        const result = await callDataApi(`/internal/v1/ai/admin/search?${params}`)
        if (!Array.isArray(result?.items) || !Number.isSafeInteger(result.total) || typeof result.hasMore !== 'boolean') throw new Error('Invalid admin search')
        businessContext = { note: resource === 'orders' ? 'Mỗi bản ghi là đơn của một shop; một đơn tổng có thể có nhiều bản ghi. Chỉ có dữ liệu trang hiện tại.' : 'Dữ liệu chỉ thuộc trang được yêu cầu. Không suy đoán bản ghi của trang khác.', page, total: result.total, hasMore: result.hasMore, [resource]: result.items.map(item => Object.fromEntries(fields.filter(key => item[key] !== undefined).map(key => [key, item[key]]))) }
      } else if (adminQuestion) {
        const result = await callDataApi('/internal/v1/admin/stats')
        if (!result?.stats || !result?.orderStatusCounts) throw new Error('Invalid admin stats')
        const keys = ['totalShops', 'totalProducts', 'totalOrders', 'totalCustomers', 'totalRevenue']
        const statuses = ['pending', 'confirmed', 'shipping', 'delivered', 'cancelled']
        businessContext = { stats: Object.fromEntries(keys.filter(key => Number.isFinite(result.stats[key])).map(key => [key, result.stats[key]])), orderStatusCounts: Object.fromEntries(statuses.filter(key => Number.isFinite(result.orderStatusCounts[key])).map(key => [key, result.orderStatusCounts[key]])) }
      } else if (lower.includes('đơn hàng')) {
        const result = await callDataApi(`/internal/v1/seller/orders?userId=${encodeURIComponent(req.user.id)}&limit=20&offset=${offset}`)
        if (!result?.summary || !Array.isArray(result.orders)) throw new Error('Invalid seller orders')
        businessContext = { page, total: result.total, hasMore: offset + result.orders.length < result.total, summary: result.summary, orders: result.orders.map(order => ({ code: order.code, status: order.status, total: order.total, createdAt: order.createdAt })) }
      } else {
        const result = await callDataApi(`/internal/v1/seller/products?userId=${encodeURIComponent(req.user.id)}&limit=20&offset=${offset}`)
        if (!Array.isArray(result?.products)) throw new Error('Invalid seller products')
        businessContext = { page, total: result.total, hasMore: offset + result.products.length < result.total, products: result.products.map(product => ({ id: product.id, name: product.name, price: product.price, stock: product.stock, status: product.status, approvalStatus: product.approvalStatus })) }
      }
      const pagination = Number.isSafeInteger(businessContext.total) && typeof businessContext.hasMore === 'boolean'
        ? { page, total: businessContext.total, hasMore: businessContext.hasMore }
        : undefined
      const selectedRecords = adminQuestion && (idMatch || emailMatch || phoneMatch || codeMatch)
        ? Object.values(businessContext).find(Array.isArray)
        : null
      if (selectedRecords && selectedRecords.length === 0) {
        aiResult = { reply: 'Không tìm thấy bản ghi phù hợp tại trang được yêu cầu. Vui lòng kiểm tra thông tin hoặc trang khác.', intent: 'business_info', intentTitle: 'Tra cứu quản trị', products: [], pagination }
      } else {
        const response = await generateGeminiShoppingAdvice({ query, businessContext })
        if (!response?.reply) return res.status(503).json({ success: false, message: 'Nova AI tạm thời không khả dụng. Bạn hãy thử lại sau.', error: { code: 'AI_UNAVAILABLE' } })
        aiResult = { reply: response.reply, intent: 'business_info', intentTitle: adminQuestion ? 'Tổng quan ShopNova' : 'Gian hàng của bạn', poweredBy: response.modelUsed, products: [], pagination }
      }
    } else if (isOrderQuestion) {
      if (!req.user) {
        aiResult = { reply: 'Bạn hãy đăng nhập và mở mục Đơn hàng để xem trạng thái đơn của mình.', intent: 'order_tracking', intentTitle: 'Thông tin đơn hàng', products: [] }
      } else {
        // Hỏi theo mã đơn: lấy 100 đơn gần nhất rồi tìm đúng mã, vì Data API chưa có bộ lọc theo mã.
        const result = await callDataApi(`/internal/v1/orders?userId=${encodeURIComponent(req.user.id)}&limit=${buyerOrderCode ? 100 : 20}&offset=${buyerOrderCode ? 0 : offset}`)
        if (!Array.isArray(result?.orders) || !Number.isSafeInteger(result.total)) throw new Error('Invalid orders')
        const { reply, pagination } = buildBuyerOrderReply({ result, text: query, code: buyerOrderCode, page, offset: buyerOrderCode ? 0 : offset })
        aiResult = { reply, intent: 'order_tracking', intentTitle: 'Thông tin đơn hàng', products: [], pagination: buyerOrderCode ? undefined : pagination }
      }
    } else {
      const wantsProducts = consultantInsights?.wantsProductRecommendations === true
      let ranked = []
      let catalogAvailable = null
      let catalogPartial = false
      let catalogHasMore = null

      let searchFilters = {}

      if (wantsProducts) {
        // Câu như "gợi ý thêm", "rẻ hơn không" không có tên sản phẩm: dùng lại câu tìm sản phẩm gần nhất.
        const priorProductQuestion = isPageFollowUp || extractSearchTerms(searchQuery).length > 0 ? '' : lastProductQuestion(allTurns)
        const catalog = await findCatalogProducts(priorProductQuestion ? `${priorProductQuestion} ${searchQuery}` : searchQuery, page)
        const products = catalog.products
        catalogAvailable = catalog.available
        if (catalogAvailable === false) return res.status(503).json({ success: false, message: 'Chưa thể lấy dữ liệu sản phẩm ShopNova. Bạn hãy thử lại sau.', error: { code: 'DATA_API_UNAVAILABLE' } })
        catalogPartial = catalog.partial
        catalogHasMore = catalog.hasMore
        searchFilters = catalog.filters
        // Khách yêu cầu sắp xếp rõ ràng (rẻ nhất, bán chạy...) thì giữ thứ tự đó, không xếp lại theo thói quen.
        ranked = (searchFilters.sort ? products : aiBrainService.rankProductsByUserHabits(userKey, products, consultantInsights)).slice(0, 15)
      }

      // Câu hỏi tiếp nối ("có màu đen không?") hoặc hỏi từ trang sản phẩm: nạp dữ liệu thật của sản phẩm đang bàn tới.
      let focusProducts = []
      if (context.productId != null || (!wantsProducts && consultantInsights?.isFollowUp)) {
        const focusIds = context.productId != null ? [String(context.productId)]
          : conversation.productIds.length ? conversation.productIds
            : [brain.activeFocus?.lastDiscussedProductId]
        focusProducts = await findProductsByIds(focusIds.filter(Boolean))
      }

      const response = await generateGeminiShoppingAdvice({
        query,
        conversationHistory: turns,
        brainProfile: brain.profile,
        catalogProducts: ranked,
        catalogPartial,
        catalogPage: page,
        catalogHasMore,
        intent: consultantInsights?.intentCategory || 'product_recommendation',
        consultantInsights,
        searchFilters,
        focusProducts,
      })
      if (!response?.reply) {
        return res.status(503).json({ success: false, message: 'Nova AI tạm thời không khả dụng. Bạn hãy thử lại sau.', error: { code: 'AI_UNAVAILABLE' } })
      }

      const intent = consultantInsights?.intentCategory || (wantsProducts ? 'product_recommendation' : 'consulting_advice')
      const intentTitle = consultantInsights?.intentTitle || (wantsProducts ? 'Tư vấn mua sắm ShopNova' : 'Tư vấn chuyên môn')

      aiResult = {
        reply: response.reply,
        intent,
        intentTitle,
        poweredBy: response.modelUsed,
        catalogAvailable,
        catalogPartial,
        catalogPage: page,
        catalogHasMore,
        products: ranked.map((product) => ({
          id: product.id, name: product.name, price: product.price,
          originalPrice: product.originalPrice, rating: product.rating, sold: product.sold,
          mall: product.shopMall, imageUrl: product.images?.[0]?.url, categoryName: product.categoryName,
        })),
        suggestions: consultantInsights?.suggestedPrompts || (wantsProducts ? [
          '✨ Gợi ý thêm sản phẩm tương tự',
          '💰 Xem mẫu giá mềm hơn',
          '⭐ Xem sản phẩm bán chạy',
        ] : [
          '🚚 Xem chính sách đổi trả & freeship',
          '👕 Bảng size chuẩn ShopNova',
          '🛍️ Tìm sản phẩm hot hôm nay',
        ]),
      }
    }
    if (aiResult.pagination) {
      const { total, hasMore } = aiResult.pagination
      aiResult.reply += `\nTrang ${page}; tổng số bản ghi: ${total}. ${hasMore ? `Bạn có thể hỏi trang ${page + 1}.` : 'Không còn trang tiếp theo.'}`
    } else if (aiResult.intent === 'product_recommendation' && aiResult.catalogAvailable === true && aiResult.products.length > 0) {
      aiResult.reply += `\nTrang ${page}. ${aiResult.catalogHasMore === true ? `Bạn có thể hỏi trang ${page + 1}.` : aiResult.catalogHasMore === false ? 'Không còn trang tiếp theo trong kết quả đã tìm.' : 'Một phần kết quả tìm kiếm chưa khả dụng.'}`
    }
    if (!privilegedQuestion && !isOrderQuestion) aiBrainService.recordConversationTurn(userKey, { userQuery: query, aiReply: aiResult.reply, intent: aiResult.intent, products: aiResult.products })
    if (req.user) {
      // Lưu lịch sử không được làm hỏng câu trả lời: lỗi lưu chỉ được báo bằng historySaved=false.
      // Tra cứu quản trị chứa dữ liệu người khác nên chỉ lưu dấu vết, không lưu nội dung.
      try {
        aiResult.conversationId = await saveTurn(req.user.id, conversation.conversationId, {
          query, reply: aiResult.reply, intent: aiResult.intent, products: aiResult.products,
          suggestions: aiResult.suggestions, pagination: aiResult.pagination, sensitive: adminQuestion,
        })
        aiResult.historySaved = true
      } catch {
        aiResult.conversationId = conversation.conversationId
        aiResult.historySaved = false
      }
    }
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
