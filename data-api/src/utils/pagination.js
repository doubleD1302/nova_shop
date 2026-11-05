// Đọc số nguyên phân trang và từ chối giá trị không an toàn trước khi truy vấn.
export function readPagination(query, { defaultLimit = 50, minLimit = 1, maxLimit = 100 } = {}) {
  function parse(value, fallback, min, max) {
    if (value === undefined) return fallback
    if ((typeof value !== 'string' && typeof value !== 'number') || !/^\d+$/.test(String(value))) return null
    const number = Number(value)
    return Number.isSafeInteger(number) && number >= min && number <= max ? number : null
  }
  const limit = parse(query.limit, defaultLimit, minLimit, maxLimit)
  const offset = parse(query.offset, 0, 0, Number.MAX_SAFE_INTEGER)
  return limit === null || offset === null ? null : { limit, offset }
}
