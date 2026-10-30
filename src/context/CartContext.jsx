import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useLocalStorageState } from '../hooks/useLocalStorageState'
import { useCatalog } from './CatalogContext'
import { useAuth } from './AuthContext'
import {
  apiGetCart,
  apiAddToCart,
  apiUpdateCartItem,
  apiRemoveCartItem,
  apiClearCart,
  apiSyncCart,
  apiUpdateCartSelection,
} from '../utils/api'

const CartContext = createContext(null)

export const FREE_SHIP_THRESHOLD = 1000000 // >= 1.000.000đ thì miễn phí vận chuyển
export const SHIP_FEE_PER_SHOP = 16500
const VOUCHER_MIN = 500000
const VOUCHER_VALUE = 20000

const imageForVariant = (product, variant) => product.variantImages?.[variant]?.[0] || product.image
const imageFallbackForVariant = (product, variant) => product.variantImages?.[variant]?.[1] || product.imageFallback || product.image

/** Ghép sản phẩm + phân loại thành 1 dòng giỏ hàng */
const lineKey = (productId, variant, variantId) => variantId ? String(variantId) : `${productId}__${variant || 'default'}`

const toCartLine = (product, qty, variant, selected, variantId, sku) => ({
  id: variantId ? String(variantId) : lineKey(product.id, variant, variantId),
  key: lineKey(product.id, variant, variantId),
  productId: String(product.id),
  variantId: variantId ? String(variantId) : '',
  slug: product.slug,
  name: product.name,
  image: imageForVariant(product, variant),
  imageFallback: imageFallbackForVariant(product, variant),
  emoji: product.emoji,
  price: sku?.price ?? product.price,
  originalPrice: sku?.originalPrice ?? product.originalPrice,
  qty,
  variant,
  shopId: String(product.shopId || '1'),
  shopName: product.shopName || 'ShopNova',
  shopMall: Boolean(product.shopMall),
  stock: sku?.stock ?? product.stock ?? 0,
  freeship: Boolean(product.freeship || product.extraShip),
  selected,
})

