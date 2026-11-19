import { executeQuery, executeTransaction } from '../config/database.js'
import { readDateRange } from '../utils/date-range.js'

const validId = (value) => typeof value === 'string' && /^[1-9]\d{0,19}$/.test(value)
const invalid = (res, msg = 'Dữ liệu không hợp lệ.') =>
  res.status(400).json({ success: false, message: msg, error: { code: 'VALIDATION_ERROR' } })

const BOOST_PACKAGES = {
  basic_1d: { days: 1, cost: 50000, name: 'Gói Đẩy Cơ Bản 24h' },
  standard_3d: { days: 3, cost: 120000, name: 'Gói Đẩy Tiêu Chuẩn 3 Ngày' },
  premium_7d: { days: 7, cost: 250000, name: 'Gói Đẩy Nổi Bật 7 Ngày' },
}

/**
 * Danh sách chiến dịch marketing đang mở cho gian hàng đăng ký
 */
export async function listCampaigns(req, res, next) {
  try {
    const rows = await executeQuery(
      `SELECT id, name, type, description, starts_at, ends_at, banner_url, is_active, created_at
       FROM marketing_campaigns
       WHERE is_active = 1 AND ends_at > UTC_TIMESTAMP(3)
       ORDER BY starts_at ASC`
    )

    const items = rows.map((r) => ({
      id: String(r.id),
      name: r.name,
      type: r.type,
      description: r.description,
      startsAt: new Date(r.starts_at).toISOString(),
      endsAt: new Date(r.ends_at).toISOString(),
      bannerUrl: r.banner_url,
      isActive: Boolean(r.is_active),
    }))

    return res.status(200).json({ success: true, data: { items } })
  } catch (err) {
    return next(err)
  }
}

/**
 * Seller đăng ký sản phẩm tham gia chiến dịch marketing / flash sale
 */
export async function registerCampaign(req, res, next) {
  try {
    const { campaignId, shopId, productId, discountPrice, note = '' } = req.body || {}

    if (!validId(campaignId) || !validId(shopId) || !validId(productId)) {
      return invalid(res)
    }

    if (typeof discountPrice !== 'number' || isNaN(discountPrice) || discountPrice <= 0 || !Number.isSafeInteger(discountPrice)) {
      return invalid(res, 'Giá khuyến mãi cam kết phải là số nguyên dương.')
    }

    // 1. Kiểm tra chiến dịch
    const campaigns = await executeQuery(
      'SELECT id, name, starts_at, ends_at, is_active FROM marketing_campaigns WHERE id = ?',
      [campaignId]
    )
    if (!campaigns.length || !campaigns[0].is_active) {
      return res.status(404).json({
        success: false,
        message: 'Chiến dịch không tồn tại hoặc đã kết thúc.',
        error: { code: 'CAMPAIGN_NOT_FOUND' },
      })
    }

    // 2. Kiểm tra quyền sở hữu sản phẩm
    const products = await executeQuery(
      'SELECT id, shop_id, name, status, approval_status FROM products WHERE id = ?',
      [productId]
    )
    if (!products.length) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy sản phẩm.',
        error: { code: 'PRODUCT_NOT_FOUND' },
      })
    }

    const prod = products[0]
    if (String(prod.shop_id) !== String(shopId)) {
      return res.status(403).json({
        success: false,
        message: 'Bạn không có quyền đăng ký sản phẩm của shop khác.',
        error: { code: 'FORBIDDEN' },
      })
    }

    if (prod.status !== 'active' || prod.approval_status !== 'approved') {
      return res.status(400).json({
        success: false,
        message: 'Chỉ sản phẩm đã được kiểm duyệt và đang hoạt động mới được tham gia chiến dịch.',
        error: { code: 'PRODUCT_NOT_ELIGIBLE' },
      })
    }

    // 3. Kiểm tra đã đăng ký chưa
    const existing = await executeQuery(
      'SELECT id, status FROM campaign_registrations WHERE campaign_id = ? AND product_id = ?',
      [campaignId, productId]
    )
    if (existing.length) {
      return res.status(409).json({
        success: false,
        message: 'Sản phẩm này đã được đăng ký tham gia chiến dịch.',
        error: { code: 'ALREADY_REGISTERED' },
      })
    }

    const insertResult = await executeQuery(
      `INSERT INTO campaign_registrations
       (campaign_id, shop_id, product_id, discount_price, status, note)
       VALUES (?, ?, ?, ?, 'pending', ?)`,
      [campaignId, shopId, productId, discountPrice, note ? String(note).slice(0, 255) : null]
    )

    return res.status(201).json({
      success: true,
      message: 'Đăng ký sản phẩm tham gia chiến dịch thành công. Hồ sơ đang được ban quản trị xét duyệt.',
      data: {
        registrationId: String(insertResult.insertId),
        campaignId: String(campaignId),
        shopId: String(shopId),
        productId: String(productId),
        discountPrice,
        status: 'pending',
      },
    })
  } catch (err) {
    return next(err)
  }
}

