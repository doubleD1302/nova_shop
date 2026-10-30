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
router.post('/chat', chatWithAi)

/**
 * Lấy dữ liệu trí nhớ & sở thích mà AI đã học về người dùng
 * GET /api/v1/ai/brain/profile
 */
router.get('/brain/profile', getAiBrainProfile)

/**
 * Lưu phản hồi Thích / Không thích / Thêm giỏ để AI học hỏi
 * POST /api/v1/ai/brain/feedback
 */
router.post('/brain/feedback', recordAiBrainFeedback)

/**
 * Làm mới / xóa ký ức của AI
 * DELETE /api/v1/ai/brain/reset
 */
router.delete('/brain/reset', resetAiBrain)

export default router
