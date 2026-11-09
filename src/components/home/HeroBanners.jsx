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
        {/* Banner 1 (Trên): Túi xách & Phụ kiện */}
        <Link
          to="/tim-kiem?category=tui-vi"
          className="group relative block flex-1 overflow-hidden rounded-2xl border border-[#E6D5C2] bg-[#F5E7D4] shadow-2xs transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md hover:border-[#BD6E49]"
        >
          <img
            src="/images/banners/banner-bags-luxury.jpg"
            alt="Bags Style in every detail - BST Túi Xách & Phụ Kiện"
            className="h-full w-full object-cover object-center transition-transform duration-700 group-hover:scale-[1.03]"
            loading="lazy"
          />
        </Link>

        {/* Banner 2 (Dưới): Sắc đẹp & Chăm sóc da */}
        <Link
          to="/tim-kiem?category=my-pham"
          className="group relative block flex-1 overflow-hidden rounded-2xl border border-[#E6D5C2] bg-[#F5E7D4] shadow-2xs transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md hover:border-[#BD6E49]"
        >
          <img
            src="/images/banners/banner-beauty-skin.jpg"
            alt="Flash Sale Chăm Sóc & Tái Tạo Làn Da"
            className="h-full w-full object-cover object-center transition-transform duration-700 group-hover:scale-[1.03]"
            loading="lazy"
          />
        </Link>
      </div>
    </section>
  )
}
