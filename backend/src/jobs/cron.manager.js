import { readdir, stat, unlink } from 'node:fs/promises'
import path from 'node:path'
import { callDataApi } from '../clients/data.client.js'
import { notifyUser } from '../services/notification.service.js'
import { env } from '../config/env.js'

let activeTimers = []
const jobRunningFlags = {
  cancelExpiredOrders: false,
  autoCompleteOrders: false,
  expireVouchers: false,
  cleanOrphanUploads: false,
}

/**
 * 1. Tự động quét và hủy các đơn hàng Online chưa hoàn tất thanh toán sau 15–30 phút và hoàn lại tồn kho
 */
export async function runAutoCancelExpiredOrders(options = {}) {
  if (jobRunningFlags.cancelExpiredOrders) return { skipped: true, reason: 'ALREADY_RUNNING' }
  jobRunningFlags.cancelExpiredOrders = true

  try {
    const expireMinutes = options.expireMinutes || 15
    const result = await callDataApi('/internal/v1/jobs/cancel-expired-orders', {
      method: 'POST',
      body: { expireMinutes },
    })

    const cancelledOrders = result?.cancelledOrders || []

    // Tự động gửi thông báo tới người mua có đơn bị hủy
    for (const item of cancelledOrders) {
      if (item.buyerId) {
        notifyUser({
          userId: item.buyerId,
          title: 'Đơn hàng trực tuyến đã tự động hủy',
          content: `Đơn hàng #${item.orderCode || item.shopOrderId} (${item.shopName}) đã tự động hủy do quá hạn thanh toán ${expireMinutes} phút. Số lượng tồn kho đã được hoàn lại.`,
          type: 'order',
          link: `/orders/${item.orderId}`,
          metadata: { orderId: item.orderId, shopOrderId: item.shopOrderId, status: 'cancelled' },
        }).catch(() => {})
      }
    }

    if (cancelledOrders.length > 0) {
      console.log(`[Cron Job] Đã tự động hủy ${cancelledOrders.length} đơn hàng quá hạn thanh toán online.`)
    }

    return { success: true, count: cancelledOrders.length, cancelledOrders }
  } catch (err) {
    console.error('[Cron Job] Lỗi khi chạy tự động hủy đơn quá hạn:', err.message)
    return { success: false, error: err.message }
  } finally {
    jobRunningFlags.cancelExpiredOrders = false
  }
}

/**
 * 2. Tự động hoàn tất đơn hàng (Auto-complete orders) sau 7 ngày từ khi delivered nếu không khiếu nại
 */
export async function runAutoCompleteOrders(options = {}) {
  if (jobRunningFlags.autoCompleteOrders) return { skipped: true, reason: 'ALREADY_RUNNING' }
  jobRunningFlags.autoCompleteOrders = true

  try {
    const days = options.days || 7
    const result = await callDataApi('/internal/v1/jobs/auto-complete-orders', {
      method: 'POST',
      body: { days },
    })

    const completedOrders = result?.completedOrders || []

    // Gửi thông báo cho người mua và người bán
    for (const item of completedOrders) {
      if (item.buyerId) {
        notifyUser({
          userId: item.buyerId,
          title: 'Đơn hàng đã hoàn tất',
          content: `Đơn hàng #${item.shopOrderId} (${item.shopName}) đã được tự động hoàn tất thành công sau ${days} ngày nhận hàng. Cảm ơn bạn đã mua sắm tại ShopNova!`,
          type: 'order',
          link: `/orders/${item.orderId}`,
          metadata: { orderId: item.orderId, shopOrderId: item.shopOrderId, status: 'completed' },
        }).catch(() => {})
      }

      if (item.sellerId) {
        notifyUser({
          userId: item.sellerId,
          title: 'Đơn hàng đã hoàn tất thành công',
          content: `Đơn hàng #${item.shopOrderId} của gian hàng ${item.shopName} đã tự động hoàn tất. Doanh thu đơn hàng đã sẵn sàng quyết toán.`,
          type: 'order',
          link: `/seller/orders`,
          metadata: { orderId: item.orderId, shopOrderId: item.shopOrderId, status: 'completed' },
        }).catch(() => {})
      }
    }

    if (completedOrders.length > 0) {
      console.log(`[Cron Job] Đã tự động hoàn tất ${completedOrders.length} đơn hàng delivered sau ${days} ngày.`)
    }

    return { success: true, count: completedOrders.length, completedOrders }
  } catch (err) {
    console.error('[Cron Job] Lỗi khi chạy tự động hoàn tất đơn hàng:', err.message)
    return { success: false, error: err.message }
  } finally {
    jobRunningFlags.autoCompleteOrders = false
  }
}

/**
 * 3. Tự động cập nhật trạng thái Voucher hết hạn
 */
export async function runAutoExpireVouchers() {
  if (jobRunningFlags.expireVouchers) return { skipped: true, reason: 'ALREADY_RUNNING' }
  jobRunningFlags.expireVouchers = true

  try {
    const result = await callDataApi('/internal/v1/jobs/expire-vouchers', {
      method: 'POST',
    })

    const expiredCount = result?.expiredCount || 0
    if (expiredCount > 0) {
      console.log(`[Cron Job] Đã cập nhật ${expiredCount} voucher hết hạn sang trạng thái expired.`)
    }

    return { success: true, expiredCount }
  } catch (err) {
    console.error('[Cron Job] Lỗi khi chạy cập nhật voucher hết hạn:', err.message)
    return { success: false, error: err.message }
  } finally {
    jobRunningFlags.expireVouchers = false
  }
}

