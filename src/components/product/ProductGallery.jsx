import { useEffect, useState } from 'react'
import SmartImage from '../ui/SmartImage'
import { IconChevronLeft, IconChevronRight } from '../ui/Icons'

/** Khung ảnh lớn + dải thumbnail + mũi tên chuyển ảnh */
export default function ProductGallery({ product, images = [] }) {
  const gallery = images.length ? images : product.gallery || [product.image]
  const [index, setIndex] = useState(0)

  useEffect(() => setIndex(0), [product.id])

  const go = (delta) => setIndex((i) => (i + delta + gallery.length) % gallery.length)

  return (
    <div className="w-full lg:w-[420px] lg:shrink-0">
      <div className="group relative overflow-hidden rounded-sm border border-line bg-white">
        <div className="relative w-full pt-[100%]">
          <SmartImage
            src={gallery[index]}
            fallback={product.image}
            alt={product.name}
            className="absolute inset-0 h-full w-full object-cover"
          />
        </div>

        {product.mall ? (
          <span className="absolute left-0 top-0 bg-mall px-2 py-1 text-[11px] font-bold uppercase text-white">
            Mall
          </span>
        ) : null}

        <button
          type="button"
          onClick={() => go(-1)}
          aria-label="Ảnh trước"
          className="absolute left-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full bg-white/70 text-ink opacity-0 transition group-hover:opacity-100 hover:bg-white"
        >
          <IconChevronLeft className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => go(1)}
          aria-label="Ảnh sau"
          className="absolute right-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full bg-white/70 text-ink opacity-0 transition group-hover:opacity-100 hover:bg-white"
        >
          <IconChevronRight className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-2 flex gap-2">
        {gallery.map((img, i) => (
          <button
            key={`${product.id}-thumb-${i}`}
            type="button"
            onMouseEnter={() => setIndex(i)}
            onClick={() => setIndex(i)}
            className={`relative w-16 shrink-0 pt-[64px] overflow-hidden rounded-sm border transition ${
              i === index ? 'border-brand' : 'border-line hover:border-brand-light'
            }`}
            aria-label={`Ảnh ${i + 1}`}
          >
            <SmartImage src={img} fallback={product.image} alt="" className="absolute inset-0 h-full w-full object-cover" />
          </button>
        ))}
      </div>
    </div>
  )
}
