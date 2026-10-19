import http from 'node:http'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import jwt from 'jsonwebtoken'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '..')
const dataApiRootDir = path.resolve(rootDir, '../data-api')

const TEST_JWT_SECRET = 'test_integration_seller_product_jwt_secret_min_32_characters_12345'
const TEST_SERVICE_KEY = 'test_integration_seller_product_service_key_64_characters_entropy_secret_key'

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

function generateToken(userId, role = 'seller') {
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

async function requestJson(url, options = {}) {
  const { method = 'GET', headers = {}, body } = options
  const res = await fetch(url, {
    method,
    headers: {
      'content-type': 'application/json',
      ...headers,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })

  let data = null
  try {
    data = await res.json()
  } catch {
    // Không phải JSON
  }

  return { status: res.status, data }
}

async function run() {
  console.log('--- KHỞI ĐỘNG INTEGRATION TEST CHO SELLER PRODUCTS (BE-005) ---')

  const dataApiPort = await getAvailablePort()
  const backendPort = await getAvailablePort()

  console.log(`Port Data API: ${dataApiPort}, Port Backend: ${backendPort}`)

  const dataApiProc = await startProcess('Data API', dataApiRootDir, {
    DATA_API_PORT: String(dataApiPort),
    DATA_API_SERVICE_KEY: TEST_SERVICE_KEY,
  })

  const backendProc = await startProcess('Backend', rootDir, {
    PORT: String(backendPort),
    DATA_API_BASE_URL: `http://127.0.0.1:${dataApiPort}`,
    DATA_API_SERVICE_KEY: TEST_SERVICE_KEY,
    JWT_SECRET: TEST_JWT_SECRET,
  })

  const baseUrl = `http://127.0.0.1:${backendPort}/api/v1`

  try {
    await new Promise((r) => setTimeout(r, 1000))

    // 1. Phân quyền truy cập
    console.log('\n[TEST 1] Phân quyền truy cập GET /api/v1/seller/products')
    const resNoAuth = await requestJson(`${baseUrl}/seller/products`)
    assert(resNoAuth.status === 401, 'GET /seller/products không kèm token trả 401 AUTH_REQUIRED')

    // Buyer token (userId = 1 là demo_buyer)
    const buyerToken = generateToken('1', 'buyer')
    const resBuyerForbidden = await requestJson(`${baseUrl}/seller/products`, {
      headers: { Authorization: `Bearer ${buyerToken}` },
    })
    assert(resBuyerForbidden.status === 403, 'GET /seller/products với buyer token trả 403 FORBIDDEN')

    // Seller token (userId = 2 là demo_seller_a, sở hữu shop 1)
    const sellerToken = generateToken('2', 'seller')
    const sellerHeaders = { Authorization: `Bearer ${sellerToken}` }

    const resSellerProducts = await requestJson(`${baseUrl}/seller/products`, {
      headers: sellerHeaders,
    })
    assert(resSellerProducts.status === 200, 'GET /seller/products với seller token trả 200 OK')
    assert(resSellerProducts.data?.success === true, 'Response trả success = true')
    assert(Array.isArray(resSellerProducts.data?.data), 'data là một mảng danh sách sản phẩm')

    // 2. Tạo sản phẩm mới
    console.log('\n[TEST 2] Tạo sản phẩm mới qua POST /api/v1/seller/products')
    // Thử tạo thiếu thông tin
    const resInvalidCreate = await requestJson(`${baseUrl}/seller/products`, {
      method: 'POST',
      headers: sellerHeaders,
      body: { name: 'Sản phẩm lỗi' },
    })
    assert(resInvalidCreate.status === 400, 'Tạo sản phẩm thiếu danh mục và SKU trả 400 VALIDATION_ERROR')

    // Tạo sản phẩm hợp lệ
    const newProductData = {
      name: `Sản phẩm mẫu Test ${Date.now()}`,
      categoryId: '1',
      description: 'Mô tả chi tiết sản phẩm phục vụ bài kiểm thử tích hợp',
      specs: { 'Chất liệu': 'Cotton 100%', 'Xuất xứ': 'Việt Nam' },
      freeShipping: true,
      isFlashSale: false,
      isFeatured: true,
      images: [
        'https://cdn.shopnova.vn/products/test-image-1.jpg',
        'https://cdn.shopnova.vn/products/test-image-2.jpg',
      ],
      variants: [
        {
          sku: `SKU-TEST-${Date.now()}-S`,
          variantKey: 'size=S',
          name: 'Size S',
          attributes: { size: 'S' },
          price: 150000,
          originalPrice: 200000,
          stockQty: 50,
        },
        {
          sku: `SKU-TEST-${Date.now()}-M`,
          variantKey: 'size=M',
          name: 'Size M',
          attributes: { size: 'M' },
          price: 160000,
          originalPrice: 220000,
          stockQty: 30,
        },
      ],
    }

    const resCreate = await requestJson(`${baseUrl}/seller/products`, {
      method: 'POST',
      headers: sellerHeaders,
      body: newProductData,
    })
    assert(resCreate.status === 201, 'POST /seller/products hợp lệ trả 201 CREATED')
    assert(resCreate.data?.success === true, 'Response trả success = true')
    const createdProductId = resCreate.data?.data?.id
    assert(Boolean(createdProductId), `Đã tạo sản phẩm id = ${createdProductId}`)

    // 3. Kiểm tra sản phẩm vừa tạo trong danh sách của seller
    console.log('\n[TEST 3] Kiểm tra sản phẩm vừa tạo trong danh sách')
    const resProductsAfter = await requestJson(`${baseUrl}/seller/products`, {
      headers: sellerHeaders,
    })
    assert(resProductsAfter.status === 200, 'Đọc lại danh sách sản phẩm trả 200 OK')
    const foundProd = resProductsAfter.data?.data?.find(
      (p) => String(p.id) === String(createdProductId),
    )
    assert(Boolean(foundProd), 'Tìm thấy sản phẩm vừa tạo trong danh sách của shop')
    assert(foundProd?.freeShipping === true, 'Cờ freeShipping được lưu đúng')
    assert(foundProd?.totalStock === 80, 'Tổng tồn kho 50 + 30 = 80')

    // 4. Cập nhật sản phẩm
    console.log('\n[TEST 4] Cập nhật thông tin sản phẩm qua PUT /api/v1/seller/products/:id')
    if (createdProductId) {
      const resUpdate = await requestJson(`${baseUrl}/seller/products/${createdProductId}`, {
        method: 'PUT',
        headers: sellerHeaders,
        body: {
          name: 'Tên sản phẩm đã cập nhật',
          description: 'Mô tả mới sau khi cập nhật',
          freeShipping: false,
        },
      })
      assert(resUpdate.status === 200, 'PUT /seller/products/:id trả 200 OK')
      assert(resUpdate.data?.data?.updated === true, 'updated = true')
    }

    // 5. Xóa (lưu trữ) sản phẩm
    console.log('\n[TEST 5] Xóa (lưu trữ) sản phẩm qua DELETE /api/v1/seller/products/:id')
    if (createdProductId) {
      const resDelete = await requestJson(`${baseUrl}/seller/products/${createdProductId}`, {
        method: 'DELETE',
        headers: sellerHeaders,
      })
      assert(resDelete.status === 200, 'DELETE /seller/products/:id trả 200 OK')
      assert(resDelete.data?.data?.archived === true, 'archived = true')

      // Kiểm tra khi lọc active không còn thấy sản phẩm này
      const resActiveOnly = await requestJson(`${baseUrl}/seller/products?status=active`, {
        headers: sellerHeaders,
      })
      const stillActive = resActiveOnly.data?.data?.some(
        (p) => String(p.id) === String(createdProductId),
      )
      assert(stillActive === false, 'Sản phẩm đã được gỡ khỏi danh sách active')
    }
  } catch (err) {
    console.error('Lỗi khi chạy integration test seller product:', err)
    failed++
  } finally {
    console.log('\nDọn dẹp và dừng các tiến trình test...')
    dataApiProc.kill('SIGKILL')
    backendProc.kill('SIGKILL')
  }

  console.log(`\n--- KẾT QUẢ TEST SELLER PRODUCTS: ${passed} PASS, ${failed} FAIL ---`)
  if (failed > 0) {
    process.exit(1)
  }
}

run()
