// Shop tạo trước khi có hồ sơ tiếp tục dùng các phương thức cũ.
// Hồ sơ đã có nhưng dữ liệu lỗi phải bị từ chối, không tự mở mọi phương thức.
export async function shopSupportsShipping(query, shopId, shippingMethod, { lock = false } = {}) {
  const rows = await query(`SELECT shipping_methods FROM seller_registration_profiles WHERE shop_id = ?${lock ? ' FOR UPDATE' : ''}`, [shopId])
  if (!rows.length) return true
  let methods = rows[0].shipping_methods
  if (typeof methods === 'string') {
    try { methods = JSON.parse(methods) } catch { return false }
  }
  return Array.isArray(methods) && methods.every((method) => ['nhanh', 'tietkiem', 'hoatoc'].includes(method)) && methods.includes(shippingMethod)
}
