import { authenticate } from '../middlewares/auth.middleware.js'
import { Router } from 'express'
import {
  chatWithAi,
  getAiBrainProfile,
  recordAiBrainFeedback,
  resetAiBrain,
} from '../controllers/ai.controller.js'

const router = Router()

/**
 * Endpoint AI Chat thông minh cho Web và Mobile
 * POST /api/v1/ai/chat
 */
router.post('/chat', (req, res, next) => req.headers.authorization ? authenticate(req, res, next) : next(), chatWithAi)

/**
 * Lấy dữ liệu trí nhớ & sở thích mà AI đã học về người dùng
 * GET /api/v1/ai/brain/profile
 */
router.get('/brain/profile', authenticate, getAiBrainProfile)

/**
 * Lưu phản hồi Thích / Không thích / Thêm giỏ để AI học hỏi
 * POST /api/v1/ai/brain/feedback
 */
router.post('/brain/feedback', authenticate, recordAiBrainFeedback)

/**
 * Làm mới / xóa ký ức của AI
 * DELETE /api/v1/ai/brain/reset
 */
router.delete('/brain/reset', authenticate, resetAiBrain)

export default router
