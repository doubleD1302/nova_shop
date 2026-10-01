import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useCatalog } from '../../context/CatalogContext'
import { heroBanners } from '../../data/homeContent'
import SmartImage from '../ui/SmartImage'
import { IconBolt, IconSparkle, IconTruck } from '../ui/Icons'

/** Banner chính (bên trái) — tự động chuyển slide + dải sản phẩm nhỏ phía dưới */
function BigBanner() {
  const { queryProducts } = useCatalog()
  const slides = useMemo(() => heroBanners.slice(0, 2), [])
  const [index, setIndex] = useState(0)
  const thumbs = useMemo(() => queryProducts({ limit: 3, sort: 'popular' }), [queryProducts])

  useEffect(() => {
    const timer = window.setInterval(() => setIndex((i) => (i + 1) % slides.length), 5000)
    return () => window.clearInterval(timer)
  }, [slides.length])

  const slide = slides[index]

  return (
    <div className="relative flex h-[210px] w-1/2 shrink-0 flex-col overflow-hidden rounded-md">
      <div className={`absolute inset-0 bg-gradient-to-br`} style={{ backgroundImage: `linear-gradient(135deg, ${slide.from}, ${slide.to})` }} />
      <span className="absolute -right-6 -top-10 text-[120px] opacity-20">{slide.emojis}</span>

      <div className="relative flex flex-1 flex-col justify-center px-5">
        <span className="mb-1 w-fit rounded-sm bg-black/25 px-2 py-0.5 text-[11px] font-medium text-white">
          Và đặc quyền Freeship bù Ủ Ủ toàn quốc hôm nay.
        </span>
        <h2 className="text-[28px] font-black uppercase leading-tight text-white drop-shadow-sm">{slide.title}</h2>
        <p className="mt-1 max-w-[320px] text-[12px] text-white/95">{slide.subtitle}</p>

        <div className="mt-3 flex flex-wrap gap-2">
          {slide.cta.map((label, i) => (
            <Link
              key={label}
              to={slide.to_link}
              className={`flex items-center gap-1.5 rounded-sm px-4 py-1.5 text-[13px] font-semibold transition ${
                i === 0
                  ? 'bg-white text-brand hover:bg-brand-soft'
                  : 'border border-white/80 bg-white/15 text-white hover:bg-white/25'
              }`}
            >
              {i === 0 ? <IconBolt className="h-3.5 w-3.5" /> : <IconSparkle className="h-3.5 w-3.5" />}
              {label}
            </Link>
          ))}
        </div>
      </div>

      <div className="relative flex items-center gap-2 bg-black/25 px-3 py-1.5">
        {thumbs.map((p) => (
          <Link key={p.id} to={`/san-pham/${p.slug}`} className="block h-8 w-8 overflow-hidden rounded-[3px] bg-white/80">
            <SmartImage src={p.image} fallback={p.image} alt="" className="h-full w-full object-cover" />
          </Link>
        ))}
        <span className="ml-1 text-[11px] font-medium text-white/90">ShopNova - Trang Chủ Sàn TMĐT</span>
      </div>

      <div className="absolute bottom-[46px] left-1/2 flex -translate-x-1/2 gap-1.5">
        {slides.map((s, i) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setIndex(i)}
            aria-label={`Banner ${i + 1}`}
            className={`h-1.5 rounded-full transition-all ${i === index ? 'w-4 bg-white' : 'w-2 bg-white/50'}`}
          />
        ))}
      </div>
    </div>
  )
}

/** Banner giữa */
function MiddleBanner() {
  const banner = heroBanners[1]
  return (
    <Link
      to={banner.to_link}
      className="relative flex h-[210px] flex-1 flex-col justify-center overflow-hidden rounded-md px-5"
      style={{ backgroundImage: `linear-gradient(150deg, ${banner.from}, ${banner.to})` }}
    >
      <span className="absolute -bottom-6 -right-2 text-[110px] opacity-25">{banner.emojis}</span>
      <span className="mb-1 w-fit rounded-sm bg-white/25 px-2 py-0.5 text-[11px] font-semibold text-white">
        Ưu đãi độc quyền
      </span>
      <h3 className="text-[22px] font-black uppercase leading-tight text-white">{banner.title}</h3>
      <p className="mt-1 max-w-[220px] text-[12px] text-white/95">{banner.subtitle}</p>
      <span className="mt-3 flex w-fit items-center gap-1.5 rounded-sm bg-white px-3 py-1.5 text-[12px] font-semibold text-brand">
        <IconTruck className="h-3.5 w-3.5" />
        {banner.cta[0]}
      </span>
    </Link>
  )
}

/** Cột banner bên phải: 1 banner tối + 1 banner Nova Mall */
function RightBanners() {
  const top = heroBanners[2]
  const mall = heroBanners[3]
  return (
    <div className="flex w-[190px] shrink-0 flex-col gap-2">
      <Link
        to={top.to_link}
        className="relative flex h-[101px] flex-col justify-center overflow-hidden rounded-md px-3"
        style={{ backgroundImage: `linear-gradient(140deg, ${top.from}, ${top.to})` }}
      >
        <span className="absolute -right-1 top-1 text-[44px] opacity-30">{top.emojis}</span>
        <span className="text-[13px] font-bold uppercase text-white">{top.title}</span>
        <span className="mt-0.5 text-[11px] text-white/85">{top.subtitle}</span>
      </Link>

      <Link
        to={mall.to_link}
        className="relative flex h-[101px] flex-col justify-center overflow-hidden rounded-md px-3"
        style={{ backgroundImage: `linear-gradient(140deg, ${mall.from}, ${mall.to})` }}
      >
        <span className="absolute -right-2 bottom-0 text-[46px] opacity-25">{mall.emojis}</span>
        <span className="text-[13px] font-black uppercase tracking-wide text-white">Nova Mall</span>
        <span className="mt-0.5 text-[11px] font-semibold text-white">Hàng hiệu 100%</span>
        <span className="text-[10px] text-white/85">Chính hãng trả góp 0%</span>
        <span className="text-[10px] text-white/85">Đổi trả miễn phí 15 ngày</span>
      </Link>
    </div>
  )
}

export default function HeroBanners() {
  return (
    <div className="flex gap-2">
      <BigBanner />
      <MiddleBanner />
      <RightBanners />
    </div>
  )
}
