import { env } from '../config/env.js'

// Danh sách các mô hình Gemini hỗ trợ theo thứ tự ưu tiên tốc độ & độ sâu tư duy
const GEMINI_MODELS = [
  'gemini-3.5-flash-lite', // Phản hồi cực nhanh ~1.2s, tư duy ngôn ngữ xuất sắc
  'gemini-3.5-flash',      // Fallback thế hệ 3.5 tiêu chuẩn
  'gemini-3.8-flash',      // Fallback thế hệ 3.8
]

/**
 * Gọi Google Gemini AI để trực tiếp tư duy và sinh câu trả lời tư vấn mua sắm thông minh,
 * tuyệt đối không dùng các mẫu câu soạn sẵn rập khuôn.
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

  // Ngữ cảnh danh mục sản phẩm thực tế từ kho NovaShop
  const productContext = catalogProducts.slice(0, 6).map((p, idx) => {
    const priceStr = new Intl.NumberFormat('vi-VN').format(p.price) + 'đ'
    return `${idx + 1}. [${p.name}] - Giá: ${priceStr} | Đánh giá: ${p.rating || 5.0}★ | Đã bán: ${p.sold || 100}`
  }).join('\n')

  // Ngữ cảnh hồ sơ trí nhớ người dùng đã tích lũy (AI Brain)
  const brainContext = [
    brainProfile.preferredStyles?.length ? `• Gu thời trang ưa thích: ${brainProfile.preferredStyles.join(', ')}` : null,
    brainProfile.sizes?.clothing ? `• Size quần áo: ${brainProfile.sizes.clothing}` : null,
    brainProfile.budgetRange?.max ? `• Mức giá quan tâm: dưới ${new Intl.NumberFormat('vi-VN').format(brainProfile.budgetRange.max)}đ` : null,
    brainProfile.location ? `• Địa bàn nhận hàng: ${brainProfile.location}` : null,
    brainProfile.learnedFacts?.length ? `• Dữ liệu sở thích đã ghi nhớ: ${brainProfile.learnedFacts.slice(-4).join('; ')}` : null,
  ].filter(Boolean).join('\n')

  const systemInstruction = `Bạn là Nova AI Copilot - Bộ não trợ lý AI thông minh toàn diện của sàn thương mại điện tử NovaShop (nhận diện thương hiệu tông Terracotta & Kem).

YÊU CẦU CỐT LÕI:
1. TƯ DUY ĐỘC LẬP & TỰ NHIÊN: Hãy phân tích kỹ ý định thực sự, cảm xúc, hoàn cảnh và nhu cầu của khách hàng. Trả lời như một chuyên gia tư vấn mua sắm & stylist tận tâm, am hiểu gu thời trang và sản phẩm.
2. TUYỆT ĐỐI XÓA BỎ VĂN MẪU RẬP KHUÔN: Không mở đầu bằng các câu máy móc như "Nova đã phối trọn bộ theo gu...", "Nova đã đối chiếu các mẫu bán chạy...", "Nova đã tiếp nhận yêu cầu...". Hãy mở đầu sống động, tự nhiên, đi thẳng vào giải pháp và cảm xúc.
3. NGỮ CẢNH CÁ NHÂN HÓA: Tận dụng trí nhớ AI Brain (size, sở thích, ngân sách) để đưa ra lời khuyên vừa vặn nhất cho khách.
4. TƯ VẤN SẢN PHẨM THỰC TẾ: Lồng ghép khéo léo các sản phẩm có sẵn trong danh mục ShopNova bên dưới vào lời khuyên (nêu rõ lý do phối hợp, màu sắc, phom dáng hoặc tính năng nổi bật).
5. VĂN PHONG: Tiếng Việt chuẩn mực, ấm áp, lịch thiệp, xưng "Nova" và gọi "bạn". Có thể dùng định dạng Markdown (in đậm, gạch đầu dòng) để khách dễ đọc.`

  const promptText = `=== HỒ SƠ TRÍ NHỚ KHÁCH HÀNG (AI BRAIN) ===
${brainContext || 'Khách hàng mới ghé thăm, chưa có dữ liệu quá khứ.'}

=== SẢN PHẨM CÓ SẴN TRONG KHO HÀNG NOVASHOP ===
${productContext || 'Đang cập nhật kho hàng.'}

=== CÂU HỎI / YÊU CẦU CỦA KHÁCH HÀNG ===
"${query}"

Hãy suy nghĩ sâu sắc và viết câu trả lời tư vấn tốt nhất cho khách hàng ngay bây giờ:`

  // Thử lần lượt các model Gemini (bắt đầu từ flash-lite siêu nhanh)
  for (const model of GEMINI_MODELS) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`
    try {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), 9500) // 9.5s timeout đảm bảo không bị ngắt quãng

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
            temperature: 0.75,
            topP: 0.95,
            maxOutputTokens: 500,
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
