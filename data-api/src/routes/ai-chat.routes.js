import { Router } from 'express'
import {
  listAiConversations,
  createAiConversation,
  getAiMessages,
  appendAiMessages,
  deleteAiConversation,
} from '../controllers/ai-chat.controller.js'

const router = Router()

// Lịch sử trò chuyện Nova AI
router.get('/ai/conversations', listAiConversations)
router.post('/ai/conversations', createAiConversation)
router.get('/ai/conversations/:id/messages', getAiMessages)
router.post('/ai/conversations/:id/messages', appendAiMessages)
router.delete('/ai/conversations/:id', deleteAiConversation)

export default router
