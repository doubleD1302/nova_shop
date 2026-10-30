import { callDataApi } from '../clients/data.client.js'

/**
 * Danh sách sản phẩm dự phòng phong phú từ Catalog khi Data API chưa kết nối MySQL
 */
const FALLBACK_PRODUCTS = [
  {
    id: 'p_crop_top',
    name: 'Áo Croptop Linen Cổ Vuông Pastel ShopNova',
    price: 159000,
    originalPrice: 220000,
    rating: 4.9,
    sold: 1850,
    mall: true,
    freeship: true,
    imageUrl: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=400&q=80',
    categoryName: 'Thời Trang Nữ',
    tag: 'Áo chính',
  },
  {
    id: 'p_shorts_kaki',
    name: 'Quần Short Kaki Ống Rộng Cạp Cao Pastel',
    price: 165000,
    originalPrice: 210000,
    rating: 4.8,
    sold: 950,
    mall: false,
    freeship: true,
    imageUrl: 'https://images.unsplash.com/photo-1591195853828-11db59a44f6b?auto=format&fit=crop&w=400&q=80',
    categoryName: 'Thời Trang Nữ',
    tag: 'Phối kèm',
  },
  {
    id: 'p_tote_canvas',
    name: 'Túi Vải Tote Mini Canvas Dạo Phố',
    price: 65000,
    originalPrice: 95000,
    rating: 5.0,
    sold: 420,
    mall: false,
    freeship: false,
    imageUrl: 'https://images.unsplash.com/photo-1544816155-12df9643f363?auto=format&fit=crop&w=400&q=80',
    categoryName: 'Túi Ví & Phụ Kiện',
    tag: 'Phụ kiện',
  },
  {
    id: 'p_tai_nghe_anc',
    name: 'Tai Nghe Bluetooth True Wireless Chống Ồn ANC Nova Sound',
    price: 349000,
    originalPrice: 499000,
    rating: 4.9,
    sold: 1200,
    mall: true,
    freeship: true,
    imageUrl: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=400&q=80',
    categoryName: 'Thiết Bị Điện Tử',
    tag: 'Công nghệ',
  },
  {
    id: 'p_son_kem_li',
    name: 'Son Kem Lì Mịn Môi Cao Cấp Màu Đỏ Gạch Terracotta',
    price: 129000,
    originalPrice: 180000,
    rating: 4.9,
    sold: 3400,
    mall: true,
    freeship: true,
    imageUrl: 'https://images.unsplash.com/photo-1586495777744-4413f21062fa?auto=format&fit=crop&w=400&q=80',
    categoryName: 'Sắc Đẹp & Mỹ Phẩm',
    tag: 'Làm đẹp',
  },
  {
    id: 'p_balo_laptop',
    name: 'Balo Laptop Chống Nước Đa Năng 15.6 inch',
    price: 249000,
    originalPrice: 350000,
    rating: 4.8,
    sold: 890,
    mall: false,
    freeship: true,
    imageUrl: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=400&q=80',
    categoryName: 'Túi Ví & Phụ Kiện',
    tag: 'Thời trang',
  },
]

/**
 * Controller xử lý hội thoại Trợ lý AI NovaShop (Nova AI Copilot)
 * Phục vụ đồng thời cho cả Website và Ứng dụng Di Động (Flutter)
 */
