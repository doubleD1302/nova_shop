import { callDataApi } from '../clients/data.client.js'
import { notifyUser } from '../services/notification.service.js'

function getShopId(req, res) {
  const shopId = req.user?.shopId
  if (!shopId) {
    res.status(403).json({
      success: false,
      message: 'Tài khoản của bạn chưa liên kết với gian hàng nào.',
      error: { code: 'SHOP_NOT_FOUND' },
    })
    return null
  }
  return String(shopId)
}

/**
 * Seller xem thông tin tài khoản ngân hàng liên kết
 * Endpoint: GET /api/v1/seller/payout/bank-account
 */
export async function getSellerBankAccount(req, res, next) {
  try {
    const shopId = getShopId(req, res)
    if (!shopId) return

    const data = await callDataApi(`/internal/v1/seller/payout/bank-account?shopId=${encodeURIComponent(shopId)}`)
    return res.status(200).json({ success: true, data })
  } catch (err) {
    return next(err)
  }
}

/**
 * Seller tạo hoặc cập nhật tài khoản ngân hàng nhận tiền
 * Endpoint: POST /api/v1/seller/payout/bank-account
 */
export async function saveSellerBankAccount(req, res, next) {
  try {
    const shopId = getShopId(req, res)
    if (!shopId) return

    const { bankName, bankCode, accountNumber, accountHolder, branch } = req.body || {}
    if (
      typeof bankName !== 'string' || !bankName.trim() ||
      typeof bankCode !== 'string' || !bankCode.trim() ||
      typeof accountNumber !== 'string' || !/^\d{6,30}$/.test(accountNumber.trim()) ||
      typeof accountHolder !== 'string' || !accountHolder.trim()
    ) {
      return res.status(400).json({
        success: false,
        message: 'Thông tin tài khoản ngân hàng không hợp lệ (số tài khoản 6-30 số, tên chủ tài khoản, ngân hàng là bắt buộc).',
        error: { code: 'VALIDATION_ERROR' },
      })
    }

    const data = await callDataApi('/internal/v1/seller/payout/bank-account', {
      method: 'POST',
      body: {
        shopId,
        bankName: bankName.trim(),
        bankCode: bankCode.trim().toUpperCase(),
        accountNumber: accountNumber.trim(),
        accountHolder: accountHolder.trim().toUpperCase(),
        branch: typeof branch === 'string' ? branch.trim() : null,
      },
    })

    return res.status(200).json({ success: true, message: 'Cập nhật tài khoản ngân hàng thành công.', data })
  } catch (err) {
    return next(err)
  }
}

/**
 * Seller xem số dư ví doanh thu và Escrow
 * Endpoint: GET /api/v1/seller/payout/balance
 */
export async function getSellerEscrowBalance(req, res, next) {
  try {
    const shopId = getShopId(req, res)
    if (!shopId) return

    const data = await callDataApi(`/internal/v1/seller/payout/balance?shopId=${encodeURIComponent(shopId)}`)
    return res.status(200).json({ success: true, data })
  } catch (err) {
    return next(err)
  }
}

/**
 * Seller tạo lệnh rút tiền về tài khoản ngân hàng
 * Endpoint: POST /api/v1/seller/payout/request
 */
export async function createSellerPayoutRequest(req, res, next) {
  try {
    const shopId = getShopId(req, res)
    if (!shopId) return

    const { amount } = req.body || {}
    if (!Number.isSafeInteger(amount) || amount < 50000) {
      return res.status(400).json({
        success: false,
        message: 'Số tiền yêu cầu rút tối thiểu là 50.000 VNĐ.',
        error: { code: 'VALIDATION_ERROR' },
      })
    }

    const data = await callDataApi('/internal/v1/seller/payout/request', {
      method: 'POST',
      body: { shopId, amount },
    })

    // Gửi thông báo xác nhận đã tạo lệnh rút tiền
    notifyUser({
      userId: req.user.id,
      title: 'Tạo lệnh rút tiền thành công',
      content: `Lệnh rút tiền ${data.payoutCode} số tiền ${amount.toLocaleString('vi-VN')} VNĐ đang được hệ thống xử lý.`,
      type: 'system',
      link: '/nguoi-ban/vi-tien',
      metadata: { payoutCode: data.payoutCode, amount },
    }).catch(() => {})

    return res.status(201).json({ success: true, message: 'Tạo lệnh rút tiền thành công.', data })
  } catch (err) {
    return next(err)
  }
}

