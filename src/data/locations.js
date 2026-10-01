/**
 * 63 TỈNH / THÀNH PHỐ VIỆT NAM — dùng cho bộ lọc "Nơi Bán".
 * Nhóm theo 3 miền để người mua chọn nhanh.
 */
export const vietnamProvinces = [
  // ---------------- Miền Bắc ----------------
  { name: 'Hà Nội', region: 'Miền Bắc' },
  { name: 'Hải Phòng', region: 'Miền Bắc' },
  { name: 'Quảng Ninh', region: 'Miền Bắc' },
  { name: 'Hải Dương', region: 'Miền Bắc' },
  { name: 'Hưng Yên', region: 'Miền Bắc' },
  { name: 'Thái Bình', region: 'Miền Bắc' },
  { name: 'Nam Định', region: 'Miền Bắc' },
  { name: 'Ninh Bình', region: 'Miền Bắc' },
  { name: 'Hà Nam', region: 'Miền Bắc' },
  { name: 'Vĩnh Phúc', region: 'Miền Bắc' },
  { name: 'Bắc Ninh', region: 'Miền Bắc' },
  { name: 'Bắc Giang', region: 'Miền Bắc' },
  { name: 'Thái Nguyên', region: 'Miền Bắc' },
  { name: 'Phú Thọ', region: 'Miền Bắc' },
  { name: 'Tuyên Quang', region: 'Miền Bắc' },
  { name: 'Yên Bái', region: 'Miền Bắc' },
  { name: 'Lào Cai', region: 'Miền Bắc' },
  { name: 'Hà Giang', region: 'Miền Bắc' },
  { name: 'Cao Bằng', region: 'Miền Bắc' },
  { name: 'Bắc Kạn', region: 'Miền Bắc' },
  { name: 'Lạng Sơn', region: 'Miền Bắc' },
  { name: 'Điện Biên', region: 'Miền Bắc' },
  { name: 'Lai Châu', region: 'Miền Bắc' },
  { name: 'Sơn La', region: 'Miền Bắc' },
  { name: 'Hòa Bình', region: 'Miền Bắc' },

  // ---------------- Miền Trung ----------------
  { name: 'Thanh Hóa', region: 'Miền Trung' },
  { name: 'Nghệ An', region: 'Miền Trung' },
  { name: 'Hà Tĩnh', region: 'Miền Trung' },
  { name: 'Quảng Bình', region: 'Miền Trung' },
  { name: 'Quảng Trị', region: 'Miền Trung' },
  { name: 'Thừa Thiên Huế', region: 'Miền Trung' },
  { name: 'Đà Nẵng', region: 'Miền Trung' },
  { name: 'Quảng Nam', region: 'Miền Trung' },
  { name: 'Quảng Ngãi', region: 'Miền Trung' },
  { name: 'Bình Định', region: 'Miền Trung' },
  { name: 'Phú Yên', region: 'Miền Trung' },
  { name: 'Khánh Hòa', region: 'Miền Trung' },
  { name: 'Ninh Thuận', region: 'Miền Trung' },
  { name: 'Bình Thuận', region: 'Miền Trung' },
  { name: 'Kon Tum', region: 'Miền Trung' },
  { name: 'Gia Lai', region: 'Miền Trung' },
  { name: 'Đắk Lắk', region: 'Miền Trung' },
  { name: 'Đắk Nông', region: 'Miền Trung' },
  { name: 'Lâm Đồng', region: 'Miền Trung' },

  // ---------------- Miền Nam ----------------
  { name: 'TP. Hồ Chí Minh', region: 'Miền Nam' },
  { name: 'Bà Rịa - Vũng Tàu', region: 'Miền Nam' },
  { name: 'Bình Dương', region: 'Miền Nam' },
  { name: 'Bình Phước', region: 'Miền Nam' },
  { name: 'Đồng Nai', region: 'Miền Nam' },
  { name: 'Tây Ninh', region: 'Miền Nam' },
  { name: 'Long An', region: 'Miền Nam' },
  { name: 'Tiền Giang', region: 'Miền Nam' },
  { name: 'Bến Tre', region: 'Miền Nam' },
  { name: 'Trà Vinh', region: 'Miền Nam' },
  { name: 'Vĩnh Long', region: 'Miền Nam' },
  { name: 'Đồng Tháp', region: 'Miền Nam' },
  { name: 'An Giang', region: 'Miền Nam' },
  { name: 'Kiên Giang', region: 'Miền Nam' },
  { name: 'Cần Thơ', region: 'Miền Nam' },
  { name: 'Hậu Giang', region: 'Miền Nam' },
  { name: 'Sóc Trăng', region: 'Miền Nam' },
  { name: 'Bạc Liêu', region: 'Miền Nam' },
  { name: 'Cà Mau', region: 'Miền Nam' },
]

export const provinceNames = vietnamProvinces.map((p) => p.name)

export const regions = ['Miền Bắc', 'Miền Trung', 'Miền Nam']

/** Bỏ dấu để tìm kiếm tỉnh thành không dấu */
export const normalizeText = (s) =>
  String(s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()

export const getRegionOf = (province) => vietnamProvinces.find((p) => p.name === province)?.region || 'Khác'
