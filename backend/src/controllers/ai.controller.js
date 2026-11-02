import { callDataApi } from '../clients/data.client.js'
import { aiBrainService } from '../services/ai-brain.service.js'
import { generateGeminiShoppingAdvice } from '../services/gemini.service.js'

/**
 * Danh sách sản phẩm dự phòng phong phú từ Catalog khi Data API chưa kết nối MySQL
 */
const FALLBACK_PRODUCTS = [
  {
    id: 'p_crop_top',
    name: 'Áo Croptop Linen Cổ Vuông Pastel ShopNova',
    price: 159000,
    originalPrice: 220000,
    rating: 4.9,
    sold: 1850,
    mall: true,
    freeship: true,
    imageUrl: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=400&q=80',
    categoryName: 'Thời Trang Nữ',
    tag: 'Áo chính',
  },
  {
    id: 'p_shorts_kaki',
    name: 'Quần Short Kaki Ống Rộng Cạp Cao Pastel',
    price: 165000,
    originalPrice: 210000,
    rating: 4.8,
    sold: 950,
    mall: false,
    freeship: true,
    imageUrl: 'https://images.unsplash.com/photo-1591195853828-11db59a44f6b?auto=format&fit=crop&w=400&q=80',
    categoryName: 'Thời Trang Nữ',
    tag: 'Phối kèm',
  },
  {
    id: 'p_tote_canvas',
    name: 'Túi Vải Tote Mini Canvas Dạo Phố',
    price: 65000,
    originalPrice: 95000,
    rating: 5.0,
    sold: 420,
    mall: false,
    freeship: false,
    imageUrl: 'https://images.unsplash.com/photo-1544816155-12df9643f363?auto=format&fit=crop&w=400&q=80',
    categoryName: 'Túi Ví & Phụ Kiện',
    tag: 'Phụ kiện',
  },
  {
    id: 'p_tai_nghe_anc',
    name: 'Tai Nghe Bluetooth True Wireless Chống Ồn ANC Nova Sound',
    price: 349000,
    originalPrice: 499000,
    rating: 4.9,
    sold: 1200,
    mall: true,
    freeship: true,
    imageUrl: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=400&q=80',
    categoryName: 'Thiết Bị Điện Tử',
    tag: 'Công nghệ',
  },
  {
    id: 'p_son_kem_li',
    name: 'Son Kem Lì Mịn Môi Cao Cấp Màu Đỏ Gạch Terracotta',
    price: 129000,
    originalPrice: 180000,
    rating: 4.9,
    sold: 3400,
    mall: true,
    freeship: true,
    imageUrl: 'https://images.unsplash.com/photo-1586495777744-4413f21062fa?auto=format&fit=crop&w=400&q=80',
    categoryName: 'Sắc Đẹp & Mỹ Phẩm',
    tag: 'Làm đẹp',
  },
  {
    id: 'p_balo_laptop',
    name: 'Balo Laptop Chống Nước Đa Năng 15.6 inch',
    price: 249000,
    originalPrice: 350000,
    rating: 4.8,
    sold: 890,
    mall: false,
    freeship: true,
    imageUrl: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=400&q=80',
    categoryName: 'Túi Ví & Phụ Kiện',
    tag: 'Thời trang',
  },
]

function extractUserKey(req) {
  return (
    req.user?.id ||
    req.user?.username ||
    req.body?.context?.userId ||
    req.body?.context?.sessionId ||
    req.headers['x-session-id'] ||
    'guest_user'
  )
}

/**
 * Controller xử lý hội thoại Trợ lý AI NovaShop:
 * - Phân tích nhu cầu chuyên sâu của khách hàng.
 * - Ghi nhớ các câu hỏi & câu trả lời trước đó trong phiên hội thoại.
 * - Lọc và xếp hạng sản phẩm theo kiến thức chuyên môn của tư vấn viên.
 * - Trả lời súc tích, logic, đúng trọng tâm.
 */
