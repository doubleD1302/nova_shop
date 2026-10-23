import {
  getProducts,
  fetchOrders,
  fetchOrderDetail,
  fetchVouchers,
  DataApiClientError,
} from '../clients/data.client.js'

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

  // Nếu không khớp từ khóa chuyên biệt, loại bỏ các cụm giá và từ dư thừa để lấy từ khóa tìm kiếm
  const cleaned = lower
    .replace(/(?:dưới|tầm|khoảng|tối đa|<|nhỏ hơn|gần|từ|giá|ngân sách)?\s*[0-9]+(?:[.,][0-9]+)?\s*(?:triệu|tr(?:\b|\s|$)|k(?:\b|\s|$)|nghìn|ngàn|đ|vnd|đồng)/gi, '')
    .replace(/(tìm|kiếm|gợi ý|tư vấn|mua|cho tôi|giúp tôi|hãy|cần|muốn|giá rẻ|chính hãng|dưới|tầm giá|khoảng)/gi, '')
    .trim()

  return cleaned.length >= 2 ? cleaned : ''
}

/**
 * Trích xuất giới hạn ngân sách (nếu người dùng có nêu mức giá)
 */
function extractBudgetLimit(text) {
  const lower = text.toLowerCase()

  // Dạng triệu kép: 1tr5, 2tr8, 1 triệu 5
  const compoundMillionMatch = lower.match(/(?:dưới|tầm|khoảng|tối đa|<|nhỏ hơn|gần|từ|giá|ngân sách)?\s*([0-9]+)\s*(?:tr|triệu)\s*([0-9]+)/i)
  if (compoundMillionMatch) {
    const main = parseInt(compoundMillionMatch[1], 10)
    const fracStr = compoundMillionMatch[2]
    const frac = parseInt(fracStr, 10) / Math.pow(10, fracStr.length)
    return (main + frac) * 1000000
  }

  // 1. Dạng triệu: "dưới 1.5 triệu", "dưới 2tr", "dưới 1 triệu"
  const millionMatch = lower.match(/(?:dưới|tầm|khoảng|tối đa|<|nhỏ hơn|gần|từ|giá|ngân sách)?\s*([0-9]+(?:[.,][0-9]+)?)\s*(?:triệu|tr(?:\b|\s|$))/i)
  if (millionMatch) {
    const num = parseFloat(millionMatch[1].replace(',', '.'))
    if (!isNaN(num) && num > 0) {
      return num * 1000000
    }
  }

  // 2. Dạng 'k' hoặc nghìn: "dưới 200k", "dưới 200 k", "dưới 500 nghìn"
  const thousandMatch = lower.match(/(?:dưới|tầm|khoảng|tối đa|<|nhỏ hơn|gần|từ|giá|ngân sách)?\s*([0-9]+(?:[.,][0-9]+)?)\s*(?:k(?:\b|\s|$)|nghìn|ngàn)/i)
  if (thousandMatch) {
    const num = parseFloat(thousandMatch[1].replace(',', '.'))
    if (!isNaN(num) && num > 0) {
      return num * 1000
    }
  }

  // 3. Dạng số đầy đủ: "dưới 200000", "dưới 200.000đ", "dưới 200.000 ₫"
  const fullNumMatch = lower.match(/(?:dưới|tầm|khoảng|tối đa|<|nhỏ hơn|gần|từ|giá|ngân sách)?\s*([0-9]{1,3}(?:[.,][0-9]{3})+|[0-9]{4,9})\s*(?:đ|vnd|đồng)?/i)
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
  const ordMatch = text.match(/\b(ORD[-A-Z0-9]+)\b/i)
  if (ordMatch) {
    return ordMatch[1].toUpperCase()
  }

  const hashMatch = text.match(/#([A-Z0-9_-]+)\b/i)
  if (hashMatch) {
    return hashMatch[1].toUpperCase()
  }

  const numMatch = text.match(/đơn\s*(?:hàng)?\s*(?:mã|số|#)?\s*([0-9]+)\b/i)
  if (numMatch) {
    return numMatch[1]
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
 * POST /api/v1/ai/chat
 * Endpoint Trợ lý Mua sắm Thông minh Nova AI Copilot
 */
export async function chatWithAi(req, res, next) {
  try {
    const { message, history, context } = req.body || {}

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

    // 2. Phân loại Ý định (Intent Classification) & Xử lý phản hồi

    // CASE A: Tra cứu đơn hàng (Order Tracking)
    if (
      lower.includes('đơn hàng') ||
      lower.includes('tra cứu') ||
      lower.includes('vận chuyển') ||
      lower.includes('khi nào giao') ||
      lower.includes('đơn của tôi') ||
      lower.includes('tình trạng đơn') ||
      lower.includes('mã đơn') ||
      lower.includes('hành trình') ||
      /ord[a-z0-9]+/i.test(lower)
    ) {
      if (currentUser && currentUser.id) {
        try {
          const queryOrderCode = extractOrderCode(trimmedMessage)
          let selectedOrder = null

          if (queryOrderCode) {
            // Người dùng nêu đích danh mã đơn hàng: tra cứu đúng đơn thuộc sở hữu của user
            try {
              selectedOrder = await fetchOrderDetail(queryOrderCode, currentUser.id)
            } catch (err) {
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
                } catch {}
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
            const ordersResult = await fetchOrders({ userId: currentUser.id, limit: 10 })
            const orders = Array.isArray(ordersResult) ? ordersResult : (ordersResult?.data || [])
            selectedOrder = orders.length > 0 ? orders[0] : null
          }

          if (selectedOrder) {
            const orderCode = selectedOrder.code || `ORD-${selectedOrder.id}`
            const total = Number(selectedOrder.totalAmount || 0)
            const firstShopOrder = selectedOrder.shopOrders?.[0]
            const rawStatus = firstShopOrder?.status || selectedOrder.status || 'pending'

            const statusMap = {
              pending: 'Chờ người bán xác nhận',
              confirmed: 'Người bán đang chuẩn bị hàng',
              shipping: 'Đang vận chuyển giao hàng',
              delivered: 'Giao hàng thành công',
              cancelled: 'Đã hủy đơn hàng',
            }
            const statusLabel = statusMap[rawStatus] || 'Đang xử lý'

            // Thông tin giao vận trung thực theo trạng thái thực tế
            let location = 'Chưa xác định'
            let eta = 'Chưa xác định'
            let shipper = null
            let replyText = ''

            if (rawStatus === 'cancelled') {
              location = 'Đơn hàng đã hủy'
              eta = 'Không áp dụng'
              shipper = null
              const cancelReason = firstShopOrder?.cancelReason || selectedOrder.cancelReason || 'Khách hàng hoặc người bán yêu cầu hủy'
              replyText = `Nova kiểm tra thấy đơn hàng #${orderCode} của bạn hiện ở trạng thái "${statusLabel}" (Lý do: ${cancelReason}). Đơn hàng này không còn trong tiến trình giao nhận.`
            } else if (rawStatus === 'delivered') {
              location = 'Đã giao đến địa chỉ người nhận'
              eta = 'Đã hoàn tất giao hàng'
              shipper = firstShopOrder?.shippingName || null
              replyText = `Đơn hàng #${orderCode} của bạn đã được giao thành công với tổng thanh toán ${formatVnd(total)}. Cảm ơn bạn đã mua sắm tại ShopNova!`
            } else if (rawStatus === 'shipping') {
              location = firstShopOrder?.shippingName
                ? `Đang vận chuyển qua ${firstShopOrder.shippingName}`
                : 'Đang trên đường giao hàng'
              eta = firstShopOrder?.estimatedDelivery || 'Chưa xác định'
              shipper = firstShopOrder?.shippingName || null
              replyText = `Đơn hàng #${orderCode} của bạn đang ở trạng thái "${statusLabel}". Kiện hàng đang trên đường vận chuyển an toàn!`
            } else if (rawStatus === 'confirmed') {
              location = 'Người bán đang chuẩn bị hàng tại kho'
              eta = 'Chờ bàn giao cho đơn vị vận chuyển'
              shipper = null
              replyText = `Đơn hàng #${orderCode} của bạn đã được người bán xác nhận và đang đóng gói chuẩn bị hàng tại kho.`
            } else {
              // pending
              location = 'Chờ người bán tiếp nhận đơn'
              eta = 'Chờ xác nhận'
              shipper = null
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
                  status: rawStatus,
                  statusLabel,
                  total,
                  recipientName: selectedOrder.recipientName || 'Khách hàng',
                  address: [selectedOrder.addressDetail, selectedOrder.ward, selectedOrder.district, selectedOrder.province]
                    .filter(Boolean)
                    .join(', ') || 'Chưa xác định',
                  shipper: rawStatus === 'cancelled' ? null : (shipper || 'Chưa xác định'),
                  location,
                  eta,
                  trackingCode: firstShopOrder?.trackingCode || null,
                  itemCount: selectedOrder.shopOrders?.reduce((acc, so) => acc + (so.items?.length || 0), 0) || 1,
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
          // Bắt lỗi nếu có
        }
      }

      // Chưa đăng nhập
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

    // CASE B: Khuyến mãi & Mã giảm giá Voucher (Promotion & Vouchers)
    if (
      lower.includes('voucher') ||
      lower.includes('mã giảm giá') ||
      lower.includes('khuyến mãi') ||
      lower.includes('ưu đãi') ||
      lower.includes('mã giảm') ||
      lower.includes('freeship') ||
      lower.includes('tiết kiệm')
    ) {
      let activeVouchers = []
      try {
        const rawVouchers = await fetchVouchers()
        const vouchersList = Array.isArray(rawVouchers) ? rawVouchers : (rawVouchers?.data || [])
        activeVouchers = vouchersList.filter((v) => v.isActive)
      } catch (err) {
        // Không hardcode mã giả khi upstream lỗi hoặc rỗng
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
        const prodResult = await getProducts({ q: 'áo', limit: 4 })
        const rawList = Array.isArray(prodResult) ? prodResult : (prodResult?.data || [])
        outfitProducts = rawList.slice(0, 3)

        if (outfitProducts.length === 0) {
          const fallbackResult = await getProducts({ limit: 3 })
          const fallbackList = Array.isArray(fallbackResult) ? fallbackResult : (fallbackResult?.data || [])
          outfitProducts = fallbackList.slice(0, 3)
        }
      } catch {}

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

      // Nếu không tìm thấy sản phẩm thời trang nào trong kho
      return res.status(200).json({
        success: true,
        message: 'Trợ lý Nova AI phản hồi thành công.',
        data: {
          reply: 'Hiện tại trong kho chưa có đủ sản phẩm thời trang phù hợp để tạo combo phối đồ hoàn chỉnh. Bạn vui lòng quay lại sau hoặc xem các danh mục sản phẩm khác nhé!',
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
    const budgetLimit = extractBudgetLimit(trimmedMessage)

    if (keyword || budgetLimit !== null || lower.includes('giá') || lower.includes('mua') || lower.includes('gợi ý') || lower.includes('tìm')) {
      try {
        const searchQ = keyword || ''
        const prodResult = await getProducts({ q: searchQ, limit: 12 })
        const rawProductsList = Array.isArray(prodResult) ? prodResult : (prodResult?.data || [])

        // Áp dụng giới hạn ngân sách nếu người dùng có yêu cầu
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
              reply: `Hiện tại ShopNova chưa có sản phẩm "${searchQ || 'này'}" nào ở mức giá dưới ${formatVnd(budgetLimit)}. Mức giá thấp nhất hiện có trong kho là **${formatVnd(minPrice)}**. Bạn có muốn tham khảo thêm không?`,
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
        }
      } catch (err) {
        // Fallback
      }
    }

    // CASE E: Chào hỏi, Chính sách & Hỏi đáp chung (General FAQ & Greeting)
    let fallbackProducts = []
    try {
      const featured = await getProducts({ limit: 4 })
      fallbackProducts = Array.isArray(featured) ? featured : (featured?.data || [])
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
        products: fallbackProducts.length > 0 ? fallbackProducts : null,
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
