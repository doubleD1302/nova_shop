import { discountPercent, toSlug } from '../utils/format'
import { productImage } from '../utils/image'
import { getShop } from './shops'
import { getCategoryName } from './categories'

/**
 * SẢN PHẨM (mock) — nhiều shop, nhiều ngành hàng.
 *
 * Schema tuple (ngắn gọn, dễ nhìn):
 * [id, name, shopId, categoryId, price, originalPrice, rating, sold, location, emoji, tags, extra]
 *   tags  : 'mall' | 'favorites' | 'freeship' | 'extra'
 *   extra : { soldPercent, flash, stock, description, specs, variantGroups }
 */
const RAW_PRODUCTS = [
  // ---------- FLASH SALE ----------
  ['p01', 'Tai nghe Bluetooth Nova Sound Pro Chống Ồn ANC', 'novaaudio', 'dien-thoai', 890000, 1850000, 4.9, 8200, 'TP. Hồ Chí Minh', '🎧', ['mall', 'favorites'], { soldPercent: 82, flash: true }],
  ['p02', 'Robot Hút Bụi Lau Nhà Tự Động Smart Cleaner Laser', 'gia-dung-24h', 'thiet-bi-gia-dung', 3250000, 5900000, 4.8, 6000, 'Đà Nẵng', '🤖', ['favorites'], { soldPercent: 61, flash: true }],
  ['p03', 'Bàn Phím Cơ Không Dây 3 Chế Độ Kết Nối Hotswap', 'techzone', 'may-tinh', 649000, 1600000, 4.7, 9500, 'TP. Hồ Chí Minh', '⌨️', ['mall'], { soldPercent: 95, flash: true }],
  ['p04', 'Tinh Chất Dưỡng Trắng & Phục Hồi Da Chuyên Sâu NIVITA', 'cocoon-official', 'sac-dep', 415000, 690000, 4.9, 7800, 'TP. Hồ Chí Minh', '🧴', ['mall'], { soldPercent: 78, flash: true }],
  ['p05', 'Giày Sneaker Thể Thao Nam Siêu Nhẹ Kháng Khuẩn', 'fashion-house-vn', 'thoi-trang-nam', 520000, 1000000, 4.8, 8800, 'TP. Hồ Chí Minh', '👟', ['favorites'], { soldPercent: 88, flash: true }],
  // ---------- GIAN HÀNG NỔI BẬT: Anker Official Store ----------
  ['p06', 'Củ Sạc GaN 65W 3 Cổng USB-C PD Sạc Nhanh Chóng', 'anker-official', 'dien-thoai', 590000, 890000, 4.9, 12400, 'TP. Hồ Chí Minh', '🔌', ['mall'], { soldPercent: 46 }],
  ['p07', 'Cáp C to C Siêu Bền 100W Tốc Độ Cao 1m2', 'anker-official', 'dien-thoai', 149000, 260000, 4.9, 32100, 'TP. Hồ Chí Minh', '🧵', ['mall', 'freeship'], { soldPercent: 70 }],
  ['p08', 'Pin Dự Phòng Sạc Nhanh 20000mAh Sạc 3 Thiết Bị', 'anker-official', 'dien-thoai', 780000, 1150000, 4.8, 18700, 'TP. Hồ Chí Minh', '🔋', ['mall'], { soldPercent: 55 }],
  // ---------- GIAN HÀNG NỔI BẬT: Cocoon Việt Nam ----------
  ['p09', 'Tẩy Da Chết Cà Phê Đắk Lắk Mịn Da Tự Nhiên', 'cocoon-official', 'sac-dep', 125000, 165000, 4.9, 45600, 'TP. Hồ Chí Minh', '☕', ['mall'], { soldPercent: 64 }],
  ['p10', 'Nước Bí Đao Cân Bằng Da Cấp Ẩm Dịu Nhẹ 500ml', 'cocoon-official', 'sac-dep', 165000, 210000, 4.9, 28900, 'TP. Hồ Chí Minh', '🥒', ['mall', 'freeship'], { soldPercent: 58 }],
  ['p11', 'Nước Dưỡng Tóc Tinh Dầu Bưởi Pomelo 140ml', 'cocoon-official', 'sac-dep', 135000, 175000, 4.8, 52300, 'TP. Hồ Chí Minh', '💧', ['mall'], { soldPercent: 72 }],
  // ---------- GỢI Ý HÔM NAY ----------
  ['p12', 'Áo Thun Nam Tay Lẻ Cotton 100% Định Lượng Cao', 'fashion-house-vn', 'thoi-trang-nam', 179000, 289000, 4.9, 18200, 'TP. Hồ Chí Minh', '👕', ['mall', 'freeship'], { soldPercent: 38 }],
  ['p13', 'Bình Giữ Nhiệt Inox 316 Cao Cấp 800ml', 'gia-dung-24h', 'thiet-bi-gia-dung', 219000, 319000, 4.8, 5400, 'Hà Nội', '🍶', ['favorites', 'extra'], { soldPercent: 41 }],
  ['p14', 'Chuột Không Dây Công Thái Học Chống Mỏi Cổ Tay', 'techzone', 'may-tinh', 345000, 600000, 4.9, 8900, 'Đà Nẵng', '🖱️', ['mall'], { soldPercent: 47 }],
  ['p15', 'Túi Xách Nữ Đeo Chéo Da PU Cao Cấp', 'fashion-house-vn', 'thoi-trang-nu', 189000, 299000, 4.9, 14100, 'TP. Hồ Chí Minh', '👜', ['favorites', 'extra'], { soldPercent: 52 }],
  ['p16', 'Máy Xông Tinh Dầu Phun Sương Tạo Ẩm Không Gian', 'green-living-vn', 'nha-cua', 115000, 230000, 4.7, 7100, 'Hà Nội', '🌫️', ['freeship'], { soldPercent: 44 }],
  ['p17', 'Vòng Đeo Tay Thông Minh Đo Nhịp Tim Đếm Calo', 'techzone', 'dien-thoai', 699000, 1029000, 4.9, 11600, 'TP. Hồ Chí Minh', '⌚', ['mall', 'extra'], { soldPercent: 63 }],
  ['p18', 'Chảo Chống Dính Vân Đá Y Tế Dày Từ Cao Cấp', 'bep-xinh', 'nha-cua', 269000, 369000, 4.8, 3800, 'Hà Nội', '🍳', ['favorites'], { soldPercent: 35 }],
  ['p19', 'Kem Dưỡng Ẩm Cấp Nước Chuyên Sâu Aqua Glow', 'cocoon-official', 'sac-dep', 275000, 345000, 4.9, 22300, 'TP. Hồ Chí Minh', '🧴', ['mall', 'freeship'], { soldPercent: 67 }],
  ['p20', 'Sạc Dự Phòng Không Dây Từ Tính 10000mAh MagSafe', 'anker-official', 'dien-thoai', 399000, 650000, 4.9, 9100, 'Hà Nội', '🧲', ['mall'], { soldPercent: 49 }],
  ['p21', 'Kính Mát Nam Nữ Phân Cực Chống Tia UV400', 'fashion-house-vn', 'thoi-trang-nam', 159000, 300000, 4.8, 6200, 'TP. Hồ Chí Minh', '🕶️', ['favorites', 'freeship'], { soldPercent: 42 }],
  ['p22', 'Ấm Đun Siêu Tốc Cổ Ngỗng Điện Tử Kiểm Soát Nhiệt', 'gia-dung-24h', 'thiet-bi-gia-dung', 640000, 780000, 4.9, 1400, 'Hà Nội', '🫖', ['mall'], { soldPercent: 28 }],
  ['p23', 'Dép Đi Trong Nhà Đế Bánh Mì Đúc Nguyên Khối', 'sg-home', 'nha-cua', 69000, 105000, 4.8, 34500, 'Bình Dương', '🥿', ['favorites', 'extra'], { soldPercent: 74 }],
  // ---------- ĐIỆN THOẠI / MÁY TÍNH ----------
  ['p24', 'Điện Thoại Thông Minh Nova X20 5G 256GB', 'techzone', 'dien-thoai', 5990000, 7990000, 4.8, 3200, 'TP. Hồ Chí Minh', '📱', ['mall', 'extra'], { soldPercent: 52 }],
  ['p25', 'Máy Tính Bảng Nova Pad 11 inch 128GB WiFi', 'techzone', 'may-tinh', 4490000, 5990000, 4.7, 1800, 'TP. Hồ Chí Minh', '📲', ['mall'], { soldPercent: 31 }],
  ['p26', 'Laptop Nova Book Air 14 inch Core i5 16GB/512GB', 'techzone', 'may-tinh', 15490000, 18990000, 4.9, 940, 'TP. Hồ Chí Minh', '💻', ['mall', 'freeship'], { soldPercent: 24 }],
  ['p27', 'Tai Nghe Chụp Tai Gaming Nova GX7 LED RGB', 'novaaudio', 'may-tinh', 459000, 890000, 4.7, 6700, 'Hà Nội', '🎮', ['favorites'], { soldPercent: 57 }],
  ['p28', 'Loa Bluetooth Mini Chống Nước IPX7 20W', 'novaaudio', 'dien-thoai', 389000, 690000, 4.8, 5200, 'Hà Nội', '🔊', ['mall', 'freeship'], { soldPercent: 45 }],
  ['p29', 'Sạc Dự Phòng 10000mAh Sạc Nhanh 22.5W', 'anker-official', 'dien-thoai', 349000, 550000, 4.9, 26400, 'TP. Hồ Chí Minh', '🔋', ['mall', 'freeship'], { soldPercent: 69 }],
  ['p30', 'Đế Sạc Không Dây 3 Trong 1 Cho Điện Thoại & Tai Nghe', 'anker-official', 'dien-thoai', 690000, 1200000, 4.8, 4100, 'TP. Hồ Chí Minh', '🔌', ['mall'], { soldPercent: 33 }],
  // ---------- THỜI TRANG ----------
  ['p31', 'Áo Sơ Mi Nam Dài Tay Công Sở Chống Nhăn', 'fashion-house-vn', 'thoi-trang-nam', 249000, 420000, 4.8, 9800, 'TP. Hồ Chí Minh', '👔', ['mall', 'extra'], { soldPercent: 43 }],
  ['p32', 'Quần Jean Nam Ống Suông Co Giãn Nhẹ', 'fashion-house-vn', 'thoi-trang-nam', 359000, 590000, 4.7, 7600, 'TP. Hồ Chí Minh', '👖', ['favorites'], { soldPercent: 39 }],
  ['p33', 'Váy Liền Nữ Dáng Xoè Công Sở Thanh Lịch', 'fashion-house-vn', 'thoi-trang-nu', 329000, 520000, 4.8, 6400, 'TP. Hồ Chí Minh', '👗', ['mall', 'freeship'], { soldPercent: 48 }],
  ['p34', 'Áo Khoác Nữ Chống Nắng UV Có Mũ Siêu Nhẹ', 'fashion-house-vn', 'thoi-trang-nu', 279000, 450000, 4.7, 12300, 'TP. Hồ Chí Minh', '🧥', ['freeship'], { soldPercent: 61 }],
  // ---------- SẮC ĐẸP ----------
  ['p35', 'Son Kem Lì Mịn Môi 12 Gam Màu Đỏ Đất', 'cocoon-official', 'sac-dep', 195000, 260000, 4.8, 33100, 'TP. Hồ Chí Minh', '💄', ['mall'], { soldPercent: 66 }],
  ['p36', 'Sữa Rửa Mặt Dịu Nhẹ Cho Da Dầu Mụn 300ml', 'cocoon-official', 'sac-dep', 165000, 210000, 4.9, 41200, 'TP. Hồ Chí Minh', '🧼', ['mall', 'freeship'], { soldPercent: 71 }],
  ['p37', 'Nước Tẩy Trang Sen Hậu Giang 500ml', 'cocoon-official', 'sac-dep', 189000, 250000, 4.9, 28700, 'TP. Hồ Chí Minh', '🌸', ['mall'], { soldPercent: 59 }],
  // ---------- GIA DỤNG ----------
  ['p38', 'Robot Hút Bụi Cầm Tay Không Dây 8000Pa', 'gia-dung-24h', 'thiet-bi-gia-dung', 1290000, 2190000, 4.7, 2600, 'Đà Nẵng', '🧹', ['mall', 'extra'], { soldPercent: 34 }],
  ['p39', 'Nồi Chiên Không Dầu 6L Điện Tử 8 Chế Độ', 'gia-dung-24h', 'thiet-bi-gia-dung', 1490000, 2490000, 4.8, 5400, 'Đà Nẵng', '🍟', ['mall', 'freeship'], { soldPercent: 54 }],
  ['p40', 'Máy Lọc Không Khí Phòng Ngủ 25m2 Lọc HEPA', 'gia-dung-24h', 'thiet-bi-gia-dung', 2390000, 3490000, 4.6, 900, 'Đà Nẵng', '💨', ['favorites'], { soldPercent: 21 }],
  ['p41', 'Bộ Nồi Inox 3 Đáy Cao Cấp 5 Món', 'bep-xinh', 'nha-cua', 890000, 1450000, 4.8, 2100, 'Hà Nội', '🍲', ['mall', 'extra'], { soldPercent: 29 }],
  ['p42', 'Bộ Dao Thớt Gỗ Kháng Khuẩn 7 Món', 'bep-xinh', 'nha-cua', 459000, 760000, 4.7, 3300, 'Hà Nội', '🔪', ['freeship'], { soldPercent: 37 }],
  // ---------- NHÀ CỬA & ĐỜI SỐNG ----------
  ['p43', 'Kệ Gỗ Trang Trí Đa Năng 4 Tầng', 'nha-xinh-decor', 'nha-cua', 549000, 890000, 4.6, 1200, 'Hà Nội', '🗄️', ['freeship'], { soldPercent: 26 }],
  ['p44', 'Đèn Ngủ LED Cảm Ứng Để Bàn Phong Cách Bắc Âu', 'nha-xinh-decor', 'nha-cua', 189000, 320000, 4.7, 4300, 'Hà Nội', '💡', ['extra'], { soldPercent: 41 }],
  ['p45', 'Gối Cao Su Non Memory Foam Chống Đau Cổ', 'nha-xinh-decor', 'nha-cua', 259000, 450000, 4.6, 2800, 'Hà Nội', '🛏️', ['freeship'], { soldPercent: 36 }],
  ['p59', 'Ghế Xoay Văn Phòng Công Thái Học Lưng Lưới', 'nha-xinh-decor', 'nha-cua', 1290000, 2190000, 4.7, 1500, 'Hà Nội', '🪑', ['mall', 'extra'], { soldPercent: 32 }],
  // ---------- MẸ & BÉ ----------
  ['p46', 'Xe Đẩy Em Bé Gấp Gọn 3 Tư Thế Nằm', 'me-be-yeu-thuong', 'me-be', 1890000, 2890000, 4.8, 1600, 'Cần Thơ', '🍼', ['mall', 'freeship'], { soldPercent: 27 }],
  ['p47', 'Bỉm Dán Em Bé Siêu Mềm Thấm Hút Tốt (Bịch 60 miếng)', 'me-be-yeu-thuong', 'me-be', 295000, 420000, 4.9, 27600, 'Cần Thơ', '🧷', ['mall'], { soldPercent: 73 }],
  ['p48', 'Ghế Ăn Dặm Cho Bé Đa Năng 6 Tư Thế', 'me-be-yeu-thuong', 'me-be', 1190000, 1690000, 4.7, 980, 'Cần Thơ', '🧒', ['extra'], { soldPercent: 23 }],
  // ---------- SỐNG XANH / BÁCH HÓA ----------
  ['p49', 'Nến Thơm Tinh Dầu Sả Chanh Thư Giãn 200g', 'green-living-vn', 'nha-cua', 165000, 260000, 4.8, 8900, 'TP. Hồ Chí Minh', '🕯️', ['mall', 'freeship'], { soldPercent: 56 }],
  ['p50', 'Máy Xông Tinh Dầu Gỗ Siêu Âm Kèm Đèn LED', 'green-living-vn', 'nha-cua', 245000, 420000, 4.7, 5600, 'TP. Hồ Chí Minh', '🪔', ['freeship'], { soldPercent: 47 }],
  ['p51', 'Cà Phê Rang Mộc Nguyên Chất 500g', 'green-living-vn', 'bach-hoa', 155000, 220000, 4.8, 11200, 'TP. Hồ Chí Minh', '☕', ['extra'], { soldPercent: 51 }],
  ['p52', 'Trà Thảo Mộc Hoa Cúc Mật Ong 20 Gói', 'green-living-vn', 'bach-hoa', 98000, 150000, 4.7, 8300, 'TP. Hồ Chí Minh', '🍵', ['freeship'], { soldPercent: 44 }],
  // ---------- SÀI GÒN HOME ----------
  ['p53', 'Thảm Trải Sàn Văn Phòng Chống Trơn 60x120cm', 'sg-home', 'nha-cua', 129000, 210000, 4.6, 6700, 'Bình Dương', '🧶', ['extra'], { soldPercent: 39 }],
  ['p54', 'Bộ Hộp Đựng Thực Phẩm Nắp Kín 10 Món', 'sg-home', 'nha-cua', 179000, 290000, 4.7, 9400, 'Bình Dương', '🥡', ['freeship'], { soldPercent: 48 }],
  ['p55', 'Xe Đạp Thể Thao Nam Nữ 27.5 inch 21 Tốc Độ', 'sg-home', 'the-thao', 2490000, 3490000, 4.6, 720, 'Bình Dương', '🚲', ['mall', 'extra'], { soldPercent: 18 }],
  ['p56', 'Bóng Đá Thi Đấu Size 5 Da PU Khâu Tay', 'sg-home', 'the-thao', 189000, 290000, 4.7, 4600, 'Bình Dương', '⚽', ['freeship'], { soldPercent: 42 }],
  // ---------- MÁY ẢNH ----------
  ['p57', 'Máy Ảnh Mirrorless Nova M50 Kèm Lens 15-45mm', 'novaaudio', 'may-anh', 12990000, 15990000, 4.9, 340, 'Hà Nội', '📷', ['mall', 'freeship'], { soldPercent: 16 }],
  ['p58', 'Camera An Ninh WiFi 360 Độ Full HD 2MP', 'techzone', 'may-anh', 459000, 790000, 4.7, 3900, 'TP. Hồ Chí Minh', '🎥', ['mall'], { soldPercent: 38 }],
  ['p60', 'Đồng Hồ Thông Minh Nữ Màn Hình AMOLED', 'techzone', 'dien-thoai', 1190000, 1990000, 4.8, 3200, 'TP. Hồ Chí Minh', '⌚', ['mall', 'extra'], { soldPercent: 45 }],
]

