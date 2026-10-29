import { createContext, useCallback, useContext, useMemo } from 'react'
import { useLocalStorageState } from '../hooks/useLocalStorageState'
import { useCatalog } from './CatalogContext'
import { useAuth } from './AuthContext'

const CartContext = createContext(null)

export const FREE_SHIP_THRESHOLD = 1000000 // >= 1.000.000đ thì miễn phí vận chuyển
export const SHIP_FEE_PER_SHOP = 16500
const VOUCHER_MIN = 500000
const VOUCHER_VALUE = 20000

const imageForVariant = (product, variant) => product.variantImages?.[variant]?.[0] || product.image
const imageFallbackForVariant = (product, variant) => product.variantImages?.[variant]?.[1] || product.imageFallback || product.image

/** Ghép sản phẩm + phân loại thành 1 dòng giỏ hàng */
const lineKey = (productId, variant, variantId) => variantId || `${productId}__${variant || 'default'}`

const toCartLine = (product, qty, variant, selected, variantId, sku) => ({
  key: lineKey(product.id, variant, variantId),
  productId: product.id,
  variantId: variantId || '',
  slug: product.slug,
  name: product.name,
  image: imageForVariant(product, variant),
  imageFallback: imageFallbackForVariant(product, variant),
  emoji: product.emoji,
  price: sku?.price ?? product.price,
  originalPrice: sku?.originalPrice ?? product.originalPrice,
  qty,
  variant,
  shopId: product.shopId,
  shopName: product.shopName,
  shopMall: product.shopMall,
  stock: sku?.stock ?? product.stock ?? 0,
  freeship: Boolean(product.freeship || product.extraShip),
  selected,
})

export function CartProvider({ children }) {
  const { user } = useAuth()
  const [items, setItems] = useLocalStorageState(`cart:v2:${user?.id || 'guest'}`, [])
  const { getProductById } = useCatalog()
  const visibleItems = useMemo(
    () => items.map((item) => {
      const product = getProductById(item.productId)
      const image = product ? imageForVariant(product, item.variant) : item.image
      const imageFallback = product ? imageFallbackForVariant(product, item.variant) : item.imageFallback
      if (!product) return { ...item, unavailable: true, stock: 0 }
      const sku = product.variants?.find((variant) => String(variant.id) === String(item.variantId))
      if (!sku) return { ...item, unavailable: true, stock: 0 }
      return {
        ...item,
        name: product.name,
        slug: product.slug,
        image,
        imageFallback,
        variant: sku.name,
        price: sku.price,
        originalPrice: sku.originalPrice,
        stock: sku.stock,
        unavailable: false,
      }
    }),
    [items, getProductById],
  )

  const addToCart = useCallback(
    (product, { qty = 1, variant = '', variantId = '', select = true } = {}) => {
      const sku = product.variants?.find((item) => String(item.id) === String(variantId))
      if (!sku || sku.stock < 1) return null
      const key = lineKey(product.id, variant, variantId)
      setItems((list) => {
        const existing = list.find((i) => i.key === key)
        if (existing) {
          return list.map((i) => (i.key === key ? { ...i, qty: Math.min(i.qty + qty, sku.stock, 99), selected: select } : i))
        }
        return [...list, toCartLine(product, Math.min(qty, sku.stock, 99), variant, select, variantId, sku)]
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
      const item = items.find((line) => line.key === key)
      const next = Math.max(1, Math.min(Number(qty) || 1, item?.stock ?? 99, 99))
      setItems((list) => list.map((i) => (i.key === key ? { ...i, qty: next } : i)))
    },
    [items, setItems],
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
    (product, { qty = 1, variant = '', variantId = '' } = {}) => {
      const sku = product.variants?.find((item) => String(item.id) === String(variantId))
      if (!sku || sku.stock < 1) return null
      const key = lineKey(product.id, variant, variantId)
      setItems((list) => {
        const rest = list.map((i) => ({ ...i, selected: false }))
        const existing = rest.find((i) => i.key === key)
        if (existing) return rest.map((i) => (i.key === key ? { ...i, qty: Math.min(qty, sku.stock, 99), selected: true } : i))
        return [...rest, toCartLine(product, Math.min(qty, sku.stock, 99), variant, true, variantId, sku)]
      })
      return key
    },
    [setItems],
  )

  const selectedItems = useMemo(() => visibleItems.filter((i) => i.selected), [visibleItems])

  /** Nhóm giỏ hàng theo SHOP — 1 giỏ có thể chứa sản phẩm của nhiều shop */
  const groups = useMemo(() => {
    const map = new Map()
    visibleItems.forEach((i) => {
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
  }, [visibleItems])

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
      items: visibleItems,
      groups,
      selectedItems,
      summary,
      cartCount: visibleItems.reduce((s, i) => s + i.qty, 0),
      distinctCount: visibleItems.length,
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
      visibleItems,
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
