import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { analyzeConsultantNeeds, CONSULTANT_KNOWLEDGE_BASE } from './consultant-knowledge.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const BRAIN_DIR = path.resolve(__dirname, '../../data/ai-brains')

// Đảm bảo thư mục lưu trữ bộ não AI luôn tồn tại
try {
  if (!fs.existsSync(BRAIN_DIR)) {
    fs.mkdirSync(BRAIN_DIR, { recursive: true })
  }
} catch (err) {
  console.warn('[AI Brain] Không thể tạo thư mục BRAIN_DIR, sử dụng bộ nhớ RAM:', err.message)
}

// In-memory cache để truy xuất cực nhanh
const brainCache = new Map()

/**
 * THUẬT TOÁN HỌC TẬP VÀ GỢI Ý THÔNG MINH THEO THÓI QUEN NGƯỜI DÙNG KẾT HỢP KIẾN THỨC TƯ VẤN VIÊN
 * 1. Persona & Habit Learning: Phong cách, danh mục, ngân sách, giới tính, kích cỡ, địa chỉ.
 * 2. Multi-turn Working Memory: Nhớ câu hỏi và câu trả lời trước đó, không hỏi lại.
 * 3. Consultant Needs Discovery: Phân tích use-case, ràng buộc, câu hỏi tiếp nối (follow-up).
 * 4. Constraint-based Ranking: Lọc và xếp hạng sản phẩm logic dựa trên tiêu chuẩn chuyên gia bán hàng.
 */
class AiBrainService {
  constructor() {
    this.memoryTtlMs = 30 * 24 * 60 * 60 * 1000 // 30 ngày
  }

  _sanitizeKey(key) {
    return String(key || 'guest_default').replace(/[^a-zA-Z0-9_-]/g, '_')
  }

  _getBrainFilePath(key) {
    return path.join(BRAIN_DIR, `${this._sanitizeKey(key)}.json`)
  }

  /**
   * Khởi tạo hoặc tải bộ não của người dùng
   */
  getBrain(userIdOrSession) {
    const key = this._sanitizeKey(userIdOrSession)
    if (brainCache.has(key)) {
      return brainCache.get(key)
    }

    const filePath = this._getBrainFilePath(key)
    if (fs.existsSync(filePath)) {
      try {
        const raw = fs.readFileSync(filePath, 'utf8')
        const brainData = JSON.parse(raw)
        // Đảm bảo các cấu trúc mở rộng luôn sẵn sàng
        if (!brainData.affinity) {
          brainData.affinity = {
            categories: {},
            tags: {},
            pricePreference: { avg: null, count: 0 },
          }
        }
        if (!brainData.confirmedCriteria) {
          brainData.confirmedCriteria = {
            budgetMax: brainData.profile?.budgetRange?.max || null,
            size: brainData.profile?.sizes?.clothing || null,
            gender: brainData.profile?.gender || null,
            location: brainData.profile?.location || null,
            preferredStyle: null,
          }
        }
        if (!brainData.activeFocus) {
          brainData.activeFocus = {
            lastDiscussedProductId: null,
            lastDiscussedProductName: null,
            lastDiscussedCategory: null,
            lastIntent: null,
          }
        }
        if (!Array.isArray(brainData.conversationHistory)) {
          brainData.conversationHistory = []
        }
        brainCache.set(key, brainData)
        return brainData
      } catch (e) {
        console.warn(`[AI Brain] Lỗi đọc bộ não cho ${key}, tạo mới:`, e.message)
      }
    }

    // Cấu trúc mặc định của Bộ Não AI
    const newBrain = {
      id: key,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      profile: {
        preferredStyles: [],
        preferredCategories: [],
        preferredBrands: [],
        budgetRange: { min: null, max: null },
        location: null,
        sizes: {},
        gender: null,
        learnedFacts: [],
      },
      confirmedCriteria: {
        budgetMax: null,
        size: null,
        gender: null,
        location: null,
        preferredStyle: null,
      },
      activeFocus: {
        lastDiscussedProductId: null,
        lastDiscussedProductName: null,
        lastDiscussedCategory: null,
        lastIntent: null,
      },
      affinity: {
        categories: {}, // e.g. { "Thời trang nữ": 5, "Điện tử": 2 }
        tags: {},       // e.g. { "pastel": 8, "lụa": 4, "chống ồn": 3 }
        pricePreference: { avg: null, count: 0 },
      },
      conversationHistory: [],
      feedbackHistory: [],
      stats: {
        totalInteractions: 0,
        acceptedRecommendations: 0,
        favoriteColors: [],
      },
    }

    brainCache.set(key, newBrain)
    this._persistBrain(key, newBrain)
    return newBrain
  }

