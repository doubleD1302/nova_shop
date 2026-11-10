import { shopSupportsShipping } from '../utils/shop-shipping.js'
import { executeTransaction } from '../config/database.js'
import { calculateShipping, estimateItemWeight } from '../utils/shipping.js'
import { evaluateVoucher } from '../utils/voucher.js'
import { isValidAmount } from '../utils/money.js'
import { getWeatherRisk } from '../services/weather.js'

const messages = {
  PRODUCT_UNAVAILABLE: [409, 'Một sản phẩm trong giỏ không còn được bán.'],
  INSUFFICIENT_STOCK: [409, 'Số lượng đặt vượt quá tồn kho hiện tại.'],
  SHOP_SHIPPING_UNAVAILABLE: [409, 'Phương thức vận chuyển không được một gian hàng hỗ trợ.'],
  VOUCHER_INVALID: [400, 'Mã giảm giá không hợp lệ hoặc đã hết hạn.'],
  VOUCHER_UNAVAILABLE: [409, 'Mã giảm giá không đủ điều kiện hoặc đã hết lượt sử dụng.'],
}

// Xem trước chỉ đọc dữ liệu; giá, tồn kho và lượt dùng sẽ được kiểm tra lại khi tạo đơn.
export async function calculateCheckoutPreview(query, { userId, items, shippingMethod, voucherCode, toProvince, weatherRisk = 'normal' }) {
  const groups = new Map()
  let subtotal = 0
  const placeholders = items.map(() => '?').join(', ')
  const rows = await query(
    `SELECT v.id AS variant_id, v.price, v.stock_qty, p.shop_id, p.free_shipping,
            s.name AS shop_name, s.province AS shop_province, c.slug AS category_slug
     FROM product_variants v
     JOIN products p ON p.id = v.product_id
     JOIN categories c ON c.id = p.category_id
     JOIN shops s ON s.id = p.shop_id
     JOIN users shop_owner ON shop_owner.id = s.owner_id AND shop_owner.status = 'active'
     WHERE v.id IN (${placeholders}) AND v.is_active = 1 AND p.status = 'active' AND s.status = 'active'`,
    items.map((item) => item.variantId),
  )
  const variants = new Map(rows.map((row) => [String(row.variant_id), row]))
  for (const item of items) {
    const variant = variants.get(String(item.variantId))
    if (!variant) return { error: 'PRODUCT_UNAVAILABLE' }
    if (Number(variant.stock_qty) < item.qty) return { error: 'INSUFFICIENT_STOCK' }
    const price = Number(variant.price)
    const lineTotal = price * item.qty
    if (!isValidAmount(price) || !isValidAmount(lineTotal) || !isValidAmount(subtotal + lineTotal)) return { error: 'ORDER_AMOUNT_INVALID' }
    subtotal += lineTotal
    const shopId = String(variant.shop_id)
    const group = groups.get(shopId) || { shopId, shopName: variant.shop_name, subtotal: 0,
      hasFreeShipping: false, fromProvince: variant.shop_province, toProvince, weightGrams: 0, weatherRisk }
    group.subtotal += lineTotal
    group.hasFreeShipping ||= Boolean(variant.free_shipping)
    group.weightGrams += estimateItemWeight(variant.category_slug, item.qty)
    groups.set(shopId, group)
  }

  let shippingFee = 0
  for (const group of groups.values()) {
    if (!(await shopSupportsShipping(query, group.shopId, shippingMethod))) return { error: 'SHOP_SHIPPING_UNAVAILABLE' }
    const option = calculateShipping(shippingMethod, group)
    if (!option) return { error: 'INVALID_SHIPPING_METHOD' }
    group.shippingFee = option.fee
    delete group.hasFreeShipping
    shippingFee += option.fee
  }

  const voucher = await evaluateVoucher(query, { voucherCode, userId, subtotal })
  if (voucher.error) return voucher
  const { discountAmount } = voucher
  const total = subtotal + shippingFee - discountAmount
  if (!isValidAmount(discountAmount) || !isValidAmount(shippingFee) || !isValidAmount(total)) return { error: 'ORDER_AMOUNT_INVALID' }
  return { subtotal, shippingFee, discountAmount, total, voucherCode: discountAmount ? voucherCode : null, shops: [...groups.values()] }
}

export async function previewCheckout(req, res, next) {
  const { userId, items, shippingMethod, voucherCode = '', address } = req.body || {}
  if (!/^[1-9]\d{0,19}$/.test(String(userId || '')) || !Array.isArray(items) || !items.length || items.length > 50 ||
      items.some((item) => !item || (typeof item.variantId !== 'string' &&
        !(typeof item.variantId === 'number' && Number.isSafeInteger(item.variantId))) ||
        !/^[1-9]\d{0,19}$/.test(String(item.variantId || '')) ||
        !Number.isInteger(item.qty) || item.qty < 1 || item.qty > 99) ||
      new Set(items.map((item) => String(item.variantId))).size !== items.length ||
      typeof shippingMethod !== 'string' || !calculateShipping(shippingMethod, { subtotal: 0, hasFreeShipping: false }) ||
      typeof voucherCode !== 'string' || voucherCode.trim().length > 32 ||
      (address !== undefined && (!address || typeof address !== 'object' || Array.isArray(address) ||
        typeof address.province !== 'string' || !address.province.trim() || address.province.length > 120))) {
    return res.status(400).json({ success: false, message: 'Thông tin xem trước đơn hàng không hợp lệ.', error: { code: 'VALIDATION_ERROR' } })
  }
  try {
    const weatherRisk = await getWeatherRisk(address?.province)
    const result = await executeTransaction((query) => calculateCheckoutPreview(query, {
      userId, items, shippingMethod, voucherCode: voucherCode.trim().toUpperCase(),
      toProvince: address?.province, weatherRisk,
    }))
    if (result.error) {
      const [status, message] = messages[result.error] || [400, 'Thông tin xem trước đơn hàng không hợp lệ.']
      return res.status(status).json({ success: false, message, error: { code: result.error } })
    }
    return res.status(200).json({ success: true, data: result })
  } catch (err) {
    return next(err)
  }
}
