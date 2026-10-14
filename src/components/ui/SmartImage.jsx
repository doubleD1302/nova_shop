import { useState } from 'react'

/**
 * Ảnh có fallback: nếu URL thật lỗi thì hiển thị ảnh SVG placeholder.
 * => Dùng được cả khi có API thật lẫn khi chạy offline với mock data.
 */
export default function SmartImage({ src, fallback, alt = '', className = '', ...rest }) {
  const [current, setCurrent] = useState(src || fallback)
  return (
    <img
      src={current || fallback}
      alt={alt}
      loading="lazy"
      draggable={false}
      onError={() => {
        if (fallback && current !== fallback) setCurrent(fallback)
      }}
      className={className}
      {...rest}
    />
  )
}
