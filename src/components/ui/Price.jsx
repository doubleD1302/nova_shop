import { splitVnd } from '../../utils/format'

const SIZES = {
  xs: 'text-[12px]',
  sm: 'text-[14px]',
  md: 'text-[16px]',
  lg: 'text-[20px]',
  xl: 'text-[28px]',
  '2xl': 'text-[32px]',
}

/** Giá tiền kiểu ShopNova: số + ký hiệu ₫ nhỏ ở trên */
export default function Price({ value, size = 'md', className = '' }) {
  const { amount, symbol } = splitVnd(value)
  return (
    <span className={`font-medium tabular-nums ${SIZES[size] || SIZES.md} ${className}`}>
      {amount}
      <sup className="currency-symbol font-normal">{symbol}</sup>
    </span>
  )
}

/** Giá gốc gạch ngang */
export function OldPrice({ value, size = 'sm', className = '' }) {
  const { amount, symbol } = splitVnd(value)
  return (
    <span className={`tabular-nums text-muted line-through ${SIZES[size] || SIZES.sm} ${className}`}>
      {amount}
      <sup className="currency-symbol">{symbol}</sup>
    </span>
  )
}
