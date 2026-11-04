// Các cột tiền của đơn dùng DECIMAL(15,0), nên giá trị tối đa là 15 chữ số.
export const MAX_ORDER_AMOUNT = 999999999999999

export function isValidAmount(value) {
  return Number.isSafeInteger(value) && value >= 0 && value <= MAX_ORDER_AMOUNT
}

export function allocateDiscount(discount, shopSubtotal, subtotal) {
  if (!subtotal) return 0
  return Number((BigInt(discount) * BigInt(shopSubtotal)) / BigInt(subtotal))
}
