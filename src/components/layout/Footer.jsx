import { Link } from 'react-router-dom'
import { followChannels, footerColumns, paymentMethods } from '../../data/homeContent'

/** Mã QR giả lập vẽ bằng SVG (tất định, không cần ảnh ngoài) */
function QrBox() {
  const cells = []
  const size = 11
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const corner = (x < 3 && y < 3) || (x > size - 4 && y < 3) || (x < 3 && y > size - 4)
      const on = corner || (x * 7 + y * 13 + ((x * y) % 5)) % 3 === 0
      if (on) cells.push(<rect key={`${x}-${y}`} x={x * 6} y={y * 6} width="6" height="6" />)
    }
  }
  return (
    <svg viewBox="0 0 66 66" className="h-[66px] w-[66px]" fill="#16243d" aria-label="QR tải ứng dụng">
      <rect width="66" height="66" fill="#ffffff" />
      {cells}
    </svg>
  )
}

const StoreButton = ({ icon, top, bottom }) => (
  <span className="flex items-center gap-2 rounded-[3px] border border-white/25 bg-white px-2 py-1 text-left">
    <span className="text-[14px] leading-none">{icon}</span>
    <span className="leading-tight">
      <span className="block text-[8px] uppercase text-ink-soft">{top}</span>
      <span className="block text-[11px] font-semibold text-ink">{bottom}</span>
    </span>
  </span>
)

/** Footer nền xanh navy theo đúng thiết kế */
export default function Footer() {
  return (
    <footer className="mt-8 bg-footer text-white">
      <div className="container-shop grid grid-cols-2 gap-x-6 gap-y-8 py-9 md:grid-cols-3 lg:grid-cols-5">
        {footerColumns.map((col) => (
          <div key={col.title}>
            <h3 className="mb-3 text-[13px] font-bold uppercase tracking-wide text-white">{col.title}</h3>
            <ul className="space-y-1.5">
              {col.links.map((l) => (
                <li key={l.label}>
                  <Link to="/tim-kiem" className="text-[13px] text-white/65 transition hover:text-brand-light">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}

        <div>
          <h3 className="mb-3 text-[13px] font-bold uppercase tracking-wide text-white">THANH TOÁN</h3>
          <div className="flex flex-wrap gap-1.5">
            {paymentMethods.map((p) => (
              <span
                key={p.name}
                className="grid h-7 min-w-[52px] place-items-center rounded-[3px] bg-white px-2 text-[11px] font-bold"
              >
                <span className={p.color}>{p.name}</span>
              </span>
            ))}
          </div>

          <h3 className="mb-3 mt-5 text-[13px] font-bold uppercase tracking-wide text-white">THEO DÕI SHOPNOVA</h3>
          <ul className="space-y-1.5">
            {followChannels.map((c) => (
              <li key={c.name}>
                <span className="flex items-center gap-2 text-[13px] text-white/65 transition hover:text-brand-light">
                  <span className="grid h-[18px] w-[18px] place-items-center rounded-[3px] bg-white/15 text-[10px] font-bold text-white">
                    {c.icon}
                  </span>
                  {c.name}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h3 className="mb-3 text-[13px] font-bold uppercase tracking-wide text-white">TẢI ỨNG DỤNG SHOPNOVA</h3>
          <div className="flex items-start gap-3">
            <span className="rounded-[3px] bg-white p-1">
              <QrBox />
            </span>
            <div className="flex flex-col gap-2">
              <StoreButton icon="🍎" top="Tải về trên" bottom="App Store" />
              <StoreButton icon="▶️" top="Tải về trên" bottom="Google Play" />
            </div>
          </div>
        </div>
      </div>

      <div className="border-t border-white/10 py-4">
        <div className="container-shop flex flex-col items-center justify-between gap-2 text-[12px] text-white/50 md:flex-row">
          <span>© 2025 ShopNova — Sàn thương mại điện tử đa người bán. Dự án frontend demo.</span>
          <span className="flex flex-wrap items-center justify-center gap-3">
            <Link to="/tim-kiem" className="transition hover:text-brand-light">
              Điều khoản sử dụng
            </Link>
            <Link to="/tim-kiem" className="transition hover:text-brand-light">
              Chính sách bảo mật
            </Link>
            <Link to="/nguoi-ban" className="transition hover:text-brand-light">
              Dành cho người bán
            </Link>
          </span>
        </div>
      </div>
    </footer>
  )
}
