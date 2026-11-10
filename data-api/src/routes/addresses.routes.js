import { Router } from 'express'
import { listAddresses, saveAddress, deleteAddress, setDefaultAddress } from '../controllers/addresses.controller.js'
const router = Router()
router.get('/users/:userId/addresses', listAddresses)
router.post('/users/:userId/addresses', saveAddress)
router.put('/users/:userId/addresses/:addressId', saveAddress)
router.patch('/users/:userId/addresses/:addressId/default', setDefaultAddress)
router.delete('/users/:userId/addresses/:addressId', deleteAddress)
export default router
