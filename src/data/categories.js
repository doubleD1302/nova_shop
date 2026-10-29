import { toSlug } from '../utils/format'
import { categoryImage } from '../utils/image'

/**
 * DANH MỤC NGÀNH HÀNG
 * hue dùng để sinh ảnh danh mục offline.
 */
const RAW_CATEGORIES = [
  {
    id: 'thoi-trang-nam',
    name: 'Thời trang nam',
    emoji: '👔',
    hue: 214,
    image: 'https://images.unsplash.com/photo-1617137984095-74e4e5e3613f?auto=format&fit=crop&w=800&q=90',
  },
  {
    id: 'thoi-trang-nu',
    name: 'Thời trang nữ',
    emoji: '👗',
    hue: 330,
    image: 'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?auto=format&fit=crop&w=800&q=90',
  },
  {
    id: 'dien-thoai',
    name: 'Điện thoại & Phụ kiện',
    emoji: '📱',
    hue: 244,
    image: 'https://cdn2.cellphones.com.vn/x/media/catalog/product/d/i/dien-thoai-vivo-y03t_3__1_2_1_1.png',
    fallbackImage: 'https://asia-exstatic-vivofs.vivo.com/PSee2l50xoirPK7y/1721208973557/954e1ad288c89836aedcfba0341f3102.png',
  },
  {
    id: 'may-tinh',
    name: 'Máy tính & Laptop',
    emoji: '💻',
    hue: 210,
    image: 'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?auto=format&fit=crop&w=800&q=90',
  },
  {
    id: 'thiet-bi-gia-dung',
    name: 'Thiết bị gia dụng',
    emoji: '🧺',
    hue: 190,
    image: 'https://images.unsplash.com/photo-1585659722983-3a675dabf23d?auto=format&fit=crop&w=800&q=90',
  },
  {
    id: 'sac-dep',
    name: 'Sắc đẹp & Chăm sóc da',
    emoji: '💄',
    hue: 340,
    image: 'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?auto=format&fit=crop&w=800&q=90',
  },
  {
    id: 'nha-cua',
    name: 'Nhà cửa & Đời sống',
    emoji: '🏠',
    hue: 142,
    image: 'https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=800&q=90',
  },
  {
    id: 'me-be',
    name: 'Mẹ & Bé yêu',
    emoji: '🧸',
    hue: 38,
    image: 'https://images.unsplash.com/photo-1515488042361-ee00e0ddd4e4?auto=format&fit=crop&w=800&q=90',
  },
  {
    id: 'bach-hoa',
    name: 'Bách hóa Online',
    emoji: '🥬',
    hue: 84,
    image: 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=800&q=90',
  },
  {
    id: 'the-thao',
    name: 'Thể thao & Du lịch',
    emoji: '⚽',
    hue: 24,
    image: '/images/category-the-thao.jpg',
    fallbackImage: 'https://images.unsplash.com/photo-1461896836934-ffe607ba8211?auto=format&fit=crop&w=800&q=90',
  },
  {
    id: 'o-to-xe-may',
    name: 'Ô tô & Xe máy',
    emoji: '🏍️',
    hue: 206,
    image: 'https://images.unsplash.com/photo-1558981403-c5f9899a28bc?auto=format&fit=crop&w=800&q=90',
  },
  {
    id: 'may-anh',
    name: 'Máy ảnh & Máy quay',
    emoji: '📷',
    hue: 268,
    image: 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&w=800&q=90',
  },
]

export const categories = RAW_CATEGORIES.map((c) => ({
  ...c,
  slug: c.id,
  image: c.image || categoryImage({ emoji: c.emoji, hue: c.hue }),
  placeholderImage: categoryImage({ emoji: c.emoji, hue: c.hue }),
}))

export const getCategory = (id) => categories.find((c) => c.id === id) || null

export const getCategoryName = (id) => getCategory(id)?.name || 'Khác'

export const getCategorySlug = (name) => toSlug(name)
