import { callDataApi } from '../clients/data.client.js'

export async function listPublicVouchers(req, res, next) {
  try {
    const result = await callDataApi('/internal/v1/vouchers')
    return res.status(200).json({ success: true, data: result.data || result })
  } catch (err) {
    return next(err)
  }
}

export async function listWallet(req, res, next) {
  try {
    const page = req.query.page === undefined ? '1' : req.query.page
    if (typeof page !== 'string' || !/^[1-9]\d{0,3}$/.test(page)) {
      return res.status(400).json({ success: false, message: 'Trang không hợp lệ.', error: { code: 'VALIDATION_ERROR' } })
    }
    const data = await callDataApi(`/internal/v1/vouchers/wallet?userId=${encodeURIComponent(req.user.id)}&page=${page}`)
    return res.json({ success: true, data })
  } catch (err) { return next(err) }
}

export async function saveVoucher(req, res, next) {
  try {
    const code = req.body?.code
    if (typeof code !== 'string' || !/^[A-Za-z0-9_-]{1,32}$/.test(code.trim())) {
      return res.status(400).json({ success: false, message: 'Mã voucher không hợp lệ.', error: { code: 'VALIDATION_ERROR' } })
    }
    const data = await callDataApi('/internal/v1/vouchers/wallet', {
      method: 'POST', body: { userId: req.user.id, code: code.trim().toUpperCase() },
    })
    return res.status(200).json({ success: true, data })
  } catch (err) { return next(err) }
}

/**
 * Lấy danh sách voucher của gian hàng
 */
export async function listSellerVouchers(req, res, next) {
  try {
    const shopId = req.user?.shopId
    if (!shopId) {
      return res.status(403).json({
        success: false,
        message: 'Tài khoản của bạn chưa liên kết với gian hàng nào.',
        error: { code: 'SHOP_NOT_FOUND' },
      })
    }

    const data = await callDataApi(`/internal/v1/seller/vouchers?shopId=${encodeURIComponent(shopId)}`)
    return res.status(200).json({ success: true, data })
  } catch (err) {
    return next(err)
  }
}

/**
 * Tạo mã giảm giá mới cho gian hàng
 * Endpoint: POST /api/v1/seller/vouchers
 */
export async function createSellerVoucher(req, res, next) {
  try {
    const shopId = req.user?.shopId
    if (!shopId) {
      return res.status(403).json({
        success: false,
        message: 'Tài khoản của bạn chưa liên kết với gian hàng nào.',
        error: { code: 'SHOP_NOT_FOUND' },
      })
    }

    const {
      code,
      name,
      discountAmount,
      minSubtotal = 0,
      startsAt,
      endsAt,
      usageLimit = null,
      perUserLimit = 1,
    } = req.body || {}

    if (typeof code !== 'string' || !/^[A-Za-z0-9_-]{3,32}$/.test(code.trim())) {
      return res.status(400).json({
        success: false,
        message: 'Mã voucher phải từ 3 đến 32 ký tự chữ hoặc số.',
        error: { code: 'VALIDATION_ERROR' },
      })
    }

    if (typeof name !== 'string' || !name.trim() || name.trim().length > 120) {
      return res.status(400).json({
        success: false,
        message: 'Tên chương trình voucher không được để trống và tối đa 120 ký tự.',
        error: { code: 'VALIDATION_ERROR' },
      })
    }

    if (typeof discountAmount !== 'number' || isNaN(discountAmount) || discountAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Số tiền giảm giá phải lớn hơn 0 VND.',
        error: { code: 'VALIDATION_ERROR' },
      })
    }

    const data = await callDataApi('/internal/v1/seller/vouchers', {
      method: 'POST',
      body: {
        shopId: String(shopId),
        code: code.trim().toUpperCase(),
        name: name.trim(),
        discountAmount,
        minSubtotal: Number(minSubtotal || 0),
        startsAt,
        endsAt,
        usageLimit: usageLimit ? Number(usageLimit) : null,
        perUserLimit: perUserLimit ? Number(perUserLimit) : 1,
      },
    })

    return res.status(201).json({
      success: true,
      message: 'Tạo mã giảm giá cho gian hàng thành công.',
      data,
    })
  } catch (err) {
    return next(err)
  }
}

/**
 * Cập nhật trạng thái voucher (bật/tắt)
 */
export async function updateSellerVoucherStatus(req, res, next) {
  try {
    const shopId = req.user?.shopId
    const voucherId = req.params.id
    const { isActive } = req.body || {}

    if (!shopId) {
      return res.status(403).json({
        success: false,
        message: 'Tài khoản chưa liên kết gian hàng.',
        error: { code: 'SHOP_NOT_FOUND' },
      })
    }

    if (typeof isActive !== 'boolean') {
      return res.status(400).json({
        success: false,
        message: 'Trạng thái isActive phải là true hoặc false.',
        error: { code: 'VALIDATION_ERROR' },
      })
    }

    const data = await callDataApi(`/internal/v1/seller/vouchers/${encodeURIComponent(voucherId)}/status`, {
      method: 'PATCH',
      body: { shopId: String(shopId), isActive },
    })

    return res.status(200).json({ success: true, data })
  } catch (err) {
    return next(err)
  }
}

/**
 * Xóa voucher của shop
 */
export async function deleteSellerVoucher(req, res, next) {
  try {
    const shopId = req.user?.shopId
    const voucherId = req.params.id

    if (!shopId) {
      return res.status(403).json({
        success: false,
        message: 'Tài khoản chưa liên kết gian hàng.',
        error: { code: 'SHOP_NOT_FOUND' },
      })
    }

    const data = await callDataApi(
      `/internal/v1/seller/vouchers/${encodeURIComponent(voucherId)}?shopId=${encodeURIComponent(shopId)}`,
      { method: 'DELETE' }
    )

    return res.status(200).json({ success: true, data })
  } catch (err) {
    return next(err)
  }
}
