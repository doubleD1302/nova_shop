import assert from 'node:assert/strict'

const base = (process.env.DEMO_TEST_BASE_URL || 'http://127.0.0.1:3000').replace(/\/$/, '')

async function request(path, status = 200, token = '', body, method = body ? 'POST' : 'GET') {
  const response = await fetch(`${base}/api/v1${path}`, {
    method,
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(15000),
  })
  const data = await response.json()
  assert.equal(response.status, status, `${path}: ${data.error?.code || 'HTTP không đúng'}`)
  return { response, data: data.data }
}

await request('/ready')
const { response, data } = await request('/auth/demo-accounts')
assert.equal(response.headers.get('cache-control'), 'no-store')
assert.deepEqual(data.accounts.map((account) => account.role).sort(), ['admin', 'buyer', 'seller'])
console.log('PASS: readiness và 3 gợi ý demo được xác minh qua Data API.')

for (const account of data.accounts) {
  const login = await request('/auth/login', 200, '', { username: account.username, password: account.password })
  const session = login.data
  try {
    assert.equal(session.user.role, account.role)
    const me = await request('/auth/me', 200, session.token)
    assert.equal(me.data.user.username, account.username)
    if (account.role === 'buyer') {
      for (const path of ['/cart', '/orders', '/vouchers/wallet']) await request(path, 200, session.token)
      await request('/admin/users', 403, session.token)
      await request('/seller/shop', 403, session.token)
    } else if (account.role === 'seller') {
      for (const path of ['/seller/shop', '/seller/products', '/seller/orders']) await request(path, 200, session.token)
      await request('/admin/users', 403, session.token)
    } else {
      for (const resource of ['stats', 'users', 'shops', 'products', 'orders', 'reviews', 'reports']) {
        await request(`/admin/${resource}`, 200, session.token)
      }
    }
    assert(session.refreshToken, 'Cần lưu được phiên đăng nhập trong TiDB.')
    const refreshed = await request('/auth/refresh', 200, '', { refreshToken: session.refreshToken })
    assert.equal(refreshed.data.user.role, account.role)
    session.refreshToken = refreshed.data.refreshToken
    console.log(`PASS: ${account.role} đăng nhập, đọc dữ liệu, kiểm tra quyền và làm mới phiên.`)
  } finally {
    if (session.refreshToken) await request('/auth/logout', 200, '', { refreshToken: session.refreshToken })
  }
}
console.log('Hoàn tất kiểm tra demo trên database thật; không ghi mật khẩu/token ra log.')
