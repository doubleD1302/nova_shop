import { Link } from 'react-router-dom'

/** TRANG 404 */
export default function NotFoundPage() {
  return (
    <div className="mx-auto max-w-[620px] rounded-sm bg-white px-6 py-16 text-center">
      <p className="text-[64px] font-black leading-none text-brand">404</p>
      <h1 className="mt-2 text-[18px] font-bold text-ink">Không tìm thấy trang bạn cần</h1>
      <p className="mt-2 text-[13px] text-muted">
        Đường dẫn có thể đã thay đổi hoặc sản phẩm/gian hàng đã bị gỡ khỏi ShopNova.
      </p>

      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Link
          to="/"
          className="rounded-sm bg-brand px-5 py-2.5 text-[13px] font-medium text-white transition hover:brightness-105"
        >
          Về trang chủ
        </Link>
        <Link
          to="/tim-kiem"
          className="rounded-sm border border-line px-5 py-2.5 text-[13px] text-ink-soft transition hover:border-brand hover:text-brand"
        >
          Tìm kiếm sản phẩm
        </Link>
        <Link
          to="/shop"
          className="rounded-sm border border-line px-5 py-2.5 text-[13px] text-ink-soft transition hover:border-brand hover:text-brand"
        >
          Xem gian hàng
        </Link>
      </div>
    </div>
  )
}