  _persistBrain(key, brain) {
    if (this._sanitizeKey(key).startsWith('guest_ephemeral_')) return
    try {
      const filePath = this._getBrainFilePath(key)
      fs.writeFileSync(filePath, JSON.stringify(brain, null, 2), 'utf8')
    } catch (e) {
      // Bỏ qua lỗi ghi disk nếu môi trường readonly/test
    }
  }

  /**
   * Thuật toán trích xuất và học hỏi thói quen từ tin nhắn kết hợp phân tích chuyên môn tư vấn
   */
  learnFromMessage(userIdOrSession, messageText) {
    const brain = this.getBrain(userIdOrSession)
    const text = String(messageText || '').toLowerCase()
    const learned = []

    // 1. Học phong cách thời trang & gu thẩm mỹ
    const styles = [
      { key: 'pastel', label: 'Tone màu Pastel ngọt ngào', tag: 'pastel' },
      { key: 'tối giản', label: 'Phong cách Tối giản (Minimalism)', tag: 'tối giản' },
      { key: 'công sở', label: 'Thời trang Công sở lịch lãm', tag: 'công sở' },
      { key: 'dạo phố', label: 'Thời trang Dạo phố thoải mái', tag: 'dạo phố' },
      { key: 'thể thao', label: 'Phong cách Thể thao năng động', tag: 'thể thao' },
      { key: 'sang trọng', label: 'Phong cách Sang trọng đi tiệc', tag: 'tiệc' },
      { key: 'tiệc', label: 'Thời trang Dạ tiệc quý phái', tag: 'tiệc' },
      { key: 'vintage', label: 'Phong cách Vintage cổ điển', tag: 'vintage' },
      { key: 'y2k', label: 'Phong cách Y2K sành điệu', tag: 'y2k' },
    ]
    for (const s of styles) {
      if (text.includes(s.key)) {
        if (!brain.profile.preferredStyles.includes(s.label)) {
          brain.profile.preferredStyles.push(s.label)
          learned.push(`Ưa chuộng: ${s.label}`)
        }
        brain.confirmedCriteria.preferredStyle = s.label
        brain.affinity.tags[s.tag] = (brain.affinity.tags[s.tag] || 0) + 2
      }
    }

    // 2. Học danh mục quan tâm
    const categories = [
      { key: 'váy', label: 'Váy / Đầm', tag: 'váy' },
      { key: 'đầm', label: 'Váy / Đầm', tag: 'đầm' },
      { key: 'áo sơ mi', label: 'Áo Sơ Mi', tag: 'áo sơ mi' },
      { key: 'hoodie', label: 'Áo Hoodie & Áo Khoác', tag: 'hoodie' },
      { key: 'áo khoác', label: 'Áo Khoác', tag: 'áo khoác' },
      { key: 'tai nghe', label: 'Thiết Bị Âm Thanh & Phụ Kiện', tag: 'tai nghe' },
      { key: 'túi xách', label: 'Túi Xách & Balo', tag: 'túi xách' },
      { key: 'mỹ phẩm', label: 'Mỹ Phẩm & Chăm Sóc Da', tag: 'mỹ phẩm' },
      { key: 'son', label: 'Son Môi', tag: 'son' },
      { key: 'giày', label: 'Giày Dép', tag: 'giày' },
    ]
    for (const cat of categories) {
      if (text.includes(cat.key)) {
        if (!brain.profile.preferredCategories.includes(cat.label)) {
          brain.profile.preferredCategories.push(cat.label)
          learned.push(`Thường tìm kiếm: ${cat.label}`)
        }
        brain.affinity.categories[cat.label] = (brain.affinity.categories[cat.label] || 0) + 1
      }
    }

    // 3. Học đối tượng / giới tính (nam, nữ, bé)
    if (text.includes('cho nam') || text.includes('bạn trai') || text.includes('đồ nam')) {
      brain.profile.gender = 'Nam'
      brain.confirmedCriteria.gender = 'Nam'
      learned.push('Ưu tiên gợi ý đồ Nam')
    } else if (text.includes('cho nữ') || text.includes('bạn gái') || text.includes('đồ nữ')) {
      brain.profile.gender = 'Nữ'
      brain.confirmedCriteria.gender = 'Nữ'
      learned.push('Ưu tiên gợi ý đồ Nữ')
    }

    // 4. Học kích cỡ (size quần áo, giày)
    const sizeMatch = text.match(/size\s*([smlxlxxl0-9]{1,3})/i)
    if (sizeMatch) {
      const sizeVal = sizeMatch[1].toUpperCase()
      brain.profile.sizes.clothing = sizeVal
      brain.confirmedCriteria.size = sizeVal
      learned.push(`Size thường mặc: ${sizeVal}`)
    }

    // 5. Học thói quen ngân sách (Budget Preference)
    const budgetMatch = text.match(/(?:dưới|<|khoảng|tầm|tối đa)\s*(\d{2,4})\s*(?:k|nghìn|ngàn|000)/i)
    if (budgetMatch) {
      const num = parseInt(budgetMatch[1], 10)
      const maxVal = num < 1000 ? num * 1000 : num
      brain.profile.budgetRange.max = maxVal
      brain.confirmedCriteria.budgetMax = maxVal

      // Tính trung bình ngân sách tích lũy
      const pref = brain.affinity.pricePreference
      const currentAvg = pref.avg || maxVal
      pref.avg = Math.round((currentAvg * pref.count + maxVal) / (pref.count + 1))
      pref.count += 1

      learned.push(`Ngân sách quen thuộc: dưới ${new Intl.NumberFormat('vi-VN').format(maxVal)}đ`)
    }

    // 6. Học địa điểm giao nhận
    if (text.includes('hà nội') || text.includes('hn')) {
      brain.profile.location = 'Hà Nội'
      brain.confirmedCriteria.location = 'Hà Nội'
      learned.push('Khu vực nhận hàng: Hà Nội')
    } else if (text.includes('hồ chí minh') || text.includes('tp.hcm') || text.includes('sài gòn') || text.includes('tphcm')) {
      brain.profile.location = 'TP.HCM'
      brain.confirmedCriteria.location = 'TP.HCM'
      learned.push('Khu vực nhận hàng: TP.HCM (Hỗ trợ Giao hỏa tốc 2h)')
    } else if (text.includes('đà nẵng')) {
      brain.profile.location = 'Đà Nẵng'
      brain.confirmedCriteria.location = 'Đà Nẵng'
      learned.push('Khu vực nhận hàng: Đà Nẵng')
    }

    // 7. Cập nhật các fact đã học
    for (const fact of learned) {
      if (!brain.profile.learnedFacts.includes(fact)) {
        brain.profile.learnedFacts.push(fact)
      }
    }

    // Giữ 15 fact gần nhất
    if (brain.profile.learnedFacts.length > 15) {
      brain.profile.learnedFacts = brain.profile.learnedFacts.slice(-15)
    }

    // 8. Trích xuất nhu cầu chuyên môn của tư vấn viên
    const consultantInsights = analyzeConsultantNeeds(text, brain)

    brain.stats.totalInteractions += 1
    brain.updatedAt = new Date().toISOString()
    this._persistBrain(userIdOrSession, brain)

    return {
      brain,
      newlyLearned: learned,
      consultantInsights,
    }
  }

