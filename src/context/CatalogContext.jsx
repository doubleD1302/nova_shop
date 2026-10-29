import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { discountPercent, toSlug } from '../utils/format'
import {
  API_BASE_URL,
  apiDeleteSellerProduct,
  apiGetCategories,
  apiGetProduct,
  apiGetProducts,
  apiGetSellerProducts,
  apiGetShop,
  apiGetShops,
  apiSaveSellerProduct,
  apiUpdateSellerShop,
  invalidatePublicApiCache,
} from '../utils/api'
import { useLocalStorageState } from '../hooks/useLocalStorageState'
import { useAuth } from './AuthContext'
import { DEFAULT_CATEGORIES, DEFAULT_PRODUCTS, DEFAULT_SHOPS } from '../data/defaultCatalog'

const CatalogContext = createContext(null)
const normalize = (s) => toSlug(String(s || '')).replace(/-/g, '')
const storedImageUrl = (url) => API_BASE_URL && typeof url === 'string' && url.startsWith(`${API_BASE_URL}/uploads/`)
  ? url.slice(API_BASE_URL.length)
  : url

function getCached(key, fallback) {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return fallback
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) && parsed.length ? parsed : fallback
  } catch {
    return fallback
  }
}

function setCached(key, data) {
  try {
    if (data && Array.isArray(data) && data.length) {
      localStorage.setItem(key, JSON.stringify(data))
    }
  } catch {}
}

function imageUrl(url) {
  return typeof url === 'string' && url.startsWith('/') ? `${API_BASE_URL}${url}` : url || ''
}

function normalizeProduct(product) {
  const variants = product.variants || []
  const imageRecords = (product.images || []).map((image) => typeof image === 'string' ? { url: image } : image).filter((image) => image?.url)
  const imageUrls = imageRecords.map((image) => imageUrl(image.url))
  const price = Number(product.price) || 0
  const originalPrice = product.originalPrice === null ? 0 : Number(product.originalPrice) || 0
  const sold = Number(product.sold) || 0
  const stock = Number(product.stock) || 0
  const totalQty = sold + stock
  return {
    ...product,
    id: String(product.id),
    shopId: String(product.shopId),
    image: imageUrls[0] || '',
    imageFallback: imageUrls[1] || imageUrls[0] || '',
    gallery: imageUrls,
    galleryImages: imageRecords.map((image, index) => ({ ...image, url: imageUrls[index] })),
    variantImages: {},
    variantGroups: variants.length ? [{ name: 'Phân loại', options: variants.map((variant) => variant.name) }] : [],
    price,
    originalPrice,
    discount: discountPercent(price, originalPrice),
    stock,
    variants,
    rating: Number(product.rating) || 0,
    ratingCount: Number(product.ratingCount) || 0,
    sold,
    soldPercent: totalQty > 0 ? Math.round((sold / totalQty) * 100) : 0,
    freeship: Boolean(product.freeship),
    extraShip: false,
    approvalStatus: product.approvalStatus || 'pending',
    rejectionReason: product.rejectionReason || null,
    reviewedAt: product.reviewedAt || null,
    specs: Object.entries(product.specs || {}),
  }
}

function normalizeShop(shop, followedShopIds) {
  const logoUrl = imageUrl(shop.logoUrl)
  return {
    ...shop,
    id: String(shop.id),
    logoUrl,
    bannerUrl: imageUrl(shop.bannerUrl),
    avatar: logoUrl,
    followed: followedShopIds.includes(String(shop.id)),
  }
}

async function readList(response, key, fallback) {
  const payload = await response.json().catch(() => null)
  if (!response.ok || !payload?.success || !Array.isArray(payload?.data?.[key])) {
    throw new Error(payload?.message || fallback)
  }
  return payload.data
}

