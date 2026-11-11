import crypto from 'node:crypto'
import { executeQuery, executeTransaction } from '../config/database.js'
import { readPagination } from '../utils/pagination.js'

const validId = (value) => typeof value === 'string' && /^[1-9]\d{0,19}$/.test(value)
const invalid = (res, msg = 'Dữ liệu không hợp lệ.', code = 'VALIDATION_ERROR') =>
  res.status(400).json({ success: false, message: msg, error: { code } })

function isTableMissingError(err) {
  return err?.original?.code === 'ER_NO_SUCH_TABLE' ||
         err?.code === 'ER_NO_SUCH_TABLE' ||
         String(err?.message || '').includes("doesn't exist")
}

/**
 * Lấy thông tin tài khoản ngân hàng của Shop
 */
export async function getSellerBankAccount(req, res, next) {
  try {
    const { shopId } = req.query
    if (!validId(shopId)) return invalid(res, 'Mã gian hàng không hợp lệ.')

    const rows = await executeQuery(
      `SELECT id, shop_id, bank_name, bank_code, account_number, account_holder, branch, is_verified, created_at, updated_at
       FROM seller_bank_accounts
       WHERE shop_id = ? LIMIT 1`,
      [shopId],
    )

    if (!rows.length) {
      return res.status(200).json({
        success: true,
        data: null,
      })
    }

    const acc = rows[0]
    return res.status(200).json({
      success: true,
      data: {
        id: String(acc.id),
        shopId: String(acc.shop_id),
        bankName: acc.bank_name,
        bankCode: acc.bank_code,
        accountNumber: acc.account_number,
        maskedAccountNumber: acc.account_number.length > 4 ? `******${acc.account_number.slice(-4)}` : acc.account_number,
        accountHolder: acc.account_holder,
        branch: acc.branch,
        isVerified: Boolean(acc.is_verified),
        createdAt: acc.created_at,
        updatedAt: acc.updated_at,
      },
    })
  } catch (err) {
    if (isTableMissingError(err)) return res.status(503).json({ success: false, message: 'Dữ liệu chưa sẵn sàng.', error: { code: 'DATA_STORAGE_UNAVAILABLE' } })
    return next(err)
  }
}

/**
 * Tạo hoặc cập nhật thông tin tài khoản ngân hàng của Shop
 */
export async function saveSellerBankAccount(req, res, next) {
  try {
    const { shopId, bankName, bankCode, accountNumber, accountHolder, branch } = req.body || {}

    if (
      !validId(String(shopId || '')) ||
      typeof bankName !== 'string' || !bankName.trim() || bankName.trim().length > 100 ||
      typeof bankCode !== 'string' || !bankCode.trim() || bankCode.trim().length > 20 ||
      typeof accountNumber !== 'string' || !/^\d{6,30}$/.test(accountNumber.trim()) ||
      typeof accountHolder !== 'string' || !accountHolder.trim() || accountHolder.trim().length > 150 ||
      (branch != null && (typeof branch !== 'string' || branch.trim().length > 150))
    ) {
      return invalid(res, 'Thông tin tài khoản ngân hàng không hợp lệ. Số tài khoản phải gồm 6-30 chữ số.')
    }

    const cleanBankName = bankName.trim()
    const cleanBankCode = bankCode.trim().toUpperCase()
    const cleanAccNumber = accountNumber.trim()
    const cleanAccHolder = accountHolder.trim().toUpperCase()
    const cleanBranch = typeof branch === 'string' ? branch.trim() : null

    // Kiểm tra xem shop có tồn tại không
    const shops = await executeQuery('SELECT id FROM shops WHERE id = ? LIMIT 1', [shopId])
    if (!shops.length) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy gian hàng tương ứng.',
        error: { code: 'SHOP_NOT_FOUND' },
      })
    }

    await executeQuery(
      `INSERT INTO seller_bank_accounts (shop_id, bank_name, bank_code, account_number, account_holder, branch, is_verified)
       VALUES (?, ?, ?, ?, ?, ?, 1)
       ON DUPLICATE KEY UPDATE
         bank_name = VALUES(bank_name),
         bank_code = VALUES(bank_code),
         account_number = VALUES(account_number),
         account_holder = VALUES(account_holder),
         branch = VALUES(branch),
         is_verified = 1,
         updated_at = UTC_TIMESTAMP(3)`,
      [shopId, cleanBankName, cleanBankCode, cleanAccNumber, cleanAccHolder, cleanBranch],
    )

    return res.status(200).json({
      success: true,
      message: 'Cập nhật tài khoản ngân hàng nhận tiền thành công.',
      data: {
        shopId: String(shopId),
        bankName: cleanBankName,
        bankCode: cleanBankCode,
        maskedAccountNumber: `******${cleanAccNumber.slice(-4)}`,
        accountHolder: cleanAccHolder,
        branch: cleanBranch,
        isVerified: true,
      },
    })
  } catch (err) {
    if (isTableMissingError(err)) return res.status(503).json({ success: false, message: 'Dữ liệu chưa sẵn sàng.', error: { code: 'DATA_STORAGE_UNAVAILABLE' } })
    return next(err)
  }
}

