// Bảng phí MVP áp dụng cho từng shop. Không dựa vào phí do client gửi.
const METHODS = Object.freeze({
  tietkiem: { name: 'Tiết Kiệm', fee: 16500 },
  nhanh: { name: 'Hoả Tốc ShopNova', fee: 32000 },
  hoatoc: { name: 'Nhanh', fee: 22000 },
})

export function calculateShippingOptions({ subtotal, hasFreeShipping = false }) {
  const free = hasFreeShipping || subtotal >= 1000000
  return Object.entries(METHODS).map(([id, method]) => ({
    id,
    name: method.name,
    originalFee: method.fee,
    discount: free ? method.fee : 0,
    fee: free ? 0 : method.fee,
  }))
}

export function calculateShipping(method, group) {
  return calculateShippingOptions(group).find((option) => option.id === method) || null
}
