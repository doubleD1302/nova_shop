import { Router } from 'express'
import {
  listConversations,
  getOrCreateConversation,
  getConversationMessages,
  sendConversationMessage,
} from '../controllers/chat.controller.js'
import { authenticate } from '../middlewares/auth.middleware.js'

const router = Router()

// Tất cả các thao tác chat đều yêu cầu người dùng đăng nhập
router.use(authenticate)

router.get('/conversations', listConversations)
router.post('/conversations', getOrCreateConversation)
router.get('/conversations/:id/messages', getConversationMessages)
router.post('/conversations/:id/messages', sendConversationMessage)

export default router