/**
 * Tính toán số dư ví doanh thu và Escrow cho Shop:
 * - availableBalance: Tổng tiền đơn hoàn tất (> 7 ngày hoặc completed) trừ các khoản đã yêu cầu rút
 * - pendingEscrowBalance: Tiền đơn đang giữ theo chính sách 7 ngày hoặc đơn đang vận chuyển
 * - processingPayoutAmount: Tiền các lệnh rút đang chờ xử lý
 * - totalPaidOut: Tổng tiền các lệnh rút đã hoàn tất
 */
export async function getSellerEscrowBalance(req, res, next) {
  try {
    const { shopId } = req.query
    if (!validId(shopId)) return invalid(res, 'Mã gian hàng không hợp lệ.')

    // 1. Tổng tiền các đơn hàng đã đủ điều kiện chuyển thành số dư khả dụng:
    // Trạng thái 'completed' HOẶC ('delivered' VÀ delivered_at <= 7 ngày trước)
    // VÀ không có yêu cầu trả hàng ở trạng thái 'requested', 'approved', 'disputed'
    const completedRows = await executeQuery(
      `SELECT COALESCE(SUM(so.total_amount), 0) AS completed_gross
       FROM shop_orders so
       WHERE so.shop_id = ?
         AND (
           so.status = 'completed'
           OR (so.status = 'delivered' AND so.delivered_at IS NOT NULL AND so.delivered_at <= DATE_SUB(NOW(), INTERVAL 7 DAY))
         )
         AND NOT EXISTS (
           SELECT 1 FROM order_returns ret
           WHERE ret.shop_order_id = so.id AND ret.status IN ('requested', 'approved', 'disputed')
         )`,
      [shopId],
    )
    const completedGross = Number(completedRows[0]?.completed_gross || 0)

    // 2. Trừ đi các đơn đã hoàn tiền (order_returns completed)
    const refundRows = await executeQuery(
      `SELECT COALESCE(SUM(refund_amount), 0) AS total_refunded
       FROM order_returns
       WHERE shop_id = ? AND status = 'completed'`,
      [shopId],
    )
    const totalRefunded = Number(refundRows[0]?.total_refunded || 0)

    // 3. Tổng các khoản rút tiền không bị từ chối ('pending', 'approved', 'processing', 'completed')
    const payoutRows = await executeQuery(
      `SELECT
         COALESCE(SUM(CASE WHEN status IN ('pending', 'approved', 'processing') THEN amount ELSE 0 END), 0) AS processing_amount,
         COALESCE(SUM(CASE WHEN status = 'completed' THEN amount ELSE 0 END), 0) AS completed_amount
       FROM seller_payout_requests
       WHERE shop_id = ? AND status != 'rejected'`,
      [shopId],
    )
    const processingAmount = Number(payoutRows[0]?.processing_amount || 0)
    const totalPaidOut = Number(payoutRows[0]?.completed_amount || 0)

    const availableBalance = Math.max(0, completedGross - totalRefunded - processingAmount - totalPaidOut)

    // 4. Số dư đang giữ trong Escrow (Đơn đã giao nhưng trong vòng 7 ngày khiếu nại, hoặc đơn đang giao)
    const pendingRows = await executeQuery(
      `SELECT COALESCE(SUM(so.total_amount), 0) AS pending_escrow
       FROM shop_orders so
       WHERE so.shop_id = ?
         AND (
           (so.status = 'delivered' AND (so.delivered_at IS NULL OR so.delivered_at > DATE_SUB(NOW(), INTERVAL 7 DAY)))
           OR so.status IN ('confirmed', 'shipping')
           OR EXISTS (
             SELECT 1 FROM order_returns ret
             WHERE ret.shop_order_id = so.id AND ret.status IN ('requested', 'approved', 'disputed')
           )
         )`,
      [shopId],
    )
    const pendingEscrowBalance = Number(pendingRows[0]?.pending_escrow || 0)

    // 5. Kiểm tra thông tin ngân hàng liên kết
    const bankRows = await executeQuery(
      'SELECT id, bank_name, bank_code, account_number, account_holder FROM seller_bank_accounts WHERE shop_id = ? LIMIT 1',
      [shopId],
    )

    const bankAccount = bankRows.length ? {
      id: String(bankRows[0].id),
      bankName: bankRows[0].bank_name,
      bankCode: bankRows[0].bank_code,
      maskedAccountNumber: `******${bankRows[0].account_number.slice(-4)}`,
      accountHolder: bankRows[0].account_holder,
    } : null

    return res.status(200).json({
      success: true,
      data: {
        shopId: String(shopId),
        balance: {
          available: availableBalance,
          pendingEscrow: pendingEscrowBalance,
          withdrawing: processingAmount,
          totalPaidOut,
        },
        hasLinkedBank: Boolean(bankAccount),
        bankAccount,
      },
    })
  } catch (err) {
    if (isTableMissingError(err)) return res.status(503).json({ success: false, message: 'Dữ liệu chưa sẵn sàng.', error: { code: 'DATA_STORAGE_UNAVAILABLE' } })
    return next(err)
  }
}

