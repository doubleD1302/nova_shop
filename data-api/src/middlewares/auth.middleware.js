import crypto from 'node:crypto'
import { env } from '../config/env.js'

/**
 * Middleware xác thực dịch vụ nội bộ cho toàn bộ các route /internal/v1/*
 * Yêu cầu header 'x-service-key' phải khớp chính xác với DATA_API_KEY.
 * Nếu thiếu hoặc không hợp lệ:
 * - Trả mã HTTP 401 Unauthorized.
 * - Envelope lỗi: { success: false, message: '...', error: { code: 'SERVICE_UNAUTHORIZED' } }.
 * - Tuyệt đối không trả chi tiết khóa nhận được hoặc khóa mong đợi.
 */
export function serviceAuthMiddleware(req, res, next) {
  const serviceKey = req.headers['x-service-key']

  if (!serviceKey || typeof serviceKey !== 'string') {
    return res.status(401).json({
      success: false,
      message: 'Yêu cầu bị từ chối: thiếu khóa xác thực dịch vụ nội bộ (x-service-key).',
      error: {
        code: 'SERVICE_UNAUTHORIZED',
      },
    })
  }

  const expectedKeyBuffer = Buffer.from(env.dataApiKey)
  const actualKeyBuffer = Buffer.from(serviceKey.trim())

  // Kiểm tra độ dài và so sánh an toàn chống tấn công timing
  const isMatch =
    expectedKeyBuffer.length === actualKeyBuffer.length &&
    crypto.timingSafeEqual(expectedKeyBuffer, actualKeyBuffer)

  if (!isMatch) {
    return res.status(401).json({
      success: false,
      message: 'Yêu cầu bị từ chối: khóa xác thực dịch vụ nội bộ không hợp lệ.',
      error: {
        code: 'SERVICE_UNAUTHORIZED',
      },
    })
  }

  next()
}