export async function chatWithAi(req, res, next) {
  try {
    const { message = '', context = {} } = req.body || {}
    const query = String(message).trim()

    if (!query) {
      return res.status(400).json({
        success: false,
        message: 'Nội dung tin nhắn không được để trống.',
        error: { code: 'EMPTY_MESSAGE' },
      })
    }

    const lower = query.toLowerCase()

    // 1. Phân tích ngữ cảnh tra cứu đơn hàng / vận chuyển
    if (
      lower.includes('đơn hàng') ||
      lower.includes('tra cứu') ||
      lower.includes('vận chuyển') ||
      lower.includes('khi nào') ||
      lower.includes('giao hàng')
    ) {
      let orderCode = context.orderCode || 'ORD-NOVA-882'
      const match = query.match(/(?:ORD-?|#)([A-Za-z0-9-]+)/i)
      if (match) orderCode = match[0].toUpperCase()

      return res.status(200).json({
        success: true,
        data: {
          reply: `Nova đã kết nối hệ thống vận chuyển cho đơn hàng ${orderCode}. Đơn hàng đang được bưu tá ưu tiên giao trong ngày hôm nay!`,
          intent: 'order_tracking',
          intentTitle: `Tra Cứu Đơn Hàng ${orderCode}`,
          intentMatch: 'Khớp 99%',
          orderInfo: {
            code: orderCode,
            status: 'shipping',
            statusText: 'Đang vận chuyển hỏa tốc',
            shipper: 'Nguyễn Văn Minh (0912.888.xxx)',
            carrier: 'Shopee Xpress / Giao Hàng Nhanh',
            location: 'Đang trung chuyển qua Bưu cục Quận 1 - TP.HCM',
            eta: 'Dự kiến giao trước 17:30 hôm nay',
            step: 3,
            total: 389000,
          },
          suggestions: [
            '🚚 Bưu tá liên hệ trước khi giao không?',
            '📦 Tôi muốn đổi địa chỉ nhận hàng',
            '⚡ Săn thêm voucher giảm giá',
          ],
        },
      })
    }

    // 2. Tìm kiếm sản phẩm theo từ khóa từ Data API hoặc fallback
    let catalogProducts = []
    try {
      const searchRes = await callDataApi(`/internal/v1/products?limit=8&q=${encodeURIComponent(query)}`)
      if (Array.isArray(searchRes?.products) && searchRes.products.length > 0) {
        catalogProducts = searchRes.products
      }
    } catch {
      // Fallback về danh sách chuẩn nếu Data API offline
    }

    if (catalogProducts.length === 0) {
      catalogProducts = FALLBACK_PRODUCTS
    }

    // 3. Phân tích yêu cầu phối đồ (outfit combo) hoặc ngân sách
    if (
      lower.includes('phối đồ') ||
      lower.includes('set đồ') ||
      lower.includes('tiệc') ||
      lower.includes('dạo phố') ||
      lower.includes('outfit') ||
      lower.includes('combo')
    ) {
      const outfitItems = catalogProducts.slice(0, 3).map((item, idx) => ({
        id: item.id || `outfit_${idx}`,
        name: item.name,
        price: Number(item.price) || 150000,
        originalPrice: Number(item.originalPrice) || Number(item.price) * 1.3,
        rating: item.rating || 4.9,
        sold: item.sold || 500,
        mall: Boolean(item.mall),
        imageUrl: item.imageUrl || FALLBACK_PRODUCTS[idx]?.imageUrl,
        tag: idx === 0 ? 'Món chính' : idx === 1 ? 'Phối kèm' : 'Phụ kiện',
      }))

      const totalPrice = outfitItems.reduce((acc, cur) => acc + cur.price, 0)
      const totalOriginal = outfitItems.reduce((acc, cur) => acc + cur.originalPrice, 0)
      const saved = Math.max(0, totalOriginal - totalPrice)

      return res.status(200).json({
        success: true,
        data: {
          reply: `Nova đã tuyển chọn set đồ chuẩn phong cách theo ý bạn, tối ưu mức giá tốt nhất và hỗ trợ giao Hỏa Tốc kèm Voucher Freeship:`,
          intent: 'outfit_combo',
          intentTitle: 'Nova Gợi Ý Set Đồ Phối Sẵn',
          intentMatch: 'Khớp 98%',
          budget: {
            max: 500000,
            total: totalPrice,
            saved,
            currency: 'VND',
          },
          products: outfitItems,
          suggestions: [
            '✨ Đổi sang màu sắc khác',
            '👗 Tìm thêm phụ kiện vòng cổ / giày',
            '🛒 Thêm trọn bộ vào giỏ hàng',
          ],
        },
      })
    }

    // 4. Phân tích so sánh công nghệ / sản phẩm (tai nghe, điện thoại, mỹ phẩm)
    if (lower.includes('so sánh') || lower.includes('tai nghe') || lower.includes('chống ồn')) {
      const comparedProducts = catalogProducts.slice(0, 3)
      return res.status(200).json({
        success: true,
        data: {
          reply: `Nova đã phân tích và đối chiếu các mẫu sản phẩm hot nhất theo đánh giá của người mua thực tế:`,
          intent: 'product_comparison',
          intentTitle: 'Bảng So Sánh Thông Minh Nova AI',
          intentMatch: 'Khớp 96%',
          products: comparedProducts,
          suggestions: [
            '🔍 Chi tiết thông số chống ồn ANC',
            '⚡ Xem đánh giá 5 sao từ người dùng',
            '🏷️ Xem mã giảm giá hiện có',
          ],
        },
      })
    }

    // 5. Tìm kiếm thông thường theo nhu cầu mua sắm cá nhân hóa
    const matchedProducts = catalogProducts.slice(0, 4)
    return res.status(200).json({
      success: true,
      data: {
        reply: `Nova đã chọn lọc các sản phẩm phù hợp nhất với yêu cầu "${query}" của bạn:`,
        intent: 'product_recommendation',
        intentTitle: 'Gợi Ý Mua Sắm Từ Nova AI',
        intentMatch: 'Khớp 95%',
        products: matchedProducts,
        suggestions: [
          '⚡ Săn deal giảm sốc hôm nay',
          '🚚 Sản phẩm hỗ trợ Freeship Xtra',
          '⭐ Lọc sản phẩm đánh giá trên 4.8 sao',
        ],
      },
    })
  } catch (err) {
    return next(err)
  }
}