/**
 * Danh sách sản phẩm của shop đã đăng ký tham gia chiến dịch
 */
export async function listSellerCampaignRegistrations(req, res, next) {
  try {
    const { shopId } = req.query
    if (!validId(shopId)) return invalid(res)

    const rows = await executeQuery(
      `SELECT r.id, r.campaign_id, r.shop_id, r.product_id, r.discount_price, r.status, r.note, r.created_at,
              c.name AS campaign_name, c.type AS campaign_type, c.starts_at, c.ends_at,
              p.name AS product_name
       FROM campaign_registrations r
       JOIN marketing_campaigns c ON c.id = r.campaign_id
       JOIN products p ON p.id = r.product_id
       WHERE r.shop_id = ?
       ORDER BY r.id DESC`,
      [shopId]
    )

    const items = rows.map((r) => ({
      id: String(r.id),
      campaignId: String(r.campaign_id),
      campaignName: r.campaign_name,
      campaignType: r.campaign_type,
      campaignStartsAt: new Date(r.starts_at).toISOString(),
      campaignEndsAt: new Date(r.ends_at).toISOString(),
      productId: String(r.product_id),
      productName: r.product_name,
      discountPrice: Number(r.discount_price),
      status: r.status,
      note: r.note,
      createdAt: new Date(r.created_at).toISOString(),
    }))

    return res.status(200).json({ success: true, data: { items } })
  } catch (err) {
    return next(err)
  }
}

/**
 * Seller mua gói đẩy sản phẩm (Quảng cáo / Boost)
 */
export async function buyProductBoost(req, res, next) {
  try {
    const { shopId, productId, packageType } = req.body || {}

    if (!validId(shopId) || !validId(productId)) return invalid(res)

    const pkg = BOOST_PACKAGES[packageType]
    if (!pkg) {
      return res.status(400).json({
        success: false,
        message: 'Gói đẩy sản phẩm không hợp lệ. Vui lòng chọn basic_1d, standard_3d hoặc premium_7d.',
        error: { code: 'INVALID_PACKAGE' },
      })
    }

    const now = new Date()
    const endsAt = new Date(now.getTime() + pkg.days * 24 * 3600 * 1000)

    // Khóa dòng sản phẩm để hai lần bấm mua cùng lúc không tạo hai gói đang chạy
    const result = await executeTransaction(async (query) => {
      const products = await query(
        'SELECT id, shop_id, name, status, approval_status FROM products WHERE id = ? FOR UPDATE',
        [productId]
      )
      if (!products.length) return { error: 'PRODUCT_NOT_FOUND' }
      if (String(products[0].shop_id) !== String(shopId)) return { error: 'FORBIDDEN' }

      // Giống đăng ký chiến dịch: chỉ sản phẩm đang bán và đã duyệt mới được quảng bá
      if (products[0].status !== 'active' || products[0].approval_status !== 'approved') {
        return { error: 'PRODUCT_NOT_ELIGIBLE' }
      }

      const running = await query(
        `SELECT id FROM product_boosts
         WHERE product_id = ? AND status = 'active' AND ends_at > UTC_TIMESTAMP(3) LIMIT 1`,
        [productId]
      )
      if (running.length) return { error: 'BOOST_ALREADY_ACTIVE' }

      const insertResult = await query(
        `INSERT INTO product_boosts
         (shop_id, product_id, package_type, starts_at, ends_at, status, cost_vnd)
         VALUES (?, ?, ?, ?, ?, 'active', ?)`,
        [shopId, productId, packageType, now, endsAt, pkg.cost]
      )
      return { boostId: insertResult.insertId, productName: products[0].name }
    })

    if (result.error === 'PRODUCT_NOT_FOUND') {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy sản phẩm.',
        error: { code: 'PRODUCT_NOT_FOUND' },
      })
    }
    if (result.error === 'FORBIDDEN') {
      return res.status(403).json({
        success: false,
        message: 'Bạn không thể mua gói đẩy cho sản phẩm của shop khác.',
        error: { code: 'FORBIDDEN' },
      })
    }
    if (result.error === 'PRODUCT_NOT_ELIGIBLE') {
      return res.status(400).json({
        success: false,
        message: 'Chỉ sản phẩm đã được kiểm duyệt và đang bán mới được mua gói đẩy.',
        error: { code: 'PRODUCT_NOT_ELIGIBLE' },
      })
    }
    if (result.error === 'BOOST_ALREADY_ACTIVE') {
      return res.status(409).json({
        success: false,
        message: 'Sản phẩm này đang có gói đẩy còn hiệu lực. Vui lòng chờ hết hạn rồi mua gói mới.',
        error: { code: 'BOOST_ALREADY_ACTIVE' },
      })
    }

    return res.status(201).json({
      success: true,
      message: `Kích hoạt ${pkg.name} thành công. Sản phẩm sẽ được ưu tiên hiển thị đến ${endsAt.toLocaleString('vi-VN')}.`,
      data: {
        boostId: String(result.boostId),
        shopId: String(shopId),
        productId: String(productId),
        productName: result.productName,
        packageType,
        packageName: pkg.name,
        costVnd: pkg.cost,
        startsAt: now.toISOString(),
        endsAt: endsAt.toISOString(),
        status: 'active',
      },
    })
  } catch (err) {
    return next(err)
  }
}

