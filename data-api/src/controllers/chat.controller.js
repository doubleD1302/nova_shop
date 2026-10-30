import { executeQuery, executeTransaction } from '../config/database.js'

// Bộ nhớ đệm dự phòng nếu bảng chat chưa chạy migration
const memoryConversations = []
const memoryMessages = []
let memoryConvIdCounter = 1
let memoryMsgIdCounter = 1

function isTableMissingError(err) {
  return err?.original?.code === 'ER_NO_SUCH_TABLE' ||
         err?.code === 'ER_NO_SUCH_TABLE' ||
         String(err?.message || '').includes("doesn't exist")
}

/**
 * Lấy danh sách các cuộc hội thoại của tài khoản (dành cho Buyer hoặc Seller)
 */
export async function listConversations(req, res, next) {
  try {
    const { userId, role } = req.query
    if (!/^[1-9]\d{0,19}$/.test(String(userId || ''))) {
      return res.status(400).json({
        success: false,
        message: 'Thiếu thông tin người dùng hợp lệ.',
        error: { code: 'VALIDATION_ERROR' },
      })
    }

    let shopId = null
    if (role === 'seller') {
      const ownedShops = await executeQuery(
        `SELECT id FROM shops WHERE owner_id = ? LIMIT 1`,
        [userId],
      )
      if (ownedShops.length) {
        shopId = ownedShops[0].id
      }
    }

    try {
      let sql = ''
      let params = []

      if (role === 'seller' && shopId) {
        sql = `SELECT c.*, u.full_name AS buyer_name, u.avatar_url AS buyer_avatar,
                      s.name AS shop_name, s.logo_url AS shop_logo
               FROM chat_conversations c
               JOIN users u ON u.id = c.buyer_id
               JOIN shops s ON s.id = c.shop_id
               WHERE c.shop_id = ?
               ORDER BY COALESCE(c.last_message_at, c.created_at) DESC`
        params = [shopId]
      } else {
        sql = `SELECT c.*, u.full_name AS buyer_name, u.avatar_url AS buyer_avatar,
                      s.name AS shop_name, s.logo_url AS shop_logo
               FROM chat_conversations c
               JOIN users u ON u.id = c.buyer_id
               JOIN shops s ON s.id = c.shop_id
               WHERE c.buyer_id = ?
               ORDER BY COALESCE(c.last_message_at, c.created_at) DESC`
        params = [userId]
      }

      const rows = await executeQuery(sql, params)

      return res.status(200).json({
        success: true,
        data: rows.map((r) => ({
          id: String(r.id),
          buyerId: String(r.buyer_id),
          shopId: String(r.shop_id),
          buyerName: r.buyer_name,
          buyerAvatar: r.buyer_avatar,
          shopName: r.shop_name,
          shopLogo: r.shop_logo,
          lastMessage: r.last_message,
          lastMessageAt: r.last_message_at,
          unreadCount: role === 'seller' ? r.seller_unread_count : r.buyer_unread_count,
          createdAt: r.created_at,
          updatedAt: r.updated_at,
        })),
      })
    } catch (err) {
      if (!isTableMissingError(err)) throw err

      let filtered = []
      if (role === 'seller' && shopId) {
        filtered = memoryConversations.filter((c) => String(c.shopId) === String(shopId))
      } else {
        filtered = memoryConversations.filter((c) => String(c.buyerId) === String(userId))
      }

      return res.status(200).json({
        success: true,
        data: filtered.map((c) => ({
          ...c,
          unreadCount: role === 'seller' ? c.sellerUnreadCount : c.buyerUnreadCount,
        })),
      })
    }
  } catch (err) {
    return next(err)
  }
}

/**
 * Tìm hoặc tạo mới cuộc hội thoại giữa người mua và gian hàng
 */
