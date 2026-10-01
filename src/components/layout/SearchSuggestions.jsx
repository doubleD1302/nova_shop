import { formatVnd } from '../../utils/format'
import SmartImage from '../ui/SmartImage'

export const HOT_KEYWORDS = [
  'tai nghe bluetooth',
  'sạc dự phòng',
  'cocoon',
  'áo thun nam',
  'robot hút bụi',
  'kem dưỡng ẩm',
  'bàn phím cơ',
  'nồi chiên không dầu',
]

/** Dropdown gợi ý của ô tìm kiếm */
export default function SearchSuggestions({ keyword, productHits, shopHits, onPickKeyword, onPickProduct, onPickShop, onViewAll }) {
  if (!keyword.trim()) {
    return (
      <div className="p-3">
        <p className="mb-2 text-[12px] font-semibold uppercase text-muted">Tìm kiếm phổ biến</p>
        <div className="flex flex-wrap gap-2">
          {HOT_KEYWORDS.map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => onPickKeyword(k)}
              className="rounded-full border border-line px-2.5 py-1 text-[12px] text-ink-soft transition hover:border-brand hover:text-brand"
            >
              {k}
            </button>
          ))}
        </div>
      </div>
    )
  }

  const empty = !productHits.length && !shopHits.length

  return (
    <>
      {productHits.length ? (
        <div className="border-b border-line py-1">
          <p className="px-3 py-1 text-[11px] font-semibold uppercase text-muted">Sản phẩm</p>
          {productHits.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => onPickProduct(p)}
              className="flex w-full items-center gap-3 px-3 py-1.5 text-left transition hover:bg-page"
            >
              <SmartImage src={p.image} fallback={p.image} alt="" className="h-9 w-9 shrink-0 rounded-sm object-cover" />
              <span className="line-clamp-1 flex-1 text-[13px] text-ink">{p.name}</span>
              <span className="shrink-0 text-[13px] font-medium text-brand">{formatVnd(p.price)}</span>
            </button>
          ))}
        </div>
      ) : null}

      {shopHits.length ? (
        <div className="border-b border-line py-1">
          <p className="px-3 py-1 text-[11px] font-semibold uppercase text-muted">Gian hàng</p>
          {shopHits.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => onPickShop(s)}
              className="flex w-full items-center gap-3 px-3 py-1.5 text-left transition hover:bg-page"
            >
              <SmartImage src={s.avatar} fallback={s.avatar} alt="" className="h-8 w-8 shrink-0 rounded-full object-cover" />
              <span className="line-clamp-1 flex-1 text-[13px] text-ink">{s.name}</span>
              <span className="shrink-0 text-[12px] text-muted">{s.productCount} sản phẩm</span>
            </button>
          ))}
        </div>
      ) : null}

      {empty ? (
        <p className="px-3 py-4 text-center text-[13px] text-muted">
          Không tìm thấy kết quả cho “{keyword}”. Thử từ khoá khác nhé!
        </p>
      ) : null}

      <button
        type="button"
        onClick={onViewAll}
        className="w-full bg-page px-3 py-2 text-[13px] font-medium text-brand transition hover:bg-brand-soft"
      >
        Xem tất cả kết quả cho “{keyword}”
      </button>
    </>
  )
}
