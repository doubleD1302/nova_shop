import { env } from '../config/env.js'
import { CONSULTANT_KNOWLEDGE_BASE } from './consultant-knowledge.js'

// Danh sách các mô hình Gemini hỗ trợ theo thứ tự ưu tiên tốc độ & độ sâu tư duy
const GEMINI_MODELS = [
  'gemini-3.5-flash-lite', // Phản hồi cực nhanh ~1.2s, tư duy ngôn ngữ xuất sắc
  'gemini-3.5-flash',      // Fallback thế hệ 3.5 tiêu chuẩn
  'gemini-3.8-flash',      // Fallback thế hệ 3.8
]

/**
 * Gọi Google Gemini AI đóng vai trò Chuyên Viên Tư Vấn Bán Hàng Cấp Cao của NovaShop:
 * - Phân tích nhu cầu khách hàng theo chiều sâu.
 * - Ghi nhớ các câu hỏi & câu trả lời trước đó trong phiên để trả lời logic, không hỏi lại.
 * - Trả lời súc tích, ngắn gọn, đúng trọng tâm điều khách hàng muốn.
 * - Sàng lọc sản phẩm dựa trên cơ sở kiến thức chuyên môn (chất liệu, thông số, bảng size, màu sắc).
 */
export async function generateGeminiShoppingAdvice({
  query,
  conversationHistory = [],
  brainProfile = {},
  catalogProducts = [],
  intent = 'general',
  consultantInsights = null,
}) {
  const apiKey = env.geminiApiKey
  if (!apiKey) {
    return null
  }

  // 1. Ngữ cảnh sản phẩm thực tế từ kho NovaShop
  const productContext = (catalogProducts || []).slice(0, 5).map((p, idx) => {
    const priceStr = new Intl.NumberFormat('vi-VN').format(p.price) + 'đ'
    const origStr = p.originalPrice ? ` (Gốc: ${new Intl.NumberFormat('vi-VN').format(p.originalPrice)}đ)` : ''
    const badge = p.mall ? '[Shop Mall] ' : ''
    return `${idx + 1}. ${badge}[${p.name}] - Giá: ${priceStr}${origStr} | Đánh giá: ${p.rating || 5.0}★ | Đã bán: ${p.sold || 100}`
  }).join('\n')

  // 2. Ngữ cảnh lịch sử hội thoại trước đó (ghi nhớ các câu hỏi & câu trả lời đã diễn ra)
  const historyTurns = (conversationHistory || []).slice(-4).map((turn, idx) => {
    const uText = turn.userQuery || (turn.isUser ? turn.text : '') || ''
    const aText = turn.aiReply || (!turn.isUser ? turn.text : '') || ''
    if (!uText && !aText) return null
    const shortAnswer = aText.length > 200 ? `${aText.slice(0, 200)}...` : aText
    return `• Lượt ${idx + 1}:
  - Khách đã hỏi: "${uText}"
  - Nova đã tư vấn: "${shortAnswer}"`
  }).filter(Boolean).join('\n')

  // 3. Ngữ cảnh hồ sơ thói quen & tiêu chí đã chốt từ AI Brain
  const brainContext = [
    brainProfile.preferredStyles?.length ? `• Gu thời trang yêu thích: ${brainProfile.preferredStyles.join(', ')}` : null,
    brainProfile.sizes?.clothing ? `• Size quần áo quen thuộc: ${brainProfile.sizes.clothing}` : null,
    brainProfile.gender ? `• Đối tượng ưu tiên: ${brainProfile.gender}` : null,
    brainProfile.budgetRange?.max ? `• Ngân sách trần đã biết: Dưới ${new Intl.NumberFormat('vi-VN').format(brainProfile.budgetRange.max)}đ` : null,
    brainProfile.location ? `• Địa chỉ nhận hàng quen thuộc: ${brainProfile.location}` : null,
    brainProfile.learnedFacts?.length ? `• Thói quen đã tích lũy: ${brainProfile.learnedFacts.slice(-4).join('; ')}` : null,
  ].filter(Boolean).join('\n')

  // 4. Kiến thức chuyên môn tư vấn viên trích xuất
  const consultantNotes = []
  if (consultantInsights?.useCase) {
    consultantNotes.push(`• Mục đích sử dụng đã phân tích: ${consultantInsights.useCase}`)
  }
  if (consultantInsights?.isFollowUp) {
    consultantNotes.push(`• Đây là câu hỏi tiếp nối liên quan đến: ${consultantInsights.followUpTopic || 'sản phẩm vừa trao đổi'}`)
  }

  const systemInstruction = `Bạn là Chuyên Viên Tư Vấn Bán Hàng Cấp Cao của sàn thương mại điện tử NovaShop (nhận diện thương hiệu phong cách ấm áp Terracotta & Kem).

CÁC NGUYÊN TẮC BẮT BUỘC KHI TƯ VẤN:
1. GHI NHỚ LỊCH SỬ HỘI THOẠI TRƯỚC ĐÓ: Đọc kỹ các lượt hỏi - đáp đã có ở trên. Nếu câu hỏi hiện tại là câu hỏi tiếp nối (ví dụ: "có màu đen không?", "giá bao nhiêu?", "có chống nước không?", "so với cái kia thì sao?"), hãy kế thừa ngay sản phẩm và thông tin ở lượt trước. TUYỆT ĐỐI KHÔNG bắt khách nhắc lại từ đầu và KHÔNG hỏi lại ngân sách/size/địa chỉ đã được khách cung cấp.
2. TRẢ LỜI NGẮN GỌN, ĐÚNG TRỌNG TÂM & LOGIC: Không chào hỏi rườm rà. Đi thẳng vào câu trả lời giải quyết chính xác điều khách muốn ở câu hỏi đó. Dung lượng lý tưởng: 70 - 150 từ, cô đọng, sắc bén, lập luận chặt chẽ.
3. CƠ SỞ KIẾN THỨC CHUYÊN MÔN TƯ VẤN VIÊN:
   - Thời trang: Luôn am hiểu chất liệu (Linen thoáng mát, Cotton mềm thấm mồ hôi, Lụa sang trọng tôn dáng), cách phối màu (tone Terracotta & Kem, Pastel), bảng size theo vóc dáng.
   - Điện tử: Luôn nắm rõ tính năng kỹ thuật (chuẩn chống ồn chủ động ANC, chống nước IPX, Bluetooth 5.3, thời lượng pin).
4. KHÔNG DÙNG VĂN MẪU RẬP KHUÔN: Mỗi câu trả lời là một phân tích thực tế dành riêng cho khách hàng đó. Xưng "Nova" và gọi "bạn".`

  const promptText = `=== LỊCH SỬ CÂU HỎI & CÂU TRẢ LỜI TRƯỚC ĐÓ ===
${historyTurns || 'Đây là câu hỏi đầu tiên của phiên hội thoại.'}

=== HỒ SƠ THÓI QUEN & TIÊU CHÍ KHÁCH HÀNG (AI BRAIN) ===
${brainContext || 'Chưa ghi nhận tiêu chí trước đó.'}
${consultantNotes.length ? `\n=== PHÂN TÍCH CHUYÊN MÔN TƯ VẤN VIÊN ===\n${consultantNotes.join('\n')}` : ''}

=== SẢN PHẨM PHÙ HỢP CÓ SẴN TRONG KHO NOVASHOP ===
${productContext || 'Đang cập nhật kho hàng.'}

=== YÊU CẦU HIỆN TẠI CỦA KHÁCH HÀNG ===
"${query}"

Dựa trên lịch sử trao đổi và kiến thức chuyên môn, hãy tư duy logic và đưa ra câu trả lời ngắn gọn, chuẩn xác và đúng nhu cầu của khách ngay bây giờ:`

  // Thử lần lượt các model Gemini (bắt đầu từ flash-lite siêu nhanh)
  for (const model of GEMINI_MODELS) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`
    try {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), 9500) // 9.5s timeout đảm bảo phản hồi tức thì

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [{ text: `${systemInstruction}\n\n${promptText}` }],
            },
          ],
          generationConfig: {
            temperature: 0.7,
            topP: 0.9,
            maxOutputTokens: 400,
          },
        }),
        signal: controller.signal,
      }).finally(() => clearTimeout(timer))

      if (!response.ok) {
        console.warn(`[Gemini API] Model ${model} trả HTTP ${response.status}, thử model tiếp theo...`)
        continue
      }

      const data = await response.json()
      const candidateText = data?.candidates?.[0]?.content?.parts?.[0]?.text
      if (typeof candidateText === 'string' && candidateText.trim().length > 0) {
        return {
          reply: candidateText.trim(),
          modelUsed: `Google Gemini (${model})`,
        }
      }
    } catch (err) {
      console.warn(`[Gemini API] Lỗi model ${model}:`, err.message)
    }
  }

  return null
}
