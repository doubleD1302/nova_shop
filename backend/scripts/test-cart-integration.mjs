import http from 'node:http'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

process.env.NODE_ENV = 'test'
process.env.PORT = '3000'
process.env.DOTENV_CONFIG_PATH = path.resolve(__dirname, '../../data-api/.env')

// 1. Nạp cấu hình Data API trước
const { env: dataEnv } = await import('../../data-api/src/config/env.js')
const { default: dataApiApp } = await import('../../data-api/src/app.js')
const { executeQuery, sequelize } = await import('../../data-api/src/config/database.js')

// 2. Khởi động Data API test server trên port ngẫu nhiên
const dataApiServer = http.createServer(dataApiApp)
await new Promise((resolve, reject) => {
  dataApiServer.listen(0, '127.0.0.1', () => resolve())
  dataApiServer.on('error', reject)
})
const dataApiPort = dataApiServer.address().port
const dataApiUrl = `http://127.0.0.1:${dataApiPort}`

// 3. Thiết lập biến môi trường Backend khớp với Data API đang chạy
process.env.DATA_API_URL = dataApiUrl
process.env.DATA_API_KEY = dataEnv.dataApiKey
process.env.JWT_SECRET = 'cart_test_jwt_secret_valid_min_32_characters_here'

// 4. Nạp Backend App và Auth
const { default: backendApp } = await import('../src/app.js')
const { signAccessToken } = await import('../src/middlewares/auth.middleware.js')

let passed = 0
let failed = 0

function assert(condition, testName, detail = '') {
  if (condition) {
    console.log(`  ✓ PASS: ${testName}`)
    passed++
  } else {
    console.error(`  ✗ FAIL: ${testName} ${detail ? `(${detail})` : ''}`)
    failed++
  }
}

