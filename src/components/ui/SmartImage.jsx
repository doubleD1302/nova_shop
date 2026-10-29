import { useEffect, useState } from 'react'

/** Shows a plain empty state when there is no real image or its URL is unavailable. */
export default function SmartImage({ src, fallback, alt = '', className = '', ...rest }) {
  const [failedUrls, setFailedUrls] = useState([])

  useEffect(() => setFailedUrls([]), [src, fallback])
  const sources = [...new Set([src, ...(Array.isArray(fallback) ? fallback : [fallback])].filter(
    (source) => typeof source === 'string' && source.length > 0,
  ))]
  const activeSrc = sources.find((source) => !failedUrls.includes(source)) || ''

  if (!activeSrc) {
    return (
      <div
        className={`${className} grid place-items-center bg-page px-1 text-center text-[10px] text-muted`}
        role="img"
        aria-label={alt || 'Chưa có ảnh'}
        {...rest}
      >
        Chưa có ảnh
      </div>
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
