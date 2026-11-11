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
    'CHỈ GỢI Ý KHI CẦN THIẾT: Nếu khách hàng chỉ hỏi chính sách sàn, kỹ thuật, cách chọn size, phối đồ hoặc không có ý định mua sắm, trả lời đúng trọng tâm và TUYỆT ĐỐI KHÔNG tự động chào mời hay đính kèm sản phẩm gây phiền hà.',
  ],

  // 5. Quy chuẩn & Chính sách nền tảng ShopNova
  platformPolicies: {
    shipping: {
      standardFee: 16500,
      standardFeeText: '16.500₫ cho mỗi gian hàng trong đơn',
      freeshipThreshold: 1000000,
      freeshipText: 'Miễn phí vận chuyển (Freeship Extra) cho đơn hàng từ 1.000.000₫',
      express2h: 'Hỗ trợ giao nhanh hỏa tốc trong 2 giờ tại nội thành Hà Nội và TP. Hồ Chí Minh',
      estimatedDays: 'Giao hàng tiêu chuẩn toàn quốc từ 2 - 4 ngày làm việc',
    },
    returnsAndRefunds: {
      returnWindowDays: 15,
      returnWindowText: 'Đổi trả miễn phí trong vòng 15 ngày kể từ ngày nhận hàng',
      refundCondition: 'Hoàn tiền 100% nếu sản phẩm có lỗi từ nhà sản xuất hoặc không đúng mô tả',
      shippingFeeBurden: 'Người bán chịu toàn bộ phí vận chuyển hai chiều đối với sản phẩm lỗi',
    },
    paymentMethods: [
      'Thanh toán khi nhận hàng (COD)',
      'Thẻ tín dụng / Thẻ ghi nợ quốc tế (Visa, Mastercard)',
      'Chuyển khoản ngân hàng qua mã VietQR',
      'Ví điện tử (MoMo, ZaloPay, VNPay)',
    ],
    inspection: {
      allowed: true,
      text: 'Được quyền đồng kiểm (kiểm tra ngoại quan gói hàng và sản phẩm) trước khi nhận hàng từ bưu tá',
    },
    authenticity: {
      guarantee: 'Cam kết 100% hàng chính hãng tại ShopNova Mall',
      warranty: 'Bảo hành chính hãng 12 tháng theo quy định nhà sản xuất',
    },
    customerSupport: {
      hotline: '1900 8888 (8:00 - 21:00 hàng ngày)',
      email: 'support@shopnova.vn',
      liveChat: 'Hỗ trợ trực tuyến 24/7 qua trợ lý Nova AI và cổng hỗ trợ khách hàng',
    },
  },
}

/**
 * Trích xuất nhu cầu và ràng buộc chuyên môn từ câu hỏi của khách hàng
 */
