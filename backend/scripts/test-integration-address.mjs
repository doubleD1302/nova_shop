import http from 'node:http'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import jwt from 'jsonwebtoken'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '..')
const dataApiRootDir = path.resolve(rootDir, '../data-api')

const TEST_JWT_SECRET = 'test_integration_address_jwt_secret_min_32_characters_12345'
const TEST_SERVICE_KEY = 'test_integration_address_service_key_64_characters_entropy_secret_key'

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
  console.log('=== BẮT ĐẦU KIỂM THỬ TÍCH HỢP HỒ SƠ & SỔ ĐỊA CHỈ (BE-003B) ===\n')

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
    const token = generateToken('1')

    // 1. Kiểm tra cập nhật Profile
    console.log('\n--- 1. Kiểm tra cập nhật Profile (PUT /api/v1/auth/profile) ---')
    {
      const resNoAuth = await requestHttp(backendUrl, '/api/v1/auth/profile', {
        method: 'PUT',
        body: { fullName: 'Tên Mới' },
      })
      assert(resNoAuth.status === 401, 'PUT /api/v1/auth/profile thiếu token trả HTTP 401')
      assert(resNoAuth.body?.error?.code === 'AUTH_REQUIRED', 'Mã lỗi là AUTH_REQUIRED')

      const resUpdate = await requestHttp(backendUrl, '/api/v1/auth/profile', {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` },
        body: { fullName: 'Nguyễn Văn Đã Cập Nhật', phone: '0988776655' },
      })
      assert(resUpdate.status === 200, 'Cập nhật profile thành công trả HTTP 200')
      assert(resUpdate.body?.data?.user?.fullName === 'Nguyễn Văn Đã Cập Nhật', 'Họ tên được cập nhật')
      assert(resUpdate.body?.data?.user?.phone === '0988776655', 'Số điện thoại được cập nhật')
    }

    // 2. Kiểm tra thêm địa chỉ (POST /api/v1/addresses)
    console.log('\n--- 2. Kiểm tra thêm địa chỉ (POST /api/v1/addresses) ---')
    let addrId1 = null
    let addrId2 = null
    {
      // Thêm địa chỉ 1
      const resAdd1 = await requestHttp(backendUrl, '/api/v1/addresses', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: {
          recipientName: 'Người Nhận 1',
          phone: '0901112222',
          province: 'TP. Hồ Chí Minh',
          district: 'Quận 1',
          ward: 'Phường Bến Nghé',
          detail: '456 Lê Duẩn',
          isDefault: true,
        },
      })
      assert(resAdd1.status === 201, 'Thêm địa chỉ 1 trả HTTP 201')
      assert(typeof resAdd1.body?.data?.id === 'string', 'ID địa chỉ dạng chuỗi')
      assert(resAdd1.body?.data?.isDefault === true, 'Địa chỉ 1 có isDefault === true')
      addrId1 = resAdd1.body?.data?.id

      // Thêm địa chỉ 2 làm mặc định mới
      const resAdd2 = await requestHttp(backendUrl, '/api/v1/addresses', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: {
          recipientName: 'Người Nhận 2',
          phone: '0903334444',
          province: 'Hà Nội',
          district: 'Quận Hoàn Kiếm',
          ward: 'Phường Hàng Bạc',
          detail: '789 Phố Cổ',
          isDefault: true,
        },
      })
      assert(resAdd2.status === 201, 'Thêm địa chỉ 2 trả HTTP 201')
      assert(resAdd2.body?.data?.isDefault === true, 'Địa chỉ 2 được set mặc định')
      addrId2 = resAdd2.body?.data?.id
    }

    // 3. Kiểm tra danh sách địa chỉ (GET /api/v1/addresses)
    console.log('\n--- 3. Kiểm tra danh sách địa chỉ (GET /api/v1/addresses) ---')
    {
      const resList = await requestHttp(backendUrl, '/api/v1/addresses', {
        headers: { Authorization: `Bearer ${token}` },
      })
      assert(resList.status === 200, 'GET /api/v1/addresses trả HTTP 200')
      assert(Array.isArray(resList.body?.data), 'data là một mảng')
      assert(resList.body?.data.length >= 2, 'Có ít nhất 2 địa chỉ')

      // Địa chỉ 2 là mặc định nên phải đứng đầu
      assert(resList.body?.data[0]?.id === addrId2, 'Địa chỉ 2 đứng đầu danh sách')
      assert(resList.body?.data[0]?.isDefault === true, 'Địa chỉ 2 là mặc định')
      assert(resList.body?.data[1]?.isDefault === false, 'Địa chỉ 1 không còn là mặc định')
    }

    // 4. Kiểm tra đặt địa chỉ mặc định (PATCH /api/v1/addresses/:id/default)
    console.log('\n--- 4. Kiểm tra đặt lại địa chỉ mặc định ---')
    {
      const resDefault = await requestHttp(backendUrl, `/api/v1/addresses/${addrId1}/default`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
      })
      assert(resDefault.status === 200, 'Đặt lại địa chỉ 1 làm mặc định trả HTTP 200')
      assert(resDefault.body?.data?.isDefault === true, 'Địa chỉ 1 chuyển thành isDefault === true')
    }

    // 5. Kiểm tra xóa địa chỉ (DELETE /api/v1/addresses/:id)
    console.log('\n--- 5. Kiểm tra xóa địa chỉ (DELETE /api/v1/addresses/:id) ---')
    {
      const resDel = await requestHttp(backendUrl, `/api/v1/addresses/${addrId2}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      assert(resDel.status === 200, 'Xóa địa chỉ 2 trả HTTP 200')
      assert(resDel.body?.data?.deleted === true, 'Trả về deleted === true')

      // Kiểm tra lại danh sách: địa chỉ 2 không còn xuất hiện
      const resCheck = await requestHttp(backendUrl, '/api/v1/addresses', {
        headers: { Authorization: `Bearer ${token}` },
      })
      assert(!resCheck.body?.data.some((a) => a.id === addrId2), 'Địa chỉ 2 đã biến mất khỏi danh sách')
    }

  } finally {
    console.log('\n[Dọn dẹp] Đang tắt các server kiểm thử...')
    if (backendProc) backendProc.kill()
    if (dataProc) dataProc.kill()
  }

  console.log('\n=== TỔNG KẾT KIỂM THỬ HỒ SƠ & SỔ ĐỊA CHỈ (BE-003B) ===')
  console.log(`Số bài kiểm tra vượt qua (PASS): ${passed}`)
  console.log(`Số bài kiểm tra thất bại (FAIL): ${failed}`)

  if (failed > 0) {
    console.error('\n❌ Có bài kiểm tra không đạt!')
    process.exit(1)
  } else {
    console.log('\n🎉 Toàn bộ bài kiểm tra Hồ sơ & Địa chỉ đều ĐẠT (PASS)!')
    process.exit(0)
  }
}

run().catch((err) => {
  console.error('Lỗi ngoại lệ khi chạy test:', err)
  process.exit(1)
})
