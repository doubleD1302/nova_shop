import {
  getProducts,
  fetchOrders,
  fetchOrderDetail,
  fetchVouchers,
  DataApiClientError,
} from '../clients/data.client.js'

/**
 * Danh sách từ khóa thời trang và danh mục loại trừ
 */
const FASHION_PATTERNS = /(áo|quần|váy|đầm|blazer|jacket|khoác|vest|suit|giày|dép|sandal|túi|balo|ví|thắt lưng|nón|mũ|khăn|phụ kiện thời trang|set đồ|chân váy)/i
const NON_FASHION_PATTERNS = /(laptop|máy tính|điện thoại|smartphone|iphone|samsung|tai nghe|headphone|earphone|củ sạc|dây sạc|cáp sạc|sạc dự phòng|chuột|bàn phím|loa|tivi|màn hình|linh kiện)/i

/**
 * Kiểm tra xem sản phẩm có phải thời trang/phụ kiện may mặc không
 */
function isFashionProduct(p) {
  if (!p) return false
  const text = `${p.name || ''} ${p.categoryName || ''} ${p.description || ''}`.toLowerCase()
  if (NON_FASHION_PATTERNS.test(text)) {
    return false
  }
  return FASHION_PATTERNS.test(text)
}

/**
 * Trích xuất từ khóa tìm kiếm tiềm năng từ câu hỏi của người dùng
 */
function extractSearchKeyword(text) {
  const lower = text.toLowerCase()

  // Danh mục từ khóa phổ biến trong thương mại điện tử
  const keywords = [
    { pattern: /(tai nghe|headphone|earphone|airpod|sound)/i, keyword: 'tai nghe' },
    { pattern: /(áo thun|áo polo|áo phông|áo sơ mi|áo khoác|áo croptop|áo)/i, keyword: 'áo' },
    { pattern: /(quần jean|quần short|quần kaki|quần dài|quần)/i, keyword: 'quần' },
    { pattern: /(củ sạc|dây sạc|cáp sạc|sạc nhanh|sạc dự phòng|sạc)/i, keyword: 'sạc' },
    { pattern: /(bàn phím|keyboard|chuột|mouse)/i, keyword: 'bàn phím' },
    { pattern: /(son môi|son kem|son dưỡng|son)/i, keyword: 'son' },
    { pattern: /(túi xách|túi vải|balo|ví)/i, keyword: 'túi' },
    { pattern: /(đồng hồ|smartwatch)/i, keyword: 'đồng hồ' },
    { pattern: /(laptop|máy tính)/i, keyword: 'laptop' },
    { pattern: /(điện thoại|smartphone|iphone|samsung)/i, keyword: 'điện thoại' },
  ]

  for (const item of keywords) {
    if (item.pattern.test(lower)) {
      return item.keyword
    }
  }

  // Nếu câu là lời chào hỏi xã giao thông thường thì không trích search keyword
  if (/^(xin chào|chào|hello|hi|hey|alo|bạn là ai|nova là ai)/i.test(lower)) {
    return ''
  }

  // Nếu câu có ý định tìm kiếm/mua hàng rõ ràng
  const hasSearchIntent = /(tìm|kiếm|mua|gợi ý|tư vấn|xem|chọn|bán|giá rẻ|chính hãng)/i.test(lower)
  if (!hasSearchIntent) {
    return ''
  }

  // Nếu không khớp từ khóa chuyên biệt, loại bỏ các cụm giá và từ dư thừa để lấy từ khóa tìm kiếm
  const cleaned = lower
    .replace(/(?:dưới|tầm|khoảng|tối đa|<|nhỏ hơn|gần|từ|giá|ngân sách)?\s*[0-9]+(?:[.,][0-9]+)?\s*(?:triệu|tr(?:\b|\s|$)|k(?:\b|\s|$)|nghìn|ngàn|đ|vnd|đồng)/gi, '')
    .replace(/(tìm|kiếm|gợi ý|tư vấn|mua|cho tôi|giúp tôi|hãy|cần|muốn|giá rẻ|chính hãng|dưới|tầm giá|khoảng)/gi, '')
    .trim()

  return cleaned.length >= 2 ? cleaned : ''
}

/**
 * Trích xuất giới hạn ngân sách (nếu người dùng có nêu mức giá)
 * Xử lý chính xác:
 * - Dạng có đủ đơn vị: "1 triệu 50 nghìn" = 1.050.000đ
 * - Dạng viết tắt thập phân: "1tr5" = 1.500.000đ
 * - Dạng nghìn: "200k", "500 nghìn" = 200.000đ, 500.000đ
 * - Dạng số: "200000", "200.000đ" = 200.000đ
 */
