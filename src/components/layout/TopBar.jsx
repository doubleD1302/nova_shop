import { Link } from 'react-router-dom'
import { IconBell, IconChevronDown, IconGlobe, IconStore } from '../ui/Icons'

const SOCIALS = ['f', '◎', '♪', 'in']

/** Thanh tiện ích trên cùng (nền xanh nhạt) */
export default function TopBar() {
  return (
    <div className="border-b border-white/60 bg-topbar">
      <div className="container-shop flex h-9 items-center justify-between text-[13px] text-ink-soft">
        <div className="flex items-center gap-4">
          <Link to="/nguoi-ban" className="flex items-center gap-1.5 transition hover:text-brand">
            <IconStore className="h-3.5 w-3.5" />
            Kênh Người Bán
          </Link>
          <span className="hidden h-3.5 w-px bg-line sm:block" />
          <Link to="/tim-kiem?sort=newest" className="hidden transition hover:text-brand sm:block">
            Tải Ứng Dụng
          </Link>
          <span className="hidden h-3.5 w-px bg-line sm:block" />
          <span className="hidden items-center gap-1.5 sm:flex">
            Kết nối:
            {SOCIALS.map((s) => (
              <span
                key={s}
                className="grid h-4 w-4 place-items-center rounded-[3px] bg-white text-[9px] font-bold text-ink-soft"
              >
                {s}
              </span>
            ))}
          </span>
        </div>

        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5 transition hover:text-brand">
            <IconBell className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Thông Báo</span>
          </span>
          <span className="hidden items-center gap-1.5 transition hover:text-brand sm:flex">
            <span className="grid h-3.5 w-3.5 place-items-center rounded-full border border-current text-[9px] font-bold">
              ?
            </span>
            Hỗ Trợ
          </span>
          <span className="flex items-center gap-1 transition hover:text-brand">
            <IconGlobe className="h-3.5 w-3.5" />
            Tiếng Việt
            <IconChevronDown className="h-3 w-3" />
          </span>
        </div>
      </div>
    </div>
  )
}
