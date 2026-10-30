import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useCart } from '../../context/CartContext'
import { apiSendAiMessage } from '../../utils/api'

const QUICK_PROMPTS = [
  '👗 Phối đồ đi tiệc < 500k',
  '📦 Tra cứu đơn hàng của tôi',
  '⚡ Săn deal hỏa tốc hôm nay',
  '🎧 So sánh tai nghe chống ồn',
  '🎁 Gợi ý quà sinh nhật bạn gái',
]

const INITIAL_MESSAGES = [
  {
    id: 'm1',
    isUser: false,
    text: 'Xin chào! Mình là Nova AI Copilot ✨ – Trợ lý mua sắm thông minh của bạn. Mình có thể giúp bạn phối đồ theo ngân sách, tìm deal giá sỉ, so sánh sản phẩm hoặc tra cứu trạng thái đơn hàng thời gian thực. Bạn cần mình hỗ trợ gì hôm nay?',
    time: 'Vừa xong',
    intentMatch: 'AI Sẵn Sàng 100%',
    suggestions: QUICK_PROMPTS,
  },
]

export default function NovaAiCopilot({ initialOpen = false, fullPage = false }) {
  const [isOpen, setIsOpen] = useState(initialOpen || fullPage)
  const [messages, setMessages] = useState(INITIAL_MESSAGES)
  const [inputText, setInputText] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [addedComboMap, setAddedComboMap] = useState({})
  const messagesEndRef = useRef(null)
  const inputRef = useRef(null)
  const { addItem } = useCart()

  // Lắng nghe sự kiện toàn cục để mở Nova AI từ Header hoặc nút bất kỳ
  useEffect(() => {
    const handleOpenEvent = (e) => {
      setIsOpen(true)
      if (e?.detail?.query) {
        setTimeout(() => handleSendMessage(e.detail.query), 150)
      }
    }
    window.addEventListener('open-nova-ai', handleOpenEvent)
    return () => window.removeEventListener('open-nova-ai', handleOpenEvent)
  }, [])

  useEffect(() => {
    if (isOpen) {
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
      const response = await apiSendAiMessage(text, {})
      const aiData = response?.data || {}

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
        suggestions: aiData.suggestions || [
          '✨ Gợi ý thêm sản phẩm tương tự',
          '🚚 Xem chính sách đổi trả & freeship',
          '⚡ Deal sốc hôm nay',
        ],
      }

      setMessages((prev) => [...prev, aiMessage])
    } catch {
      // Fallback thông minh nếu máy chủ chưa mở
      const aiMessage = {
        id: 'ai_fallback_' + Date.now(),
        isUser: false,
        text: `Nova đã ghi nhận yêu cầu: "${text}". Dưới đây là gợi ý nổi bật từ kho hàng được đánh giá 4.9 sao dành cho bạn:`,
        time: timeNow,
        intentTitle: 'Nova AI Đề Xuất',
        intentMatch: 'Khớp 95%',
        products: [
          {
            id: 'p_crop_top',
            name: 'Áo Croptop Linen Cổ Vuông Pastel ShopNova',
            price: 159000,
            originalPrice: 220000,
            rating: 4.9,
            imageUrl: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=400&q=80',
          },
          {
            id: 'p_shorts_kaki',
            name: 'Quần Short Kaki Ống Rộng Cạp Cao Pastel',
            price: 165000,
            originalPrice: 210000,
            rating: 4.8,
            imageUrl: 'https://images.unsplash.com/photo-1591195853828-11db59a44f6b?auto=format&fit=crop&w=400&q=80',
          },
        ],
        suggestions: QUICK_PROMPTS,
      }
      setMessages((prev) => [...prev, aiMessage])
    } finally {
      setIsLoading(false)
    }
  }

  // Thêm toàn bộ combo hoặc 1 sản phẩm vào giỏ hàng
  const handleAddProductToCart = (prod) => {
    addItem({
      id: prod.id,
      name: prod.name,
      price: prod.price,
      originalPrice: prod.originalPrice || prod.price * 1.2,
      image: prod.imageUrl,
      shop: { name: prod.mall ? 'ShopNova Mall' : 'Cửa Hàng Uy Tín' },
    }, 1)

    setAddedComboMap((prev) => ({ ...prev, [prod.id]: true }))
    setTimeout(() => {
      setAddedComboMap((prev) => ({ ...prev, [prod.id]: false }))
    }, 2000)
  }

  // Thêm tất cả sản phẩm trong set đồ vào giỏ hàng
  const handleAddAllOutfit = (products) => {
    if (!Array.isArray(products)) return
    products.forEach((p) => handleAddProductToCart(p))
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

  if (fullPage) {
    return (
      <div className="mx-auto flex h-[calc(100vh-140px)] max-w-4xl flex-col rounded-2xl border border-[#E6D5C2] bg-[#FFFCF7] shadow-xl overflow-hidden">
        {/* Header Fullpage */}
        <div className="flex items-center justify-between border-b border-[#E6D5C2] bg-[#F5E7D4] px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#BD6E49] text-white shadow-md">
              <span className="text-xl">✨</span>
            </div>
            <div>
              <h1 className="text-lg font-black text-[#49352D] flex items-center gap-2">
                Nova AI Copilot <span className="rounded-full bg-[#BD6E49] px-2 py-0.5 text-[11px] font-bold text-white uppercase tracking-wider">Trợ lý Mua Sắm</span>
              </h1>
              <p className="text-xs text-[#8B7566] flex items-center gap-1.5 mt-0.5">
                <span className="inline-block h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
                Sẵn sàng gợi ý phối đồ, săn deal hỏa tốc & theo dõi đơn hàng
              </p>
            </div>
          </div>
          <Link to="/" className="text-sm font-semibold text-[#BD6E49] hover:underline">
            ← Về Mua Sắm
          </Link>
        </div>

        {/* Nội dung tin nhắn */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {renderChatMessages()}
        </div>

        {/* Khung nhập tin nhắn */}
        {renderInputBar()}
      </div>
    )
  }

  return (
    <>
      {/* 1. NÚT NỔI LAUNCHER GÓC PHẢI DƯỚI */}
      {!isOpen && (
        <div className="fixed bottom-6 right-6 z-40 flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2 rounded-full border border-[#E6D5C2] bg-[#FFFCF7] px-3.5 py-1.5 shadow-lg text-xs font-semibold text-[#49352D] animate-bounce">
            <span>✨ Hỏi Nova AI phối đồ & tra cứu đơn!</span>
          </div>

          <button
            type="button"
            onClick={() => setIsOpen(true)}
            aria-label="Mở Trợ lý Nova AI"
            className="group relative flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-tr from-[#A95532] to-[#BD6E49] text-white shadow-xl transition-all duration-300 hover:scale-110 hover:shadow-2xl focus:outline-none"
          >
            <span className="absolute -top-1 -right-1 flex h-4 w-4">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75"></span>
              <span className="relative inline-flex h-4 w-4 rounded-full bg-amber-500 text-[9px] font-extrabold text-white items-center justify-center">AI</span>
            </span>
            <span className="text-2xl transition-transform duration-300 group-hover:rotate-12">✨</span>
          </button>
        </div>
      )}

      {/* 2. CHAT DRAWER / MODAL NỔI TRÊN GIAO DIỆN */}
      {isOpen && (
        <div className="fixed bottom-4 right-4 z-50 flex h-[580px] w-[95vw] sm:w-[420px] max-w-full flex-col rounded-2xl border border-[#E6D5C2] bg-[#FFFCF7] shadow-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-6 duration-200">
          {/* Header Drawer */}
          <div className="flex items-center justify-between border-b border-[#E6D5C2] bg-[#F5E7D4] px-4 py-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#BD6E49] text-white shadow">
                <span className="text-lg">✨</span>
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[15px] font-black text-[#49352D]">Nova AI Copilot</span>
                  <span className="rounded bg-[#BD6E49] px-1.5 py-0.2 text-[10px] font-bold text-white">AI</span>
                </div>
                <p className="text-[11px] text-[#8B7566] flex items-center gap-1">
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  Trợ lý mua sắm trực tuyến
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <Link
                to="/nova-ai"
                target="_blank"
                title="Mở toàn màn hình"
                className="rounded-lg p-1.5 text-[#8B7566] hover:bg-[#E6D5C2] transition"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                </svg>
              </Link>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                title="Đóng trợ lý"
                className="rounded-lg p-1.5 text-[#8B7566] hover:bg-[#E6D5C2] transition"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto p-3.5 space-y-3.5 bg-[#FAF4EB]">
            {renderChatMessages()}
          </div>

          {/* Input Bar */}
          {renderInputBar()}
        </div>
      )}
    </>
  )

  function renderChatMessages() {
    return (
      <>
        {messages.map((m) => (
          <div key={m.id} className={`flex flex-col ${m.isUser ? 'items-end' : 'items-start'}`}>
            {/* Tin nhắn từ người dùng */}
            {m.isUser ? (
              <div className="max-w-[85%] rounded-2xl rounded-tr-none bg-gradient-to-r from-[#BD6E49] to-[#A95532] px-4 py-2.5 text-[13.5px] text-white shadow-sm">
                <p className="leading-relaxed">{m.text}</p>
                <span className="mt-1 block text-right text-[10px] text-amber-100 opacity-80">{m.time}</span>
              </div>
            ) : (
              /* Tin nhắn từ Nova AI */
              <div className="max-w-[95%] space-y-2">
                <div className="rounded-2xl rounded-tl-none border border-[#E6D5C2] bg-[#FFFCF7] p-3.5 shadow-sm text-[#49352D]">
                  {/* Badge intent match */}
                  {m.intentTitle && (
                    <div className="mb-2 flex items-center justify-between border-b border-[#F0E2D2] pb-1.5">
                      <span className="text-[12px] font-bold text-[#80513B] flex items-center gap-1.5">
                        <span>✨</span> {m.intentTitle}
                      </span>
                      {m.intentMatch && (
                        <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 border border-emerald-200">
                          {m.intentMatch}
                        </span>
                      )}
                    </div>
                  )}

                  <p className="text-[13px] leading-relaxed whitespace-pre-wrap">{m.text}</p>

                  {/* TH1: Thẻ theo dõi đơn hàng thời gian thực */}
                  {m.orderInfo && (
                    <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50/60 p-3 text-xs text-[#49352D]">
                      <div className="flex items-center justify-between font-bold text-[#BD6E49]">
                        <span>📦 Đơn hàng: {m.orderInfo.code}</span>
                        <span className="rounded bg-amber-100 px-2 py-0.5 text-[11px] text-amber-800">
                          {m.orderInfo.statusText}
                        </span>
                      </div>
                      <div className="mt-2 space-y-1 text-[#8B7566]">
                        <p>📍 {m.orderInfo.location}</p>
                        <p>⏰ {m.orderInfo.eta}</p>
                        <p>🛵 Bưu tá: {m.orderInfo.shipper}</p>
                      </div>
                      <div className="mt-3 flex gap-2">
                        <Link
                          to="/don-hang"
                          className="flex-1 rounded-lg bg-[#BD6E49] py-1.5 text-center font-bold text-white hover:bg-[#A95532] transition"
                        >
                          Xem chi tiết đơn
                        </Link>
                      </div>
                    </div>
                  )}

                  {/* TH2: Bảng ngân sách & combo phối đồ */}
                  {m.budget && (
                    <div className="mt-3 rounded-xl border border-[#E6D5C2] bg-[#F5E7D4] p-2.5 text-xs">
                      <div className="flex items-center justify-between font-bold text-[#49352D]">
                        <span>Tổng set đồ gợi ý:</span>
                        <span className="text-sm text-[#BD6E49] font-extrabold">{formatVND(m.budget.total)}</span>
                      </div>
                      {m.budget.saved > 0 && (
                        <p className="text-[11px] font-medium text-emerald-700 mt-0.5">
                          🎉 Đã tiết kiệm {formatVND(m.budget.saved)} so với giá niêm yết
                        </p>
                      )}
                      {m.products && m.products.length > 0 && (
                        <button
                          type="button"
                          onClick={() => handleAddAllOutfit(m.products)}
                          className="mt-2.5 w-full rounded-lg bg-[#BD6E49] py-1.5 text-center font-bold text-white shadow hover:bg-[#A95532] transition flex items-center justify-center gap-1.5"
                        >
                          <span>🛒</span> Thêm trọn bộ {m.products.length} món vào giỏ
                        </button>
                      )}
                    </div>
                  )}

                  {/* TH3: Danh sách sản phẩm gợi ý */}
                  {m.products && m.products.length > 0 && (
                    <div className="mt-3 space-y-2">
                      <p className="text-[11px] font-bold text-[#80513B] uppercase tracking-wider">
                        Sản phẩm đề xuất:
                      </p>
                      <div className="grid grid-cols-1 gap-2">
                        {m.products.map((p) => {
                          const isAdded = addedComboMap[p.id]
                          return (
                            <div
                              key={p.id}
                              className="flex items-center gap-2.5 rounded-xl border border-[#E6D5C2] bg-white p-2 hover:border-[#BD6E49] transition shadow-2xs"
                            >
                              <img
                                src={p.imageUrl}
                                alt={p.name}
                                className="h-14 w-14 shrink-0 rounded-lg object-cover bg-amber-50"
                              />
                              <div className="flex-1 min-w-0">
                                {p.tag && (
                                  <span className="inline-block rounded bg-[#F5E7D4] px-1.5 py-0.2 text-[9.5px] font-bold text-[#BD6E49]">
                                    {p.tag}
                                  </span>
                                )}
                                <h4 className="text-[12px] font-semibold text-[#49352D] line-clamp-1 mt-0.5">
                                  {p.name}
                                </h4>
                                <div className="flex items-center gap-1.5 mt-0.5">
                                  <span className="text-[12px] font-black text-[#BD6E49]">
                                    {formatVND(p.price)}
                                  </span>
                                  {p.originalPrice && p.originalPrice > p.price && (
                                    <span className="text-[10px] text-gray-400 line-through">
                                      {formatVND(p.originalPrice)}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleAddProductToCart(p)}
                                title="Thêm vào giỏ hàng"
                                className={`shrink-0 rounded-lg p-2 text-xs font-bold transition ${
                                  isAdded
                                    ? 'bg-emerald-600 text-white'
                                    : 'bg-[#F5E7D4] text-[#BD6E49] hover:bg-[#BD6E49] hover:text-white'
                                }`}
                              >
                                {isAdded ? '✓ Đã thêm' : '+ Giỏ'}
                              </button>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  <span className="mt-2 block text-right text-[10px] text-gray-400">{m.time}</span>
                </div>

                {/* Các gợi ý nhanh tiếp theo */}
                {m.suggestions && m.suggestions.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {m.suggestions.map((sug, sIdx) => (
                      <button
                        key={sIdx}
                        type="button"
                        onClick={() => handleSendMessage(sug)}
                        className="rounded-full border border-[#E6D5C2] bg-white px-2.5 py-1 text-[11px] font-medium text-[#80513B] shadow-2xs hover:border-[#BD6E49] hover:bg-[#F5E7D4] transition"
                      >
                        {sug}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}

        {/* Trạng thái AI đang suy nghĩ */}
        {isLoading && (
          <div className="flex items-center gap-2 rounded-2xl rounded-tl-none border border-[#E6D5C2] bg-[#FFFCF7] px-3.5 py-2.5 text-xs text-[#8B7566] shadow-sm w-fit">
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#BD6E49] opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[#BD6E49]"></span>
            </span>
            <span className="font-medium animate-pulse">Nova AI đang phân tích dữ liệu & chọn sản phẩm...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </>
    )
  }

  function renderInputBar() {
    return (
      <div className="border-t border-[#E6D5C2] bg-white p-3">
        <form
          onSubmit={(e) => {
            e.preventDefault()
            handleSendMessage()
          }}
          className="flex items-center gap-2"
        >
          {/* Nút Voice Speech */}
          <button
            type="button"
            onClick={handleToggleVoice}
            title={isListening ? 'Đang lắng nghe... bấm để dừng' : 'Nói để tìm kiếm bằng giọng nói'}
            className={`rounded-full p-2 transition ${
              isListening ? 'bg-red-500 text-white animate-pulse' : 'text-[#8B7566] hover:bg-[#F5E7D4]'
            }`}
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
            </svg>
          </button>

          {/* Ô nhập tin nhắn */}
          <input
            ref={inputRef}
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder={isListening ? 'Đang lắng nghe giọng nói...' : 'Nhập yêu cầu: phối đồ, săn deal, đơn hàng...'}
            disabled={isLoading}
            className="flex-1 rounded-full border border-[#E6D5C2] bg-[#FAF4EB] px-4 py-2 text-[13px] text-[#49352D] placeholder-gray-400 focus:border-[#BD6E49] focus:bg-white focus:outline-none"
          />

          {/* Nút gửi */}
          <button
            type="submit"
            disabled={!inputText.trim() || isLoading}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-[#BD6E49] text-white transition hover:bg-[#A95532] disabled:opacity-40"
          >
            <svg className="h-4 w-4 rotate-90" fill="currentColor" viewBox="0 0 20 20">
              <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
            </svg>
          </button>
        </form>
      </div>
    )
  }
}
