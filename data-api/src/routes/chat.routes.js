import { Router } from 'express'
import {
  listConversations,
  getOrCreateConversation,
  getConversationMessages,
  sendConversationMessage,
} from '../controllers/chat.controller.js'

const router = Router()

// Danh sách cuộc trò chuyện và bắt đầu hội thoại
router.get('/chat/conversations', listConversations)
router.post('/chat/conversations', getOrCreateConversation)

// Chi tiết tin nhắn và gửi tin nhắn
router.get('/chat/conversations/:id/messages', getConversationMessages)
router.post('/chat/conversations/:id/messages', sendConversationMessage)

export default router
