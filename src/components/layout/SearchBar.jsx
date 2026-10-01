import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCatalog } from '../../context/CatalogContext'
import { toSlug } from '../../utils/format'
import { IconSearch } from '../ui/Icons'
import SearchSuggestions from './SearchSuggestions'

/** Ô tìm kiếm trên header — có gợi ý sản phẩm, gian hàng và từ khoá phổ biến */
export default function SearchBar() {
  const navigate = useNavigate()
  const { queryProducts, shops } = useCatalog()
  const [keyword, setKeyword] = useState('')
  const [open, setOpen] = useState(false)
  const boxRef = useRef(null)

  useEffect(() => {
    const onClickOutside = (e) => {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false)
    }
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClickOutside)
      document.removeEventListener('keydown', onKey)
    }
  }, [])

  const productHits = useMemo(
    () => (keyword.trim() ? queryProducts({ q: keyword, limit: 5, sort: 'popular' }) : []),
    [keyword, queryProducts],
  )

  const shopHits = useMemo(() => {
    const k = toSlug(keyword).replace(/-/g, '')
    if (!k) return []
    return shops.filter((s) => toSlug(s.name).replace(/-/g, '').includes(k)).slice(0, 2)
  }, [keyword, shops])

  const go = (path) => {
    setOpen(false)
    navigate(path)
  }

  const submit = (value) => {
    const q = (value ?? keyword).trim()
    go(q ? `/tim-kiem?q=${encodeURIComponent(q)}` : '/tim-kiem')
  }

  return (
    <div ref={boxRef} className="relative w-full">
      <form
        onSubmit={(e) => {
          e.preventDefault()
          submit()
        }}
        className="flex h-10 items-center rounded-sm bg-white p-[3px] shadow-sm"
      >
        <button type="submit" className="grid h-full w-9 place-items-center text-ink-soft" aria-label="Tìm kiếm">
          <IconSearch className="h-5 w-5" />
        </button>
        <input
          value={keyword}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setKeyword(e.target.value)
            setOpen(true)
          }}
          placeholder="ShopNova siêu sale - Tìm kiếm thương hiệu, sản phẩm hot nhất"
          className="h-full min-w-0 flex-1 border-0 bg-transparent px-1 text-[14px] text-ink outline-none placeholder:text-[#9a9a9a]"
          aria-label="Tìm kiếm sản phẩm"
        />
        <button
          type="submit"
          className="flex h-full shrink-0 items-center gap-1.5 rounded-sm bg-gradient-to-b from-[#f86a4b] to-[#ee4d2d] px-5 text-[14px] font-medium text-white transition hover:brightness-105"
        >
          <IconSearch className="h-4 w-4" />
          <span className="hidden sm:inline">Tìm kiếm</span>
        </button>
      </form>

      {open ? (
        <div className="absolute left-0 right-0 top-[44px] z-40 overflow-hidden rounded-b-sm border border-t-0 border-line bg-white shadow-pop">
          <SearchSuggestions
            keyword={keyword}
            productHits={productHits}
            shopHits={shopHits}
            onPickKeyword={(k) => {
              setKeyword(k)
              submit(k)
            }}
            onPickProduct={(p) => go(`/san-pham/${p.slug}`)}
            onPickShop={(s) => go(`/shop/${s.id}`)}
            onViewAll={() => submit()}
          />
        </div>
      ) : null}
    </div>
  )
}
