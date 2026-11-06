// Nội bộ chỉ nhận query dạng scalar; giá trị lặp hoặc query lồng nhau không hợp lệ.
export function validateQuery(req, res, next) {
  const entries = Object.entries(req.query)
  const userId = req.body?.userId
  if ((req.body !== undefined && (!req.body || typeof req.body !== 'object' || Array.isArray(req.body))) ||
      (userId !== undefined && !((typeof userId === 'string' || Number.isSafeInteger(userId)) &&
        /^[1-9]\d{0,19}$/.test(String(userId)))) ||
      entries.length > 30 || entries.some(([key, value]) =>
    !/^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(key) ||
    typeof value !== 'string' || value.length > 2048)) {
    return res.status(400).json({
      success: false,
      message: 'Tham số truy vấn không hợp lệ.',
      error: { code: 'VALIDATION_ERROR' },
    })
  }
  return next()
}
