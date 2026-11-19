import { executeQuery } from '../config/database.js'

// Cách tính tiền của shop dùng chung cho số dư, lịch sử giao dịch, báo cáo và trang tổng quan:
//   doanh thu = tiền hàng sau giảm giá (subtotal - discount_amount), không gồm phí vận chuyển
//   thực nhận = doanh thu - hoa hồng sàn (tỷ lệ % trong system_settings)
//   hoàn tiền trả hàng cũng trừ phần hoa hồng của số tiền đó, vì sàn không giữ hoa hồng của hàng đã trả
// Đơn tính vào doanh thu là đơn con ở trạng thái delivered hoặc completed.
export const DEFAULT_COMMISSION_RATE = 5

function isTableMissingError(err) {
  return err?.original?.code === 'ER_NO_SUCH_TABLE' || err?.code === 'ER_NO_SUCH_TABLE' ||
    String(err?.message || '').includes("doesn't exist")
}

// Tỷ lệ hoa hồng (%), tối đa 2 chữ số thập phân. Thiếu cấu hình hoặc giá trị hỏng thì dùng mặc định.
export async function readCommissionRate(query = executeQuery) {
  let rows = []
  try {
    rows = await query("SELECT setting_value FROM system_settings WHERE setting_key = 'commission_rate'")
  } catch (err) {
    if (!isTableMissingError(err)) throw err
  }
  // Number('') và Number(null) đều bằng 0, nên giá trị trống phải bị loại trước khi đổi sang số
  const raw = rows.length ? rows[0].setting_value : DEFAULT_COMMISSION_RATE
  const rate = raw === null || (typeof raw === 'string' && raw.trim() === '') ? NaN : Number(raw)
  return Number.isFinite(rate) && rate >= 0 && rate <= 100 ? Math.round(rate * 100) / 100 : DEFAULT_COMMISSION_RATE
}

// Làm tròn nửa lên bằng số nguyên, khớp với ROUND(x * rate / 100) của MySQL trong các truy vấn tổng.
export function commissionOf(amount, rate) {
  const hundredths = BigInt(Math.round(rate * 100))
  return Number((BigInt(Math.round(amount)) * hundredths + 5000n) / 10000n)
}

export function salesOf(subtotal, discount) {
  return Math.max(0, Number(subtotal) - Number(discount))
}

export function incomeOf(subtotal, discount, rate) {
  const sales = salesOf(subtotal, discount)
  return sales - commissionOf(sales, rate)
}

export function refundNetOf(refundAmount, rate) {
  const refund = Number(refundAmount)
  return refund - commissionOf(refund, rate)
}

// Các đoạn SQL tương ứng để cộng tổng ngay trong truy vấn. `rate` luôn là số do readCommissionRate trả về.
export const salesSql = (alias = 'so') => `(${alias}.subtotal - ${alias}.discount_amount)`
export const incomeSql = (rate, alias = 'so') => `(${salesSql(alias)} - ROUND(${salesSql(alias)} * ${rate} / 100))`
export const refundNetSql = (rate, column = 'refund_amount') => `(${column} - ROUND(${column} * ${rate} / 100))`
