import http from 'node:http'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import jwt from 'jsonwebtoken'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '..')
const dataApiRootDir = path.resolve(rootDir, '../data-api')

const TEST_JWT_SECRET = 'test_integration_order_jwt_secret_min_32_characters_12345'
const TEST_SERVICE_KEY = 'test_integration_order_service_key_64_characters_entropy_secret_key'

let passed = 0
let failed = 0

function assert(condition, name, detail = '') {
  if (condition) {
    console.log(`  ✓ PASS: ${name}`)
    passed++
  } else {
    console.error(`  ✗ FAIL: ${name} ${detail ? `(${detail})` : ''}`)
    failed++
  }
}

function generateToken(userId, role = 'buyer') {
  return jwt.sign(
    {
      sub: String(userId),
      role,
    },
    TEST_JWT_SECRET,
    {
      algorithm: 'HS256',
      issuer: 'shopnova-backend',
      audience: 'shopnova-clients',
      expiresIn: '900s',
    },
  )
}

function getAvailablePort() {
  return new Promise((resolve, reject) => {
    const srv = http.createServer()
    srv.listen(0, '127.0.0.1', () => {
      const { port } = srv.address()
      srv.close(() => resolve(port))
    })
    srv.on('error', reject)
  })
}

function startProcess(name, dir, env) {
  return new Promise((resolve, reject) => {
    const proc = spawn('node', ['src/server.js'], {
      cwd: dir,
      env: { ...process.env, ...env },
      stdio: ['pipe', 'pipe', 'pipe'],
    })

    let stdout = ''
    let stderr = ''
    let resolved = false

    proc.stdout.on('data', (d) => {
      stdout += d.toString()
      if (!resolved && (stdout.includes('lắng nghe') || stdout.includes('running') || stdout.includes('sẵn sàng'))) {
        resolved = true
        resolve(proc)
      }
    })

    proc.stderr.on('data', (d) => {
      stderr += d.toString()
    })

    proc.on('error', (err) => {
      if (!resolved) {
        resolved = true
        reject(err)
      }
    })

    proc.on('exit', (code) => {
      if (!resolved) {
        resolved = true
        reject(new Error(`${name} dừng quá sớm với mã ${code}: ${stderr || stdout}`))
      }
    })

    setTimeout(() => {
      if (!resolved) {
        resolved = true
        resolve(proc)
      }
    }, 4000)
  })
}

async function requestHttp(baseUrl, endpoint, options = {}) {
  const url = `${baseUrl}${endpoint}`
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  }

  const res = await fetch(url, {
    method: options.method || 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  })

  let body = null
  try {
    body = await res.json()
  } catch {
    body = null
  }

  return { status: res.status, headers: res.headers, body }
}

