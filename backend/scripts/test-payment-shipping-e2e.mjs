import path from 'node:path'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'
import crypto from 'node:crypto'
import { createServer } from 'node:http'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.resolve(__dirname, '../../data-api/.env') })

// Cấu hình test environment cho Payment Gateways và 3PL
process.env.NODE_ENV = 'test'
process.env.JWT_SECRET = 'test_secret_for_payment_shipping_e2e_min_32_chars'
process.env.PAYMENT_GATEWAYS_ENABLED = 'true'

process.env.VNPAY_TMN_CODE = 'TESTSHOP'
process.env.VNPAY_HASH_SECRET = 'test_vnpay_secret_key_1234567890'
process.env.VNPAY_PAYMENT_URL = 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html'
process.env.VNPAY_RETURN_URL = 'https://example.test/payment-return'

process.env.MOMO_PARTNER_CODE = 'TESTSHOP'
process.env.MOMO_ACCESS_KEY = 'test_momo_access_key_123456'
process.env.MOMO_SECRET_KEY = 'test_momo_secret_key_123456'
process.env.MOMO_API_URL = 'https://test-payment.momo.vn/v2/gateway/api/create'
process.env.MOMO_REDIRECT_URL = 'https://example.test/payment-return'
process.env.MOMO_IPN_URL = 'https://example.test/api/v1/payments/momo/ipn'

process.env.ZALOPAY_APP_ID = '2553'
process.env.ZALOPAY_KEY1 = 'test_zalopay_key1_1234567890'
process.env.ZALOPAY_KEY2 = 'test_zalopay_key2_0987654321'
process.env.ZALOPAY_ENDPOINT = 'https://sb-openapi.zalopay.vn/v2/create'
process.env.ZALOPAY_REDIRECT_URL = 'https://example.test/payment-return'
process.env.ZALOPAY_CALLBACK_URL = 'https://example.test/api/v1/payments/zalopay/ipn'

process.env.GHN_API_TOKEN = 'test_ghn_token_123456'
process.env.GHN_SHOP_ID = '12345'
process.env.GHTK_API_TOKEN = 'test_ghtk_token_123456'

let passed = 0
let failed = 0

function assert(condition, testName, detail = '') {
  if (condition) {
    console.log(`  ✓ PASS: ${testName}`)
    passed++
  } else {
    console.error(`  ✗ FAIL: ${testName} ${detail ? `(${detail})` : ''}`)
    failed++
    throw new Error(`Failed: ${testName}`)
  }
}

async function startServers() {
  const { env: dataEnv } = await import('../../data-api/src/config/env.js')
  const { default: dataApiApp } = await import('../../data-api/src/app.js')

  const dataApiServer = createServer(dataApiApp)
  await new Promise((resolve) => dataApiServer.listen(0, '127.0.0.1', resolve))
  const dataApiPort = dataApiServer.address().port

  process.env.DATA_API_URL = `http://127.0.0.1:${dataApiPort}`
  process.env.DATA_API_KEY = dataEnv.dataApiKey

  const { default: backendApp } = await import('../src/app.js')
  const backendServer = createServer(backendApp)
  await new Promise((resolve) => backendServer.listen(0, '127.0.0.1', resolve))
  const backendPort = backendServer.address().port

  return {
    dataApiServer,
    backendServer,
    backendUrl: `http://127.0.0.1:${backendPort}`,
  }
}

