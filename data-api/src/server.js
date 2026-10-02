import app from './app.js'
import { env } from './config/env.js'
import { closeDatabase } from './config/database.js'

/**
 * Khởi động máy chủ HTTP Data API trên cổng đã cấu hình
 */
const server = app.listen(env.port, env.host, () => {
  console.log(`[ShopNova Data API] Server đang chạy tại http://${env.host}:${env.port}`)
  console.log(`[ShopNova Data API] Môi trường: ${env.nodeEnv}`)
  console.log(`[ShopNova Data API] Health check: http://${env.host}:${env.port}/internal/v1/health`)
  console.log(`[ShopNova Data API] Readiness check: http://${env.host}:${env.port}/internal/v1/ready`)
})

/**
 * Xử lý lỗi khi khởi động server
 * Nếu cổng bị chiếm (EADDRINUSE), thông báo lỗi rõ ràng và dừng lại, không tự ngắt tiến trình khác.
 */
server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`[Lỗi khởi động] Cổng ${env.port} hiện đang bị chiếm bởi một ứng dụng khác trên máy tính.`)
    console.error(
      'Hướng dẫn khắc phục: Vui lòng đổi giá trị PORT trong file data-api/.env (ví dụ: PORT=3002) hoặc dừng ứng dụng đang chiếm cổng.',
    )
    process.exit(1)
  }

  console.error('[Lỗi khởi động server Data API]:', err.message || err)
  process.exit(1)
})

let isShuttingDown = false

/**
 * Dọn dẹp tài nguyên và dừng server an toàn (Graceful Shutdown)
 */
async function handleShutdown(signal) {
  if (isShuttingDown) return
  isShuttingDown = true

  console.log(`\n[ShopNova Data API] Đang dừng server an toàn (tín hiệu: ${signal})...`)

  // Thiết lập timeout tối đa 5000ms để buộc dừng nếu tài nguyên dọn dẹp quá lâu
  const forceExitTimer = setTimeout(() => {
    console.error('[ShopNova Data API] Hết thời gian chờ dọn tài nguyên, buộc thoát tiến trình.')
    process.exit(1)
  }, 5000)
  forceExitTimer.unref()

  server.close(async () => {
    console.log('[ShopNova Data API] HTTP server đã đóng.')
    try {
      await closeDatabase()
      console.log('[ShopNova Data API] Kết nối cơ sở dữ liệu đã đóng.')
    } catch {
      // Bỏ qua lỗi đóng DB khi dừng
    }
    console.log('[ShopNova Data API] Tiến trình đã dừng hoàn tất.')
    process.exit(0)
  })
}

process.on('SIGINT', () => handleShutdown('SIGINT'))
process.on('SIGTERM', () => handleShutdown('SIGTERM'))
