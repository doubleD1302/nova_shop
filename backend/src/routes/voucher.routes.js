import { Router } from 'express'
import { getVouchers, getVoucherDetail } from '../controllers/voucher.controller.js'

const voucherRouter = Router()

// GET /api/v1/vouchers - Danh sách mã giảm giá công khai trên sàn
voucherRouter.get('/', getVouchers)

// GET /api/v1/vouchers/:code - Tra cứu chi tiết một mã giảm giá
voucherRouter.get('/:code', getVoucherDetail)

export default voucherRouter
export { voucherRouter }
