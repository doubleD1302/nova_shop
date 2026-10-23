import { Router } from 'express'
import { getVouchers, getVoucherByCode } from '../controllers/voucher.controller.js'

const voucherRouter = Router()

/**
 * Các route nội bộ quản lý mã giảm giá:
 * - GET /internal/v1/vouchers (kèm lọc query ?code=...)
 * - GET /internal/v1/vouchers/:code
 */
voucherRouter.get('/vouchers', getVouchers)
voucherRouter.get('/vouchers/:code', getVoucherByCode)

export { voucherRouter }
