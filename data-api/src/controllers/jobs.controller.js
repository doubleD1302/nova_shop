import { executeQuery, executeTransaction } from '../config/database.js'

async function releaseOrderVoucher(query, orderId) {
  const voucherUses = await query(
    `SELECT voucher_id FROM voucher_uses WHERE order_id = ? AND state = 'applied' FOR UPDATE`,
    [orderId],
  )
  if (!voucherUses.length) return
  await query(
    `UPDATE voucher_uses SET state = 'released', released_at = UTC_TIMESTAMP(3)
     WHERE order_id = ? AND state = 'applied'`,
    [orderId],
  )
  await query(
    'UPDATE vouchers SET used_count = used_count - 1 WHERE id = ? AND used_count > 0',
    [voucherUses[0].voucher_id],
  )
}

async function restockShopOrder(query, shopOrderId, note) {
  const items = await query(
    'SELECT id, variant_id, qty FROM order_items WHERE shop_order_id = ? ORDER BY variant_id FOR UPDATE',
    [shopOrderId],
  )
  for (const item of items) {
    await query('UPDATE product_variants SET stock_qty = stock_qty + ? WHERE id = ?', [item.qty, item.variant_id])
    await query(
      `INSERT INTO stock_moves (variant_id, order_item_id, reason, delta_qty, actor_id, note)
       VALUES (?, ?, 'cancel', ?, NULL, ?)`,
      [item.variant_id, item.id, item.qty, note],
    )
  }
}

/**
 * 1. Tự động hủy đơn hàng Online chưa hoàn tất thanh toán sau thời gian quy định
 */
export async function cancelExpiredOrders(req, res, next) {
  try {
    const expireMinutes = Math.max(1, parseInt(req.body?.expireMinutes || req.query?.expireMinutes || '15', 10))

    const cancelledOrders = []

    await executeTransaction(async (query) => {
      // Tìm các đơn hàng online có payments.status = 'unpaid' và shop_orders.status = 'pending' đã quá hạn
      const expiredRows = await query(
        `SELECT DISTINCT
           o.id AS order_id,
           o.buyer_id,
           o.code AS order_code,
           so.id AS shop_order_id,
           so.shop_id,
           so.shop_name,
           p.id AS payment_id,
           p.method AS payment_method
         FROM orders o
         JOIN shop_orders so ON so.order_id = o.id
         JOIN payments p ON p.shop_order_id = so.id
         WHERE o.payment_method IN ('bank', 'momo', 'zalopay', 'card')
           AND p.status = 'unpaid'
           AND so.status = 'pending'
           AND o.created_at <= DATE_SUB(UTC_TIMESTAMP(3), INTERVAL ? MINUTE)
         FOR UPDATE`,
        [expireMinutes],
      )

      if (!expiredRows.length) return

      for (const row of expiredRows) {
        // Cập nhật trạng thái shop_orders
        await query(
          `UPDATE shop_orders
           SET status = 'cancelled',
               cancel_reason = 'Hủy tự động do quá hạn thanh toán online',
               cancelled_at = UTC_TIMESTAMP(3)
           WHERE id = ? AND status = 'pending'`,
          [row.shop_order_id],
        )

        // Cập nhật payments -> void
        await query(
          `UPDATE payments SET status = 'void' WHERE id = ? AND status = 'unpaid'`,
          [row.payment_id],
        )

        // Ghi nhận lịch sử đơn hàng
        await query(
          `INSERT INTO order_events (shop_order_id, from_status, to_status, actor_id, note)
           VALUES (?, 'pending', 'cancelled', NULL, 'Hủy tự động do quá hạn thanh toán online')`,
          [row.shop_order_id],
        )

        // Hoàn kho cho sản phẩm
        await restockShopOrder(query, row.shop_order_id, 'Hoàn kho do hủy tự động vì quá hạn thanh toán online')

        // Kiểm tra xem đơn tổng còn đơn con nào chưa bị hủy không, nếu tất cả đã bị hủy thì nhả voucher
        const remaining = await query(
          `SELECT COUNT(*) AS activeCount FROM shop_orders WHERE order_id = ? AND status <> 'cancelled'`,
          [row.order_id],
        )

        if (Number(remaining[0]?.activeCount || 0) === 0) {
          await releaseOrderVoucher(query, row.order_id)
        }

        cancelledOrders.push({
          orderId: String(row.order_id),
          buyerId: String(row.buyer_id),
          orderCode: row.order_code,
          shopOrderId: String(row.shop_order_id),
          shopId: String(row.shop_id),
          shopName: row.shop_name,
        })
      }
    })

    return res.status(200).json({
      success: true,
      message: `Đã quét và hủy tự động ${cancelledOrders.length} đơn hàng quá hạn thanh toán online.`,
      data: {
        cancelledCount: cancelledOrders.length,
        cancelledOrders,
      },
    })
  } catch (err) {
    return next(err)
  }
}

/**
 * 2. Tự động hoàn tất đơn hàng (Auto-complete) sau 7 ngày từ khi delivered
 */