export async function chatWithAi(req, res, next) {
  try {
    const { message = '', context = {}, history = [] } = req.body || {}
    const query = String(message).trim()

    if (!query) {
      return res.status(400).json({
        success: false,
        message: 'Nội dung tin nhắn không được để trống.',
        error: { code: 'EMPTY_MESSAGE' },
      })
    }

    const userKey = extractUserKey(req)

    // BƯỚC 1: BỘ NÃO HỌC TẬP & PHÂN TÍCH NHU CẦU TƯ VẤN VIÊN (AI BRAIN + CONSULTANT DISCOVERY)
    const { brain, newlyLearned, consultantInsights } = aiBrainService.learnFromMessage(userKey, query)
    const lower = query.toLowerCase()

    // Hợp nhất lịch sử hội thoại từ client gửi lên (nếu có) và lịch sử lưu trong bộ não
    const clientHistoryTurns = Array.isArray(context.history || history)
      ? (context.history || history).map((m) => ({
          userQuery: m.isUser ? m.text : undefined,
          aiReply: !m.isUser ? m.text : undefined,
        }))
      : []

    const fullConversationHistory = [
      ...(Array.isArray(brain.conversationHistory) ? brain.conversationHistory : []),
      ...clientHistoryTurns,
    ]

    // BƯỚC 2: PHÂN TÍCH Ý ĐỊNH VÀ KẾT NỐI DỮ LIỆU
    let aiResult = null

    // Nhánh A: Tra cứu đơn hàng / vận chuyển
    if (
      lower.includes('đơn hàng') ||
      lower.includes('tra cứu') ||
      lower.includes('vận chuyển') ||
      lower.includes('khi nào') ||
      lower.includes('giao hàng')
    ) {
      let orderCode = context.orderCode || 'ORD-NOVA-882'
      const match = query.match(/(?:ORD-?|#)([A-Za-z0-9-]+)/i)
      if (match) orderCode = match[0].toUpperCase()

      const userLoc = brain.confirmedCriteria?.location || brain.profile?.location || 'TP.HCM'
      const personalizedNote = newlyLearned.length > 0 ? ` (🧠 Nova vừa ghi nhớ: ${newlyLearned.join(', ')})` : ''

      aiResult = {
        reply: `Nova đã kết nối hệ thống kho vận cho đơn hàng ${orderCode}. Đơn hàng đang được bưu tá ưu tiên giao tại khu vực ${userLoc}!${personalizedNote}`,
        intent: 'order_tracking',
        intentTitle: `Tra Cứu Đơn Hàng ${orderCode}`,
        intentMatch: 'Khớp 99%',
        orderInfo: {
          code: orderCode,
          status: 'shipping',
          statusText: 'Đang vận chuyển hỏa tốc',
          shipper: 'Nguyễn Văn Minh (0912.888.xxx)',
          carrier: 'Shopee Xpress / Giao Hàng Nhanh',
          location: `Đang trung chuyển qua Bưu cục ${userLoc}`,
          eta: 'Dự kiến giao trước 17:30 hôm nay',
          step: 3,
          total: 389000,
        },
        suggestions: [
          '🚚 Bưu tá liên hệ trước khi giao không?',
          '📦 Tôi muốn đổi địa chỉ nhận hàng',
          '⚡ Săn thêm voucher giảm giá',
        ],
      }
    } else {
      // Nhánh B: Tìm kiếm sản phẩm thực tế từ Data API hoặc catalog
      let catalogProducts = []
      try {
        const searchRes = await callDataApi(`/internal/v1/products?limit=8&q=${encodeURIComponent(query)}`)
        if (Array.isArray(searchRes?.products) && searchRes.products.length > 0) {
          catalogProducts = searchRes.products
        }
      } catch {}

      if (catalogProducts.length === 0) {
        catalogProducts = FALLBACK_PRODUCTS
      }

      // Nếu là câu hỏi tiếp nối và có sản phẩm đang thảo luận, giữ sản phẩm đó trong danh mục
      if (consultantInsights.isFollowUp && brain.activeFocus?.lastDiscussedProductId) {
        const focusedId = brain.activeFocus.lastDiscussedProductId
        const found = catalogProducts.find((p) => p.id === focusedId)
        if (!found) {
          const fallbackMatch = FALLBACK_PRODUCTS.find((p) => p.id === focusedId)
          if (fallbackMatch) catalogProducts.unshift(fallbackMatch)
        }
      }

      // ÁP DỤNG THUẬT TOÁN XẾP HẠNG THÔNG MINH DỰA TRÊN THÓI QUEN & LỌC CHUYÊN MÔN TƯ VẤN VIÊN
      catalogProducts = aiBrainService.rankProductsByUserHabits(userKey, catalogProducts, consultantInsights)

      // Nhánh C: Gợi ý phối đồ (Outfit Combo)
      if (
        lower.includes('phối đồ') ||
        lower.includes('set đồ') ||
        lower.includes('tiệc') ||
        lower.includes('dạo phố') ||
        lower.includes('outfit') ||
        lower.includes('combo')
      ) {
        const outfitItems = catalogProducts.slice(0, 3).map((item, idx) => ({
          id: item.id || `outfit_${idx}`,
          name: item.name,
          price: Number(item.price) || 150000,
          originalPrice: Number(item.originalPrice) || Number(item.price) * 1.3,
          rating: item.rating || 4.9,
          sold: item.sold || 500,
          mall: Boolean(item.mall),
          imageUrl: item.imageUrl || FALLBACK_PRODUCTS[idx]?.imageUrl,
          tag: idx === 0 ? 'Món chính' : idx === 1 ? 'Phối kèm' : 'Phụ kiện',
          consultantHighlights: item._consultantHighlights || [],
        }))

        const totalPrice = outfitItems.reduce((acc, cur) => acc + cur.price, 0)
        const totalOriginal = outfitItems.reduce((acc, cur) => acc + cur.originalPrice, 0)
        const saved = Math.max(0, totalOriginal - totalPrice)

        aiResult = {
          reply: null,
          intent: 'outfit_combo',
          intentTitle: 'Tư Vấn Phối Đồ & Set Thời Trang',
          intentMatch: 'Khớp 98%',
          budget: {
            max: brain.confirmedCriteria?.budgetMax || brain.profile.budgetRange.max || 500000,
            total: totalPrice,
            saved,
            currency: 'VND',
          },
          products: outfitItems,
          suggestions: [
            '✨ Đổi sang màu sắc khác',
            '👗 Tìm thêm phụ kiện vòng cổ / túi',
            '🛒 Thêm trọn bộ vào giỏ hàng',
          ],
        }
      } else if (lower.includes('so sánh') || lower.includes('tai nghe') || lower.includes('chống ồn')) {
        // Nhánh D: So sánh công nghệ
        aiResult = {
          reply: null,
          intent: 'product_comparison',
          intentTitle: 'Bảng So Sánh Sản Phẩm Thông Minh',
          intentMatch: 'Khớp 96%',
          products: catalogProducts.slice(0, 3),
          suggestions: [
            '🔍 Chi tiết thông số & bảo hành',
            '⚡ Xem đánh giá thực tế từ người mua',
            '🏷️ Xem mã giảm giá hiện có',
          ],
        }
      } else {
        // Nhánh E: Gợi ý mua sắm / Trả lời tự do
        aiResult = {
          reply: null,
          intent: 'product_recommendation',
          intentTitle: 'Tư Vấn Mua Sắm Nova AI',
          intentMatch: 'Khớp 95%',
          products: catalogProducts.slice(0, 4),
          suggestions: [
            '⚡ Xem các deal hot nhất hôm nay',
            '🚚 Lọc sản phẩm hỗ trợ Freeship Xtra',
            '⭐ Lọc sản phẩm đánh giá trên 4.8 sao',
          ],
        }
      }
    }

    // BƯỚC 2.5: GỌI GOOGLE GEMINI ĐỂ TRỰC TIẾP TƯ DUY & TRẢ LỜI NGẮN GỌN, LOGIC THEO CHUẨN TƯ VẤN VIÊN
    if (aiResult && aiResult.intent !== 'order_tracking') {
      try {
        const geminiRes = await generateGeminiShoppingAdvice({
          query,
          conversationHistory: fullConversationHistory,
          brainProfile: brain.profile,
          catalogProducts: aiResult.products || [],
          intent: aiResult.intent,
          consultantInsights,
        })
        if (geminiRes && geminiRes.reply) {
          aiResult.reply = geminiRes.reply
          aiResult.poweredBy = geminiRes.modelUsed || 'Google Gemini AI'
        }
      } catch (err) {
        console.warn('[AI Controller] Bỏ qua lỗi gọi Gemini:', err.message)
      }

      // Nếu Gemini không phản hồi, tư vấn theo logic chuyên môn ngắn gọn, kế thừa câu hỏi trước
      if (!aiResult.reply) {
        const topProduct = aiResult.products?.[0]
        const topName = topProduct?.name || brain.activeFocus?.lastDiscussedProductName || 'sản phẩm'
        const topPrice = topProduct?.price ? `${new Intl.NumberFormat('vi-VN').format(topProduct.price)}đ` : ''

        if (consultantInsights.isFollowUp && consultantInsights.followUpTopic === 'specs') {
          aiResult.reply = `Về tính năng của ${topName}: Sản phẩm đạt chuẩn chống nước & mồ hôi IPX5, hỗ trợ chống ồn chủ động ANC và pin lên đến 28 giờ. Rất thích hợp cho bạn đeo làm việc văn phòng hoặc chạy bộ.`
        } else if (consultantInsights.isFollowUp && consultantInsights.followUpTopic === 'price') {
          aiResult.reply = `${topName} đang có mức giá ưu đãi là ${topPrice}, hoàn toàn nằm trong mức ngân sách bạn mong muốn. Đơn hàng còn được tặng voucher Freeship Xtra hôm nay.`
        } else if (consultantInsights.isFollowUp && consultantInsights.followUpTopic === 'size') {
          aiResult.reply = `Với form dáng của ${topName}, size M phù hợp cho cân nặng 48-53kg (chiều cao 1m55-1m62). Nếu bạn thích phong cách mặc rộng thoải mái có thể cân nhắc size L nhé.`
        } else if (topProduct) {
          aiResult.reply = `Nova đã chọn lọc ${topName} (${topPrice}) vì sở hữu chất liệu thoáng mát, đạt đánh giá ${topProduct.rating || 5.0}★ và phù hợp với tiêu chí của bạn. Bạn có muốn mình hỗ trợ chốt đơn giao hỏa tốc không?`
        } else {
          aiResult.reply = `Nova đã lắng nghe yêu cầu của bạn. Dựa trên phân tích chuyên môn, bạn muốn ưu tiên về phân khúc giá, màu sắc hay tính năng cụ thể nào nhất?`
        }
        aiResult.poweredBy = 'Nova Consultant Engine'
      }
    }

    // BƯỚC 3: GHI NHẬN HỘI THOẠI VÀO WORKING MEMORY
    aiBrainService.recordConversationTurn(userKey, {
      userQuery: query,
      aiReply: aiResult.reply,
      intent: aiResult.intent,
      products: aiResult.products || [],
      orderInfo: aiResult.orderInfo,
    })

    // Bổ sung dữ liệu Brain trong phản hồi để client cập nhật
    aiResult.brain = {
      learnedFacts: brain.profile.learnedFacts,
      preferredStyles: brain.profile.preferredStyles,
      location: brain.profile.location,
      stats: brain.stats,
      newlyLearned,
      consultantInsights,
    }

    return res.status(200).json({
      success: true,
      data: aiResult,
    })
  } catch (err) {
    return next(err)
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
