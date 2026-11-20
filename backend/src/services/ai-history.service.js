import {
  appendAiConversationMessages,
  createAiConversation,
  DataApiClientError,
  getAiConversationMessages,
  listAiConversations,
} from '../clients/data.client.js'

// Số tin gần nhất đưa vào ngữ cảnh cho Nova AI.
const CONTEXT_MESSAGES = 12
// Không gửi conversationId thì tiếp tục cuộc trò chuyện gần nhất nếu nó còn "nóng" trong khoảng này.
const REUSE_WINDOW_MS = 12 * 60 * 60 * 1000
// Khớp giới hạn của Data API; vượt thì bắt đầu cuộc trò chuyện mới.
const MAX_MESSAGES = 300
const MAX_METADATA_BYTES = 15000

const REDACTED_TEXT = 'Nội dung tra cứu quản trị không được lưu trong lịch sử.'

/**
 * Lấy ngữ cảnh hội thoại của tài khoản đã đăng nhập từ cơ sở dữ liệu.
 * - conversationId: tiếp tục đúng cuộc trò chuyện đó (404 nếu không phải của tài khoản).
 * - newConversation: bắt đầu cuộc mới, chưa tạo bản ghi cho tới khi có câu trả lời.
 * - Không có cả hai: tiếp tục cuộc gần nhất còn trong REUSE_WINDOW_MS.
 * Trả { conversationId, turns, productIds } với turns là { isUser, text } cũ → mới.
 */
export async function loadConversation(userId, { conversationId = null, newConversation = false } = {}) {
  if (newConversation) return { conversationId: null, turns: [], productIds: [] }

  let id = conversationId
  if (!id) {
    const latest = await listAiConversations(userId, { limit: 1 })
    const last = latest?.conversations?.[0]
    const isRecent = last && Date.now() - Date.parse(last.lastMessageAt) < REUSE_WINDOW_MS
    if (!isRecent || last.messageCount >= MAX_MESSAGES - 2) return { conversationId: null, turns: [], productIds: [] }
    id = last.id
  }

  const data = await getAiConversationMessages(userId, id, { limit: CONTEXT_MESSAGES })
  const messages = Array.isArray(data?.messages) ? data.messages : []
  const usable = messages.filter((message) => !message.metadata?.redacted)
  const lastWithProducts = [...usable].reverse().find((message) =>
    message.role === 'assistant' && Array.isArray(message.metadata?.products) && message.metadata.products.length > 0)
  return {
    conversationId: String(data.conversation.id),
    turns: usable.map((message) => ({ isUser: message.role === 'user', text: message.content })),
    productIds: (lastWithProducts?.metadata.products || []).map((product) => String(product.id)).slice(0, 3),
  }
}

function buildTitle(query) {
  return Array.from(String(query).replace(/\s+/g, ' ').trim()).slice(0, 60).join('') || 'Cuộc trò chuyện mới'
}

function buildAssistantMetadata({ products, suggestions, pagination }) {
  const metadata = {}
  if (Array.isArray(products) && products.length) metadata.products = products.slice(0, 15)
  if (Array.isArray(suggestions) && suggestions.length) metadata.suggestions = suggestions.slice(0, 6)
  if (pagination) metadata.pagination = pagination
  if (!Object.keys(metadata).length) return null
  return Buffer.byteLength(JSON.stringify(metadata), 'utf8') <= MAX_METADATA_BYTES ? metadata : null
}

/**
 * Lưu một lượt hỏi - đáp. Tạo cuộc trò chuyện nếu chưa có; nếu cuộc cũ đã đầy thì mở cuộc mới.
 * `sensitive` dùng cho tra cứu quản trị: dữ liệu tài khoản của người khác không được ghi lại.
 * Trả conversationId đã lưu.
 */
export async function saveTurn(userId, conversationId, { query, reply, intent, products, suggestions, pagination, sensitive = false }) {
  const messages = sensitive
    ? [
        { role: 'user', content: REDACTED_TEXT, metadata: { redacted: true } },
        { role: 'assistant', content: REDACTED_TEXT, intent, metadata: { redacted: true } },
      ]
    : [
        { role: 'user', content: query },
        { role: 'assistant', content: reply.slice(0, 8000), intent, metadata: buildAssistantMetadata({ products, suggestions, pagination }) },
      ]
  const title = sensitive ? 'Tra cứu quản trị' : buildTitle(query)

  let id = conversationId
  for (let attempt = 0; attempt < 2; attempt++) {
    if (!id) id = String((await createAiConversation(userId, title)).conversation.id)
    try {
      await appendAiConversationMessages(userId, id, messages)
      return id
    } catch (err) {
      const isFull = err instanceof DataApiClientError && err.code === 'CONVERSATION_FULL'
      if (!isFull || attempt === 1) throw err
      id = null
    }
  }
  return id
}
