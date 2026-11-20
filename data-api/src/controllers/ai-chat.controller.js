import { executeQuery, executeTransaction } from '../config/database.js'
import { readPagination } from '../utils/pagination.js'

// Lịch sử trò chuyện Nova AI của tài khoản đã đăng nhập. Backend xác thực người dùng rồi gửi userId;
// mọi truy vấn đều ràng buộc user_id nên không đọc hoặc xóa được cuộc trò chuyện của người khác.

const MAX_TITLE_LENGTH = 120
const MAX_USER_CONTENT = 4000
const MAX_ASSISTANT_CONTENT = 8000
const MAX_METADATA_BYTES = 16384
const MAX_CONVERSATIONS_PER_USER = 50
const MAX_MESSAGES_PER_CONVERSATION = 300
const MAX_MESSAGES_PER_REQUEST = 4

const validId = (value) =>
  (typeof value === 'string' || (typeof value === 'number' && Number.isSafeInteger(value))) &&
  /^[1-9]\d{0,19}$/.test(String(value))

const responseError = (res, status, code, message) =>
  res.status(status).json({ success: false, message, error: { code } })

const notFound = (res) => responseError(res, 404, 'CONVERSATION_NOT_FOUND', 'Không tìm thấy cuộc trò chuyện.')

// MySQL trả Date, SQLite fallback trả chuỗi "YYYY-MM-DD HH:MM:SS" theo UTC.
function serializeDate(value) {
  if (value instanceof Date) return value.toISOString()
  const text = String(value || '')
  return /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/.test(text) ? `${text.replace(' ', 'T')}Z` : text
}

function parseMetadata(value) {
  if (value === null || value === undefined) return null
  if (typeof value !== 'string') return value
  try {
    return JSON.parse(value)
  } catch {
    return null
  }
}

function toConversation(row) {
  return {
    id: String(row.id),
    title: row.title,
    messageCount: Number(row.message_count),
    lastMessageAt: serializeDate(row.last_message_at),
    createdAt: serializeDate(row.created_at),
  }
}

function toMessage(row) {
  return {
    id: String(row.id),
    role: row.role,
    content: row.content,
    intent: row.intent || null,
    metadata: parseMetadata(row.metadata),
    createdAt: serializeDate(row.created_at),
  }
}

function cleanTitle(value) {
  if (typeof value !== 'string') return null
  const title = Array.from(value.replace(/\s+/g, ' ').trim()).slice(0, MAX_TITLE_LENGTH).join('')
  return title || null
}

// Trả danh sách tin nhắn đã kiểm tra hoặc null nếu có phần tử sai.
function readMessages(value) {
  if (!Array.isArray(value) || value.length < 1 || value.length > MAX_MESSAGES_PER_REQUEST) return null
  const messages = []
  for (const item of value) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return null
    const { role, content, intent = null, metadata = null } = item
    if (role !== 'user' && role !== 'assistant') return null
    const maxLength = role === 'user' ? MAX_USER_CONTENT : MAX_ASSISTANT_CONTENT
    if (typeof content !== 'string' || !content.trim() || content.length > maxLength) return null
    if (intent !== null && (typeof intent !== 'string' || intent.length > 50)) return null
    if (metadata !== null && (typeof metadata !== 'object' || Array.isArray(metadata))) return null
    const metadataJson = metadata === null ? null : JSON.stringify(metadata)
    if (metadataJson !== null && Buffer.byteLength(metadataJson, 'utf8') > MAX_METADATA_BYTES) return null
    messages.push({ role, content, intent, metadataJson })
  }
  return messages
}

/**
 * GET /internal/v1/ai/conversations?userId=&limit=&offset=
 * Danh sách cuộc trò chuyện của tài khoản, mới nhất trước.
 */
export async function listAiConversations(req, res, next) {
  try {
    const { userId } = req.query
    if (!validId(userId)) return responseError(res, 400, 'VALIDATION_ERROR', 'Mã người dùng không hợp lệ.')
    const page = readPagination(req.query, { defaultLimit: 20, maxLimit: 50 })
    if (!page) return responseError(res, 400, 'VALIDATION_ERROR', 'Phân trang không hợp lệ.')

    const [rows, countRows] = await Promise.all([
      executeQuery(
        `SELECT id, title, message_count, last_message_at, created_at
         FROM ai_conversations WHERE user_id = ?
         ORDER BY last_message_at DESC, id DESC LIMIT ? OFFSET ?`,
        [userId, page.limit, page.offset],
      ),
      executeQuery('SELECT COUNT(*) AS total FROM ai_conversations WHERE user_id = ?', [userId]),
    ])
    return res.status(200).json({
      success: true,
      data: {
        conversations: rows.map(toConversation),
        total: Number(countRows[0]?.total || 0),
        limit: page.limit,
        offset: page.offset,
      },
    })
  } catch (err) {
    return next(err)
  }
}

/**
 * POST /internal/v1/ai/conversations  { userId, title }
 * Tạo cuộc trò chuyện mới; chỉ giữ MAX_CONVERSATIONS_PER_USER cuộc gần nhất cho mỗi tài khoản.
 */