/**
 * Seller tạo yêu cầu rút tiền về tài khoản ngân hàng
 */
export async function createSellerPayoutRequest(req, res, next) {
  try {
    const { shopId, amount } = req.body || {}
    if (!validId(String(shopId || '')) || !Number.isSafeInteger(amount) || amount < 50000) {
      return invalid(res, 'Số tiền rút tối thiểu là 50.000 VNĐ.')
    }

    try {
      const result = await executeTransaction(async (query) => {
        // 1. Kiểm tra tài khoản ngân hàng liên kết
        const bankRows = await query(
          'SELECT id, bank_name, account_number, account_holder FROM seller_bank_accounts WHERE shop_id = ? LIMIT 1',
          [shopId],
        )
        if (!bankRows.length) {
          return { error: 'NO_BANK_ACCOUNT' }
        }
        const bankAccount = bankRows[0]

        // 2. Tính số dư khả dụng ngay trong transaction có khóa FOR UPDATE
        const completedRows = await query(
          `SELECT COALESCE(SUM(so.total_amount), 0) AS completed_gross
           FROM shop_orders so
           WHERE so.shop_id = ?
             AND (
               so.status = 'completed'
               OR (so.status = 'delivered' AND so.delivered_at IS NOT NULL AND so.delivered_at <= DATE_SUB(NOW(), INTERVAL 7 DAY))
             )
             AND NOT EXISTS (
               SELECT 1 FROM order_returns ret
               WHERE ret.shop_order_id = so.id AND ret.status IN ('requested', 'approved', 'disputed')
             ) FOR UPDATE`,
          [shopId],
        )
        const completedGross = Number(completedRows[0]?.completed_gross || 0)

        const refundRows = await query(
          `SELECT COALESCE(SUM(refund_amount), 0) AS total_refunded
           FROM order_returns
           WHERE shop_id = ? AND status = 'completed' FOR UPDATE`,
          [shopId],
        )
        const totalRefunded = Number(refundRows[0]?.total_refunded || 0)

        const payoutRows = await query(
          `SELECT COALESCE(SUM(amount), 0) AS total_payouts
           FROM seller_payout_requests
           WHERE shop_id = ? AND status != 'rejected' FOR UPDATE`,
          [shopId],
        )
        const totalPayouts = Number(payoutRows[0]?.total_payouts || 0)

        const available = completedGross - totalRefunded - totalPayouts

        if (amount > available) {
          return { error: 'INSUFFICIENT_BALANCE', available }
        }

        const payoutCode = `PO-${Date.now()}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`
        const fee = 0
        const netAmount = amount - fee

        const insertRes = await query(
          `INSERT INTO seller_payout_requests (payout_code, shop_id, bank_account_id, amount, fee, net_amount, status)
           VALUES (?, ?, ?, ?, ?, ?, 'pending')`,
          [payoutCode, shopId, bankAccount.id, amount, fee, netAmount],
        )

        return {
          id: insertRes.insertId || insertRes,
          payoutCode,
          amount,
          netAmount,
          bankAccount: {
            bankName: bankAccount.bank_name,
            accountNumber: `******${bankAccount.account_number.slice(-4)}`,
            accountHolder: bankAccount.account_holder,
          },
        }
      })

      if (result.error === 'NO_BANK_ACCOUNT') {
        return res.status(400).json({
          success: false,
          message: 'Vui lòng liên kết tài khoản ngân hàng trước khi tạo lệnh rút tiền.',
          error: { code: 'NO_BANK_ACCOUNT' },
        })
      }

      if (result.error === 'INSUFFICIENT_BALANCE') {
        return res.status(400).json({
          success: false,
          message: `Số dư khả dụng không đủ để rút (Số dư hiện tại: ${result.available.toLocaleString('vi-VN')} VNĐ).`,
          error: { code: 'INSUFFICIENT_BALANCE', available: result.available },
        })
      }

      return res.status(201).json({
        success: true,
        message: 'Tạo lệnh rút tiền thành công. Yêu cầu sẽ được xử lý trong ngày làm việc.',
        data: {
          id: String(result.id),
          payoutCode: result.payoutCode,
          amount: result.amount,
          netAmount: result.netAmount,
          status: 'pending',
          bankAccount: result.bankAccount,
        },
      })
    } catch (err) {
      if (isTableMissingError(err)) return res.status(503).json({ success: false, message: 'Dữ liệu chưa sẵn sàng.', error: { code: 'DATA_STORAGE_UNAVAILABLE' } })
      throw err
    }
  } catch (err) {
    return next(err)
  }
}