export function analyzeConsultantNeeds(queryText, previousBrainContext = {}) {
  const text = String(queryText || '').toLowerCase()
  const clean = text.trim()
  const detectedNeeds = {
    useCase: null,
    urgency: null,
    isFollowUp: false,
    followUpTopic: null, // 'color', 'size', 'price', 'specs', 'shipping', 'compare'
    targetProductHint: null,
    wantsProductRecommendations: true,
    intentCategory: 'product_recommendation',
    intentTitle: 'Tư vấn mua sắm ShopNova',
    suggestedPrompts: [],
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

  // 4. Phân loại ý định thông minh: Xác định khách có thực sự cần gợi ý sản phẩm hay không
  const hasExplicitNoProduct = /(?:không\s+cần|đừng|chớ|thôi\s+không)\s*(?:gợi\s+ý|đề\s+xuất|giới\s+thiệu|sản\s+phẩm|link|chào\s+hàng|bán)|(?:chỉ\s*(?:hỏi|muốn\s*biết|tư\s*vấn|giải\s*thích)\s*(?:thôi|chứ\s*không\s*mua|chưa\s*mua))/i.test(text)

  const isGreeting = /^(?:xin\s+)?chào(?:\s+(?:bạn|nova|shop|em|ad|mọi\s+người))?$|^(?:hello|hi|hey)(?:\s+nova)?$|^(?:bạn|nova)\s+(?:là\s+ai|tên\s+(?:là\s+)?gì|có\s+thể\s+làm\s+gì|giúp\s+gì\s+được|làm\s+được\s+gì)|^(?:giới\s+thiệu\s+về\s+(?:bạn|nova))|^(?:cảm\s+ơn|thanks|thank\s+you|tạm\s+biệt|bye)\b/i.test(clean)

  const hasSearchVerbs = /(?:^|\s)(?:tìm(?:\s+kiếm)?|mua|cần\s+mua|muốn\s+mua|sắm|gợi\s+ý|đề\s+xuất|giới\s+thiệu|cho\s+(?:mình\s+)?xem|show|xem\s+sản\s+phẩm|xem\s+mẫu|có\s+bán|shop\s+có\s+(?:bán\s+)?|có\s+mẫu\s+nào|mẫu\s+nào\s+(?:đẹp|hot|tốt|rẻ|hợp)|loại\s+nào\s+(?:tốt|bền|rẻ)|set\s+đồ|outfit|combo|tư\s+vấn\s+sản\s+phẩm|tư\s+vấn\s+mua)(?:\s|$)/i.test(text)

  const isFollowUpAlternative = text.includes('màu khác') || text.includes('mẫu khác') || text.includes('loại khác') || text.includes('rẻ hơn không') || text.includes('gợi ý thêm') || text.includes('loại nào hơn') || text.includes('loại nào tốt hơn')

  const isPolicySupport = /(?:chính\s+sách|quy\s+định)\s*(?:đổi\s*trả|bảo\s*hành|vận\s*chuyển|giao\s*hàng|hoàn\s*tiền)|(?:đổi\s*trả|trả\s*hàng|hoàn\s*tiền|đổi\s*hàng|đổi\s*size)|(?:phí\s*(?:ship|vận\s*chuyển|giao\s*hàng)|tiền\s*ship|freeship|miễn\s*phí\s*vận\s*chuyển)|(?:giao\s*hàng\s*(?:mất\s*)?(?:bao\s*lâu|mấy\s*ngày|khi\s*nào|có\s*nhanh|hỏa\s*tốc|2h|2\s*giờ))|(?:phương\s*thức\s*thanh\s*toán|thanh\s*toán\s*(?:như\s*thế\s*nào|bằng\s*gì|khi\s*nhận|cod|chuyển\s*khoản|qua\s*thẻ))|(?:đồng\s*kiểm|kiểm\s*(?:tra\s*)?hàng(?:\s*trước)?|xem\s*hàng\s*trước)|(?:bảo\s*hành\s*(?:bao\s*lâu|ở\s*đâu|mấy\s*tháng|chính\s*hãng))|(?:hàng\s*(?:chính\s*hãng|thật|auth|chuẩn)\s*(?:không|nhỉ))|(?:chăm\s*sóc\s*khách\s*hàng|hotline|tổng\s*đài|số\s*điện\s*thoại\s*hỗ\s*trợ|liên\s*hệ\s*(?:sàn|shopnova|hỗ\s*trợ)|khiếu\s*nại|gặp\s*(?:nhân\s*viên|tổng\s*đài\s*viên|cskh))|(?:hướng\s*dẫn\s*(?:đặt\s*hàng|mua\s*hàng|áp\s*mã|dùng\s*voucher|sử\s*dụng\s*mã))/i.test(text)

  const isKnowledgeAdvice = /(?:là\s+gì|nghĩa\s+là\s+gì|như\s+thế\s+nào|ra\s+sao|hoạt\s+động\s+thế\s+nào)|(?:cách\s*(?:chọn\s*size|giặt|bảo\s*quản|phối\s*đồ|phối\s*màu|lựa\s*đồ))|(?:bảng\s*size|size\s*chuẩn|tư\s*vấn\s*size)|(?:\d+kg|\d+m\d+.*mặc\s*size\s*gì)|(?:vải\s*(?:linen|đũi|cotton|lụa|kaki)\s*(?:có\s*mát|có\s*nhăn|có\s*bền|như\s*thế\s*nào|giặt\s*sao))|(?:chống\s*ồn\s*anc\s*(?:là\s*gì|hoạt\s*động|khác\s*gì))|(?:bánh\s*xe\s*màu\s*sắc|tone\s*màu|màu\s*cam\s*đất\s*phối)/i.test(text)

  const mentionsItemType = /(?:^|\s)(?:áo|quần|váy|đầm|tai\s*nghe|giày|dép|túi(?:\s*xách)?|balo|son|mỹ\s*phẩm|loa|sơ\s*mi|hoodie|croptop|chân\s*váy)(?:\s|$)/i.test(text)

  if (hasExplicitNoProduct) {
    detectedNeeds.wantsProductRecommendations = false
    detectedNeeds.intentCategory = isPolicySupport ? 'customer_support' : 'consulting_advice'
    detectedNeeds.intentTitle = isPolicySupport ? 'Chính sách & Hỗ trợ ShopNova' : 'Tư vấn chuyên môn'
    detectedNeeds.suggestedPrompts = isPolicySupport
      ? ['🚚 Phí vận chuyển & Freeship Extra', '🔄 Quy định đổi trả 15 ngày', '💳 Phương thức thanh toán']
      : ['👕 Bảng size chuẩn ShopNova', '🎨 Cách phối màu tôn da', '💡 Kiến thức chất liệu vải']
  } else if (hasSearchVerbs || isFollowUpAlternative) {
    detectedNeeds.wantsProductRecommendations = true
    detectedNeeds.intentCategory = 'product_recommendation'
    detectedNeeds.intentTitle = 'Tư vấn mua sắm ShopNova'
    detectedNeeds.suggestedPrompts = [
      '✨ Gợi ý thêm mẫu tương tự',
      '💰 Xem mẫu giá mềm hơn',
      '⭐ Xem sản phẩm bán chạy',
    ]
  } else if (isPolicySupport) {
    detectedNeeds.wantsProductRecommendations = false
    detectedNeeds.intentCategory = 'customer_support'
    detectedNeeds.intentTitle = 'Chính sách & Hỗ trợ ShopNova'
    detectedNeeds.suggestedPrompts = [
      '🚚 Phí vận chuyển & Freeship',
      '🔄 Quy định đổi trả 15 ngày',
      '💳 Hỗ trợ COD & thanh toán',
      '📞 Hotline hỗ trợ 1900 8888',
    ]
  } else if (isKnowledgeAdvice) {
    detectedNeeds.wantsProductRecommendations = false
    detectedNeeds.intentCategory = 'consulting_advice'
    detectedNeeds.intentTitle = 'Tư vấn chuyên môn'
    detectedNeeds.suggestedPrompts = [
      '👕 Bảng size chuẩn ShopNova',
      '🛍️ Gợi ý mẫu thời trang phù hợp',
      '🎨 Nguyên tắc phối màu Terracotta & Kem',
    ]
  } else if (isGreeting) {
    detectedNeeds.wantsProductRecommendations = false
    detectedNeeds.intentCategory = 'general_chat'
    detectedNeeds.intentTitle = 'Trợ lý Nova AI'
    detectedNeeds.suggestedPrompts = [
      '✨ Gợi ý thời trang hot hôm nay',
      '🚚 Chính sách đổi trả & Freeship',
      '👕 Hướng dẫn chọn size chuẩn',
    ]
  } else if (detectedNeeds.isFollowUp) {
    // Câu hỏi tiếp nối về sản phẩm đang thảo luận (ví dụ: "Có chống nước đi mưa không?", "Giá bao nhiêu tiền?")
    // Tập trung trả lời thông số kỹ thuật/chi tiết mà không ép thêm danh sách sản phẩm khác
    detectedNeeds.wantsProductRecommendations = false
    detectedNeeds.intentCategory = 'consulting_advice'
    detectedNeeds.intentTitle = 'Chi tiết sản phẩm'
    detectedNeeds.suggestedPrompts = [
      '✨ Có màu khác không?',
      '💰 Có mẫu nào rẻ hơn không?',
      '🚚 Giao hàng về địa chỉ của tôi mất mấy ngày?',
    ]
  } else if (mentionsItemType) {
    detectedNeeds.wantsProductRecommendations = true
    detectedNeeds.intentCategory = 'product_recommendation'
    detectedNeeds.intentTitle = 'Tư vấn mua sắm ShopNova'
    detectedNeeds.suggestedPrompts = [
      '✨ Gợi ý thêm mẫu tương tự',
      '💰 Xem mẫu giá mềm hơn',
      '⭐ Xem sản phẩm bán chạy',
    ]
  } else {
    detectedNeeds.wantsProductRecommendations = false
    detectedNeeds.intentCategory = 'general_chat'
    detectedNeeds.intentTitle = 'Trợ lý Nova AI'
    detectedNeeds.suggestedPrompts = [
      '✨ Gợi ý thời trang hot hôm nay',
      '🚚 Chính sách đổi trả & Freeship',
      '👕 Hướng dẫn chọn size chuẩn',
    ]
  }

  return detectedNeeds
}