export function CatalogProvider({ children }) {
  const { user } = useAuth()
  const isSellerUser = Boolean(user && (user.role === 'seller' || user.shopId))
  const activeSellerUserRef = useRef(isSellerUser ? String(user.id) : '')
  activeSellerUserRef.current = isSellerUser ? String(user.id) : ''
  const [databaseProducts, setDatabaseProducts] = useState(() => getCached('novashop_cache_products_v1', DEFAULT_PRODUCTS))
  const [sellerDatabaseProducts, setSellerDatabaseProducts] = useState([])
  const [sellerProductsTotal, setSellerProductsTotal] = useState(0)
  const [databaseShops, setDatabaseShops] = useState(() => getCached('novashop_cache_shops_v1', DEFAULT_SHOPS))
  const [categories, setCategories] = useState(() => getCached('novashop_cache_categories_v1', DEFAULT_CATEGORIES))
  const [catalogError, setCatalogError] = useState('')
  const [sellerCatalogError, setSellerCatalogError] = useState('')
  const [catalogLoading, setCatalogLoading] = useState(false)
  const [sellerCatalogLoading, setSellerCatalogLoading] = useState(false)
  const [followedShopIds, setFollowedShopIds] = useLocalStorageState(`catalog:follows:v3:${user?.id || 'guest'}`, [])
  const sellerLoadedForRef = useRef('')
  const sellerProductsRef = useRef(sellerDatabaseProducts)
  const sellerProductsTotalRef = useRef(sellerProductsTotal)
  const categoriesRef = useRef(categories)
  const categoriesLoadedRef = useRef(Boolean(categories && categories.length))

  useEffect(() => {
    const isSeller = Boolean(user && (user.role === 'seller' || user.shopId))
    const userId = isSeller ? String(user.id) : ''
    if (sellerLoadedForRef.current !== userId) {
      sellerLoadedForRef.current = ''
      setSellerDatabaseProducts([])
      setSellerProductsTotal(0)
      sellerProductsRef.current = []
      sellerProductsTotalRef.current = 0
      setSellerCatalogError('')
    }
  }, [user?.id, user?.role, user?.shopId])

  const mergeProducts = useCallback((incoming, seller = false) => {
    const setter = seller ? setSellerDatabaseProducts : setDatabaseProducts
    setter((current) => {
      const byId = new Map(current.map((product) => [String(product.id), product]))
      for (const product of incoming) byId.set(String(product.id), { ...byId.get(String(product.id)), ...product })
      return [...byId.values()]
    })
  }, [])

  const loadProducts = useCallback(async (options = {}) => {
    setCatalogLoading(true)
    setCatalogError('')
    try {
      const response = await apiGetProducts({ limit: 20, ...options })
      const data = await readList(response, 'products', 'Không thể tải sản phẩm.')
      const products = data.products.map(normalizeProduct)
      mergeProducts(products)
      setCached('novashop_cache_products_v1', products)
      return { products, total: Number(data.total ?? products.length), limit: Number(data.limit ?? options.limit ?? 20), offset: Number(data.offset ?? options.offset ?? 0) }
    } catch (error) {
      if (error?.name === 'AbortError') throw error
      // Dự phòng an toàn: lấy từ bộ nhớ cache hoặc mẫu mặc định để giao diện không bao giờ bị lỗi
      const cached = getCached('novashop_cache_products_v1', DEFAULT_PRODUCTS)
      let list = (cached && cached.length ? cached : DEFAULT_PRODUCTS).map(normalizeProduct)
      if (options.flash) list = list.filter((p) => p.flash)
      if (options.mall) list = list.filter((p) => p.shopMall)
      if (options.category) list = list.filter((p) => p.categoryId === options.category || p.categorySlug === options.category)
      const limit = Number(options.limit ?? 20)
      const offset = Number(options.offset ?? 0)
      const paged = list.slice(offset, offset + limit)
      mergeProducts(paged)
      return { products: paged, total: list.length, limit, offset }
    } finally {
      setCatalogLoading(false)
    }
  }, [mergeProducts])

  const loadProductBySlug = useCallback(async (slug, { signal } = {}) => {
    const requestedSlug = String(slug || '')
    const response = await apiGetProduct(requestedSlug, { signal })
    if (response.status === 404) {
      const error = new Error('Không tìm thấy sản phẩm này.')
      error.code = 'PRODUCT_NOT_FOUND'
      throw error
    }
    const data = await readList(response, 'products', 'Khong the tai san pham.')
    if (signal?.aborted) throw new DOMException('The request was aborted.', 'AbortError')
    const matchedProduct = data.products.find((item) => item?.slug === requestedSlug)
    if (!matchedProduct) {
      if (!data.products.length) {
        const error = new Error('Không tìm thấy sản phẩm này.')
        error.code = 'PRODUCT_NOT_FOUND'
        throw error
      }
      throw new Error('Máy chủ trả về sản phẩm không khớp với đường dẫn yêu cầu.')
    }
    const product = normalizeProduct(matchedProduct)
    mergeProducts([product])
    return product
  }, [mergeProducts])

  const loadCategories = useCallback(async ({ signal } = {}) => {
    if (categoriesLoadedRef.current && categoriesRef.current?.length) return categoriesRef.current
    const enrich = (list) =>
      list.map((c) => {
        const slug = c.slug || c.id || ''
        const realImg = c.imageUrl || c.image || (slug ? `/images/categories/${slug}.jpg` : '')
        return {
          ...c,
          image: realImg,
          imageUrl: realImg,
        }
      })
    try {
      const response = await apiGetCategories({ signal })
      const data = await readList(response, 'categories', 'Không thể tải danh mục.')
      const availableCategories = enrich(data.categories)
      categoriesRef.current = availableCategories
      categoriesLoadedRef.current = true
      setCategories(availableCategories)
      setCached('novashop_cache_categories_v1', availableCategories)
      setCatalogError('')
      return availableCategories
    } catch (error) {
      if (signal?.aborted) throw error
      // Dự phòng an toàn: Sử dụng danh mục đã lưu trong bộ nhớ hoặc danh mục mặc định
      const cached = getCached('novashop_cache_categories_v1', DEFAULT_CATEGORIES)
      const available = enrich(cached && cached.length ? cached : DEFAULT_CATEGORIES)
      categoriesRef.current = available
      categoriesLoadedRef.current = true
      setCategories(available)
      return available
    }
  }, [])

  const loadShops = useCallback(async (options = {}) => {
    try {
      const response = await apiGetShops(options)
      const data = await readList(response, 'shops', 'Không thể tải gian hàng.')
      const shops = data.shops.map((shop) => normalizeShop(shop, followedShopIds))
      setDatabaseShops((current) => {
        const byId = new Map(current.map((shop) => [String(shop.id), shop]))
        shops.forEach((shop) => byId.set(String(shop.id), { ...byId.get(String(shop.id)), ...shop }))
        return [...byId.values()]
      })
      setCached('novashop_cache_shops_v1', shops)
      setCatalogError('')
      return { shops, total: Number(data.total ?? shops.length), limit: Number(data.limit ?? options.limit ?? 24), offset: Number(data.offset ?? options.offset ?? 0) }
    } catch (error) {
      if (error?.name === 'AbortError') throw error
      // Dự phòng an toàn: lấy gian hàng từ bộ nhớ cache hoặc mẫu mặc định
      const cached = getCached('novashop_cache_shops_v1', DEFAULT_SHOPS)
      const list = (cached && cached.length ? cached : DEFAULT_SHOPS).map((shop) => normalizeShop(shop, followedShopIds))
      setDatabaseShops((current) => {
        const byId = new Map(current.map((shop) => [String(shop.id), shop]))
        list.forEach((shop) => byId.set(String(shop.id), { ...byId.get(String(shop.id)), ...shop }))
        return [...byId.values()]
      })
      return { shops: list, total: list.length, limit: Number(options.limit ?? 24), offset: 0 }
    }
  }, [followedShopIds])

  const loadShop = useCallback(async (shopId, { signal } = {}) => {
    const response = await apiGetShop(shopId, { signal })
    const payload = await response.json().catch(() => null)
    if (!response.ok || !payload?.success || !payload.data?.shop) throw new Error(payload?.message || 'Không thể tải gian hàng.')
    const shop = normalizeShop(payload.data.shop, followedShopIds)
    setDatabaseShops((current) => [...current.filter((item) => String(item.id) !== shop.id), shop])
    return shop
  }, [followedShopIds])

  const loadSellerProducts = useCallback(async ({ force = false, limit = 50, offset = 0, productId = '' } = {}) => {
    const userId = String(user?.id || '')
    const isSeller = Boolean(user && (user.role === 'seller' || user.shopId))
    if (!userId || !isSeller) return { products: [], total: 0 }
    if (!force && !productId && offset === 0 && sellerLoadedForRef.current === userId) {
      return { products: sellerProductsRef.current, total: sellerProductsTotalRef.current }
    }
    setSellerCatalogLoading(true)
    setSellerCatalogError('')
    try {
      const response = await apiGetSellerProducts({ limit, offset, productId })
      const data = await readList(response, 'products', 'Không thể tải sản phẩm của gian hàng.')
      if (activeSellerUserRef.current !== userId) return { products: [], total: 0 }
      const products = data.products.map(normalizeProduct)
      if (productId || offset > 0) {
        const merged = [...new Map([...sellerProductsRef.current, ...products].map((product) => [String(product.id), product])).values()]
        sellerProductsRef.current = merged
        setSellerDatabaseProducts(merged)
      } else {
        sellerProductsRef.current = products
        setSellerDatabaseProducts(products)
      }
      if (!productId) {
        sellerProductsTotalRef.current = Number(data.total ?? products.length)
        setSellerProductsTotal(sellerProductsTotalRef.current)
      }
      if (!productId && offset === 0) sellerLoadedForRef.current = userId
      return { products, total: Number(data.total ?? products.length) }
    } catch (error) {
      setSellerCatalogError(error.message || 'Không thể tải sản phẩm của gian hàng.')
      throw error
    } finally {
      setSellerCatalogLoading(false)
    }
  }, [user?.id, user?.role])

  const productList = useMemo(() => databaseProducts, [databaseProducts])
  const sellerProductList = useMemo(
    () => activeSellerUserRef.current && sellerLoadedForRef.current === activeSellerUserRef.current ? sellerDatabaseProducts : [],
    [sellerDatabaseProducts, user?.id, user?.role],
  )
  const shops = useMemo(() => databaseShops.map((shop) => ({
    ...shop,
    followed: followedShopIds.includes(String(shop.id)),
  })), [databaseShops, followedShopIds])

  const getCategory = useCallback((id) => categories.find((category) => category.id === id || category.slug === id) || null, [categories])
  const getShop = useCallback((id) => shops.find((shop) => String(shop.id) === String(id) || shop.slug === id) || null, [shops])
  const getProductById = useCallback((id) => sellerProductList.find((product) => product.id === String(id)) || productList.find((product) => product.id === String(id)) || null, [productList, sellerProductList])
  const getProductBySlug = useCallback((slug) => productList.find((product) => product.slug === slug) || null, [productList])
  const getProductsByShop = useCallback((shopId) => productList.filter((product) => product.shopId === String(shopId)), [productList])
  const getSellerProductsByShop = useCallback((shopId) => sellerProductList.filter((product) => product.shopId === String(shopId)), [sellerProductList])

  const queryProducts = useCallback(({
    q = '', categoryId = '', shopId = '', mall = false, freeship = false, flash = false,
    minPrice = null, maxPrice = null, minRating = 0, location = '', sort = 'popular', limit = null, excludeId = '',
  } = {}) => {
    const key = normalize(q)
    let list = productList.filter((product) => {
      if (excludeId && product.id === String(excludeId)) return false
      if (categoryId && product.categoryId !== categoryId) return false
      if (shopId && product.shopId !== String(shopId)) return false
      if (mall && !product.mall) return false
      if (freeship && !product.freeship) return false
      if (flash && !product.flash) return false
      if (minPrice != null && product.price < minPrice) return false
      if (maxPrice != null && product.price > maxPrice) return false
      if (minRating && product.rating < minRating) return false
      if (location && product.location !== location) return false
      if (key && !`${normalize(product.name)}${normalize(product.shopName)}${normalize(getCategory(product.categoryId)?.name)}`.includes(key)) return false
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
  }, [getCategory, productList])

  const flashProducts = useMemo(() => queryProducts({ flash: true, limit: 5 }), [queryProducts])
  const featuredShops = useMemo(() => shops.filter((shop) => shop.mall).slice(0, 2), [shops])
  const shoppingLocations = useMemo(() => [...new Set(productList.map((product) => product.location).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'vi')), [productList])

  const toggleFollow = useCallback((shopId) => {
    const id = String(shopId)
    setFollowedShopIds((list) => list.includes(id) ? list.filter((item) => item !== id) : [...list, id])
  }, [setFollowedShopIds])

  const refreshProducts = useCallback(async () => {
    invalidatePublicApiCache('/products')
    setDatabaseProducts([])
    if (sellerLoadedForRef.current === String(user?.id || '')) await loadSellerProducts({ force: true })
  }, [loadSellerProducts, user?.id])

  const refreshPublicCatalog = useCallback(() => {
    invalidatePublicApiCache()
    setDatabaseProducts([])
    setDatabaseShops([])
    setCategories([])
    categoriesRef.current = []
    categoriesLoadedRef.current = false
    setCatalogError('')
  }, [])

  const addShop = useCallback(async () => ({ ok: false, error: 'Gian hàng được tạo cùng lúc với tài khoản người bán.' }), [])
  const upsertProduct = useCallback(async (data) => {
    const response = await apiSaveSellerProduct({
      name: data.name,
      categoryId: data.categoryId,
      price: Number(data.price),
      originalPrice: data.originalPrice === '' ? null : Number(data.originalPrice),
      stock: Number(data.stock),
      description: data.description || '',
      images: (data.images || []).map((image) => {
        const record = typeof image === 'string' ? { url: image } : image
        return record?.url ? { ...record, url: storedImageUrl(record.url) } : null
      }).filter(Boolean),
      status: data.status || 'draft',
      freeShipping: Boolean(data.freeShipping ?? data.tags?.includes('freeship')),
    }, data.id)
    const result = await response.json().catch(() => null)
    if (!response.ok || !result?.success) throw new Error(result?.message || `Không thể lưu sản phẩm (HTTP ${response.status}).`)
    await refreshProducts()
    return { ok: true, id: result.data?.productId }
  }, [refreshProducts])

  const updateShop = useCallback(async (_shopId, patch) => {
    const response = await apiUpdateSellerShop({
      name: patch.name,
      tagline: patch.tagline || '',
      description: patch.description || '',
      province: patch.location,
      address: patch.address || '',
      logoUrl: storedImageUrl(patch.logoUrl ?? patch.avatarUrl ?? null),
      bannerUrl: storedImageUrl(patch.bannerUrl ?? null),
    })
    const result = await response.json().catch(() => null)
    if (!response.ok || !result?.success) throw new Error(result?.message || `Không thể cập nhật gian hàng (HTTP ${response.status}).`)
    invalidatePublicApiCache('/shops')
    if (result.data?.shop) {
      const normalized = normalizeShop(result.data.shop, followedShopIds)
      setDatabaseShops((current) => [...current.filter((shop) => String(shop.id) !== normalized.id), normalized])
    }
    return result.data?.shop
  }, [followedShopIds])

  const deleteProduct = useCallback(async (id) => {
    const response = await apiDeleteSellerProduct(id)
    const result = await response.json().catch(() => null)
    if (!response.ok || !result?.success) throw new Error(result?.message || `Không thể xóa sản phẩm (HTTP ${response.status}).`)
    await refreshProducts()
    return true
  }, [refreshProducts])

  const value = useMemo(() => ({
    categories, products: productList, sellerProducts: sellerProductList, sellerProductsTotal, refreshProducts, refreshPublicCatalog,
    loadProducts, loadProductBySlug, loadCategories, loadShops, loadShop, loadSellerProducts,
    shops, flashProducts, featuredShops, shoppingLocations, followedShopIds,
    getCategory, getShop, getProductById, getProductBySlug, getProductsByShop,
    getSellerProductsByShop, queryProducts, catalogError, sellerCatalogError,
    catalogLoading, sellerCatalogLoading, toggleFollow, addShop, updateShop,
    upsertProduct, deleteProduct, mergeProducts,
  }), [
    categories, productList, sellerProductList, sellerProductsTotal, refreshProducts, refreshPublicCatalog, loadProducts, loadProductBySlug,
    loadCategories, loadShops, loadShop, loadSellerProducts, shops, flashProducts,
    featuredShops, shoppingLocations, followedShopIds, getCategory, getShop,
    getProductById, getProductBySlug, getProductsByShop, getSellerProductsByShop,
    queryProducts, catalogError, sellerCatalogError, catalogLoading,
    sellerCatalogLoading, toggleFollow, addShop, updateShop, upsertProduct,
    deleteProduct, mergeProducts,
  ])

  return <CatalogContext.Provider value={value}>{children}</CatalogContext.Provider>
}

export function useCatalog() {
  const context = useContext(CatalogContext)
  if (!context) throw new Error('useCatalog phải dùng bên trong <CatalogProvider>')
  return context
}

export default CatalogContext
