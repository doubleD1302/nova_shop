import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { IconArrowRight, IconCart, IconCheck, IconClose, IconExpand, IconHistory, IconMic, IconPackage, IconPlus, IconSearch, IconSend, IconThumbsDown, IconThumbsUp, IconTrash } from '../ui/Icons'
import { useCart } from '../../context/CartContext'
import { useAuth } from '../../context/AuthContext'
import {
  apiDeleteAiConversation,
  apiGetAiBrainProfile,
  apiGetAiConversationMessages,
  apiListAiConversations,
  apiResetAiBrain,
  apiSendAiBrainFeedback,
  apiSendAiMessage,
} from '../../utils/api'

const QUICK_PROMPTS = []

const INITIAL_MESSAGES = []

// Backend tự nối tiếp cuộc trò chuyện gần nhất trong khoảng này; giao diện mở lại đúng cuộc đó cho khớp.
const RESUME_WINDOW_MS = 12 * 60 * 60 * 1000

const timeFormat = new Intl.DateTimeFormat('vi-VN', { hour: '2-digit', minute: '2-digit' })
const dateTimeFormat = new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })

function formatSavedTime(value) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const isToday = date.toDateString() === new Date().toDateString()
  return (isToday ? timeFormat : dateTimeFormat).format(date)
}

// Tin đã lưu trên server → dạng tin nhắn của giao diện. Thẻ sản phẩm và gợi ý lấy từ metadata.
function toViewMessage(saved) {
  return {
    id: `srv_${saved.id}`,
    serverId: saved.id,
    isUser: saved.role === 'user',
    text: saved.content,
    time: formatSavedTime(saved.createdAt),
    products: saved.metadata?.products || [],
    suggestions: saved.metadata?.suggestions || [],
  }
}

