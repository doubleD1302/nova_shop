import { NavLink } from 'react-router-dom'
import { navLinks } from '../../data/homeContent'
import { IconShieldCheck } from '../ui/Icons'

/** Thanh danh mục màu cam ngay dưới header */
export default function CategoryNav() {
  return (
    <div className="bg-gradient-to-r from-[#ee4d2d] via-[#f2603f] to-[#f97a3c]">
      <div className="container-shop flex h-10 items-center justify-between gap-4">
        <nav className="no-scrollbar flex flex-1 items-center gap-6 overflow-x-auto text-[14px] text-white/95">
          {navLinks.map((link) => (
            <NavLink
              key={link.label}
              to={link.to}
              end={link.to === '/'}
              className={({ isActive }) =>
                `whitespace-nowrap py-1 transition hover:text-white ${
                  isActive ? 'font-semibold text-white' : 'text-white/90'
                }`
              }
            >
              {link.label}
            </NavLink>
          ))}
        </nav>
        <span className="hidden shrink-0 items-center gap-1.5 text-[13px] text-white/95 lg:flex">
          <IconShieldCheck className="h-4 w-4" />
          Đảm bảo 100% Chính Hãng
        </span>
      </div>
    </div>
  )
}
