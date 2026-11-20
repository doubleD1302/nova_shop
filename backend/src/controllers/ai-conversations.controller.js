import {
  DataApiClientError,
  deleteAiConversation,
  getAiConversationMessages,
  listAiConversations,
} from '../clients/data.client.js'

const ID_PATTERN = /^[1-9]\d{0,19}$/

const validationError = (res, message) =>
  res.status(400).json({ success: false, message, error: { code: 'VALIDATION_ERROR' } })

// Số nguyên trong khoảng cho phép; query vắng thì dùng giá trị mặc định, sai thì trả null.
function readInteger(value, fallback, min, max) {
  if (value === undefined) return fallback
  if (typeof value !== 'string' || !/^\d{1,9}$/.test(value)) return null
  const number = Number(value)
  return number >= min && number <= max ? number : null
}

const badResponse = () => new DataApiClientError(502, 'DATA_API_BAD_RESPONSE', 'Phản hồi từ dịch vụ dữ liệu nội bộ không đúng quy chuẩn.')

/**
 * Danh sách cuộc trò chuyện Nova AI của tài khoản đang đăng nhập
 * GET /api/v1/ai/conversations?limit=&offset=
 */
export async function listConversations(req, res, next) {
  try {
    const limit = readInteger(req.query.limit, 20, 1, 50)
    const offset = readInteger(req.query.offset, 0, 0, 100000)
    if (limit === null || offset === null) return validationError(res, 'Phân trang không hợp lệ.')

    const data = await listAiConversations(req.user.id, { limit, offset })
    if (!Array.isArray(data?.conversations) || !Number.isSafeInteger(data.total)) throw badResponse()
    return res.status(200).json({
      success: true,
      data: { conversations: data.conversations, pagination: { limit, offset, total: data.total, hasMore: offset + data.conversations.length < data.total } },
    })
  } catch (err) {
    return next(err)
  }
}

/**
 * Tin nhắn của một cuộc trò chuyện, cũ → mới. Dùng `beforeId` (id tin cũ nhất đang có) để tải thêm tin cũ hơn.
 * GET /api/v1/ai/conversations/:id/messages?limit=&beforeId=
 */
export async function getConversationMessages(req, res, next) {
  try {
    const { id } = req.params
    const { beforeId } = req.query
    const limit = readInteger(req.query.limit, 50, 1, 100)
    if (!ID_PATTERN.test(id) || limit === null || (beforeId !== undefined && !(typeof beforeId === 'string' && ID_PATTERN.test(beforeId)))) {
      return validationError(res, 'Tham số không hợp lệ.')
    }

    const data = await getAiConversationMessages(req.user.id, id, { limit, beforeId: beforeId || null })
    if (!data?.conversation || !Array.isArray(data.messages) || typeof data.hasMore !== 'boolean') throw badResponse()
    return res.status(200).json({ success: true, data })
  } catch (err) {
    return next(err)
  }
}

/**
 * Xóa một cuộc trò chuyện cùng toàn bộ tin nhắn của nó
 * DELETE /api/v1/ai/conversations/:id
 */
export async function removeConversation(req, res, next) {
  try {
    const { id } = req.params
    if (!ID_PATTERN.test(id)) return validationError(res, 'Mã cuộc trò chuyện không hợp lệ.')
    await deleteAiConversation(req.user.id, id)
    return res.status(200).json({ success: true, message: 'Đã xóa cuộc trò chuyện.', data: { deleted: true } })
  } catch (err) {
    return next(err)
  }
}
