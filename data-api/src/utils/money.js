// Các cột tiền của đơn dùng DECIMAL(15,0), nên giá trị tối đa là 15 chữ số.
export const MAX_ORDER_AMOUNT = 999999999999999

export function isValidAmount(value) {
  return Number.isSafeInteger(value) && value >= 0 && value <= MAX_ORDER_AMOUNT
}

export function allocateDiscounts(discount, shopSubtotals) {
  const subtotal = shopSubtotals.reduce((sum, amount) => sum + amount, 0)
  if (!subtotal) return shopSubtotals.map(() => 0)

  let accumulatedSubtotal = 0
  let allocatedDiscount = 0
  return shopSubtotals.map((amount) => {
    accumulatedSubtotal += amount
    const accumulatedDiscount = Number((BigInt(discount) * BigInt(accumulatedSubtotal)) / BigInt(subtotal))
    const shopDiscount = accumulatedDiscount - allocatedDiscount
    allocatedDiscount = accumulatedDiscount
    return shopDiscount
  })
}
