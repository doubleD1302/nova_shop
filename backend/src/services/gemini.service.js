import { env } from '../config/env.js'

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent'

/**
 * Gọi mô hình Google Gemini 3.8 Flash để sinh câu trả lời tư vấn mua sắm thông minh
 */
export async function generateGeminiShoppingAdvice({
  query,
  brainProfile = {},
  catalogProducts = [],
  intent = 'general',
}) {
  const apiKey = env.geminiApiKey
  if (!apiKey) {
    return null
  }

  // Định dạng danh sách sản phẩm để làm ngữ cảnh cho Gemini
  const productContext = catalogProducts.slice(0, 5).map((p, idx) => {
    const priceStr = new Intl.NumberFormat('vi-VN').format(p.price) + 'đ'
    return `${idx + 1}. ${p.name} - Giá: ${priceStr} (Đánh giá: ${p.rating || 5.0}★, Đã bán: ${p.sold || 100})`
  }).join('\n')

  // Định dạng thông tin bộ não người dùng (AI Brain persona)
  const brainContext = [
    brainProfile.preferredStyles?.length ? `• Gu thời trang ưa thích: ${brainProfile.preferredStyles.join(', ')}` : null,
    brainProfile.sizes?.clothing ? `• Size quần áo thường mặc: ${brainProfile.sizes.clothing}` : null,
    brainProfile.budgetRange?.max ? `• Ngân sách quen thuộc: dưới ${new Intl.NumberFormat('vi-VN').format(brainProfile.budgetRange.max)}đ` : null,
    brainProfile.location ? `• Khu vực nhận hàng: ${brainProfile.location}` : null,
    brainProfile.learnedFacts?.length ? `• Các sở thích đã học: ${brainProfile.learnedFacts.slice(-3).join('; ')}` : null,
  ].filter(Boolean).join('\n')

  const systemPrompt = `Bạn là Nova AI Copilot - Trợ lý mua sắm AI thông minh, tận tâm của sàn thương mại điện tử NovaShop (giao diện nhận diện tông Terracotta & Kem).

Hồ sơ trí nhớ của người dùng (AI Brain đã học):
${brainContext || 'Người dùng mới, chưa có thông tin lưu trữ.'}

Danh mục sản phẩm thực tế có sẵn trong kho ShopNova:
${productContext}

Quy tắc trả lời:
1. Trả lời bằng tiếng Việt thân thiện, nhiệt tình, lịch sự, xưng "Nova" và gọi "bạn".
2. Dựa vào sở thích, size, ngân sách trong hồ sơ trí nhớ của người dùng để tư vấn thật tinh tế.
3. Nếu người dùng hỏi phối đồ/set đồ: hãy giải thích lý do tại sao các món này phối hợp ăn ý với nhau (về màu sắc, chất liệu, hoàn cảnh).
4. Câu trả lời súc tích, tối đa 3-4 câu, không dài dòng. Không tự bịa mã giảm giá ngoài hệ thống.
5. Luôn làm nổi bật chính sách hỗ trợ giao hàng nhanh và sự an tâm khi mua hàng trên NovaShop.`

  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 4500)

    const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [
              { text: `${systemPrompt}\n\nNgười dùng hỏi: "${query}"` },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.65,
          topP: 0.9,
          maxOutputTokens: 250,
        },
      }),
      signal: controller.signal,
    }).finally(() => clearTimeout(timer))

    if (!response.ok) {
      console.warn('[Gemini API] Lỗi HTTP status:', response.status)
      return null
    }

    const data = await response.json()
    const candidateText = data?.candidates?.[0]?.content?.parts?.[0]?.text
    if (typeof candidateText === 'string' && candidateText.trim().length > 0) {
      return candidateText.trim()
    }
    return null
  } catch (err) {
    console.warn('[Gemini API] Bỏ qua lỗi gọi Gemini, chuyển sang catalog engine:', err.message)
    return null
  }
}
