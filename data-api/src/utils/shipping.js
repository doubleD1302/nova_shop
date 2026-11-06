// Cước ShopNova do server tính theo vùng, loại hàng, khối lượng ước tính và giờ đặt.
// Đây là bảng giá của sàn, không phải báo giá hay vận đơn của hãng vận chuyển.
const REGIONS = Object.freeze({
  north: `Hà Nội|Hải Phòng|Quảng Ninh|Hải Dương|Hưng Yên|Thái Bình|Nam Định|Ninh Bình|Hà Nam|Vĩnh Phúc|Bắc Ninh|Bắc Giang|Thái Nguyên|Phú Thọ|Tuyên Quang|Yên Bái|Lào Cai|Hà Giang|Cao Bằng|Bắc Kạn|Lạng Sơn|Điện Biên|Lai Châu|Sơn La|Hòa Bình`.split('|'),
  central: `Thanh Hóa|Nghệ An|Hà Tĩnh|Quảng Bình|Quảng Trị|Thừa Thiên Huế|Huế|Đà Nẵng|Quảng Nam|Quảng Ngãi|Bình Định|Phú Yên|Khánh Hòa|Ninh Thuận|Bình Thuận|Kon Tum|Gia Lai|Đắk Lắk|Đắk Nông|Lâm Đồng`.split('|'),
  south: `TP. Hồ Chí Minh|Hồ Chí Minh|Bà Rịa - Vũng Tàu|Bình Dương|Bình Phước|Đồng Nai|Tây Ninh|Long An|Tiền Giang|Bến Tre|Trà Vinh|Vĩnh Long|Đồng Tháp|An Giang|Kiên Giang|Cần Thơ|Hậu Giang|Sóc Trăng|Bạc Liêu|Cà Mau`.split('|'),
})
function normalizeProvince(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/gi, 'd')
    .toLowerCase().replace(/^(tinh|thanh pho|tp\.)\s*/, '').replace(/[^a-z0-9]/g, '')
}
const REGION_INDEX = new Map(Object.entries(REGIONS).flatMap(([region, provinces]) =>
  provinces.map((province) => [normalizeProvince(province), region])))
export function getShippingRegion(province) { return REGION_INDEX.get(normalizeProvince(province)) || null }
const METHODS = Object.freeze({
  tietkiem: { name: 'Tiết Kiệm', multiplier: 100 },
  nhanh: { name: 'Nhanh', multiplier: 140 },
  hoatoc: { name: 'Hỏa Tốc ShopNova', multiplier: 180 },
})
const CATEGORY_WEIGHT_GRAMS = Object.freeze({
  'dien-thoai': 500, 'may-tinh': 2500, 'phu-kien-cong-nghe': 400,
  'thiet-bi-gia-dung': 4000, 'nha-cua': 2500, 'nha-cua-doi-song': 2500,
  'thoi-trang-nam': 700, 'thoi-trang-nu': 700, 'giay-dep': 1100,
  'tui-xach': 800, 'me-be': 1500, 'sac-dep': 400, 'my-pham': 400,
})
function distanceBand(fromProvince, toProvince) {
  const from = normalizeProvince(fromProvince)
  const to = normalizeProvince(toProvince)
  if (from && to && from === to) return 20
  const origin = getShippingRegion(from)
  const destination = getShippingRegion(to)
  if (!origin || !destination) return 1500
  if (origin === destination) return 250
  return origin === 'central' || destination === 'central' ? 700 : 1500
}
export function estimateItemWeight(categorySlug, qty = 1) {
  return (CATEGORY_WEIGHT_GRAMS[categorySlug] || 1000) * qty
}
export function calculateShippingOptions({ subtotal, hasFreeShipping = false, fromProvince, toProvince,
  weightGrams = 1000, now = new Date(), weatherRisk = 'normal' }) {
  const distanceKm = distanceBand(fromProvince, toProvince)
  const safeWeight = Number.isSafeInteger(weightGrams) && weightGrams > 0 ? weightGrams : 1000
  const hour = Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', hourCycle: 'h23' }).format(now))
  const afterHours = hour >= 18 || hour < 6 ? 2000 : 0
  const weatherFee = weatherRisk === 'severe' ? 5000 : weatherRisk === 'rain' ? 2000 : 0
  const baseFee = 12000 + distanceKm * 15 + Math.ceil(safeWeight / 1000) * 2500 + weatherFee
  const free = hasFreeShipping || subtotal >= 1000000
  return Object.entries(METHODS).map(([id, method], index) => {
    const originalFee = Math.ceil((baseFee * method.multiplier / 100 + (index ? afterHours : 0)) / 1000) * 1000
    return { id, name: method.name, originalFee, discount: free ? originalFee : 0,
      fee: free ? 0 : originalFee, distanceKm, estimatedWeightGrams: safeWeight,
      weatherApplied: weatherRisk !== 'normal', isDefault: index === 0 }
  })
}
export function calculateShipping(method, group) {
  return calculateShippingOptions(group).find((option) => option.id === method) || null
}
