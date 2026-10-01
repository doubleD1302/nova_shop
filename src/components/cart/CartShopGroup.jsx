import { Link } from 'react-router-dom'
import { useCart } from '../../context/CartContext'
import { formatVnd } from '../../utils/format'
import { MallBadge } from '../ui/Badge'
import { IconChat, IconTrash } from '../ui/Icons'
import Price from '../ui/Price'
import QuantityStepper from '../ui/QuantityStepper'
import SmartImage from '../ui/SmartImage'

/** Ô checkbox vuông màu cam dùng trong giỏ hàng */
export function CartCheckbox({ checked, onChange, label }) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-[13px] text-ink-soft">
      <span
        className={`grid h-4 w-4 shrink-0 place-items-center rounded-[2px] border transition ${
          checked ? 'border-brand bg-brand text-white' : 'border-[#c9c9c9] bg-white'
        }`}
      >
        {checked ? (
          <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="3.5">
            <path d="M5 13l4.5 4.5L19 7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ) : null}
      </span>
      <input type="checkbox" checked={checked} onChange={onChange} className="hidden" />
      {label ? <span>{label}</span> : null}
    </label>
  )
}

/** Nhóm sản phẩm theo 1 shop trong giỏ hàng */
export default function CartShopGroup({ group }) {
  const { updateQty, toggleSelect, selectShop, removeFromCart } = useCart()

  return (
    <div className="border-b border-line last:border-b-0">
      <div className="flex items-center gap-2 border-b border-line bg-page/60 px-3 py-2">
        <CartCheckbox checked={group.allSelected} onChange={() => selectShop(group.shopId, !group.allSelected)} />
        <Link to={`/shop/${group.shopId}`} className="flex items-center gap-1.5 text-[13px] font-medium text-ink hover:text-brand">
          <span className="rounded-[2px] bg-brand px-1 text-[10px] font-bold uppercase text-white">Shop</span>
          {group.shopName}
          {group.shopMall ? <MallBadge /> : null}
        </Link>
        <button
          type="button"
          className="ml-auto flex items-center gap-1 text-[12px] text-ink-soft transition hover:text-brand"
        >
          <IconChat className="h-3.5 w-3.5" />
          Chat
        </button>
      </div>

      {group.items.map((item) => (
        <div key={item.key} className="flex flex-wrap items-center gap-3 border-b border-line px-3 py-3 last:border-b-0 md:flex-nowrap">
          <CartCheckbox checked={item.selected} onChange={() => toggleSelect(item.key)} />

          <Link to={`/san-pham/${item.slug}`} className="shrink-0">
            <SmartImage
              src={item.image}
              fallback={item.image}
              alt={item.name}
              className="h-[80px] w-[80px] rounded-sm border border-line object-cover"
            />
          </Link>

          <div className="min-w-0 flex-1">
            <Link to={`/san-pham/${item.slug}`} className="line-clamp-2 text-[13px] leading-[18px] text-ink hover:text-brand">
              {item.name}
            </Link>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <span className="flex items-center gap-1 rounded-sm bg-brand-soft px-1.5 py-[2px] text-[11px] text-brand">
                Phân loại: {item.variant || 'Mặc định'}
                <span className="text-[10px]">▾</span>
              </span>
              {item.freeship ? <span className="rounded-sm bg-free/10 px-1.5 py-[2px] text-[11px] text-free">FreeShip</span> : null}
            </div>
          </div>

          <div className="hidden w-[120px] shrink-0 text-center lg:block">
            {item.originalPrice > item.price ? (
              <span className="block text-[12px] text-muted line-through">{formatVnd(item.originalPrice)}</span>
            ) : null}
            <Price value={item.price} size="sm" className="text-ink-soft" />
          </div>

          <div className="shrink-0">
            <QuantityStepper value={item.qty} onChange={(v) => updateQty(item.key, v)} max={Math.min(99, item.stock)} size="sm" />
          </div>

          <div className="w-[110px] shrink-0 text-right">
            <Price value={item.price * item.qty} size="md" className="text-brand" />
          </div>

          <button
            type="button"
            onClick={() => removeFromCart(item.key)}
            className="ml-auto shrink-0 text-[12px] text-ink-soft transition hover:text-brand md:ml-0"
          >
            <IconTrash className="h-4 w-4" />
            <span className="ml-1 hidden lg:inline">Xoá</span>
          </button>
        </div>
      ))}
    </div>
  )
}
