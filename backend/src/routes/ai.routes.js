import { Router } from 'express'
import { chatWithAi } from '../controllers/ai.controller.js'

const router = Router()

/**
 * Endpoint AI Chat thông minh cho Web và Mobile
 * POST /api/v1/ai/chat
 */
router.post('/chat', chatWithAi)

export default router
