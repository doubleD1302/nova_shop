import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useCatalog } from '../context/CatalogContext'
import { useToast } from '../context/ToastContext'
import { formatFollowers, formatNumber } from '../utils/format'
import { MallBadge } from '../components/ui/Badge'
import Breadcrumb from '../components/ui/Breadcrumb'
import { IconCheck, IconSearch, IconStar, IconStore } from '../components/ui/Icons'
import SmartImage from '../components/ui/SmartImage'

/** TRANG DANH SÁCH GIAN HÀNG — thể hiện rõ "nhiều người bán" trên sàn */
export default function ShopsPage() {
  const { toggleFollow, loadShops } = useCatalog()
  const { pushToast } = useToast()
  const [keyword, setKeyword] = useState('')
  const [onlyMall, setOnlyMall] = useState(false)
  const [debouncedKeyword, setDebouncedKeyword] = useState('')
  const [offset, setOffset] = useState(0)
  const [result, setResult] = useState({ shops: [], total: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedKeyword(keyword.trim()), 250)
    return () => window.clearTimeout(timer)
  }, [keyword])

  useEffect(() => {
    let current = true
    setLoading(true)
    setError('')
    loadShops({ q: debouncedKeyword, mall: onlyMall, limit: 24, offset })
      .then((data) => {
        if (!current) return
        setResult((old) => ({ shops: offset ? [...old.shops, ...data.shops] : data.shops, total: offset ? old.total : Number(data.total || 0) }))
      })
      .catch((loadError) => { if (current) setError(loadError.message || 'Không thể tải gian hàng.') })
      .finally(() => { if (current) setLoading(false) })
    return () => { current = false }
  }, [debouncedKeyword, onlyMall, offset, loadShops])

  const list = result.shops

  return (
    <div>
      <Breadcrumb className="mb-2" items={[{ label: 'Trang chủ', to: '/' }, { label: 'Tất cả gian hàng' }]} />

      <div className="flex flex-wrap items-center gap-3 rounded-sm border border-line bg-white px-4 py-3">
        <h1 className="text-[16px] font-bold text-ink">Gian Hàng Trên ShopNova</h1>
        <span className="text-[13px] text-muted">
              {formatNumber(result.total)} người bán
        </span>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <label className="flex h-9 items-center gap-2 rounded-sm border border-line px-2.5">
            <IconSearch className="h-4 w-4 text-muted" />
            <input
              value={keyword}
              onChange={(e) => { setKeyword(e.target.value); setOffset(0) }}
              placeholder="Tìm gian hàng..."
              className="w-[180px] text-[13px] outline-none"
            />
          </label>
          <button
            type="button"
            onClick={() => { setOnlyMall((v) => !v); setOffset(0) }}
            className={`flex h-9 items-center gap-1.5 rounded-sm border px-3 text-[13px] transition ${
              onlyMall ? 'border-mall bg-mall text-white' : 'border-line text-ink-soft hover:border-mall hover:text-mall'
            }`}
          >
            <IconCheck className="h-3.5 w-3.5" />
            Chỉ Nova Mall
          </button>
        </div>
      </div>

      {error ? <p role="alert" className="mt-3 rounded-sm bg-rose-50 p-3 text-sm text-rose-700">{error}</p> : null}
      {loading && !list.length ? <p className="mt-3 rounded-sm bg-white p-8 text-center text-sm text-muted">Đang tải gian hàng...</p> : null}
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {list.map((shop) => (
          <div key={shop.id} className="overflow-hidden rounded-sm border border-line bg-white">
            <div
              className="h-[62px] w-full"
              style={{
                backgroundImage: `linear-gradient(120deg, hsl(${shop.hue} 80% 48%), hsl(${(shop.hue + 45) % 360} 78% 62%))`,
              }}
            />
            <div className="flex items-start gap-3 px-3 pb-3">
              <Link to={`/shop/${shop.id}`} className="-mt-6 shrink-0">
                <span className="grid h-[58px] w-[58px] place-items-center overflow-hidden rounded-full border-2 border-white bg-white">
                  <SmartImage
                    src={shop.avatar}
                    fallback={shop.avatar}
                    alt={shop.name}
                    className="h-full w-full object-cover"
                  />
                </span>
              </Link>
              <div className="min-w-0 flex-1 pt-2">
                <Link to={`/shop/${shop.id}`} className="flex items-center gap-1.5">
                  <span className="truncate text-[14px] font-semibold text-ink hover:text-brand">{shop.name}</span>
                  {shop.mall ? <MallBadge /> : null}
                </Link>
                <p className="line-clamp-1 text-[12px] text-muted">{shop.tagline}</p>
              </div>
            </div>

            <div className="grid grid-cols-3 border-y border-line text-center text-[12px]">
              <span className="border-r border-line py-2">
                <b className="block text-ink">{shop.productCount}</b>
                <span className="text-muted">Sản phẩm</span>
              </span>
              <span className="border-r border-line py-2">
                <b className="block text-ink">{formatFollowers(shop.followers)}</b>
                <span className="text-muted">Theo dõi</span>
              </span>
              <span className="py-2">
                <b className="flex items-center justify-center gap-1 text-ink">
                  <IconStar className="h-3.5 w-3.5 text-[#ffce3d]" filled />
                  {shop.rating}
                </b>
                <span className="text-muted">Đánh giá</span>
              </span>
            </div>

            <div className="flex items-center gap-2 p-3">
              <Link
                to={`/shop/${shop.id}`}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-sm bg-brand py-2 text-[13px] font-medium text-white transition hover:brightness-105"
              >
                <IconStore className="h-4 w-4" />
                Xem gian hàng
              </Link>
              <button
                type="button"
                onClick={() => {
                  toggleFollow(shop.id)
                  pushToast(shop.followed ? `Đã bỏ theo dõi ${shop.name}` : `Đang theo dõi ${shop.name}`, 'info')
                }}
                className={`rounded-sm border px-3 py-2 text-[13px] transition ${
                  shop.followed ? 'border-brand text-brand' : 'border-line text-ink-soft hover:border-brand hover:text-brand'
                }`}
              >
                ♥
              </button>
              <span className="text-[12px] text-muted">{shop.location}</span>
            </div>
          </div>
        ))}
      </div>
      {offset + 24 < result.total ? <div className="mt-4 text-center"><button type="button" disabled={loading} onClick={() => setOffset((value) => value + 24)} className="rounded-sm border border-line bg-white px-8 py-2.5 text-sm text-ink-soft disabled:opacity-50">{loading ? 'Đang tải...' : 'Xem thêm gian hàng'}</button></div> : null}
    </div>
  )
}
