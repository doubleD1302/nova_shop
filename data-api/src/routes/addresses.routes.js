import { Router } from 'express'
import { listAddresses, saveAddress, deleteAddress } from '../controllers/addresses.controller.js'
const router = Router()
router.get('/users/:userId/addresses', listAddresses)
router.post('/users/:userId/addresses', saveAddress)
router.put('/users/:userId/addresses/:addressId', saveAddress)
router.delete('/users/:userId/addresses/:addressId', deleteAddress)
export default router
