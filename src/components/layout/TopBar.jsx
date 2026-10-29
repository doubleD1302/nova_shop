import { Link } from 'react-router-dom'
import { IconBell, IconChevronDown, IconGlobe, IconStore } from '../ui/Icons'

/** Thanh tiện ích trên cùng - Tone Terracotta + Cream */
export default function TopBar() {
  return (
    <div className="border-b border-[#E6D5C2] bg-[#F5E7D4]">
      <div className="container-shop flex h-9 items-center justify-between text-[12px] text-[#8B7566]">
        {/* Nhóm trái */}
        <div className="flex items-center gap-4">
          <Link to="/nguoi-ban" className="flex items-center gap-1.5 font-medium transition hover:text-[#BD6E49]">
            <IconStore className="h-3.5 w-3.5 text-[#BD6E49]" />
            <span className="text-[#49352D] hover:text-[#BD6E49]">Kênh Người Bán</span>
          </Link>

          <span className="hidden h-3 w-px bg-[#E6D5C2] sm:block" />

          <Link to="/tim-kiem?sort=newest" className="hidden items-center gap-1.5 transition hover:text-[#BD6E49] sm:flex">
            <svg className="h-3.5 w-3.5 text-[#8B7566]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <rect x="5" y="2" width="14" height="20" rx="3" strokeWidth="1.8" />
              <circle cx="12" cy="18" r="1" fill="currentColor" />
            </svg>
            <span>Tải Ứng Dụng</span>
          </Link>

          <span className="hidden h-3 w-px bg-[#E6D5C2] sm:block" />

          <div className="hidden items-center gap-2 sm:flex">
            <span>Kết nối:</span>
            <div className="flex items-center gap-1.5 text-[#8B7566]">
              {/* Facebook */}
              <a href="#facebook" aria-label="Facebook" className="grid h-4 w-4 place-items-center rounded-full transition hover:text-[#BD6E49]">
                <svg className="h-3 w-3 fill-current" viewBox="0 0 24 24"><path d="M22 12c0-5.52-4.48-10-10-10S2 6.48 2 12c0 4.84 3.44 8.87 8 9.8V15H8v-3h2V9.5C10 7.57 11.57 6 13.5 6H16v3h-2c-.55 0-1 .45-1 1v2h3v3h-3v6.95c5.05-.5 9-4.76 9-9.95z"/></svg>
              </a>
              {/* Instagram */}
              <a href="#instagram" aria-label="Instagram" className="grid h-4 w-4 place-items-center rounded-full transition hover:text-[#BD6E49]">
                <svg className="h-3 w-3 fill-current" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>
              </a>
              {/* YouTube */}
              <a href="#youtube" aria-label="YouTube" className="grid h-4 w-4 place-items-center rounded-full transition hover:text-[#BD6E49]">
                <svg className="h-3 w-3 fill-current" viewBox="0 0 24 24"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
              </a>
              {/* TikTok */}
              <a href="#tiktok" aria-label="TikTok" className="grid h-4 w-4 place-items-center rounded-full transition hover:text-[#BD6E49]">
                <svg className="h-3 w-3 fill-current" viewBox="0 0 24 24"><path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.24 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/></svg>
              </a>
            </div>
          </div>
        </div>

        {/* Nhóm phải */}
        <div className="flex items-center gap-4">
          <Link to="/don-hang" className="flex items-center gap-1.5 transition hover:text-[#BD6E49]">
            <IconBell className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Thông Báo</span>
          </Link>
          <span className="hidden items-center gap-1.5 transition hover:text-[#BD6E49] sm:flex">
            <span className="grid h-3.5 w-3.5 place-items-center rounded-full border border-current text-[9px] font-bold">
              ?
            </span>
            <span>Hỗ Trợ</span>
          </span>
          <span className="flex items-center gap-1 transition hover:text-[#BD6E49]">
            <IconGlobe className="h-3.5 w-3.5" />
            <span>Tiếng Việt</span>
            <IconChevronDown className="h-3 w-3" />
          </span>
        </div>
      </div>
    </div>
  )
}