// ------------------------------------------------------------------
// Bộ sinh dữ liệu mặc định (mô phỏng dữ liệu API trả về)
// ------------------------------------------------------------------

const WARRANTY_BY_CATEGORY = {
  'dien-thoai': '12 tháng',
  'may-tinh': '24 tháng',
  'thiet-bi-gia-dung': '12 tháng',
  'may-anh': '24 tháng',
  'nha-cua': '6 tháng',
  'me-be': '6 tháng',
  'bach-hoa': 'Không bảo hành',
  'the-thao': '3 tháng',
  'thoi-trang-nam': 'Không bảo hành',
  'thoi-trang-nu': 'Không bảo hành',
  'sac-dep': 'Không bảo hành',
  'o-to-xe-may': '6 tháng',
}

const VARIANT_RULES = {
  'thoi-trang-nam': { name: 'Phân loại', options: ['Size M', 'Size L', 'Size XL', 'Size XXL'] },
  'thoi-trang-nu': { name: 'Phân loại', options: ['Size S', 'Size M', 'Size L', 'Size XL'] },
  'sac-dep': { name: 'Dung tích', options: ['30ml', '50ml', '100ml'] },
  'me-be': { name: 'Phân loại', options: ['Size S', 'Size M', 'Size L'] },
}

function defaultDescription({ name, shop, categoryId }) {
  const cat = getCategoryName(categoryId)
  return [
    `${name} được phân phối chính thức bởi ${shop?.name || 'ShopNova'} — gian hàng thuộc ngành hàng ${cat}.`,
    'Sản phẩm được kiểm định chất lượng trước khi giao, đóng gói cẩn thận bằng hộp chống sốc và niêm phong tem chống hàng giả.',
    'Hỗ trợ đổi trả trong 15 ngày nếu sản phẩm lỗi do nhà sản xuất. Xuất hoá đơn VAT theo yêu cầu của người mua.',
    'Lưu ý: Hình ảnh mang tính minh hoạ. Màu sắc thực tế có thể chênh lệch nhẹ do ánh sáng khi chụp.',
  ].join('\n\n')
}

