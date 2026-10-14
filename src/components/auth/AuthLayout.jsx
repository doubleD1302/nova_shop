import { Link } from 'react-router-dom'
import { users } from "../../data/users";

/** Khung 2 cột cho trang đăng nhập / đăng ký: banner trái + form phải */
export default function AuthLayout({ title, subtitle, bannerTitle, bannerEmojis = '🛍️', children }) {
  return (
    <div className="flex items-stretch gap-0 overflow-hidden rounded-sm bg-white">
      {/* Banner trái */}
      <div className="hidden w-[420px] shrink-0 flex-col justify-between bg-gradient-to-br from-[#f86a4b] to-[#ee4d2d] p-8 lg:flex">
        <div>
          <span className="text-[26px] font-black text-white">ShopNova</span>
          <p className="mt-2 text-[13px] text-white/90">
            Sàn thương mại điện tử đa người bán — nơi hàng nghìn gian hàng gặp gỡ hàng triệu người mua.
          </p>
        </div>
        <div className="text-[74px] leading-none">{bannerEmojis}</div>
        <div>
          <p className="text-[18px] font-bold text-white">{bannerTitle}</p>
          <ul className="mt-3 space-y-1.5 text-[12px] text-white/90">
            <li>• Nhiều người bán — mỗi shop một gian hàng riêng</li>
            <li>• Một giỏ hàng mua được sản phẩm của nhiều shop</li>
            <li>• Theo dõi đơn hàng và đánh giá người bán</li>
            <li>• Kênh người bán quản lý sản phẩm & đơn hàng</li>
          </ul>
        </div>
      </div>

      {/* Form phải */}
      <div className="min-w-0 flex-1 px-6 py-8 lg:px-12">
        <h1 className="text-[20px] font-semibold text-ink">{title}</h1>
        <p className="mt-1 text-[13px] text-muted">{subtitle}</p>
        <div className="mt-6 max-w-[420px]">{children}</div>
      </div>
    </div>
  )
}

/** Danh sách tài khoản demo để đăng nhập nhanh */
export function DemoAccounts({ onPick }) {
  return (
    <div className="mt-6 rounded-sm border border-dashed border-line bg-page/60 p-3">
      <p className="mb-2 text-[12px] font-semibold uppercase text-muted">Tài khoản demo (mật khẩu: 123456)</p>
      <div className="flex flex-wrap gap-2">
        {users.map((u) => (
          <button
            key={u.id}
            type="button"
            onClick={() => onPick(u)}
            className="flex items-center gap-1.5 rounded-full border border-line bg-white px-2.5 py-1 text-[12px] text-ink-soft transition hover:border-brand hover:text-brand"
          >
            <span>{u.avatarEmoji}</span>
            {u.username}
            <span className="text-[10px] text-muted">{u.role === 'seller' ? '· người bán' : '· người mua'}</span>
          </button>
        ))}
      </div>
      <p className="mt-2 text-[11px] text-muted">
        Người bán đăng nhập sẽ vào được <b>Kênh Người Bán</b> tại{' '}
        <Link to="/nguoi-ban" className="text-brand hover:underline">
          /nguoi-ban
        </Link>
        .
      </p>
    </div>
  )
}