  /**
   * THUẬT TOÁN XẾP HẠNG THÔNG MINH KẾT HỢP LỌC CHUYÊN MÔN TƯ VẤN VIÊN
   * - Lọc triệt để sản phẩm vi phạm tiêu chí ngân sách hoặc giới tính đã xác nhận.
   * - Thưởng điểm mạnh cho sản phẩm khớp hoàn cảnh sử dụng (Use case) và sản phẩm đang được thảo luận.
   */
  rankProductsByUserHabits(userIdOrSession, products = [], consultantInsights = null) {
    if (!Array.isArray(products) || products.length === 0) {
      return []
    }

    const brain = this.getBrain(userIdOrSession)
    const { profile, affinity, confirmedCriteria, activeFocus } = brain
    const maxBudget = confirmedCriteria?.budgetMax || profile.budgetRange?.max || affinity?.pricePreference?.avg

    const scoredProducts = products.map((product) => {
      let score = 50 // Điểm cơ sở
      const highlights = []

      const nameLower = (product.name || '').toLowerCase()
      const descLower = (product.description || '').toLowerCase()
      const price = Number(product.price) || 0

      // 0. Nếu đây là câu hỏi tiếp nối và sản phẩm trùng với sản phẩm đang được thảo luận ở lượt trước
      if (consultantInsights?.isFollowUp && activeFocus?.lastDiscussedProductId) {
        if (product.id === activeFocus.lastDiscussedProductId || nameLower.includes((activeFocus.lastDiscussedProductName || '').toLowerCase())) {
          score += 50
          highlights.push('Sản phẩm đang trao đổi')
        }
      }

      // 1. Khớp phong cách & Tag ưa thích (+10 đến +30 điểm)
      if (affinity?.tags) {
        for (const [tag, weight] of Object.entries(affinity.tags)) {
          if (nameLower.includes(tag) || descLower.includes(tag)) {
            score += Math.min(30, weight * 5)
            highlights.push(`Hợp gu: ${tag}`)
          }
        }
      }

      // 2. Khớp danh mục ưa thích (+20 điểm)
      if (Array.isArray(profile.preferredCategories)) {
        for (const cat of profile.preferredCategories) {
          if (nameLower.includes(cat.toLowerCase()) || descLower.includes(cat.toLowerCase())) {
            score += 20
          }
        }
      }

      // 3. Khớp giới tính (+15 điểm nếu khớp, -30 nếu ngược)
      const targetGender = confirmedCriteria?.gender || profile.gender
      if (targetGender === 'Nữ') {
        if (nameLower.includes('nữ') || nameLower.includes('đầm') || nameLower.includes('váy') || nameLower.includes('croptop')) {
          score += 15
        } else if (nameLower.includes('nam') || nameLower.includes('cà vạt')) {
          score -= 30 // Lọc gắt gao hơn theo chuẩn tư vấn viên
        }
      } else if (targetGender === 'Nam') {
        if (nameLower.includes('nam') || nameLower.includes('sơ mi nam') || nameLower.includes('polo nam')) {
          score += 15
        } else if (nameLower.includes('nữ') || nameLower.includes('đầm')) {
          score -= 30
        }
      }

      // 4. Ràng buộc ngân sách chặt chẽ theo tư vấn viên (Constraint Satisfaction)
      if (maxBudget && price > 0) {
        if (price <= maxBudget) {
          score += 25
          highlights.push('Trong khoảng ngân sách')
          // Nếu nằm trong khoảng 60% - 95% ngân sách -> Thưởng thêm 10 điểm (Mức tối ưu giá trị)
          if (price >= maxBudget * 0.6) {
            score += 10
          }
        } else if (price > maxBudget * 1.1) {
          // Vượt quá ngân sách đã yêu cầu -> Phạt nặng điểm để không gợi ý hàng đắt quá tầm khách
          score -= 40
        }
      }

      // 5. Thưởng tính năng kỹ thuật / chất liệu chuyên môn
      if (nameLower.includes('chống ồn') || nameLower.includes('anc')) {
        highlights.push('Chống ồn ANC')
      }
      if (nameLower.includes('linen') || nameLower.includes('cotton 100%')) {
        highlights.push('Chất liệu thoáng mát cao cấp')
      }
      if (product.mall) {
        highlights.push('Chính hãng Shop Mall')
        score += 5
      }
      if (product.rating >= 4.8) score += 10
      if (product.sold > 200) score += 5

      return {
        ...product,
        _personalizedScore: score,
        _matchPercent: Math.min(99, Math.max(85, Math.round(score * 0.75))),
        _consultantHighlights: highlights.slice(0, 2),
      }
    })

    // Sắp xếp giảm dần theo điểm số cá nhân hóa & sàng lọc chuyên môn
    scoredProducts.sort((a, b) => b._personalizedScore - a._personalizedScore)
    return scoredProducts
  }

