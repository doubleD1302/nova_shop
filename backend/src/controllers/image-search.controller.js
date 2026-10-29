const COMMONS_API_URL = 'https://commons.wikimedia.org/w/api.php'
const SEARCH_TIMEOUT_MS = 8000
const MAX_RESPONSE_BYTES = 2 * 1024 * 1024

function plainText(value, maxLength = 400) {
  return String(value || '')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/&amp;/gi, '&')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength)
}

function isCommerciallyReusableLicense(value) {
  const license = String(value || '').trim()
  if (!license || /\b(?:nc|nd)\b|non.?commercial|no.?derivatives/i.test(license)) return false
  return /^(?:CC0|Public domain|PD\b|CC BY(?:-SA)?\b)/i.test(license)
}

function toCommonsImage(page) {
  const image = page.imageinfo?.[0]
  const metadata = image?.extmetadata || {}
  const licenseName = plainText(metadata.LicenseShortName?.value || metadata.UsageTerms?.value, 100)
  const author = plainText(metadata.Artist?.value || metadata.Credit?.value, 400)
  const imageUrl = image?.thumburl || image?.url
  const licenseUrl = plainText(metadata.LicenseUrl?.value, 1024)

  if (
    !page.title || !imageUrl || !isCommerciallyReusableLicense(licenseName) || !author ||
    !/^https:\/\/upload\.wikimedia\.org\//i.test(imageUrl) || !/^https:\/\/[^\s]+$/i.test(licenseUrl)
  ) return null

  let parsedLicenseUrl
  try {
    parsedLicenseUrl = new URL(licenseUrl)
  } catch {
    return null
  }
  if (parsedLicenseUrl.protocol !== 'https:') return null

  const titlePath = encodeURIComponent(page.title.replace(/ /g, '_'))
  return {
    title: plainText(page.title.replace(/^File:/, ''), 200),
    url: imageUrl,
    sourcePageUrl: `https://commons.wikimedia.org/wiki/${titlePath}`,
    author,
    licenseName,
    licenseUrl: parsedLicenseUrl.toString(),
  }
}

export async function searchProductImages(req, res, next) {
  const query = typeof req.query.q === 'string' ? req.query.q.trim().replace(/\s+/g, ' ') : ''
  if (query.length < 3 || query.length > 120) {
    return res.status(400).json({
      success: false,
      message: 'Nhập từ 3 đến 120 ký tự để tìm ảnh.',
      error: { code: 'INVALID_SEARCH_QUERY' },
    })
  }
  const userAgent = typeof process.env.WIKIMEDIA_API_USER_AGENT === 'string'
    ? process.env.WIKIMEDIA_API_USER_AGENT.trim()
    : ''
  if (
    userAgent.length < 12 || userAgent.length > 300 ||
    /[\r\n]/.test(userAgent) ||
    !/(?:https?:\/\/|mailto:|[\w.+-]+@[\w.-]+\.[A-Za-z]{2,})/i.test(userAgent)
  ) {
    return res.status(503).json({
      success: false,
      message: 'Chưa cấu hình User-Agent và thông tin liên hệ cho dịch vụ tìm ảnh.',
      error: { code: 'IMAGE_SOURCE_NOT_CONFIGURED' },
    })
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), SEARCH_TIMEOUT_MS)
  try {
    const params = new URLSearchParams({
      action: 'query',
      format: 'json',
      generator: 'search',
      gsrnamespace: '6',
      gsrsearch: query,
      gsrlimit: '36',
      prop: 'imageinfo',
      iiprop: 'url|extmetadata',
      iiurlwidth: '640',
    })
    const response = await fetch(`${COMMONS_API_URL}?${params}`, {
      headers: {
        Accept: 'application/json',
        'User-Agent': userAgent,
      },
      redirect: 'error',
      signal: controller.signal,
    })
    if (!response.ok) {
      return res.status(502).json({
        success: false,
        message: 'Wikimedia Commons hiện không trả kết quả tìm ảnh.',
        error: { code: 'IMAGE_SOURCE_UNAVAILABLE' },
      })
    }
    const raw = await response.text()
    if (Buffer.byteLength(raw, 'utf8') > MAX_RESPONSE_BYTES) {
      return res.status(502).json({ success: false, message: 'Phản hồi tìm ảnh quá lớn.', error: { code: 'IMAGE_SOURCE_BAD_RESPONSE' } })
    }
    const payload = JSON.parse(raw)
    const results = Object.values(payload.query?.pages || {}).map(toCommonsImage).filter(Boolean).slice(0, 24)
    res.set('Cache-Control', 'private, max-age=300')
    return res.status(200).json({ success: true, data: { images: results } })
  } catch (err) {
    if (err?.name === 'AbortError') {
      return res.status(504).json({ success: false, message: 'Tìm ảnh mất quá nhiều thời gian, hãy thử lại.', error: { code: 'IMAGE_SEARCH_TIMEOUT' } })
    }
    return next(err)
  } finally {
    clearTimeout(timeout)
  }
}
