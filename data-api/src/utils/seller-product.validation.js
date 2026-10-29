export const validUploadedImage = (value) =>
  typeof value === 'string' && value.length <= 1024 && /^\/uploads\/[A-Za-z0-9._-]+$/.test(value)

export function validCommonsImage(image) {
  if (!image || typeof image !== 'object') return false
  const { url: imageUrl, sourcePageUrl, author, licenseName, licenseUrl } = image
  if (
    typeof imageUrl !== 'string' || imageUrl.length > 1024 ||
    typeof sourcePageUrl !== 'string' || sourcePageUrl.length > 1024 ||
    typeof author !== 'string' || !author.trim() || author.trim().length > 400 ||
    typeof licenseName !== 'string' || !licenseName.trim() || licenseName.length > 100 ||
    typeof licenseUrl !== 'string' || licenseUrl.length > 1024
  ) return false
  try {
    const parsedImage = new URL(imageUrl)
    const source = new URL(sourcePageUrl)
    const license = new URL(licenseUrl)
    const licenseAllowed = /^(?:CC0|Public domain|PD\b|CC BY(?:-SA)?\b)/i.test(licenseName.trim()) &&
      !/\b(?:nc|nd)\b|non.?commercial|no.?derivatives/i.test(licenseName)
    return parsedImage.protocol === 'https:' && parsedImage.hostname === 'upload.wikimedia.org' && !parsedImage.username && !parsedImage.password &&
      source.protocol === 'https:' && source.hostname === 'commons.wikimedia.org' && decodeURIComponent(source.pathname).startsWith('/wiki/File:') &&
      license.protocol === 'https:' && licenseAllowed
  } catch {
    return false
  }
}

const validId = (value) => /^[1-9]\d{0,19}$/.test(String(value || ''))

export function validateSellerProductInput({ body = {}, userId, productId = null }) {
  const name = typeof body.name === 'string' ? body.name.trim() : ''
  const categorySlug = typeof body.categoryId === 'string' ? body.categoryId.trim() : ''
  const description = typeof body.description === 'string' ? body.description.trim() : ''
  const price = Number(body.price)
  const originalPrice = body.originalPrice === '' || body.originalPrice === null || body.originalPrice === undefined
    ? null
    : Number(body.originalPrice)
  const stock = Number(body.stock)
  const images = Array.isArray(body.images) ? body.images : []
  const status = body.status || 'draft'
  const uniqueImageRefs = images.map((image) => image?.sourcePageUrl || image?.url)

  const invalidImages = images.length !== 4 ||
    uniqueImageRefs.some((reference, index) => !reference || uniqueImageRefs.indexOf(reference) !== index) ||
    images.some((image) => {
      if (validUploadedImage(image?.url)) {
        return Boolean(
          image.sourcePageUrl || image.licenseUrl ||
          (image.author && image.author !== 'Ảnh do người bán tải lên') ||
          (image.licenseName && image.licenseName !== 'Ảnh do người bán cung cấp')
        )
      }
      return !validCommonsImage(image)
    })

  if (
    !validId(userId) || (productId && !validId(productId)) || !name || name.length > 200 ||
    !categorySlug || categorySlug.length > 160 || !description || description.length > 10000 ||
    !Number.isSafeInteger(price) || price < 1 || price > 999999999999999 ||
    (originalPrice !== null && (!Number.isSafeInteger(originalPrice) || originalPrice < price || originalPrice > 999999999999999)) ||
    !Number.isSafeInteger(stock) || stock < 0 || stock > 2147483647 ||
    !['draft', 'active', 'hidden'].includes(status) || invalidImages
  ) {
    return { ok: false }
  }

  return {
    ok: true,
    value: { name, categorySlug, description, price, originalPrice, stock, images, status },
  }
}

export function resolveSellerProductStatus(currentStatus, requestedStatus) {
  if (requestedStatus === 'active' && currentStatus !== 'active') {
    return currentStatus || 'draft'
  }
  return requestedStatus
}
