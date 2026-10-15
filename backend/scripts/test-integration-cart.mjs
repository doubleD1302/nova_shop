import http from 'node:http'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import jwt from 'jsonwebtoken'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '..')
const dataApiRootDir = path.resolve(rootDir, '../data-api')

const TEST_JWT_SECRET = 'test_integration_cart_jwt_secret_min_32_characters_12345'
const TEST_SERVICE_KEY = 'test_integration_cart_service_key_64_characters_entropy_secret_key'

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

  let json = null
  try {
    json = await res.json()
  } catch {}

  return { status: res.status, json }
}

async function run() {
  console.log('=== BẮT ĐẦU KIỂM THỬ TÍCH HỢP GIỎ HÀNG (BE-006 CART API) ===\n')

  const dataApiPort = await getAvailablePort()
  const backendPort = await getAvailablePort()

  console.log(`[Khởi động] Data API cổng: ${dataApiPort}`)
  console.log(`[Khởi động] Backend cổng: ${backendPort}`)

  let dataApiProc
  let backendProc

  try {
    dataApiProc = await startProcess('Data API', dataApiRootDir, {
      NODE_ENV: 'test',
      HOST: '127.0.0.1',
      PORT: String(dataApiPort),
      DATA_API_KEY: TEST_SERVICE_KEY,
    })

    backendProc = await startProcess('Backend', rootDir, {
      NODE_ENV: 'test',
      PORT: String(backendPort),
      DATA_API_URL: `http://127.0.0.1:${dataApiPort}`,
      DATA_API_KEY: TEST_SERVICE_KEY,
      JWT_SECRET: TEST_JWT_SECRET,
    })

    const backendUrl = `http://127.0.0.1:${backendPort}`

    // Chờ backend sẵn sàng
    for (let i = 0; i < 20; i++) {
      try {
        const { status } = await requestHttp(backendUrl, '/api/v1/health')
        if (status === 200) break
      } catch {}
      await new Promise((r) => setTimeout(r, 200))
    }

    // Tạo JWT token test cho 2 người dùng khác nhau để kiểm tra phân quyền sở hữu
    const buyerToken1 = jwt.sign(
      {
        sub: '1',
        role: 'buyer',
      },
      TEST_JWT_SECRET,
      {
        algorithm: 'HS256',
        expiresIn: 900,
        issuer: 'shopnova-backend',
        audience: 'shopnova-clients',
      }
    )

    const buyerToken2 = jwt.sign(
      {
        sub: '2',
        role: 'seller',
      },
      TEST_JWT_SECRET,
      {
        algorithm: 'HS256',
        expiresIn: 900,
        issuer: 'shopnova-backend',
        audience: 'shopnova-clients',
      }
    )

    const authHeaders1 = { Authorization: `Bearer ${buyerToken1}` }
    const authHeaders2 = { Authorization: `Bearer ${buyerToken2}` }

    console.log('--- 1. Kiểm tra xác thực (Authentication Required) ---')
    {
      const { status, json } = await requestHttp(backendUrl, '/api/v1/cart')
      assert(status === 401, 'GET /api/v1/cart không có token trả HTTP 401')
      assert(json.error?.code === 'AUTH_REQUIRED', 'Mã lỗi là AUTH_REQUIRED khi thiếu token')
    }

    console.log('\n--- 2. Làm sạch giỏ hàng ban đầu ---')
    {
      await requestHttp(backendUrl, '/api/v1/cart/items', {
        method: 'DELETE',
        headers: authHeaders1,
        body: { clearAll: true },
      })
      const { status, json } = await requestHttp(backendUrl, '/api/v1/cart', { headers: authHeaders1 })
      assert(status === 200, 'GET /api/v1/cart trả HTTP 200 khi giỏ rỗng')
      assert(json.data?.items?.length === 0, 'Giỏ hàng ban đầu rỗng (0 items)')
      assert(json.data?.summary?.totalItems === 0, 'Tổng số lượng sản phẩm bằng 0')
    }

    console.log('\n--- 3. Thêm sản phẩm vào giỏ (Validation & Success) ---')
    let createdItemId
    {
      // 3.1. Thiếu hoặc sai variantId
      const badReq1 = await requestHttp(backendUrl, '/api/v1/cart/items', {
        method: 'POST',
        headers: authHeaders1,
        body: { variantId: 'invalid-id', qty: 1 },
      })
      assert(badReq1.status === 400, 'variantId không phải số nguyên trả HTTP 400')
      assert(badReq1.json.error?.code === 'VALIDATION_ERROR', 'Mã lỗi là VALIDATION_ERROR')

      // 3.2. Sai số lượng (qty = 0 hoặc 100)
      const badReq2 = await requestHttp(backendUrl, '/api/v1/cart/items', {
        method: 'POST',
        headers: authHeaders1,
        body: { variantId: '1', qty: 0 },
      })
      assert(badReq2.status === 400, 'qty = 0 trả HTTP 400')

      const badReq3 = await requestHttp(backendUrl, '/api/v1/cart/items', {
        method: 'POST',
        headers: authHeaders1,
        body: { variantId: '1', qty: 100 },
      })
      assert(badReq3.status === 400, 'qty = 100 vượt quá 99 trả HTTP 400')

      // 3.3. Variant không tồn tại (999999)
      const notFoundReq = await requestHttp(backendUrl, '/api/v1/cart/items', {
        method: 'POST',
        headers: authHeaders1,
        body: { variantId: '999999', qty: 1 },
      })
      assert(notFoundReq.status === 404, 'variantId không tồn tại trả HTTP 404')
      assert(notFoundReq.json.error?.code === 'VARIANT_NOT_FOUND', 'Mã lỗi là VARIANT_NOT_FOUND')

      // 3.4. Thêm SKU hợp lệ (variantId = "1")
      const addRes = await requestHttp(backendUrl, '/api/v1/cart/items', {
        method: 'POST',
        headers: authHeaders1,
        body: { variantId: '1', qty: 2 },
      })
      assert(addRes.status === 201, 'Thêm SKU hợp lệ trả HTTP 201')
      assert(addRes.json.success === true, 'Envelope success === true')
      assert(typeof addRes.json.data?.itemId === 'string', 'Trả về itemId dạng chuỗi')
      assert(addRes.json.data?.qty === 2, 'Số lượng đã thêm là 2')
      createdItemId = addRes.json.data?.itemId

      // 3.5. Thêm tiếp cùng SKU đó -> số lượng tự cộng dồn (2 + 1 = 3)
      const addAgainRes = await requestHttp(backendUrl, '/api/v1/cart/items', {
        method: 'POST',
        headers: authHeaders1,
        body: { variantId: '1', qty: 1 },
      })
      assert(addAgainRes.status === 201, 'Thêm tiếp cùng SKU trả HTTP 201')
      assert(addAgainRes.json.data?.qty === 3, 'Số lượng tự cộng dồn thành 3')
    }

    console.log('\n--- 4. Đọc giỏ hàng và kiểm tra nhóm shop, summary ---')
    {
      const { status, json } = await requestHttp(backendUrl, '/api/v1/cart', { headers: authHeaders1 })
      assert(status === 200, 'GET /api/v1/cart trả HTTP 200')
      assert(json.data?.items?.length === 1, 'Danh sách items chứa đúng 1 sản phẩm')

      const item = json.data.items[0]
      assert(item.id === createdItemId, 'ID dòng giỏ khớp với itemId vừa tạo')
      assert(item.qty === 3, 'Số lượng item là 3')
      assert(typeof item.price === 'number' && item.price > 0, 'Giá sản phẩm là kiểu số nguyên dương')
      assert(typeof item.name === 'string' && item.name.length > 0, 'Có tên sản phẩm')
      assert(typeof item.shopName === 'string', 'Có thông tin tên shop')

      assert(Array.isArray(json.data?.groups), 'groups là một mảng')
      assert(json.data.groups.length === 1, 'Có đúng 1 nhóm shop')
      assert(json.data.groups[0].items?.length === 1, 'Nhóm shop chứa 1 sản phẩm')

      const summary = json.data?.summary
      assert(summary?.totalItems === 3, 'summary.totalItems tính đúng bằng 3')
      assert(summary?.selectedCount === 3, 'summary.selectedCount tính đúng bằng 3')
      assert(summary?.subtotal === item.price * 3, 'summary.subtotal tính đúng bằng price * 3')
    }

    console.log('\n--- 5. Cập nhật số lượng và trạng thái chọn (PATCH) ---')
    {
      // 5.1. Cập nhật số lượng thành 5
      const patchQty = await requestHttp(backendUrl, `/api/v1/cart/items/${createdItemId}`, {
        method: 'PATCH',
        headers: authHeaders1,
        body: { qty: 5 },
      })
      assert(patchQty.status === 200, 'PATCH số lượng thành 5 trả HTTP 200')
      assert(patchQty.json.data?.qty === 5, 'Dữ liệu trả về có qty === 5')

      // 5.2. Bỏ chọn sản phẩm (selected = false)
      const patchSelect = await requestHttp(backendUrl, `/api/v1/cart/items/${createdItemId}`, {
        method: 'PATCH',
        headers: authHeaders1,
        body: { selected: false },
      })
      assert(patchSelect.status === 200, 'PATCH selected: false trả HTTP 200')
      assert(patchSelect.json.data?.selected === false, 'Dữ liệu trả về có selected === false')

      // 5.3. Kiểm tra summary sau khi bỏ chọn
      const { json } = await requestHttp(backendUrl, '/api/v1/cart', { headers: authHeaders1 })
      assert(json.data?.summary?.selectedCount === 0, 'Khi bỏ chọn, selectedCount giảm về 0')
      assert(json.data?.summary?.subtotal === 0, 'Khi bỏ chọn, subtotal giảm về 0')
    }

    console.log('\n--- 6. Kiểm tra an toàn phân quyền (User cô lập) ---')
    {
      // User 2 không thể sửa giỏ hàng của User 1
      const patchOther = await requestHttp(backendUrl, `/api/v1/cart/items/${createdItemId}`, {
        method: 'PATCH',
        headers: authHeaders2,
        body: { qty: 10 },
      })
      assert(patchOther.status === 404, 'User 2 cố sửa item của User 1 bị trả HTTP 404')
      assert(patchOther.json.error?.code === 'CART_ITEM_NOT_FOUND', 'Mã lỗi là CART_ITEM_NOT_FOUND')

      // User 2 không thể xóa item của User 1
      const deleteOther = await requestHttp(backendUrl, `/api/v1/cart/items/${createdItemId}`, {
        method: 'DELETE',
        headers: authHeaders2,
      })
      assert(deleteOther.status === 404, 'User 2 cố xóa item của User 1 bị trả HTTP 404')
    }

    console.log('\n--- 7. Xóa sản phẩm khỏi giỏ hàng (DELETE) ---')
    {
      const delRes = await requestHttp(backendUrl, `/api/v1/cart/items/${createdItemId}`, {
        method: 'DELETE',
        headers: authHeaders1,
      })
      assert(delRes.status === 200, 'Xóa item hợp lệ trả HTTP 200')

      // Kiểm tra giỏ hàng sau khi xóa
      const { json } = await requestHttp(backendUrl, '/api/v1/cart', { headers: authHeaders1 })
      assert(json.data?.items?.length === 0, 'Giỏ hàng đã rỗng sau khi xóa item')

      // Xóa lại item đã xóa -> 404
      const delAgain = await requestHttp(backendUrl, `/api/v1/cart/items/${createdItemId}`, {
        method: 'DELETE',
        headers: authHeaders1,
      })
      assert(delAgain.status === 404, 'Xóa lại item đã xóa trả HTTP 404')
    }
  } finally {
    console.log('\n[Dọn dẹp] Đang tắt các server kiểm thử...')
    if (backendProc) backendProc.kill('SIGTERM')
    if (dataApiProc) dataApiProc.kill('SIGTERM')
  }

  console.log('\n=== TỔNG KẾT KIỂM THỬ GIỎ HÀNG (BE-006 CART API) ===')
  console.log(`Số bài kiểm tra vượt qua (PASS): ${passed}`)
  console.log(`Số bài kiểm tra thất bại (FAIL): ${failed}`)

  if (failed > 0) {
    process.exit(1)
  } else {
    console.log('\n🎉 Toàn bộ bài kiểm tra Cart API đều ĐẠT (PASS)!')
  }
}

run().catch((err) => {
  console.error('Lỗi kiểm thử:', err)
  process.exit(1)
})
