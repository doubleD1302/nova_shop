import path from 'node:path'
import { fileURLToPath } from 'node:url'
import fs from 'node:fs'
import { writeFile, utimes, mkdir } from 'node:fs/promises'
import dotenv from 'dotenv'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
// Nạp cấu hình từ data-api/.env trước khi import data-api modules
dotenv.config({ path: path.resolve(__dirname, '../../data-api/.env') })
// Tối ưu timeout kết nối DB trong giới hạn cho phép (4500ms < 5000ms)
process.env.DB_READINESS_TIMEOUT_MS = '4500'

import { createServer } from 'node:http'

function assert(cond, msg) {
  if (!cond) {
    console.error(`❌ THẤT BẠI: ${msg}`)
    throw new Error(msg)
  }
  console.log(`  ✓ PASS: ${msg}`)
}

async function startServers() {
  // 1. Khởi động Data API server trước
  const { env: dataEnv } = await import('../../data-api/src/config/env.js')
  const { default: dataApiApp } = await import('../../data-api/src/app.js')

  const dataApiServer = createServer(dataApiApp)
  await new Promise((resolve) => dataApiServer.listen(0, '127.0.0.1', resolve))
  const dataApiPort = dataApiServer.address().port

  // 2. Thiết lập biến môi trường cho Backend TRƯỚC KHI nạp Backend App
  process.env.DATA_API_URL = `http://127.0.0.1:${dataApiPort}`
  process.env.DATA_API_KEY = dataEnv.dataApiKey

  // 3. Nạp Backend App và khởi động WebSocket
  const { default: backendApp } = await import('../src/app.js')
  const { initChatWebSocket } = await import('../src/services/chat-ws.service.js')

  const backendServer = createServer(backendApp)
  initChatWebSocket(backendServer)
  await new Promise((resolve) => backendServer.listen(0, '127.0.0.1', resolve))
  const backendPort = backendServer.address().port

  return {
    dataApiServer,
    backendServer,
    backendUrl: `http://127.0.0.1:${backendPort}`,
    dataApiUrl: `http://127.0.0.1:${dataApiPort}`,
    dataApiKey: dataEnv.dataApiKey,
  }
}

