import { callDataApi } from '../clients/data.client.js'

/**
 * Lấy cấu hình hệ thống runtime (dành cho Admin)
 */
export async function getAdminSettings(req, res, next) {
  try {
    const data = await callDataApi('/internal/v1/admin/settings')
    return res.status(200).json({ success: true, data })
  } catch (err) {
    return next(err)
  }
}

/**
 * Cập nhật cấu hình hệ thống runtime (dành cho Admin)
 */
export async function updateAdminSettings(req, res, next) {
  try {
    const { maintenanceMode, commissionRate, platformFee } = req.body || {}

    if (maintenanceMode !== undefined && typeof maintenanceMode !== 'boolean') {
      return res.status(400).json({
        success: false,
        message: 'Chế độ bảo trì phải là giá trị boolean (true/false).',
        error: { code: 'VALIDATION_ERROR' },
      })
    }

    if (commissionRate !== undefined && (typeof commissionRate !== 'number' || isNaN(commissionRate) || commissionRate < 0 || commissionRate > 100)) {
      return res.status(400).json({
        success: false,
        message: 'Tỷ lệ hoa hồng phải là số từ 0% đến 100%.',
        error: { code: 'VALIDATION_ERROR' },
      })
    }

    if (platformFee !== undefined && (typeof platformFee !== 'number' || isNaN(platformFee) || platformFee < 0 || !Number.isSafeInteger(platformFee))) {
      return res.status(400).json({
        success: false,
        message: 'Phí sàn phải là số nguyên dương (VND).',
        error: { code: 'VALIDATION_ERROR' },
      })
    }

    const data = await callDataApi('/internal/v1/admin/settings', {
      method: 'PUT',
      body: { maintenanceMode, commissionRate, platformFee },
    })

    return res.status(200).json({
      success: true,
      message: 'Cập nhật cấu hình hệ thống thành công.',
      data,
    })
  } catch (err) {
    return next(err)
  }
}

/**
 * Lấy cấu hình công khai (dành cho client / app kiểm tra trạng thái bảo trì)
 */
export async function getPublicSystemConfig(req, res, next) {
  try {
    const data = await callDataApi('/internal/v1/system/settings')
    return res.status(200).json({ success: true, data })
  } catch (err) {
    return next(err)
  }
}
