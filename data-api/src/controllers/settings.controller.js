import { executeQuery, executeTransaction } from '../config/database.js'

/**
 * Đọc toàn bộ cấu hình hệ thống runtime
 */
export async function getSettings(req, res, next) {
  try {
    const rows = await executeQuery(
      'SELECT setting_key, setting_value, description, updated_at FROM system_settings'
    )

    const settingsMap = {}
    for (const r of rows) {
      settingsMap[r.setting_key] = r.setting_value
    }

    const data = {
      maintenanceMode: settingsMap.maintenance_mode === 'true',
      commissionRate: Number(settingsMap.commission_rate || 5.0),
      platformFee: Number(settingsMap.platform_fee || 1000),
      raw: rows,
    }

    return res.status(200).json({ success: true, data })
  } catch (err) {
    return next(err)
  }
}

/**
 * Đọc cấu hình công khai (dành cho client/app kiểm tra bảo trì, phí cơ bản)
 */
export async function getPublicSettings(req, res, next) {
  try {
    const rows = await executeQuery(
      "SELECT setting_key, setting_value FROM system_settings WHERE setting_key IN ('maintenance_mode', 'platform_fee')"
    )

    const map = {}
    for (const r of rows) {
      map[r.setting_key] = r.setting_value
    }

    return res.status(200).json({
      success: true,
      data: {
        maintenanceMode: map.maintenance_mode === 'true',
        platformFee: Number(map.platform_fee || 1000),
      },
    })
  } catch (err) {
    return next(err)
  }
}

/**
 * Cập nhật cấu hình hệ thống runtime (dành cho Admin)
 */
export async function updateSettings(req, res, next) {
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
        message: 'Phí sàn phải là số nguyên dương hợp lệ (VND).',
        error: { code: 'VALIDATION_ERROR' },
      })
    }

    await executeTransaction(async (query) => {
      if (maintenanceMode !== undefined) {
        await query(
          'UPDATE system_settings SET setting_value = ? WHERE setting_key = ?',
          [String(maintenanceMode), 'maintenance_mode']
        )
      }
      if (commissionRate !== undefined) {
        await query(
          'UPDATE system_settings SET setting_value = ? WHERE setting_key = ?',
          [String(commissionRate), 'commission_rate']
        )
      }
      if (platformFee !== undefined) {
        await query(
          'UPDATE system_settings SET setting_value = ? WHERE setting_key = ?',
          [String(platformFee), 'platform_fee']
        )
      }
    })

    const updatedRows = await executeQuery(
      'SELECT setting_key, setting_value, description, updated_at FROM system_settings'
    )
    const settingsMap = {}
    for (const r of updatedRows) {
      settingsMap[r.setting_key] = r.setting_value
    }

    return res.status(200).json({
      success: true,
      message: 'Cập nhật cấu hình hệ thống thành công.',
      data: {
        maintenanceMode: settingsMap.maintenance_mode === 'true',
        commissionRate: Number(settingsMap.commission_rate),
        platformFee: Number(settingsMap.platform_fee),
      },
    })
  } catch (err) {
    return next(err)
  }
}
