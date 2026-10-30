import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

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
 * Trợ lý bộ não AI (Nova AI Brain Engine):
 * 1. Long-term Persona Memory: Ghi nhớ sở thích, kích cỡ, phong cách, vị trí, ngân sách
 * 2. Short-term Working Memory: Duy trì ngữ cảnh hội thoại đa lượt
 * 3. Feedback & Adaptive Learning: Học hỏi từ các phản hồi và hành động thêm vào giỏ
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
        brainCache.set(key, brainData)
        return brainData
      } catch (e) {
        console.warn(`[AI Brain] Lỗi đọc bộ não cho ${key}, tạo mới:`, e.message)
      }
    }

    // Cấu trúc mặc định của một Bộ Não AI
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
        learnedFacts: [],
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
    try {
      const filePath = this._getBrainFilePath(key)
      fs.writeFileSync(filePath, JSON.stringify(brain, null, 2), 'utf8')
    } catch (e) {
      // Bỏ qua lỗi ghi disk nếu môi trường readonly/test
    }
  }

  /**
   * Học hỏi và trích xuất thông tin mới từ tin nhắn của người dùng
   */
  learnFromMessage(userIdOrSession, messageText) {
    const brain = this.getBrain(userIdOrSession)
    const text = String(messageText || '').toLowerCase()
    const learned = []

    // 1. Học phong cách thời trang
    const styles = [
      { key: 'pastel', label: 'Tone màu Pastel ngọt ngào' },
      { key: 'tối giản', label: 'Phong cách Tối giản (Minimalism)' },
      { key: 'công sở', label: 'Thời trang Công sở lịch lãm' },
      { key: 'dạo phố', label: 'Thời trang Dạo phố thoải mái' },
      { key: 'thể thao', label: 'Phong cách Thể thao năng động' },
      { key: 'sang trọng', label: 'Phong cách Sang trọng đi tiệc' },
    ]
    for (const s of styles) {
      if (text.includes(s.key)) {
        if (!brain.profile.preferredStyles.includes(s.label)) {
          brain.profile.preferredStyles.push(s.label)
          learned.push(`Ưa chuộng ${s.label}`)
        }
      }
    }

    // 2. Học kích cỡ (size)
    const sizeMatch = text.match(/size\s*([smlxlxxl0-9]{1,3})/i)
    if (sizeMatch) {
      const sizeVal = sizeMatch[1].toUpperCase()
      brain.profile.sizes.clothing = sizeVal
      learned.push(`Size đồ thường mặc: ${sizeVal}`)
    }

    // 3. Học ngân sách quen thuộc
    const budgetMatch = text.match(/(?:dưới|<|khoảng|tầm)\s*(\d{2,4})\s*(?:k|nghìn|ngàn|000)/i)
    if (budgetMatch) {
      const num = parseInt(budgetMatch[1], 10)
      const maxVal = num < 1000 ? num * 1000 : num
      brain.profile.budgetRange.max = maxVal
      learned.push(`Ngân sách quen thuộc: dưới ${new Intl.NumberFormat('vi-VN').format(maxVal)}đ`)
    }

    // 4. Học địa điểm giao nhận
    if (text.includes('hà nội') || text.includes('hn')) {
      brain.profile.location = 'Hà Nội'
      learned.push('Khu vực nhận hàng chính: Hà Nội')
    } else if (text.includes('hồ chí minh') || text.includes('tp.hcm') || text.includes('sài gòn') || text.includes('tphcm')) {
      brain.profile.location = 'TP.HCM'
      learned.push('Khu vực nhận hàng chính: TP.HCM (Hỗ trợ Giao 2h)')
    } else if (text.includes('đà nẵng')) {
      brain.profile.location = 'Đà Nẵng'
      learned.push('Khu vực nhận hàng: Đà Nẵng')
    }

    // 5. Cập nhật các fact đã học
    for (const fact of learned) {
      if (!brain.profile.learnedFacts.includes(fact)) {
        brain.profile.learnedFacts.push(fact)
      }
    }

    // Giữ tối đa 15 fact gần nhất
    if (brain.profile.learnedFacts.length > 15) {
      brain.profile.learnedFacts = brain.profile.learnedFacts.slice(-15)
    }

    brain.stats.totalInteractions += 1
    brain.updatedAt = new Date().toISOString()
    this._persistBrain(userIdOrSession, brain)

    return {
      brain,
      newlyLearned: learned,
    }
  }

  /**
   * Lưu lượt hội thoại vào Working Memory (ngắn hạn)
   */
  recordConversationTurn(userIdOrSession, { userQuery, aiReply, intent, products = [], orderInfo = null }) {
    const brain = this.getBrain(userIdOrSession)
    brain.conversationHistory.push({
      timestamp: new Date().toISOString(),
      userQuery,
      aiReply,
      intent,
      lastProductIds: products.map((p) => p.id || p.productId),
      orderInfo: orderInfo ? { code: orderInfo.code, status: orderInfo.status } : null,
    })

    // Giữ 10 lượt hội thoại gần nhất
    if (brain.conversationHistory.length > 10) {
      brain.conversationHistory = brain.conversationHistory.slice(-10)
    }

    brain.updatedAt = new Date().toISOString()
    this._persistBrain(userIdOrSession, brain)
  }

  /**
   * Lưu phản hồi từ người dùng (Like / Dislike / Thêm giỏ) để AI tự tinh chỉnh
   */
  recordFeedback(userIdOrSession, { action, query, productId, helpful = true }) {
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
  resetBrain(userIdOrSession) {
    const key = this._sanitizeKey(userIdOrSession)
    brainCache.delete(key)
    const filePath = this._getBrainFilePath(key)
    if (fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath)
      } catch {}
    }
    return this.getBrain(userIdOrSession)
  }
}

export const aiBrainService = new AiBrainService()
export default aiBrainService
