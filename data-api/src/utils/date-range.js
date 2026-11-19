// Đọc khoảng ngày startDate/endDate (ISO 8601) từ query. Trả null nếu giá trị không hợp lệ.
// endDate chỉ có ngày (2026-11-19) được hiểu là hết ngày đó theo UTC.
export function readDateRange(query) {
  function parse(value, isEnd) {
    if (value === undefined || value === '') return undefined
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}(T[\d:.]+(Z|[+-]\d{2}:\d{2})?)?$/.test(value)) return null
    const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value)
    const date = new Date(dateOnly && isEnd ? `${value}T23:59:59.999Z` : value)
    return Number.isNaN(date.getTime()) ? null : date
  }
  const from = parse(query.startDate, false)
  const to = parse(query.endDate, true)
  if (from === null || to === null) return null
  if (from && to && from > to) return null
  return { from: from || null, to: to || null }
}