  /**
   * Lưu lượt hội thoại vào Working Memory (ngắn hạn) đồng thời cập nhật activeFocus
   */
  recordConversationTurn(userIdOrSession, { userQuery, aiReply, intent, products = [], orderInfo = null }) {
    const brain = this.getBrain(userIdOrSession)
    const topProduct = products && products.length > 0 ? products[0] : null

    brain.conversationHistory.push({
      timestamp: new Date().toISOString(),
      userQuery,
      aiReply,
      intent,
      lastProductIds: products.map((p) => p.id || p.productId),
      topProductName: topProduct?.name || null,
      orderInfo: orderInfo ? { code: orderInfo.code, status: orderInfo.status } : null,
    })

    // Cập nhật tâm điểm hội thoại (activeFocus) để nhận diện các câu hỏi kế tiếp
    if (topProduct) {
      brain.activeFocus = {
        lastDiscussedProductId: topProduct.id || topProduct.productId,
        lastDiscussedProductName: topProduct.name,
        lastDiscussedCategory: topProduct.categoryName || null,
        lastIntent: intent,
      }
    }

    // Giữ 10 lượt hội thoại gần nhất
    if (brain.conversationHistory.length > 10) {
      brain.conversationHistory = brain.conversationHistory.slice(-10)
    }

    brain.updatedAt = new Date().toISOString()
    this._persistBrain(userIdOrSession, brain)
  }

