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
export function getCategoryDefinitions(slug) {
  return { version: 1, attributes: Object.hasOwn(definitions, slug) ? definitions[slug] : [] }
}
export function validateCategoryAttributes(slug, input) {
  if (!input || typeof input !== 'object' || Array.isArray(input) || input.version !== 1 ||
      !input.values || typeof input.values !== 'object' || Array.isArray(input.values)) return null
  const fields = getCategoryDefinitions(slug).attributes
  const values = {}
  for (const [key, value] of Object.entries(input.values)) {
    const field = fields.find((item) => item.key === key)
    if (!field) return null
    if (field.type === 'text') {
      if (typeof value !== 'string' || !value.trim() || value.trim().length > field.maxLength) return null
      values[key] = value.trim()
    } else {
      if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < field.min || value > field.max) return null
      values[key] = value
    }
  }
  return { version: 1, values }
}
