import { NavLink, Link } from 'react-router-dom'
import { navLinks } from '../../data/homeContent'
import { IconStore, IconMenu } from '../ui/Icons'

/** Thanh điều hướng danh mục chính - Tone Terracotta + Cream */
export default function CategoryNav() {
  // Loại bỏ link Trang Chủ ở danh sách giữa vì đã có 'Danh Mục' đại diện bên trái
  const linksWithoutHome = navLinks.filter((l) => l.to !== '/')

  return (
    <div className="border-b border-[#E6D5C2] bg-[#FFFCF7]">
      <div className="container-shop flex h-11 items-center justify-between gap-4">
        {/* Nút Danh Mục bên trái */}
        <Link
          to="/"
          className="flex shrink-0 items-center gap-2 py-2 text-[14px] font-semibold text-[#49352D] transition hover:text-[#BD6E49]"
        >
          <IconMenu className="h-4.5 w-4.5 text-[#49352D]" />
          <span>Danh Mục</span>
        </Link>

        <span className="h-4 w-px bg-[#E6D5C2] shrink-0" />

        {/* Các liên kết ngành hàng ở giữa */}
        <nav className="no-scrollbar flex flex-1 items-center gap-5 sm:gap-6 overflow-x-auto text-[13px] font-medium text-[#49352D]">
          {linksWithoutHome.map((link) => (
            <NavLink
              key={link.label}
              to={link.to}
              className={({ isActive }) =>
                `whitespace-nowrap py-2.5 transition font-medium ${
                  isActive
                    ? 'text-[#BD6E49] font-semibold border-b-2 border-[#BD6E49]'
                    : 'text-[#49352D] hover:text-[#BD6E49]'
                }`
              }
            >
              {link.label}
            </NavLink>
          ))}
        </nav>

        {/* Cửa hàng chính hãng bên phải */}
        <Link
          to="/tim-kiem?mall=1"
          className="hidden shrink-0 items-center gap-1.5 rounded-lg border border-[#E6D5C2] bg-[#FFFCF7] px-3 py-1.5 text-[12px] font-medium text-[#49352D] shadow-2xs transition hover:border-[#BD6E49] hover:text-[#BD6E49] lg:flex"
        >
          <IconStore className="h-4 w-4 text-[#BD6E49]" />
          <span>Cửa hàng chính hãng</span>
        </Link>
      </div>
    </div>
  )
}
