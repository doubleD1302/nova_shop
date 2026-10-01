import { IconBolt, IconTruck } from './Icons'

/** Nhãn MALL (nền xanh navy) */
export function MallBadge({ className = '' }) {
  return (
    <span
      className={`inline-flex items-center rounded-[2px] bg-mall px-1 py-[1px] text-[9px] font-bold uppercase leading-[14px] tracking-wide text-white ${className}`}
    >
      Mall
    </span>
  )
}

/** Nhãn YÊU THÍCH+ (nền đỏ cam) */
export function FavoriteBadge({ className = '' }) {
  return (
    <span
      className={`inline-flex items-center rounded-[2px] bg-brand px-1 py-[1px] text-[9px] font-bold uppercase leading-[14px] tracking-wide text-white ${className}`}
    >
      Yêu thích+
    </span>
  )
}

/** Nhãn giảm giá hình "cờ" ở góc phải (nền đỏ, chữ trắng) */
export function DiscountBadge({ percent, className = '' }) {
  if (!percent) return null
  return (
    <span className={`relative inline-block ${className}`}>
      <span className="flex flex-col items-center bg-brand px-1 pt-[2px] pb-[3px] text-[11px] font-bold leading-none text-white">
        -{percent}%
      </span>
      <span
        className="absolute -bottom-[4px] left-0 h-[4px] w-full bg-brand"
        style={{ clipPath: 'polygon(0 0, 100% 0, 50% 100%)' }}
      />
    </span>
  )
}

/** Nhãn FreeShip / Extra (xanh lá) */
export function ShipBadge({ type = 'freeship', className = '' }) {
  const isFree = type === 'freeship'
  return (
    <span
      className={`inline-flex items-center gap-[2px] rounded-[2px] px-1 py-[1px] text-[9px] font-semibold leading-[14px] ${
        isFree ? 'bg-free text-white' : 'border border-free bg-white text-free'
      } ${className}`}
    >
      <IconTruck className="h-[10px] w-[10px]" />
      {isFree ? 'FreeShip' : 'Extra'}
    </span>
  )
}

/** Nhãn Flash Sale */
export function FlashBadge({ className = '' }) {
  return (
    <span
      className={`inline-flex items-center gap-[2px] rounded-[2px] bg-brand px-1 py-[1px] text-[9px] font-bold uppercase leading-[14px] text-white ${className}`}
    >
      <IconBolt className="h-[9px] w-[9px]" />
      Flash
    </span>
  )
}

/** Dải nhãn dọc ở góc trái ảnh: MALL / YÊU THÍCH+ / FreeShip / Extra */
export function ProductBadgeStack({ product, className = '' }) {
  const tags = []
  if (product.mall) tags.push({ key: 'mall', node: <MallBadge /> })
  if (product.favorites) tags.push({ key: 'fav', node: <FavoriteBadge /> })
  if (product.freeship) tags.push({ key: 'free', node: <ShipBadge type="freeship" /> })
  if (product.extraShip) tags.push({ key: 'extra', node: <ShipBadge type="extra" /> })
  if (!tags.length) return null
  return (
    <div className={`flex flex-col items-start gap-1 ${className}`}>
      {tags.map((t) => (
        <span key={t.key}>{t.node}</span>
      ))}
    </div>
  )
}