async function runCartIntegrationTests() {
  console.log('=== BẮT ĐẦU KIỂM THỬ TÍCH HỢP GIỎ HÀNG (BE-006: SERVER-SIDE CART) ===\n')
  console.log(`[Test] Data API đang chạy trên: ${dataApiUrl}`)

  // Khởi động Backend test server trên port ngẫu nhiên
  const backendServer = http.createServer(backendApp)
  await new Promise((resolve, reject) => {
    backendServer.listen(0, '127.0.0.1', () => resolve())
    backendServer.on('error', reject)
  })
  const backendPort = backendServer.address().port
  const backendUrl = `http://127.0.0.1:${backendPort}`
  console.log(`[Test] Backend đang chạy trên: ${backendUrl}\n`)

  const testUserId = '1'
  const token = signAccessToken({ id: testUserId, role: 'buyer' })

  try {
    // -------------------------------------------------------------
    // Test Group 1: Bảo mật xác thực (Authentication Enforcement)
    // -------------------------------------------------------------
    console.log('--- 1. Kiểm tra bảo mật xác thực người dùng ---')

    {
      const res = await fetch(`${backendUrl}/api/v1/cart`)
      const data = await res.json()
      assert(res.status === 401, 'GET /api/v1/cart không có token trả HTTP 401')
      assert(data.error?.code === 'AUTH_REQUIRED', 'Mã lỗi là AUTH_REQUIRED khi thiếu token')
    }

    {
      const res = await fetch(`${backendUrl}/api/v1/cart/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ variantId: '1', qty: 1 }),
      })
      const data = await res.json()
      assert(res.status === 401, 'POST /api/v1/cart/items không có token trả HTTP 401')
      assert(data.error?.code === 'AUTH_REQUIRED', 'Mã lỗi POST là AUTH_REQUIRED')
    }

    {
      const res = await fetch(`${backendUrl}/api/v1/cart/items/1`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ qty: 2 }),
      })
      const data = await res.json()
      assert(res.status === 401, 'PATCH /api/v1/cart/items/1 không có token trả HTTP 401')
      assert(data.error?.code === 'AUTH_REQUIRED', 'Mã lỗi PATCH là AUTH_REQUIRED')
    }

    {
      const res = await fetch(`${backendUrl}/api/v1/cart/items/1`, {
        method: 'DELETE',
      })
      const data = await res.json()
      assert(res.status === 401, 'DELETE /api/v1/cart/items/1 không có token trả HTTP 401')
      assert(data.error?.code === 'AUTH_REQUIRED', 'Mã lỗi DELETE là AUTH_REQUIRED')
    }

    // -------------------------------------------------------------
    // Test Group 2: Thẩm định dữ liệu đầu vào (Input Validation)
    // -------------------------------------------------------------
    console.log('\n--- 2. Kiểm tra thẩm định dữ liệu đầu vào ---')

    {
      const res = await fetch(`${backendUrl}/api/v1/cart/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ variantId: '1', qty: 0 }),
      })
      const data = await res.json()
      assert(res.status === 400, 'POST /api/v1/cart/items với qty = 0 trả HTTP 400')
      assert(data.error?.code === 'VALIDATION_ERROR', 'Mã lỗi là VALIDATION_ERROR khi qty < 1')
    }

    {
      const res = await fetch(`${backendUrl}/api/v1/cart/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ variantId: '1', qty: 100 }),
      })
      const data = await res.json()
      assert(res.status === 400, 'POST /api/v1/cart/items với qty > 99 trả HTTP 400')
      assert(data.error?.code === 'VALIDATION_ERROR', 'Mã lỗi là VALIDATION_ERROR khi qty > 99')
    }

    {
      const res = await fetch(`${backendUrl}/api/v1/cart/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ variantId: '999999999', qty: 1 }),
      })
      const data = await res.json()
      assert(res.status === 404, 'POST /api/v1/cart/items với SKU không tồn tại trả HTTP 404')
      assert(data.error?.code === 'SKU_NOT_FOUND', 'Mã lỗi là SKU_NOT_FOUND')
    }

    // -------------------------------------------------------------
    // Test Group 3: Nghiệp vụ giỏ hàng (Full CRUD & Multi-shop)
    // -------------------------------------------------------------
    console.log('\n--- 3. Kiểm tra nghiệp vụ đồng bộ giỏ hàng (CRUD & Multi-shop) ---')

    // Dọn dẹp giỏ hàng trước khi test
    await fetch(`${backendUrl}/api/v1/cart/items`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    })

    // 3.1. Đọc giỏ hàng ban đầu (trống)
    {
      const res = await fetch(`${backendUrl}/api/v1/cart`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      assert(res.status === 200, 'GET /api/v1/cart trả HTTP 200')
      assert(data.success === true, 'GET giỏ hàng thành công')
      assert(Array.isArray(data.data?.items), 'data.items là mảng')
      assert(data.data?.items.length === 0, 'Giỏ hàng ban đầu trống')
      assert(data.data?.summary?.total === 0, 'Tổng tiền ban đầu là 0')
    }

    // 3.2. Thêm sản phẩm 1 (SKU 1) vào giỏ hàng
    {
      const res = await fetch(`${backendUrl}/api/v1/cart/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ variantId: '1', qty: 2 }),
      })
      const data = await res.json()
      assert(res.status === 201, 'POST /api/v1/cart/items trả HTTP 201')
      assert(data.success === true, 'Thêm sản phẩm thành công')
      assert(data.data?.items?.length === 1, 'Giỏ hàng có 1 mặt hàng')
      const item = data.data?.items[0]
      assert(item.variantId === '1', 'Mã variantId đúng là 1')
      assert(item.qty === 2, 'Số lượng đúng là 2')
      assert(item.price === 180000, 'Giá đúng 180,000 VND')
      assert(item.selected === true, 'Mặc định item được chọn')
      assert(data.data?.summary?.subtotal === 360000, 'Tạm tính đúng 360,000 VND (180,000 * 2)')
    }

    // 3.3. Thêm tiếp cùng SKU 1 để kiểm tra gộp số lượng tự động
    {
      const res = await fetch(`${backendUrl}/api/v1/cart/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ variantId: '1', qty: 1 }),
      })
      const data = await res.json()
      assert(res.status === 201, 'Gộp cùng SKU trả HTTP 201')
      assert(data.data?.items?.length === 1, 'Vẫn là 1 dòng SKU trong giỏ')
      assert(data.data?.items[0].qty === 3, 'Số lượng được gộp lên 3 (2 + 1)')
      assert(data.data?.summary?.subtotal === 540000, 'Tạm tính đúng 540,000 VND')
      assert(data.data?.summary?.voucher === 20000, 'Áp dụng voucher 20,000 VND khi subtotal >= 500,000 VND')
    }

    // 3.4. Thêm sản phẩm từ Shop khác (SKU 3 - Củ sạc mẫu, shop 2) để test Multi-shop
    {
      const res = await fetch(`${backendUrl}/api/v1/cart/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ variantId: '3', qty: 1 }),
      })
      const data = await res.json()
      assert(res.status === 201, 'Thêm SKU từ Shop thứ 2 trả HTTP 201')
      assert(data.data?.items?.length === 2, 'Giỏ hàng có 2 mặt hàng')
      assert(data.data?.groups?.length === 2, 'Giỏ hàng tự động phân nhóm thành 2 Shop độc lập')
      assert(data.data?.summary?.shopCount === 2, 'Số lượng shop có mặt hàng được chọn là 2')
    }

    // 3.5. Cập nhật số lượng qua PATCH /api/v1/cart/items/:itemId
    {
      const res = await fetch(`${backendUrl}/api/v1/cart/items/1`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ qty: 4 }),
      })
      const data = await res.json()
      assert(res.status === 200, 'PATCH /api/v1/cart/items/1 cập nhật số lượng trả HTTP 200')
      const item1 = data.data?.items.find((i) => i.variantId === '1')
      assert(item1.qty === 4, 'Số lượng SKU 1 được cập nhật thành 4')
    }

    // 3.6. Bỏ chọn một mặt hàng
    {
      const res = await fetch(`${backendUrl}/api/v1/cart/items/1`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ selected: false }),
      })
      const data = await res.json()
      assert(res.status === 200, 'Bỏ chọn mặt hàng trả HTTP 200')
      const item1 = data.data?.items.find((i) => i.variantId === '1')
      assert(item1.selected === false, 'Mặt hàng có selected === false')
      // Chỉ còn SKU 3 được chọn
      assert(data.data?.summary?.selectedCount === 1, 'Chỉ còn 1 sản phẩm được chọn')
    }

    // 3.7. Chọn lại toàn bộ qua PATCH /api/v1/cart/selection
    {
      const res = await fetch(`${backendUrl}/api/v1/cart/selection`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ selected: true }),
      })
      const data = await res.json()
      assert(res.status === 200, 'PATCH /api/v1/cart/selection trả HTTP 200')
      assert(data.data?.items.every((i) => i.selected === true), 'Toàn bộ mặt hàng đã được chọn lại')
    }

    // 3.8. Xóa 1 mặt hàng qua DELETE /api/v1/cart/items/:itemId
    {
      const res = await fetch(`${backendUrl}/api/v1/cart/items/3`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      assert(res.status === 200, 'DELETE /api/v1/cart/items/3 trả HTTP 200')
      assert(data.data?.items?.length === 1, 'Giỏ hàng còn lại 1 mặt hàng sau khi xóa')
      assert(!data.data?.items.some((i) => i.variantId === '3'), 'Mặt hàng SKU 3 không còn trong giỏ')
    }

    // 3.9. Kiểm tra đồng bộ từ guest local cart qua POST /api/v1/cart/sync
    {
      const guestItemsToSync = [
        { variantId: '2', qty: 2, selected: true }, // Áo thun Size L
        { variantId: '3', qty: 1, selected: true }, // Củ sạc mẫu
      ]
      const res = await fetch(`${backendUrl}/api/v1/cart/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ items: guestItemsToSync }),
      })
      const data = await res.json()
      assert(res.status === 200, 'POST /api/v1/cart/sync trả HTTP 200')
      assert(data.success === true, 'Đồng bộ giỏ hàng thành công')
      assert(data.data?.items?.length === 3, 'Giỏ hàng có đủ 3 mặt hàng sau khi đồng bộ')
    }

    // 3.10. Xóa các mặt hàng được chọn qua DELETE /api/v1/cart/items?selected=true
    {
      const res = await fetch(`${backendUrl}/api/v1/cart/items?selected=true`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      assert(res.status === 200, 'DELETE /api/v1/cart/items?selected=true trả HTTP 200')
      assert(data.data?.items?.length === 0, 'Các mặt hàng được chọn đã được dọn sạch')
    }

    // 3.11. Dọn sạch toàn bộ giỏ hàng
    {
      const res = await fetch(`${backendUrl}/api/v1/cart/items`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      assert(res.status === 200, 'DELETE /api/v1/cart/items trả HTTP 200')
      assert(data.data?.items?.length === 0, 'Giỏ hàng hoàn toàn trống')
    }

  } finally {
    // Đóng server kiểm thử và kết nối an toàn
    backendServer.close()
    dataApiServer.close()
    await sequelize.close()
  }

  console.log('\n=== TỔNG KẾT KẾT QUẢ KIỂM THỬ GIỎ HÀNG (BE-006) ===')
  console.log(`Số test vượt qua (PASS): ${passed}`)
  console.log(`Số test thất bại (FAIL): ${failed}`)

  if (failed > 0) {
    process.exit(1)
  }
}

runCartIntegrationTests().catch((err) => {
  console.error('Lỗi khi chạy integration test:', err)
  process.exit(1)
})