export async function getOrCreateConversation(req, res, next) {
  try {
    const { buyerId, shopId } = req.body || {}

    if (
      !/^[1-9]\d{0,19}$/.test(String(buyerId || '')) ||
      !/^[1-9]\d{0,19}$/.test(String(shopId || ''))
    ) {
      return res.status(400).json({
        success: false,
        message: 'Thông tin người mua và gian hàng không hợp lệ.',
        error: { code: 'VALIDATION_ERROR' },
      })
    }

    // Kiểm tra gian hàng và người mua có tồn tại
    const [shopRows, userRows] = await Promise.all([
      executeQuery(`SELECT id, name, logo_url, owner_id FROM shops WHERE id = ? LIMIT 1`, [shopId]),
      executeQuery(`SELECT id, full_name, avatar_url FROM users WHERE id = ? LIMIT 1`, [buyerId]),
    ])

    if (!shopRows.length) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy gian hàng.',
        error: { code: 'SHOP_NOT_FOUND' },
      })
    }
    if (!userRows.length) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy tài khoản người mua.',
        error: { code: 'USER_NOT_FOUND' },
      })
    }

    const shop = shopRows[0]
    const user = userRows[0]

    // Không cho phép tự chat với shop của chính mình
    if (String(shop.owner_id) === String(buyerId)) {
      return res.status(400).json({
        success: false,
        message: 'Bạn không thể tự nhắn tin với gian hàng của chính mình.',
        error: { code: 'SELF_CHAT_NOT_ALLOWED' },
      })
    }

    try {
      let conv = null
      const existing = await executeQuery(
        `SELECT * FROM chat_conversations WHERE buyer_id = ? AND shop_id = ? LIMIT 1`,
        [buyerId, shopId],
      )

      if (existing.length) {
        conv = existing[0]
      } else {
        const insertRes = await executeQuery(
          `INSERT INTO chat_conversations (buyer_id, shop_id) VALUES (?, ?)`,
          [buyerId, shopId],
        )
        const id = insertRes.insertId || insertRes
        const created = await executeQuery(`SELECT * FROM chat_conversations WHERE id = ?`, [id])
        conv = created[0]
      }

      return res.status(200).json({
        success: true,
        data: {
          id: String(conv.id),
          buyerId: String(conv.buyer_id),
          shopId: String(conv.shop_id),
          buyerName: user.full_name,
          buyerAvatar: user.avatar_url,
          shopName: shop.name,
          shopLogo: shop.logo_url,
          lastMessage: conv.last_message,
          lastMessageAt: conv.last_message_at,
          buyerUnreadCount: conv.buyer_unread_count,
          sellerUnreadCount: conv.seller_unread_count,
          createdAt: conv.created_at,
        },
      })
    } catch (err) {
      if (!isTableMissingError(err)) throw err

      let conv = memoryConversations.find(
        (c) => String(c.buyerId) === String(buyerId) && String(c.shopId) === String(shopId),
      )
      if (!conv) {
        conv = {
          id: String(memoryConvIdCounter++),
          buyerId: String(buyerId),
          shopId: String(shopId),
          buyerName: user.full_name,
          buyerAvatar: user.avatar_url,
          shopName: shop.name,
          shopLogo: shop.logo_url,
          lastMessage: null,
          lastMessageAt: null,
          buyerUnreadCount: 0,
          sellerUnreadCount: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }
        memoryConversations.push(conv)
      }

      return res.status(200).json({ success: true, data: conv })
    }
  } catch (err) {
    return next(err)
  }
}

/**
 * Đọc danh sách tin nhắn trong một cuộc hội thoại và đánh dấu đã đọc
 */