export default function NovaAiCopilot({ initialOpen = false, fullPage = false }) {
  const [isOpen, setIsOpen] = useState(initialOpen || fullPage)
  const [messages, setMessages] = useState(INITIAL_MESSAGES)
  const [inputText, setInputText] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [addedComboMap, setAddedComboMap] = useState({})
  const [feedbackGiven, setFeedbackGiven] = useState({})
  const [showBrainModal, setShowBrainModal] = useState(false)
  const [brainMemory, setBrainMemory] = useState({
    learnedFacts: [],
    preferredStyles: [],
    location: null,
    stats: { totalInteractions: 0, acceptedRecommendations: 0 },
  })

  const messagesEndRef = useRef(null)
  const inputRef = useRef(null)
  const launcherRef = useRef(null)
  const { addItem } = useCart()
  const { user } = useAuth()
  const sessionKey = `${user?.id || 'guest'}:${user?.role || 'guest'}`
  const sessionRef = useRef(sessionKey)
  sessionRef.current = sessionKey

  // Lịch sử trò chuyện (chỉ tài khoản đăng nhập). conversationRef là cuộc đang mở; startNewRef bắt Backend tạo cuộc mới.
  const [conversations, setConversations] = useState([])
  const [showHistory, setShowHistory] = useState(false)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyError, setHistoryError] = useState('')
  const [hasMoreOlder, setHasMoreOlder] = useState(false)
  const conversationRef = useRef(null)
  const startNewRef = useRef(false)
  const messagesRef = useRef(messages)
  messagesRef.current = messages
  const skipScrollRef = useRef(false)

  useEffect(() => {
    setMessages(INITIAL_MESSAGES)
    setInputText('')
    setIsLoading(false)
    setBrainMemory({ learnedFacts: [], preferredStyles: [], location: null, stats: { totalInteractions: 0, acceptedRecommendations: 0 } })
    setConversations([])
    setShowHistory(false)
    setHistoryError('')
    setHasMoreOlder(false)
    conversationRef.current = null
    startNewRef.current = false
  }, [sessionKey])

  const refreshConversations = async () => {
    const requestedSession = sessionRef.current
    const response = await apiListAiConversations({ limit: 30 })
    if (requestedSession !== sessionRef.current) return []
    const list = response?.data?.conversations || []
    setConversations(list)
    return list
  }

  const openConversation = async (conversationId) => {
    const requestedSession = sessionRef.current
    setHistoryLoading(true)
    setHistoryError('')
    try {
      const response = await apiGetAiConversationMessages(conversationId, { limit: 50 })
      if (requestedSession !== sessionRef.current) return
      const data = response?.data
      setMessages((data?.messages || []).map(toViewMessage))
      setHasMoreOlder(Boolean(data?.hasMore))
      conversationRef.current = String(data.conversation.id)
      startNewRef.current = false
      setShowHistory(false)
    } catch (error) {
      if (requestedSession === sessionRef.current) setHistoryError(error.message)
    } finally {
      if (requestedSession === sessionRef.current) setHistoryLoading(false)
    }
  }

  const startNewConversation = () => {
    if (isLoading) return
    setMessages(INITIAL_MESSAGES)
    setHasMoreOlder(false)
    conversationRef.current = null
    startNewRef.current = true
    setShowHistory(false)
    setTimeout(() => inputRef.current?.focus(), 0)
  }

  const loadOlderMessages = async () => {
    const oldest = messages.find((message) => message.serverId)
    if (!oldest || !conversationRef.current) return
    const requestedSession = sessionRef.current
    setHistoryError('')
    try {
      const response = await apiGetAiConversationMessages(conversationRef.current, { limit: 50, beforeId: oldest.serverId })
      if (requestedSession !== sessionRef.current) return
      skipScrollRef.current = true
      setMessages((prev) => [...(response?.data?.messages || []).map(toViewMessage), ...prev])
      setHasMoreOlder(Boolean(response?.data?.hasMore))
    } catch (error) {
      if (requestedSession === sessionRef.current) setHistoryError(error.message)
    }
  }

  const deleteConversation = async (conversation) => {
    if (isLoading || !window.confirm(`Xóa cuộc trò chuyện "${conversation.title}"? Thao tác này không thể hoàn tác.`)) return
    setHistoryError('')
    try {
      await apiDeleteAiConversation(conversation.id)
      setConversations((prev) => prev.filter((item) => item.id !== conversation.id))
      if (conversationRef.current === conversation.id) startNewConversation()
    } catch (error) {
      setHistoryError(error.message)
    }
  }

  // Mở Nova: tải danh sách và tự mở lại cuộc gần nhất nếu còn trong 12 giờ (giống cách Backend nối tiếp).
  useEffect(() => {
    if (!user || !isOpen) return
    refreshConversations().then((list) => {
      const latest = list[0]
      const isRecent = latest && Date.now() - Date.parse(latest.lastMessageAt) < RESUME_WINDOW_MS
      if (isRecent && messagesRef.current.length === 0 && !conversationRef.current && !startNewRef.current) openConversation(latest.id)
    }).catch((error) => setHistoryError(error.message))
  }, [isOpen, sessionKey])

  // Tải hồ sơ bộ não AI khi mở
  useEffect(() => {
    const requestedSession = sessionKey
    apiGetAiBrainProfile().then((res) => {
      if (requestedSession === sessionRef.current && res?.data?.profile) {
        setBrainMemory({
          learnedFacts: res.data.profile.learnedFacts || [],
          preferredStyles: res.data.profile.preferredStyles || [],
          location: res.data.profile.location || null,
          stats: res.data.stats || { totalInteractions: 0, acceptedRecommendations: 0 },
        })
      }
    }).catch(() => {})
  }, [isOpen, sessionKey])

  // Lắng nghe sự kiện toàn cục để mở Nova AI từ Header hoặc nút bất kỳ
  useEffect(() => {
    const handleOpenEvent = (e) => {
      setIsOpen(true)
      inputRef.current?.focus()
      if (e?.detail?.query) {
        setTimeout(() => handleSendMessage(e.detail.query), 150)
      }
    }
    window.addEventListener('open-nova-ai', handleOpenEvent)
    return () => window.removeEventListener('open-nova-ai', handleOpenEvent)
  }, [])

  useEffect(() => {
    if (isOpen) {
      // Tải thêm tin cũ ở đầu danh sách thì giữ nguyên vị trí cuộn, không nhảy xuống cuối.
      if (skipScrollRef.current) { skipScrollRef.current = false; return }
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
        inputRef.current?.focus()
      }, 100)
    }
  }, [isOpen, messages, isLoading])

  const formatVND = (num) => {
    return new Intl.NumberFormat('vi-VN').format(Math.round(num)) + 'đ'
  }

  const handleSendMessage = async (textToSend) => {
    const requestedSession = sessionRef.current
    const text = (textToSend || inputText).trim()
    if (!text || isLoading) return

    setInputText('')
    const timeNow = new Intl.DateTimeFormat('vi-VN', { hour: '2-digit', minute: '2-digit' }).format(new Date())

    const userMessage = {
      id: 'usr_' + Date.now(),
      isUser: true,
      text,
      time: timeNow,
    }

    setMessages((prev) => [...prev, userMessage])
    setIsLoading(true)

    try {
      const recentMessages = messages.slice(-5)
      if (/^\s*(?:xem\s+)?trang\s+\d+\s*$/i.test(text)) {
        const originalQuestion = [...messages].reverse().find((m) => m.isUser && !/^\s*(?:xem\s+)?trang\s+\d+\s*$/i.test(m.text))
        if (originalQuestion && !recentMessages.includes(originalQuestion)) recentMessages.unshift(originalQuestion)
      }
      const recentHistory = recentMessages.map((m) => ({
        isUser: m.isUser,
        text: m.text,
      }))
      // Đã đăng nhập: Backend lấy ngữ cảnh từ lịch sử đã lưu, chỉ cần nói rõ cuộc nào (hoặc yêu cầu cuộc mới).
      const context = { history: recentHistory }
      if (user && conversationRef.current) context.conversationId = conversationRef.current
      if (user && startNewRef.current) context.newConversation = true
      const response = await apiSendAiMessage(text, context)
      if (requestedSession !== sessionRef.current) return
      const aiData = response?.data || {}
      if (user && aiData.conversationId) {
        conversationRef.current = String(aiData.conversationId)
        startNewRef.current = false
        refreshConversations().catch(() => {})
      }

      if (aiData.brain) {
        setBrainMemory(aiData.brain)
      }

      const aiMessage = {
        id: 'ai_' + Date.now(),
        isUser: false,
        text: aiData.reply || 'Nova đã xử lý yêu cầu của bạn thành công!',
        time: timeNow,
        intentTitle: aiData.intentTitle,
        intentMatch: aiData.intentMatch,
        products: aiData.products || [],
        budget: aiData.budget,
        orderInfo: aiData.orderInfo,
        newlyLearned: aiData.brain?.newlyLearned || [],
        historyNotSaved: Boolean(user) && aiData.historySaved === false,
        suggestions: aiData.suggestions || [
          'Xem thêm sản phẩm tương tự',
          'Chính sách đổi trả và vận chuyển',
          'Sản phẩm đang giảm giá',
        ],
      }

      setMessages((prev) => [...prev, aiMessage])
    } catch (error) {
      if (requestedSession !== sessionRef.current) return
      // Cuộc trò chuyện đã bị xóa ở nơi khác: lần gửi sau sẽ mở cuộc mới.
      const conversationGone = error?.code === 'CONVERSATION_NOT_FOUND'
      if (conversationGone) { conversationRef.current = null; startNewRef.current = true }
      const aiMessage = {
        id: 'ai_fallback_' + Date.now(),
        isUser: false,
        text: conversationGone
          ? 'Cuộc trò chuyện này không còn tồn tại. Bạn hãy gửi lại câu hỏi để bắt đầu cuộc trò chuyện mới.'
          : 'Nova AI hiện không kết nối được với máy chủ. Bạn vui lòng thử lại sau.',
        time: timeNow,
        intentTitle: 'Nova AI',
        suggestions: QUICK_PROMPTS,
      }
      setMessages((prev) => [...prev, aiMessage])
    } finally {
      if (requestedSession === sessionRef.current) setIsLoading(false)
    }
  }

  // Thêm vào giỏ hàng và dạy AI (Brain Learning)
  const handleAddProductToCart = (prod) => {
    addItem({
      id: prod.id,
      name: prod.name,
      price: prod.price,
      originalPrice: prod.originalPrice || prod.price * 1.2,
      image: prod.imageUrl,
      shop: { name: prod.mall ? 'ShopNova Mall' : 'Cửa Hàng Uy Tín' },
    }, 1)

    // Báo cho AI Brain biết người dùng đã thích sản phẩm này
    apiSendAiBrainFeedback({
      action: 'add_to_cart',
      productId: prod.id,
      query: prod.name,
      helpful: true,
    }).catch(() => {})

    setAddedComboMap((prev) => ({ ...prev, [prod.id]: true }))
    setTimeout(() => {
      setAddedComboMap((prev) => ({ ...prev, [prod.id]: false }))
    }, 2000)
  }

  const handleAddAllOutfit = (products) => {
    if (!Array.isArray(products)) return
    products.forEach((p) => handleAddProductToCart(p))
  }

  // Gửi phản hồi đánh giá Thích / Không thích cho câu trả lời
  const handleFeedback = (messageId, helpful) => {
    setFeedbackGiven((prev) => ({ ...prev, [messageId]: helpful }))
    apiSendAiBrainFeedback({
      action: helpful ? 'like' : 'dislike',
      query: messages.find((m) => m.id === messageId)?.text || '',
      helpful,
    }).catch(() => {})
  }

  // Đặt lại bộ não AI
  const handleResetBrain = async () => {
    if (window.confirm('Bạn có chắc muốn đặt lại ký ức của Nova AI? AI sẽ quên các sở thích và ngân sách đã học.')) {
      await apiResetAiBrain().catch(() => {})
      setBrainMemory({
        learnedFacts: [],
        preferredStyles: [],
        location: null,
        stats: { totalInteractions: 0, acceptedRecommendations: 0 },
      })
      setShowBrainModal(false)
      setMessages([
        {
          id: 'reset_' + Date.now(),
          isUser: false,
          text: '🌱 Nova đã làm mới bộ não! Hãy tiếp tục trò chuyện, mình sẽ học lại các sở thích và phong cách mới của bạn.',
          time: 'Vừa xong',
          intentMatch: 'Khởi Tạo Mới',
          suggestions: QUICK_PROMPTS,
        },
      ])
    }
  }

  // Nhận diện giọng nói Web Speech API
  const handleToggleVoice = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognition) {
      alert('Trình duyệt của bạn chưa hỗ trợ nhận diện giọng nói trực tiếp. Bạn có thể nhập tin nhắn bằng bàn phím!')
      return
    }

    if (isListening) {
      setIsListening(false)
      return
    }

    try {
      const recognition = new SpeechRecognition()
      recognition.lang = 'vi-VN'
      recognition.continuous = false
      recognition.interimResults = false

      recognition.onstart = () => setIsListening(true)
      recognition.onend = () => setIsListening(false)
      recognition.onerror = () => setIsListening(false)

      recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript
        setInputText(transcript)
        handleSendMessage(transcript)
      }

      recognition.start()
    } catch {
      setIsListening(false)
    }
  }

  const closeChat = () => {
    setIsOpen(false)
    setTimeout(() => launcherRef.current?.focus(), 0)
  }

  return (
    <>
      {!isOpen && !fullPage ? (
        <button
          ref={launcherRef}
          type="button"
          onClick={() => setIsOpen(true)}
          aria-label="Mở trợ lý Nova"
          className="nova-launcher"
        >
          <img src="/images/nova-mark.svg" alt="" className="h-7 w-7" />
          <span>Hỏi Nova</span>
        </button>
      ) : null}

      {isOpen || fullPage ? (
        <section
          role={fullPage ? 'region' : 'dialog'}
          aria-label="Trợ lý mua sắm Nova"
          className={fullPage ? 'nova-workspace' : 'nova-drawer'}
          onKeyDown={(event) => {
            if (event.key === 'Escape' && !fullPage) closeChat()
          }}
        >
          {fullPage ? (
            <aside className="nova-sidebar">
              <Link to="/" className="nova-back"><IconArrowRight className="h-4 w-4 rotate-180" /> Về cửa hàng</Link>
              <div className="nova-sidebar-intro">
                <img src="/images/nova-mark.svg" alt="" className="h-12 w-12" />
                <p className="nova-eyebrow">NOVA · TRỢ LÝ MUA SẮM</p>
                <h1>Tìm đúng món<br />bạn đang cần.</h1>
                <p>Từ một ý tưởng đến một lựa chọn phù hợp. Cùng Nova xem những gì ShopNova đang có.</p>
              </div>
              <div className="nova-capabilities">
                <div><IconSearch className="h-4 w-4" /><span>Tìm theo nhu cầu, ngân sách</span></div>
                <div><IconCart className="h-4 w-4" /><span>Cân nhắc các lựa chọn</span></div>
                <div><IconPackage className="h-4 w-4" /><span>Hỏi về đơn hàng của bạn</span></div>
              </div>
              <p className="nova-sidebar-note">Một cuộc trò chuyện, thêm một góc nhìn trước khi chọn mua.</p>
            </aside>
          ) : null}

          <div className="nova-conversation">
            <header className="nova-header">
              <div className="flex min-w-0 items-center gap-3">
                <span className="nova-avatar"><img src="/images/nova-mark.svg" alt="" className="h-7 w-7" /></span>
                <div>
                  <h2 className="text-sm font-semibold text-ink">Nova <span className="nova-ai-label">AI</span></h2>
                  <p className="mt-0.5 text-xs text-muted">Trợ lý mua sắm của ShopNova</p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                {user ? (
                  <>
                    <button type="button" onClick={startNewConversation} disabled={isLoading} aria-label="Cuộc trò chuyện mới" title="Cuộc trò chuyện mới" className="nova-icon-button">
                      <IconPlus className="h-[18px] w-[18px]" />
                    </button>
                    <button type="button" onClick={() => setShowHistory((value) => !value)} aria-label="Lịch sử trò chuyện" title="Lịch sử trò chuyện" aria-pressed={showHistory} className="nova-icon-button">
                      <IconHistory className="h-[18px] w-[18px]" />
                    </button>
                  </>
                ) : null}
                {!fullPage ? (
                  <>
                    <Link to="/nova-ai" aria-label="Mở trang trò chuyện" title="Mở trang trò chuyện" className="nova-icon-button">
                      <IconExpand className="h-[18px] w-[18px]" />
                    </Link>
                    <button type="button" onClick={closeChat} aria-label="Đóng trợ lý" className="nova-icon-button">
                      <IconClose className="h-[18px] w-[18px]" />
                    </button>
                  </>
                ) : null}
              </div>
            </header>
            {showHistory && user ? renderHistoryPanel() : (
              <>
                <div className="nova-messages thin-scroll" role="log" aria-label="Nội dung trò chuyện" aria-live="polite" aria-relevant="additions text">
                  {renderChatMessages()}
                </div>
                {renderInputBar()}
              </>
            )}
          </div>
        </section>
      ) : null}
    </>
  )

  function renderHistoryPanel() {
    return (
      <div className="nova-history thin-scroll">
        <button type="button" onClick={startNewConversation} disabled={isLoading} className="nova-new-chat">
          <IconPlus className="h-4 w-4" /> Cuộc trò chuyện mới
        </button>
        {historyError ? <p role="alert" className="nova-history-note nova-history-error">{historyError}</p> : null}
        {historyLoading && conversations.length === 0 ? <p role="status" className="nova-history-note">Đang tải lịch sử…</p> : null}
        {!historyLoading && !historyError && conversations.length === 0 ? <p className="nova-history-note">Chưa có cuộc trò chuyện nào được lưu.</p> : null}
        <ul className="nova-history-list">
          {conversations.map((conversation) => (
            <li key={conversation.id} className={conversation.id === conversationRef.current ? 'nova-history-active' : ''}>
              <button type="button" onClick={() => openConversation(conversation.id)} disabled={isLoading || historyLoading} className="nova-history-item">
                <span className="nova-history-title">{conversation.title}</span>
                <span className="nova-history-meta">{formatSavedTime(conversation.lastMessageAt)} · {conversation.messageCount} tin</span>
              </button>
              <button type="button" onClick={() => deleteConversation(conversation)} disabled={isLoading} aria-label={`Xóa cuộc trò chuyện ${conversation.title}`} className="nova-icon-button nova-history-delete">
                <IconTrash className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      </div>
    )
  }

  function renderChatMessages() {
    if (messages.length === 0) {
      return (
        <div className="nova-empty">
          <img src="/images/nova-notes.svg" alt="" className="nova-empty-art" />
          <p className="nova-eyebrow">BẮT ĐẦU TỪ ĐIỀU BẠN CẦN</p>
          <h3>Bạn đang tìm gì hôm nay?</h3>
          <p>Mô tả món đồ, ngân sách hoặc điều bạn muốn biết. Nova sẽ cùng bạn tìm trong ShopNova.</p>
          {!user ? <p className="nova-guest-note"><Link to="/dang-nhap">Đăng nhập</Link> để Nova lưu lại lịch sử trò chuyện của bạn.</p> : null}
        </div>
      )
    }

    return (
      <>
        {hasMoreOlder ? (
          <button type="button" onClick={loadOlderMessages} className="nova-text-link nova-load-older">Xem tin cũ hơn</button>
        ) : null}
        {historyError ? <p role="alert" className="nova-history-note nova-history-error">{historyError}</p> : null}
        {messages.map((message) => (
          <div key={message.id} className={`nova-message ${message.isUser ? 'nova-message-user' : ''}`}>
            {message.isUser ? (
              <>
                <div className="nova-user-bubble"><p>{message.text}</p></div>
                <span className="nova-time">{message.time}</span>
              </>
            ) : (
              <div className="nova-reply">
                <div className="nova-reply-heading"><img src="/images/nova-mark.svg" alt="" className="h-5 w-5" /><span>Nova</span></div>
                {message.intentTitle ? <p className="nova-intent">{message.intentTitle}</p> : null}
                <p className="nova-reply-text">{message.text}</p>

                {message.orderInfo ? (
                  <div className="nova-detail-card">
                    <div className="flex items-center justify-between gap-2 text-xs font-semibold text-ink">
                      <span className="flex items-center gap-2"><IconPackage className="h-4 w-4" />{message.orderInfo.code}</span>
                      <span className="text-earth">{message.orderInfo.statusText}</span>
                    </div>
                    <dl className="nova-order-details">
                      {message.orderInfo.location ? <div><dt>Vị trí</dt><dd>{message.orderInfo.location}</dd></div> : null}
                      {message.orderInfo.eta ? <div><dt>Dự kiến giao</dt><dd>{message.orderInfo.eta}</dd></div> : null}
                      {message.orderInfo.shipper ? <div><dt>Người giao</dt><dd>{message.orderInfo.shipper}</dd></div> : null}
                    </dl>
                    <Link to="/don-hang" className="nova-text-link">Xem đơn hàng <IconArrowRight className="h-3.5 w-3.5" /></Link>
                  </div>
                ) : null}

                {message.budget ? (
                  <div className="nova-detail-card">
                    <div className="flex items-center justify-between gap-3 text-xs">
                      <span>Tổng các món gợi ý</span><strong className="text-sm text-earth">{formatVND(message.budget.total)}</strong>
                    </div>
                    {message.budget.saved > 0 ? <p className="mt-1.5 text-xs text-success">Tiết kiệm {formatVND(message.budget.saved)} so với giá niêm yết</p> : null}
                    {message.products?.length > 0 ? (
                      <button type="button" onClick={() => handleAddAllOutfit(message.products)} className="nova-text-link mt-3">
                        <IconCart className="h-4 w-4" /> Thêm {message.products.length} món vào giỏ
                      </button>
                    ) : null}
                  </div>
                ) : null}

                {message.products?.length > 0 ? (
                  <div className="nova-products">
                    {message.products.map((product) => (
                      <div key={product.id} className="nova-product">
                        <img src={product.imageUrl} alt={product.name} className="h-16 w-16 shrink-0 rounded-md bg-white object-contain" />
                        <div className="min-w-0 flex-1">
                          {product.tag ? <span className="text-[10px] text-muted">{product.tag}</span> : null}
                          <h4 className="line-clamp-2 text-xs font-medium leading-5 text-ink">{product.name}</h4>
                          <div className="mt-1 flex flex-wrap items-center gap-x-2">
                            <span className="text-xs font-semibold text-earth">{formatVND(product.price)}</span>
                            {product.originalPrice > product.price ? <span className="text-[10px] text-muted line-through">{formatVND(product.originalPrice)}</span> : null}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleAddProductToCart(product)}
                          aria-label={addedComboMap[product.id] ? `Đã thêm ${product.name}` : `Thêm ${product.name} vào giỏ`}
                          aria-pressed={Boolean(addedComboMap[product.id])}
                          className={`nova-icon-button shrink-0 ${addedComboMap[product.id] ? 'text-success' : 'text-earth'}`}
                        >
                          {addedComboMap[product.id] ? <IconCheck className="h-[18px] w-[18px]" /> : <IconCart className="h-[18px] w-[18px]" />}
                        </button>
                      </div>
                    ))}
                  </div>
                ) : null}

                {message.historyNotSaved ? <p className="nova-history-note">Không lưu được cuộc trò chuyện này vào lịch sử.</p> : null}
                <div className="nova-feedback">
                  <span className="nova-time">{message.time}</span>
                  <div className="flex items-center gap-1">
                    <button type="button" onClick={() => handleFeedback(message.id, true)} aria-label="Câu trả lời hữu ích" aria-pressed={feedbackGiven[message.id] === true} className="nova-icon-button nova-feedback-button">
                      <IconThumbsUp className="h-3.5 w-3.5" />
                    </button>
                    <button type="button" onClick={() => handleFeedback(message.id, false)} aria-label="Câu trả lời chưa hữu ích" aria-pressed={feedbackGiven[message.id] === false} className="nova-icon-button nova-feedback-button">
                      <IconThumbsDown className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
                {message.suggestions?.length > 0 ? (
                  <div className="nova-suggestions">
                    {message.suggestions.map((suggestion, index) => (
                      <button key={index} type="button" onClick={() => handleSendMessage(suggestion)} disabled={isLoading}>
                        {suggestion}<IconArrowRight className="h-3 w-3 shrink-0" />
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            )}
          </div>
        ))}
        {isLoading ? <div role="status" className="nova-loading"><span className="nova-loading-dot" />Đang trả lời…</div> : null}
        <div ref={messagesEndRef} />
      </>
    )
  }

  function renderInputBar() {
    return (
      <div className="nova-composer">
        <form onSubmit={(event) => { event.preventDefault(); handleSendMessage() }} className="nova-input-wrap">
          <input
            ref={inputRef}
            type="text"
            value={inputText}
            onChange={(event) => setInputText(event.target.value)}
            aria-label="Tin nhắn cho Nova"
            placeholder={isListening ? 'Đang nghe bạn nói…' : 'Bạn cần tìm gì?'}
            disabled={isLoading}
          />
          <button type="button" onClick={handleToggleVoice} aria-label={isListening ? 'Dừng nhập giọng nói' : 'Nhập bằng giọng nói'} aria-pressed={isListening} className={`nova-icon-button ${isListening ? 'text-error' : ''}`}>
            <IconMic className="h-[18px] w-[18px]" />
          </button>
          <button type="submit" disabled={!inputText.trim() || isLoading} aria-label="Gửi tin nhắn" className="nova-send">
            <IconSend className="h-[18px] w-[18px]" />
          </button>
        </form>
        <p className="nova-input-note">Nova sử dụng AI. Bạn có thể kiểm tra lại thông tin tại trang sản phẩm.</p>
      </div>
    )
  }
}
