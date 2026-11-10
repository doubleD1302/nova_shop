import { executeQuery } from '../config/database.js'

const validId = (value) => typeof value === 'string' && /^[1-9]\d{0,19}$/.test(value)
const invalid = (res, msg = 'Dữ liệu không hợp lệ.') =>
  res.status(400).json({ success: false, message: msg, error: { code: 'VALIDATION_ERROR' } })

/**
 * Lấy báo cáo doanh thu chi tiết của gian hàng
 */
export async function getSellerRevenueReport(req, res, next) {
  try {
    const { shopId, startDate, endDate } = req.query
    if (!validId(shopId)) return invalid(res)

    let dateCondition = ''
    const params = [shopId]

    if (startDate && !isNaN(new Date(startDate).getTime())) {
      dateCondition += ' AND so.created_at >= ?'
      params.push(new Date(startDate))
    }
    if (endDate && !isNaN(new Date(endDate).getTime())) {
      dateCondition += ' AND so.created_at <= ?'
      params.push(new Date(endDate))
    }

    // Đọc cấu hình tỷ lệ hoa hồng từ system_settings
    const settings = await executeQuery(
      "SELECT setting_value FROM system_settings WHERE setting_key = 'commission_rate'"
    )
    const commissionRate = settings.length ? Number(settings[0].setting_value) : 5.0

    // Truy vấn danh sách đơn hàng con của shop
    const orders = await executeQuery(
      `SELECT so.id AS shop_order_id, so.order_id, o.code AS order_code, so.status,
              so.subtotal, so.shipping_fee, so.discount_amount, so.total_amount,
              so.shipping_method, so.shipping_name, so.tracking_code, so.created_at,
              u.full_name AS customer_name, u.phone AS customer_phone
       FROM shop_orders so
       JOIN orders o ON o.id = so.order_id
       JOIN users u ON u.id = o.buyer_id
       WHERE so.shop_id = ? ${dateCondition}
       ORDER BY so.id DESC`,
      params
    )

    let totalSubtotal = 0
    let totalDiscount = 0
    let totalCommission = 0
    let totalPayout = 0

    const formattedOrders = orders.map((o) => {
      const subtotal = Number(o.subtotal)
      const discount = Number(o.discount_amount)
      const totalAmount = Number(o.total_amount)
      const isDelivered = o.status === 'delivered'

      // Hoa hồng sàn tính trên tiền hàng thực tế
      const commissionFee = Math.round((subtotal - discount) * (commissionRate / 100))
      const sellerPayout = Math.max(0, subtotal - discount - commissionFee)

      if (isDelivered) {
        totalSubtotal += subtotal
        totalDiscount += discount
        totalCommission += commissionFee
        totalPayout += sellerPayout
      }

      return {
        shopOrderId: String(o.shop_order_id),
        orderCode: o.order_code,
        status: o.status,
        customerName: o.customer_name,
        customerPhone: o.customer_phone,
        subtotal,
        shippingFee: Number(o.shipping_fee),
        discountAmount: discount,
        totalAmount,
        commissionFee,
        sellerPayout,
        shippingName: o.shipping_name,
        trackingCode: o.tracking_code || '',
        createdAt: new Date(o.created_at).toISOString(),
      }
    })

    return res.status(200).json({
      success: true,
      data: {
        summary: {
          totalOrders: orders.length,
          deliveredOrders: orders.filter((o) => o.status === 'delivered').length,
          totalSubtotal,
          totalDiscount,
          totalCommission,
          totalPayout,
          commissionRate,
        },
        orders: formattedOrders,
      },
    })
  } catch (err) {
    return next(err)
  }
}

/**
 * Lấy báo cáo tồn kho và đối soát kho chi tiết của gian hàng
 */
export async function getSellerInventoryReport(req, res, next) {
  try {
    const { shopId } = req.query
    if (!validId(shopId)) return invalid(res)

    // Lấy tất cả biến thể SKU của shop cùng số lượng tồn kho
    const variants = await executeQuery(
      `SELECT pv.id AS variant_id, pv.sku, pv.name AS variant_name, pv.price, pv.stock_qty,
              p.id AS product_id, p.name AS product_name, p.status AS product_status,
              p.approval_status,
              (SELECT COALESCE(SUM(ABS(sm.delta_qty)), 0) FROM stock_moves sm WHERE sm.variant_id = pv.id AND sm.delta_qty < 0) AS total_sold,
              (SELECT COALESCE(SUM(sm.delta_qty), 0) FROM stock_moves sm WHERE sm.variant_id = pv.id AND sm.delta_qty > 0) AS total_returned
       FROM product_variants pv
       JOIN products p ON p.id = pv.product_id
       WHERE p.shop_id = ?
       ORDER BY p.id DESC, pv.id ASC`,
      [shopId]
    )

    let totalStock = 0
    let totalSKUs = variants.length
    let lowStockCount = 0

    const items = variants.map((v) => {
      const stock = Number(v.stock_qty)
      totalStock += stock
      if (stock <= 5) lowStockCount++

      return {
        variantId: String(v.variant_id),
        productId: String(v.product_id),
        productName: v.product_name,
        sku: v.sku,
        variantName: v.variant_name,
        price: Number(v.price),
        stockQty: stock,
        totalSold: Number(v.total_sold),
        totalReturned: Number(v.total_returned),
        isLowStock: stock <= 5,
        status: v.product_status,
        approvalStatus: v.approval_status,
      }
    })

    return res.status(200).json({
      success: true,
      data: {
        summary: {
          totalProducts: new Set(variants.map((v) => v.product_id)).size,
          totalSKUs,
          totalStock,
          lowStockCount,
        },
        items,
      },
    })
  } catch (err) {
    return next(err)
  }
}
