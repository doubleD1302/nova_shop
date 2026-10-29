import { executeQuery, executeTransaction } from '../config/database.js'

const validId = (value) => /^[1-9]\d{0,19}$/.test(String(value || ''))

export async function getAdminStats(req, res, next) {
  try {
    const [shopCount, productCount, orderCount, userCount, revenueResult, recentOrders, statusCounts] = await Promise.all([
      executeQuery('SELECT COUNT(*) AS total FROM shops'),
      executeQuery("SELECT COUNT(*) AS total FROM products WHERE status <> 'archived'"),
      executeQuery('SELECT COUNT(*) AS total FROM orders'),
      executeQuery("SELECT COUNT(*) AS total FROM users WHERE role = 'buyer'"),
      executeQuery("SELECT COALESCE(SUM(total_amount), 0) AS total FROM shop_orders WHERE status = 'delivered'"),
      executeQuery(`
        SELECT o.id AS order_id, o.code, o.recipient_name, o.total_amount, o.created_at,
               so.id AS shop_order_id, so.shop_name, so.status
        FROM orders o
        JOIN shop_orders so ON so.order_id = o.id
        ORDER BY o.created_at DESC, o.id DESC
        LIMIT 8
      `),
      executeQuery(`
        SELECT status, COUNT(*) AS count
        FROM shop_orders
        GROUP BY status
      `),
    ])

    const statusMap = {
      pending: 0,
      confirmed: 0,
      shipping: 0,
      delivered: 0,
      cancelled: 0,
    }
    for (const row of statusCounts) {
      if (row.status in statusMap) statusMap[row.status] = Number(row.count)
    }

    return res.status(200).json({
      success: true,
      data: {
        stats: {
          totalShops: Number(shopCount[0]?.total || 0),
          totalProducts: Number(productCount[0]?.total || 0),
          totalOrders: Number(orderCount[0]?.total || 0),
          totalCustomers: Number(userCount[0]?.total || 0),
          totalRevenue: Number(revenueResult[0]?.total || 0),
        },
        orderStatusCounts: statusMap,
        recentOrders: recentOrders.map((row) => ({
          orderId: String(row.order_id),
          shopOrderId: String(row.shop_order_id),
          code: row.code,
          recipientName: row.recipient_name,
          shopName: row.shop_name,
          total: Number(row.total_amount),
          status: row.status,
          createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
        })),
      },
    })
  } catch (err) {
    return next(err)
  }
}

export async function listAdminOrders(req, res, next) {
  try {
    const rows = await executeQuery(`
      SELECT o.id AS order_id, o.code, o.recipient_name, o.recipient_phone, o.payment_method,
             o.total_amount, o.created_at,
             so.id AS shop_order_id, so.shop_id, so.shop_name, so.status, so.shipping_name
      FROM orders o
      JOIN shop_orders so ON so.order_id = o.id
      ORDER BY o.created_at DESC, o.id DESC
      LIMIT 200
    `)
    return res.status(200).json({
      success: true,
      data: {
        orders: rows.map((row) => ({
          orderId: String(row.order_id),
          shopOrderId: String(row.shop_order_id),
          shopId: String(row.shop_id),
          code: row.code,
          recipientName: row.recipient_name,
          recipientPhone: row.recipient_phone,
          shopName: row.shop_name,
          payment: row.payment_method,
          shippingName: row.shipping_name,
          total: Number(row.total_amount),
          status: row.status,
          createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
        })),
      },
    })
  } catch (err) {
    return next(err)
  }
}

export async function listAdminUsers(req, res, next) {
  try {
    const rows = await executeQuery(
      `SELECT id, username, full_name, email, phone, role, status, created_at
       FROM users ORDER BY created_at DESC, id DESC LIMIT 500`,
    )
    return res.status(200).json({ success: true, data: { users: rows.map((row) => ({
      id: String(row.id), username: row.username, fullName: row.full_name,
      email: row.email, phone: row.phone, role: row.role, status: row.status,
      createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
    })) } })
  } catch (err) { return next(err) }
}

export async function updateAdminUserStatus(req, res, next) {
  try {
    const targetId = String(req.params.userId || '')
    const actorId = String(req.body?.userId || '')
    const status = req.body?.status
    if (!validId(targetId) || !validId(actorId) || !['active', 'blocked'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Trạng thái tài khoản không hợp lệ.', error: { code: 'VALIDATION_ERROR' } })
    }
    if (targetId === actorId && status === 'blocked') {
      return res.status(400).json({ success: false, message: 'Không thể khóa tài khoản quản trị đang sử dụng.', error: { code: 'SELF_LOCK_FORBIDDEN' } })
    }
    const result = await executeQuery(
      `UPDATE users SET status = ? WHERE id = ? AND role <> 'admin'`, [status, targetId],
    )
    if (!result.affectedRows) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy tài khoản có thể quản lý.', error: { code: 'USER_NOT_FOUND' } })
    }
    return res.status(200).json({ success: true, data: { userId: targetId, status } })
  } catch (err) { return next(err) }
}