/**
 * Lấy lịch sử rút tiền của một Shop
 */
export async function listSellerPayoutHistory(req, res, next) {
  try {
    const { shopId } = req.query
    const page = readPagination(req.query)
    if (!validId(shopId) || !page) return invalid(res, 'Tham số không hợp lệ.')
    const { limit, offset } = page

    const rows = await executeQuery(
      `SELECT pr.*, ba.bank_name, ba.account_number, ba.account_holder
       FROM seller_payout_requests pr
       JOIN seller_bank_accounts ba ON ba.id = pr.bank_account_id
       WHERE pr.shop_id = ?
       ORDER BY pr.id DESC
       LIMIT ? OFFSET ?`,
      [shopId, Number(limit), Number(offset)],
    )

    return res.status(200).json({
      success: true,
      data: rows.map((r) => ({
        id: String(r.id),
        payoutCode: r.payout_code,
        amount: Number(r.amount),
        fee: Number(r.fee),
        netAmount: Number(r.net_amount),
        status: r.status,
        rejectionReason: r.rejection_reason,
        transactionReference: r.transaction_reference,
        adminNote: r.admin_note,
        bankName: r.bank_name,
        maskedAccountNumber: `******${r.account_number.slice(-4)}`,
        accountHolder: r.account_holder,
        processedAt: r.processed_at,
        createdAt: r.created_at,
      })),
    })
  } catch (err) {
    if (isTableMissingError(err)) return res.status(503).json({ success: false, message: 'Dữ liệu chưa sẵn sàng.', error: { code: 'DATA_STORAGE_UNAVAILABLE' } })
    return next(err)
  }
}

/**
 * Admin tra cứu danh sách lệnh rút tiền toàn sàn
 */
export async function listAdminPayouts(req, res, next) {
  try {
    const { status, shopId } = req.query
    const page = readPagination(req.query)
    if (!page || (status && !['pending', 'approved', 'processing', 'completed', 'rejected'].includes(status)) ||
        (shopId && !validId(shopId))) {
      return invalid(res, 'Bộ lọc không hợp lệ.')
    }
    const { limit, offset } = page

    const params = []
    let whereSql = '1=1'
    if (status) {
      whereSql += ' AND pr.status = ?'
      params.push(status)
    }
    if (shopId) {
      whereSql += ' AND pr.shop_id = ?'
      params.push(shopId)
    }
    params.push(Number(limit), Number(offset))

    const rows = await executeQuery(
      `SELECT pr.*, s.name AS shop_name, u.full_name AS owner_name, u.phone AS owner_phone,
              ba.bank_name, ba.bank_code, ba.account_number, ba.account_holder, ba.branch
       FROM seller_payout_requests pr
       JOIN shops s ON s.id = pr.shop_id
       JOIN users u ON u.id = s.owner_id
       JOIN seller_bank_accounts ba ON ba.id = pr.bank_account_id
       WHERE ${whereSql}
       ORDER BY (CASE WHEN pr.status = 'pending' THEN 1 WHEN pr.status = 'processing' THEN 2 ELSE 3 END), pr.id DESC
       LIMIT ? OFFSET ?`,
      params,
    )

    return res.status(200).json({
      success: true,
      data: rows.map((r) => ({
        id: String(r.id),
        payoutCode: r.payout_code,
        shopId: String(r.shop_id),
        shopName: r.shop_name,
        ownerName: r.owner_name,
        ownerPhone: r.owner_phone,
        amount: Number(r.amount),
        fee: Number(r.fee),
        netAmount: Number(r.net_amount),
        status: r.status,
        rejectionReason: r.rejection_reason,
        transactionReference: r.transaction_reference,
        adminNote: r.admin_note,
        bankInfo: {
          bankName: r.bank_name,
          bankCode: r.bank_code,
          accountNumber: r.account_number,
          accountHolder: r.account_holder,
          branch: r.branch,
        },
        processedAt: r.processed_at,
        createdAt: r.created_at,
      })),
    })
  } catch (err) {
    if (isTableMissingError(err)) return res.status(503).json({ success: false, message: 'Dữ liệu chưa sẵn sàng.', error: { code: 'DATA_STORAGE_UNAVAILABLE' } })
    return next(err)
  }
}

