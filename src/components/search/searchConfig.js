/**
 * Cấu hình bộ lọc & sắp xếp cho trang tìm kiếm.
 * Tách riêng để dễ thay thế bằng dữ liệu API (facets) sau này.
 */

export const PAGE_SIZE = 24

export const SORT_OPTIONS = [
  { id: 'popular', label: 'Phổ biến' },
  { id: 'newest', label: 'Mới nhất' },
  { id: 'discount', label: 'Giảm giá nhiều' },
  { id: 'price-asc', label: 'Giá: Thấp đến Cao' },
  { id: 'price-desc', label: 'Giá: Cao đến Thấp' },
  { id: 'rating', label: 'Đánh giá cao' },
]

export const PRICE_RANGES = [
  { id: '0-200', label: 'Dưới 200.000₫', min: 0, max: 200000 },
  { id: '200-500', label: '200.000₫ - 500.000₫', min: 200000, max: 500000 },
  { id: '500-1000', label: '500.000₫ - 1.000.000₫', min: 500000, max: 1000000 },
  { id: '1000-5000', label: '1.000.000₫ - 5.000.000₫', min: 1000000, max: 5000000 },
  { id: '5000-', label: 'Trên 5.000.000₫', min: 5000000, max: null },
]

/** Đọc query string trên URL -> object điều kiện truy vấn */
export function parseSearchParams(params) {
  const num = (key) => (params.get(key) ? Number(params.get(key)) : null)
  return {
    q: params.get('q') || '',
    category: params.get('category') || '',
    shop: params.get('shop') || '',
    mall: params.get('mall') === '1',
    freeship: params.get('freeship') === '1',
    flash: params.get('flash') === '1',
    location: params.get('location') || '',
    rating: Number(params.get('rating') || 0),
    minPrice: num('minPrice'),
    maxPrice: num('maxPrice'),
    sort: params.get('sort') || 'popular',
    page: Number(params.get('page') || 1),
  }
}

/**
 * Tạo hàm cập nhật query string (giữ nguyên các bộ lọc khác)
 */
export function makeParamSetter(params, setParams) {
  return (key, value) => {
    const next = new URLSearchParams(params)
    if (value === '' || value == null || value === false) next.delete(key)
    else next.set(key, String(value))
    if (key !== 'page') next.delete('page')
    setParams(next)
  }
}

/**
 * Cập nhật NHIỀU param cùng lúc (fix lỗi mất giá trị khi set 2 param liên tiếp).
 * patch: { minPrice: 200000, maxPrice: 500000, page: null, ... }
 *   - giá trị '' | null | undefined | false  => xoá param
 *   - giá trị khác                            => set param
 */
export function makeBulkParamSetter(params, setParams) {
  return (patch = {}, { resetPage = true } = {}) => {
    const next = new URLSearchParams(params)
    Object.entries(patch).forEach(([key, value]) => {
      if (value === '' || value == null || value === false) next.delete(key)
      else next.set(key, String(value))
    })
    if (resetPage && !('page' in patch)) next.delete('page')
    setParams(next)
  }
}