export async function listAdminShops(req, res, next) {
  try {
    const rows = await executeQuery(`
      SELECT s.id, s.owner_id, s.slug, s.name, s.tagline, s.province, s.status,
             s.suspension_reason, s.suspended_by, s.suspended_at, s.created_at,
             u.username, u.full_name, u.email AS owner_email, u.phone AS owner_phone,
             suspended_admin.username AS suspended_by_username,
             (SELECT COUNT(*) FROM products p WHERE p.shop_id = s.id AND p.status = 'active') AS product_count,
             (SELECT COUNT(*) FROM products p WHERE p.shop_id = s.id) AS total_product_count,
             (SELECT COUNT(*) FROM shop_violations sv WHERE sv.shop_id = s.id) AS violation_count,
             (SELECT sv.action_taken FROM shop_violations sv WHERE sv.shop_id = s.id ORDER BY sv.id DESC LIMIT 1) AS latest_violation_action,
             (SELECT sv.email_status FROM shop_violations sv WHERE sv.shop_id = s.id ORDER BY sv.id DESC LIMIT 1) AS latest_email_status
      FROM shops s
      JOIN users u ON u.id = s.owner_id
      LEFT JOIN users suspended_admin ON suspended_admin.id = s.suspended_by
      ORDER BY s.created_at DESC, s.id DESC LIMIT 500
    `)
    return res.status(200).json({ success: true, data: { shops: rows.map((row) => ({
      id: String(row.id), ownerId: String(row.owner_id), ownerUsername: row.username,
      ownerName: row.full_name, ownerEmail: row.owner_email || null, ownerPhone: row.owner_phone || null,
      slug: row.slug, name: row.name, tagline: row.tagline || '',
      location: row.province, status: row.status,
      suspensionReason: row.suspension_reason || null,
      suspendedBy: row.suspended_by ? String(row.suspended_by) : null,
      suspendedByUsername: row.suspended_by_username || null,
      suspendedAt: row.suspended_at instanceof Date ? row.suspended_at.toISOString() : (row.suspended_at ? String(row.suspended_at) : null),
      productCount: Number(row.product_count),
      totalProductCount: Number(row.total_product_count),
      violationCount: Number(row.violation_count || 0),
      latestViolationAction: row.latest_violation_action || null,
      latestEmailStatus: row.latest_email_status || null,
      createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
    })) } })
  } catch (err) { return next(err) }
}

