/**
 * CƠ SỞ KIẾN THỨC CHUYÊN MÔN CỦA CHUYÊN VIÊN TƯ VẤN BÁN HÀNG NOVASHOP
 * (Senior Retail Sales Consultant Knowledge Base & Reasoning Framework)
 *
 * Cung cấp:
 * 1. Khung phân tích nhu cầu khách hàng (Needs Discovery & Intent Hierarchy).
 * 2. Kiến thức chuyên môn theo ngành hàng (Chất liệu, Form dáng, Thông số kỹ thuật, Mỹ phẩm).
 * 3. Quy chuẩn phối màu & bánh xe màu sắc (Color Theory).
 * 4. Quy tắc tư vấn súc tích, logic, loại trừ sản phẩm không phù hợp (Filtering & Elimination).
 */

export const CONSULTANT_KNOWLEDGE_BASE = {
  // 1. Khung phân loại nhu cầu thực tế của khách hàng
  needsClassification: {
    useCases: [
      { id: 'work_office', keywords: ['đi làm', 'công sở', 'văn phòng', 'lịch sự', 'họp hành'], label: 'Công sở & Trang trọng' },
      { id: 'party_event', keywords: ['đi tiệc', 'dạ hội', 'đám cưới', 'sinh nhật', 'sang trọng', 'nổi bật'], label: 'Dự tiệc & Sự kiện' },
      { id: 'casual_street', keywords: ['dạo phố', 'đi chơi', 'cà phê', 'cuối tuần', 'thoải mái'], label: 'Dạo phố & Thường nhật' },
      { id: 'sports_gym', keywords: ['thể thao', 'tập gym', 'chạy bộ', 'vận động', 'thoáng khí'], label: 'Thể thao & Vận động' },
      { id: 'gift_giving', keywords: ['tặng quà', 'quà sinh nhật', 'tặng bạn gái', 'tặng bạn trai', 'tặng mẹ'], label: 'Quà tặng' },
      { id: 'tech_utility', keywords: ['chống ồn', 'nghe nhạc', 'pin trâu', 'chống nước', 'học tập', 'gaming'], label: 'Công nghệ & Tiện ích' },
    ],
    urgencyLevels: [
      { id: 'urgent_same_day', keywords: ['hỏa tốc', 'gấp', 'hôm nay', 'ngay', '2h', '2 giờ'], label: 'Cần hàng gấp trong ngày' },
      { id: 'standard', keywords: ['tiêu chuẩn', 'vài ngày', 'cuối tuần'], label: 'Giao tiêu chuẩn' },
    ],
  },

  // 2. Kiến thức chuyên ngành thời trang & may mặc
  fashionDomain: {
    fabrics: {
      linen: {
        name: 'Vải Linen (Đũi cao cấp)',
        features: 'Thoáng khí, thấm hút mồ hôi vượt trội, sợi tự nhiên mát lạnh, nếp nhăn tự nhiên mộc mạc và sang trọng.',
        suitableFor: 'Mùa hè, dạo phố, du lịch biển, phong cách vintage/tối giản.',
        careGuide: 'Giặt nhẹ tay, ủi khi còn hơi ẩm.',
      },
      cotton: {
        name: 'Cotton 100% / Cotton 2 chiều, 4 chiều',
        features: 'Co giãn mềm mại, thấm hút tốt, độ bền cao, thân thiện tuyệt đối với làn da.',
        suitableFor: 'Áo thun hàng ngày, đồ thể thao, mặc nhà, đồ lót.',
        careGuide: 'Giặt máy chế độ thường, tránh phơi trực tiếp dưới nắng gắt.',
      },
      silk: {
        name: 'Lụa Satin / Lụa Tơ Tằm',
        features: 'Bề mặt bóng mịn, rủ mềm tôn đường cong, sang trọng quý phái.',
        suitableFor: 'Đầm dạ tiệc, áo sơ mi cao cấp, áo lụa đi làm.',
        careGuide: 'Giặt tay với nước lạnh hoặc giặt khô, không vắt xoắn.',
      },
      kaki: {
        name: 'Kaki Cotton co giãn nhẹ',
        features: 'Giữ form chuẩn, dày dặn nhưng không bí bách, che khuyết điểm chân và tôn dáng eo.',
        suitableFor: 'Quần short, quần tây, chân váy cạp cao, dạo phố năng động.',
        careGuide: 'Ủi ở nhiệt độ trung bình, giặt mặt trái để giữ màu.',
      },
    },

    // Bảng quy chuẩn kích cỡ chuẩn Việt Nam
    sizeStandards: {
      female: [
        { size: 'S', weightKg: '40 - 47kg', heightCm: '1m50 - 1m58', waistCm: '62 - 66cm' },
        { size: 'M', weightKg: '48 - 53kg', heightCm: '1m55 - 1m62', waistCm: '67 - 71cm' },
        { size: 'L', weightKg: '54 - 60kg', heightCm: '1m60 - 1m68', waistCm: '72 - 76cm' },
        { size: 'XL', weightKg: '61 - 68kg', heightCm: '1m62 - 1m70', waistCm: '77 - 82cm' },
      ],
      male: [
        { size: 'M', weightKg: '50 - 60kg', heightCm: '1m60 - 1m68', chestCm: '88 - 92cm' },
        { size: 'L', weightKg: '61 - 70kg', heightCm: '1m68 - 1m75', chestCm: '93 - 97cm' },
        { size: 'XL', weightKg: '71 - 80kg', heightCm: '1m72 - 1m80', chestCm: '98 - 104cm' },
        { size: 'XXL', weightKg: '81 - 90kg', heightCm: '1m75 - 1m85', chestCm: '105 - 110cm' },
      ],
    },

    // Quy tắc phối màu (Color Theory)
    colorRules: {
      terracottaCream: 'Tone Cam Đất (Terracotta) kết hợp Trắng Kem / Be tạo cảm giác ấm áp, thanh lịch, cực kỳ tôn da người châu Á.',
      pastelHarmony: 'Tone Pastel (Hồng phấn, Xanh baby, Vàng bơ) đi cùng Trắng / Denim mang lại nét tươi trẻ, ngọt ngào và trẻ trung.',
      monochrome: 'Tone Đen - Trắng kinh điển mang lại sự tối giản, hiện đại và không bao giờ lỗi mốt.',
    },
  },

  // 3. Kiến thức chuyên ngành đồ điện tử & công nghệ
  techDomain: {
    audio: {
      anc: {
        feature: 'Chống ồn chủ động ANC (Active Noise Cancellation)',
        explanation: 'Sử dụng micro thu âm thanh môi trường và phát sóng âm ngược pha để triệt tiêu tiếng ồn máy bay, xe cộ, văn phòng lên tới 35-40dB. Giúp tập trung tuyệt đối khi học tập và làm việc.',
      },
      enc: {
        feature: 'Chống ồn đàm thoại ENC',
        explanation: 'Lọc tạp âm gió và tiếng ồn xung quanh khi gọi điện, giúp giọng nói người dùng rõ ràng trong trẻo.',
      },
      waterproof: {
        feature: 'Chuẩn kháng nước & mồ hôi IPX',
        levels: {
          'IPX4': 'Chống mồ hôi và tia nước bắn nhẹ (phù hợp chạy bộ, tập gym).',
          'IPX5': 'Chống tia nước áp lực thấp, an toàn dưới mưa vừa.',
          'IPX7': 'Chống ngâm nước ở độ sâu 1m trong 30 phút.',
        },
      },
      bluetooth: {
        feature: 'Bluetooth 5.3',
        explanation: 'Tiết kiệm pin, độ trễ siêu thấp dưới 45ms (hạn chế lệch tiếng khi xem phim, chơi game), kết nối ổn định trong phạm vi 10-15m.',
      },
    },
  },

  // 4. Nguyên tắc cốt lõi của người tư vấn viên chuyên nghiệp (Consultant Principles)
  consultantPrinciples: [
    'LUÔN GHI NHỚ NGỮ CẢNH: Khi khách hỏi câu tiếp theo (ví dụ: "còn màu đen không?", "giá bao nhiêu?", "có chống nước không?"), phải hiểu ngay khách đang nói về sản phẩm hoặc tiêu chuẩn ở câu hỏi trước. Tuyệt đối không bắt khách nhắc lại từ đầu.',
    'KHÔNG HỎI LẠI ĐIỀU ĐÃ BIẾT: Nếu khách đã nêu ngân sách, size, giới tính hoặc địa chỉ ở lượt trước, không bao giờ hỏi lại thông tin đó.',
    'ĐI THẲNG VÀO TRỌNG TÂM: Trả lời ngắn gọn, súc tích (100 - 180 từ), không vòng vo chào hỏi dài dòng, không dùng văn mẫu rập khuôn.',
    'LẬP LUẬN LOGIC DỰA TRÊN KỸ THUẬT: Đưa ra lý do chính xác (về chất liệu, tính năng, thông số) tại sao sản phẩm được chọn lại đáp ứng đúng nhu cầu của khách.',
    'SÀNG LỌC CHÍNH XÁC: Chỉ gợi ý các sản phẩm thỏa mãn tiêu chí ràng buộc (ngân sách trần, đối tượng, phân loại).',
  ],
}

