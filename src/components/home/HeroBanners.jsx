import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { IconChevronLeft, IconChevronRight } from '../ui/Icons'

const SLIDES = [
  {
    id: 'fashion-collection',
    image: '/images/banners/banner-fashion-collection.jpg',
    link: '/tim-kiem?category=thoi-trang-nam',
    title: 'New Collection 2026',
    subtitle: 'Phong cách thời trang thượng lưu Terracotta',
    alt: 'NovaShop New Collection - Thời trang phong cách sống',
  },
  {
    id: 'luxury-bags',
    image: '/images/banners/banner-bags-luxury.jpg',
    link: '/tim-kiem?category=tui-vi',
    title: 'Bags - Style In Every Detail',
    subtitle: 'Túi xách cao cấp chính hãng · Thiết kế tinh tế',
    alt: 'Bags Style in every detail - Bộ sưu tập túi xách sang trọng',
  },
  {
    id: 'beauty-skin',
    image: '/images/banners/banner-beauty-skin.jpg',
    link: '/tim-kiem?category=my-pham',
    title: 'Chăm Sóc & Tái Tạo Làn Da',
    subtitle: 'Flash Sale giảm đến 40% · Voucher 20$',
    alt: 'Be soft, smooth and hydrated skin - Flash sale mỹ phẩm',
  },
]

