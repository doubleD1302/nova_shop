import { WebSocketServer, WebSocket } from 'ws'
import { verifyAccessToken } from '../middlewares/auth.middleware.js'
import { callDataApi } from '../clients/data.client.js'
import { notifyUser } from './notification.service.js'

/**
 * Bản đồ lưu trữ các kết nối WebSocket đang hoạt động theo userId
 * Map<userId, Set<WebSocket>>
 */
const userSockets = new Map()

/**
 * Gửi dữ liệu JSON an toàn tới một kết nối WebSocket
 */
function sendJson(ws, data) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    try {
      ws.send(JSON.stringify(data))
    } catch (err) {
      console.error('[Chat WebSocket] Lỗi gửi dữ liệu socket:', err.message)
    }
  }
}

/**
 * Phát dữ liệu tới tất cả các kết nối của một người dùng cụ thể
 */
export function broadcastToUser(userId, payload) {
  if (!userId) return
  const sockets = userSockets.get(String(userId))
  if (sockets && sockets.size > 0) {
    for (const ws of sockets) {
      sendJson(ws, payload)
    }
  }
}

/**
 * Kiểm tra xem một người dùng có đang online trên WebSocket hay không
 */
export function isUserOnline(userId) {
  if (!userId) return false
  const sockets = userSockets.get(String(userId))
  return Boolean(sockets && sockets.size > 0)
}

/**
 * Xác thực thông tin người dùng từ kết nối WebSocket
 */
function authenticateConnection(req) {
  try {
    const host = req.headers.host || 'localhost'
    const url = new URL(req.url, `http://${host}`)
    let token = url.searchParams.get('token')

    if (!token && req.headers['sec-websocket-protocol']) {
      // Hỗ trợ truyền token qua subprotocol
      token = req.headers['sec-websocket-protocol'].split(',')[0].trim()
    }

    if (!token && req.headers.authorization) {
      const parts = req.headers.authorization.split(' ')
      if (parts.length === 2 && /^Bearer$/i.test(parts[0])) {
        token = parts[1]
      }
    }

    if (!token) return null

    const decoded = verifyAccessToken(token)
    if (!decoded || !decoded.sub) return null

    return {
      id: String(decoded.sub),
      role: decoded.role || 'buyer',
    }
  } catch (err) {
    return null
  }
}

/**
 * Khởi tạo WebSocket Server cho Live Chat gắn liền với HTTP Server
 */
export function initChatWebSocket(httpServer) {
  const wss = new WebSocketServer({
    noServer: true,
  })

  // Đón bắt nâng cấp giao thức HTTP -> WebSocket
  httpServer.on('upgrade', (req, socket, head) => {
    try {
      const host = req.headers.host || 'localhost'
      const url = new URL(req.url, `http://${host}`)

      // Chỉ lắng nghe trên đường dẫn /ws/chat hoặc /api/v1/chat/ws
      if (url.pathname !== '/ws/chat' && url.pathname !== '/api/v1/chat/ws') {
        socket.destroy()
        return
      }

      const user = authenticateConnection(req)
      if (!user) {
        socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n')
        socket.destroy()
        return
      }

      wss.handleUpgrade(req, socket, head, (ws) => {
        ws.user = user
        wss.emit('connection', ws, req)
      })
    } catch (err) {
      socket.destroy()
    }
  })

  wss.on('connection', (ws) => {
    const user = ws.user
    const userId = user.id

    // Đăng ký socket vào danh sách user
    if (!userSockets.has(userId)) {
      userSockets.set(userId, new Set())
    }
    userSockets.get(userId).add(ws)

    // Gửi thông báo kết nối thành công (Welcome ACK)
    sendJson(ws, {
      type: 'connected',
      message: 'Kết nối WebSocket Live Chat thành công.',
      user: { id: user.id, role: user.role, shopId: user.shopId },
    })

    // Xử lý các tin nhắn nhận được từ client
    ws.on('message', async (raw) => {
      try {
        const payload = JSON.parse(raw.toString())

        // 1. Heartbeat Ping / Pong
        if (payload.type === 'ping') {
          return sendJson(ws, { type: 'pong', timestamp: Date.now() })
        }

        // 2. Gửi tin nhắn trực tiếp trong cuộc hội thoại
        if (payload.type === 'send_message') {
          const { conversationId, message, attachments } = payload

          if (!conversationId || typeof message !== 'string' || !message.trim()) {
            return sendJson(ws, {
              type: 'error',
              code: 'VALIDATION_ERROR',
              message: 'Nội dung tin nhắn không được để trống.',
            })
          }

          try {
            // Lưu tin nhắn vào cơ sở dữ liệu qua Data API
            const result = await callDataApi(
              `/internal/v1/chat/conversations/${encodeURIComponent(conversationId)}/messages`,
              {
                method: 'POST',
                body: {
                  senderId: user.id,
                  senderRole: user.role === 'seller' ? 'seller' : 'buyer',
                  message: message.trim(),
                  attachments: Array.isArray(attachments) ? attachments : [],
                },
              }
            )

            // Gửi xác nhận gửi thành công (ACK) về cho người gửi
            sendJson(ws, {
              type: 'message_sent',
              conversationId: String(conversationId),
              message: result,
            })

            // Relay trực tiếp thời gian thực cho đối phương nếu đang online, hoặc bắn Push Notification nếu offline
            if (result.recipientId) {
              if (isUserOnline(result.recipientId)) {
                broadcastToUser(result.recipientId, {
                  type: 'new_message',
                  conversationId: String(conversationId),
                  message: result,
                })
              } else {
                // Người nhận offline / đóng app -> Bắn Push Notification & In-app Notification
                const senderTitle = user.role === 'seller' ? 'Gian hàng' : 'Khách hàng'
                const cleanMsg = typeof message === 'string' ? message.trim() : ''
                const shortContent = cleanMsg.length > 80 ? cleanMsg.slice(0, 77) + '...' : cleanMsg
                notifyUser({
                  userId: result.recipientId,
                  title: `Tin nhắn mới từ ${senderTitle}`,
                  content: shortContent,
                  type: 'chat',
                  link: `/chat?conversationId=${conversationId}`,
                  metadata: { conversationId: String(conversationId), senderId: user.id },
                }).catch(() => {})
              }
            }
          } catch (err) {
            sendJson(ws, {
              type: 'error',
              code: err.code || 'SEND_MESSAGE_FAILED',
              message: err.message || 'Không thể gửi tin nhắn.',
            })
          }
          return
        }

        // 3. Trạng thái đang nhập văn bản (Typing indicator)
        if (payload.type === 'typing') {
          const { conversationId, recipientId, isTyping } = payload
          if (recipientId) {
            broadcastToUser(recipientId, {
              type: 'typing',
              conversationId,
              senderId: user.id,
              isTyping: Boolean(isTyping),
            })
          }
          return
        }
      } catch (err) {
        sendJson(ws, {
          type: 'error',
          code: 'INVALID_JSON',
          message: 'Dữ liệu không đúng định dạng JSON.',
        })
      }
    })

    // Xử lý khi ngắt kết nối
    ws.on('close', () => {
      const set = userSockets.get(userId)
      if (set) {
        set.delete(ws)
        if (set.size === 0) {
          userSockets.delete(userId)
        }
      }
    })

    ws.on('error', () => {
      // Đảm bảo không làm sập server khi socket lỗi
    })
  })

  console.log('[ShopNova Backend] Cổng WebSocket Live Chat đã sẵn sàng tại /ws/chat')
  return wss
}