/**
 * Danh sách các gói đẩy sản phẩm của shop
 */
export async function listSellerProductBoosts(req, res, next) {
  try {
    const { shopId } = req.query
    if (!validId(shopId)) return invalid(res)

    const rows = await executeQuery(
      `SELECT b.id, b.shop_id, b.product_id, b.package_type, b.starts_at, b.ends_at, b.status, b.cost_vnd, b.created_at,
              p.name AS product_name, (b.ends_at <= UTC_TIMESTAMP(3)) AS is_expired
       FROM product_boosts b
       JOIN products p ON p.id = b.product_id
       WHERE b.shop_id = ?
       ORDER BY b.id DESC`,
      [shopId]
    )

    const items = rows.map((r) => ({
      id: String(r.id),
      productId: String(r.product_id),
      productName: r.product_name,
      packageType: r.package_type,
      packageName: BOOST_PACKAGES[r.package_type]?.name || r.package_type,
      costVnd: Number(r.cost_vnd),
      startsAt: new Date(r.starts_at).toISOString(),
      endsAt: new Date(r.ends_at).toISOString(),
      status: r.is_expired ? 'expired' : r.status,
      createdAt: new Date(r.created_at).toISOString(),
    }))

    return res.status(200).json({ success: true, data: { items } })
  } catch (err) {
    return next(err)
  }
}

// Số gói đẩy tối đa trả về trong một báo cáo hiệu quả
const MAX_ANALYTICS_BOOSTS = 200

/**
 * Báo cáo hiệu quả quảng cáo của shop: chi phí gói đẩy, đơn/doanh thu của sản phẩm
 * trong thời gian gói chạy và số hồ sơ chiến dịch theo trạng thái.
 * Hệ thống chưa ghi nhận lượt xem hay lượt nhấp nên báo cáo không có hai số này;
 * doanh thu là doanh thu của sản phẩm trong thời gian chạy gói, không chứng minh do quảng cáo mang lại.
 */
