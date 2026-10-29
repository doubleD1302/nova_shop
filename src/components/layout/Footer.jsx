import { Link } from 'react-router-dom'
import { followChannels, footerColumns, paymentMethods } from '../../data/homeContent'

/** Mã QR giả lập vẽ bằng SVG */
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
    <svg viewBox="0 0 66 66" className="h-[66px] w-[66px]" fill="#49352D" aria-label="QR tải ứng dụng">
      <rect width="66" height="66" fill="#FFFCF7" />
      {cells}
    </svg>
  )
}

const StoreButton = ({ icon, top, bottom }) => (
  <span className="flex items-center gap-2 rounded-lg border border-[#E6D5C2] bg-[#FFFCF7] px-2.5 py-1 text-left shadow-2xs">
    <span className="text-[14px] leading-none">{icon}</span>
    <span className="leading-tight">
      <span className="block text-[8px] uppercase text-[#8B7566]">{top}</span>
      <span className="block text-[11px] font-semibold text-[#49352D]">{bottom}</span>
    </span>
  </span>
)

/** Footer nền Terracotta + Cream #F5E7D4 đồng bộ toàn trang */
export default function Footer() {
  return (
    <footer className="mt-10 border-t border-[#E6D5C2] bg-[#F5E7D4] text-[#8B7566]">
      <div className="container-shop grid grid-cols-2 gap-x-6 gap-y-8 py-10 md:grid-cols-3 lg:grid-cols-5">
        {footerColumns.map((col) => (
          <div key={col.title}>
            <h3 className="mb-3 text-[13px] font-bold uppercase tracking-wide text-[#49352D]">{col.title}</h3>
            <ul className="space-y-2">
              {col.links.map((l) => (
                <li key={l.label}>
                  <Link to="/tim-kiem" className="text-[13px] text-[#8B7566] transition hover:text-[#BD6E49]">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}

        <div>
          <h3 className="mb-3 text-[13px] font-bold uppercase tracking-wide text-[#49352D]">THANH TOÁN</h3>
          <div className="flex flex-wrap gap-1.5">
            {paymentMethods.map((p) => (
              <span
                key={p.name}
                className="grid h-7 min-w-[52px] place-items-center rounded-md border border-[#E6D5C2] bg-[#FFFCF7] px-2 text-[11px] font-bold shadow-2xs"
              >
                <span className={p.color}>{p.name}</span>
              </span>
            ))}
          </div>

          <h3 className="mb-3 mt-6 text-[13px] font-bold uppercase tracking-wide text-[#49352D]">THEO DÕI NOVASHOP</h3>
          <ul className="space-y-2">
            {followChannels.map((c) => (
              <li key={c.name}>
                <span className="flex items-center gap-2 text-[13px] text-[#8B7566] transition hover:text-[#BD6E49]">
                  <span className="grid h-5 w-5 place-items-center rounded-full border border-[#E6D5C2] bg-[#FFFCF7] text-[10px] font-bold text-[#BD6E49]">
                    {c.icon}
                  </span>
                  <span>{c.name}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h3 className="mb-3 text-[13px] font-bold uppercase tracking-wide text-[#49352D]">TẢI ỨNG DỤNG NOVASHOP</h3>
          <div className="flex items-start gap-3">
            <span className="rounded-xl border border-[#E6D5C2] bg-[#FFFCF7] p-1.5 shadow-2xs">
              <QrBox />
            </span>
            <div className="flex flex-col gap-2">
              <StoreButton icon="🍎" top="Tải về trên" bottom="App Store" />
              <StoreButton icon="▶️" top="Tải về trên" bottom="Google Play" />
            </div>
          </div>
        </div>
      </div>

      <div className="border-t border-[#E6D5C2] py-4 bg-[#FBF3E8]">
        <div className="container-shop flex flex-col items-center justify-between gap-2 text-[12px] text-[#8B7566] md:flex-row">
          <span>© 2026 NovaShop — Sàn thương mại điện tử đa người bán.</span>
          <span className="flex flex-wrap items-center justify-center gap-4">
            <Link to="/tim-kiem" className="transition hover:text-[#BD6E49]">
              Điều khoản sử dụng
            </Link>
            <Link to="/tim-kiem" className="transition hover:text-[#BD6E49]">
              Chính sách bảo mật
            </Link>
            <Link to="/nguoi-ban" className="transition hover:text-[#BD6E49]">
              Dành cho người bán
            </Link>
          </span>
        </div>
      </div>
    </footer>
  )
}
