import { Link } from 'react-router-dom'
import { formatFollowers } from '../../utils/format'
import { MallBadge } from '../ui/Badge'
import { IconChat, IconClock, IconLocation, IconStore } from '../ui/Icons'
import SmartImage from '../ui/SmartImage'

/** Thẻ thông tin shop nằm bên phải khu mua hàng (trang chi tiết sản phẩm) */
export default function ShopCard({ shop, onFollow, onChat, className = '' }) {
  if (!shop) return null
  return (
    <div className={`flex items-center gap-3 border-b border-line px-4 py-3 ${className}`}>
      <Link to={`/shop/${shop.id}`} className="shrink-0">
        <span className="grid h-12 w-12 place-items-center overflow-hidden rounded-full border border-line bg-white">
          <SmartImage src={shop.avatar} fallback={shop.avatar} alt={shop.name} className="h-full w-full object-cover" />
        </span>
      </Link>

      <div className="min-w-0 flex-1">
        <Link to={`/shop/${shop.id}`} className="flex items-center gap-1.5">
          <span className="truncate text-[13px] font-medium text-ink hover:text-brand">{shop.name}</span>
          {shop.mall ? <MallBadge /> : null}
        </Link>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted">
          <span className="flex items-center gap-1">
            <IconStore className="h-3 w-3" />
            {shop.productCount} sản phẩm
          </span>
          <span className="flex items-center gap-1">
            <IconLocation className="h-3 w-3" />
            {shop.location}
          </span>
          <span className="flex items-center gap-1">
            <IconClock className="h-3 w-3" />
            Tỉ lệ phản hồi {shop.responseRate}%
          </span>
        </div>
      </div>

      <div className="flex shrink-0 flex-col gap-1.5">
        <button
          type="button"
          onClick={onFollow}
          className={`flex items-center gap-1 rounded-sm border px-2.5 py-1 text-[12px] font-medium transition ${
            shop.followed
              ? 'border-line bg-white text-ink-soft hover:border-brand hover:text-brand'
              : 'border-brand bg-brand text-white hover:brightness-105'
          }`}
        >
          {shop.followed ? 'Đang Theo Dõi' : '+ Theo Dõi'}
        </button>
        <button
          type="button"
          onClick={onChat}
          className="flex items-center gap-1 rounded-sm border border-line px-2.5 py-1 text-[12px] text-ink-soft transition hover:border-brand hover:text-brand"
        >
          <IconChat className="h-3.5 w-3.5" />
          Chat
        </button>
      </div>

      <span className="hidden text-[11px] text-muted xl:block">
        {formatFollowers(shop.followers)} người theo dõi
      </span>
    </div>
  )
}