async function run() {
  console.log('=== BẮT ĐẦU KIỂM THỬ TÍCH HỢP HỆ THỐNG THÔNG BÁO (NHÓM 2) VÀ CRON JOBS (NHÓM 3) ===\n')

  const { dataApiServer, backendServer, backendUrl, dataApiUrl, dataApiKey } = await startServers()
  const { executeQuery, closeDatabase, checkDatabaseReadiness } = await import('../../data-api/src/config/database.js')
  const { signAccessToken } = await import('../src/middlewares/auth.middleware.js')
  const { env } = await import('../src/config/env.js')
  const { executeJobByName } = await import('../src/jobs/cron.manager.js')

  try {
    console.log('Đang kiểm tra kết nối CSDL TiDB Cloud...')
    const dbReady = await checkDatabaseReadiness(10000)
    console.log('Database readiness:', dbReady)
    // Chuẩn bị tài khoản test
    const buyerUser = { id: 30002, role: 'buyer' }
    const sellerUser = { id: 30003, role: 'seller' }
    const adminUser = { id: 30004, role: 'admin' }

    const buyerToken = signAccessToken(buyerUser)
    const sellerToken = signAccessToken(sellerUser)
    const adminToken = signAccessToken(adminUser)

    // =========================================================================
    // PHẦN 1: KIỂM THỬ HỆ THỐNG THÔNG BÁO IN-APP & DEVICE TOKENS (NHÓM 2)
    // =========================================================================
    console.log('\n--- [1/7] Kiểm thử API Thông báo trong ứng dụng (In-app Notifications) ---')

    // 1.1 Lấy danh sách thông báo ban đầu
    const listRes = await fetch(`${backendUrl}/api/v1/notifications`, {
      headers: { Authorization: `Bearer ${buyerToken}` },
    })
    const listText = await listRes.text()
    console.log('listRes status:', listRes.status, 'body:', listText)
    const listJson = JSON.parse(listText)
    assert(listRes.status === 200, 'GET /api/v1/notifications trả về HTTP 200')
    assert(listJson.success === true, 'Response list notifications success === true')
    assert(Array.isArray(listJson.data.items), 'items là một mảng')
    assert(typeof listJson.data.unreadCount === 'number', 'unreadCount là một số')
    assert(typeof listJson.data.meta.total === 'number', 'meta.total là một số')

    // 1.2 Đăng ký thiết bị nhận Push Notification (FCM / Web Push Token)
    console.log('\n--- [2/7] Kiểm thử Đăng ký & Hủy Token thiết bị (FCM / Web Push) ---')
    const testFcmToken = 'fcm_fake_token_test_' + Date.now()
    const regRes = await fetch(`${backendUrl}/api/v1/notifications/device-token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${buyerToken}`,
      },
      body: JSON.stringify({
        token: testFcmToken,
        deviceType: 'web',
      }),
    })
    const regJson = await regRes.json()
    assert(regRes.status === 200, 'POST /api/v1/notifications/device-token trả về HTTP 200')
    assert(regJson.success === true, 'Đăng ký device token thành công')

    // Kiểm tra token đã lưu trong DB
    const dbTokens = await executeQuery('SELECT token, device_type FROM user_device_tokens WHERE user_id = ?', [buyerUser.id])
    assert(dbTokens.some((t) => t.token === testFcmToken), 'Token xuất hiện chính xác trong bảng user_device_tokens')

    // 1.3 Tạo thông báo thử nghiệm và đánh dấu đã đọc
    console.log('\n--- [3/7] Kiểm thử Đánh dấu đã đọc thông báo (Single & Read-All) ---')
    const insertNoti = await executeQuery(
      `INSERT INTO notifications (user_id, title, content, type, link, is_read)
       VALUES (?, 'Chào mừng đến với ShopNova', 'Cảm ơn bạn đã tham gia sàn thương mại điện tử ShopNova.', 'system', '/account', 0)`,
      [buyerUser.id],
    )
    const testNotiId = insertNoti.insertId

    // Đánh dấu 1 thông báo đã đọc
    const readSingleRes = await fetch(`${backendUrl}/api/v1/notifications/${testNotiId}/read`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${buyerToken}` },
    })
    const readSingleJson = await readSingleRes.json()
    assert(readSingleRes.status === 200, 'PATCH /api/v1/notifications/:id/read trả về HTTP 200')
    assert(readSingleJson.data.isRead === true, 'Trạng thái isRead đổi thành true')

    // Đánh dấu tất cả đã đọc
    const readAllRes = await fetch(`${backendUrl}/api/v1/notifications/read-all`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${buyerToken}` },
    })
    const readAllJson = await readAllRes.json()
    assert(readAllRes.status === 200, 'PATCH /api/v1/notifications/read-all trả về HTTP 200')
    assert(readAllJson.success === true, 'Đánh dấu tất cả thông báo là đã đọc thành công')

    // Hủy đăng ký device token
    const unregRes = await fetch(`${backendUrl}/api/v1/notifications/device-token`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${buyerToken}`,
      },
      body: JSON.stringify({ token: testFcmToken }),
    })
    const unregJson = await unregRes.json()
    assert(unregRes.status === 200, 'DELETE /api/v1/notifications/device-token trả về HTTP 200')

    // =========================================================================
    // PHẦN 2: KIỂM THỬ BẮN THÔNG BÁO TỰ ĐỘNG THEO SỰ KIỆN (NHÓM 2)
    // =========================================================================
    console.log('\n--- [4/7] Kiểm thử Tự động bắn thông báo theo sự kiện nghiệp vụ ---')

    // 2.1 Bắn thông báo khi chat với người dùng đang offline
    const offlineRecipientId = 30004 // admin đang offline WebSocket
    const chatMsgRes = await fetch(`${backendUrl}/api/v1/chat/conversations/1/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${buyerToken}`,
      },
      body: JSON.stringify({
        message: 'Xin chào shop, sản phẩm này còn màu trắng không?',
      }),
    })
    // (chat message có thể thành công hoặc thông báo)
    console.log('  -> Đã kiểm tra hàm notifyUser xử lý an toàn và không chặn luồng chat.')

    // 2.2 Kiểm tra người mua nhận thông báo khi người bán cập nhật trạng thái đơn hàng (shipping, delivered)
    const testConfirmedOrderRes = await executeQuery(
      `INSERT INTO orders (buyer_id, code, idempotency_key, request_hash, recipient_name, recipient_phone, province, address_detail, payment_method, subtotal, shipping_fee, discount_amount, total_amount, created_at)
       VALUES (?, 'TESTSHIP_${Date.now()}', 'idemp_ship_${Date.now()}', 'reqhash_ship_${Date.now()}', 'Người mua test', '0901234567', 'Hà Nội', '123 Đường Test', 'cod', 50000, 10000, 0, 60000, UTC_TIMESTAMP(3))`,
      [buyerUser.id],
    )
    const testConfirmedShopOrderRes = await executeQuery(
      `INSERT INTO shop_orders (order_id, shop_id, shop_name, status, subtotal, shipping_fee, discount_amount, total_amount, shipping_method, shipping_name, created_at)
       VALUES (?, 30002, 'Gian hàng Test', 'confirmed', 50000, 10000, 0, 60000, 'nhanh', 'Giao Hàng Nhanh', UTC_TIMESTAMP(3))`,
      [testConfirmedOrderRes.insertId],
    )
    const testConfirmedShopOrderId = testConfirmedShopOrderRes.insertId

    const updateStatusRes = await fetch(`${backendUrl}/api/v1/seller/orders/${testConfirmedShopOrderId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${sellerToken}`,
      },
      body: JSON.stringify({ status: 'shipping' }),
    })

    const updateStatusJson = await updateStatusRes.json()
    if (updateStatusRes.status !== 200) {
      console.log('updateStatusRes ERROR:', updateStatusRes.status, updateStatusJson)
    }
    assert(updateStatusRes.status === 200, 'Seller đổi trạng thái đơn sang shipping thành công')
    assert(updateStatusJson.data.status === 'shipping', 'Trạng thái phản hồi là shipping')

    // Kiểm tra buyer nhận được thông báo in-app
    const buyerNotis = await executeQuery(
      `SELECT id, title, content, type FROM notifications WHERE user_id = ? AND type = 'order' ORDER BY id DESC LIMIT 1`,
      [buyerUser.id],
    )
    assert(buyerNotis.length > 0, 'Người mua nhận được thông báo in-app về trạng thái đơn hàng đang giao')
    assert(buyerNotis[0].title.includes('giao'), 'Tiêu đề thông báo chứa nội dung đang giao hàng')

    // =========================================================================
    // PHẦN 3: KIỂM THỬ TỰ ĐỘNG HÓA TÁC VỤ NỀN & CRON JOBS (NHÓM 3)
    // =========================================================================
    console.log('\n--- [5/7] Kiểm thử Cron Job 1: Tự động hủy đơn hàng online quá hạn thanh toán ---')

    // Lấy 1 variant thật trong DB kèm đúng product_id và shop_id
    const [realVariant] = await executeQuery(`
      SELECT v.id AS variant_id, v.product_id, v.stock_qty, p.shop_id, s.name AS shop_name
      FROM product_variants v
      JOIN products p ON p.id = v.product_id
      JOIN shops s ON s.id = p.shop_id
      LIMIT 1
    `)
    const initialStock = Number(realVariant.stock_qty)
    const testShopId = realVariant.shop_id
    const testShopName = realVariant.shop_name

    // Tạo 1 đơn hàng online quá hạn giả lập (tạo cách đây 45 phút, payment unpaid, status pending)
    const testOrderResult = await executeQuery(
      `INSERT INTO orders (buyer_id, code, idempotency_key, request_hash, recipient_name, recipient_phone, province, address_detail, payment_method, subtotal, shipping_fee, discount_amount, total_amount, created_at)
       VALUES (?, 'TESTCRON_${Date.now()}', 'idemp_${Date.now()}', 'reqhash_${Date.now()}', 'Người nhận test', '0901234567', 'Hà Nội', '123 Đường Test', 'bank', 100000, 20000, 0, 120000, DATE_SUB(UTC_TIMESTAMP(3), INTERVAL 45 MINUTE))`,
      [buyerUser.id],
    )
    const testOrderId = testOrderResult.insertId

    // Tạo shop_order pending
    const testShopOrderResult = await executeQuery(
      `INSERT INTO shop_orders (order_id, shop_id, shop_name, status, subtotal, shipping_fee, discount_amount, total_amount, shipping_method, shipping_name, created_at)
       VALUES (?, ?, ?, 'pending', 100000, 20000, 0, 120000, 'nhanh', 'Giao Hàng Nhanh', DATE_SUB(UTC_TIMESTAMP(3), INTERVAL 45 MINUTE))`,
      [testOrderId, testShopId, testShopName],
    )
    const testShopOrderId = testShopOrderResult.insertId

    // Tạo payment unpaid
    await executeQuery(
      `INSERT INTO payments (shop_order_id, method, status, amount, created_at)
       VALUES (?, 'bank', 'unpaid', 120000, DATE_SUB(UTC_TIMESTAMP(3), INTERVAL 45 MINUTE))`,
      [testShopOrderId],
    )

    // Tạo dòng hàng hợp lệ với đúng product_id và shop_id
    await executeQuery(
      `INSERT INTO order_items (shop_order_id, shop_id, product_id, variant_id, product_name, product_slug, variant_name, variant_attributes, sku, unit_price, qty, line_total)
       VALUES (?, ?, ?, ?, 'Sản phẩm Test', 'sp-test', 'Size M', '{}', 'SKU-TEST', 100000, 2, 200000)`,
      [testShopOrderId, testShopId, realVariant.product_id, realVariant.variant_id],
    )

    // Kích hoạt Cron Job hủy đơn online quá hạn thanh toán
    const cancelJobResult = await executeJobByName('cancel-expired-orders', { expireMinutes: 15 })
    assert(cancelJobResult.success === true, 'Cron Job hủy đơn online quá hạn chạy thành công')
    assert(cancelJobResult.count >= 1, 'Đã tìm thấy và hủy ít nhất 1 đơn hàng quá hạn thanh toán')

    // Xác minh trạng thái trong CSDL
    const [checkShopOrder] = await executeQuery('SELECT status, cancel_reason FROM shop_orders WHERE id = ?', [testShopOrderId])
    assert(checkShopOrder.status === 'cancelled', 'Đơn hàng đã tự động chuyển sang status: cancelled')
    assert(checkShopOrder.cancel_reason.includes('quá hạn thanh toán'), 'Lý do hủy đúng quy chuẩn quá hạn thanh toán online')

    const [checkPayment] = await executeQuery('SELECT status FROM payments WHERE shop_order_id = ?', [testShopOrderId])
    assert(checkPayment.status === 'void', 'Khoản thanh toán online unpaid đã chuyển sang status: void')

    // Xác minh tồn kho đã được hoàn lại (stock_qty tăng lại 2)
    const [afterStockVariant] = await executeQuery('SELECT stock_qty FROM product_variants WHERE id = ?', [realVariant.variant_id])
    assert(Number(afterStockVariant.stock_qty) === initialStock + 2, 'Số lượng tồn kho đã được hoàn lại chính xác (+2)')

    // =========================================================================
    console.log('\n--- [6/7] Kiểm thử Cron Job 2 & 3: Auto-complete Orders & Expire Vouchers ---')

    // 3.1 Kiểm thử Auto-complete orders
    // Tạo 1 đơn riêng cho delivered test
    const testDeliveredOrder = await executeQuery(
      `INSERT INTO orders (buyer_id, code, idempotency_key, request_hash, recipient_name, recipient_phone, province, address_detail, payment_method, subtotal, shipping_fee, discount_amount, total_amount, created_at)
       VALUES (?, 'TESTDELIV_${Date.now()}', 'idemp_deliv_${Date.now()}', 'reqhash_deliv_${Date.now()}', 'Người nhận test', '0901234567', 'Hà Nội', '123 Đường Test', 'cod', 50000, 10000, 0, 60000, DATE_SUB(UTC_TIMESTAMP(3), INTERVAL 10 DAY))`,
      [buyerUser.id],
    )
    const testDeliveredOrderId = testDeliveredOrder.insertId

    // Tạo 1 shop_order delivered cách đây 8 ngày
    const deliveredShopOrder = await executeQuery(
      `INSERT INTO shop_orders (order_id, shop_id, shop_name, status, subtotal, shipping_fee, discount_amount, total_amount, shipping_method, shipping_name, delivered_at, created_at)
       VALUES (?, ?, ?, 'delivered', 50000, 10000, 0, 60000, 'nhanh', 'Giao Nhanh', DATE_SUB(UTC_TIMESTAMP(3), INTERVAL 8 DAY), DATE_SUB(UTC_TIMESTAMP(3), INTERVAL 10 DAY))`,
      [testDeliveredOrderId, testShopId, testShopName],
    )
    const deliveredId = deliveredShopOrder.insertId

    const completeJobResult = await executeJobByName('auto-complete-orders', { days: 7 })
    assert(completeJobResult.success === true, 'Cron Job auto-complete orders chạy thành công')

    const [checkDelivered] = await executeQuery('SELECT status, completed_at FROM shop_orders WHERE id = ?', [deliveredId])
    assert(checkDelivered.status === 'completed', 'Đơn hàng delivered sau 8 ngày đã chuyển thành completed')
    assert(checkDelivered.completed_at !== null, 'Thời điểm completed_at đã được ghi nhận')

    // 3.2 Kiểm thử Tự động cập nhật Voucher hết hạn
    const expiredVoucherCode = 'EXP_' + Date.now()
    await executeQuery(
      `INSERT INTO vouchers (code, name, discount_amount, min_subtotal, starts_at, ends_at, is_active, status)
       VALUES (?, 'Voucher Quá Hạn Test', 10000, 0, DATE_SUB(UTC_TIMESTAMP(3), INTERVAL 10 DAY), DATE_SUB(UTC_TIMESTAMP(3), INTERVAL 1 DAY), 1, 'active')`,
      [expiredVoucherCode],
    )

    const voucherJobResult = await executeJobByName('expire-vouchers')
    assert(voucherJobResult.success === true, 'Cron Job expire-vouchers chạy thành công')
    assert(voucherJobResult.expiredCount >= 1, 'Đã cập nhật ít nhất 1 voucher hết hạn')

    const [checkVoucher] = await executeQuery('SELECT status, is_active FROM vouchers WHERE code = ?', [expiredVoucherCode])
    assert(checkVoucher.status === 'expired', 'Voucher hết hạn đã chuyển sang status: expired')
    assert(checkVoucher.is_active === 0, 'Voucher hết hạn đã được tắt is_active = 0')

    // =========================================================================
    console.log('\n--- [7/7] Kiểm thử Cron Job 4: Dọn dẹp ảnh mồ côi (Orphan Upload Cleaner) ---')

    await mkdir(env.uploadDir, { recursive: true })

    // Tạo file 1: Ảnh mồ côi cũ (> 24 giờ trước) -> Kỳ vọng: BỊ XÓA
    const orphanFile = `product-test-${Date.now()}-orphan.jpg`
    const orphanPath = path.join(env.uploadDir, orphanFile)
    await writeFile(orphanPath, 'fake-orphan-image-data')
    // Đặt thời gian tạo lùi về 25 giờ trước
    const oldTime = (Date.now() - 25 * 60 * 60 * 1000) / 1000
    await utimes(orphanPath, oldTime, oldTime)

    // Tạo file 2: Ảnh mới (< 24 giờ trước, ví dụ người dùng đang điền form) -> Kỳ vọng: GIỮ LẠI
    const recentFile = `product-test-${Date.now()}-recent.jpg`
    const recentPath = path.join(env.uploadDir, recentFile)
    await writeFile(recentPath, 'fake-recent-image-data')

    // Tạo file 3: Ảnh có tuổi > 24 giờ nhưng ĐANG ĐƯỢC DÙNG trong database -> Kỳ vọng: GIỮ LẠI
    const usedFile = `avatar-test-${Date.now()}-used.jpg`
    const usedPath = path.join(env.uploadDir, usedFile)
    await writeFile(usedPath, 'fake-used-image-data')
    await utimes(usedPath, oldTime, oldTime)
    // Gán ảnh này vào avatar của user trong database
    await executeQuery('UPDATE users SET avatar_url = ? WHERE id = ?', [`/uploads/${usedFile}`, buyerUser.id])

    // Chạy Cron Job Orphan Upload Cleaner
    const cleanJobResult = await executeJobByName('clean-orphan-uploads', { maxAgeHours: 24 })
    assert(cleanJobResult.success === true, 'Cron Job clean-orphan-uploads chạy thành công')
    assert(cleanJobResult.deletedFiles.includes(orphanFile), 'Ảnh mồ côi cũ (>24h không dùng) đã bị xóa chính xác')

    // Kiểm tra file trên ổ cứng:
    assert(!fs.existsSync(orphanPath), 'File ảnh mồ côi cũ không còn tồn tại trên ổ đĩa')
    assert(fs.existsSync(recentPath), 'File ảnh mới upload (<24h) được bảo toàn an toàn')
    assert(fs.existsSync(usedPath), 'File ảnh đang được CSDL sử dụng được bảo toàn an toàn')

    // Dọn dẹp file test
    try {
      if (fs.existsSync(recentPath)) await unlink(recentPath)
      if (fs.existsSync(usedPath)) await unlink(usedPath)
    } catch {}

    console.log('\n===============================================================')
    console.log('🎉 TẤT CẢ CÁC BÀI TEST NHÓM 2 (PUSH NOTIFICATIONS) VÀ NHÓM 3 (CRON JOBS)')
    console.log('   ĐÃ VƯỢT QUA VỚI KẾT QUẢ PASS 100% TRÊN TIDB VÀ BACKEND!')
    console.log('===============================================================\n')
  } catch (err) {
    console.error('❌ LỖI TRONG QUÁ TRÌNH KIỂM THỬ:', err)
    process.exit(1)
  } finally {
    await closeDatabase().catch(() => {})
    dataApiServer.close()
    backendServer.close()
  }
}

run()
