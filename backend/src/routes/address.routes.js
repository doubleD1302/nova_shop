import { Router } from 'express'
import { authenticate } from '../middlewares/auth.middleware.js'
import {
  getAddresses,
  createAddress,
  setDefaultAddress,
  deleteAddress,
} from '../controllers/address.controller.js'

const addressRouter = Router()

/**
 * Các route quản lý sổ địa chỉ nhận hàng (/api/v1/addresses/*).
 * Toàn bộ router này được bảo vệ bởi middleware authenticate (Bearer JWT).
 */
addressRouter.use(authenticate)

addressRouter.get('/', getAddresses)
addressRouter.post('/', createAddress)
addressRouter.patch('/:addressId/default', setDefaultAddress)
addressRouter.delete('/:addressId', deleteAddress)

export { addressRouter }