export function CartProvider({ children }) {
  const { user } = useAuth()
  const [guestItems, setGuestItems] = useLocalStorageState('cart:v2:guest', [])
  const [serverItems, setServerItems] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const previousUserRef = useRef(null)

  const isServerCart = Boolean(user && user.id)
  const items = isServerCart ? serverItems : guestItems
  const setItems = isServerCart ? setServerItems : setGuestItems

  const { getProductById } = useCatalog()

  // 1. Khi người dùng đăng nhập: đồng bộ giỏ hàng từ guest lên server và tải giỏ hàng máy chủ
  useEffect(() => {
    let isCancelled = false

    const syncAndLoadCart = async () => {
      if (!user || !user.id) {
        previousUserRef.current = null
        return
      }

      setIsLoading(true)
      try {
        // Nếu trước đó đang là khách và có sản phẩm trong guestItems: đồng bộ lên server
        const wasGuest = !previousUserRef.current
        if (wasGuest && guestItems.length > 0) {
          const syncPayload = guestItems.map((item) => ({
            productId: item.productId,
            variantId: item.variantId,
            qty: item.qty,
            selected: item.selected,
          }))
          const syncRes = await apiSyncCart(syncPayload)
          if (!isCancelled && syncRes.ok) {
            const syncData = await syncRes.json().catch(() => null)
            if (syncData?.success && syncData?.data?.items) {
              setServerItems(syncData.data.items)
              setGuestItems([]) // Xóa giỏ local guest sau khi đã đồng bộ
              setIsLoading(false)
              previousUserRef.current = user.id
              return
            }
          }
        }

        // Tải giỏ hàng từ server
        const res = await apiGetCart()
        if (!isCancelled && res.ok) {
          const data = await res.json().catch(() => null)
          if (data?.success && Array.isArray(data?.data?.items)) {
            setServerItems(data.data.items)
          }
        }
      } catch (err) {
        console.error('[CartContext] Lỗi khi tải giỏ hàng từ server:', err)
      } finally {
        if (!isCancelled) setIsLoading(false)
      }

      previousUserRef.current = user.id
    }

    syncAndLoadCart()

    return () => {
      isCancelled = true
    }
  }, [user?.id])

  const visibleItems = useMemo(
    () => items.map((item) => {
      const product = getProductById(item.productId)
      const image = product ? imageForVariant(product, item.variant) : (item.image || item.imageUrl)
      const imageFallback = product ? imageFallbackForVariant(product, item.variant) : (item.imageFallback || item.imageUrl || item.image)

      // Nếu không có trong CatalogContext nhưng item từ server đã có đầy đủ thông tin
      if (!product) {
        if (item.name && item.price !== undefined) {
          return {
            ...item,
            image,
            imageFallback,
            unavailable: Boolean(item.unavailable),
            stock: item.stock ?? 99,
          }
        }
        return { ...item, unavailable: true, stock: 0 }
      }

      const sku = product.variants?.find((variant) => String(variant.id) === String(item.variantId))
      if (!sku) {
        if (item.name && item.price !== undefined) {
          return {
            ...item,
            image,
            imageFallback,
            unavailable: Boolean(item.unavailable),
            stock: item.stock ?? 99,
          }
        }
        return { ...item, unavailable: true, stock: 0 }
      }

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
      const targetVariantId = variantId || sku?.id
      const effectiveStock = sku?.stock ?? product.stock ?? 99
      if (effectiveStock < 1) return null
      const key = lineKey(product.id, variant, targetVariantId)

      // Cập nhật state cục bộ
      setItems((list) => {
        const existing = list.find((i) => i.key === key || (targetVariantId && String(i.variantId) === String(targetVariantId)))
        if (existing) {
          return list.map((i) => (i.key === key || (targetVariantId && String(i.variantId) === String(targetVariantId))
            ? { ...i, qty: Math.min(i.qty + qty, effectiveStock, 99), selected: select }
            : i
          ))
        }
        return [...list, toCartLine(product, Math.min(qty, effectiveStock, 99), variant, select, targetVariantId, sku)]
      })

      // Nếu đã đăng nhập: đồng bộ trực tiếp lên Server
      if (isServerCart) {
        apiAddToCart({
          productId: product.id,
          variantId: targetVariantId,
          qty,
          selected: select,
        }).then(async (res) => {
          if (res.ok) {
            const data = await res.json().catch(() => null)
            if (data?.success && Array.isArray(data?.data?.items)) {
              setServerItems(data.data.items)
            }
          }
        }).catch((err) => console.error('[CartContext] Lỗi đồng bộ addToCart lên server:', err))
      }

      return key
    },
    [isServerCart, setItems],
  )

  const removeFromCart = useCallback(
    (...keys) => {
      const flat = keys.flat().map(String)
      setItems((list) => list.filter((i) => !flat.includes(String(i.key)) && !flat.includes(String(i.id)) && !flat.includes(String(i.variantId))))

      // Nếu đã đăng nhập: xóa trên Server
      if (isServerCart) {
        for (const k of flat) {
          apiRemoveCartItem(k).then(async (res) => {
            if (res.ok) {
              const data = await res.json().catch(() => null)
              if (data?.success && Array.isArray(data?.data?.items)) {
                setServerItems(data.data.items)
              }
            }
          }).catch((err) => console.error('[CartContext] Lỗi đồng bộ removeFromCart lên server:', err))
        }
      }
    },
    [isServerCart, setItems],
  )

  const updateQty = useCallback(
    (key, qty) => {
      const item = items.find((line) => line.key === key || String(line.id) === String(key) || String(line.variantId) === String(key))
      const next = Math.max(1, Math.min(Number(qty) || 1, item?.stock ?? 99, 99))
      setItems((list) => list.map((i) => (i.key === key || String(i.id) === String(key) || String(i.variantId) === String(key) ? { ...i, qty: next } : i)))

      // Nếu đã đăng nhập: đồng bộ số lượng lên Server
      if (isServerCart) {
        const targetId = item?.variantId || key
        apiUpdateCartItem(targetId, { qty: next }).then(async (res) => {
          if (res.ok) {
            const data = await res.json().catch(() => null)
            if (data?.success && Array.isArray(data?.data?.items)) {
              setServerItems(data.data.items)
            }
          }
        }).catch((err) => console.error('[CartContext] Lỗi đồng bộ updateQty lên server:', err))
      }
    },
    [items, isServerCart, setItems],
  )

  const toggleSelect = useCallback(
    (key) => {
      const item = items.find((line) => line.key === key || String(line.id) === String(key) || String(line.variantId) === String(key))
      const nextSelected = !item?.selected
      setItems((list) => list.map((i) => (i.key === key || String(i.id) === String(key) || String(i.variantId) === String(key) ? { ...i, selected: nextSelected } : i)))

      // Nếu đã đăng nhập: đồng bộ chọn lên Server
      if (isServerCart) {
        const targetId = item?.variantId || key
        apiUpdateCartItem(targetId, { selected: nextSelected }).catch((err) =>
          console.error('[CartContext] Lỗi đồng bộ toggleSelect lên server:', err)
        )
      }
    },
    [items, isServerCart, setItems],
  )

  const selectAll = useCallback(
    (flag) => {
      setItems((list) => list.map((i) => ({ ...i, selected: flag })))

      // Nếu đã đăng nhập: cập nhật toàn bộ trên Server
      if (isServerCart) {
        apiUpdateCartSelection(flag).catch((err) =>
          console.error('[CartContext] Lỗi đồng bộ selectAll lên server:', err)
        )
      }
    },
    [isServerCart, setItems],
  )

  const selectShop = useCallback(
    (shopId, flag) => {
      setItems((list) => list.map((i) => (String(i.shopId) === String(shopId) ? { ...i, selected: flag } : i)))

      // Nếu đã đăng nhập: cập nhật shop trên Server
      if (isServerCart) {
        apiUpdateCartSelection(flag, shopId).catch((err) =>
          console.error('[CartContext] Lỗi đồng bộ selectShop lên server:', err)
        )
      }
    },
    [isServerCart, setItems],
  )

  const clearCart = useCallback(() => {
    setItems([])
    if (isServerCart) {
      apiClearCart().catch((err) =>
        console.error('[CartContext] Lỗi đồng bộ clearCart lên server:', err)
      )
    }
  }, [isServerCart, setItems])

  const removeSelected = useCallback(() => {
    setItems((list) => list.filter((i) => !i.selected))
    if (isServerCart) {
      apiClearCart({ selectedOnly: true }).catch((err) =>
        console.error('[CartContext] Lỗi đồng bộ removeSelected lên server:', err)
      )
    }
  }, [isServerCart, setItems])

  /** "Mua ngay": chỉ chọn duy nhất sản phẩm vừa thêm */
  const buyNow = useCallback(
    (product, { qty = 1, variant = '', variantId = '' } = {}) => {
      const sku = product.variants?.find((item) => String(item.id) === String(variantId))
      const targetVariantId = variantId || sku?.id
      const effectiveStock = sku?.stock ?? product.stock ?? 99
      if (effectiveStock < 1) return null
      const key = lineKey(product.id, variant, targetVariantId)

      setItems((list) => {
        const rest = list.map((i) => ({ ...i, selected: false }))
        const existing = rest.find((i) => i.key === key || (targetVariantId && String(i.variantId) === String(targetVariantId)))
        if (existing) {
          return rest.map((i) => (i.key === key || (targetVariantId && String(i.variantId) === String(targetVariantId))
            ? { ...i, qty: Math.min(qty, effectiveStock, 99), selected: true }
            : i
          ))
        }
        return [...rest, toCartLine(product, Math.min(qty, effectiveStock, 99), variant, true, targetVariantId, sku)]
      })

      if (isServerCart) {
        apiAddToCart({
          productId: product.id,
          variantId: targetVariantId,
          qty,
          selected: true,
          replaceQty: true,
        }).catch((err) => console.error('[CartContext] Lỗi đồng bộ buyNow lên server:', err))
      }

      return key
    },
    [isServerCart, setItems],
  )

  const selectedItems = useMemo(() => visibleItems.filter((i) => i.selected), [visibleItems])

  /** Nhóm giỏ hàng theo SHOP — 1 giỏ có thể chứa sản phẩm của nhiều shop */
  const groups = useMemo(() => {
    const map = new Map()
    visibleItems.forEach((i) => {
      const sid = String(i.shopId || '1')
      if (!map.has(sid)) {
        map.set(sid, { shopId: sid, shopName: i.shopName || 'ShopNova', shopMall: i.shopMall, items: [] })
      }
      map.get(sid).items.push(i)
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
      isLoading,
      cartCount: visibleItems.reduce((s, i) => s + i.qty, 0),
      distinctCount: visibleItems.length,
      addToCart,
      addItem: addToCart,
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
      isLoading,
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