export async function updateAdminShopStatus(req, res, next) {
  try {
    const shopId = String(req.params.shopId || '')
    const adminId = String(req.body?.userId || '')
    const status = req.body?.status
    const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim() : (typeof req.body?.suspensionReason === 'string' ? req.body.suspensionReason.trim() : '')

    if (!validId(shopId) || !['active', 'suspended', 'closed'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Trạng thái gian hàng không hợp lệ.', error: { code: 'VALIDATION_ERROR' } })
    }

    if ((status === 'suspended' || status === 'closed') && reason.length < 3) {
      return res.status(400).json({ success: false, message: 'Vui lòng nhập lý do khóa gian hàng (ít nhất 3 ký tự).', error: { code: 'VALIDATION_ERROR' } })
    }

    const result = await executeTransaction(async (query) => {
      const rows = await query(`SELECT id, status FROM shops WHERE id = ? FOR UPDATE`, [shopId])
      if (!rows.length) return { error: 'SHOP_NOT_FOUND' }

      if (status === 'active') {
        await query(
          `UPDATE shops SET status = 'active', suspension_reason = NULL, suspended_by = NULL, suspended_at = NULL WHERE id = ?`,
          [shopId]
        )
        return { shopId, status: 'active', suspensionReason: null }
      } else {
        const actingAdmin = validId(adminId) ? adminId : null
        await query(
          `UPDATE shops SET status = ?, suspension_reason = ?, suspended_by = ?, suspended_at = UTC_TIMESTAMP(3) WHERE id = ?`,
          [status, reason, actingAdmin, shopId]
        )
        return { shopId, status, suspensionReason: reason }
      }
    })

    if (result.error) {
      return res.status(result.error === 'SHOP_NOT_FOUND' ? 404 : 400).json({
        success: false,
        message: result.error === 'SHOP_NOT_FOUND' ? 'Không tìm thấy gian hàng.' : 'Lỗi cập nhật gian hàng.',
        error: { code: result.error }
      })
    }

    return res.status(200).json({ success: true, data: result })
  } catch (err) { return next(err) }
}

export async function listAdminProducts(req, res, next) {
  try {
    const rows = await executeQuery(`
      SELECT p.id, p.shop_id, p.slug, p.name, p.description, p.status, p.approval_status, p.rejection_reason,
             p.reviewed_at, p.is_flash_sale, p.created_at,
             s.name AS shop_name, s.status AS shop_status,
             c.name AS category_name,
             COALESCE(sold.qty, 0) AS sold_count,
             COALESCE(stock.qty, 0) AS stock_count,
             COALESCE(min_v.price, 0) AS price,
             COALESCE(min_v.original_price, NULL) AS original_price,
             (SELECT COUNT(*) FROM product_images pi WHERE pi.product_id = p.id) AS image_count
      FROM products p
      JOIN shops s ON s.id = p.shop_id
      JOIN categories c ON c.id = p.category_id
      LEFT JOIN (
        SELECT oi.product_id, SUM(oi.qty) AS qty
        FROM order_items oi JOIN shop_orders so ON so.id = oi.shop_order_id
        WHERE so.status = 'delivered' GROUP BY oi.product_id
      ) sold ON sold.product_id = p.id
      LEFT JOIN (
        SELECT product_id, SUM(stock_qty) AS qty FROM product_variants
        WHERE is_active = 1 GROUP BY product_id
      ) stock ON stock.product_id = p.id
      LEFT JOIN (
        SELECT product_id, MIN(price) AS price, MIN(original_price) AS original_price
        FROM product_variants
        WHERE is_active = 1 GROUP BY product_id
      ) min_v ON min_v.product_id = p.id
      ORDER BY p.created_at DESC, p.id DESC LIMIT 500
    `)
    if (!rows.length) return res.status(200).json({ success: true, data: { products: [] } })
    const ids = rows.map((r) => String(r.id))
    const placeholders = ids.map(() => '?').join(',')
    const images = await executeQuery(
      `SELECT product_id, url, alt_text, sort_order FROM product_images
       WHERE product_id IN (${placeholders}) ORDER BY product_id, sort_order LIMIT 2000`,
      ids,
    )
    const imagesByProduct = new Map()
    for (const img of images) {
      const pid = String(img.product_id)
      if (!imagesByProduct.has(pid)) imagesByProduct.set(pid, [])
      imagesByProduct.get(pid).push({
        url: img.url,
        altText: img.alt_text,
        sortOrder: img.sort_order,
      })
    }
    return res.status(200).json({
      success: true,
      data: {
        products: rows.map((row) => ({
          id: String(row.id),
          shopId: String(row.shop_id),
          shopName: row.shop_name,
          shopStatus: row.shop_status,
          categoryName: row.category_name,
          slug: row.slug,
          name: row.name,
          description: row.description || '',
          status: row.status,
          approvalStatus: row.approval_status || 'pending',
          rejectionReason: row.rejection_reason || null,
          reviewedAt: row.reviewed_at instanceof Date ? row.reviewed_at.toISOString() : (row.reviewed_at ? String(row.reviewed_at) : null),
          flash: Boolean(row.is_flash_sale),
          price: Number(row.price || 0),
          originalPrice: row.original_price === null ? null : Number(row.original_price),
          sold: Number(row.sold_count),
          stock: Number(row.stock_count),
          imageCount: Number(row.image_count),
          images: imagesByProduct.get(String(row.id)) || [],
          createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
        })),
      },
    })
  } catch (err) { return next(err) }
}

export async function updateAdminProductStatus(req, res, next) {
  try {
    const productId = String(req.params.productId || '')
    const status = req.body?.status
    if (!validId(productId) || !['draft', 'active', 'hidden', 'archived'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Trạng thái sản phẩm không hợp lệ.', error: { code: 'VALIDATION_ERROR' } })
    }
    const result = await executeTransaction(async (query) => {
      const rows = await query(
        `SELECT p.id, p.approval_status, s.status AS shop_status, owner.status AS owner_status,
           (SELECT COUNT(*) FROM product_images pi WHERE pi.product_id = p.id) AS image_count,
           (SELECT COUNT(*) FROM product_variants pv WHERE pv.product_id = p.id AND pv.is_active = 1) AS variant_count
         FROM products p JOIN shops s ON s.id = p.shop_id JOIN users owner ON owner.id = s.owner_id WHERE p.id = ? FOR UPDATE`, [productId],
      )
      if (!rows.length) return { error: 'PRODUCT_NOT_FOUND' }
      if (status === 'active' && (rows[0].approval_status !== 'approved' || rows[0].shop_status !== 'active' || rows[0].owner_status !== 'active' || Number(rows[0].image_count) < 1 || Number(rows[0].variant_count) < 1)) {
        return { error: 'PRODUCT_NOT_READY' }
      }
      await query(`UPDATE products SET status = ? WHERE id = ?`, [status, productId])
      return { productId, status }
    })
    if (result.error) {
      return res.status(result.error === 'PRODUCT_NOT_FOUND' ? 404 : 400).json({
        success: false,
        message: result.error === 'PRODUCT_NOT_FOUND' ? 'Không tìm thấy sản phẩm.' : 'Chỉ có thể đăng bán sản phẩm của gian hàng đang hoạt động, có ảnh thật và có SKU.',
        error: { code: result.error },
      })
    }
    return res.status(200).json({ success: true, data: result })
  } catch (err) { return next(err) }
}

export async function updateAdminProductFlashSale(req, res, next) {
  try {
    const productId = String(req.params.productId || '')
    const enabled = req.body?.enabled
    if (!validId(productId) || typeof enabled !== 'boolean') {
      return res.status(400).json({ success: false, message: 'Trạng thái Flash Sale không hợp lệ.', error: { code: 'VALIDATION_ERROR' } })
    }
    const result = await executeTransaction(async (query) => {
      const rows = await query(
        `SELECT p.id, p.status, s.status AS shop_status, owner.status AS owner_status
         FROM products p JOIN shops s ON s.id = p.shop_id JOIN users owner ON owner.id = s.owner_id
         WHERE p.id = ? FOR UPDATE`,
        [productId],
      )
      if (!rows.length) return { error: 'PRODUCT_NOT_FOUND' }
      if (enabled && (rows[0].status !== 'active' || rows[0].shop_status !== 'active' || rows[0].owner_status !== 'active')) {
        return { error: 'PRODUCT_NOT_READY' }
      }
      await query(`UPDATE products SET is_flash_sale = ? WHERE id = ?`, [enabled ? 1 : 0, productId])
      return { productId, flash: enabled }
    })
    if (result.error) {
      return res.status(result.error === 'PRODUCT_NOT_FOUND' ? 404 : 400).json({
        success: false,
        message: result.error === 'PRODUCT_NOT_FOUND' ? 'Không tìm thấy sản phẩm.' : 'Chỉ có thể bật Flash Sale cho sản phẩm đang được duyệt và đang hoạt động.',
        error: { code: result.error },
      })
    }
    return res.status(200).json({ success: true, data: result })
  } catch (err) { return next(err) }
}

export async function listAdminReviews(req, res, next) {
  try {
    const rows = await executeQuery(`
      SELECT r.id, r.product_id, r.user_id, r.rating, r.comment, r.status, r.created_at,
             p.name AS product_name, s.name AS shop_name, u.username, u.full_name
      FROM reviews r
      JOIN products p ON p.id = r.product_id
      JOIN shops s ON s.id = p.shop_id
      JOIN users u ON u.id = r.user_id
      ORDER BY r.created_at DESC, r.id DESC LIMIT 500
    `)
    return res.status(200).json({ success: true, data: { reviews: rows.map((row) => ({
      id: String(row.id), productId: String(row.product_id), userId: String(row.user_id),
      productName: row.product_name, shopName: row.shop_name, username: row.username,
      fullName: row.full_name, rating: Number(row.rating), comment: row.comment,
      status: row.status,
      createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
    })) } })
  } catch (err) { return next(err) }
}

export async function updateAdminReviewStatus(req, res, next) {
  try {
    const reviewId = String(req.params.reviewId || '')
    const status = req.body?.status
    if (!validId(reviewId) || !['visible', 'hidden'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Review status is invalid.', error: { code: 'VALIDATION_ERROR' } })
    }
    const result = await executeQuery(`UPDATE reviews SET status = ? WHERE id = ?`, [status, reviewId])
    if (!result.affectedRows) return res.status(404).json({ success: false, message: 'Review not found.', error: { code: 'REVIEW_NOT_FOUND' } })
    return res.status(200).json({ success: true, data: { reviewId, status } })
  } catch (err) { return next(err) }
}

export async function listAdminReports(req, res, next) {
  try {
    const rows = await executeQuery(`
      SELECT r.id, r.reporter_id, r.target_type, r.target_id, r.shop_id, r.reason, r.details, r.evidence_url,
             r.status, r.created_at, r.resolved_by, r.resolved_at,
             reporter.username AS reporter_username, reporter.full_name AS reporter_fullname,
             resolver.username AS resolver_username,
             COALESCE(p.name, s.name, target_user.username, CONCAT('Đánh giá #', review.id)) AS target_name,
             p.slug AS product_slug,
             (SELECT pi.url FROM product_images pi WHERE pi.product_id = p.id ORDER BY pi.sort_order LIMIT 1) AS product_image,
             COALESCE(s.id, target_shop.id, p_shop.id) AS related_shop_id,
             COALESCE(s.name, target_shop.name, p_shop.name) AS related_shop_name,
             COALESCE(s.status, target_shop.status, p_shop.status) AS related_shop_status,
             shop_owner.email AS shop_owner_email,
             shop_owner.phone AS shop_owner_phone,
             sv.id AS violation_id,
             sv.violation_number,
             sv.action_taken AS violation_action,
             sv.email_status AS violation_email_status,
             sv.email_sent_to AS violation_email_sent_to,
             sv.email_error AS violation_email_error,
             sv.email_sent_at AS violation_email_sent_at,
             (SELECT COUNT(*) FROM shop_violations v WHERE v.shop_id = COALESCE(s.id, target_shop.id, p_shop.id)) AS shop_violation_count
      FROM abuse_reports r
      JOIN users reporter ON reporter.id = r.reporter_id
      LEFT JOIN users resolver ON resolver.id = r.resolved_by
      LEFT JOIN products p ON r.target_type = 'product' AND p.id = r.target_id
      LEFT JOIN shops p_shop ON p_shop.id = p.shop_id
      LEFT JOIN shops s ON r.target_type = 'shop' AND s.id = r.target_id
      LEFT JOIN shops target_shop ON target_shop.id = r.shop_id
      LEFT JOIN users target_user ON r.target_type = 'user' AND target_user.id = r.target_id
      LEFT JOIN reviews review ON r.target_type = 'review' AND review.id = r.target_id
      LEFT JOIN shops final_shop ON final_shop.id = COALESCE(s.id, target_shop.id, p_shop.id)
      LEFT JOIN users shop_owner ON shop_owner.id = final_shop.owner_id
      LEFT JOIN shop_violations sv ON sv.report_id = r.id
      ORDER BY r.created_at DESC, r.id DESC LIMIT 500
    `)
    return res.status(200).json({
      success: true,
      data: {
        reports: rows.map((row) => ({
          id: String(row.id),
          reporterId: String(row.reporter_id),
          reporterUsername: row.reporter_username,
          reporterFullName: row.reporter_fullname || row.reporter_username,
          targetType: row.target_type,
          targetId: String(row.target_id),
          targetName: row.target_name || 'Không còn tồn tại',
          productSlug: row.product_slug || null,
          productImage: row.product_image || null,
          shopId: row.related_shop_id ? String(row.related_shop_id) : null,
          shopName: row.related_shop_name || null,
          shopStatus: row.related_shop_status || null,
          shopOwnerEmail: row.shop_owner_email || null,
          shopOwnerPhone: row.shop_owner_phone || null,
          shopViolationCount: Number(row.shop_violation_count || 0),
          violationId: row.violation_id ? String(row.violation_id) : null,
          violationNumber: row.violation_number ? Number(row.violation_number) : null,
          violationAction: row.violation_action || null,
          violationEmailStatus: row.violation_email_status || null,
          violationEmailSentTo: row.violation_email_sent_to || null,
          violationEmailError: row.violation_email_error || null,
          violationEmailSentAt: row.violation_email_sent_at ? (row.violation_email_sent_at instanceof Date ? row.violation_email_sent_at.toISOString() : String(row.violation_email_sent_at)) : null,
          reason: row.reason,
          details: row.details || '',
          evidenceUrl: row.evidence_url || null,
          status: row.status,
          resolvedBy: row.resolved_by === null ? null : String(row.resolved_by),
          resolverUsername: row.resolver_username || null,
          resolvedAt: row.resolved_at instanceof Date ? row.resolved_at.toISOString() : (row.resolved_at ? String(row.resolved_at) : null),
          createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
        })),
      },
    })
  } catch (err) { return next(err) }
}

export async function updateAdminReportStatus(req, res, next) {
  try {
    const reportId = String(req.params.reportId || '')
    const adminId = String(req.body?.userId || '')
    const status = req.body?.status
    const allowed = ['open', 'investigating', 'confirmed_violation', 'dismissed', 'resolved']
    if (!validId(reportId) || !validId(adminId) || !allowed.includes(status)) {
      return res.status(400).json({ success: false, message: 'Trạng thái báo cáo không hợp lệ.', error: { code: 'VALIDATION_ERROR' } })
    }

    if (status === 'confirmed_violation') {
      const result = await executeTransaction(async (query) => {
        // 1. Khóa và lấy thông tin báo cáo
        const reports = await query(`SELECT * FROM abuse_reports WHERE id = ? FOR UPDATE`, [reportId])
        if (!reports.length) return { error: 'REPORT_NOT_FOUND' }
        const report = reports[0]

        // 2. Xác định shop liên quan
        let shopId = report.shop_id
        let productName = null
        if (!shopId) {
          if (report.target_type === 'product') {
            const prods = await query(`SELECT id, name, shop_id FROM products WHERE id = ? LIMIT 1`, [report.target_id])
            if (prods.length) {
              shopId = prods[0].shop_id
              productName = prods[0].name
            }
          } else if (report.target_type === 'shop') {
            shopId = report.target_id
          }
        } else if (report.target_type === 'product') {
          const prods = await query(`SELECT name FROM products WHERE id = ? LIMIT 1`, [report.target_id])
          if (prods.length) productName = prods[0].name
        }

        if (!shopId) return { error: 'SHOP_NOT_FOUND' }

        // 3. Khóa và lấy thông tin shop + tài khoản chủ shop
        const shopRows = await query(
          `SELECT s.id, s.name, s.status, u.id AS owner_id, u.email AS owner_email, u.full_name AS owner_name, u.username AS owner_username
           FROM shops s
           JOIN users u ON u.id = s.owner_id
           WHERE s.id = ? FOR UPDATE`,
          [shopId]
        )
        if (!shopRows.length) return { error: 'SHOP_NOT_FOUND' }
        const shop = shopRows[0]

        // 4. CHỐNG XỬ LÝ TRÙNG: Kiểm tra xem báo cáo này đã có bản ghi vi phạm chưa
        const existingViolations = await query(
          `SELECT * FROM shop_violations WHERE report_id = ? LIMIT 1`,
          [reportId]
        )

        let violationRecord
        let isNewViolation = false
        if (existingViolations.length > 0) {
          // Báo cáo đã từng xác nhận vi phạm trước đó: Không tăng số lần vi phạm, không khóa lại trùng lặp
          violationRecord = existingViolations[0]
        } else {
          isNewViolation = true
          // 5. Đếm số lần vi phạm đã xác nhận thực tế trước đó của shop
          const countRows = await query(
            `SELECT COUNT(*) AS total FROM shop_violations WHERE shop_id = ?`,
            [shopId]
          )
          const violationNumber = Number(countRows[0].total) + 1
          const actionTaken = violationNumber >= 2 ? 'shop_suspended' : 'warning_email'

          // 6. Quy tắc: Vi phạm lần 2 trở lên -> Khóa shop vi phạm
          if (actionTaken === 'shop_suspended') {
            const lockReason = `Khóa gian hàng do tái phạm vi phạm chính sách hàng giả / vi phạm bản quyền (Lần ${violationNumber}) theo hồ sơ báo cáo #${reportId}.`
            await query(
              `UPDATE shops
               SET status = 'suspended', suspension_reason = ?, suspended_by = ?, suspended_at = UTC_TIMESTAMP(3)
               WHERE id = ?`,
              [lockReason, adminId, shopId]
            )
          }

          // 7. Tạo bản ghi vi phạm trong shop_violations
          const insertRes = await query(
            `INSERT INTO shop_violations (
               shop_id, report_id, violation_number, violation_type, reason,
               action_taken, admin_id, email_sent_to, email_status, email_content
             ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'not_configured', ?)`,
            [
              shopId,
              reportId,
              violationNumber,
              'counterfeit',
              report.reason,
              actionTaken,
              adminId,
              shop.owner_email || null,
              report.details || null
            ]
          )

          violationRecord = {
            id: insertRes.insertId,
            shop_id: shopId,
            report_id: reportId,
            violation_number: violationNumber,
            action_taken: actionTaken,
            email_sent_to: shop.owner_email || null,
            email_status: 'not_configured',
          }
        }

        // 8. Cập nhật trạng thái abuse_reports
        await query(
          `UPDATE abuse_reports
           SET status = 'confirmed_violation', resolved_by = ?, resolved_at = UTC_TIMESTAMP(3)
           WHERE id = ?`,
          [adminId, reportId]
        )

        return {
          reportId,
          status: 'confirmed_violation',
          violationId: String(violationRecord.id),
          violationNumber: Number(violationRecord.violation_number),
          actionTaken: violationRecord.action_taken,
          shopId: String(shop.id),
          shopName: shop.name,
          shopStatus: violationRecord.action_taken === 'shop_suspended' ? 'suspended' : shop.status,
          ownerEmail: shop.owner_email,
          ownerName: shop.owner_name || shop.owner_username,
          productName: productName || report.reason,
          reason: report.reason,
          details: report.details,
          evidenceUrl: report.evidence_url,
          isNewViolation,
        }
      })

      if (result.error) {
        return res.status(result.error === 'REPORT_NOT_FOUND' ? 404 : 400).json({
          success: false,
          message: result.error === 'REPORT_NOT_FOUND' ? 'Không tìm thấy báo cáo.' : 'Không thể xác định gian hàng liên quan để áp dụng chế tài.',
          error: { code: result.error }
        })
      }

      return res.status(200).json({ success: true, data: result })
    }

    let query
    let params
    if (status === 'open') {
      query = `UPDATE abuse_reports SET status = ?, resolved_by = NULL, resolved_at = NULL WHERE id = ?`
      params = [status, reportId]
    } else if (status === 'investigating') {
      query = `UPDATE abuse_reports SET status = ?, resolved_by = ?, resolved_at = NULL WHERE id = ?`
      params = [status, adminId, reportId]
    } else {
      query = `UPDATE abuse_reports SET status = ?, resolved_by = ?, resolved_at = UTC_TIMESTAMP(3) WHERE id = ?`
      params = [status, adminId, reportId]
    }

    const result = await executeQuery(query, params)
    if (!result.affectedRows) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy báo cáo.', error: { code: 'REPORT_NOT_FOUND' } })
    }
    return res.status(200).json({ success: true, data: { reportId, status } })
  } catch (err) { return next(err) }
}

export async function createReport(req, res, next) {
  try {
    const userId = String(req.body?.userId || '')
    const targetType = req.body?.targetType
    const targetId = String(req.body?.targetId || '')
    const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim() : ''
    const details = typeof req.body?.details === 'string' ? req.body.details.trim() : ''
    const evidenceUrl = typeof req.body?.evidenceUrl === 'string' && req.body.evidenceUrl.trim().length > 0 ? req.body.evidenceUrl.trim() : null

    if (!validId(userId) || !validId(targetId) || !['shop', 'product', 'user', 'review'].includes(targetType) || reason.length < 3 || reason.length > 2000) {
      return res.status(400).json({ success: false, message: 'Loại đối tượng, mã đối tượng hoặc nội dung báo cáo không hợp lệ.', error: { code: 'VALIDATION_ERROR' } })
    }

    const targetTables = { shop: 'shops', product: 'products', user: 'users', review: 'reviews' }
    const targetRows = await executeQuery(`SELECT id FROM ${targetTables[targetType]} WHERE id = ? LIMIT 1`, [targetId])
    if (!targetRows.length) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy nội dung cần báo cáo.', error: { code: 'TARGET_NOT_FOUND' } })
    }

    // Chống gửi trùng lặp: nếu người mua đã có báo cáo đang mở hoặc đang xác minh cho cùng đối tượng
    const existingReports = await executeQuery(
      `SELECT id FROM abuse_reports
       WHERE reporter_id = ? AND target_type = ? AND target_id = ? AND status IN ('open', 'investigating')
       LIMIT 1`,
      [userId, targetType, targetId]
    )
    if (existingReports.length) {
      return res.status(409).json({
        success: false,
        message: 'Bạn đã gửi một báo cáo cho đối tượng này đang chờ Ban Quản Trị xác minh. Vui lòng không gửi trùng lặp.',
        error: { code: 'DUPLICATE_REPORT' }
      })
    }

    let shopId = null
    if (targetType === 'product') {
      const pRows = await executeQuery(`SELECT shop_id FROM products WHERE id = ? LIMIT 1`, [targetId])
      if (pRows.length && pRows[0].shop_id) shopId = pRows[0].shop_id
    } else if (targetType === 'shop') {
      shopId = targetId
    }

    const result = await executeQuery(
      `INSERT INTO abuse_reports (reporter_id, target_type, target_id, shop_id, reason, details, evidence_url, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'open')`,
      [userId, targetType, targetId, shopId, reason, details || null, evidenceUrl],
    )
    return res.status(201).json({ success: true, data: { reportId: String(result.insertId), status: 'open' } })
  } catch (err) { return next(err) }
}

export async function updateViolationEmailStatus(req, res, next) {
  try {
    const violationId = String(req.params.violationId || '')
    const { emailStatus, emailError, emailContent, emailSentTo, emailSentAt } = req.body || {}
    if (!validId(violationId) || !['not_configured', 'sending', 'sent', 'failed'].includes(emailStatus)) {
      return res.status(400).json({ success: false, message: 'Trạng thái email không hợp lệ.', error: { code: 'VALIDATION_ERROR' } })
    }
    const result = await executeQuery(
      `UPDATE shop_violations
       SET email_status = ?,
           email_error = ?,
           email_content = COALESCE(?, email_content),
           email_sent_to = COALESCE(?, email_sent_to),
           email_sent_at = CASE
             WHEN ? = 'sent' THEN COALESCE(?, UTC_TIMESTAMP(3))
             ELSE email_sent_at
           END
       WHERE id = ?`,
      [emailStatus, emailError || null, emailContent || null, emailSentTo || null, emailStatus, emailSentAt || null, violationId]
    )
    if (!result.affectedRows) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy bản ghi vi phạm.', error: { code: 'VIOLATION_NOT_FOUND' } })
    }
    return res.status(200).json({ success: true, data: { violationId, emailStatus } })
  } catch (err) { return next(err) }
}