/**
 * Admin duyệt / hoàn tất / từ chối lệnh rút tiền
 */
export async function updateAdminPayoutStatus(req, res, next) {
  try {
    const payoutId = req.params.id
    const { status, transactionReference, rejectionReason, adminNote } = req.body || {}

    if (
      !validId(payoutId) ||
      !['approved', 'processing', 'completed', 'rejected'].includes(status) ||
      (status === 'rejected' && (!rejectionReason || typeof rejectionReason !== 'string' || !rejectionReason.trim()))
    ) {
      return invalid(res, 'Trạng thái hoặc lý do từ chối không hợp lệ.')
    }

    const cleanRef = typeof transactionReference === 'string' ? transactionReference.trim() : null
    const cleanReason = typeof rejectionReason === 'string' ? rejectionReason.trim() : null
    const cleanNote = typeof adminNote === 'string' ? adminNote.trim() : null

    try {
      const result = await executeTransaction(async (query) => {
        const rows = await query(
          `SELECT pr.*, s.owner_id
           FROM seller_payout_requests pr
           JOIN shops s ON s.id = pr.shop_id
           WHERE pr.id = ? FOR UPDATE`,
          [payoutId],
        )
        if (!rows.length) return { error: 'NOT_FOUND' }
        const pr = rows[0]

        if (['completed', 'rejected'].includes(pr.status)) {
          return { error: 'ALREADY_FINALIZED' }
        }

        await query(
          `UPDATE seller_payout_requests
           SET status = ?,
               transaction_reference = COALESCE(?, transaction_reference),
               rejection_reason = ?,
               admin_note = ?,
               processed_at = ${status === 'completed' || status === 'rejected' ? 'UTC_TIMESTAMP(3)' : 'processed_at'},
               updated_at = UTC_TIMESTAMP(3)
           WHERE id = ?`,
          [status, cleanRef, cleanReason, cleanNote, payoutId],
        )

        return {
          success: true,
          ownerId: String(pr.owner_id),
          payoutCode: pr.payout_code,
          amount: Number(pr.amount),
        }
      })

      if (result.error === 'NOT_FOUND') return res.status(404).json({ success: false, message: 'Không tìm thấy lệnh chi trả.', error: { code: 'PAYOUT_NOT_FOUND' } })
      if (result.error === 'ALREADY_FINALIZED') return res.status(400).json({ success: false, message: 'Lệnh chi trả này đã hoàn tất hoặc đã bị từ chối từ trước.', error: { code: 'ALREADY_FINALIZED' } })

      return res.status(200).json({
        success: true,
        message: status === 'completed' ? 'Xác nhận hoàn tất chi trả thành công.' : 'Cập nhật trạng thái lệnh chi trả thành công.',
        data: {
          id: String(payoutId),
          status,
          transactionReference: cleanRef,
          rejectionReason: cleanReason,
          ownerId: result.ownerId,
          payoutCode: result.payoutCode,
          amount: result.amount,
        },
      })
    } catch (err) {
      if (isTableMissingError(err)) return res.status(503).json({ success: false, message: 'Dữ liệu chưa sẵn sàng.', error: { code: 'DATA_STORAGE_UNAVAILABLE' } })
      throw err
    }
  } catch (err) {
    return next(err)
  }
}
