import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useCatalog } from '../context/CatalogContext'
import { useToast } from '../context/ToastContext'
import { getCategoryName } from '../data/categories'
import Breadcrumb from '../components/ui/Breadcrumb'
import EmptyState from '../components/ui/EmptyState'
import ProductCard from '../components/product/ProductCard'
import ProductGallery from '../components/product/ProductGallery'
import ProductInfoTabs from '../components/product/ProductInfoTabs'
import ProductPurchasePanel from '../components/product/ProductPurchasePanel'
import ProductReviews from '../components/product/ProductReviews'
import ShopCard from '../components/product/ShopCard'
import ReportContentButton from '../components/ui/ReportContentButton'

/** TRANG CHI TIẾT SẢN PHẨM */
export default function ProductDetailPage() {
  const { slug } = useParams()
  const { getProductBySlug, getShop, loadProductBySlug, loadProducts, loadShop, toggleFollow } = useCatalog()
  const { pushToast } = useToast()
  const [variantSelections, setVariantSelections] = useState({})
  const [reviewSummary, setReviewSummary] = useState(null)
  const [product, setProduct] = useState(() => getProductBySlug(slug))
  const [resolvedSlug, setResolvedSlug] = useState(() => getProductBySlug(slug) ? slug : '')
  const [sameShop, setSameShop] = useState([])
  const [sameCategory, setSameCategory] = useState([])
  const [topRated, setTopRated] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [notFound, setNotFound] = useState(false)
  const handleReviewSummary = useCallback((summary) => setReviewSummary(summary), [])

  useEffect(() => {
    let current = true
    const controller = new AbortController()
    const cached = getProductBySlug(slug)
    setProduct(cached)
    setResolvedSlug(cached ? slug : '')
    setSameShop([])
    setSameCategory([])
    setTopRated([])
    setVariantSelections({})
    setReviewSummary(null)
    setLoading(true)
    setLoadError('')
    setNotFound(false)
    loadProductBySlug(slug, { signal: controller.signal })
      .then(async (selected) => {
        if (!selected) throw new Error('Không tìm thấy sản phẩm này.')
        if (!current) return
        setProduct(selected)
        setResolvedSlug(slug)
        const [shopResult, categoryResult, ratedResult] = await Promise.all([
          loadProducts({ shopId: selected.shopId, sort: 'popular', limit: 7, offset: 0, signal: controller.signal }),
          loadProducts({ categoryId: selected.categoryId, sort: 'popular', limit: 12, offset: 0, signal: controller.signal }),
          loadProducts({ shopId: selected.shopId, sort: 'rating', limit: 5, offset: 0, signal: controller.signal }),
          loadShop(selected.shopId, { signal: controller.signal }),
        ])
        if (!current) return
        setSameShop(shopResult.products.filter((item) => item.id !== selected.id))
        setSameCategory(categoryResult.products.filter((item) => item.id !== selected.id))
        setTopRated(ratedResult.products.filter((item) => item.id !== selected.id))
      })
      .catch((error) => {
        if (current && error.name !== 'AbortError') {
          setProduct(null)
          setResolvedSlug(slug)
          setLoadError(error.message || 'Unable to load product.')
          setNotFound(error.code === 'PRODUCT_NOT_FOUND')
        }
      })
      .finally(() => { if (current) setLoading(false) })
    return () => { current = false; controller.abort() }
  }, [slug, loadProductBySlug, loadProducts, loadShop])

  const shop = product ? getShop(product.shopId) : null
  const selectedVariants = (product?.variantGroups || []).map(
    (group) => variantSelections[product.id]?.[group.name] || group.options?.[0] || '',
  )
  const selectedVariantLabel = selectedVariants.filter(Boolean).join(' / ')
  const galleryImages = product
    ? product.variantImages?.[selectedVariantLabel] || product.galleryImages || product.gallery || [product.image]
    : []

  if (resolvedSlug !== slug || (loading && !product)) return <div className="rounded-2xl border border-[#E6D5C2] bg-[#FFFCF7] p-8 text-center text-sm text-[#8B7566]">Đang tải sản phẩm...</div>
  if (!product || product.slug !== slug) {
    return (
      <div className="rounded-2xl border border-[#E6D5C2] bg-[#FFFCF7]">
        <EmptyState
          emoji="😕"
          title={notFound ? 'Không tìm thấy sản phẩm' : 'Không thể tải sản phẩm'}
          description={notFound
            ? 'Sản phẩm có thể đã bị người bán gỡ bỏ hoặc đường dẫn không đúng.'
            : loadError || 'Máy chủ không trả về đúng sản phẩm theo đường dẫn yêu cầu.'}
          action={
            <Link
              to="/tim-kiem"
              className="rounded-xl bg-[#BD6E49] hover:bg-[#A95532] px-4 py-2 text-[13px] font-medium text-[#FFFCF7] transition"
            >
              Tiếp tục mua sắm
            </Link>
          }
        />
      </div>
    )
  }

  const onFollow = () => {
    toggleFollow(shop.id)
    pushToast(shop.followed ? `Đã bỏ theo dõi ${shop.name}` : `Đang theo dõi ${shop.name}`, 'info')
  }

  return (
    <div data-product-id={product.id} data-product-slug={product.slug}>
      <Breadcrumb
        className="mb-2"
        items={[
          { label: 'Trang chủ', to: '/' },
          { label: getCategoryName(product.categoryId), to: `/tim-kiem?category=${product.categoryId}` },
          { label: shop?.name || product.shopName, to: `/shop/${product.shopId}` },
          { label: product.name },
        ]}
      />

      {/* Khối mua hàng */}
      <div className="rounded-2xl border border-[#E6D5C2] bg-[#FFFCF7] shadow-2xs overflow-hidden">
        <div className="flex flex-col gap-4 p-4 lg:flex-row">
          <ProductGallery product={product} images={galleryImages} />
          <ProductPurchasePanel
            product={product}
            rating={reviewSummary?.rating ?? product.rating}
            selected={selectedVariants}
            onVariantChange={(groupIndex, option) => {
              const group = product.variantGroups[groupIndex]
              if (!group) return
              setVariantSelections((current) => ({
                ...current,
                [product.id]: { ...current[product.id], [group.name]: option },
              }))
            }}
          />
        </div>
        <ShopCard
          shop={shop}
          onFollow={onFollow}
          onChat={() => pushToast(`Đang mở cửa sổ chat với ${shop?.name} (demo)`, 'info')}
        />
      </div>

      <ProductInfoTabs product={product} />
      <ProductReviews product={product} onSummaryChange={handleReviewSummary} />

      {/* KHU VỰC BÁO CÁO SẢN PHẨM VI PHẠM / HÀNG GIẢ */}
      <div className="mt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-[#E6D5C2] bg-[#FFFCF7] p-4 shadow-2xs">
        <div className="flex items-start sm:items-center gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#F5E7D4] text-lg text-[#BD6E49]">
            🛡️
          </span>
          <div>
            <p className="text-[14px] font-bold text-[#49352D]">Bảo vệ người mua hàng NovaShop</p>
            <p className="text-[12px] text-[#8B7566]">
              Nếu phát hiện sản phẩm có dấu hiệu hàng giả, hàng nhái hoặc vi phạm chính sách, hãy gửi báo cáo để Ban Quản Trị xác minh và xử lý.
            </p>
          </div>
        </div>
        <div className="shrink-0">
          <ReportContentButton
            targetType="product"
            targetId={product.id}
            targetName={product.name}
            product={product}
            shopName={shop?.name || product.shopName}
            buttonLabel="Báo cáo sản phẩm"
            variant="button"
          />
        </div>
      </div>

      {/* Sản phẩm khác của shop */}
      <section className="mt-4 rounded-2xl border border-[#E6D5C2] bg-[#FFFCF7] shadow-2xs overflow-hidden">
        <div className="flex items-center justify-between border-b border-[#E6D5C2] bg-[#F5E7D4] px-4 py-3">
          <h2 className="text-[15px] font-bold uppercase text-[#49352D]">Sản Phẩm Khác Của Shop</h2>
          <Link to={`/shop/${product.shopId}`} className="text-[13px] font-medium text-[#BD6E49] hover:underline">
            Xem shop
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-2.5 p-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {sameShop.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      </section>

      {/* Top sản phẩm bán chạy của shop */}
      {topRated.length ? (
        <section className="mt-4 rounded-2xl border border-[#E6D5C2] bg-[#FFFCF7] shadow-2xs overflow-hidden">
          <div className="border-b border-[#E6D5C2] bg-[#F5E7D4] px-4 py-3">
            <h2 className="text-[15px] font-bold uppercase text-[#49352D]">Top Sản Phẩm Đánh Giá Cao</h2>
          </div>
          <div className="grid grid-cols-2 gap-2.5 p-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {topRated.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      ) : null}

      {/* Gợi ý tương tự */}
      <section className="mt-4 rounded-2xl border border-[#E6D5C2] bg-[#FFFCF7] shadow-2xs overflow-hidden">
        <div className="border-b border-[#E6D5C2] bg-[#F5E7D4] px-4 py-3">
          <h2 className="text-[15px] font-bold uppercase text-[#49352D]">Có Thể Bạn Cũng Thích</h2>
        </div>
        <div className="grid grid-cols-2 gap-2.5 p-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {sameCategory.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      </section>
    </div>
  )
}
