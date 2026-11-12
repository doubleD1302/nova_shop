import { useEffect, useState } from 'react'
import { productPlaceholder, resolveImageUrl } from '../../utils/image'

/** Shows a clean styled fallback placeholder when there is no real image or its URL is unavailable. */
export default function SmartImage({ src, fallback, alt = '', className = '', ...rest }) {
  const [failedUrls, setFailedUrls] = useState([])

  useEffect(() => setFailedUrls([]), [src, fallback])
  const rawSources = [src, ...(Array.isArray(fallback) ? fallback : [fallback])].filter(
    (source) => typeof source === 'string' && source.length > 0,
  )
  const sources = [...new Set(rawSources.flatMap((s) => {
    const resolved = resolveImageUrl(s)
    return resolved && resolved !== s ? [resolved, s] : [s]
  }))]
  const activeSrc = sources.find((source) => !failedUrls.includes(source)) || ''

  if (!activeSrc) {
    const placeholder = productPlaceholder({ name: alt || 'ShopNova' })
    return (
      <img
        src={placeholder}
        alt={alt || 'Sản phẩm ShopNova'}
        className={`${className} object-cover`}
        draggable={false}
        {...rest}
      />
    )
  }

  return (
    <img
      src={activeSrc}
      alt={alt}
      loading="lazy"
      draggable={false}
      onError={() => setFailedUrls((current) => current.includes(activeSrc) ? current : [...current, activeSrc])}
      className={className}
      {...rest}
    />
  )
}