function extractBudgetLimit(text) {
  const lower = text.toLowerCase()

  // 1. Dạng hỗn hợp có đơn vị nghìn/k: "1 triệu 50 nghìn", "2 tr 300 ngàn", "1 triệu 50k"
  const compoundWithThousand = lower.match(
    /(?:dưới|tầm|khoảng|tối đa|<|nhỏ hơn|gần|từ|giá|ngân sách)?\s*([0-9]+)\s*(?:triệu|tr)\s*([0-9]+)\s*(?:nghìn|ngàn|k(?:\b|\s|$))/i,
  )
  if (compoundWithThousand) {
    const million = parseInt(compoundWithThousand[1], 10)
    const thousand = parseInt(compoundWithThousand[2], 10)
    return million * 1000000 + thousand * 1000
  }

  // 2. Dạng triệu kép viết tắt thập phân: "1tr5", "2tr8", "1 triệu 5" (không có nghìn/k theo sau)
  const compoundMillionMatch = lower.match(
    /(?:dưới|tầm|khoảng|tối đa|<|nhỏ hơn|gần|từ|giá|ngân sách)?\s*([0-9]+)\s*(?:tr|triệu)\s*([0-9])(?!\s*(?:nghìn|ngàn|k|[0-9]))/i,
  )
  if (compoundMillionMatch) {
    const main = parseInt(compoundMillionMatch[1], 10)
    const frac = parseInt(compoundMillionMatch[2], 10)
    return main * 1000000 + frac * 100000
  }

  // 3. Dạng triệu thông thường: "dưới 1.5 triệu", "dưới 2tr", "dưới 1 triệu"
  const millionMatch = lower.match(
    /(?:dưới|tầm|khoảng|tối đa|<|nhỏ hơn|gần|từ|giá|ngân sách)?\s*([0-9]+(?:[.,][0-9]+)?)\s*(?:triệu|tr(?:\b|\s|$))/i,
  )
  if (millionMatch) {
    const num = parseFloat(millionMatch[1].replace(',', '.'))
    if (!isNaN(num) && num > 0) {
      return Math.round(num * 1000000)
    }
  }

  // 4. Dạng 'k' hoặc nghìn: "dưới 200k", "dưới 200 k", "dưới 500 nghìn"
  const thousandMatch = lower.match(
    /(?:dưới|tầm|khoảng|tối đa|<|nhỏ hơn|gần|từ|giá|ngân sách)?\s*([0-9]+(?:[.,][0-9]+)?)\s*(?:k(?:\b|\s|$)|nghìn|ngàn)/i,
  )
  if (thousandMatch) {
    const num = parseFloat(thousandMatch[1].replace(',', '.'))
    if (!isNaN(num) && num > 0) {
      return Math.round(num * 1000)
    }
  }

  // 5. Dạng số đầy đủ: "dưới 200000", "dưới 200.000đ", "dưới 200.000 ₫"
  const fullNumMatch = lower.match(
    /(?:dưới|tầm|khoảng|tối đa|<|nhỏ hơn|gần|từ|giá|ngân sách)?\s*([0-9]{1,3}(?:[.,][0-9]{3})+|[0-9]{4,9})\s*(?:đ|vnd|đồng)?/i,
  )
  if (fullNumMatch) {
    const cleanNumStr = fullNumMatch[1].replace(/[.,]/g, '')
    const num = parseInt(cleanNumStr, 10)
    if (!isNaN(num) && num > 0) {
      return num
    }
  }

  return null
}

/**
 * Trích xuất mã đơn hàng được hỏi cụ thể (nếu có)
 */
