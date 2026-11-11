import { callDataApi } from '../clients/data.client.js'
import { broadcastToUser, isUserOnline } from '../services/chat-ws.service.js'
import { notifyUser } from '../services/notification.service.js'

const validShopId = (value) => (typeof value === 'string' || typeof value === 'number' && Number.isSafeInteger(value)) && /^[1-9]\d{0,19}$/.test(String(value))
const validAttachments = (value) => value == null || (Array.isArray(value) && value.length <= 10 && Buffer.byteLength(JSON.stringify(value), 'utf8') <= 65535)

/**
 * Lấy danh sách các cuộc trò chuyện của người dùng hiện tại
 */
export async function listConversations(req, res, next) {
  try {
    const params = new URLSearchParams({
      userId: String(req.user.id),
      role: req.user.role || 'buyer',
    })
    const result = await callDataApi(`/internal/v1/chat/conversations?${params}`)
    return res.status(200).json({ success: true, data: result })
  } catch (err) {
    return next(err)
  }
}

/**
 * Bắt đầu hoặc mở cuộc hội thoại giữa người mua và gian hàng
 */
export async function getOrCreateConversation(req, res, next) {
  try {
    const { shopId } = req.body || {}

    if (!validShopId(shopId)) {
      return res.status(400).json({
        success: false,
        message: 'Mã gian hàng không hợp lệ.',
        error: { code: 'VALIDATION_ERROR' },
      })
    }

    const result = await callDataApi('/internal/v1/chat/conversations', {
      method: 'POST',
      body: {
        buyerId: req.user.id,
        shopId: String(shopId),
      },
    })

    return res.status(200).json({
      success: true,
      message: 'Mở cuộc trò chuyện thành công.',
      data: result,
    })
  } catch (err) {
    return next(err)
  }
}

/**
 * Đọc danh sách tin nhắn trong một cuộc hội thoại
 */
export async function getConversationMessages(req, res, next) {
  try {
    const conversationId = req.params.id
    const params = new URLSearchParams({
      userId: String(req.user.id),
      role: req.user.role || 'buyer',
    })
    for (const key of ['limit', 'offset']) {
      if (req.query[key] !== undefined && req.query[key] !== '') {
        params.set(key, String(req.query[key]))
      }
    }

    const result = await callDataApi(
      `/internal/v1/chat/conversations/${encodeURIComponent(conversationId)}/messages?${params}`,
    )

    return res.status(200).json({ success: true, data: result })
  } catch (err) {
    return next(err)
  }
}

/**
 * Gửi tin nhắn mới trong cuộc trò chuyện
 */
export async function sendConversationMessage(req, res, next) {
  try {
    const conversationId = req.params.id
    const { message, attachments } = req.body || {}

    if (typeof message !== 'string' || !message.trim() || message.trim().length > 4000 || !validAttachments(attachments)) {
      return res.status(400).json({
        success: false,
        message: 'Nội dung tin nhắn không được để trống.',
        error: { code: 'VALIDATION_ERROR' },
      })
    }

    const result = await callDataApi(
      `/internal/v1/chat/conversations/${encodeURIComponent(conversationId)}/messages`,
      {
        method: 'POST',
        body: {
          senderId: req.user.id,
          senderRole: req.user.role === 'seller' ? 'seller' : 'buyer',
          message: message.trim(),
          attachments: Array.isArray(attachments) ? attachments : [],
        },
      },
    )

    // Nếu người nhận đang kết nối WebSocket thì phát trực tiếp tin nhắn mới, nếu offline thì gửi thông báo đẩy
    if (result && result.recipientId) {
      if (isUserOnline(result.recipientId)) {
        broadcastToUser(result.recipientId, {
          type: 'new_message',
          conversationId: String(conversationId),
          message: result,
        })
      } else {
        const senderTitle = req.user.role === 'seller' ? 'Gian hàng' : 'Khách hàng'
        const shortContent = message.trim().length > 80 ? message.trim().slice(0, 77) + '...' : message.trim()
        notifyUser({
          userId: result.recipientId,
          title: `Tin nhắn mới từ ${senderTitle}`,
          content: shortContent,
          type: 'chat',
          link: `/chat?conversationId=${conversationId}`,
          metadata: { conversationId: String(conversationId), senderId: req.user.id },
        }).catch(() => {})
      }
    }

    return res.status(201).json({
      success: true,
      message: 'Gửi tin nhắn thành công.',
      data: result,
    })
  } catch (err) {
    return next(err)
  }
}
