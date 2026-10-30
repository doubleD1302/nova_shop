import { callDataApi } from '../clients/data.client.js'

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

    if (!/^[1-9]\d{0,19}$/.test(String(shopId || ''))) {
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

    if (typeof message !== 'string' || !message.trim()) {
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

    return res.status(201).json({
      success: true,
      message: 'Gửi tin nhắn thành công.',
      data: result,
    })
  } catch (err) {
    return next(err)
  }
}
