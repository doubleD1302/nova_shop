// Các cột tiền của đơn dùng DECIMAL(15,0), nên giá trị tối đa là 15 chữ số.
export const MAX_ORDER_AMOUNT = 999999999999999

export function isValidAmount(value) {
  return Number.isSafeInteger(value) && value >= 0 && value <= MAX_ORDER_AMOUNT
}

// Dùng cùng giới hạn khi đặt đơn và khi khởi tạo thanh toán.
export function isValidGatewayAmount(method, amount) {
  if (!isValidAmount(amount) || amount < 1000) return false
  if (method === 'momo') return amount <= 50000000
  if (method === 'vnpay') return amount <= 9999999999
  return false
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
