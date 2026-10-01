import { createContext, useCallback, useContext, useMemo } from 'react'
import { categories as seedCategories, getCategory } from '../data/categories'
import { shops as seedShops, getShop as getSeedShop } from '../data/shops'
import { seedProducts } from '../data/products'
import { discountPercent, makeId, toSlug } from '../utils/format'
import { productImage, shopAvatar } from '../utils/image'
import { useLocalStorageState } from '../hooks/useLocalStorageState'

const CatalogContext = createContext(null)

/** Bỏ dấu tiếng Việt để so khớp tìm kiếm */
const normalize = (s) => toSlug(String(s || '')).replace(/-/g, '')

export function CatalogProvider({ children }) {
  const [products, setProducts] = useLocalStorageState('catalog:products:v1', [])
  const [extraShops, setExtraShops] = useLocalStorageState('catalog:shops:extra:v1', [])
  const [shopOverrides, setShopOverrides] = useLocalStorageState('catalog:shop-overrides:v1', {})
  const [followedShopIds, setFollowedShopIds] = useLocalStorageState('catalog:follows:v1', ['cocoon-official'])

  /** Lần đầu chạy: nạp dữ liệu mock vào localStorage */
  const productList = useMemo(() => (products.length ? products : seedProducts), [products])

  /**
   * shopList = shop gốc + shop người bán tự tạo + các chỉnh sửa đã lưu
   * (tên, slogan, avatar, khu vực...) => đổi ảnh đại diện shop vẫn giữ sau khi tải lại trang.
   */
  const shopList = useMemo(() => {
    const base = [...seedShops, ...extraShops.filter((s) => !seedShops.some((x) => x.id === s.id))]
    return base.map((s) => ({ ...s, ...(shopOverrides[s.id] || {}) }))
  }, [extraShops, shopOverrides])


  /** Bổ sung số liệu thống kê cho từng shop (số sản phẩm, đã bán, đang theo dõi) */
  const shops = useMemo(() => {
    const stats = new Map()
    productList.forEach((p) => {
      const cur = stats.get(p.shopId) || { count: 0, sold: 0, ratingSum: 0 }
      cur.count += 1
      cur.sold += p.sold || 0
      cur.ratingSum += p.rating || 0
      stats.set(p.shopId, cur)
    })
    return shopList.map((s) => {
      const st = stats.get(s.id)
      return {
        ...s,
        productCount: st?.count || 0,
        totalSold: st?.sold || 0,
        avgProductRating: st ? Number((st.ratingSum / st.count).toFixed(2)) : s.rating,
        followed: followedShopIds.includes(s.id),
      }
    })
  }, [shopList, productList, followedShopIds])

  const getShop = useCallback((id) => shops.find((s) => s.id === id) || getSeedShop(id), [shops])
  const getProductById = useCallback((id) => productList.find((p) => p.id === id) || null, [productList])
  const getProductBySlug = useCallback((slug) => productList.find((p) => p.slug === slug) || null, [productList])
  const getProductsByShop = useCallback((shopId) => productList.filter((p) => p.shopId === shopId), [productList])

  /**
   * Truy vấn sản phẩm có lọc + sắp xếp.
   * Khi nối API thật: thay thân hàm này bằng lời gọi API tương ứng.
   */
  const queryProducts = useCallback(
    ({
      q = '',
      categoryId = '',
      shopId = '',
      mall = false,
      freeship = false,
      flash = false,
      minPrice = null,
      maxPrice = null,
      minRating = 0,
      location = '',
      sort = 'popular',
      limit = null,
      excludeId = '',
    } = {}) => {
      const key = normalize(q)
      let list = productList.filter((p) => {
        if (excludeId && p.id === excludeId) return false
        if (categoryId && p.categoryId !== categoryId) return false
        if (shopId && p.shopId !== shopId) return false
        if (mall && !p.mall) return false
        if (freeship && !(p.freeship || p.extraShip)) return false
        if (flash && !p.flash) return false
        if (minPrice != null && p.price < minPrice) return false
        if (maxPrice != null && p.price > maxPrice) return false
        if (minRating && p.rating < minRating) return false
        if (location && p.location !== location) return false
        if (key) {
          const haystack = `${normalize(p.name)}${normalize(p.shopName)}${normalize(getCategory(p.categoryId)?.name)}`
          if (!haystack.includes(key)) return false
        }
        return true
      })

      const sorters = {
        popular: (a, b) => b.sold - a.sold,
        newest: (a, b) => new Date(b.createdAt) - new Date(a.createdAt),
        'price-asc': (a, b) => a.price - b.price,
        'price-desc': (a, b) => b.price - a.price,
        discount: (a, b) => b.discount - a.discount,
        rating: (a, b) => b.rating - a.rating,
      }
      list = [...list].sort(sorters[sort] || sorters.popular)
      return limit ? list.slice(0, limit) : list
    },
    [productList],
  )

  const flashProducts = useMemo(() => productList.filter((p) => p.flash).slice(0, 5), [productList])
  const featuredShops = useMemo(() => shops.filter((s) => s.mall).slice(0, 2), [shops])
  const shoppingLocations = useMemo(
    () => [...new Set(productList.map((p) => p.location))].sort((a, b) => a.localeCompare(b, 'vi')),
    [productList],
  )

  const toggleFollow = useCallback(
    (shopId) =>
      setFollowedShopIds((list) => (list.includes(shopId) ? list.filter((i) => i !== shopId) : [...list, shopId])),
    [setFollowedShopIds],
  )

  /** Tạo shop mới khi có người đăng ký bán hàng */
  const addShop = useCallback(
    (data) => {
      const shop = {
        id: data.id || makeId('shop'),
        name: data.name,
        mall: false,
        rating: 5,
        ratingCount: 0,
        followers: 0,
        responseRate: 100,
        responseTime: 'trong vài giờ',
        joined: String(new Date().getFullYear()),
        location: data.location || 'TP. Hồ Chí Minh',
        emoji: data.emoji || '🏪',
        hue: data.hue ?? 20,
        tagline: data.tagline || 'Gian hàng mới trên ShopNova',
        ...data,
      }
      shop.avatar = shopAvatar({ name: shop.name, emoji: shop.emoji, hue: shop.hue })
      shop.productCount = 0
      setExtraShops((list) => [...list, shop])
      return shop
    },
    [setExtraShops],
  )

  /** Người bán: thêm mới hoặc cập nhật sản phẩm */
  const upsertProduct = useCallback(
    (data) => {
      const shop = getShop(data.shopId)
      const categoryId = data.categoryId || 'nha-cua'
      const price = Number(data.price) || 0
      const originalPrice = Number(data.originalPrice) || 0
      const tags = data.tags || []
      const base = {
        ...data,
        price,
        originalPrice,
        discount: discountPercent(price, originalPrice),
        shopName: shop?.name || data.shopName || 'ShopNova',
        shopMall: Boolean(shop?.mall),
        sold: Number(data.sold) || 0,
        rating: Number(data.rating) || 5,
        stock: Number(data.stock) || 0,
        soldPercent: Number(data.soldPercent) || 0,
        location: data.location || shop?.location || 'TP. Hồ Chí Minh',
        emoji: data.emoji || '🛍️',
        tags,
        mall: tags.includes('mall'),
        favorites: tags.includes('favorites'),
        freeship: tags.includes('freeship'),
        extraShip: tags.includes('extra'),
        variantGroups: data.variantGroups || [],
      }

      setProducts((list) => {
        const current = list.length ? list : seedProducts
        const existing = data.id ? current.find((p) => p.id === data.id) : null
        if (existing) {
          return current.map((p) =>
            p.id === data.id
              ? {
                  ...p,
                  ...base,
                  image: productImage({ emoji: base.emoji, name: base.name, categoryId }),
                }
              : p,
          )
        }
        const id = data.id || `p${Date.now().toString(36)}`
        const tone = current.length
        return [
          {
            ...base,
            id,
            slug: `${toSlug(base.name)}-${id}`,
            image: productImage({ emoji: base.emoji, name: base.name, categoryId, tone }),
            gallery: [0, 1, 2, 3].map((t) =>
              productImage({ emoji: base.emoji, name: base.name, categoryId, tone: tone + t }),
            ),
            description: base.description || `${base.name} đang được bán tại ${shop?.name || 'ShopNova'}.`,
            specs: base.specs || [
              ['Ngành hàng', getCategory(categoryId)?.name || 'Khác'],
              ['Gửi từ', base.location],
              ['Kho hàng', `${base.stock}`],
            ],
            createdAt: new Date().toISOString(),
          },
          ...current,
        ]
      })
      return { ok: true, id: data.id }
    },
    [getShop, setProducts],
  )

  /** Người bán: cập nhật thông tin gian hàng (kể cả ĐỔI ẢNH ĐẠI DIỆN) */
  const updateShop = useCallback(
    (shopId, patch) => {
      const current = shops.find((s) => s.id === shopId) || {}
      const merged = { ...current, ...patch }
      // Ảnh đại diện: ưu tiên ảnh tải lên, nếu không thì sinh từ emoji + màu thương hiệu
      const avatar =
        merged.avatarUrl || shopAvatar({ name: merged.name || 'Shop', emoji: merged.emoji || '🏪', hue: merged.hue ?? 20 })

      setShopOverrides((prev) => ({ ...prev, [shopId]: { ...(prev[shopId] || {}), ...patch, avatar } }))
      setExtraShops((list) => list.map((s) => (s.id === shopId ? { ...s, ...patch, avatar } : s)))
      return { ...merged, avatar }
    },
    [shops, setShopOverrides, setExtraShops],
  )

  const deleteProduct = useCallback(
    (id) => setProducts((list) => (list.length ? list : seedProducts).filter((p) => p.id !== id)),
    [setProducts],
  )

  const value = useMemo(
    () => ({
      categories: seedCategories,
      products: productList,
      shops,
      flashProducts,
      featuredShops,
      shoppingLocations,
      followedShopIds,
      getCategory,
      getShop,
      getProductById,
      getProductBySlug,
      getProductsByShop,
      queryProducts,
      toggleFollow,
      addShop,
      updateShop,
      upsertProduct,
      deleteProduct,
    }),
    [
      productList,
      shops,
      flashProducts,
      featuredShops,
      shoppingLocations,
      followedShopIds,
      getShop,
      getProductById,
      getProductBySlug,
      getProductsByShop,
      queryProducts,
      toggleFollow,
      addShop,
      updateShop,
      upsertProduct,
      deleteProduct,
    ],
  )

  return <CatalogContext.Provider value={value}>{children}</CatalogContext.Provider>
}

export function useCatalog() {
  const ctx = useContext(CatalogContext)
  if (!ctx) throw new Error('useCatalog phải dùng bên trong <CatalogProvider>')
  return ctx
}

export default CatalogContext