export default function HeroBanners() {
  const [currentSlide, setCurrentSlide] = useState(0)
  const [isPaused, setIsPaused] = useState(false)

  const nextSlide = useCallback(() => {
    setCurrentSlide((prev) => (prev + 1) % SLIDES.length)
  }, [])

  const prevSlide = useCallback(() => {
    setCurrentSlide((prev) => (prev - 1 + SLIDES.length) % SLIDES.length)
  }, [])

  useEffect(() => {
    if (isPaused) return
    const timer = setInterval(nextSlide, 5000)
    return () => clearInterval(timer)
  }, [isPaused, nextSlide])

  return (
    <section className="grid gap-3.5 lg:grid-cols-12 items-stretch">
      {/* Slider Banner lớn bên trái (7 cột trên Desktop) */}
      <div
        className="group relative isolate overflow-hidden rounded-2xl border border-[#E6D5C2] bg-[#F5E7D4] shadow-xs lg:col-span-7 h-[260px] sm:h-[320px] lg:h-[370px]"
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
      >
        {SLIDES.map((slide, idx) => (
          <Link
            key={slide.id}
            to={slide.link}
            className={`absolute inset-0 block h-full w-full transition-opacity duration-700 ease-in-out ${
              idx === currentSlide ? 'opacity-100 z-10 pointer-events-auto' : 'opacity-0 z-0 pointer-events-none'
            }`}
          >
            <img
              src={slide.image}
              alt={slide.alt}
              className="h-full w-full object-cover object-center transition-transform duration-700 group-hover:scale-[1.02]"
              loading={idx === 0 ? 'eager' : 'lazy'}
            />
          </Link>
        ))}

        {/* Nút mũi tên chuyển slide */}
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault()
            prevSlide()
          }}
          aria-label="Slide trước"
          className="absolute left-3.5 top-1/2 z-20 -translate-y-1/2 grid h-9 w-9 place-items-center rounded-full bg-[#FFFCF7]/90 text-[#49352D] shadow-md backdrop-blur-xs transition opacity-0 group-hover:opacity-100 hover:bg-[#FFFCF7] hover:scale-105 active:scale-95 cursor-pointer"
        >
          <IconChevronLeft className="h-5 w-5" />
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault()
            nextSlide()
          }}
          aria-label="Slide tiếp theo"
          className="absolute right-3.5 top-1/2 z-20 -translate-y-1/2 grid h-9 w-9 place-items-center rounded-full bg-[#FFFCF7]/90 text-[#49352D] shadow-md backdrop-blur-xs transition opacity-0 group-hover:opacity-100 hover:bg-[#FFFCF7] hover:scale-105 active:scale-95 cursor-pointer"
        >
          <IconChevronRight className="h-5 w-5" />
        </button>

        {/* Chấm tròn chỉ số slide dạng thanh thuốc pill */}
        <div className="absolute bottom-3.5 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1.5 rounded-full bg-[#FFFCF7]/85 px-3 py-1.5 backdrop-blur-xs border border-[#E6D5C2] shadow-2xs">
          {SLIDES.map((_, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => setCurrentSlide(idx)}
              aria-label={`Đi tới slide ${idx + 1}`}
              className={`h-1.5 rounded-full transition-all duration-300 cursor-pointer ${
                currentSlide === idx ? 'w-6 bg-[#BD6E49]' : 'w-2 bg-[#8B7566]/40 hover:bg-[#8B7566]'
              }`}
            />
          ))}
        </div>
      </div>

      {/* 2 Banner phụ bên phải (5 cột trên Desktop) */}
      <div className="flex flex-col gap-3.5 lg:col-span-5 h-[260px] sm:h-[320px] lg:h-[370px]">
        {/* Banner 1 (Trên): Túi xách & Phụ kiện thời thượng */}
        <Link
          to="/tim-kiem?category=tui-vi"
          className="group relative flex flex-1 overflow-hidden rounded-2xl border border-[#E6D5C2] bg-[#FFFCF7] shadow-2xs transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md hover:border-[#BD6E49]"
        >
          <div className="relative z-10 flex flex-1 flex-col justify-between p-4 sm:p-5">
            <div>
              <span className="inline-block px-2 py-0.5 rounded-md bg-[#F5E7D4] border border-[#E6D5C2] text-[10px] font-bold tracking-[0.14em] text-[#80513B] uppercase shadow-2xs">
                HOT TREND 2026
              </span>
              <h3 className="mt-1.5 text-[17px] sm:text-[19px] font-extrabold leading-tight text-[#49352D] group-hover:text-[#BD6E49] transition-colors">
                Túi Xách & Phụ Kiện
              </h3>
              <p className="mt-1 text-[12px] text-[#8B7566] line-clamp-1">
                BST Mới · Thiết Kế Tinh Xảo Sang Trọng
              </p>
            </div>
            <div className="pt-2">
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-[#F5E7D4] text-[11px] font-semibold text-[#80513B] border border-[#E6D5C2] shadow-2xs transition-all duration-200 group-hover:bg-[#BD6E49] group-hover:text-[#FFFCF7] group-hover:border-[#BD6E49]">
                <span>Khám phá ngay</span>
                <span className="text-[12px] transition-transform duration-200 group-hover:translate-x-0.5">→</span>
              </span>
            </div>
          </div>
          {/* Ảnh banner bên phải với hiệu ứng bo tròn */}
          <div className="relative w-[40%] sm:w-[42%] shrink-0 overflow-hidden bg-[#F5E7D4]/40">
            <img
              src="/images/banners/banner-bags-luxury.jpg"
              alt="Bags Style in every detail"
              className="h-full w-full object-cover object-center transition-transform duration-700 group-hover:scale-105"
              loading="lazy"
            />
          </div>
        </Link>

        {/* Banner 2 (Dưới): Sắc đẹp & Chăm sóc da */}
        <Link
          to="/tim-kiem?category=my-pham"
          className="group relative flex flex-1 overflow-hidden rounded-2xl border border-[#E6D5C2] bg-[#FFFCF7] shadow-2xs transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md hover:border-[#BD6E49]"
        >
          <div className="relative z-10 flex flex-1 flex-col justify-between p-4 sm:p-5">
            <div>
              <span className="inline-block px-2 py-0.5 rounded-md bg-[#F5E7D4] border border-[#E6D5C2] text-[10px] font-bold tracking-[0.14em] text-[#80513B] uppercase shadow-2xs">
                FLASH SALE 40%
              </span>
              <h3 className="mt-1.5 text-[17px] sm:text-[19px] font-extrabold leading-tight text-[#49352D] group-hover:text-[#BD6E49] transition-colors">
                Làn Da Ẩm Mịn & Rạng Ngời
              </h3>
              <p className="mt-1 text-[12px] text-[#8B7566] line-clamp-1">
                Body Lotion & Dầu Dưỡng Jojoba
              </p>
            </div>
            <div className="pt-2">
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-[#F5E7D4] text-[11px] font-semibold text-[#80513B] border border-[#E6D5C2] shadow-2xs transition-all duration-200 group-hover:bg-[#BD6E49] group-hover:text-[#FFFCF7] group-hover:border-[#BD6E49]">
                <span>Khám phá ngay</span>
                <span className="text-[12px] transition-transform duration-200 group-hover:translate-x-0.5">→</span>
              </span>
            </div>
          </div>
          {/* Ảnh banner bên phải */}
          <div className="relative w-[40%] sm:w-[42%] shrink-0 overflow-hidden bg-[#F5E7D4]/40">
            <img
              src="/images/banners/banner-beauty-skin.jpg"
              alt="Be soft, smooth and hydrated skin"
              className="h-full w-full object-cover object-center transition-transform duration-700 group-hover:scale-105"
              loading="lazy"
            />
          </div>
        </Link>
      </div>
    </section>
  )
}
