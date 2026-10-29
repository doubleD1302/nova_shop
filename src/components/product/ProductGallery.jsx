import { useEffect, useState } from 'react'
import SmartImage from '../ui/SmartImage'
import { IconChevronLeft, IconChevronRight } from '../ui/Icons'

const ANGLE_LABELS = ['Ảnh chính', 'Góc khác', 'Cận cảnh', 'Chi tiết']

/** Khung ảnh lớn + dải thumbnail + mũi tên chuyển ảnh */
export default function ProductGallery({ product, images = [] }) {
  const gallery = images.length ? images : product.gallery || [product.image]
  const [index, setIndex] = useState(0)
  const activeIndex = index % gallery.length
  const currentImage = gallery[activeIndex]
  const currentUrl = typeof currentImage === 'string' ? currentImage : currentImage?.url
  const nextImage = gallery.length > 1 ? gallery[(activeIndex + 1) % gallery.length] : null
  const nextUrl = typeof nextImage === 'string' ? nextImage : nextImage?.url

  useEffect(() => setIndex(0), [product.id, images])

  const go = (delta) => setIndex((i) => (i + delta + gallery.length) % gallery.length)

  return (
    <div className="w-full lg:w-[420px] lg:shrink-0">
      <div className="group relative overflow-hidden rounded-sm border border-line bg-white">
        <div className="relative w-full pt-[100%]">
          <SmartImage
            src={currentUrl}
            fallback={product.gallery?.length ? product.gallery : [nextUrl, product.imageFallback, product.image].filter(Boolean)}
            alt={product.name}
            loading="eager"
            className="absolute inset-0 h-full w-full object-cover"
          />
        </div>

        {product.mall ? (
          <span className="absolute left-0 top-0 bg-mall px-2 py-1 text-[11px] font-bold uppercase text-white">
            Mall
          </span>
        ) : null}

        {gallery.length > 1 ? (
          <>
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
          </>
        ) : null}
      </div>

      {gallery.length > 1 ? (
        <div className="mt-2 flex gap-2">
          {gallery.map((img, i) => (
            <button
              key={`${product.id}-thumb-${i}`}
              type="button"
              onMouseEnter={() => setIndex(i)}
              onClick={() => setIndex(i)}
              className={`relative w-16 shrink-0 pt-[64px] overflow-hidden rounded-sm border transition ${
              i === activeIndex ? 'border-brand' : 'border-line hover:border-brand-light'
              }`}
              aria-label={`Ảnh ${i + 1}`}
            >
            <SmartImage
              src={typeof img === 'string' ? img : img?.url}
              fallback={product.gallery?.length ? product.gallery : gallery.map((image) => typeof image === 'string' ? image : image?.url).filter(Boolean)}
              alt=""
              loading="eager"
              className="absolute inset-0 h-full w-full object-cover"
            />
            <span className="absolute bottom-0 inset-x-0 bg-black/60 text-white text-[9px] py-0.5 text-center truncate">
              {ANGLE_LABELS[i] || `Ảnh ${i + 1}`}
            </span>
            </button>
          ))}
        </div>
      ) : null}
      {currentImage && typeof currentImage === 'object' ? (
        <p className="mt-2 text-[11px] leading-5 text-muted">
          Ảnh: {currentImage.author || 'Người bán'}
          {currentImage.sourcePageUrl ? <> · <a href={currentImage.sourcePageUrl} target="_blank" rel="noreferrer" className="text-brand hover:underline">Nguồn</a></> : null}
          {currentImage.licenseUrl ? <> · <a href={currentImage.licenseUrl} target="_blank" rel="noreferrer" className="text-brand hover:underline">{currentImage.licenseName || 'Giấy phép'}</a></> : currentImage.licenseName ? <> · {currentImage.licenseName}</> : null}
        </p>
      ) : null}
    </div>
  )
}