function defaultSpecs({ id, shop, categoryId, location, stock, rating }) {
  const idx = Number(String(id).replace('p', ''))
  return [
    ['Thương hiệu', shop?.name?.split(' ')[0] || 'ShopNova'],
    ['Ngành hàng', getCategoryName(categoryId)],
    ['Xuất xứ', idx % 3 === 0 ? 'Việt Nam' : idx % 3 === 1 ? 'Trung Quốc' : 'Nhật Bản'],
    ['Bảo hành', WARRANTY_BY_CATEGORY[categoryId] || '6 tháng'],
    ['Kho hàng', `${stock}`],
    ['Gửi từ', location],
    ['Đánh giá', `${rating}/5`],
  ]
}

function buildProduct(raw, index) {
  const [id, name, shopId, categoryId, price, originalPrice, rating, sold, location, emoji, tags = [], extra = {}] = raw
  const shop = getShop(shopId)
  const stock = extra.stock ?? 40 + ((index * 37) % 460)
  const image = productImage({ emoji, name, categoryId, tone: index })
  const gallery = [0, 1, 2, 3].map((t) => productImage({ emoji, name, categoryId, tone: index + t }))
  const variantGroups = extra.variantGroups ?? (VARIANT_RULES[categoryId] ? [VARIANT_RULES[categoryId]] : [])

  return {
    id,
    name,
    slug: `${toSlug(name)}-${id}`,
    shopId,
    shopName: shop?.name || 'ShopNova',
    shopMall: Boolean(shop?.mall),
    categoryId,
    price,
    originalPrice,
    discount: discountPercent(price, originalPrice),
    rating,
    sold,
    location,
    emoji,
    image,
    gallery,
    tags,
    mall: tags.includes('mall'),
    favorites: tags.includes('favorites'),
    freeship: tags.includes('freeship'),
    extraShip: tags.includes('extra'),
    flash: Boolean(extra.flash),
    soldPercent: extra.soldPercent ?? 0,
    stock,
    variantGroups,
    description: extra.description ?? defaultDescription({ name, shop, categoryId }),
    specs: extra.specs ?? defaultSpecs({ id, shop, categoryId, location, stock, rating }),
    createdAt: new Date(Date.UTC(2025, 0, 1) + index * 86400000 * 3).toISOString(),
  }
}

export const seedProducts = RAW_PRODUCTS.map(buildProduct)

export const findProductBySlug = (slug) => seedProducts.find((p) => p.slug === slug) || null
export const findProductById = (id) => seedProducts.find((p) => p.id === id) || null