function extractOrderCode(text) {
  // 1. Dạng mã ORD: ORD123, ORD-456
  const ordMatch = text.match(/(?:^|[^a-z0-9])(ORD[-A-Z0-9]+)(?:$|[^a-z0-9])/i)
  if (ordMatch) {
    return ordMatch[1].toUpperCase()
  }

  // 2. Dạng có dấu thăng: #101, #ORD123
  const hashMatch = text.match(/#([A-Z0-9_-]+)/i)
  if (hashMatch) {
    return hashMatch[1].toUpperCase()
  }

  // 3. Dạng nêu rõ "mã đơn", "đơn số", "đơn mã": "đơn số 101", "đơn mã 204", "mã đơn 101"
  const explicitCodeMatch = text.match(/(?:đơn\s*(?:hàng)?\s*(?:mã|số|#)|mã\s*đơn\s*(?:số|#)?)\s*([0-9a-z_-]+)/i)
  if (explicitCodeMatch) {
    return explicitCodeMatch[1].toUpperCase()
  }

  // 4. Dạng đơn kèm số trực tiếp: "đơn 101", "đơn hàng 101"
  const directNumMatch = text.match(/(?:^|\s)đơn\s*(?:hàng)?\s*([0-9]+)(?:\s|$|[^0-9])/i)
  if (directNumMatch) {
    return directNumMatch[1].toUpperCase()
  }

  return null
}

/**
 * Định dạng tiền tệ VND
 */
function formatVnd(amount) {
  return Number(amount || 0).toLocaleString('vi-VN') + ' ₫'
}

/**
 * Kiểm tra lỗi upstream (Data API 500/503 hoặc gián đoạn kết nối)
 */
function isUpstreamFailure(err) {
  if (!err) return false
  if (err instanceof DataApiClientError) {
    return err.status >= 500 || err.code === 'DATABASE_UNAVAILABLE' || err.code === 'SERVICE_UNAVAILABLE' || err.code === 'DATA_API_UNAVAILABLE'
  }
  return true
}

/**
 * POST /api/v1/ai/chat
 * Endpoint Trợ lý Mua sắm Thông minh Nova AI Copilot
 */
export async function chatWithAi(req, res, next) {
  try {
    const { message } = req.body || {}

    // 1. Thẩm định tham số bắt buộc message
    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Nội dung câu hỏi không được để trống.',
        error: { code: 'VALIDATION_ERROR', field: 'message' },
      })
    }

    const trimmedMessage = message.trim()
    if (trimmedMessage.length > 2000) {
      return res.status(400).json({
        success: false,
        message: 'Nội dung câu hỏi không được vượt quá 2000 ký tự.',
        error: { code: 'MESSAGE_TOO_LONG', field: 'message' },
      })
    }

    const lower = trimmedMessage.toLowerCase()
    const currentUser = req.user || null
    const budgetLimit = extractBudgetLimit(trimmedMessage)

    // 2. Phân loại Ý định (Intent Classification)
    const hasVoucherWord =
      lower.includes('voucher') ||
      lower.includes('mã giảm giá') ||
      lower.includes('mã giảm') ||
      lower.includes('khuyến mãi') ||
      lower.includes('ưu đãi') ||
      lower.includes('freeship') ||
      lower.includes('mã freeship') ||
      lower.includes('chiết khấu') ||
      lower.includes('giảm giá')

    const detectedOrderCode = extractOrderCode(trimmedMessage)

    // Nhận diện ý định tra cứu hành trình/trạng thái đơn hàng cá nhân
    const hasPersonalOrderTrackingIntent =
      lower.includes('đơn của tôi') ||
      lower.includes('đơn hàng của tôi') ||
      lower.includes('đơn mua của tôi') ||
      lower.includes('tình trạng đơn') ||
      lower.includes('khi nào giao') ||
      lower.includes('hành trình') ||
      lower.includes('kiểm tra đơn') ||
      lower.includes('xem đơn') ||
      lower.includes('hủy đơn') ||
      /đơn hàng.*(?:ở đâu|khi nào|bao giờ|tới chưa|giao chưa)/i.test(lower)

    // Ưu tiên VOUCHER: Khi có từ khóa khuyến mãi/voucher, dù câu có chứa cụm "đơn hàng"
    // (như "mã giảm giá cho đơn hàng từ 500k", "voucher cho đơn 200k"),
    // miễn là không hỏi mã đơn cụ thể và không phải hỏi xem tiến trình đơn cá nhân -> Ý định là VOUCHER!
    const isVoucherIntent = hasVoucherWord && !detectedOrderCode && !hasPersonalOrderTrackingIntent

    // Tra cứu ĐƠN HÀNG: khi có mã đơn cụ thể, hoặc có ý định tra cứu đơn cá nhân,
    // hoặc hỏi chung về đơn hàng mà không phải hỏi voucher
    const isOrderIntent =
      !isVoucherIntent &&
      (Boolean(detectedOrderCode) ||
        hasPersonalOrderTrackingIntent ||
        lower.includes('đơn hàng') ||
        lower.includes('đơn mua') ||
        lower.includes('mã đơn') ||
        lower.includes('tra cứu') ||
        lower.includes('vận chuyển'))

    // CASE B: Khuyến mãi & Mã giảm giá Voucher (Promotion & Vouchers)
    if (isVoucherIntent) {
      let activeVouchers = []
      try {
        const rawVouchers = await fetchVouchers()
        const vouchersList = Array.isArray(rawVouchers) ? rawVouchers : (rawVouchers?.data || [])
        activeVouchers = vouchersList.filter((v) => v.isActive)
      } catch (err) {
        if (isUpstreamFailure(err)) {
          return res.status(200).json({
            success: true,
            message: 'Hệ thống voucher tạm thời gián đoạn.',
            data: {
              reply: 'Hệ thống kho voucher tạm thời không khả dụng do gián đoạn kết nối dữ liệu. Bạn vui lòng thử lại sau ít phút nhé!',
              intent: 'promotion_voucher',
              intentTitle: 'Dịch Vụ Voucher Tạm Thời Không Khả Dụng',
              intentMatch: 'Khớp 90%',
              suggestions: ['Thử lại sau ít phút', 'Xem các sản phẩm nổi bật'],
              vouchers: null,
              orderData: null,
              products: null,
              outfitCombo: null,
            },
          })
        }
      }

      if (activeVouchers.length > 0) {
        const voucherLines = activeVouchers.map(
          (v) => `• Mã **${v.code}**: Giảm ${formatVnd(v.discountAmount)} cho đơn hàng từ ${formatVnd(v.minSubtotal)} (tên: ${v.name}).`,
        )

        return res.status(200).json({
          success: true,
          message: 'Trợ lý Nova AI cung cấp mã giảm giá thành công.',
          data: {
            reply: `Nova gửi bạn các mã Voucher đang có hiệu lực trên ShopNova:\n\n${voucherLines.join('\n')}\n\nBạn hãy nhập mã tại bước Đặt hàng để nhận chiết khấu trực tiếp nhé!`,
            intent: 'promotion_voucher',
            intentTitle: 'Kho Voucher ShopNova',
            intentMatch: 'Khớp 98%',
            suggestions: [
              'Cách áp dụng mã giảm giá khi đặt hàng',
              'Xem các sản phẩm đủ điều kiện áp mã',
              'Khám phá ưu đãi miễn phí vận chuyển',
            ],
            vouchers: activeVouchers,
            orderData: null,
            products: null,
            outfitCombo: null,
          },
        })
      }

      // Khi kho voucher rỗng hoặc chưa có voucher nào active
      return res.status(200).json({
        success: true,
        message: 'Trợ lý Nova AI phản hồi thành công.',
        data: {
          reply: 'Hiện tại ShopNova chưa có mã giảm giá toàn sàn nào đang mở. Nova sẽ cập nhật ngay khi có đợt phát hành voucher mới, bạn nhớ theo dõi nhé!',
          intent: 'promotion_voucher',
          intentTitle: 'Thông Tin Voucher ShopNova',
          intentMatch: 'Khớp 95%',
          suggestions: [
            'Xem các sản phẩm đang giảm giá',
            'Đăng ký nhận thông báo ưu đãi',
            'Tìm kiếm sản phẩm nổi bật',
          ],
          vouchers: [],
          orderData: null,
          products: null,
          outfitCombo: null,
        },
      })
    }

    // CASE A: Tra cứu đơn hàng (Order Tracking)
    if (isOrderIntent) {
      if (currentUser && currentUser.id) {
        try {
          const queryOrderCode = detectedOrderCode
          let selectedOrder = null

          if (queryOrderCode) {
            // Người dùng nêu đích danh mã đơn hàng hoặc số đơn
            try {
              selectedOrder = await fetchOrderDetail(queryOrderCode, currentUser.id)
            } catch (err) {
              if (isUpstreamFailure(err)) {
                return res.status(200).json({
                  success: true,
                  message: 'Hệ thống tra cứu đơn hàng tạm thời gián đoạn.',
                  data: {
                    reply: 'Hệ thống tra cứu đơn hàng tạm thời không khả dụng do gián đoạn kết nối dữ liệu. Bạn vui lòng thử lại sau ít phút nhé!',
                    intent: 'order_tracking',
                    intentTitle: 'Dịch Vụ Tạm Thời Không Khả Dụng',
                    intentMatch: 'Khớp 90%',
                    suggestions: [
                      'Thử lại sau ít phút',
                      'Kiểm tra lại kết nối mạng',
                      'Liên hệ bộ phận chăm sóc khách hàng',
                    ],
                    orderData: null,
                    products: null,
                    outfitCombo: null,
                    vouchers: null,
                  },
                })
              }

              if (err instanceof DataApiClientError && (err.status === 404 || err.status === 403)) {
                selectedOrder = null
              } else {
                try {
                  const ordersResult = await fetchOrders({ userId: currentUser.id, limit: 50 })
                  const orders = Array.isArray(ordersResult) ? ordersResult : (ordersResult?.data || [])
                  selectedOrder = orders.find(
                    (o) =>
                      (o.code && (o.code.toUpperCase() === queryOrderCode || o.code.replace(/-/g, '').toUpperCase() === queryOrderCode.replace(/-/g, ''))) ||
                      String(o.id) === queryOrderCode,
                  )
                } catch (fallbackErr) {
                  if (isUpstreamFailure(fallbackErr)) {
                    return res.status(200).json({
                      success: true,
                      message: 'Hệ thống tra cứu đơn hàng tạm thời gián đoạn.',
                      data: {
                        reply: 'Hệ thống tra cứu đơn hàng tạm thời không khả dụng do gián đoạn kết nối dữ liệu. Bạn vui lòng thử lại sau ít phút nhé!',
                        intent: 'order_tracking',
                        intentTitle: 'Dịch Vụ Tạm Thời Không Khả Dụng',
                        intentMatch: 'Khớp 90%',
                        suggestions: ['Thử lại sau ít phút'],
                        orderData: null,
                        products: null,
                        outfitCombo: null,
                        vouchers: null,
                      },
                    })
                  }
                }
              }
            }

            if (!selectedOrder) {
              return res.status(200).json({
                success: true,
                message: 'Trợ lý Nova AI phản hồi thành công.',
                data: {
                  reply: `Nova không tìm thấy đơn hàng nào có mã "${queryOrderCode}" trong tài khoản của bạn. Bạn vui lòng kiểm tra lại mã đơn hàng chính xác trong mục Đơn Mua nhé!`,
                  intent: 'order_tracking',
                  intentTitle: `Không Tìm Thấy Đơn Hàng #${queryOrderCode}`,
                  intentMatch: 'Khớp 99%',
                  suggestions: [
                    'Xem tất cả đơn hàng đã mua',
                    'Liên hệ hỗ trợ chăm sóc khách hàng',
                    'Gợi ý sản phẩm nổi bật',
                  ],
                  orderData: null,
                  products: null,
                  outfitCombo: null,
                  vouchers: null,
                },
              })
            }
          } else {
            // Người dùng không nêu mã cụ thể: lấy đơn mới nhất
            try {
              const ordersResult = await fetchOrders({ userId: currentUser.id, limit: 10 })
              const orders = Array.isArray(ordersResult) ? ordersResult : (ordersResult?.data || [])
              selectedOrder = orders.length > 0 ? orders[0] : null
            } catch (err) {
              if (isUpstreamFailure(err)) {
                return res.status(200).json({
                  success: true,
                  message: 'Hệ thống tra cứu đơn hàng tạm thời gián đoạn.',
                  data: {
                    reply: 'Hệ thống tra cứu đơn hàng tạm thời không khả dụng do gián đoạn kết nối dữ liệu. Bạn vui lòng thử lại sau ít phút nhé!',
                    intent: 'order_tracking',
                    intentTitle: 'Dịch Vụ Tạm Thời Không Khả Dụng',
                    intentMatch: 'Khớp 90%',
                    suggestions: ['Thử lại sau ít phút'],
                    orderData: null,
                    products: null,
                    outfitCombo: null,
                    vouchers: null,
                  },
                })
              }
            }
          }

          if (selectedOrder) {
            const orderCode = selectedOrder.code || `ORD-${selectedOrder.id}`
            const total = Number(selectedOrder.totalAmount || 0)
            const shopOrders = Array.isArray(selectedOrder.shopOrders) ? selectedOrder.shopOrders : []

            // Phân loại và tổng hợp trạng thái đa shop trung thực
            const activeShops = shopOrders.filter((so) => so.status !== 'cancelled')
            const shippingShop = shopOrders.find((so) => so.status === 'shipping')
            const deliveredShop = shopOrders.find((so) => so.status === 'delivered')
            const confirmedShop = shopOrders.find((so) => so.status === 'confirmed')
            const pendingShop = shopOrders.find((so) => so.status === 'pending')

            let aggregatedStatus = selectedOrder.status || 'pending'
            let statusLabel = 'Đang xử lý'
            let chosenShop = null
            let location = 'Chưa xác định'
            let eta = 'Chưa xác định'
            let shipper = null
            let replyText = ''

            if (shopOrders.length > 0) {
              if (activeShops.length === 0) {
                // Toàn bộ các shop đều đã hủy
                aggregatedStatus = 'cancelled'
                statusLabel = 'Đã hủy đơn hàng'
                chosenShop = shopOrders[0]
                location = 'Đơn hàng đã hủy'
                eta = 'Không áp dụng'
                shipper = null
                const rawCancelReason = chosenShop?.cancelReason || selectedOrder.cancelReason
                const reasonText = rawCancelReason ? ` (Lý do: ${rawCancelReason})` : ''
                replyText = `Nova kiểm tra thấy đơn hàng #${orderCode} của bạn hiện ở trạng thái "Đã hủy đơn hàng"${reasonText}. Đơn hàng này không còn trong tiến trình giao nhận.`
              } else if (activeShops.every((so) => so.status === 'delivered')) {
                // Toàn bộ shop (chưa hủy) đều đã giao thành công
                aggregatedStatus = 'delivered'
                statusLabel = 'Giao hàng thành công'
                chosenShop = deliveredShop || activeShops[0]
                location = 'Đã giao đến địa chỉ người nhận'
                eta = 'Đã hoàn tất giao hàng'
                shipper = chosenShop?.shippingName || null
                replyText = `Đơn hàng #${orderCode} của bạn đã được giao thành công với tổng thanh toán ${formatVnd(total)}. Cảm ơn bạn đã mua sắm tại ShopNova!`
              } else if (shippingShop) {
                // Có shop đang vận chuyển -> BẮT BUỘC chọn shop đang shipping để lấy shipper và trackingCode
                aggregatedStatus = 'shipping'
                statusLabel = 'Đang vận chuyển giao hàng'
                chosenShop = shippingShop
                location = shippingShop.shippingName
                  ? `Đang vận chuyển qua ${shippingShop.shippingName}`
                  : 'Đang trên đường giao hàng'
                eta = shippingShop.estimatedDelivery || 'Chưa xác định'
                shipper = shippingShop.shippingName || null
                replyText = `Đơn hàng #${orderCode} của bạn đang ở trạng thái "Đang vận chuyển giao hàng". Kiện hàng đang trên đường vận chuyển an toàn!`
              } else if (deliveredShop && (pendingShop || confirmedShop)) {
                // Có shop đã giao, nhưng các shop còn lại chưa shipping (đang pending hoặc confirmed)
                // Tuyệt đối không suy diễn là shipping!
                aggregatedStatus = confirmedShop ? 'confirmed' : 'pending'
                statusLabel = confirmedShop ? 'Đã giao một phần - đang chuẩn bị' : 'Đã giao một phần - chờ xác nhận'
                chosenShop = confirmedShop || pendingShop || deliveredShop
                location = 'Một phần đơn hàng đã giao thành công, các sản phẩm còn lại đang được chuẩn bị tại kho'
                eta = 'Chờ bàn giao vận chuyển'
                shipper = null
                replyText = `Đơn hàng #${orderCode} của bạn hiện có kiện hàng đã giao thành công và các sản phẩm còn lại đang được người bán tiếp nhận chuẩn bị đóng gói tại kho.`
              } else if (confirmedShop) {
                // Các shop chưa giao đều đang chuẩn bị hàng tại kho
                aggregatedStatus = 'confirmed'
                statusLabel = 'Người bán đang chuẩn bị hàng'
                chosenShop = confirmedShop
                location = 'Người bán đang chuẩn bị hàng tại kho'
                eta = 'Chờ bàn giao cho đơn vị vận chuyển'
                shipper = null
                replyText = `Đơn hàng #${orderCode} của bạn đã được người bán xác nhận và đang đóng gói chuẩn bị hàng tại kho.`
              } else {
                // Còn lại là chờ người bán xác nhận
                aggregatedStatus = 'pending'
                statusLabel = 'Chờ người bán xác nhận'
                chosenShop = pendingShop || activeShops[0]
                location = 'Chờ người bán tiếp nhận đơn'
                eta = 'Chờ xác nhận'
                shipper = null
                replyText = `Đơn hàng #${orderCode} của bạn đang ở trạng thái "Chờ người bán xác nhận" với tổng thanh toán ${formatVnd(total)}.`
              }
            } else {
              // Đơn không có shopOrders chi tiết
              const statusMap = {
                pending: 'Chờ người bán xác nhận',
                confirmed: 'Người bán đang chuẩn bị hàng',
                shipping: 'Đang vận chuyển giao hàng',
                delivered: 'Giao hàng thành công',
                cancelled: 'Đã hủy đơn hàng',
              }
              statusLabel = statusMap[aggregatedStatus] || 'Đang xử lý'
              replyText = `Đơn hàng #${orderCode} của bạn đang ở trạng thái "${statusLabel}" với tổng thanh toán ${formatVnd(total)}.`
            }

            return res.status(200).json({
              success: true,
              message: 'Trợ lý Nova AI tra cứu đơn hàng thành công.',
              data: {
                reply: replyText,
                intent: 'order_tracking',
                intentTitle: `Nova Tra Cứu Đơn Hàng #${orderCode}`,
                intentMatch: 'Khớp 99%',
                suggestions: [
                  'Xem chi tiết đơn hàng trong mục Đơn Mua',
                  'Chính sách đổi trả bảo hành 7 ngày',
                  'Liên hệ hỗ trợ chăm sóc khách hàng',
                ],
                orderData: {
                  code: orderCode,
                  status: aggregatedStatus,
                  statusLabel,
                  total,
                  recipientName: selectedOrder.recipientName || 'Khách hàng',
                  address: [selectedOrder.addressDetail, selectedOrder.ward, selectedOrder.district, selectedOrder.province]
                    .filter(Boolean)
                    .join(', ') || 'Chưa xác định',
                  shipper: aggregatedStatus === 'cancelled' ? null : shipper,
                  location,
                  eta,
                  trackingCode: chosenShop?.trackingCode || null,
                  itemCount: shopOrders.reduce((acc, so) => acc + (so.items?.length || 0), 0) || 1,
                },
                products: null,
                outfitCombo: null,
                vouchers: null,
              },
            })
          } else {
            return res.status(200).json({
              success: true,
              message: 'Trợ lý Nova AI phản hồi thành công.',
              data: {
                reply: 'Hiện tại bạn chưa có đơn hàng nào trong tài khoản. Nova sẵn sàng gợi ý cho bạn các sản phẩm đang có ưu đãi lớn hôm nay!',
                intent: 'order_tracking',
                intentTitle: 'Tình Trạng Mua Sắm',
                intentMatch: 'Khớp 98%',
                suggestions: [
                  'Xem các sản phẩm bán chạy hôm nay',
                  'Khám phá mã giảm giá voucher',
                  'Gợi ý set đồ thời trang hot',
                ],
                orderData: null,
                products: null,
                outfitCombo: null,
                vouchers: null,
              },
            })
          }
        } catch (err) {
          if (isUpstreamFailure(err)) {
            return res.status(200).json({
              success: true,
              message: 'Hệ thống tra cứu đơn hàng tạm thời gián đoạn.',
              data: {
                reply: 'Hệ thống tra cứu đơn hàng tạm thời không khả dụng do gián đoạn kết nối dữ liệu. Bạn vui lòng thử lại sau ít phút nhé!',
                intent: 'order_tracking',
                intentTitle: 'Dịch Vụ Tạm Thời Không Khả Dụng',
                intentMatch: 'Khớp 90%',
                suggestions: ['Thử lại sau ít phút'],
                orderData: null,
                products: null,
                outfitCombo: null,
                vouchers: null,
              },
            })
          }
        }
      }

      // Khách chưa đăng nhập: Phân biệt giữa lỗi dịch vụ xác thực và khách vãng lai
      if (req.authServiceError) {
        return res.status(200).json({
          success: true,
          message: 'Hệ thống xác thực tài khoản tạm thời gián đoạn.',
          data: {
            reply: 'Hệ thống xác thực tài khoản tạm thời không khả dụng do gián đoạn kết nối dữ liệu. Bạn vui lòng thử lại sau ít phút nhé!',
            intent: 'order_tracking',
            intentTitle: 'Dịch Vụ Tạm Thời Không Khả Dụng',
            intentMatch: 'Khớp 90%',
            suggestions: ['Thử lại sau ít phút', 'Liên hệ bộ phận chăm sóc khách hàng'],
            orderData: null,
            products: null,
            outfitCombo: null,
            vouchers: null,
          },
        })
      }

      return res.status(200).json({
        success: true,
        message: 'Trợ lý Nova AI phản hồi thành công.',
        data: {
          reply: 'Để tra cứu thông tin đơn hàng cá nhân và hành trình vận chuyển thời gian thực, bạn vui lòng đăng nhập vào tài khoản ShopNova nhé!',
          intent: 'order_tracking',
          intentTitle: 'Tra Cứu Đơn Hàng Yêu Cầu Đăng Nhập',
          intentMatch: 'Khớp 95%',
          suggestions: [
            'Đăng nhập tài khoản ngay',
            'Xem các ưu đãi mua sắm mới nhất',
            'Tìm kiếm sản phẩm nổi bật',
          ],
          orderData: null,
          products: null,
          outfitCombo: null,
          vouchers: null,
        },
      })
    }

    // CASE C: Tư vấn phối đồ & Gợi ý Combo (Outfit & Fashion Styling)
    if (
      lower.includes('phối đồ') ||
      lower.includes('outfit') ||
      lower.includes('tiệc') ||
      lower.includes('đi chơi') ||
      lower.includes('set đồ') ||
      lower.includes('combo') ||
      lower.includes('mặc gì') ||
      lower.includes('phong cách')
    ) {
      let outfitProducts = []
      try {
        // Tận dụng sort=price_asc khi có yêu cầu ngân sách để các sản phẩm rẻ lên đầu
        const prodResult = await getProducts({
          limit: 100,
          sort: budgetLimit !== null ? 'price_asc' : undefined,
        })
        const rawList = Array.isArray(prodResult) ? prodResult : (prodResult?.data || [])
        // Chỉ chọn sản phẩm thời trang thật sự, loại trừ điện tử, laptop
        let fashionProducts = rawList.filter(isFashionProduct)

        // Nếu có nhiều trang và chưa đủ sản phẩm thời trang, fetch tiếp trang 2
        const meta = prodResult?.meta || {}
        if (fashionProducts.length < 3 && meta.totalPages > 1) {
          try {
            const page2 = await getProducts({
              page: 2,
              limit: 100,
              sort: budgetLimit !== null ? 'price_asc' : undefined,
            })
            const list2 = Array.isArray(page2) ? page2 : (page2?.data || [])
            fashionProducts = [...fashionProducts, ...list2.filter(isFashionProduct)]
          } catch {}
        }

        if (fashionProducts.length > 0) {
          if (budgetLimit !== null) {
            // Sắp xếp tăng dần theo giá để tối ưu hóa ngân sách
            const sorted = [...fashionProducts].sort((a, b) => Number(a.price) - Number(b.price))
            let currentTotal = 0
            const selected = []
            for (const p of sorted) {
              if (currentTotal + Number(p.price) <= budgetLimit) {
                selected.push(p)
                currentTotal += Number(p.price)
                if (selected.length >= 3) break
              }
            }
            // Chỉ tạo outfit combo khi tổng ngân sách <= budgetLimit và có ít nhất 1 sản phẩm
            if (selected.length > 0 && currentTotal <= budgetLimit) {
              outfitProducts = selected
            }
          } else {
            outfitProducts = fashionProducts.slice(0, 3)
          }
        }
      } catch (err) {
        if (isUpstreamFailure(err)) {
          return res.status(200).json({
            success: true,
            message: 'Hệ thống tư vấn phối đồ tạm thời gián đoạn.',
            data: {
              reply: 'Hệ thống gợi ý phối đồ tạm thời không khả dụng do gián đoạn kết nối dữ liệu. Bạn vui lòng thử lại sau ít phút nhé!',
              intent: 'outfit_combo',
              intentTitle: 'Dịch Vụ Phối Đồ Tạm Thời Không Khả Dụng',
              intentMatch: 'Khớp 90%',
              suggestions: ['Thử lại sau ít phút', 'Xem các thông tin khác'],
              outfitCombo: null,
              products: null,
              orderData: null,
              vouchers: null,
            },
          })
        }
      }

      if (outfitProducts.length > 0) {
        // Tính toán số liệu THỰC TẾ dựa trên các sản phẩm thật
        const totalPrice = outfitProducts.reduce((sum, p) => sum + Number(p.price || 0), 0)
        const totalOriginalPrice = outfitProducts.reduce(
          (sum, p) => sum + Number(p.originalPrice || p.price || 0),
          0,
        )
        const savedAmount = Math.max(0, totalOriginalPrice - totalPrice)

        const productDetails = outfitProducts.map(
          (p, idx) => `${idx + 1}. **${p.name}** - Giá: **${formatVnd(p.price)}**`,
        )

        return res.status(200).json({
          success: true,
          message: 'Trợ lý Nova AI tư vấn phối đồ thành công.',
          data: {
            reply: `Nova gợi ý bạn set đồ thời trang gồm các sản phẩm sau:\n\n${productDetails.join('\n')}\n\nTổng chi phí combo là **${formatVnd(totalPrice)}**${savedAmount > 0 ? ` (tiết kiệm ${formatVnd(savedAmount)} so với giá gốc)` : ''}!`,
            intent: 'outfit_combo',
            intentTitle: 'Nova Phối Đồ Thông Minh & Tiết Kiệm',
            intentMatch: 'Khớp 97%',
            suggestions: [
              'Xem thêm phụ kiện đi kèm',
              'Đổi sang phong cách khác',
              'Xem chi tiết từng sản phẩm',
            ],
            outfitCombo: {
              title: 'Set Đồ Thời Trang Phối Sẵn',
              budgetMax: formatVnd(totalOriginalPrice > totalPrice ? totalOriginalPrice : totalPrice),
              budgetSaved: savedAmount > 0 ? `Tiết kiệm ${formatVnd(savedAmount)}` : 'Giá ưu đãi tốt nhất',
              comboPrice: formatVnd(totalPrice),
              isOutfitCombo: true,
            },
            products: outfitProducts,
            orderData: null,
            vouchers: null,
          },
        })
      }

      // Nếu không tìm thấy sản phẩm thời trang nào phù hợp ngân sách trong kho
      return res.status(200).json({
        success: true,
        message: 'Trợ lý Nova AI phản hồi thành công.',
        data: {
          reply: budgetLimit !== null
            ? `Hiện tại trong kho chưa có đủ sản phẩm thời trang phù hợp với mức ngân sách dưới ${formatVnd(budgetLimit)} để tạo combo phối đồ hoàn chỉnh. Bạn vui lòng thử nâng mức ngân sách hoặc tham khảo các danh mục sản phẩm khác nhé!`
            : 'Hiện tại trong kho chưa có đủ sản phẩm thời trang phù hợp để tạo combo phối đồ hoàn chỉnh. Bạn vui lòng quay lại sau hoặc xem các danh mục sản phẩm khác nhé!',
          intent: 'outfit_combo',
          intentTitle: 'Tư Vấn Phối Đồ',
          intentMatch: 'Khớp 90%',
          suggestions: [
            'Xem danh mục thời trang',
            'Sản phẩm bán chạy hôm nay',
            'Nhận mã giảm giá voucher',
          ],
          outfitCombo: null,
          products: null,
          orderData: null,
          vouchers: null,
        },
      })
    }

    // CASE D: Tư vấn & Gợi ý sản phẩm cụ thể có Giới hạn Ngân sách (Product Search & Recommendation)
    const keyword = extractSearchKeyword(trimmedMessage)

    if (keyword || budgetLimit !== null || lower.includes('giá') || lower.includes('mua') || lower.includes('gợi ý') || lower.includes('tìm')) {
      try {
        const searchQ = keyword || ''
        // Tận dụng sort=price_asc khi có budgetLimit để sản phẩm rẻ lên trang đầu
        const prodResult = await getProducts({
          q: searchQ,
          limit: 100,
          sort: budgetLimit !== null ? 'price_asc' : undefined,
        })
        let rawProductsList = Array.isArray(prodResult) ? prodResult : (prodResult?.data || [])

        // Nếu có nhiều trang và chưa có sản phẩm nào thỏa ngân sách, lấy thêm trang 2
        const meta = prodResult?.meta || {}
        if (budgetLimit !== null && meta.totalPages > 1 && !rawProductsList.some((p) => Number(p.price) <= budgetLimit)) {
          try {
            const page2 = await getProducts({
              q: searchQ,
              limit: 100,
              page: 2,
              sort: 'price_asc',
            })
            const list2 = Array.isArray(page2) ? page2 : (page2?.data || [])
            rawProductsList = [...rawProductsList, ...list2]
          } catch {}
        }

        // Áp dụng giới hạn ngân sách nghiêm ngặt
        let productsList = rawProductsList
        if (budgetLimit !== null) {
          productsList = rawProductsList.filter((p) => Number(p.price) <= budgetLimit)
        }

        if (productsList.length > 0) {
          const productBulletPoints = productsList.slice(0, 4).map(
            (p, idx) => `${idx + 1}. **${p.name}** - Giá: **${formatVnd(p.price)}** (Shop: ${p.shopName || 'Shop chính hãng'})`,
          )

          const budgetNote = budgetLimit !== null ? ` trong tầm giá dưới ${formatVnd(budgetLimit)}` : ''

          return res.status(200).json({
            success: true,
            message: 'Trợ lý Nova AI gợi ý sản phẩm thành công.',
            data: {
              reply: `Nova đã tìm thấy các sản phẩm phù hợp nhất với nhu cầu "${trimmedMessage}"${budgetNote} trong kho hàng ShopNova:\n\n${productBulletPoints.join('\n')}\n\nTất cả sản phẩm đều được kiểm định chất lượng, bảo hành chính hãng và hỗ trợ đổi trả miễn phí trong 7 ngày!`,
              intent: 'product_recommendation',
              intentTitle: `Nova Gợi Ý Sản Phẩm "${searchQ || 'Nổi Bật'}"`,
              intentMatch: 'Khớp 96%',
              suggestions: [
                'Xem thêm các đánh giá thực tế từ người mua',
                'Mã giảm giá áp dụng cho sản phẩm này',
                'So sánh các phân khúc giá khác',
              ],
              products: productsList,
              orderData: null,
              outfitCombo: null,
              vouchers: null,
            },
          })
        } else if (budgetLimit !== null && rawProductsList.length > 0) {
          // Có sản phẩm nhưng toàn bộ vượt quá ngân sách yêu cầu
          const minPrice = Math.min(...rawProductsList.map((p) => Number(p.price)))
          return res.status(200).json({
            success: true,
            message: 'Trợ lý Nova AI phản hồi thành công.',
            data: {
              reply: `Nova chưa tìm thấy sản phẩm "${searchQ || trimmedMessage}" nào ở mức giá dưới ${formatVnd(budgetLimit)}. Mức giá tham khảo hiện có là từ **${formatVnd(minPrice)}**. Bạn có muốn tham khảo thêm không?`,
              intent: 'product_recommendation',
              intentTitle: 'Không Tìm Thấy Sản Phẩm Phù Hợp Ngân Sách',
              intentMatch: 'Khớp 95%',
              suggestions: [
                `Xem sản phẩm giá từ ${formatVnd(minPrice)}`,
                'Tìm kiếm sản phẩm khác',
                'Nhận mã giảm giá để tiết kiệm thêm',
              ],
              products: [],
              orderData: null,
              outfitCombo: null,
              vouchers: null,
            },
          })
        } else {
          // Không tìm thấy sản phẩm nào trong kho với từ khóa hoặc ngân sách
          return res.status(200).json({
            success: true,
            message: 'Trợ lý Nova AI phản hồi thành công.',
            data: {
              reply: budgetLimit !== null
                ? `Nova chưa tìm thấy sản phẩm "${searchQ || trimmedMessage}" nào trong tầm giá dưới ${formatVnd(budgetLimit)}. Bạn có thể thử tìm kiếm với từ khóa khác nhé!`
                : `Nova chưa tìm thấy sản phẩm nào phù hợp với yêu cầu "${trimmedMessage}". Bạn có thể thử tìm kiếm với từ khóa khác nhé!`,
              intent: 'product_recommendation',
              intentTitle: 'Không Tìm Thấy Sản Phẩm Phù Hợp',
              intentMatch: 'Khớp 95%',
              suggestions: [
                'Tìm kiếm sản phẩm khác',
                'Xem tất cả danh mục sản phẩm',
                'Nhận mã giảm giá hôm nay',
              ],
              products: [],
              orderData: null,
              outfitCombo: null,
              vouchers: null,
            },
          })
        }
      } catch (err) {
        if (isUpstreamFailure(err)) {
          return res.status(200).json({
            success: true,
            message: 'Hệ thống tìm kiếm sản phẩm tạm thời gián đoạn.',
            data: {
              reply: 'Hệ thống tìm kiếm sản phẩm tạm thời không khả dụng do gián đoạn kết nối dữ liệu. Bạn vui lòng thử lại sau ít phút nhé!',
              intent: 'product_recommendation',
              intentTitle: 'Dịch Vụ Tìm Kiếm Tạm Thời Không Khả Dụng',
              intentMatch: 'Khớp 90%',
              suggestions: ['Thử lại sau ít phút', 'Xem các thông tin khác'],
              products: [],
              orderData: null,
              outfitCombo: null,
              vouchers: null,
            },
          })
        }
      }
    }

    // CASE E: Chào hỏi, Chính sách & Hỏi đáp chung (General FAQ & Greeting)
    let fallbackProducts = []
    try {
      const featured = await getProducts({ limit: 12 })
      const rawFeatured = Array.isArray(featured) ? featured : (featured?.data || [])
      // Nếu có budgetLimit, bắt buộc phải lọc theo ngân sách
      if (budgetLimit !== null) {
        fallbackProducts = rawFeatured.filter((p) => Number(p.price) <= budgetLimit)
      } else {
        fallbackProducts = rawFeatured.slice(0, 4)
      }
    } catch {}

    const isGreeting = /^(xin chào|chào|hello|hi|hey|alo|bạn là ai|nova là ai)/i.test(lower)
    const greetingReply = isGreeting
      ? 'Xin chào bạn! Tôi là **Trợ lý Mua sắm Thông minh Nova AI** của sàn thương mại điện tử ShopNova. Tôi có thể hỗ trợ bạn tìm kiếm sản phẩm theo ngân sách, tư vấn phối đồ thời trang, tra cứu tình trạng đơn hàng thời gian thực và cung cấp các mã giảm giá tốt nhất hôm nay. Bạn đang cần Nova hỗ trợ điều gì?'
      : `Nova đã tiếp nhận câu hỏi của bạn: "${trimmedMessage}". Nova luôn sẵn sàng hỗ trợ bạn tìm kiếm sản phẩm chất lượng, tư vấn chi tiết thông số kỹ thuật, theo dõi vận chuyển đơn hàng và áp dụng mã giảm giá tiết kiệm tối đa. Dưới đây là các gợi ý phổ biến bạn có thể tham khảo ngay:`

    return res.status(200).json({
      success: true,
      message: 'Trợ lý Nova AI phản hồi thành công.',
      data: {
        reply: greetingReply,
        intent: 'general_consulting',
        intentTitle: 'Trợ Lý Mua Sắm Nova AI',
        intentMatch: 'Khớp 95%',
        suggestions: [
          'Gợi ý tai nghe bluetooth chống ồn dưới 1 triệu',
          'Tư vấn phối set đồ thời trang dạo phố',
          'Tra cứu tình trạng đơn hàng của tôi',
          'Mã giảm giá voucher hôm nay',
        ],
        products: fallbackProducts.length > 0 ? fallbackProducts : [],
        orderData: null,
        outfitCombo: null,
        vouchers: null,
      },
    })
  } catch (err) {
    if (err instanceof DataApiClientError) {
      return res.status(err.status).json({
        success: false,
        message: err.message,
        error: { code: err.code },
      })
    }
    next(err)
  }
}