async function run() {
  console.log('=== BẮT ĐẦU KIỂM THỬ TÍCH HỢP ĐẶT HÀNG (BE-007 ORDER API) ===\n')

  const dataApiPort = await getAvailablePort()
  const backendPort = await getAvailablePort()

  let dataProc = null
  let backendProc = null

  try {
    dataProc = await startProcess('Data API', dataApiRootDir, {
      PORT: String(dataApiPort),
      DATA_API_KEY: TEST_SERVICE_KEY,
    })
    console.log(`[Khởi động] Data API cổng: ${dataApiPort}`)

    backendProc = await startProcess('Backend', rootDir, {
      PORT: String(backendPort),
      DATA_API_URL: `http://127.0.0.1:${dataApiPort}`,
      DATA_API_KEY: TEST_SERVICE_KEY,
      JWT_SECRET: TEST_JWT_SECRET,
    })
    console.log(`[Khởi động] Backend cổng: ${backendPort}`)

    const backendUrl = `http://127.0.0.1:${backendPort}`
    const tokenUser1 = generateToken('1')
    const tokenUser2 = generateToken('2')

    // 1. Kiểm tra xác thực (Auth Required)
    console.log('\n--- 1. Kiểm tra xác thực (Authentication Required) ---')
    {
      const resNoAuth = await requestHttp(backendUrl, '/api/v1/orders', { method: 'POST', body: {} })
      assert(resNoAuth.status === 401, 'POST /api/v1/orders không có token trả HTTP 401')
      assert(resNoAuth.body?.error?.code === 'AUTH_REQUIRED', 'Mã lỗi là AUTH_REQUIRED khi thiếu token')

      const resListNoAuth = await requestHttp(backendUrl, '/api/v1/orders')
      assert(resListNoAuth.status === 401, 'GET /api/v1/orders không có token trả HTTP 401')
    }

    // 2. Kiểm tra validation khi đặt hàng
    console.log('\n--- 2. Kiểm tra validation khi đặt hàng ---')
    {
      const resEmpty = await requestHttp(backendUrl, '/api/v1/orders', {
        method: 'POST',
        headers: { Authorization: `Bearer ${tokenUser1}` },
        body: {},
      })
      assert(resEmpty.status === 400, 'Thiếu thông tin người nhận trả HTTP 400')
      assert(resEmpty.body?.error?.code === 'VALIDATION_ERROR', 'Mã lỗi là VALIDATION_ERROR')
    }

    // 3. Đặt hàng thành công
    console.log('\n--- 3. Đặt hàng thành công (POST /api/v1/orders) ---')
    const testIdempotencyKey = 'idempotent-test-key-' + Date.now()
    let createdOrderId = null
    let createdOrderCode = null

    {
      const resOrder = await requestHttp(backendUrl, '/api/v1/orders', {
        method: 'POST',
        headers: { Authorization: `Bearer ${tokenUser1}` },
        body: {
          idempotencyKey: testIdempotencyKey,
          recipientName: 'Nguyễn Văn Test',
          recipientPhone: '0901234567',
          province: 'TP. Hồ Chí Minh',
          district: 'Quận 1',
          ward: 'Phường Bến Nghé',
          addressDetail: '123 Đường Test',
          note: 'Giao hàng cẩn thận',
          items: [{ variantId: '1', qty: 1 }],
        },
      })

      assert(resOrder.status === 201, 'Đặt hàng hợp lệ trả HTTP 201')
      assert(resOrder.body?.success === true, 'Envelope success === true')
      assert(typeof resOrder.body?.data?.id === 'string', 'Trả về orderId dạng chuỗi')
      assert(typeof resOrder.body?.data?.code === 'string', 'Trả về order code')
      assert(resOrder.body?.data?.code.startsWith('ORD'), 'Mã đơn bắt đầu bằng ORD')
      assert(resOrder.body?.data?.recipientName === 'Nguyễn Văn Test', 'Đúng tên người nhận')
      assert(Array.isArray(resOrder.body?.data?.shopOrders), 'shopOrders là một mảng')
      assert(resOrder.body?.data?.shopOrders.length === 1, 'Đơn gồm 1 shop')
      assert(resOrder.body?.data?.shopOrders[0]?.items.length === 1, 'Shop có 1 sản phẩm')
      assert(typeof resOrder.body?.data?.totalAmount === 'number', 'totalAmount là kiểu số VND')

      createdOrderId = resOrder.body?.data?.id
      createdOrderCode = resOrder.body?.data?.code
    }

    // 4. Kiểm tra Idempotency (Gửi lại cùng key trả về cùng đơn)
    console.log('\n--- 4. Kiểm tra Idempotency (Chống tạo đơn trùng lặp) ---')
    {
      const resRetry = await requestHttp(backendUrl, '/api/v1/orders', {
        method: 'POST',
        headers: { Authorization: `Bearer ${tokenUser1}` },
        body: {
          idempotencyKey: testIdempotencyKey,
          recipientName: 'Nguyễn Văn Test',
          recipientPhone: '0901234567',
          province: 'TP. Hồ Chí Minh',
          addressDetail: '123 Đường Test',
          items: [{ variantId: '1', qty: 1 }],
        },
      })
      assert(resRetry.status === 200 || resRetry.status === 201, 'Gửi lại cùng key thành công HTTP 200/201')
      assert(resRetry.body?.data?.id === createdOrderId, 'Trả về đúng orderId cũ (idempotent)')
    }

    // 5. Danh sách đơn hàng (GET /api/v1/orders)
    console.log('\n--- 5. Kiểm tra danh sách đơn hàng (GET /api/v1/orders) ---')
    {
      const resList = await requestHttp(backendUrl, '/api/v1/orders', {
        headers: { Authorization: `Bearer ${tokenUser1}` },
      })
      assert(resList.status === 200, 'GET /api/v1/orders trả HTTP 200')
      assert(Array.isArray(resList.body?.data), 'Danh sách đơn hàng là mảng')
      assert(resList.body?.data.length > 0, 'Tìm thấy đơn hàng vừa tạo')
      assert(resList.body?.data.some((o) => o.id === createdOrderId), 'Đơn vừa tạo nằm trong danh sách')
    }

    // 6. Chi tiết đơn hàng (GET /api/v1/orders/:orderId) & Phân quyền
    console.log('\n--- 6. Chi tiết đơn hàng và bảo vệ phân quyền ---')
    {
      const resDetail = await requestHttp(backendUrl, `/api/v1/orders/${createdOrderId}`, {
        headers: { Authorization: `Bearer ${tokenUser1}` },
      })
      assert(resDetail.status === 200, 'GET /api/v1/orders/:orderId trả HTTP 200')
      assert(resDetail.body?.data?.id === createdOrderId, 'ID đơn khớp')
      assert(resDetail.body?.data?.code === createdOrderCode, 'Mã code khớp')

      // User 2 không có quyền xem đơn của User 1
      const resOtherUser = await requestHttp(backendUrl, `/api/v1/orders/${createdOrderId}`, {
        headers: { Authorization: `Bearer ${tokenUser2}` },
      })
      assert(resOtherUser.status === 404, 'User khác xem đơn trả HTTP 404 (cô lập an toàn)')
      assert(resOtherUser.body?.error?.code === 'ORDER_NOT_FOUND', 'Mã lỗi là ORDER_NOT_FOUND')
    }

    // 7. Hủy đơn hàng (PATCH /api/v1/orders/:orderId/cancel)
    console.log('\n--- 7. Hủy đơn hàng (PATCH /api/v1/orders/:orderId/cancel) ---')
    {
      const resCancel = await requestHttp(backendUrl, `/api/v1/orders/${createdOrderId}/cancel`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${tokenUser1}` },
        body: { reason: 'Tôi muốn đổi địa chỉ nhận hàng' },
      })
      assert(resCancel.status === 200, 'Hủy đơn hàng thành công trả HTTP 200')
      assert(resCancel.body?.data?.cancelled === true, 'Trả về cancelled === true')

      // Kiểm tra lại chi tiết đơn: trạng thái phải là cancelled
      const resCheck = await requestHttp(backendUrl, `/api/v1/orders/${createdOrderId}`, {
        headers: { Authorization: `Bearer ${tokenUser1}` },
      })
      assert(resCheck.status === 200, 'Xem lại đơn sau khi hủy trả HTTP 200')
      assert(resCheck.body?.data?.shopOrders[0]?.status === 'cancelled', 'Trạng thái shop_order chuyển thành cancelled')
    }

    // 8. Tích hợp Voucher vào quy trình Đặt hàng & Hủy đơn hoàn Voucher
    console.log('\n--- 8. Tích hợp Voucher vào Đặt hàng & Hủy đơn hoàn trả ---')
    const tokenSellerShop1 = generateToken('2', 'seller') // Chủ shop 1
    const tokenSellerShop2 = generateToken('3', 'seller') // Chủ shop 2

    // 8.1 Kiểm tra thẩm định voucherCode sai kiểu (Object, Number, khoảng trắng rỗng)
    {
      const resObjectVoucher = await requestHttp(backendUrl, '/api/v1/orders', {
        method: 'POST',
        headers: { Authorization: `Bearer ${tokenUser1}` },
        body: {
          recipientName: 'Người nhận Test',
          recipientPhone: '0988888888',
          province: 'Hà Nội',
          addressDetail: '99 Phố Test',
          items: [{ variantId: '1', qty: 1 }],
          voucherCode: { code: 'NOVA20K' },
        },
      })
      assert(resObjectVoucher.status === 400, 'voucherCode dạng object trả HTTP 400')
      assert(
        resObjectVoucher.body?.error?.code === 'INVALID_VOUCHER_CODE',
        'Mã lỗi voucherCode object là INVALID_VOUCHER_CODE',
      )

      const resNumberVoucher = await requestHttp(backendUrl, '/api/v1/orders', {
        method: 'POST',
        headers: { Authorization: `Bearer ${tokenUser1}` },
        body: {
          recipientName: 'Người nhận Test',
          recipientPhone: '0988888888',
          province: 'Hà Nội',
          addressDetail: '99 Phố Test',
          items: [{ variantId: '1', qty: 1 }],
          voucherCode: 12345,
        },
      })
      assert(resNumberVoucher.status === 400, 'voucherCode dạng number trả HTTP 400')
      assert(
        resNumberVoucher.body?.error?.code === 'INVALID_VOUCHER_CODE',
        'Mã lỗi voucherCode number là INVALID_VOUCHER_CODE',
      )

      const resEmptyVoucher = await requestHttp(backendUrl, '/api/v1/orders', {
        method: 'POST',
        headers: { Authorization: `Bearer ${tokenUser1}` },
        body: {
          recipientName: 'Người nhận Test',
          recipientPhone: '0988888888',
          province: 'Hà Nội',
          addressDetail: '99 Phố Test',
          items: [{ variantId: '1', qty: 1 }],
          voucherCode: '   ',
        },
      })
      assert(resEmptyVoucher.status === 400, 'voucherCode toàn khoảng trắng trả HTTP 400')
      assert(
        resEmptyVoucher.body?.error?.code === 'INVALID_VOUCHER_CODE',
        'Mã lỗi voucherCode rỗng là INVALID_VOUCHER_CODE',
      )
    }

    // 8.2 Voucher không tồn tại
    {
      const resInvalidVoucher = await requestHttp(backendUrl, '/api/v1/orders', {
        method: 'POST',
        headers: { Authorization: `Bearer ${tokenUser1}` },
        body: {
          recipientName: 'Người nhận Voucher',
          recipientPhone: '0988888888',
          province: 'Hà Nội',
          addressDetail: '99 Phố Test',
          items: [{ variantId: '1', qty: 1 }],
          voucherCode: 'VOUCHER_KHONG_TON_TAI_999',
        },
      })
      assert(resInvalidVoucher.status === 404, 'Mã voucher không tồn tại trả HTTP 404')
      assert(resInvalidVoucher.body?.error?.code === 'VOUCHER_NOT_FOUND', 'Mã lỗi là VOUCHER_NOT_FOUND')
    }

    // 8.3 Đơn chưa đạt giá trị tối thiểu của Voucher (NOVA20K yêu cầu tối thiểu 500k, 1 áo 180k)
    {
      const resMinNotMet = await requestHttp(backendUrl, '/api/v1/orders', {
        method: 'POST',
        headers: { Authorization: `Bearer ${tokenUser1}` },
        body: {
          recipientName: 'Người nhận Voucher',
          recipientPhone: '0988888888',
          province: 'Hà Nội',
          addressDetail: '99 Phố Test',
          items: [{ variantId: '1', qty: 1 }],
          voucherCode: 'NOVA20K',
        },
      })
      assert(resMinNotMet.status === 400, 'Đơn chưa đạt giá trị tối thiểu trả HTTP 400')
      assert(resMinNotMet.body?.error?.code === 'VOUCHER_MIN_NOT_MET', 'Mã lỗi là VOUCHER_MIN_NOT_MET')
    }

    // 8.4 Đặt đơn nhiều shop với Voucher: kiểm tra phân bổ chiết khấu không shop nào vượt subtotal
    {
      const resMultiShop = await requestHttp(backendUrl, '/api/v1/orders', {
        method: 'POST',
        headers: { Authorization: `Bearer ${tokenUser1}` },
        body: {
          recipientName: 'Người nhận Nhiều Shop',
          recipientPhone: '0988888888',
          province: 'Hà Nội',
          addressDetail: '99 Phố Test',
          items: [
            { variantId: '1', qty: 2 }, // Shop 1: 180k * 2 = 360k
            { variantId: '10', qty: 1 }, // Shop 2: 145k * 1 = 145k (tổng 505k >= 500k)
          ],
          voucherCode: 'NOVA20K',
        },
      })
      if (resMultiShop.status !== 201) {
        console.error('LỖI ĐẶT HÀNG NHIỀU SHOP:', resMultiShop.status, JSON.stringify(resMultiShop.body))
      }
      assert(resMultiShop.status === 201, 'Đặt hàng nhiều shop với voucher trả HTTP 201')
      assert(resMultiShop.body?.data?.shopOrders.length === 2, 'Đơn gồm 2 shop')
      const shop1 = resMultiShop.body?.data?.shopOrders[0]
      const shop2 = resMultiShop.body?.data?.shopOrders[1]
      assert(shop1.discountAmount <= shop1.subtotal, 'Shop 1 discountAmount không vượt quá subtotal')
      assert(shop2.discountAmount <= shop2.subtotal, 'Shop 2 discountAmount không vượt quá subtotal')
      assert(
        shop1.discountAmount + shop2.discountAmount === 20000,
        'Tổng chiết khấu các shop bằng chính xác 20.000 ₫',
      )

      // Hủy đơn nhiều shop để giải phóng voucher
      const multiOrderId = resMultiShop.body?.data?.id
      if (multiOrderId) {
        await requestHttp(backendUrl, `/api/v1/orders/${multiOrderId}/cancel`, {
          method: 'PATCH',
          headers: { Authorization: `Bearer ${tokenUser1}` },
          body: { reason: 'Hủy đơn nhiều shop test' },
        })
      }
    }

    // 8.5 Đặt hàng thành công 1 shop với Voucher hợp lệ (3 áo x 180k = 540k >= 500k)
    let voucherOrderId = null
    let shopOrderIdToCancel = null
    {
      const resVoucherOrder = await requestHttp(backendUrl, '/api/v1/orders', {
        method: 'POST',
        headers: { Authorization: `Bearer ${tokenUser1}` },
        body: {
          recipientName: 'Người nhận Voucher',
          recipientPhone: '0988888888',
          province: 'Hà Nội',
          addressDetail: '99 Phố Test',
          items: [{ variantId: '1', qty: 3 }],
          voucherCode: 'nova20k', // kiểm tra tự động chuẩn hóa chữ thường thành HOA
        },
      })
      assert(resVoucherOrder.status === 201, 'Đặt hàng thành công với voucher hợp lệ trả HTTP 201')
      assert(resVoucherOrder.body?.data?.voucherCode === 'NOVA20K', 'Lưu voucherCode là NOVA20K')
      assert(resVoucherOrder.body?.data?.subtotal === 540000, 'Subtotal đúng 540.000 ₫')
      assert(resVoucherOrder.body?.data?.discountAmount === 20000, 'Chiết khấu đúng 20.000 ₫')
      assert(
        resVoucherOrder.body?.data?.totalAmount ===
          540000 + resVoucherOrder.body?.data?.shippingFee - 20000,
        'Tổng tiền bằng subtotal + shippingFee - discountAmount',
      )
      assert(
        resVoucherOrder.body?.data?.shopOrders[0]?.discountAmount === 20000,
        'Chiết khấu được phân bổ vào shop order',
      )

      voucherOrderId = resVoucherOrder.body?.data?.id
      shopOrderIdToCancel = resVoucherOrder.body?.data?.shopOrders[0]?.id
    }

    // 8.6 Chặn vượt quá per_user_limit khi voucher đã được áp dụng
    {
      const resExceedLimit = await requestHttp(backendUrl, '/api/v1/orders', {
        method: 'POST',
        headers: { Authorization: `Bearer ${tokenUser1}` },
        body: {
          recipientName: 'Người nhận Voucher',
          recipientPhone: '0988888888',
          province: 'Hà Nội',
          addressDetail: '99 Phố Test',
          items: [{ variantId: '1', qty: 3 }],
          voucherCode: 'NOVA20K',
        },
      })
      assert(resExceedLimit.status === 400, 'Vượt quá số lượt dùng của user trả HTTP 400')
      assert(
        resExceedLimit.body?.error?.code === 'VOUCHER_USER_LIMIT_EXCEEDED',
        'Mã lỗi là VOUCHER_USER_LIMIT_EXCEEDED',
      )
    }

    // 8.7 SELLER HỦY ĐƠN: kiểm tra voucher tự động được hoàn lại khi seller hủy đơn con duy nhất
    {
      const resSellerCancel = await requestHttp(
        backendUrl,
        `/api/v1/seller/orders/${shopOrderIdToCancel}/status`,
        {
          method: 'PATCH',
          headers: { Authorization: `Bearer ${tokenSellerShop1}` },
          body: {
            toStatus: 'cancelled',
            cancelReason: 'Shop hết hàng mẫu kích cỡ yêu cầu',
          },
        },
      )
      if (resSellerCancel.status !== 200) {
        console.error('LỖI SELLER CANCEL:', resSellerCancel.status, JSON.stringify(resSellerCancel.body))
      }
      assert(resSellerCancel.status === 200, 'Seller hủy đơn hàng thành công trả HTTP 200')
      assert(
        resSellerCancel.body?.data?.toStatus === 'cancelled',
        'Trạng thái đơn con chuyển thành cancelled',
      )
    }

    // 8.8 BUYER TÁI SỬ DỤNG VOUCHER thành công ngay sau khi seller hủy đơn
    {
      const resReuseAfterSellerCancel = await requestHttp(backendUrl, '/api/v1/orders', {
        method: 'POST',
        headers: { Authorization: `Bearer ${tokenUser1}` },
        body: {
          recipientName: 'Người nhận Voucher',
          recipientPhone: '0988888888',
          province: 'Hà Nội',
          addressDetail: '99 Phố Test',
          items: [{ variantId: '1', qty: 3 }],
          voucherCode: 'NOVA20K',
        },
      })
      assert(
        resReuseAfterSellerCancel.status === 201,
        'Buyer áp dụng lại voucher thành công sau khi seller hủy đơn trả HTTP 201',
      )
      assert(
        resReuseAfterSellerCancel.body?.data?.voucherCode === 'NOVA20K',
        'Đơn mới nhận lại mã voucher NOVA20K',
      )

      // Dọn dẹp: Hủy luôn đơn tái sử dụng này để giải phóng voucher và kho
      const reuseId = resReuseAfterSellerCancel.body?.data?.id
      if (reuseId) {
        await requestHttp(backendUrl, `/api/v1/orders/${reuseId}/cancel`, {
          method: 'PATCH',
          headers: { Authorization: `Bearer ${tokenUser1}` },
          body: { reason: 'Dọn dẹp sau khi kiểm thử tự động hoàn tất' },
        })
      }
    }

    // 8.9 HAI SELLER HỦY ĐỒNG THỜI (CONCURRENT SELLER CANCELLATION)
    // Kiểm tra khóa đơn cha tuần tự hóa an toàn, không bị race condition, voucher hoàn đúng 1 lần
    {
      const resOrderMulti = await requestHttp(backendUrl, '/api/v1/orders', {
        method: 'POST',
        headers: { Authorization: `Bearer ${tokenUser1}` },
        body: {
          recipientName: 'Người nhận Đồng Thời',
          recipientPhone: '0988888888',
          province: 'Hà Nội',
          addressDetail: '99 Phố Test',
          items: [
            { variantId: '1', qty: 2 }, // Shop 1: 360k
            { variantId: '10', qty: 1 }, // Shop 2: 145k (tổng 505k >= 500k)
          ],
          voucherCode: 'NOVA20K',
        },
      })
      assert(resOrderMulti.status === 201, 'Đặt đơn 2 shop cho test hủy đồng thời trả HTTP 201')
      const shopOrdersList = resOrderMulti.body?.data?.shopOrders || []
      assert(shopOrdersList.length === 2, 'Đơn gồm đúng 2 shop con')

      const shopOrder1 = shopOrdersList.find((s) => Number(s.shopId) === 1)
      const shopOrder2 = shopOrdersList.find((s) => Number(s.shopId) === 2)
      assert(shopOrder1 && shopOrder2, 'Tìm thấy đủ 2 đơn con của Shop 1 và Shop 2')

      // Hai seller gửi request hủy đồng thời bằng Promise.all
      const [resCancel1, resCancel2] = await Promise.all([
        requestHttp(backendUrl, `/api/v1/seller/orders/${shopOrder1.id}/status`, {
          method: 'PATCH',
          headers: { Authorization: `Bearer ${tokenSellerShop1}` },
          body: {
            toStatus: 'cancelled',
            cancelReason: 'Seller 1 hủy do hết mẫu (đồng thời)',
          },
        }),
        requestHttp(backendUrl, `/api/v1/seller/orders/${shopOrder2.id}/status`, {
          method: 'PATCH',
          headers: { Authorization: `Bearer ${tokenSellerShop2}` },
          body: {
            toStatus: 'cancelled',
            cancelReason: 'Seller 2 hủy do lỗi kho (đồng thời)',
          },
        }),
      ])

      assert(resCancel1.status === 200, 'Seller 1 hủy đồng thời thành công trả HTTP 200')
      assert(resCancel2.status === 200, 'Seller 2 hủy đồng thời thành công trả HTTP 200')
      assert(resCancel1.body?.data?.toStatus === 'cancelled', 'Shop 1 chuyển trạng thái cancelled')
      assert(resCancel2.body?.data?.toStatus === 'cancelled', 'Shop 2 chuyển trạng thái cancelled')

      // Kiểm tra voucher đã được hoàn trả thành công sau khi cả 2 shop hủy đồng thời
      const resReuseAfterConcurrent = await requestHttp(backendUrl, '/api/v1/orders', {
        method: 'POST',
        headers: { Authorization: `Bearer ${tokenUser1}` },
        body: {
          recipientName: 'Người nhận Voucher',
          recipientPhone: '0988888888',
          province: 'Hà Nội',
          addressDetail: '99 Phố Test',
          items: [{ variantId: '1', qty: 3 }],
          voucherCode: 'NOVA20K',
        },
      })
      assert(
        resReuseAfterConcurrent.status === 201,
        'Buyer áp dụng lại voucher thành công sau khi 2 seller hủy đồng thời trả HTTP 201',
      )
      assert(
        resReuseAfterConcurrent.body?.data?.voucherCode === 'NOVA20K',
        'Đơn mới nhận lại mã voucher NOVA20K (không bị kẹt race condition)',
      )

      // Dọn dẹp: Hủy đơn này để hoàn trả tồn kho và voucher
      const finalOrderId = resReuseAfterConcurrent.body?.data?.id
      if (finalOrderId) {
        await requestHttp(backendUrl, `/api/v1/orders/${finalOrderId}/cancel`, {
          method: 'PATCH',
          headers: { Authorization: `Bearer ${tokenUser1}` },
          body: { reason: 'Dọn dẹp sau khi kiểm thử tự động hoàn tất' },
        })
      }
    }

  } finally {
    console.log('\n[Dọn dẹp] Đang tắt các server kiểm thử...')
    if (backendProc) backendProc.kill()
    if (dataProc) dataProc.kill()
  }

  console.log('\n=== TỔNG KẾT KIỂM THỬ ĐẶT HÀNG (BE-007 ORDER API) ===')
  console.log(`Số bài kiểm tra vượt qua (PASS): ${passed}`)
  console.log(`Số bài kiểm tra thất bại (FAIL): ${failed}`)

  if (failed > 0) {
    console.error('\n❌ Có bài kiểm tra không đạt!')
    process.exit(1)
  } else {
    console.log('\n🎉 Toàn bộ bài kiểm tra Order API đều ĐẠT (PASS)!')
    process.exit(0)
  }
}

run().catch((err) => {
  console.error('Lỗi ngoại lệ khi chạy test:', err)
  process.exit(1)
})