export async function getShopViolations(req, res, next) {
  try {
    const shopId = String(req.params.shopId || '')
    if (!validId(shopId)) {
      return res.status(400).json({ success: false, message: 'Mã gian hàng không hợp lệ.', error: { code: 'VALIDATION_ERROR' } })
    }
    const rows = await executeQuery(
      `SELECT sv.id, sv.shop_id, sv.report_id, sv.violation_number, sv.violation_type,
              sv.reason, sv.action_taken, sv.admin_id, admin_user.username AS admin_username,
              sv.email_sent_to, sv.email_status, sv.email_sent_at, sv.email_error, sv.email_content, sv.created_at
       FROM shop_violations sv
       JOIN users admin_user ON admin_user.id = sv.admin_id
       WHERE sv.shop_id = ?
       ORDER BY sv.created_at DESC, sv.id DESC`,
      [shopId]
    )
    return res.status(200).json({
      success: true,
      data: {
        violations: rows.map((r) => ({
          id: String(r.id),
          shopId: String(r.shop_id),
          reportId: r.report_id ? String(r.report_id) : null,
          violationNumber: Number(r.violation_number),
          violationType: r.violation_type,
          reason: r.reason,
          actionTaken: r.action_taken,
          adminId: String(r.admin_id),
          adminUsername: r.admin_username,
          emailSentTo: r.email_sent_to,
          emailStatus: r.email_status,
          emailSentAt: r.email_sent_at ? (r.email_sent_at instanceof Date ? r.email_sent_at.toISOString() : String(r.email_sent_at)) : null,
          emailError: r.email_error,
          emailContent: r.email_content,
          createdAt: r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at),
        })),
      },
    })
  } catch (err) { return next(err) }
}

