/**
 * KIỂM THỬ THUẬT TOÁN AI TƯ VẤN VIÊN BÁN HÀNG CẤP CAO NOVASHOP
 * 1. Phân tích nhu cầu người dùng chuyên sâu (Needs Discovery).
 * 2. Ghi nhớ các câu hỏi & câu trả lời trước đó (Multi-turn Conversation Memory).
 * 3. Trả lời súc tích, logic, đúng trọng tâm điều khách muốn.
 * 4. Lọc và xếp hạng sản phẩm dựa trên cơ sở kiến thức chuyên môn của tư vấn viên.
 */

import { aiBrainService } from '../src/services/ai-brain.service.js'
import { CONSULTANT_KNOWLEDGE_BASE, analyzeConsultantNeeds } from '../src/services/consultant-knowledge.js'

let totalTests = 0
let passedTests = 0

function assert(condition, message) {
  totalTests++
  if (condition) {
    console.log(`  ✓ PASS: ${message}`)
    passedTests++
  } else {
    console.error(`  ✗ FAIL: ${message}`)
    process.exitCode = 1
  }
}

console.log('=== BẮT ĐẦU KIỂM THỬ THUẬT TOÁN AI TƯ VẤN VIÊN NOVASHOP ===\n')

// TEST 1: Cơ sở kiến thức tư vấn viên đầy đủ
assert(
  typeof CONSULTANT_KNOWLEDGE_BASE === 'object',
  'Cơ sở kiến thức tư vấn viên (CONSULTANT_KNOWLEDGE_BASE) tồn tại và hợp lệ'
)
assert(
  Array.isArray(CONSULTANT_KNOWLEDGE_BASE.needsClassification.useCases) &&
  CONSULTANT_KNOWLEDGE_BASE.needsClassification.useCases.length >= 5,
  'Hệ thống phân loại mục đích sử dụng (Use Cases) đầy đủ (Công sở, Dự tiệc, Dạo phố, Thể thao, Quà tặng)'
)
assert(
  typeof CONSULTANT_KNOWLEDGE_BASE.fashionDomain.fabrics.linen === 'object' &&
  typeof CONSULTANT_KNOWLEDGE_BASE.techDomain.audio.anc === 'object',
  'Kiến thức chuyên môn chất liệu (Linen, Cotton, Lụa) và thông số kỹ thuật (ANC, IPX, Bluetooth) sẵn sàng'
)

// TEST 2: Phân tích nhu cầu chuyên sâu (Needs Discovery)
const need1 = analyzeConsultantNeeds('Tìm set đồ dạo phố cuối tuần thoáng mát')
assert(
  need1.useCase === 'Dạo phố & Thường nhật',
  `Phân tích chính xác Use Case: ${need1.useCase}`
)

const need2 = analyzeConsultantNeeds('Cần mua gấp tai nghe giao hỏa tốc 2h trong hôm nay')
assert(
  need2.urgency === 'Cần hàng gấp trong ngày',
  `Phân tích chính xác độ khẩn cấp vận chuyển: ${need2.urgency}`
)

// TEST 3: Nhận diện câu hỏi tiếp nối (Follow-up Questions)
const followUp1 = analyzeConsultantNeeds('Có chống nước đi mưa không?')
assert(
  followUp1.isFollowUp === true && followUp1.followUpTopic === 'specs',
  'Nhận diện câu hỏi tiếp nối về thông số kỹ thuật (specs: chống nước)'
)

const followUp2 = analyzeConsultantNeeds('Giá bao nhiêu tiền vậy?')
assert(
  followUp2.isFollowUp === true && followUp2.followUpTopic === 'price',
  'Nhận diện câu hỏi tiếp nối về giá bán (price)'
)

const followUp3 = analyzeConsultantNeeds('Size M mặc vừa không?')
assert(
  followUp3.isFollowUp === true && followUp3.followUpTopic === 'size',
  'Nhận diện câu hỏi tiếp nối về kích cỡ (size)'
)

// TEST 4: Ký ức hội thoại đa lượt (Multi-turn Working Memory & Deduplication)
const testSessionId = `test_session_${Date.now()}`

// Lượt 1: Khách đưa ra yêu cầu ban đầu kèm các tiêu chí ràng buộc
const turn1Result = aiBrainService.learnFromMessage(
  testSessionId,
  'Tìm giúp mình tai nghe bluetooth chống ồn ANC giá dưới 400k ở TP.HCM'
)

