import { createContext, useCallback, useContext, useMemo } from 'react'
import { seedOrders } from '../data/orders'
import { makeOrderCode } from '../utils/format'
import { useLocalStorageState } from '../hooks/useLocalStorageState'

const OrderContext = createContext(null)

const STATUS_FLOW = ['pending', 'confirmed', 'shipping', 'delivered']

export function OrderProvider({ children }) {
  const [stored, setStored] = useLocalStorageState('orders:v1', [])
  const orders = useMemo(() => (stored.length ? stored : seedOrders), [stored])

  /** Tạo đơn hàng từ giỏ hàng (1 đơn có thể gồm nhiều shop) */
  const createOrder = useCallback(
    ({ buyerId, buyerName, items, address, payment, shippingUnit, shippingFee, voucher = 0, note = '' }) => {
      const subtotal = items.reduce((s, i) => s + i.price * i.qty, 0)
      const id = `${Date.now()}`
      const createdAt = new Date().toISOString()
      const order = {
        id,
        code: makeOrderCode(),
        buyerId,
        buyerName,
        createdAt,
        updatedAt: createdAt,
        status: 'pending',
        statusHistory: [{ status: 'pending', at: createdAt }],
        items: items.map((i) => ({
          productId: i.productId,
          slug: i.slug,
          name: i.name,
          image: i.image,
          emoji: i.emoji,
          price: i.price,
          originalPrice: i.originalPrice,
          qty: i.qty,
          variant: i.variant,
          shopId: i.shopId,
          shopName: i.shopName,
          shopMall: i.shopMall,
        })),
        payment,
        shippingUnit: shippingUnit || 'Tiết Kiệm',
        shippingFee,
        discount: voucher,
        subtotal,
        total: Math.max(0, subtotal + shippingFee - voucher),
        note,
        address,
      }
      setStored((list) => [order, ...(list.length ? list : seedOrders)])
      return order
    },
    [setStored],
  )

  const updateOrderStatus = useCallback(
    (orderId, status) => {
      setStored((list) =>
        (list.length ? list : seedOrders).map((o) =>
          o.id === orderId
            ? {
                ...o,
                status,
                updatedAt: new Date().toISOString(),
                statusHistory: [...(o.statusHistory || []), { status, at: new Date().toISOString() }],
              }
            : o,
        ),
      )
    },
    [setStored],
  )

  const cancelOrder = useCallback(
    (orderId, reason = 'Người mua hủy đơn') => {
      setStored((list) =>
        (list.length ? list : seedOrders).map((o) =>
          o.id === orderId
            ? {
                ...o,
                status: 'cancelled',
                cancelReason: reason,
                updatedAt: new Date().toISOString(),
                statusHistory: [...(o.statusHistory || []), { status: 'cancelled', at: new Date().toISOString() }],
              }
            : o,
        ),
      )
    },
    [setStored],
  )

  /** Xác nhận đã nhận hàng (người mua) */
  const confirmReceived = useCallback((orderId) => updateOrderStatus(orderId, 'delivered'), [updateOrderStatus])

  const getOrderById = useCallback((id) => orders.find((o) => String(o.id) === String(id)) || null, [orders])

  const getOrdersByBuyer = useCallback(
    (buyerId) => orders.filter((o) => o.buyerId === buyerId).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)),
    [orders],
  )

  /** Đơn hàng nhìn từ phía NGƯỜI BÁN: chỉ lấy phần sản phẩm thuộc shop của họ */
  const getOrdersByShop = useCallback(
    (shopId) =>
      orders
        .filter((o) => o.items.some((i) => i.shopId === shopId))
        .map((o) => {
          const items = o.items.filter((i) => i.shopId === shopId)
          const subtotal = items.reduce((s, i) => s + i.price * i.qty, 0)
          return { ...o, items, subtotal, totalForShop: subtotal }
        })
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)),
    [orders],
  )

  const value = useMemo(
    () => ({
      orders,
      createOrder,
      updateOrderStatus,
      cancelOrder,
      confirmReceived,
      getOrderById,
      getOrdersByBuyer,
      getOrdersByShop,
      STATUS_FLOW,
    }),
    [orders, createOrder, updateOrderStatus, cancelOrder, confirmReceived, getOrderById, getOrdersByBuyer, getOrdersByShop],
  )

  return <OrderContext.Provider value={value}>{children}</OrderContext.Provider>
}

export function useOrders() {
  const ctx = useContext(OrderContext)
  if (!ctx) throw new Error('useOrders phải dùng bên trong <OrderProvider>')
  return ctx
}

export default OrderContext
