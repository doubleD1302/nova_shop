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

  // Ngữ cảnh hồ sơ thói quen & trí nhớ người dùng đã tích lũy (AI Brain Habits)
  const brainContext = [
    brainProfile.preferredStyles?.length ? `• Thói quen gu thời trang: ${brainProfile.preferredStyles.join(', ')}` : null,
    brainProfile.sizes?.clothing ? `• Thói quen kích cỡ thường chọn: ${brainProfile.sizes.clothing}` : null,
    brainProfile.gender ? `• Đối tượng mua sắm ưu tiên: Đồ ${brainProfile.gender}` : null,
    brainProfile.budgetRange?.max ? `• Phân khúc giá quen thuộc: Dưới ${new Intl.NumberFormat('vi-VN').format(brainProfile.budgetRange.max)}đ` : null,
    brainProfile.location ? `• Khu vực nhận hàng quen thuộc: ${brainProfile.location}` : null,
    brainProfile.learnedFacts?.length ? `• Lịch sử thói quen & hành vi đã tích lũy: ${brainProfile.learnedFacts.slice(-5).join('; ')}` : null,
  ].filter(Boolean).join('\n')

  const systemInstruction = `Bạn là Nova AI - Bộ não trợ lý AI thông minh toàn diện của sàn thương mại điện tử NovaShop (nhận diện thương hiệu tông Terracotta & Kem).

YÊU CẦU CỐT LÕI:
1. GỢI Ý THÔNG MINH DỰA TRÊN THÓI QUEN NGƯỜI DÙNG: Luôn phân tích kỹ các thói quen quen thuộc của khách hàng (gu thời trang, mức giá quen thuộc, kích cỡ, danh mục hay tương tác). Giải thích ngắn gọn và tinh tế lý do gợi ý phù hợp với thói quen của họ (ví dụ: "Dựa vào thói quen chọn tone pastel / size M / phân khúc giá quen thuộc của bạn...").
2. TƯ DUY ĐỘC LẬP & TỰ NHIÊN: Trả lời như một stylist và chuyên gia mua sắm hàng đầu, am hiểu chất liệu, kiểu dáng và hoàn cảnh sử dụng.
3. TUYỆT ĐỐI KHÔNG DÙNG VĂN MẪU RẬP KHUÔN: Không dùng các câu mở đầu sáo rỗng. Hãy đi thẳng vào tư vấn cuốn hút, chân thành.
4. TƯ VẤN SẢN PHẨM THỰC TẾ: Lồng ghép khéo léo các sản phẩm có sẵn trong danh mục ShopNova bên dưới vào lời khuyên.
5. VĂN PHONG: Tiếng Việt chuẩn mực, ấm áp, lịch thiệp, xưng "Nova" và gọi "bạn".`

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