assert(
  turn1Result.brain.confirmedCriteria.budgetMax === 400000,
  'Bộ não đã ghi nhớ mức ngân sách trần: 400.000đ'
)
assert(
  turn1Result.brain.confirmedCriteria.location === 'TP.HCM',
  'Bộ não đã ghi nhớ địa chỉ nhận hàng: TP.HCM'
)

// Mô phỏng AI trả lời và lưu lượt 1 vào Working Memory
aiBrainService.recordConversationTurn(testSessionId, {
  userQuery: 'Tìm giúp mình tai nghe bluetooth chống ồn ANC giá dưới 400k ở TP.HCM',
  aiReply: 'Nova đề xuất Tai Nghe Bluetooth True Wireless Chống Ồn ANC Nova Sound giá 349.000đ, đạt chuẩn ANC khử ồn 35dB và sẵn hàng hỏa tốc tại TP.HCM.',
  intent: 'product_recommendation',
  products: [
    {
      id: 'p_tai_nghe_anc',
      name: 'Tai Nghe Bluetooth True Wireless Chống Ồn ANC Nova Sound',
      price: 349000,
      categoryName: 'Thiết Bị Điện Tử',
    },
  ],
})

const brainAfterTurn1 = aiBrainService.getBrain(testSessionId)
assert(
  brainAfterTurn1.activeFocus.lastDiscussedProductId === 'p_tai_nghe_anc',
  `Active focus đã khóa vào sản phẩm vừa tư vấn: ${brainAfterTurn1.activeFocus.lastDiscussedProductName}`
)
assert(
  brainAfterTurn1.conversationHistory.length === 1,
  'Lịch sử hội thoại đã lưu trữ lượt 1 thành công'
)

// Lượt 2: Khách hỏi tiếp nối mà không nhắc lại tên sản phẩm hay ngân sách
const turn2Result = aiBrainService.learnFromMessage(
  testSessionId,
  'Thế cái này có chống nước đi mưa được không?'
)

assert(
  turn2Result.consultantInsights.isFollowUp === true,
  'Thuật toán nhận biết chính xác đây là câu hỏi tiếp nối'
)
assert(
  turn2Result.consultantInsights.followUpTopic === 'specs',
  'Xác định câu hỏi kế tiếp tập trung vào thông số kỹ thuật'
)

// Kiểm tra thuật toán xếp hạng và lọc sản phẩm kế thừa active focus
const mockCatalog = [
  { id: 'p_crop_top', name: 'Áo Croptop Linen Pastel', price: 159000 },
  { id: 'p_tai_nghe_anc', name: 'Tai Nghe Bluetooth True Wireless Chống Ồn ANC Nova Sound', price: 349000 },
  { id: 'p_loa_bluetooth_dat_tien', name: 'Dàn Loa Bluetooth Cao Cấp 2.500.000đ', price: 2500000 },
]

const rankedProducts = aiBrainService.rankProductsByUserHabits(
  testSessionId,
  mockCatalog,
  turn2Result.consultantInsights
)

assert(
  rankedProducts[0].id === 'p_tai_nghe_anc',
  'Sản phẩm đang được thảo luận ở câu trước được đẩy lên ưu tiên số 1'
)
assert(
  rankedProducts[0]._consultantHighlights.includes('Sản phẩm đang trao đổi'),
  'Sản phẩm được gắn thẻ highlight: "Sản phẩm đang trao đổi"'
)
assert(
  rankedProducts[rankedProducts.length - 1].id === 'p_loa_bluetooth_dat_tien',
  'Sản phẩm vượt quá ngân sách (2.500.000đ > 400.000đ) bị phạt điểm và đẩy xuống cuối'
)

// TEST 5: Dọn dẹp session test
aiBrainService.resetBrain(testSessionId)
console.log('\n=== TỔNG KẾT KẾT QUẢ KIỂM THỬ THUẬT TOÁN AI ===')
console.log(`Số bài kiểm tra vượt qua (PASS): ${passedTests}/${totalTests}`)

if (passedTests === totalTests) {
  console.log('🎉 TẤT CẢ CÁC BÀI KIỂM THỬ THUẬT TOÁN ĐỀU ĐẠT CHUẨN XUẤT SẮC!')
  process.exit(0)
} else {
  console.error('❌ CÓ BÀI KIỂM THỬ THẤT BẠI!')
  process.exit(1)
}