export async function createAiConversation(req, res, next) {
  try {
    const { userId, title } = req.body || {}
    const cleaned = cleanTitle(title)
    if (!validId(userId) || !cleaned) return responseError(res, 400, 'VALIDATION_ERROR', 'Thông tin cuộc trò chuyện không hợp lệ.')

    const conversation = await executeTransaction(async (query) => {
      const inserted = await query('INSERT INTO ai_conversations (user_id, title) VALUES (?, ?)', [String(userId), cleaned])
      const id = String(inserted.insertId)
      const old = await query(
        'SELECT id FROM ai_conversations WHERE user_id = ? ORDER BY last_message_at DESC, id DESC LIMIT 1000 OFFSET ?',
        [String(userId), MAX_CONVERSATIONS_PER_USER],
      )
      if (old.length) {
        const marks = old.map(() => '?').join(',')
        const oldIds = old.map((row) => String(row.id))
        await query(`DELETE FROM ai_messages WHERE conversation_id IN (${marks})`, oldIds)
        await query(`DELETE FROM ai_conversations WHERE id IN (${marks})`, oldIds)
      }
      const rows = await query(
        'SELECT id, title, message_count, last_message_at, created_at FROM ai_conversations WHERE id = ?',
        [id],
      )
      return rows[0]
    })
    return res.status(201).json({ success: true, data: { conversation: toConversation(conversation) } })
  } catch (err) {
    return next(err)
  }
}

/**
 * GET /internal/v1/ai/conversations/:id/messages?userId=&limit=&beforeId=
 * Trả tối đa `limit` tin gần nhất theo thứ tự cũ → mới. `beforeId` để tải các tin cũ hơn.
 */
export async function getAiMessages(req, res, next) {
  try {
    const { userId, beforeId } = req.query
    const { id } = req.params
    if (!validId(userId) || !validId(id) || (beforeId !== undefined && !validId(beforeId))) {
      return responseError(res, 400, 'VALIDATION_ERROR', 'Tham số không hợp lệ.')
    }
    const page = readPagination(req.query, { defaultLimit: 50, maxLimit: 100 })
    if (!page) return responseError(res, 400, 'VALIDATION_ERROR', 'Phân trang không hợp lệ.')

    const conversations = await executeQuery(
      'SELECT id, title, message_count, last_message_at, created_at FROM ai_conversations WHERE id = ? AND user_id = ?',
      [id, userId],
    )
    if (!conversations.length) return notFound(res)

    const rows = await executeQuery(
      `SELECT id, role, content, intent, metadata, created_at FROM ai_messages
       WHERE conversation_id = ? ${beforeId ? 'AND id < ?' : ''}
       ORDER BY id DESC LIMIT ?`,
      [id, ...(beforeId ? [beforeId] : []), page.limit + 1],
    )
    const hasMore = rows.length > page.limit
    const messages = rows.slice(0, page.limit).reverse().map(toMessage)
    return res.status(200).json({
      success: true,
      data: { conversation: toConversation(conversations[0]), messages, hasMore },
    })
  } catch (err) {
    return next(err)
  }
}

/**
 * POST /internal/v1/ai/conversations/:id/messages  { userId, messages: [{ role, content, intent?, metadata? }] }
 * Lưu một lượt hỏi - đáp trong cùng transaction để không bị lưu thiếu một nửa.
 */
export async function appendAiMessages(req, res, next) {
  try {
    const { userId } = req.body || {}
    const { id } = req.params
    const messages = readMessages(req.body?.messages)
    if (!validId(userId) || !validId(id) || !messages) {
      return responseError(res, 400, 'VALIDATION_ERROR', 'Tin nhắn không hợp lệ.')
    }

    const result = await executeTransaction(async (query) => {
      const found = await query(
        'SELECT id, message_count FROM ai_conversations WHERE id = ? AND user_id = ? FOR UPDATE',
        [id, String(userId)],
      )
      if (!found.length) return { error: 'NOT_FOUND' }
      if (Number(found[0].message_count) + messages.length > MAX_MESSAGES_PER_CONVERSATION) return { error: 'FULL' }

      const saved = []
      for (const message of messages) {
        const inserted = await query(
          'INSERT INTO ai_messages (conversation_id, role, content, intent, metadata) VALUES (?, ?, ?, ?, ?)',
          [id, message.role, message.content, message.intent, message.metadataJson],
        )
        saved.push(String(inserted.insertId))
      }
      await query(
        `UPDATE ai_conversations
         SET message_count = message_count + ?, last_message_at = UTC_TIMESTAMP(3), updated_at = UTC_TIMESTAMP(3)
         WHERE id = ?`,
        [messages.length, id],
      )
      const rows = await query(
        'SELECT id, title, message_count, last_message_at, created_at FROM ai_conversations WHERE id = ?',
        [id],
      )
      return { conversation: toConversation(rows[0]), messageIds: saved }
    })

    if (result.error === 'NOT_FOUND') return notFound(res)
    if (result.error === 'FULL') {
      return responseError(res, 409, 'CONVERSATION_FULL', 'Cuộc trò chuyện đã đầy. Hãy bắt đầu cuộc trò chuyện mới.')
    }
    return res.status(201).json({ success: true, data: result })
  } catch (err) {
    return next(err)
  }
}

/**
 * DELETE /internal/v1/ai/conversations/:id?userId=
 */
export async function deleteAiConversation(req, res, next) {
  try {
    const { userId } = req.query
    const { id } = req.params
    if (!validId(userId) || !validId(id)) return responseError(res, 400, 'VALIDATION_ERROR', 'Tham số không hợp lệ.')

    const deleted = await executeTransaction(async (query) => {
      const found = await query('SELECT id FROM ai_conversations WHERE id = ? AND user_id = ?', [id, userId])
      if (!found.length) return false
      await query('DELETE FROM ai_messages WHERE conversation_id = ?', [id])
      await query('DELETE FROM ai_conversations WHERE id = ? AND user_id = ?', [id, userId])
      return true
    })
    if (!deleted) return notFound(res)
    return res.status(200).json({ success: true, data: { deleted: true } })
  } catch (err) {
    return next(err)
  }
}
