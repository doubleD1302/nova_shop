import { createContext, useCallback, useContext, useMemo } from 'react'
import { useLocalStorageState } from '../hooks/useLocalStorageState'

const CartContext = createContext(null)

export const FREE_SHIP_THRESHOLD = 1000000 // >= 1.000.000đ thì miễn phí vận chuyển
export const SHIP_FEE_PER_SHOP = 16500
const VOUCHER_MIN = 500000
const VOUCHER_VALUE = 20000

/** Ghép sản phẩm + phân loại thành 1 dòng giỏ hàng */
const lineKey = (productId, variant) => `${productId}__${variant || 'default'}`

const toCartLine = (product, qty, variant, selected) => ({
  key: lineKey(product.id, variant),
  productId: product.id,
  slug: product.slug,
  name: product.name,
  image: product.image,
  emoji: product.emoji,
  price: product.price,
  originalPrice: product.originalPrice,
  qty,
  variant,
  shopId: product.shopId,
  shopName: product.shopName,
  shopMall: product.shopMall,
  stock: product.stock ?? 99,
  freeship: Boolean(product.freeship || product.extraShip),
  selected,
})

export function CartProvider({ children }) {
  const [items, setItems] = useLocalStorageState('cart:v1', [])

  const addToCart = useCallback(
    (product, { qty = 1, variant = '', select = true } = {}) => {
      const key = lineKey(product.id, variant)
      setItems((list) => {
        const existing = list.find((i) => i.key === key)
        if (existing) {
          return list.map((i) => (i.key === key ? { ...i, qty: Math.min(i.qty + qty, 99), selected: select } : i))
        }
        return [...list, toCartLine(product, Math.min(qty, 99), variant, select)]
      })
      return key
    },
    [setItems],
  )

  const removeFromCart = useCallback(
    (...keys) => {
      const flat = keys.flat()
      setItems((list) => list.filter((i) => !flat.includes(i.key)))
    },
    [setItems],
  )

  const updateQty = useCallback(
    (key, qty) => {
      const next = Math.max(1, Math.min(Number(qty) || 1, 99))
      setItems((list) => list.map((i) => (i.key === key ? { ...i, qty: next } : i)))
    },
    [setItems],
  )

  const toggleSelect = useCallback(
    (key) => setItems((list) => list.map((i) => (i.key === key ? { ...i, selected: !i.selected } : i))),
    [setItems],
  )

  const selectAll = useCallback(
    (flag) => setItems((list) => list.map((i) => ({ ...i, selected: flag }))),
    [setItems],
  )

  const selectShop = useCallback(
    (shopId, flag) => setItems((list) => list.map((i) => (i.shopId === shopId ? { ...i, selected: flag } : i))),
    [setItems],
  )

  const clearCart = useCallback(() => setItems([]), [setItems])
  const removeSelected = useCallback(() => setItems((list) => list.filter((i) => !i.selected)), [setItems])

  /** "Mua ngay": chỉ chọn duy nhất sản phẩm vừa thêm */
  const buyNow = useCallback(
    (product, { qty = 1, variant = '' } = {}) => {
      const key = lineKey(product.id, variant)
      setItems((list) => {
        const rest = list.map((i) => ({ ...i, selected: false }))
        const existing = rest.find((i) => i.key === key)
        if (existing) return rest.map((i) => (i.key === key ? { ...i, qty, selected: true } : i))
        return [...rest, toCartLine(product, qty, variant, true)]
      })
      return key
    },
    [setItems],
  )

  const selectedItems = useMemo(() => items.filter((i) => i.selected), [items])

  /** Nhóm giỏ hàng theo SHOP — 1 giỏ có thể chứa sản phẩm của nhiều shop */
  const groups = useMemo(() => {
    const map = new Map()
    items.forEach((i) => {
      if (!map.has(i.shopId)) {
        map.set(i.shopId, { shopId: i.shopId, shopName: i.shopName, shopMall: i.shopMall, items: [] })
      }
      map.get(i.shopId).items.push(i)
    })
    return [...map.values()].map((g) => {
      const selectedInShop = g.items.filter((i) => i.selected)
      const subtotal = selectedInShop.reduce((s, i) => s + i.price * i.qty, 0)
      const hasFreeship = selectedInShop.some((i) => i.freeship)
      const shippingFee =
        selectedInShop.length === 0 ? 0 : hasFreeship || subtotal >= FREE_SHIP_THRESHOLD ? 0 : SHIP_FEE_PER_SHOP
      return {
        ...g,
        subtotal,
        shippingFee,
        hasFreeship,
        selectedCount: selectedInShop.reduce((s, i) => s + i.qty, 0),
        allSelected: g.items.length > 0 && selectedInShop.length === g.items.length,
      }
    })
  }, [items])

  const summary = useMemo(() => {
    const subtotal = selectedItems.reduce((s, i) => s + i.price * i.qty, 0)
    const originalSubtotal = selectedItems.reduce((s, i) => s + (i.originalPrice || i.price) * i.qty, 0)
    const shippingTotal = groups.reduce((s, g) => s + g.shippingFee, 0)
    const voucher = subtotal >= VOUCHER_MIN ? VOUCHER_VALUE : 0
    return {
      subtotal,
      originalSubtotal,
      productDiscount: originalSubtotal - subtotal,
      shippingTotal,
      voucher,
      total: Math.max(0, subtotal + shippingTotal - voucher),
      selectedCount: selectedItems.reduce((s, i) => s + i.qty, 0),
      shopCount: groups.filter((g) => g.selectedCount > 0).length,
    }
  }, [selectedItems, groups])

  const value = useMemo(
    () => ({
      items,
      groups,
      selectedItems,
      summary,
      cartCount: items.reduce((s, i) => s + i.qty, 0),
      distinctCount: items.length,
      addToCart,
      removeFromCart,
      updateQty,
      toggleSelect,
      selectAll,
      selectShop,
      clearCart,
      removeSelected,
      buyNow,
      FREE_SHIP_THRESHOLD,
      SHIP_FEE_PER_SHOP,
    }),
    [
      items,
      groups,
      selectedItems,
      summary,
      addToCart,
      removeFromCart,
      updateQty,
      toggleSelect,
      selectAll,
      selectShop,
      clearCart,
      removeSelected,
      buyNow,
    ],
  )

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

export function useCart() {
  const ctx = useContext(CartContext)
  if (!ctx) throw new Error('useCart phải dùng bên trong <CartProvider>')
  return ctx
}

export default CartContext
