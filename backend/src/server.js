import app from './app.js'
import { env } from './config/env.js'

/**
 * Khởi động máy chủ HTTP trên cổng đã cấu hình
 */
const server = app.listen(env.port, () => {
  console.log(`[ShopNova Backend] Server đang chạy tại http://localhost:${env.port}`)
  console.log(`[ShopNova Backend] Môi trường: ${env.nodeEnv}`)
  console.log(`[ShopNova Backend] Health check: http://localhost:${env.port}/api/v1/health`)
  console.log(`[ShopNova Backend] Readiness check: http://localhost:${env.port}/api/v1/ready`)
})

/**
 * Xử lý lỗi khi khởi động server
 * Nếu cổng bị chiếm (EADDRINUSE), thông báo lỗi rõ ràng và dừng lại, không tự ngắt tiến trình khác.
 */
server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`[Lỗi khởi động] Cổng ${env.port} hiện đang bị chiếm bởi một ứng dụng khác trên máy tính.`)
    console.error(
      'Hướng dẫn khắc phục: Vui lòng đổi giá trị PORT trong file backend/.env (ví dụ: PORT=3001) hoặc dừng ứng dụng đang chiếm cổng.',
    )
    process.exit(1)
  }

  console.error('[Lỗi khởi động server]:', err.message || err)
  process.exit(1)
})

/**
 * Lắng nghe tín hiệu dừng chương trình (Ctrl + C) để giải phóng tài nguyên gọn gàng
 */
function handleShutdown(signal) {
  console.log(`\n[ShopNova Backend] Đang đóng server an toàn (tín hiệu: ${signal})...`)
  server.close(() => {
    console.log('[ShopNova Backend] Server đã đóng hoàn toàn.')
    process.exit(0)
  })
}

process.on('SIGINT', () => handleShutdown('SIGINT'))
process.on('SIGTERM', () => handleShutdown('SIGTERM'))
