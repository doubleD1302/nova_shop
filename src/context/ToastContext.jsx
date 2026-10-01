import { createContext, useCallback, useContext, useMemo, useState } from 'react'

const ToastContext = createContext(null)

const ICONS = { success: '✅', error: '⛔', info: 'ℹ️', cart: '🛒' }

const STYLES = {
  success: 'border-emerald-200 bg-white text-emerald-700',
  error: 'border-rose-200 bg-white text-rose-700',
  info: 'border-sky-200 bg-white text-sky-700',
  cart: 'border-brand/30 bg-white text-brand',
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const removeToast = useCallback((id) => {
    setToasts((list) => list.filter((t) => t.id !== id))
  }, [])

  const pushToast = useCallback(
    (message, type = 'success', duration = 2600) => {
      const id = `${Date.now()}${Math.random().toString(36).slice(2, 6)}`
      setToasts((list) => [...list, { id, message, type }])
      window.setTimeout(() => removeToast(id), duration)
      return id
    },
    [removeToast],
  )

  const value = useMemo(() => ({ toasts, pushToast, removeToast }), [toasts, pushToast, removeToast])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed right-4 top-4 z-[999] flex w-[320px] flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`animate-slide-in pointer-events-auto flex items-start gap-2 rounded-md border px-3 py-2.5 text-[13px] shadow-pop ${
              STYLES[t.type] || STYLES.info
            }`}
          >
            <span className="text-[15px] leading-none">{ICONS[t.type] || ICONS.info}</span>
            <span className="flex-1 leading-[18px]">{t.message}</span>
            <button
              type="button"
              onClick={() => removeToast(t.id)}
              className="text-muted transition hover:text-ink"
              aria-label="Đóng"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast phải dùng bên trong <ToastProvider>')
  return ctx
}

export default ToastContext