export async function getViolationDetail(req, res, next) {
  try {
    const violationId = String(req.params.violationId || '')
    if (!validId(violationId)) {
      return res.status(400).json({ success: false, message: 'Mã vi phạm không hợp lệ.', error: { code: 'VALIDATION_ERROR' } })
    }
    const rows = await executeQuery(
      `SELECT sv.*, s.name AS shop_name, u.email AS owner_email, u.full_name AS owner_name, u.username AS owner_username,
              p.name AS product_name
       FROM shop_violations sv
       JOIN shops s ON s.id = sv.shop_id
       JOIN users u ON u.id = s.owner_id
       LEFT JOIN abuse_reports r ON r.id = sv.report_id
       LEFT JOIN products p ON r.target_type = 'product' AND p.id = r.target_id
       WHERE sv.id = ? LIMIT 1`,
      [violationId]
    )
    if (!rows.length) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy bản ghi vi phạm.', error: { code: 'VIOLATION_NOT_FOUND' } })
    }
    const r = rows[0]
    return res.status(200).json({
      success: true,
      data: {
        id: String(r.id),
        shopId: String(r.shop_id),
        shopName: r.shop_name,
        ownerEmail: r.owner_email,
        ownerName: r.owner_name || r.owner_username,
        productName: r.product_name || r.reason,
        reportId: r.report_id ? String(r.report_id) : null,
        violationNumber: Number(r.violation_number),
        reason: r.reason,
        actionTaken: r.action_taken,
        emailSentTo: r.email_sent_to,
        emailStatus: r.email_status,
        emailSentAt: r.email_sent_at ? (r.email_sent_at instanceof Date ? r.email_sent_at.toISOString() : String(r.email_sent_at)) : null,
        emailError: r.email_error,
        emailContent: r.email_content,
        createdAt: r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at),
      }
    })
  } catch (err) {
    return next(err)
  }
}

