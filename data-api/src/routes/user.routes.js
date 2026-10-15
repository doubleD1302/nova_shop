import { Router } from 'express'
import {
  updateProfile,
  getAddresses,
  createAddress,
  setDefaultAddress,
  deleteAddress,
} from '../controllers/user.controller.js'

const userRouter = Router()

/**
 * Các route nội bộ quản lý hồ sơ và địa chỉ (/internal/v1/users/*).
 * Toàn bộ router này đã được bảo vệ bởi middleware verifyServiceKey ở cấp ứng dụng.
 */
userRouter.put('/users/:userId/profile', updateProfile)
userRouter.get('/users/:userId/addresses', getAddresses)
userRouter.post('/users/:userId/addresses', createAddress)
userRouter.patch('/users/:userId/addresses/:addressId/default', setDefaultAddress)
userRouter.delete('/users/:userId/addresses/:addressId', deleteAddress)

export { userRouter }
