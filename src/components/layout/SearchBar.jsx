import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCatalog } from '../../context/CatalogContext'
import { IconSearch } from '../ui/Icons'
import SearchSuggestions from './SearchSuggestions'

/** Ô tìm kiếm bo tròn pill - Phong cách Terracotta + Cream */
export default function SearchBar() {
  const navigate = useNavigate()
  const { loadProducts, loadShops } = useCatalog()
  const [keyword, setKeyword] = useState('')
  const [debouncedKeyword, setDebouncedKeyword] = useState('')
  const [productHits, setProductHits] = useState([])
  const [shopHits, setShopHits] = useState([])
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

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedKeyword(keyword.trim()), 350)
    return () => window.clearTimeout(timer)
  }, [keyword])

  useEffect(() => {
    const query = debouncedKeyword.trim()
    let current = true
    const controller = new AbortController()
    if (!open || query.length < 2) {
      setProductHits([])
      setShopHits([])
      return () => { current = false }
    }
    Promise.all([
      loadProducts({ q: query, limit: 5, offset: 0, sort: 'popular', signal: controller.signal }),
      loadShops({ q: query, limit: 2, offset: 0, signal: controller.signal }),
    ]).then(([products, shopResults]) => {
      if (!current) return
      setProductHits(products.products)
      setShopHits(shopResults.shops)
    }).catch((error) => { if (error.name !== 'AbortError') console.error('Could not load search suggestions:', error) })
    return () => { current = false; controller.abort() }
  }, [debouncedKeyword, open, loadProducts, loadShops])

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
        className="flex h-11 items-center rounded-full border border-[#E6D5C2] bg-[#FFFCF7] p-1 pl-4 shadow-2xs transition focus-within:border-[#BD6E49] focus-within:ring-2 focus-within:ring-[#BD6E49]/20"
      >
        <IconSearch className="h-4.5 w-4.5 text-[#8B7566] shrink-0" />
        <input
          value={keyword}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setKeyword(e.target.value)
            setOpen(true)
          }}
          placeholder="Tìm kiếm sản phẩm, thương hiệu, danh mục..."
          className="h-full min-w-0 flex-1 border-0 bg-transparent px-3 text-[14px] text-[#49352D] outline-none placeholder:text-[#8B7566]"
          aria-label="Tìm kiếm sản phẩm"
        />
        <button
          type="submit"
          className="flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-[#BD6E49] hover:bg-[#A95532] px-5 text-[14px] font-medium text-[#FFFCF7] shadow-xs transition active:scale-95 cursor-pointer"
        >
          <IconSearch className="h-4 w-4" />
          <span className="hidden sm:inline">Tìm kiếm</span>
        </button>
      </form>

      {open ? (
        <div className="absolute left-0 right-0 top-[48px] z-40 overflow-hidden rounded-2xl border border-[#E6D5C2] bg-[#FFFCF7] shadow-lg">
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