async function run() {
  console.log('=== BẮT ĐẦU KIỂM THỬ END-TO-END NHÓM 4 (PAYMENT & REFUNDS) VÀ NHÓM 5 (3PL LOGISTICS) ===\n')

  const { dataApiServer, backendServer, backendUrl } = await startServers()
  const { executeQuery, closeDatabase } = await import('../../data-api/src/config/database.js')
  const { signAccessToken } = await import('../src/middlewares/auth.middleware.js')

  const hmac = (alg, key, data) => crypto.createHmac(alg, key).update(data).digest('hex')

  const req = async (path, opts = {}) => {
    const res = await fetch(`${backendUrl}${path}`, {
      ...opts,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...(opts.headers || {}),
      },
    })
    const isJson = (res.headers.get('content-type') || '').includes('application/json')
    const body = isJson ? await res.json() : await res.text()
    return { status: res.status, body }
  }

  let testOrderId
  let testShopOrderId
  let testAmount

  try {
    // 1. Chuẩn bị tài khoản người dùng
    const orderRows = await executeQuery(
      `SELECT so.id AS shop_order_id, so.order_id, so.status AS shop_status, so.shop_id,
              o.buyer_id, o.total_amount, s.owner_id AS seller_id
       FROM shop_orders so
       JOIN orders o ON o.id = so.order_id
       JOIN shops s ON s.id = so.shop_id
       LIMIT 1`,
    )

    testOrderId = orderRows[0].order_id
    testShopOrderId = orderRows[0].shop_order_id
    testAmount = Number(orderRows[0].total_amount)
    const buyerId = orderRows[0].buyer_id
    const sellerId = orderRows[0].seller_id
    const shopId = orderRows[0].shop_id

    const admins = await executeQuery("SELECT id, username FROM users WHERE role = 'admin' LIMIT 1")
    const adminId = admins[0]?.id || 1

    const buyerToken = signAccessToken({ id: buyerId, username: 'buyer_test', role: 'buyer', shopId: null })
    const sellerToken = signAccessToken({ id: sellerId, username: 'seller_test', role: 'seller', shopId: String(shopId) })
    const adminToken = signAccessToken({ id: adminId, username: 'admin_test', role: 'admin', shopId: null })

    // Đảm bảo đơn và shop_order ở trạng thái sẵn sàng cho test thanh toán
    await executeQuery("UPDATE shop_orders SET status = 'pending', cancelled_at = NULL, cancel_reason = NULL, delivered_at = NULL WHERE id = ?", [testShopOrderId])
    await executeQuery("UPDATE orders SET payment_method = 'vnpay' WHERE id = ?", [testOrderId])
    await executeQuery("UPDATE payments SET status = 'unpaid', method = 'vnpay', paid_at = NULL WHERE shop_order_id = ?", [testShopOrderId])
    // Xóa attempt cũ nếu có để tạo attempt mới
    await executeQuery("DELETE FROM payment_attempts WHERE order_id = ?", [testOrderId])

    // ========================================================
    // NHÓM 5: TÍCH HỢP ĐƠN VỊ VẬN CHUYỂN BÊN THỨ 3 (3PL)
    // ========================================================
    console.log('--- KIỂM TRA NHÓM 5: BÁO GIÁ CƯỚC VÀ THỜI GIAN GIAO HÀNG THỰC TẾ 3PL ---')

    const ratesRes = await req('/api/v1/shipping/rates-3pl', {
      method: 'POST',
      body: JSON.stringify({
        fromProvince: 'Hồ Chí Minh',
        toProvince: 'Hà Nội',
        weightGrams: 1500,
        subtotal: 450000,
      }),
    })

    assert(ratesRes.status === 200, 'POST /api/v1/shipping/rates-3pl trả về mã HTTP 200')
    assert(ratesRes.body.success === true, 'Báo giá 3PL có success === true')
    assert(Array.isArray(ratesRes.body.data?.carriers), 'Trả về danh sách các hãng vận chuyển 3PL')
    assert(ratesRes.body.data.carriers.length === 3, 'Bao gồm đủ 3 hãng hàng đầu: GHN, GHTK, Viettel Post')

    const ghn = ratesRes.body.data.carriers.find((c) => c.carrier === 'GHN')
    const ghtk = ratesRes.body.data.carriers.find((c) => c.carrier === 'GHTK')
    const vtp = ratesRes.body.data.carriers.find((c) => c.carrier === 'ViettelPost')

    assert(Boolean(ghn && ghn.fee > 0 && ghn.estimatedDeliveryDays), 'GHN có cước phí và thời gian giao hàng thực tế')
    assert(Boolean(ghtk && ghtk.fee > 0 && ghtk.estimatedDeliveryDays), 'GHTK có cước phí và thời gian giao hàng thực tế')
    assert(Boolean(vtp && vtp.fee > 0 && vtp.estimatedDeliveryDays), 'Viettel Post có cước phí và thời gian giao hàng thực tế')

    // ========================================================
    // NHÓM 4: THANH TOÁN ONLINE, IPN WEBHOOK, REFUND & ĐỐI SOÁT
    // ========================================================
    console.log('\n--- KIỂM TRA NHÓM 4: CỔNG THANH TOÁN ONLINE & IPN WEBHOOK ---')

    const sessionRes = await req(`/api/v1/orders/${testOrderId}/payment-session`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${buyerToken}` },
    })

    assert(sessionRes.status === 200, 'POST /api/v1/orders/:id/payment-session trả về mã HTTP 200')
    assert(sessionRes.body.success === true, 'Tạo phiên thanh toán online thành công')
    assert(Boolean(sessionRes.body.data?.paymentUrl), 'Trả về paymentUrl chứa URL thanh toán cổng')
    assert(sessionRes.body.data.paymentUrl.includes('vnp_SecureHash='), 'URL thanh toán VNPay có chữ ký số vnp_SecureHash HMAC-SHA512')

    // 2. Tra cứu payment-status
    const statusRes = await req(`/api/v1/orders/${testOrderId}/payment-status`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${buyerToken}` },
    })
    assert(statusRes.status === 200, 'GET /api/v1/orders/:id/payment-status trả về mã HTTP 200')
    assert(statusRes.body.data?.method === 'vnpay', 'Đúng phương thức thanh toán của đơn')

    // 3. Kiểm thử VNPay IPN Webhook
    // Lấy reference vừa tạo từ payment_attempts
    const attempts = await executeQuery('SELECT reference, amount FROM payment_attempts WHERE order_id = ? ORDER BY id DESC LIMIT 1', [testOrderId])
    const vnpRef = attempts[0]?.reference || `SN${testOrderId}`
    const vnpAmount = Number(attempts[0]?.amount || testAmount)

    // A. Thử gửi IPN VNPay với chữ ký giả mạo -> Phải bị từ chối
    const fakeIpn = await req(`/api/v1/payments/vnpay/ipn?vnp_TmnCode=TESTSHOP&vnp_TxnRef=${vnpRef}&vnp_Amount=${vnpAmount * 100}&vnp_ResponseCode=00&vnp_TransactionStatus=00&vnp_TransactionNo=999111&vnp_SecureHash=fake_invalid_hash`)
    assert(fakeIpn.status === 200 && fakeIpn.body.RspCode === '97', 'VNPay IPN từ chối chữ ký giả mạo với mã RspCode 97')

    // B. Gửi IPN VNPay với chữ ký số chuẩn xác HMAC-SHA512
    const vnpParams = {
      vnp_Amount: String(vnpAmount * 100),
      vnp_Command: 'pay',
      vnp_CreateDate: '20261111100000',
      vnp_CurrCode: 'VND',
      vnp_IpAddr: '127.0.0.1',
      vnp_Locale: 'vn',
      vnp_OrderInfo: `Thanh toan don ${vnpRef}`,
      vnp_ResponseCode: '00',
      vnp_TmnCode: 'TESTSHOP',
      vnp_TransactionNo: '888777666',
      vnp_TransactionStatus: '00',
      vnp_TxnRef: vnpRef,
    }
    const signedData = new URLSearchParams(Object.entries(vnpParams).sort(([a], [b]) => a.localeCompare(b, 'en'))).toString()
    const validHash = hmac('sha512', process.env.VNPAY_HASH_SECRET, signedData)

    const validIpn = await req(`/api/v1/payments/vnpay/ipn?${signedData}&vnp_SecureHash=${validHash}`)
    assert(validIpn.status === 200 && validIpn.body.RspCode === '00', 'VNPay IPN xác nhận thành công giao dịch hợp lệ (RspCode 00)')

    // Kiểm tra trạng thái DB sau IPN đã chuyển sang paid
    const updatedPayments = await executeQuery('SELECT status FROM payments WHERE shop_order_id = ?', [testShopOrderId])
    assert(updatedPayments[0]?.status === 'paid', 'Bảng payments đã được IPN tự động cập nhật sang paid')

    // 4. Kiểm thử ZaloPay IPN Webhook
    console.log('\n--- KIỂM TRA ZALOPAY IPN WEBHOOK ---')
    const zaloData = JSON.stringify({
      app_id: 2553,
      app_trans_id: `261111_${vnpRef}`,
      app_time: Date.now(),
      app_user: 'ShopNova',
      amount: vnpAmount,
      embed_data: '{}',
      item: '[]',
      zp_trans_id: 1234567890,
      server_time: Date.now(),
    })
    const zaloMac = hmac('sha256', process.env.ZALOPAY_KEY2, zaloData)

    // A. ZaloPay IPN sai MAC
    const badZaloIpn = await req('/api/v1/payments/zalopay/ipn', {
      method: 'POST',
      body: JSON.stringify({ data: zaloData, mac: 'invalid_mac_abc' }),
    })
    assert(badZaloIpn.body.return_code === -1, 'ZaloPay IPN từ chối request sai MAC (return_code: -1)')

    // B. ZaloPay IPN đúng MAC
    const goodZaloIpn = await req('/api/v1/payments/zalopay/ipn', {
      method: 'POST',
      body: JSON.stringify({ data: zaloData, mac: zaloMac }),
    })
    assert(goodZaloIpn.status === 200, 'ZaloPay IPN xử lý thành công (HTTP 200)')

    // 5. Kiểm thử Hoàn tiền tự động (Automated Refunds)
    console.log('\n--- KIỂM TRA HOÀN TIỀN TỰ ĐỘNG (AUTOMATED REFUNDS) ---')
    const refundRes = await req('/api/v1/payments/refund', {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        orderId: String(testOrderId),
        shopOrderId: String(testShopOrderId),
        amount: vnpAmount,
        reason: 'Đơn hàng hủy, hoàn tiền tự động qua cổng VNPay',
      }),
    })

    assert(refundRes.status === 200, 'POST /api/v1/payments/refund trả về mã HTTP 200')
    assert(refundRes.body.success === true, 'Hoàn tiền tự động báo success === true')
    assert(Boolean(refundRes.body.data?.refundTransactionId), 'Có mã giao dịch hoàn tiền refundTransactionId từ cổng đối tác')

    const refundedPayments = await executeQuery('SELECT status FROM payments WHERE shop_order_id = ?', [testShopOrderId])
    assert(refundedPayments[0]?.status === 'refunded' || refundedPayments[0]?.status === 'void', 'Trạng thái payments được cập nhật sang refunded/void')

    // 6. Kiểm thử Đối soát tự động (Automated Reconciliation)
    console.log('\n--- KIỂM TRA ĐỐI SOÁT GIAO DỊCH TỰ ĐỘNG (RECONCILIATION) ---')
    const reconcileRes = await req('/api/v1/admin/payments/reconcile', {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
    })

    assert(reconcileRes.status === 200, 'POST /api/v1/admin/payments/reconcile trả về mã HTTP 200')
    assert(reconcileRes.body.success === true, 'Đối soát giao dịch tự động thành công')
    assert(typeof reconcileRes.body.data?.totalChecked === 'number', 'Báo cáo đối soát thống kê tổng số giao dịch đã kiểm tra')
    assert(Boolean(reconcileRes.body.data?.summary), 'Báo cáo đối soát tổng hợp summary cập nhật')

    // ========================================================
    // NHÓM 5: TỰ ĐỘNG ĐẨY ĐƠN & WEBHOOK HÀNH TRÌNH BƯU TÁ
    // ========================================================
    console.log('\n--- KIỂM TRA NHÓM 5: TỰ ĐỘNG ĐẨY ĐƠN & WEBHOOK HÀNH TRÌNH BƯU TÁ ---')

    // Chuẩn bị đơn ở trạng thái confirmed
    await executeQuery("UPDATE shop_orders SET status = 'confirmed', tracking_code = NULL, cancelled_at = NULL, cancel_reason = NULL, delivered_at = NULL WHERE id = ?", [testShopOrderId])
    await executeQuery("UPDATE orders SET payment_method = 'cod' WHERE id = ?", [testOrderId])
    await executeQuery("UPDATE payments SET status = 'unpaid', method = 'cod', paid_at = NULL WHERE shop_order_id = ?", [testShopOrderId])

    // 1. Seller bấm "Xác nhận gửi hàng" -> Tự động đẩy đơn 3PL
    const dispatchRes = await req(`/api/v1/seller/orders/${testShopOrderId}/dispatch`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${sellerToken}` },
      body: JSON.stringify({ carrier: 'GHN' }),
    })

    assert(dispatchRes.status === 200, 'POST /api/v1/seller/orders/:id/dispatch trả về mã HTTP 200')
    assert(dispatchRes.body.success === true, 'Đẩy đơn 3PL thành công')
    const assignedTracking = dispatchRes.body.data?.trackingCode
    assert(Boolean(assignedTracking && assignedTracking.startsWith('GHN')), `Tự động tạo mã vận đơn 3PL: ${assignedTracking}`)
    assert(Boolean(dispatchRes.body.data?.pickupAppointment?.shift), `Có lịch hẹn bưu tá lấy hàng: ${dispatchRes.body.data?.pickupAppointment?.shift}`)

    // Kiểm tra trạng thái đơn chuyển sang shipping
    const afterDispatchShopOrder = await executeQuery('SELECT status, tracking_code FROM shop_orders WHERE id = ?', [testShopOrderId])
    assert(afterDispatchShopOrder[0]?.status === 'shipping', 'Trạng thái đơn hàng tự động chuyển sang shipping')
    assert(afterDispatchShopOrder[0]?.tracking_code === assignedTracking, 'Mã vận đơn đã được lưu vào shop_orders')

    // 2. Kiểm tra bảo mật Webhook bưu tá: Từ chối nếu thiếu token / token sai
    const badWebhook = await req('/api/v1/shipping/webhook/ghn', {
      method: 'POST',
      headers: { 'x-ghn-token': 'wrong_token' },
      body: JSON.stringify({ OrderCode: assignedTracking, Status: 'picked' }),
    })
    assert(badWebhook.status === 401, 'Webhook bưu tá từ chối request sai token (HTTP 401)')

    const ghnHeaders = { 'x-ghn-token': 'test_ghn_token_123456' }

    // 3. Bưu tá gửi webhook cập nhật hành trình: Bưu tá đã lấy hàng (picked_up)
    const webhookPicked = await req('/api/v1/shipping/webhook/ghn', {
      method: 'POST',
      headers: ghnHeaders,
      body: JSON.stringify({
        OrderCode: assignedTracking,
        Status: 'picked',
        Warehouse: 'Bưu cục Quận 1, TP.HCM',
        Description: 'Bưu tá GHN đã lấy kiện hàng từ kho người bán',
      }),
    })
    assert(webhookPicked.status === 200, 'Webhook bưu tá đã lấy hàng trả về HTTP 200')

    // 4. Bưu tá gửi webhook cập nhật hành trình: Đang trung chuyển (in_transit)
    const webhookTransit = await req('/api/v1/shipping/webhook/ghn', {
      method: 'POST',
      headers: ghnHeaders,
      body: JSON.stringify({
        OrderCode: assignedTracking,
        Status: 'sorting',
        Warehouse: 'Trung tâm khai thác Tân Bình',
        Description: 'Kiện hàng đang được phân loại và luân chuyển',
      }),
    })
    assert(webhookTransit.status === 200, 'Webhook kiện hàng trung chuyển trả về HTTP 200')

    // 5. Bưu tá gửi webhook cập nhật hành trình: Đang phát (out_for_delivery)
    const webhookDelivering = await req('/api/v1/shipping/webhook/ghn', {
      method: 'POST',
      headers: ghnHeaders,
      body: JSON.stringify({
        OrderCode: assignedTracking,
        Status: 'delivering',
        Warehouse: 'Bưu cục Đống Đa, Hà Nội',
        Description: 'Bưu tá đang phát kiện hàng tới người nhận',
      }),
    })
    assert(webhookDelivering.status === 200, 'Webhook bưu tá đang phát hàng trả về HTTP 200')

    // 6. Bưu tá gửi webhook cập nhật hành trình: Giao thành công (delivered)
    const webhookDelivered = await req('/api/v1/shipping/webhook/ghn', {
      method: 'POST',
      headers: ghnHeaders,
      body: JSON.stringify({
        OrderCode: assignedTracking,
        Status: 'delivered',
        Warehouse: 'Trạm phát Đống Đa',
        Description: 'Kiện hàng đã giao thành công. Người nhận đã ký nhận.',
      }),
    })
    assert(webhookDelivered.status === 200, 'Webhook giao hàng thành công trả về HTTP 200')

    // Kiểm tra tự động chuyển trạng thái đơn hàng sang delivered
    const deliveredShopOrder = await executeQuery('SELECT status, delivered_at FROM shop_orders WHERE id = ?', [testShopOrderId])
    assert(deliveredShopOrder[0]?.status === 'delivered', 'Đơn hàng tự động chuyển sang delivered từ webhook bưu tá')
    assert(Boolean(deliveredShopOrder[0]?.delivered_at), 'Đã tự động cập nhật thời gian delivered_at')

    // Kiểm tra đơn COD tự động chuyển payments sang paid khi bưu tá báo delivered
    const codPayments = await executeQuery('SELECT status, paid_at FROM payments WHERE shop_order_id = ?', [testShopOrderId])
    assert(codPayments[0]?.status === 'paid', 'Tiền COD đã được tự động xác nhận paid khi bưu tá báo giao thành công')
    assert(Boolean(codPayments[0]?.paid_at), 'Có mốc thời gian paid_at của thanh toán COD')

    // 6. Tra cứu hành trình bưu kiện
    const trackingRes = await req(`/api/v1/orders/${testOrderId}/tracking`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${buyerToken}` },
    })

    assert(trackingRes.status === 200, 'GET /api/v1/orders/:id/tracking trả về mã HTTP 200')
    const pkg = trackingRes.body.data?.packages?.[0]
    assert(Boolean(pkg && pkg.trackingCode === assignedTracking), 'Gói hàng có đúng mã vận đơn 3PL')
    assert(Array.isArray(pkg.timeline) && pkg.timeline.length >= 4, `Timeline có đầy đủ ${pkg.timeline.length} mốc hành trình từ webhook bưu tá`)
    assert(pkg.currentStatus === 'delivered', 'Trạng thái hiện tại của bưu kiện là delivered')

    console.log('\n========================================================')
    console.log(`🎉 TẤT CẢ CÁC BÀI TEST KIỂM THỬ END-TO-END ĐỀU ĐẠT! (${passed} PASS, ${failed} FAIL)`)
    console.log('========================================================\n')
  } finally {
    await new Promise((resolve) => dataApiServer.close(resolve))
    await new Promise((resolve) => backendServer.close(resolve))
    await closeDatabase()
  }
}

run().catch((err) => {
  console.error('Lỗi kiểm thử E2E:', err)
  process.exit(1)
})
