import { Router } from 'express'
import { getSettings, getPublicSettings, updateSettings } from '../controllers/settings.controller.js'

const router = Router()

router.get('/admin/settings', getSettings)
router.put('/admin/settings', updateSettings)
router.get('/system/settings', getPublicSettings)

export default router
