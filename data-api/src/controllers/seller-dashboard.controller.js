import { executeQuery } from '../config/database.js'

const validId = (value) => typeof value === 'string' && /^[1-9]\d{0,19}$/.test(value)
const invalid = (res, msg = 'Dữ liệu không hợp lệ.') =>
  res.status(400).json({ success: false, message: msg, error: { code: 'VALIDATION_ERROR' } })

/**
 * Lấy dữ liệu tổng quan bảng điều khiển Kênh Người Bán (Seller Dashboard)
 * Bao gồm KPI doanh thu, trạng thái đơn, biểu đồ 7 ngày, cảnh báo kho và top sản phẩm
 */
export async function getSellerDashboard(req, res, next) {
  try {
    const { shopId } = req.query
    if (!validId(shopId)) return invalid(res, 'Mã gian hàng không hợp lệ.')

    // 1. Kiểm tra gian hàng có tồn tại không
    const shops = await executeQuery('SELECT id, name FROM shops WHERE id = ? LIMIT 1', [shopId])
    if (!shops.length) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy thông tin gian hàng.',
        error: { code: 'SHOP_NOT_FOUND' },
      })
    }

    // 2. Thống kê số lượng đơn và doanh thu theo trạng thái
    const statusRows = await executeQuery(
      `SELECT status, COUNT(*) AS count, COALESCE(SUM(total_amount), 0) AS revenue
       FROM shop_orders
       WHERE shop_id = ?
       GROUP BY status`,
      [shopId],
    )

    const statusMap = {
      pending: 0,
      confirmed: 0,
      shipping: 0,
      delivered: 0,
      completed: 0,
      cancelled: 0,
      returned: 0,
    }
    let totalRevenue = 0

    for (const row of statusRows) {
      const st = row.status
      const count = Number(row.count)
      const rev = Number(row.revenue)
      if (statusMap[st] !== undefined) {
        statusMap[st] = count
      }
      if (st === 'delivered' || st === 'completed') {
        totalRevenue += rev
      }
    }

    // 3. Đơn hàng và doanh thu trong ngày hôm nay
    const todayRows = await executeQuery(
      `SELECT COUNT(*) AS today_orders,
              COALESCE(SUM(CASE WHEN status IN ('delivered', 'completed') THEN total_amount ELSE 0 END), 0) AS today_revenue
       FROM shop_orders
       WHERE shop_id = ? AND created_at >= CURDATE()`,
      [shopId],
    )
    const todayOrders = Number(todayRows[0]?.today_orders || 0)
    const todayRevenue = Number(todayRows[0]?.today_revenue || 0)

    // 4. Tổng số lượng sản phẩm và số lượng sản phẩm đã bán
    const productRows = await executeQuery(
      `SELECT COUNT(*) AS total_products
       FROM products
       WHERE shop_id = ? AND status != 'archived'`,
      [shopId],
    )
    const totalProducts = Number(productRows[0]?.total_products || 0)

    const soldRows = await executeQuery(
      `SELECT COALESCE(SUM(oi.qty), 0) AS total_sold
       FROM order_items oi
       JOIN shop_orders so ON so.id = oi.shop_order_id
       WHERE so.shop_id = ? AND so.status IN ('delivered', 'completed')`,
      [shopId],
    )
    const totalSold = Number(soldRows[0]?.total_sold || 0)

    // 5. Cảnh báo tồn kho: sắp hết hàng (<= 10) và hết hàng (= 0)
    const stockRows = await executeQuery(
      `SELECT COUNT(CASE WHEN pv.stock_qty <= 10 AND pv.stock_qty > 0 THEN 1 END) AS low_stock_count,
              COUNT(CASE WHEN pv.stock_qty = 0 THEN 1 END) AS out_of_stock_count
       FROM product_variants pv
       JOIN products p ON p.id = pv.product_id
       WHERE p.shop_id = ? AND p.status != 'archived'`,
      [shopId],
    )
    const lowStockCount = Number(stockRows[0]?.low_stock_count || 0)
    const outOfStockCount = Number(stockRows[0]?.out_of_stock_count || 0)

    // 6. Dữ liệu biểu đồ 7 ngày gần nhất (doanh thu và số đơn)
    const chartRows = await executeQuery(
      `SELECT DATE_FORMAT(created_at, '%Y-%m-%d') AS order_date,
              COUNT(*) AS orders,
              COALESCE(SUM(CASE WHEN status IN ('delivered', 'completed') THEN total_amount ELSE 0 END), 0) AS revenue
       FROM shop_orders
       WHERE shop_id = ? AND created_at >= DATE_SUB(CURDATE(), INTERVAL 6 DAY)
       GROUP BY DATE_FORMAT(created_at, '%Y-%m-%d')`,
      [shopId],
    )

    const chartMap = new Map()
    for (const r of chartRows) {
      chartMap.set(r.order_date, {
        orders: Number(r.orders),
        revenue: Number(r.revenue),
      })
    }

    const chart = []
    const now = new Date()
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now)
      d.setDate(d.getDate() - i)
      const dateStr = d.toISOString().slice(0, 10)
      const dayStr = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`
      const entry = chartMap.get(dateStr) || { orders: 0, revenue: 0 }
      chart.push({
        date: dateStr,
        label: dayStr,
        orders: entry.orders,
        revenue: entry.revenue,
      })
    }

    // 7. Top 5 sản phẩm bán chạy nhất
    const topProductsRows = await executeQuery(
      `SELECT p.id, p.name, pi.url AS image_url, MIN(pv.price) AS price,
              COALESCE(SUM(oi.qty), 0) AS sold_count,
              COALESCE(SUM(pv.stock_qty), 0) AS total_stock
       FROM products p
       JOIN product_variants pv ON pv.product_id = p.id
       LEFT JOIN order_items oi ON oi.product_id = p.id
       LEFT JOIN shop_orders so ON so.id = oi.shop_order_id AND so.status IN ('delivered', 'completed')
       LEFT JOIN product_images pi ON pi.product_id = p.id AND pi.sort_order = 0
       WHERE p.shop_id = ? AND p.status != 'archived'
       GROUP BY p.id, p.name, pi.url
       ORDER BY sold_count DESC
       LIMIT 5`,
      [shopId],
    )

    const topProducts = topProductsRows.map((r) => ({
      id: String(r.id),
      name: r.name,
      imageUrl: r.image_url,
      price: Number(r.price),
      soldCount: Number(r.sold_count),
      totalStock: Number(r.total_stock),
    }))

    // 8. Danh sách sản phẩm sắp hết hàng (tồn kho <= 10)
    const lowStockProductRows = await executeQuery(
      `SELECT p.id, p.name, pv.name AS variant_name, pv.sku, pv.stock_qty AS stock, pv.price, pi.url AS image_url
       FROM product_variants pv
       JOIN products p ON p.id = pv.product_id
       LEFT JOIN product_images pi ON pi.product_id = p.id AND pi.sort_order = 0
       WHERE p.shop_id = ? AND p.status != 'archived' AND pv.stock_qty <= 10
       ORDER BY pv.stock_qty ASC
       LIMIT 5`,
      [shopId],
    )

    const lowStockProducts = lowStockProductRows.map((r) => ({
      id: String(r.id),
      name: r.name,
      variantName: r.variant_name,
      sku: r.sku,
      stock: Number(r.stock),
      price: Number(r.price),
      imageUrl: r.image_url,
    }))

    // 9. 5 đơn hàng gần đây nhất
    const recentOrderRows = await executeQuery(
      `SELECT so.id AS shop_order_id, so.order_id, o.code AS order_code,
              u.full_name AS customer_name, u.phone AS customer_phone,
              so.total_amount, so.status, so.created_at
       FROM shop_orders so
       JOIN orders o ON o.id = so.order_id
       JOIN users u ON u.id = o.buyer_id
       WHERE so.shop_id = ?
       ORDER BY so.id DESC
       LIMIT 5`,
      [shopId],
    )

    const recentOrders = recentOrderRows.map((r) => ({
      id: String(r.shop_order_id),
      orderId: String(r.order_id),
      orderCode: r.order_code,
      customerName: r.customer_name,
      customerPhone: r.customer_phone,
      totalAmount: Number(r.total_amount),
      status: r.status,
      createdAt: r.created_at,
    }))

    return res.status(200).json({
      success: true,
      data: {
        shop: {
          id: String(shops[0].id),
          name: shops[0].name,
        },
        summary: {
          todayOrders,
          todayRevenue,
          totalRevenue,
          totalProducts,
          totalSold,
          lowStockCount,
          outOfStockCount,
          ordersByStatus: {
            pending: statusMap.pending,
            confirmed: statusMap.confirmed,
            shipping: statusMap.shipping,
            delivered: statusMap.delivered,
            completed: statusMap.completed,
            cancelled: statusMap.cancelled,
            returned: statusMap.returned,
            processing: statusMap.confirmed + statusMap.shipping,
          },
        },
        chart,
        topProducts,
        lowStockProducts,
        recentOrders,
      },
    })
  } catch (err) {
    console.error('[SellerDashboard Error]:', err.message, err.sql)
    return next(err)
  }
}