export async function getConversationMessages(req, res, next) {
  try {
    const conversationId = req.params.id
    const { userId, role, limit = 50, offset = 0 } = req.query

    if (
      !/^[1-9]\d{0,19}$/.test(conversationId) ||
      !/^[1-9]\d{0,19}$/.test(String(userId || ''))
    ) {
      return res.status(400).json({
        success: false,
        message: 'Thông tin yêu cầu không hợp lệ.',
        error: { code: 'VALIDATION_ERROR' },
      })
    }

    try {
      // 1. Kiểm tra quyền truy cập hội thoại
      const convRows = await executeQuery(
        `SELECT c.*, s.owner_id AS shop_owner_id
         FROM chat_conversations c
         JOIN shops s ON s.id = c.shop_id
         WHERE c.id = ? LIMIT 1`,
        [conversationId],
      )

      if (!convRows.length) {
        return res.status(404).json({
          success: false,
          message: 'Không tìm thấy cuộc trò chuyện.',
          error: { code: 'CONVERSATION_NOT_FOUND' },
        })
      }

      const conv = convRows[0]
      const isBuyer = String(conv.buyer_id) === String(userId)
      const isSeller = String(conv.shop_owner_id) === String(userId)

      if (!isBuyer && !isSeller) {
        return res.status(403).json({
          success: false,
          message: 'Bạn không có quyền truy cập cuộc trò chuyện này.',
          error: { code: 'FORBIDDEN' },
        })
      }

      // 2. Đánh dấu đã đọc các tin nhắn gửi đến phía này
      const oppositeRole = isBuyer ? 'seller' : 'buyer'
      await executeQuery(
        `UPDATE chat_messages SET is_read = 1 WHERE conversation_id = ? AND sender_role = ? AND is_read = 0`,
        [conversationId, oppositeRole],
      )

      // 3. Reset unread count trên conversation
      if (isBuyer) {
        await executeQuery(`UPDATE chat_conversations SET buyer_unread_count = 0 WHERE id = ?`, [conversationId])
      } else {
        await executeQuery(`UPDATE chat_conversations SET seller_unread_count = 0 WHERE id = ?`, [conversationId])
      }

      // 4. Lấy danh sách tin nhắn
      const msgRows = await executeQuery(
        `SELECT m.*, u.full_name AS sender_name, u.avatar_url AS sender_avatar
         FROM chat_messages m
         JOIN users u ON u.id = m.sender_id
         WHERE m.conversation_id = ?
         ORDER BY m.id ASC
         LIMIT ? OFFSET ?`,
        [conversationId, Number(limit), Number(offset)],
      )

      return res.status(200).json({
        success: true,
        data: {
          conversationId: String(conversationId),
          messages: msgRows.map((m) => ({
            id: String(m.id),
            conversationId: String(m.conversation_id),
            senderId: String(m.sender_id),
            senderName: m.sender_name,
            senderAvatar: m.sender_avatar,
            senderRole: m.sender_role,
            message: m.message,
            attachments: typeof m.attachments === 'string' ? JSON.parse(m.attachments || '[]') : (m.attachments || []),
            isRead: Boolean(m.is_read),
            createdAt: m.created_at,
          })),
        },
      })
    } catch (err) {
      if (!isTableMissingError(err)) throw err

      const conv = memoryConversations.find((c) => String(c.id) === String(conversationId))
      if (!conv) {
        return res.status(404).json({
          success: false,
          message: 'Không tìm thấy cuộc trò chuyện.',
          error: { code: 'CONVERSATION_NOT_FOUND' },
        })
      }

      const msgs = memoryMessages.filter((m) => String(m.conversationId) === String(conversationId))
      msgs.forEach((m) => {
        if (String(m.senderId) !== String(userId)) m.isRead = true
      })
      if (role === 'seller') conv.sellerUnreadCount = 0
      else conv.buyerUnreadCount = 0

      return res.status(200).json({
        success: true,
        data: {
          conversationId: String(conversationId),
          messages: msgs,
        },
      })
    }
  } catch (err) {
    return next(err)
  }
}

/**
 * Gửi một tin nhắn mới trong cuộc trò chuyện
 */
