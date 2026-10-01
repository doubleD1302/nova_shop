import { findProductById } from './products'
import { findUserById } from './users'

/**
 * ĐƠN HÀNG (mock) — 1 đơn có thể chứa sản phẩm của NHIỀU shop.
 * UI sẽ tự nhóm sản phẩm theo shop khi hiển thị.
 */

export const ORDER_STATUS = {
  pending: { label: 'Chờ xác nhận', color: 'text-amber-600', bg: 'bg-amber-50' },
  confirmed: { label: 'Đã xác nhận', color: 'text-sky-600', bg: 'bg-sky-50' },
  shipping: { label: 'Đang giao', color: 'text-indigo-600', bg: 'bg-indigo-50' },
  delivered: { label: 'Đã giao', color: 'text-emerald-600', bg: 'bg-emerald-50' },
  cancelled: { label: 'Đã hủy', color: 'text-rose-600', bg: 'bg-rose-50' },
}

export const PAYMENT_LABEL = {
  cod: 'Thanh toán khi nhận hàng (COD)',
  momo: 'Ví điện tử MoMo',
  zalopay: 'Ví điện tử ZaloPay',
  card: 'Thẻ Tín dụng / Ghi nợ',
  bank: 'Chuyển khoản ngân hàng',
}

function line(productId, qty, variant) {
  const p = findProductById(productId)
  if (!p) return null
  return {
    productId: p.id,
    slug: p.slug,
    name: p.name,
    image: p.image,
    emoji: p.emoji,
    price: p.price,
    originalPrice: p.originalPrice,
    qty,
    variant,
    shopId: p.shopId,
    shopName: p.shopName,
    shopMall: p.shopMall,
  }
}

function makeOrder({ id, buyerId, daysAgo, status, lines, payment = 'cod', shippingFee = 16500, discount = 0, note = '' }) {
  const buyer = findUserById(buyerId)
  const items = lines.map(([pid, qty, variant]) => line(pid, qty, variant)).filter(Boolean)
  const subtotal = items.reduce((s, it) => s + it.price * it.qty, 0)
  const createdAt = new Date(Date.now() - daysAgo * 86400000).toISOString()
  return {
    id,
    code: `SN${new Date(createdAt).getFullYear()}${String(id).padStart(6, '0')}`,
    buyerId,
    buyerName: buyer?.fullName || 'Người mua',
    createdAt,
    updatedAt: createdAt,
    status,
    statusHistory: [{ status, at: createdAt }],
    items,
    payment,
    shippingFee,
    shippingUnit: shippingFee <= 17000 ? 'Tiết Kiệm' : 'Nhanh',
    discount,
    subtotal,
    total: subtotal + shippingFee - discount,
    note,
    address: buyer?.address || null,
  }
}

export const seedOrders = [
  makeOrder({
    id: 1,
    buyerId: 'u_minhanh',
    daysAgo: 1,
    status: 'pending',
    payment: 'cod',
    shippingFee: 16500,
    discount: 20000,
    note: 'Giao giờ hành chính, gọi trước khi giao.',
    lines: [
      ['p01', 1, 'Màu Đen'],
      ['p06', 2, 'Bản 65W'],
      ['p09', 3, 'Loại 100ml'],
    ],
  }),
  makeOrder({
    id: 2,
    buyerId: 'u_minhanh',
    daysAgo: 4,
    status: 'shipping',
    payment: 'momo',
    shippingFee: 22000,
    lines: [
      ['p14', 1, 'Màu Xám'],
      ['p24', 1, 'Bản 256GB'],
    ],
  }),
  makeOrder({
    id: 3,
    buyerId: 'u_minhanh',
    daysAgo: 12,
    status: 'delivered',
    payment: 'card',
    shippingFee: 16500,
    discount: 15000,
    lines: [
      ['p19', 2, 'Loại 50ml'],
      ['p36', 1, 'Loại 300ml'],
      ['p12', 2, 'Size L'],
    ],
  }),
  makeOrder({
    id: 4,
    buyerId: 'u_minhanh',
    daysAgo: 25,
    status: 'cancelled',
    payment: 'cod',
    shippingFee: 16500,
    note: 'Đổi ý, không mua nữa.',
    lines: [['p43', 1, 'Màu Gỗ Tự Nhiên']],
  }),
  makeOrder({
    id: 5,
    buyerId: 'u_quockhanh',
    daysAgo: 2,
    status: 'pending',
    payment: 'zalopay',
    shippingFee: 22000,
    discount: 30000,
    lines: [
      ['p07', 4, 'Bản 1m2'],
      ['p29', 1, 'Màu Trắng'],
      ['p49', 2, 'Hương Sả Chanh'],
    ],
  }),
  makeOrder({
    id: 6,
    buyerId: 'u_quockhanh',
    daysAgo: 8,
    status: 'confirmed',
    payment: 'cod',
    shippingFee: 16500,
    lines: [
      ['p10', 2, 'Loại 500ml'],
      ['p47', 3, 'Size M'],
    ],
  }),
]
