/**
 * ĐÁNH GIÁ SẢN PHẨM (mock)
 * Sinh đánh giá xác định (deterministic) từ id sản phẩm để giữ UI ổn định.
 */
const NAMES = [
  { name: 'ngoclinh.2k', emoji: '👩', hue: 340 },
  { name: 'hoangnam_dev', emoji: '🧑', hue: 210 },
  { name: 'thaovy.shop', emoji: '👧', hue: 28 },
  { name: 'minhtuan92', emoji: '👨', hue: 150 },
  { name: 'phuongnhi', emoji: '👩', hue: 280 },
  { name: 'ducthang.vn', emoji: '🧔', hue: 20 },
]

const COMMENTS = [
  'Hàng đóng gói cẩn thận, giao nhanh hơn dự kiến. Chất lượng đúng như mô tả, sẽ ủng hộ shop tiếp!',
  'Sản phẩm dùng rất ổn trong tầm giá. Shop tư vấn nhiệt tình, có tặng kèm quà nhỏ.',
  'Mình mua lần 2 rồi, vẫn giữ chất lượng tốt. Giá sale rẻ hơn ngoài cửa hàng.',
  'Giao hơi chậm 1 ngày nhưng đóng gói chắc chắn, sản phẩm nguyên seal. Đánh giá 5 sao.',
  'Đúng chính hãng, tem niêm phong đầy đủ. Rất đáng tiền, mọi người nên mua nhé.',
  'Hình thức đẹp, dùng thử 3 ngày thấy ok. Sẽ đánh giá thêm sau khi dùng đủ 2 tuần.',
]

const VARIANTS = ['Size M, Màu Đen', 'Loại 50ml', 'Bản tiêu chuẩn', 'Màu Trắng', 'Size L', 'Bản 256GB']

function hashCode(str) {
  let h = 0
  for (let i = 0; i < str.length; i += 1) {
    h = (h * 31 + str.charCodeAt(i)) | 0
  }
  return Math.abs(h)
}

/** Trả về danh sách đánh giá ổn định cho 1 sản phẩm */
export function getProductReviews(productId, limit = 5) {
  const h = hashCode(productId)
  const count = 3 + (h % 3)
  const list = []
  for (let i = 0; i < Math.min(count, limit); i += 1) {
    const u = NAMES[(h + i * 3) % NAMES.length]
    const c = COMMENTS[(h + i * 5) % COMMENTS.length]
    list.push({
      id: `${productId}-rv${i}`,
      user: u.name,
      emoji: u.emoji,
      hue: u.hue,
      rating: i === 1 && h % 4 === 0 ? 4 : 5,
      variant: VARIANTS[(h + i) % VARIANTS.length],
      comment: c,
      likes: 3 + ((h + i * 17) % 240),
      images: i === 0 ? 3 : i === 2 ? 2 : 0,
      sellerReplied: i % 2 === 0,
      reply: 'Cảm ơn bạn đã tin tưởng shop! Hẹn gặp bạn ở đơn hàng tiếp theo 💛',
    })
  }
  return list
}

/** Phân bố số sao hiển thị ở khối "Đánh giá sản phẩm" */
export function getRatingBreakdown(productId, rating) {
  const base = Math.round(rating * 20)
  const five = Math.min(95, Math.max(60, base + 6))
  const four = Math.max(2, Math.round((100 - five) * 0.6))
  const three = Math.max(1, Math.round((100 - five) * 0.25))
  const two = Math.max(0, Math.round((100 - five) * 0.1))
  const one = Math.max(0, 100 - five - four - three - two)
  return [
    { star: 5, percent: five },
    { star: 4, percent: four },
    { star: 3, percent: three },
    { star: 2, percent: two },
    { star: 1, percent: one },
  ]
}