export async function autoCompleteOrders(req, res, next) {
  try {
    const completeDays = Math.max(1, parseInt(req.body?.days || req.query?.days || '7', 10))
    const completedOrders = []

    await executeTransaction(async (query) => {
      // Tìm các shop_orders ở trạng thái 'delivered' quá số ngày quy định
      // VÀ không có yêu cầu khiếu nại trả hàng nào đang ở trạng thái 'requested' hoặc 'approved'
      const rows = await query(
        `SELECT
           so.id AS shop_order_id,
           so.order_id,
           so.shop_id,
           so.shop_name,
           o.buyer_id,
           s.owner_id AS seller_id
         FROM shop_orders so
         JOIN orders o ON o.id = so.order_id
         JOIN shops s ON s.id = so.shop_id
         WHERE so.status = 'delivered'
           AND so.delivered_at <= DATE_SUB(UTC_TIMESTAMP(3), INTERVAL ? DAY)
           AND NOT EXISTS (
             SELECT 1 FROM order_returns r
             WHERE r.shop_order_id = so.id
               AND r.status IN ('requested', 'approved')
           )
         FOR UPDATE`,
        [completeDays],
      )

      if (!rows.length) return

      for (const row of rows) {
        // Cập nhật trạng thái completed
        await query(
          `UPDATE shop_orders
           SET status = 'completed',
               completed_at = UTC_TIMESTAMP(3)
           WHERE id = ? AND status = 'delivered'`,
          [row.shop_order_id],
        )

        // Ghi nhận lịch sử đơn hàng
        await query(
          `INSERT INTO order_events (shop_order_id, from_status, to_status, actor_id, note)
           VALUES (?, 'delivered', 'completed', NULL, 'Hệ thống tự động hoàn tất đơn sau 7 ngày giao hàng')`,
          [row.shop_order_id],
        )

        completedOrders.push({
          orderId: String(row.order_id),
          shopOrderId: String(row.shop_order_id),
          shopId: String(row.shop_id),
          shopName: row.shop_name,
          buyerId: String(row.buyer_id),
          sellerId: String(row.seller_id),
        })
      }
    })

    return res.status(200).json({
      success: true,
      message: `Đã tự động hoàn tất ${completedOrders.length} đơn hàng delivered sau ${completeDays} ngày.`,
      data: {
        completedCount: completedOrders.length,
        completedOrders,
      },
    })
  } catch (err) {
    console.error('[autoCompleteOrders error]:', err)
    return next(err)
  }
}

/**
 * 3. Tự động cập nhật trạng thái Voucher hết hạn
 */
export async function expireVouchers(req, res, next) {
  try {
    const result = await executeQuery(
      `UPDATE vouchers
       SET status = 'expired',
           is_active = 0
       WHERE ends_at <= UTC_TIMESTAMP(3)
         AND (status <> 'expired' OR is_active = 1)`,
    )

    return res.status(200).json({
      success: true,
      message: `Đã cập nhật ${result.affectedRows} voucher hết hạn sang trạng thái expired.`,
      data: {
        expiredCount: result.affectedRows,
      },
    })
  } catch (err) {
    return next(err)
  }
}

/**
 * 4. Lấy danh sách tất cả hình ảnh đang được sử dụng trong CSDL để phục vụ Orphan Upload Cleaner
 */
export async function getReferencedImages(req, res, next) {
  try {
    const referencedSet = new Set()

    const addUrl = (url) => {
      if (!url || typeof url !== 'string') return
      const trimmed = url.trim()
      if (!trimmed) return
      // Lấy filename từ URL (ví dụ /uploads/abc.png -> abc.png)
      const parts = trimmed.split('/')
      const filename = parts[parts.length - 1].split('?')[0].trim()
      if (filename) referencedSet.add(filename)
    }

    const addJsonUrls = (jsonVal) => {
      if (!jsonVal) return
      try {
        const arr = typeof jsonVal === 'string' ? JSON.parse(jsonVal) : jsonVal
        if (Array.isArray(arr)) {
          for (const item of arr) {
            if (typeof item === 'string') addUrl(item)
            else if (item && typeof item === 'object' && item.url) addUrl(item.url)
          }
        }
      } catch {
        // Bỏ qua nếu json không parse được
      }
    }

    // Helper thực thi truy vấn an toàn, không văng lỗi khi bảng hoặc cột chưa tồn tại
    const safeQuery = async (sql, callback) => {
      try {
        const rows = await executeQuery(sql)
        if (Array.isArray(rows)) {
          rows.forEach(callback)
        }
      } catch (err) {
        console.warn(`[getReferencedImages warning] Query failed: ${sql}`, err.message)
      }
    }

    // 1. Users avatar
    await safeQuery('SELECT avatar_url FROM users WHERE avatar_url IS NOT NULL', (r) => addUrl(r.avatar_url))

    // 2. Shops logo và banner
    await safeQuery('SELECT logo_url, banner_url FROM shops', (r) => {
      addUrl(r.logo_url)
      addUrl(r.banner_url)
    })

    // 3. Product images (cột url)
    await safeQuery('SELECT url FROM product_images WHERE url IS NOT NULL', (r) => addUrl(r.url))

    // 4. Review images (cột url)
    await safeQuery('SELECT url FROM review_images WHERE url IS NOT NULL', (r) => addUrl(r.url))

    // 5. Categories image
    await safeQuery('SELECT image_url FROM categories WHERE image_url IS NOT NULL', (r) => addUrl(r.image_url))

    // 6. Marketing campaigns banner
    await safeQuery('SELECT banner_url FROM marketing_campaigns WHERE banner_url IS NOT NULL', (r) => addUrl(r.banner_url))

    // 7. Order returns images (mảng JSON)
    await safeQuery('SELECT images FROM order_returns WHERE images IS NOT NULL', (r) => addJsonUrls(r.images))

    // 8. Chat attachments (mảng JSON)
    await safeQuery('SELECT attachments FROM chat_messages WHERE attachments IS NOT NULL', (r) => addJsonUrls(r.attachments))

    return res.status(200).json({
      success: true,
      data: {
        count: referencedSet.size,
        filenames: Array.from(referencedSet),
      },
    })
  } catch (err) {
    return next(err)
  }
}
