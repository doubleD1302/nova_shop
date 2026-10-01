import { useMemo, useState } from 'react'
import { FilterCheckbox } from './FilterParts'
import { regions, normalizeText, vietnamProvinces } from '../../data/locations'
import { IconSearch } from '../ui/Icons'

/** Bộ lọc "Nơi Bán": tất cả 63 tỉnh/thành, có ô tìm kiếm + nhóm theo 3 miền */
export default function LocationFilter({ value, onChange, counts = {} }) {
  const [keyword, setKeyword] = useState('')
  const [openRegion, setOpenRegion] = useState('')

  const grouped = useMemo(() => {
    const k = normalizeText(keyword.trim())
    const list = vietnamProvinces.filter((p) => (k ? normalizeText(p.name).includes(k) : true))
    return regions.map((region) => ({ region, items: list.filter((p) => p.region === region) })).filter((g) => g.items.length)
  }, [keyword])

  const totalProducts = Object.values(counts).reduce((s, n) => s + n, 0)

  return (
    <>
      <label className="mb-2 flex h-8 items-center gap-1.5 rounded-sm border border-line px-2">
        <IconSearch className="h-3.5 w-3.5 text-muted" />
        <input
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          placeholder="Tìm tỉnh / thành phố"
          className="w-full text-[12px] outline-none"
        />
      </label>

      <FilterCheckbox
        label="Toàn quốc"
        checked={!value}
        count={totalProducts || undefined}
        onChange={() => onChange('')}
      />

      <div className="thin-scroll max-h-[240px] overflow-y-auto pr-1">
        {grouped.map((g) => {
          const expanded = keyword.trim() !== '' || openRegion === g.region
          return (
            <div key={g.region} className="border-t border-line first:border-t-0">
              <button
                type="button"
                onClick={() => setOpenRegion(openRegion === g.region ? '' : g.region)}
                className="flex w-full items-center justify-between py-1.5 text-left text-[12px] font-semibold text-ink"
              >
                <span>
                  {g.region} ({g.items.length})
                </span>
                <span className="text-muted">{expanded ? '−' : '+'}</span>
              </button>

              {expanded
                ? g.items.map((p) => (
                    <FilterCheckbox
                      key={p.name}
                      label={p.name}
                      count={counts[p.name] || undefined}
                      checked={value === p.name}
                      onChange={() => onChange(value === p.name ? '' : p.name)}
                    />
                  ))
                : null}
            </div>
          )
        })}
      </div>
    </>
  )
}
