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
        <div className="border-b border-line bg-[#FFFAF5]/50 py-1.5">
          <div className="flex items-center justify-between px-3 py-1 text-[11px] font-bold text-[#BD6E49]">
            <span className="flex items-center gap-1.5 uppercase tracking-wide">
              <span>🏪</span> Shop đề xuất cho “{keyword}”
            </span>
            <span className="rounded-full bg-[#BD6E49]/10 px-2 py-0.5 text-[9px] font-semibold text-[#BD6E49]">
              Chính hãng & uy tín
            </span>
          </div>
          {shopHits.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => onPickShop(s)}
              className="flex w-full items-center gap-3 px-3 py-2 text-left transition hover:bg-[#FAF3EA] cursor-pointer"
            >
              <div className="relative">
                <SmartImage
                  src={s.avatar || s.logoUrl}
                  fallback={s.avatar || s.logoUrl}
                  alt=""
                  className="h-9 w-9 shrink-0 rounded-full object-cover border border-[#E6D5C2]"
                />
                {s.mall ? (
                  <span className="absolute -bottom-1 -right-1 rounded-full bg-red-600 px-1 text-[8px] font-bold text-white leading-tight">
                    Mall
                  </span>
                ) : null}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="truncate text-[13px] font-bold text-[#49352D]">{s.name}</span>
                  {s.mall ? (
                    <span className="rounded-[2px] bg-red-600 px-1 py-[1px] text-[8px] font-bold text-white">
                      MALL
                    </span>
                  ) : null}
                </div>
                <div className="flex items-center gap-2 text-[11px] text-[#8B7566]">
                  {s.rating ? (
                    <span className="flex items-center text-amber-600 font-medium">
                      ★ {s.rating}
                    </span>
                  ) : null}
                  <span>•</span>
                  <span>{s.productCount ? `${s.productCount} sản phẩm` : 'Shop uy tín'}</span>
                  {s.location ? (
                    <>
                      <span>•</span>
                      <span className="truncate max-w-[100px]">{s.location}</span>
                    </>
                  ) : null}
                </div>
              </div>
              <span className="shrink-0 rounded-full bg-[#BD6E49] px-3 py-1 text-[11px] font-semibold text-white shadow-2xs hover:bg-[#A95532]">
                Vào Shop
              </span>
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
