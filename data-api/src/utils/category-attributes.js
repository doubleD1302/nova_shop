// Bộ thuộc tính minh họa phiên bản 1. Không thay đổi ý nghĩa các mã đã phát hành.
const text = (key, label) => ({ key, label, type: 'text', maxLength: 120, required: false })
const number = (key, label, unit, max) => ({ key, label, type: 'number', min: 0, max, unit, required: false })
const brand = text('brand', 'Thương hiệu')
const material = text('material', 'Chất liệu')
const color = text('color', 'Màu sắc')
const definitions = {
  'thoi-trang-nam': [brand, material, color],
  'thoi-trang-nu': [brand, material, color],
  'dien-thoai': [brand, text('model', 'Mẫu máy'), number('storage_gb', 'Bộ nhớ', 'GB', 100000)],
  'may-tinh': [brand, text('model', 'Mẫu máy'), number('memory_gb', 'Bộ nhớ RAM', 'GB', 100000)],
  'me-be': [brand, material, text('age_group', 'Độ tuổi tham khảo')],
  'nha-cua': [brand, material, color],
  'nha-cua-doi-song': [brand, material, color],
  'sac-dep': [brand, text('skin_type', 'Loại da'), number('volume_ml', 'Dung tích', 'ml', 100000)],
  'my-pham': [brand, text('skin_type', 'Loại da'), number('volume_ml', 'Dung tích', 'ml', 100000)],
  'thiet-bi-gia-dung': [brand, text('model', 'Mẫu thiết bị'), number('power_w', 'Công suất', 'W', 100000)],
  'giay-dep': [brand, material, color],
  'tui-xach': [brand, material, color],
  'phu-kien-cong-nghe': [brand, text('model', 'Mẫu thiết bị'), color],
}
// Version 1 giữ nguyên để đọc và sửa dữ liệu đã lưu trước đây.
// Version 2 bổ sung thông tin hiển thị; không thay thế lựa chọn SKU.
const origin = text('country_of_origin', 'Xuất xứ')
const warranty = text('warranty', 'Bảo hành')
const extras = {
  'thoi-trang-nam': [text('style', 'Kiểu dáng'), origin],
  'thoi-trang-nu': [text('style', 'Kiểu dáng'), origin],
  'dien-thoai': [text('device_type', 'Loại thiết bị'), origin, warranty],
  'may-tinh': [text('device_type', 'Loại thiết bị'), origin, warranty],
  'thiet-bi-gia-dung': [text('appliance_type', 'Loại thiết bị'), origin, warranty],
  'sac-dep': [text('product_type', 'Loại sản phẩm'), origin],
  'my-pham': [text('product_type', 'Loại sản phẩm'), origin],
  'nha-cua': [text('product_type', 'Loại sản phẩm'), origin],
  'nha-cua-doi-song': [text('product_type', 'Loại sản phẩm'), origin],
  'me-be': [text('product_type', 'Loại sản phẩm'), origin],
  'giay-dep': [text('style', 'Kiểu dáng'), origin],
  'tui-xach': [text('style', 'Kiểu dáng'), origin],
  'phu-kien-cong-nghe': [text('product_type', 'Loại sản phẩm'), origin, warranty],
}
export function getCategoryDefinitions(slug, version = 2) {
  if (![1, 2].includes(version)) return null
  const original = Object.hasOwn(definitions, slug) ? definitions[slug] : []
  if (version === 1) return { version, attributes: original }
  return { version, attributes: original.length ? [...original, ...(extras[slug] || [origin])] : [brand, origin] }
}
export function validateCategoryAttributes(slug, input) {
  if (!input || typeof input !== 'object' || Array.isArray(input) || ![1, 2].includes(input.version) ||
      !input.values || typeof input.values !== 'object' || Array.isArray(input.values)) return null
  const definition = getCategoryDefinitions(slug, input.version)
  if (!definition) return null
  const values = {}
  for (const [key, value] of Object.entries(input.values)) {
    const field = definition.attributes.find((item) => item.key === key)
    if (!field) return null
    if (field.type === 'text') {
      if (typeof value !== 'string' || !value.trim() || value.trim().length > field.maxLength) return null
      values[key] = value.trim()
    } else {
      if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < field.min || value > field.max) return null
      values[key] = value
    }
  }
  return { version: input.version, values }
}
