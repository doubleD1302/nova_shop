import { useMemo } from 'react'
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

/** TRANG CHI TIẾT SẢN PHẨM */
export default function ProductDetailPage() {
  const { slug } = useParams()
  const { getProductBySlug, getShop, queryProducts, toggleFollow } = useCatalog()
  const { pushToast } = useToast()

  const product = getProductBySlug(slug)
  const shop = product ? getShop(product.shopId) : null

  const sameShop = useMemo(
    () => (product ? queryProducts({ shopId: product.shopId, excludeId: product.id, limit: 7 }) : []),
    [product, queryProducts],
  )
  const sameCategory = useMemo(
    () =>
      product
        ? queryProducts({ categoryId: product.categoryId, excludeId: product.id, limit: 12, sort: 'popular' })
        : [],
    [product, queryProducts],
  )
  const topRated = useMemo(
    () => (product ? queryProducts({ shopId: product.shopId, excludeId: product.id, limit: 5, sort: 'rating' }) : []),
    [product, queryProducts],
  )

  if (!product) {
    return (
      <div className="rounded-sm border border-line bg-white">
        <EmptyState
          emoji="😕"
          title="Không tìm thấy sản phẩm"
          description="Sản phẩm có thể đã bị người bán gỡ bỏ hoặc đường dẫn không đúng."
          action={
            <Link
              to="/tim-kiem"
              className="rounded-sm bg-brand px-4 py-2 text-[13px] font-medium text-white transition hover:brightness-105"
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
    <div>
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
      <div className="rounded-sm bg-white">
        <div className="flex flex-col gap-4 p-4 lg:flex-row">
          <ProductGallery product={product} />
          <ProductPurchasePanel product={product} />
        </div>
        <ShopCard
          shop={shop}
          onFollow={onFollow}
          onChat={() => pushToast(`Đang mở cửa sổ chat với ${shop?.name} (demo)`, 'info')}
        />
      </div>

      <ProductInfoTabs product={product} />
      <ProductReviews product={product} />

      {/* Sản phẩm khác của shop */}
      <section className="mt-3 rounded-sm border border-line bg-white">
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <h2 className="text-[15px] font-bold uppercase text-ink">Sản Phẩm Khác Của Shop</h2>
          <Link to={`/shop/${product.shopId}`} className="text-[13px] text-brand hover:underline">
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
        <section className="mt-3 rounded-sm border border-line bg-white">
          <div className="border-b border-line px-4 py-3">
            <h2 className="text-[15px] font-bold uppercase text-ink">Top Sản Phẩm Đánh Giá Cao</h2>
          </div>
          <div className="grid grid-cols-2 gap-2.5 p-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {topRated.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      ) : null}

      {/* Gợi ý tương tự */}
      <section className="mt-3 rounded-sm border border-line bg-white">
        <div className="border-b border-line px-4 py-3">
          <h2 className="text-[15px] font-bold uppercase text-ink">Có Thể Bạn Cũng Thích</h2>
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
