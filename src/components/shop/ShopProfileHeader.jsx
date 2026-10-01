import { useState } from 'react'
import { formatFollowers, formatNumber } from '../../utils/format'
import { MallBadge } from '../ui/Badge'
import { IconChat, IconClock, IconLocation, IconStar } from '../ui/Icons'
import SmartImage from '../ui/SmartImage'

/** Header trang shop: ảnh bìa + avatar + thông tin + nút theo dõi/chat */
export default function ShopProfileHeader({ shop, productCount, totalSold, onFollow, onChat }) {
  const [tab, setTab] = useState('all')
  if (!shop) return null

  return (
    <div className="overflow-hidden rounded-sm bg-white">
      <div
        className="h-[120px] w-full"
        style={{ backgroundImage: `linear-gradient(120deg, hsl(${shop.hue} 80% 45%), hsl(${(shop.hue + 45) % 360} 78% 60%))` }}
      />

      <div className="flex flex-col gap-4 px-4 pb-4 md:flex-row md:items-start">
        <div className="-mt-10 flex items-start gap-3 md:w-[420px]">
          <span className="grid h-[86px] w-[86px] shrink-0 place-items-center overflow-hidden rounded-full border-4 border-white bg-white shadow-card">
            <SmartImage src={shop.avatar} fallback={shop.avatar} alt={shop.name} className="h-full w-full object-cover" />
          </span>
          <div className="min-w-0 pt-11">
            <div className="flex items-center gap-1.5">
              <h1 className="truncate text-[16px] font-semibold text-ink">{shop.name}</h1>
              {shop.mall ? <MallBadge /> : null}
            </div>
            <p className="mt-0.5 line-clamp-2 text-[12px] text-muted">{shop.tagline}</p>
          </div>
        </div>

        <div className="flex flex-1 flex-wrap items-center gap-x-6 gap-y-2 pt-3 text-[13px] text-ink-soft">
          <span className="flex items-center gap-1.5">
            <IconStar className="h-4 w-4 text-[#ffce3d]" filled />
            <b className="text-ink">{shop.rating}</b>
            <span className="text-muted">({formatFollowers(shop.ratingCount)} đánh giá)</span>
          </span>
          <span className="flex items-center gap-1.5">
            <b className="text-ink">{formatNumber(productCount)}</b>
            <span className="text-muted">Sản phẩm</span>
          </span>
          <span className="flex items-center gap-1.5">
            <b className="text-ink">{formatFollowers(shop.followers)}</b>
            <span className="text-muted">Người theo dõi</span>
          </span>
          <span className="flex items-center gap-1.5">
            <b className="text-ink">{formatNumber(totalSold)}</b>
            <span className="text-muted">Đã bán</span>
          </span>
        </div>

        <div className="flex shrink-0 gap-2 pt-3">
          <button
            type="button"
            onClick={onFollow}
            className={`flex items-center gap-1.5 rounded-sm border px-3 py-1.5 text-[13px] font-medium transition ${
              shop.followed
                ? 'border-line bg-white text-ink-soft hover:border-brand hover:text-brand'
                : 'border-brand bg-brand text-white hover:brightness-105'
            }`}
          >
            ♥ {shop.followed ? 'Đang Theo Dõi' : 'Theo Dõi'}
          </button>
          <button
            type="button"
            onClick={onChat}
            className="flex items-center gap-1.5 rounded-sm border border-line px-3 py-1.5 text-[13px] text-ink-soft transition hover:border-brand hover:text-brand"
          >
            <IconChat className="h-4 w-4" />
            Chat Ngay
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-6 gap-y-1 border-t border-line bg-page px-4 py-2 text-[12px] text-muted">
        <span className="flex items-center gap-1.5">
          <IconLocation className="h-3.5 w-3.5" />
          {shop.location}
        </span>
        <span className="flex items-center gap-1.5">
          <IconClock className="h-3.5 w-3.5" />
          Tỉ lệ phản hồi {shop.responseRate}% · Thời gian phản hồi {shop.responseTime}
        </span>
        <span>Tham gia ShopNova từ {shop.joined}</span>
      </div>

      <div className="flex gap-6 border-t border-line px-4">
        {[
          { id: 'all', label: 'Sản Phẩm Của Shop' },
          { id: 'categories', label: 'Danh Mục Trong Shop' },
        ].map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`py-3 text-[14px] transition ${
              tab === t.id ? 'border-b-2 border-brand font-medium text-brand' : 'text-ink-soft hover:text-brand'
            }`}
          >
            {t.label}
          </button>
        ))}
        <span className="ml-auto hidden items-center text-[12px] text-muted md:flex">
          Trang {tab === 'all' ? 'danh sách sản phẩm' : 'phân loại theo ngành hàng'} của shop
        </span>
      </div>
    </div>
  )
}
