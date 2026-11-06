// Query parameters of public APIs are scalars. Reject duplicate and nested values
// before controllers can silently coerce them to strings.
export function validateQuery(req, res, next) {
  const entries = Object.entries(req.query)
  if ((req.body !== undefined && (!req.body || typeof req.body !== 'object' || Array.isArray(req.body))) ||
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
