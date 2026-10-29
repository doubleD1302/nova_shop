import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useOrders } from '../../context/OrderContext'
import { IconBell } from '../ui/Icons'

const formatNoticeDate = (value) =>
  new Date(value).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })

export default function NotificationBell() {
  const [open, setOpen] = useState(false)
  const { user } = useAuth()
  const { getNotificationsByBuyer, markNotificationRead, markAllNotificationsRead } = useOrders()
  const notifications = getNotificationsByBuyer(user?.id)
  const unreadCount = notifications.filter((notification) => !notification.read).length

  return (
    <div className="relative">
      <button
        type="button"
        aria-label={unreadCount ? `Thông báo, ${unreadCount} tin mới` : 'Thông báo'}
        aria-expanded={open}
        onClick={() => setOpen((isOpen) => !isOpen)}
        className={`relative grid h-10 w-10 place-items-center rounded-full transition ${
          open ? 'bg-[#F5E7D4] text-[#BD6E49]' : 'text-[#49352D] hover:bg-[#F5E7D4] hover:text-[#BD6E49]'
        }`}
      >
        <IconBell className="h-[22px] w-[22px]" />
        {unreadCount > 0 ? (
          <span className="absolute right-0 top-0 grid h-[18px] min-w-[18px] place-items-center rounded-full border-2 border-[#FFFCF7] bg-[#BD6E49] px-1 text-[10px] font-bold leading-none text-white shadow-sm">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <section
          aria-label="Thông báo mới"
          className="absolute right-0 top-full z-[130] mt-2 w-[min(360px,calc(100vw-24px))] overflow-hidden rounded-xl border border-[#E6D5C2] bg-[#FFFCF7] shadow-xl"
        >
          <header className="flex items-center justify-between border-b border-[#E6D5C2] px-4 py-3">
            <div>
              <h2 className="text-sm font-bold text-[#49352D]">Thông báo</h2>
              <p className="mt-0.5 text-[11px] text-[#8B7566]">Cập nhật đơn hàng của bạn</p>
            </div>
            {unreadCount > 0 ? (
              <button
                type="button"
                onClick={() => markAllNotificationsRead(user?.id)}
                className="text-[11px] font-medium text-[#BD6E49] hover:underline"
              >
                Đánh dấu đã đọc
              </button>
            ) : null}
          </header>

          {notifications.length ? (
            <div className="max-h-[360px] overflow-y-auto">
              {notifications.slice(0, 6).map((notification) => (
                <Link
                  key={notification.id}
                  to={notification.orderId ? `/don-hang/${notification.orderId}` : '/don-hang'}
                  onClick={() => {
                    markNotificationRead(notification.id)
                    setOpen(false)
                  }}
                  className={`block border-b border-[#E6D5C2]/60 px-4 py-3 transition hover:bg-[#F5E7D4] ${
                    notification.read ? 'bg-[#FFFCF7]' : 'bg-[#FBF3E8]'
                  }`}
                >
                  <span className="flex items-start gap-2.5">
                    <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[#BD6E49]" style={{ opacity: notification.read ? 0 : 1 }} />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13px] font-semibold text-[#49352D]">{notification.title}</span>
                      <span className="mt-1 block text-[12px] leading-5 text-[#8B7566]">{notification.message}</span>
                      <time className="mt-1.5 block text-[10px] text-[#8B7566]">{formatNoticeDate(notification.createdAt)}</time>
                    </span>
                  </span>
                </Link>
              ))}
            </div>
          ) : (
            <div className="px-5 py-8 text-center">
              <span className="mx-auto grid h-11 w-11 place-items-center rounded-full bg-[#F5E7D4] text-[#BD6E49]">
                <IconBell className="h-5 w-5" />
              </span>
              <p className="mt-3 text-[13px] font-semibold text-[#49352D]">Chưa có thông báo mới</p>
              <p className="mt-1 text-[11px] text-[#8B7566]">Thông tin đơn hàng sẽ hiện ở đây.</p>
            </div>
          )}

          <footer className="border-t border-[#E6D5C2] px-4 py-2.5 text-center">
            <Link to="/don-hang" onClick={() => setOpen(false)} className="text-[12px] font-semibold text-[#BD6E49] hover:underline">
              Xem đơn hàng
            </Link>
          </footer>
        </section>
      ) : null}
    </div>
  )
}
