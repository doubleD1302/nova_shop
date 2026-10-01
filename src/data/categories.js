import { toSlug } from '../utils/format'
import { categoryImage } from '../utils/image'

/**
 * DANH MỤC NGÀNH HÀNG
 * hue dùng để sinh ảnh danh mục offline.
 */
const RAW_CATEGORIES = [
  { id: 'thoi-trang-nam', name: 'Thời trang nam', emoji: '👔', hue: 214 },
  { id: 'thoi-trang-nu', name: 'Thời trang nữ', emoji: '👗', hue: 330 },
  { id: 'dien-thoai', name: 'Điện thoại & Phụ kiện', emoji: '📱', hue: 244 },
  { id: 'may-tinh', name: 'Máy tính & Laptop', emoji: '💻', hue: 210 },
  { id: 'thiet-bi-gia-dung', name: 'Thiết bị gia dụng', emoji: '🧺', hue: 190 },
  { id: 'sac-dep', name: 'Sắc đẹp & Chăm sóc da', emoji: '💄', hue: 340 },
  { id: 'nha-cua', name: 'Nhà cửa & Đời sống', emoji: '🏠', hue: 142 },
  { id: 'me-be', name: 'Mẹ & Bé yêu', emoji: '🧸', hue: 38 },
  { id: 'bach-hoa', name: 'Bách hóa Online', emoji: '🥬', hue: 84 },
  { id: 'the-thao', name: 'Thể thao & Du lịch', emoji: '⚽', hue: 24 },
  { id: 'o-to-xe-may', name: 'Ô tô & Xe máy', emoji: '🏍️', hue: 206 },
  { id: 'may-anh', name: 'Máy ảnh & Máy quay', emoji: '📷', hue: 268 },
]

export const categories = RAW_CATEGORIES.map((c) => ({
  ...c,
  slug: c.id,
  image: categoryImage({ emoji: c.emoji, hue: c.hue }),
}))

export const getCategory = (id) => categories.find((c) => c.id === id) || null

export const getCategoryName = (id) => getCategory(id)?.name || 'Khác'

export const getCategorySlug = (name) => toSlug(name)
