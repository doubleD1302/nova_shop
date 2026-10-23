import { Router } from 'express'
import { chatWithAi } from '../controllers/ai.controller.js'
import { optionalAuthenticate } from '../middlewares/auth.middleware.js'

const aiRouter = Router()

/**
 * POST /api/v1/ai/chat
 * Trợ lý mua sắm và tư vấn thông minh Nova AI Copilot
 * Hỗ trợ cả khách vãng lai và thành viên đã đăng nhập (cá nhân hóa đơn hàng)
 */
aiRouter.post('/chat', optionalAuthenticate, chatWithAi)

export default aiRouter
export { aiRouter }
