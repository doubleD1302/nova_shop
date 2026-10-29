import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { makeId } from '../utils/format'
import { useLocalStorageState } from '../hooks/useLocalStorageState'
import {
  apiCancelOrder,
  apiConfirmOrderReceived,
  apiCreateOrder,
  apiGetOrders,
  apiGetSellerOrders,
  apiUpdateSellerOrderStatus,
  invalidatePublicApiCache,
} from '../utils/api'
import { useAuth } from './AuthContext'
import { useToast } from './ToastContext'
import { useCatalog } from './CatalogContext'

const OrderContext = createContext(null)

const STATUS_FLOW = ['pending', 'confirmed', 'shipping', 'delivered']

const makeNotification = ({ buyerId, orderId, title, message }) => ({
  id: makeId('notice'),
  buyerId: String(buyerId || ''),
  orderId: String(orderId),
  title,
  message,
  createdAt: new Date().toISOString(),
  read: false,
})

const imageForVariant = (product) => product?.image || ''

async function readResponse(response, fallbackMessage) {
  const payload = await response.json().catch(() => null)
  if (!response.ok || !payload?.success) {
    throw new Error(payload?.message || fallbackMessage)
  }
  return payload.data
}

export function OrderProvider({ children }) {
  const { user } = useAuth()
  const [orders, setOrders] = useState([])
  const [sellerOrders, setSellerOrders] = useState([])
  const [notifications, setNotifications] = useLocalStorageState(`notifications:v2:${user?.id || 'guest'}`, [])
  const [buyerOrdersLoading, setBuyerOrdersLoading] = useState(false)
  const [sellerOrdersLoading, setSellerOrdersLoading] = useState(false)
  const [buyerOrdersSummary, setBuyerOrdersSummary] = useState({ orderCount: 0, spent: 0 })
  const [sellerOrdersSummary, setSellerOrdersSummary] = useState({ total: 0, pending: 0, confirmed: 0, shipping: 0, delivered: 0, cancelled: 0, revenue: 0 })
  const buyerLoadRef = useRef({ userId: '', promise: null, loaded: false })
  const sellerLoadRef = useRef({ userId: '', promise: null, loaded: false })
  const ordersRef = useRef(orders)
  const sellerOrdersRef = useRef(sellerOrders)
  const activeUserIdRef = useRef(String(user?.id || ''))
  activeUserIdRef.current = String(user?.id || '')
  const isSellerUser = Boolean(user && (user.role === 'seller' || user.shopId))
  const activeSellerIdRef = useRef(isSellerUser ? String(user.id) : '')
  activeSellerIdRef.current = isSellerUser ? String(user.id) : ''
  const { getProductById } = useCatalog()
  const { pushToast } = useToast()

  useEffect(() => {
    ordersRef.current = orders
  }, [orders])

  useEffect(() => {
    sellerOrdersRef.current = sellerOrders
  }, [sellerOrders])

  useEffect(() => {
    const userId = String(user?.id || '')
    if (buyerLoadRef.current.userId !== userId) {
      buyerLoadRef.current = { userId, promise: null, loaded: false }
      ordersRef.current = []
      setOrders([])
      setBuyerOrdersSummary({ orderCount: 0, spent: 0 })
    }
    const isSeller = Boolean(user && (user.role === 'seller' || user.shopId))
    const sellerId = isSeller ? userId : ''
    if (sellerLoadRef.current.userId !== sellerId) {
      sellerLoadRef.current = { userId: sellerId, promise: null, loaded: false }
      sellerOrdersRef.current = []
      setSellerOrders([])
      setSellerOrdersSummary({ total: 0, pending: 0, confirmed: 0, shipping: 0, delivered: 0, cancelled: 0, revenue: 0 })
    }
  }, [user?.id, user?.role, user?.shopId])

  const loadBuyerOrders = useCallback(async ({ force = false, limit = 50, offset = 0, orderId = '', append = false } = {}) => {
    const userId = String(user?.id || '')
    if (!userId) return []
    const entry = buyerLoadRef.current
    if (!force && !orderId && offset === 0 && entry.userId === userId && entry.loaded) return ordersRef.current
    if (!force && !orderId && offset === 0 && entry.userId === userId && entry.promise) return entry.promise
    setBuyerOrdersLoading(true)
    const promise = apiGetOrders({ limit, offset, orderId })
      .then((response) => readResponse(response, 'Không thể tải đơn hàng.'))
      .then((data) => {
        const next = Array.isArray(data.orders) ? data.orders : []
        if (buyerLoadRef.current.userId === userId && activeUserIdRef.current === userId) {
          const summaryOnly = limit === 0 && !orderId
          const shouldAppend = append || offset > 0 || Boolean(orderId)
          if (!summaryOnly) {
            const merged = shouldAppend
              ? [...new Map([...ordersRef.current, ...next].map((order) => [String(order.id), order])).values()]
              : next
            ordersRef.current = merged
            setOrders(merged)
          }
          if (!orderId && data.summary) setBuyerOrdersSummary(data.summary)
          buyerLoadRef.current = { userId, promise: null, loaded: entry.loaded || (!summaryOnly && !orderId && offset === 0) }
        }
        return { orders: next, total: Number(data.total || 0), summary: data.summary || null }
      })
      .catch((error) => {
        if (buyerLoadRef.current.userId === userId) {
          buyerLoadRef.current = { userId, promise: null, loaded: entry.loaded }
        }

        pushToast(error.message || 'Không thể tải đơn hàng từ máy chủ.', 'error')
        throw error
      })
      .finally(() => setBuyerOrdersLoading(false))
    buyerLoadRef.current = { userId, promise, loaded: false }
    return promise
  }, [pushToast, user?.id])

  const loadSellerOrders = useCallback(async ({ force = false, limit = 50, offset = 0, append = false } = {}) => {
    const isSeller = Boolean(user && (user.role === 'seller' || user.shopId))
    const userId = isSeller ? String(user.id) : ''
    if (!userId) return []
    const entry = sellerLoadRef.current
    if (!force && offset === 0 && entry.userId === userId && entry.loaded) return sellerOrdersRef.current
    if (!force && offset === 0 && entry.userId === userId && entry.promise) return entry.promise
    setSellerOrdersLoading(true)
    const promise = apiGetSellerOrders({ limit, offset })
      .then((response) => readResponse(response, 'Không thể tải đơn hàng của gian hàng.'))
      .then((data) => {
        const next = Array.isArray(data.orders) ? data.orders : []
        if (sellerLoadRef.current.userId === userId && activeSellerIdRef.current === userId) {
          const merged = append || offset > 0
            ? [...new Map([...sellerOrdersRef.current, ...next].map((order) => [String(order.shopOrderId), order])).values()]
            : next
          sellerOrdersRef.current = merged
          setSellerOrders(merged)
          if (data.summary) setSellerOrdersSummary(data.summary)
          sellerLoadRef.current = { userId, promise: null, loaded: entry.loaded || offset === 0 }
        }
        return { orders: next, total: Number(data.total || 0), summary: data.summary || null }
      })
      .catch((error) => {
        if (sellerLoadRef.current.userId === userId) {
          sellerLoadRef.current = { userId, promise: null, loaded: entry.loaded }
        }

        pushToast(error.message || 'Không thể tải đơn hàng của gian hàng.', 'error')
        throw error
      })
      .finally(() => setSellerOrdersLoading(false))
    sellerLoadRef.current = { userId, promise, loaded: false }
    return promise
  }, [pushToast, user?.id, user?.role])

  const normalizedOrders = useMemo(() => orders.filter((order) => String(order.buyerId) === String(user?.id || '')).map((order) => ({
    ...order,
    items: (order.items || []).map((item) => {
      const product = getProductById(item.productId)
      return product
        ? { ...item, name: product.name, slug: product.slug, image: imageForVariant(product) || item.image }
        : item
    }),
  })), [orders, getProductById, user?.id])
  const isSeller = Boolean(user && (user.role === 'seller' || user.shopId))
  const visibleSellerOrders = useMemo(
    () => isSeller
      ? sellerOrders.filter((order) => (order.items || []).some((item) => String(item.shopId) === String(user?.shopId)))
      : [],
    [sellerOrders, isSeller, user?.shopId],
  )
  const visibleBuyerOrdersSummary = buyerLoadRef.current.userId === String(user?.id || '')
    ? buyerOrdersSummary
    : { orderCount: 0, spent: 0 }
  const visibleSellerOrdersSummary = isSeller && sellerLoadRef.current.userId === String(user.id)
    ? sellerOrdersSummary
    : { total: 0, pending: 0, confirmed: 0, shipping: 0, delivered: 0, cancelled: 0, revenue: 0 }

  const createOrder = useCallback(async ({
    buyerName,
    items,
    address,
    paymentMethod,
    shippingMethod,
    voucherCode = '',
    note = '',
  }) => {
    if (!user) throw new Error('Vui lòng đăng nhập trước khi đặt hàng.')
    const invalidItem = items.find((item) => !item.variantId || !Number.isInteger(Number(item.qty)) || item.qty < 1 || item.qty > item.stock)
    if (invalidItem) throw new Error(`Sản phẩm "${invalidItem.name}" không còn đủ tồn kho. Vui lòng kiểm tra lại giỏ hàng.`)
    const idempotencyKey = window.crypto?.randomUUID
      ? window.crypto.randomUUID()
      : `${Date.now()}_${Math.random().toString(36).slice(2)}`
    const data = await readResponse(
      await apiCreateOrder({
        items: items.map((item) => ({ variantId: item.variantId, qty: Number(item.qty) })),
        address,
        paymentMethod,
        shippingMethod,
        voucherCode,
        note,
      }, idempotencyKey),
      'Không thể tạo đơn hàng.',
    )
    const created = data.order
    invalidatePublicApiCache('/products')
    const order = {
      ...created,
      buyerId: user.id,
      buyerName: buyerName || user.fullName,
      updatedAt: created.createdAt,
      statusHistory: [{ status: 'pending', at: created.createdAt }],
      items: created.items,
      payment: created.payment,
      shippingUnit: created.shippingUnit,
      address: created.address,
      note: created.note,
      shippingFee: created.shippingFee,
      discount: created.discount,
      subtotal: created.subtotal,
      total: created.total,
    }
    setOrders((list) => [order, ...list.filter((item) => String(item.id) !== String(order.id))])
    setBuyerOrdersSummary((summary) => ({ orderCount: summary.orderCount + 1, spent: summary.spent + Number(order.total || 0) }))
    setNotifications((list) => [
      makeNotification({
        buyerId: user.id,
        orderId: order.id,
        title: 'Đặt hàng thành công',
        message: `Đơn ${order.code} đã được tạo và đang chờ xác nhận.`,
      }),
      ...list,
    ].slice(0, 50))
    return order
  }, [pushToast, setNotifications, user])

  const updateOrderStatus = useCallback(async (shopOrderId, status) => {
    try {
      await readResponse(await apiUpdateSellerOrderStatus(shopOrderId, status), 'Không thể cập nhật trạng thái đơn hàng.')
      const currentOrder = sellerOrdersRef.current.find((order) => String(order.shopOrderId) === String(shopOrderId))
      if (currentOrder && currentOrder.status !== status) {
        setSellerOrdersSummary((summary) => ({
          ...summary,
          [currentOrder.status]: Math.max(0, Number(summary[currentOrder.status] || 0) - 1),
          [status]: Number(summary[status] || 0) + 1,
          revenue: status === 'delivered' ? Number(summary.revenue || 0) + Number(currentOrder.totalForShop || 0) : summary.revenue,
        }))
      }
      setSellerOrders((list) => list.map((order) => String(order.shopOrderId) === String(shopOrderId)
        ? { ...order, status, updatedAt: new Date().toISOString() }
        : order))
      return true
    } catch (error) {
      pushToast(error.message || 'Không thể cập nhật trạng thái đơn hàng.', 'error')
      return false
    }
  }, [pushToast])

  const cancelOrder = useCallback(async (orderId, reason = 'Người mua hủy đơn') => {
    try {
      await readResponse(await apiCancelOrder(orderId), 'Không thể hủy đơn hàng.')
      const currentOrder = ordersRef.current.find((order) => String(order.id) === String(orderId))
      if (currentOrder && currentOrder.status !== 'cancelled') {
        setBuyerOrdersSummary((summary) => ({ ...summary, spent: Math.max(0, summary.spent - Number(currentOrder.total || 0)) }))
      }
      setOrders((list) => list.map((order) => String(order.id) === String(orderId)
        ? {
            ...order,
            status: 'cancelled',
            cancelReason: reason,
            updatedAt: new Date().toISOString(),
            statusHistory: [...(order.statusHistory || []), { status: 'cancelled', at: new Date().toISOString() }],
          }
        : order))
      return true
    } catch (error) {
      pushToast(error.message || 'Không thể hủy đơn hàng.', 'error')
      return false
    }
  }, [pushToast])

  const confirmReceived = useCallback(async (orderId) => {
    try {
      await readResponse(await apiConfirmOrderReceived(orderId), 'Không thể xác nhận đã nhận hàng.')
      setOrders((list) => list.map((order) => String(order.id) === String(orderId)
        ? {
            ...order,
            status: 'delivered',
            updatedAt: new Date().toISOString(),
            statusHistory: [...(order.statusHistory || []), { status: 'delivered', at: new Date().toISOString() }],
          }
        : order))
      return true
    } catch (error) {
      pushToast(error.message || 'Không thể xác nhận đã nhận hàng.', 'error')
      return false
    }
  }, [pushToast])

  const getOrderById = useCallback(
    (id) => normalizedOrders.find((order) => String(order.id) === String(id))
      || visibleSellerOrders.find((order) => String(order.id) === String(id))
      || null,
    [normalizedOrders, visibleSellerOrders],
  )

  const getNotificationsByBuyer = useCallback(
    (buyerId) => buyerId
      ? notifications
          .filter((notification) => String(notification.buyerId) === String(buyerId))
          .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      : [],
    [notifications],
  )

  const markNotificationRead = useCallback(
    (notificationId) => setNotifications((list) => list.map((notification) => (
      notification.id === notificationId ? { ...notification, read: true } : notification
    ))),
    [setNotifications],
  )

  const markAllNotificationsRead = useCallback(
    (buyerId) => setNotifications((list) => list.map((notification) => (
      String(notification.buyerId) === String(buyerId) ? { ...notification, read: true } : notification
    ))),
    [setNotifications],
  )

  const getOrdersByBuyer = useCallback(
    (buyerId) => normalizedOrders
      .filter((order) => String(order.buyerId) === String(buyerId))
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)),
    [normalizedOrders],
  )

  const getOrdersByShop = useCallback(
    (shopId) => sellerOrders
      .filter((order) => order.items.some((item) => String(item.shopId) === String(shopId)))
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)),
    [sellerOrders],
  )

  const value = useMemo(() => ({
    orders: normalizedOrders,
    sellerOrders: visibleSellerOrders,
    buyerOrdersLoading,
    sellerOrdersLoading,
    buyerOrdersSummary: visibleBuyerOrdersSummary,
    sellerOrdersSummary: visibleSellerOrdersSummary,
    loadBuyerOrders,
    loadSellerOrders,
    createOrder,
    updateOrderStatus,
    cancelOrder,
    confirmReceived,
    getOrderById,
    getOrdersByBuyer,
    getOrdersByShop,
    getNotificationsByBuyer,
    markNotificationRead,
    markAllNotificationsRead,
    STATUS_FLOW,
  }), [
    normalizedOrders,
    visibleSellerOrders,
    buyerOrdersLoading,
    sellerOrdersLoading,
    visibleBuyerOrdersSummary,
    visibleSellerOrdersSummary,
    loadBuyerOrders,
    loadSellerOrders,
    createOrder,
    updateOrderStatus,
    cancelOrder,
    confirmReceived,
    getOrderById,
    getOrdersByBuyer,
    getOrdersByShop,
    getNotificationsByBuyer,
    markNotificationRead,
    markAllNotificationsRead,
  ])

  return <OrderContext.Provider value={value}>{children}</OrderContext.Provider>
}

export function useOrders() {
  const ctx = useContext(OrderContext)
  if (!ctx) throw new Error('useOrders phải dùng bên trong <OrderProvider>')
  return ctx
}

export default OrderContext