export async function getSellerMarketingAnalytics(req, res, next) {
  try {
    const { shopId } = req.query
    const range = readDateRange(req.query)
    if (!validId(shopId) || !range) return invalid(res, 'Tham số báo cáo không hợp lệ.')

    let boostRange = ''
    let regRange = ''
    const boostParams = [shopId]
    const regParams = [shopId]
    if (range.from) {
      boostRange += ' AND b.created_at >= ?'
      regRange += ' AND r.created_at >= ?'
      boostParams.push(range.from)
      regParams.push(range.from)
    }
    if (range.to) {
      boostRange += ' AND b.created_at <= ?'
      regRange += ' AND r.created_at <= ?'
      boostParams.push(range.to)
      regParams.push(range.to)
    }

    // Bốn truy vấn độc lập nên chạy song song để không vượt timeout 5s của Backend.
    // Đơn hủy không tính. Điều kiện thời gian nằm trong ON để gói không có đơn vẫn được liệt kê.
    const [boostRows, totalRows, spendRows, regRows] = await Promise.all([
    executeQuery(
      `SELECT b.id, b.product_id, p.name AS product_name, b.package_type, b.starts_at, b.ends_at,
              b.status, b.cost_vnd, b.created_at, (b.ends_at <= UTC_TIMESTAMP(3)) AS is_expired,
              COUNT(DISTINCT so.id) AS orders_count,
              COALESCE(SUM(CASE WHEN so.id IS NOT NULL THEN oi.qty ELSE 0 END), 0) AS units_sold,
              COALESCE(SUM(CASE WHEN so.id IS NOT NULL THEN oi.line_total ELSE 0 END), 0) AS revenue
       FROM product_boosts b
       JOIN products p ON p.id = b.product_id
       LEFT JOIN order_items oi ON oi.product_id = b.product_id AND oi.shop_id = b.shop_id
       LEFT JOIN shop_orders so ON so.id = oi.shop_order_id
            AND so.status <> 'cancelled'
            AND so.created_at >= b.starts_at
            AND so.created_at <= LEAST(b.ends_at, UTC_TIMESTAMP(3))
       WHERE b.shop_id = ? ${boostRange}
       GROUP BY b.id, b.product_id, p.name, b.package_type, b.starts_at, b.ends_at, b.status, b.cost_vnd, b.created_at
       ORDER BY b.id DESC
       LIMIT ?`,
      [...boostParams, MAX_ANALYTICS_BOOSTS]
    ),

    // Tổng riêng cho summary: mỗi dòng hàng chỉ đếm một lần dù nằm trong nhiều gói chạy cùng lúc
    // và không bị cắt theo giới hạn 200 gói của danh sách.
    executeQuery(
      `SELECT COUNT(DISTINCT so.id) AS distinct_orders,
              COALESCE(SUM(oi.qty), 0) AS distinct_units,
              COALESCE(SUM(oi.line_total), 0) AS distinct_revenue
       FROM order_items oi
       JOIN shop_orders so ON so.id = oi.shop_order_id AND so.status <> 'cancelled'
       WHERE oi.shop_id = ?
         AND EXISTS (
           SELECT 1 FROM product_boosts b
           WHERE b.shop_id = oi.shop_id AND b.product_id = oi.product_id
             AND so.created_at >= b.starts_at
             AND so.created_at <= LEAST(b.ends_at, UTC_TIMESTAMP(3)) ${boostRange}
         )`,
      boostParams
    ),

    // Số gói và chi phí tính trên toàn bộ gói, không phụ thuộc giới hạn của danh sách
    executeQuery(
      `SELECT COUNT(*) AS total_boosts, COALESCE(SUM(b.cost_vnd), 0) AS total_spend,
              COALESCE(SUM(b.status = 'active' AND b.ends_at > UTC_TIMESTAMP(3)), 0) AS active_boosts
       FROM product_boosts b
       WHERE b.shop_id = ? ${boostRange}`,
      boostParams
    ),

    executeQuery(
      `SELECT r.status, COUNT(*) AS total
       FROM campaign_registrations r
       WHERE r.shop_id = ? ${regRange}
       GROUP BY r.status`,
      regParams
    ),
    ])

    const boosts = boostRows.map((r) => {
      const costVnd = Number(r.cost_vnd)
      const revenue = Number(r.revenue)
      const expired = Number(r.is_expired) === 1
      return {
        id: String(r.id),
        productId: String(r.product_id),
        productName: r.product_name,
        packageType: r.package_type,
        packageName: BOOST_PACKAGES[r.package_type]?.name || r.package_type,
        status: expired ? 'expired' : r.status,
        startsAt: new Date(r.starts_at).toISOString(),
        endsAt: new Date(r.ends_at).toISOString(),
        costVnd,
        ordersDuringBoost: Number(r.orders_count),
        unitsDuringBoost: Number(r.units_sold),
        revenueDuringBoost: revenue,
        revenueToSpendRatio: costVnd > 0 ? Number((revenue / costVnd).toFixed(2)) : null,
      }
    })

    const spend = spendRows[0] || {}
    const totalSpend = Number(spend.total_spend || 0)
    const totals = totalRows[0] || {}
    const totalRevenue = Number(totals.distinct_revenue || 0)

    const registrations = { pending: 0, approved: 0, rejected: 0, total: 0 }
    for (const row of regRows) {
      if (row.status in registrations) registrations[row.status] = Number(row.total)
      registrations.total += Number(row.total)
    }

    return res.status(200).json({
      success: true,
      data: {
        range: {
          startDate: range.from ? range.from.toISOString() : null,
          endDate: range.to ? range.to.toISOString() : null,
        },
        summary: {
          totalBoosts: Number(spend.total_boosts || 0),
          activeBoosts: Number(spend.active_boosts || 0),
          totalSpend,
          ordersDuringBoost: Number(totals.distinct_orders || 0),
          unitsDuringBoost: Number(totals.distinct_units || 0),
          revenueDuringBoost: totalRevenue,
          revenueToSpendRatio: totalSpend > 0 ? Number((totalRevenue / totalSpend).toFixed(2)) : null,
        },
        registrations,
        boosts,
        truncated: boostRows.length === MAX_ANALYTICS_BOOSTS,
      },
    })
  } catch (err) {
    return next(err)
  }
}