  /**
   * Trích xuất danh sách lịch sử hội thoại gần nhất phục vụ Gemini Prompt
   */
  getRecentConversationTurns(userIdOrSession, limit = 4) {
    const brain = this.getBrain(userIdOrSession)
    return (brain.conversationHistory || []).slice(-limit)
  }

  /**
   * Học hỏi từ phản hồi hoặc hành động thực tế (Thêm giỏ / Đánh giá)
   */
  recordFeedback(userIdOrSession, { action, query, productId, productTags = [], helpful = true }) {
    const brain = this.getBrain(userIdOrSession)
    brain.feedbackHistory.push({
      timestamp: new Date().toISOString(),
      action,
      query,
      productId,
      helpful,
    })

    if (helpful || action === 'add_to_cart') {
      brain.stats.acceptedRecommendations += 1

      // Gia tăng trọng số sở thích cho các tag sản phẩm này (+3 điểm affinity)
      if (Array.isArray(productTags)) {
        for (const tag of productTags) {
          const t = String(tag).toLowerCase()
          brain.affinity.tags[t] = (brain.affinity.tags[t] || 0) + 3
        }
      }
    } else if (helpful === false) {
      // Giảm nhẹ điểm nếu người dùng không ưng ý
      if (Array.isArray(productTags)) {
        for (const tag of productTags) {
          const t = String(tag).toLowerCase()
          if (brain.affinity.tags[t]) {
            brain.affinity.tags[t] = Math.max(0, brain.affinity.tags[t] - 2)
          }
        }
      }
    }

    if (brain.feedbackHistory.length > 30) {
      brain.feedbackHistory = brain.feedbackHistory.slice(-30)
    }

    brain.updatedAt = new Date().toISOString()
    this._persistBrain(userIdOrSession, brain)
    return brain.stats
  }

  /**
   * Xóa hoặc đặt lại ký ức bộ não của người dùng
   */
  forgetEphemeral(userIdOrSession) {
    const key = this._sanitizeKey(userIdOrSession)
    if (key.startsWith('guest_ephemeral_')) brainCache.delete(key)
  }

  removeBrain(userIdOrSession) {
    const key = this._sanitizeKey(userIdOrSession)
    brainCache.delete(key)
    const filePath = this._getBrainFilePath(key)
    if (fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath)
      } catch {}
    }
  }

  resetBrain(userIdOrSession) {
    this.removeBrain(userIdOrSession)
    return this.getBrain(userIdOrSession)
  }
}

export const aiBrainService = new AiBrainService()
export default aiBrainService