export async function sendConversationMessage(req, res, next) {
  try {
    const conversationId = req.params.id
    const { senderId, senderRole, message, attachments } = req.body || {}

    if (
      !/^[1-9]\d{0,19}$/.test(conversationId) ||
      !/^[1-9]\d{0,19}$/.test(String(senderId || '')) ||
      !['buyer', 'seller'].includes(senderRole) ||
      typeof message !== 'string' ||
      !message.trim()
    ) {
      return res.status(400).json({
        success: false,
        message: 'Nội dung tin nhắn không hợp lệ.',
        error: { code: 'VALIDATION_ERROR' },
      })
    }

    const cleanMsg = message.trim().slice(0, 4000)
    const cleanAttachments = Array.isArray(attachments) ? JSON.stringify(attachments.slice(0, 10)) : null

    try {
      const result = await executeTransaction(async (query) => {
        // Kiểm tra cuộc trò chuyện
        const convRows = await query(
          `SELECT c.*, s.owner_id AS shop_owner_id
           FROM chat_conversations c
           JOIN shops s ON s.id = c.shop_id
           WHERE c.id = ? FOR UPDATE`,
          [conversationId],
        )

        if (!convRows.length) return { error: 'CONVERSATION_NOT_FOUND' }
        const conv = convRows[0]

        // Xác thực người gửi có thuộc hội thoại
        if (senderRole === 'buyer' && String(conv.buyer_id) !== String(senderId)) {
          return { error: 'FORBIDDEN' }
        }
        if (senderRole === 'seller' && String(conv.shop_owner_id) !== String(senderId)) {
          return { error: 'FORBIDDEN' }
        }

        // Lưu tin nhắn
        const insertRes = await query(
          `INSERT INTO chat_messages (conversation_id, sender_id, sender_role, message, attachments, is_read)
           VALUES (?, ?, ?, ?, ?, 0)`,
          [conversationId, senderId, senderRole, cleanMsg, cleanAttachments],
        )

        // Cập nhật conversation: last_message, tăng unread count của đối phương
        const now = new Date()
        if (senderRole === 'buyer') {
          await query(
            `UPDATE chat_conversations
             SET last_message = ?, last_message_at = ?, seller_unread_count = seller_unread_count + 1, updated_at = UTC_TIMESTAMP(3)
             WHERE id = ?`,
            [cleanMsg.slice(0, 500), now, conversationId],
          )
        } else {
          await query(
            `UPDATE chat_conversations
             SET last_message = ?, last_message_at = ?, buyer_unread_count = buyer_unread_count + 1, updated_at = UTC_TIMESTAMP(3)
             WHERE id = ?`,
            [cleanMsg.slice(0, 500), now, conversationId],
          )
        }

        return {
          id: String(insertRes.insertId || insertRes),
          conversationId: String(conversationId),
          senderId: String(senderId),
          senderRole,
          message: cleanMsg,
          attachments: cleanAttachments ? JSON.parse(cleanAttachments) : [],
          isRead: false,
          createdAt: now.toISOString(),
        }
      })

      if (result.error === 'CONVERSATION_NOT_FOUND') {
        return res.status(404).json({
          success: false,
          message: 'Không tìm thấy cuộc trò chuyện.',
          error: { code: 'CONVERSATION_NOT_FOUND' },
        })
      }
      if (result.error === 'FORBIDDEN') {
        return res.status(403).json({
          success: false,
          message: 'Bạn không có quyền gửi tin nhắn trong cuộc trò chuyện này.',
          error: { code: 'FORBIDDEN' },
        })
      }

      return res.status(201).json({
        success: true,
        message: 'Gửi tin nhắn thành công.',
        data: result,
      })
    } catch (err) {
      if (!isTableMissingError(err)) throw err

      const conv = memoryConversations.find((c) => String(c.id) === String(conversationId))
      if (!conv) {
        return res.status(404).json({
          success: false,
          message: 'Không tìm thấy cuộc trò chuyện.',
          error: { code: 'CONVERSATION_NOT_FOUND' },
        })
      }

      const newMsg = {
        id: String(memoryMsgIdCounter++),
        conversationId: String(conversationId),
        senderId: String(senderId),
        senderRole,
        message: cleanMsg,
        attachments: cleanAttachments ? JSON.parse(cleanAttachments) : [],
        isRead: false,
        createdAt: new Date().toISOString(),
      }
      memoryMessages.push(newMsg)

      conv.lastMessage = cleanMsg.slice(0, 500)
      conv.lastMessageAt = newMsg.createdAt
      if (senderRole === 'buyer') conv.sellerUnreadCount += 1
      else conv.buyerUnreadCount += 1

      return res.status(201).json({
        success: true,
        message: 'Gửi tin nhắn thành công.',
        data: newMsg,
      })
    }
  } catch (err) {
    return next(err)
  }
}