/**
 * 4. Dọn dẹp ảnh mồ côi (Orphan Upload Cleaner)
 * Quét và xóa các tệp ảnh được upload lên server tạm thời nhưng không gắn vào sản phẩm, avatar hay review nào sau 24h
 */
export async function runCleanOrphanUploads(options = {}) {
  if (jobRunningFlags.cleanOrphanUploads) return { skipped: true, reason: 'ALREADY_RUNNING' }
  jobRunningFlags.cleanOrphanUploads = true

  try {
    const maxAgeHours = options.maxAgeHours !== undefined ? options.maxAgeHours : 24
    const ageThresholdMs = maxAgeHours * 60 * 60 * 1000
    const now = Date.now()

    // 1. Lấy danh sách tất cả các ảnh đang được sử dụng trong CSDL từ Data API
    const refResult = await callDataApi('/internal/v1/jobs/referenced-images')
    const referencedSet = new Set(Array.isArray(refResult?.filenames) ? refResult.filenames : [])

    let scannedCount = 0
    let deletedCount = 0
    const deletedFiles = []

    // 2. Dọn dẹp trên file system cục bộ nếu đang dùng local storage
    if (env.uploadStorage === 'local') {
      try {
        const files = await readdir(env.uploadDir)
        for (const filename of files) {
          scannedCount += 1
          const filePath = path.join(env.uploadDir, filename)

          try {
            const fileStat = await stat(filePath)
            // Chỉ kiểm tra file thông thường
            if (!fileStat.isFile()) continue

            const fileAgeMs = now - fileStat.mtimeMs

            // Quy tắc an toàn: Ảnh mới upload dưới 24h thì KHÔNG xóa (người dùng có thể đang điền form)
            if (fileAgeMs < ageThresholdMs) {
              continue
            }

            // Nếu file đã tạo trên 24h và KHÔNG có trong danh sách CSDL đang sử dụng -> Xóa
            if (!referencedSet.has(filename)) {
              await unlink(filePath)
              deletedCount += 1
              deletedFiles.push(filename)
            }
          } catch {
            // Bỏ qua lỗi file riêng lẻ
          }
        }
      } catch (dirErr) {
        if (dirErr.code !== 'ENOENT') {
          console.error('[Cron Job] Không thể mở thư mục upload để quét:', dirErr.message)
        }
      }
    }

    if (deletedCount > 0) {
      console.log(`[Cron Job] Orphan Upload Cleaner: Đã quét ${scannedCount} ảnh, dọn dẹp ${deletedCount} ảnh mồ côi (> ${maxAgeHours}h).`)
    }

    return {
      success: true,
      scannedCount,
      deletedCount,
      deletedFiles,
    }
  } catch (err) {
    console.error('[Cron Job] Lỗi khi chạy Orphan Upload Cleaner:', err.message)
    return { success: false, error: err.message }
  } finally {
    jobRunningFlags.cleanOrphanUploads = false
  }
}

/**
 * Thực thi thủ công một job theo tên (phục vụ test hoặc admin)
 */
export async function executeJobByName(jobName, options = {}) {
  switch (jobName) {
    case 'cancel-expired-orders':
      return runAutoCancelExpiredOrders(options)
    case 'auto-complete-orders':
      return runAutoCompleteOrders(options)
    case 'expire-vouchers':
      return runAutoExpireVouchers()
    case 'clean-orphan-uploads':
      return runCleanOrphanUploads(options)
    default:
      throw new Error(`Job "${jobName}" không tồn tại.`)
  }
}

/**
 * Khởi động toàn bộ các định kỳ Cron Jobs trong tiến trình Backend
 */
export function startAllCronJobs() {
  stopAllCronJobs()

  console.log('[ShopNova Cron] Đang khởi động hệ thống tự động hóa tác vụ nền...')

  // 1. Quét hủy đơn online quá hạn: mỗi 2 phút (120 giây)
  const cancelOrdersTimer = setInterval(() => {
    runAutoCancelExpiredOrders({ expireMinutes: 15 }).catch(() => {})
  }, 2 * 60 * 1000)
  activeTimers.push(cancelOrdersTimer)

  // 2. Tự động hoàn tất đơn hàng delivered sau 7 ngày: mỗi 15 phút
  const completeOrdersTimer = setInterval(() => {
    runAutoCompleteOrders({ days: 7 }).catch(() => {})
  }, 15 * 60 * 1000)
  activeTimers.push(completeOrdersTimer)

  // 3. Tự động cập nhật voucher hết hạn: mỗi 5 phút
  const expireVouchersTimer = setInterval(() => {
    runAutoExpireVouchers().catch(() => {})
  }, 5 * 60 * 1000)
  activeTimers.push(expireVouchersTimer)

  // 4. Dọn dẹp ảnh mồ côi sau 24h: mỗi 60 phút
  const cleanOrphanTimer = setInterval(() => {
    runCleanOrphanUploads({ maxAgeHours: 24 }).catch(() => {})
  }, 60 * 60 * 1000)
  activeTimers.push(cleanOrphanTimer)

  // Đảm bảo các timer không cản trở Node.js tiến trình tắt an toàn
  activeTimers.forEach((timer) => timer.unref && timer.unref())

  console.log('[ShopNova Cron] 4 tác vụ nền (Hủy đơn quá hạn, Auto-complete, Expire voucher, Dọn ảnh mồ côi) đã kích hoạt thành công.')
}

/**
 * Dừng toàn bộ các timer cron jobs khi shutdown server
 */
export function stopAllCronJobs() {
  if (activeTimers.length > 0) {
    activeTimers.forEach((timer) => clearInterval(timer))
    activeTimers = []
    console.log('[ShopNova Cron] Đã dừng toàn bộ các tác vụ nền an toàn.')
  }
}
