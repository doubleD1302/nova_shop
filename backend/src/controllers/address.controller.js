import {
  fetchUserAddresses,
  createUserAddress,
  setDefaultUserAddress,
  deleteUserAddress,
  DataApiClientError,
} from '../clients/data.client.js'

/**
 * GET /api/v1/addresses
 * Lấy danh sách địa chỉ nhận hàng của người dùng hiện tại (Bearer JWT).
 */
export async function getAddresses(req, res, next) {
  try {
    const userId = req.user?.id
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Yêu cầu bắt buộc phải có token xác thực.',
        error: { code: 'AUTH_REQUIRED' },
      })
    }

    const addresses = await fetchUserAddresses(userId)

    return res.status(200).json({
      success: true,
      message: 'Lấy danh sách địa chỉ nhận hàng thành công.',
      data: addresses,
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

/**
 * POST /api/v1/addresses
 * Thêm địa chỉ nhận hàng mới cho người dùng hiện tại.
 */
export async function createAddress(req, res, next) {
  try {
    const userId = req.user?.id
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Yêu cầu bắt buộc phải có token xác thực.',
        error: { code: 'AUTH_REQUIRED' },
      })
    }

    const { recipientName, phone, province, district, ward, detail, isDefault } = req.body || {}

    if (!recipientName || typeof recipientName !== 'string' || recipientName.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Họ tên người nhận không được để trống.',
        error: { code: 'VALIDATION_ERROR', field: 'recipientName' },
      })
    }

    if (!phone || typeof phone !== 'string' || phone.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Số điện thoại người nhận không được để trống.',
        error: { code: 'VALIDATION_ERROR', field: 'phone' },
      })
    }

    if (!province || typeof province !== 'string' || province.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Tỉnh/Thành phố không được để trống.',
        error: { code: 'VALIDATION_ERROR', field: 'province' },
      })
    }

    if (!detail || typeof detail !== 'string' || detail.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Địa chỉ chi tiết không được để trống.',
        error: { code: 'VALIDATION_ERROR', field: 'detail' },
      })
    }

    const newAddress = await createUserAddress(userId, {
      recipientName: recipientName.trim(),
      phone: phone.trim(),
      province: province.trim(),
      district: district ? String(district).trim() : null,
      ward: ward ? String(ward).trim() : null,
      detail: detail.trim(),
      isDefault: Boolean(isDefault),
    })

    return res.status(201).json({
      success: true,
      message: 'Thêm địa chỉ nhận hàng thành công.',
      data: newAddress,
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

/**
 * PATCH /api/v1/addresses/:addressId/default
 * Đặt địa chỉ làm mặc định.
 */
export async function setDefaultAddress(req, res, next) {
  try {
    const userId = req.user?.id
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Yêu cầu bắt buộc phải có token xác thực.',
        error: { code: 'AUTH_REQUIRED' },
      })
    }

    const { addressId } = req.params
    if (!addressId || !/^\d+$/.test(String(addressId))) {
      return res.status(400).json({
        success: false,
        message: 'Mã địa chỉ không hợp lệ.',
        error: { code: 'INVALID_ADDRESS_ID' },
      })
    }

    const result = await setDefaultUserAddress(userId, addressId)

    return res.status(200).json({
      success: true,
      message: 'Đặt địa chỉ mặc định thành công.',
      data: result,
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

/**
 * DELETE /api/v1/addresses/:addressId
 * Xóa địa chỉ nhận hàng.
 */
export async function deleteAddress(req, res, next) {
  try {
    const userId = req.user?.id
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Yêu cầu bắt buộc phải có token xác thực.',
        error: { code: 'AUTH_REQUIRED' },
      })
    }

    const { addressId } = req.params
    if (!addressId || !/^\d+$/.test(String(addressId))) {
      return res.status(400).json({
        success: false,
        message: 'Mã địa chỉ không hợp lệ.',
        error: { code: 'INVALID_ADDRESS_ID' },
      })
    }

    const result = await deleteUserAddress(userId, addressId)

    return res.status(200).json({
      success: true,
      message: 'Xóa địa chỉ nhận hàng thành công.',
      data: result,
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