/**
 * Seller xem lịch sử rút tiền
 * Endpoint: GET /api/v1/seller/payout/history
 */
export async function listSellerPayoutHistory(req, res, next) {
  try {
    const shopId = getShopId(req, res)
    if (!shopId) return

    const params = new URLSearchParams({ shopId })
    for (const key of ['limit', 'offset']) {
      if (req.query[key] !== undefined && req.query[key] !== '') {
        params.set(key, String(req.query[key]))
      }
    }

    const data = await callDataApi(`/internal/v1/seller/payout/history?${params}`)
    return res.status(200).json({ success: true, data })
  } catch (err) {
    return next(err)
  }
}

/**
 * Admin xem danh sách toàn bộ lệnh rút tiền
 * Endpoint: GET /api/v1/admin/payouts
 */
export async function listAdminPayouts(req, res, next) {
  try {
    const params = new URLSearchParams()
    for (const key of ['status', 'shopId', 'limit', 'offset']) {
      if (req.query[key] !== undefined && req.query[key] !== '') {
        params.set(key, String(req.query[key]))
      }
    }

    const data = await callDataApi(`/internal/v1/admin/payouts?${params}`)
    return res.status(200).json({ success: true, data })
  } catch (err) {
    return next(err)
  }
}

/**
 * Admin cập nhật trạng thái lệnh rút tiền (duyệt/hoàn tất/từ chối)
 * Endpoint: PATCH /api/v1/admin/payouts/:id
 */
export async function updateAdminPayoutStatus(req, res, next) {
  try {
    const payoutId = req.params.id
    const { status, transactionReference, rejectionReason, adminNote } = req.body || {}

    if (!['approved', 'processing', 'completed', 'rejected'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Trạng thái xử lý không hợp lệ (approved, processing, completed, rejected).',
        error: { code: 'VALIDATION_ERROR' },
      })
    }

    const data = await callDataApi(`/internal/v1/admin/payouts/${encodeURIComponent(payoutId)}`, {
      method: 'PATCH',
      body: {
        adminId: req.user.id,
        status,
        transactionReference,
        rejectionReason,
        adminNote,
      },
    })

    // Thông báo cho người bán về kết quả lệnh rút tiền
    if (data?.ownerId) {
      const isCompleted = status === 'completed'
      const isRejected = status === 'rejected'
      notifyUser({
        userId: data.ownerId,
        title: isCompleted ? 'Rút tiền thành công' : isRejected ? 'Lệnh rút tiền bị từ chối' : 'Cập nhật lệnh rút tiền',
        content: isCompleted
          ? `Lệnh rút tiền ${data.payoutCode} số tiền ${Number(data.amount).toLocaleString('vi-VN')} VNĐ đã được chuyển khoản thành công.${transactionReference ? ' Mã GD: ' + transactionReference : ''}`
          : isRejected
            ? `Lệnh rút tiền ${data.payoutCode} đã bị từ chối. Lý do: ${rejectionReason || 'Thông tin ngân hàng không khớp.'}. Số tiền đã được hoàn về số dư khả dụng.`
            : `Lệnh rút tiền ${data.payoutCode} đang được xử lý chuyển khoản.`,
        type: 'system',
        link: '/nguoi-ban/vi-tien',
        metadata: { payoutId, status },
      }).catch(() => {})
    }

    return res.status(200).json({
      success: true,
      message: status === 'completed' ? 'Xác nhận hoàn tất chi trả thành công.' : 'Cập nhật lệnh rút tiền thành công.',
      data,
    })
  } catch (err) {
    return next(err)
  }
}