/**
 * Trích xuất nhu cầu và ràng buộc chuyên môn từ câu hỏi của khách hàng
 */
export function analyzeConsultantNeeds(queryText, previousBrainContext = {}) {
  const text = String(queryText || '').toLowerCase()
  const detectedNeeds = {
    useCase: null,
    urgency: null,
    isFollowUp: false,
    followUpTopic: null, // 'color', 'size', 'price', 'specs', 'shipping', 'compare'
    targetProductHint: null,
  }

  // 1. Kiểm tra Use Case
  for (const uc of CONSULTANT_KNOWLEDGE_BASE.needsClassification.useCases) {
    if (uc.keywords.some((kw) => text.includes(kw))) {
      detectedNeeds.useCase = uc.label
      break
    }
  }

  // 2. Kiểm tra tính khẩn cấp
  for (const urg of CONSULTANT_KNOWLEDGE_BASE.needsClassification.urgencyLevels) {
    if (urg.keywords.some((kw) => text.includes(kw))) {
      detectedNeeds.urgency = urg.label
      break
    }
  }

  // 3. Nhận diện các câu hỏi tiếp nối (Follow-up Questions)
  const isFollowUpPattern =
    text.startsWith('thế còn') ||
    text.startsWith('còn') ||
    text.startsWith('cái này') ||
    text.startsWith('cái đó') ||
    text.startsWith('sản phẩm trên') ||
    text.startsWith('loại trên') ||
    text.includes('có màu khác') ||
    text.includes('có size') ||
    text.includes('vừa không') ||
    text.includes('mặc vừa') ||
    text.includes('vừa người') ||
    /size\s*[smlxl0-9]/i.test(text) ||
    text.includes('có chống nước') ||
    text.includes('bao nhiêu tiền') ||
    text.includes('giá bao nhiêu') ||
    text.includes('ship về') ||
    text.includes('loại nào tốt hơn') ||
    text.includes('bền không')

  if (isFollowUpPattern) {
    detectedNeeds.isFollowUp = true

    if (text.includes('màu')) detectedNeeds.followUpTopic = 'color'
    else if (text.includes('size') || text.includes('kích cỡ') || text.includes('vừa không')) detectedNeeds.followUpTopic = 'size'
    else if (text.includes('giá') || text.includes('bao nhiêu') || text.includes('tiền')) detectedNeeds.followUpTopic = 'price'
    else if (text.includes('chống nước') || text.includes('pin') || text.includes('chống ồn') || text.includes('thông số') || text.includes('chất liệu')) detectedNeeds.followUpTopic = 'specs'
    else if (text.includes('ship') || text.includes('giao') || text.includes('khi nào')) detectedNeeds.followUpTopic = 'shipping'
    else if (text.includes('so sánh') || text.includes('loại nào hơn') || text.includes('tốt hơn')) detectedNeeds.followUpTopic = 'compare'
    else detectedNeeds.followUpTopic = 'general_detail'
  }

  return detectedNeeds
}