export async function updateAdminProductApproval(req, res, next) {
  try {
    const productId = String(req.params.productId || '')
    const { approvalStatus, rejectionReason, userId } = req.body || {}
    if (!validId(productId) || !['approved', 'rejected'].includes(approvalStatus)) {
      return res.status(400).json({ success: false, message: 'Trạng thái duyệt không hợp lệ.', error: { code: 'VALIDATION_ERROR' } })
    }
    const reason = typeof rejectionReason === 'string' ? rejectionReason.trim() : ''
    if (approvalStatus === 'rejected' && (!reason || reason.length < 3 || reason.length > 1000)) {
      return res.status(400).json({ success: false, message: 'Vui lòng nhập lý do từ chối cụ thể (từ 3 đến 1000 ký tự).', error: { code: 'VALIDATION_ERROR' } })
    }

    const result = await executeTransaction(async (query) => {
      const rows = await query(
        `SELECT p.id, p.status, p.approval_status, s.status AS shop_status, owner.status AS owner_status,
           (SELECT COUNT(*) FROM product_images pi WHERE pi.product_id = p.id) AS image_count,
           (SELECT COUNT(*) FROM product_variants pv WHERE pv.product_id = p.id AND pv.is_active = 1) AS variant_count
         FROM products p
         JOIN shops s ON s.id = p.shop_id
         JOIN users owner ON owner.id = s.owner_id
         WHERE p.id = ? FOR UPDATE`,
        [productId],
      )
      if (!rows.length) return { error: 'PRODUCT_NOT_FOUND' }

      const adminUserId = validId(userId) ? userId : null

      if (approvalStatus === 'approved') {
        const nextVisibility = rows[0].status === 'hidden' ? 'hidden' : 'active'
        await query(
          `UPDATE products
           SET approval_status = 'approved',
               status = ?,
               rejection_reason = NULL,
               reviewed_by = ?,
               reviewed_at = CURRENT_TIMESTAMP(3)
           WHERE id = ?`,
          [nextVisibility, adminUserId, productId],
        )
        return { productId, approvalStatus: 'approved', status: nextVisibility }
      } else {
        await query(
          `UPDATE products
           SET approval_status = 'rejected',
               rejection_reason = ?,
               reviewed_by = ?,
               reviewed_at = CURRENT_TIMESTAMP(3)
           WHERE id = ?`,
          [reason, adminUserId, productId],
        )
        return { productId, approvalStatus: 'rejected', rejectionReason: reason }
      }
    })

    if (result.error) {
      return res.status(result.error === 'PRODUCT_NOT_FOUND' ? 404 : 400).json({
        success: false,
        message: result.error === 'PRODUCT_NOT_FOUND' ? 'Không tìm thấy sản phẩm.' : 'Không thể cập nhật kiểm duyệt.',
        error: { code: result.error },
      })
    }

    return res.status(200).json({ success: true, data: result })
  } catch (err) {
    return next(err)
  }
}
