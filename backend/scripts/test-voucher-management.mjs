import path from 'node:path'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.resolve(__dirname, '../../data-api/.env') })

import { createServer } from 'node:http'

function assert(cond, msg) {
  if (!cond) {
    console.error(`❌ THẤT BẠI: ${msg}`)
    throw new Error(msg)
  }
  console.log(`  ✓ PASS: ${msg}`)
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
  const { signAccessToken } = await import('../src/middlewares/auth.middleware.js')
  const backendServer = createServer(backendApp)
  await new Promise((resolve) => backendServer.listen(0, '127.0.0.1', resolve))
  const backendPort = backendServer.address().port

  return {
    dataApiServer,
    backendServer,
    backendUrl: `http://127.0.0.1:${backendPort}`,
    signAccessToken,
  }
}

async function run() {
  console.log('=== KIỂM THỬ QUẢN LÝ VOUCHER TOÀN SÀN (ADMIN) & VOUCHER GIAN HÀNG (SELLER) ===\n')

  const { dataApiServer, backendServer, backendUrl, signAccessToken } = await startServers()
  const { executeQuery } = await import('../../data-api/src/config/database.js')

  const [buyerRow] = await executeQuery("SELECT id FROM users WHERE role = 'buyer' AND status = 'active' LIMIT 1")
  const [sellerRow] = await executeQuery("SELECT u.id, s.id AS shop_id FROM users u JOIN shops s ON s.owner_id = u.id WHERE u.role = 'seller' AND u.status = 'active' LIMIT 1")
  const [adminRow] = await executeQuery("SELECT id FROM users WHERE role = 'admin' AND status = 'active' LIMIT 1")

  const adminToken = signAccessToken({ id: adminRow.id, role: 'admin' })
  const sellerToken = signAccessToken({ id: sellerRow.id, role: 'seller' })
  const buyerToken = signAccessToken({ id: buyerRow.id, role: 'buyer' })

  try {
    // -------------------------------------------------------------
    // 1. Phân quyền truy cập (Role Enforcement)
    // -------------------------------------------------------------
    console.log('--- [1/3] Kiểm tra phân quyền truy cập ---')
    const buyerAdminRes = await fetch(`${backendUrl}/api/v1/admin/vouchers`, {
      headers: { Authorization: `Bearer ${buyerToken}` },
    })
    assert(buyerAdminRes.status === 403, 'Người mua (Buyer) không thể truy cập GET /api/v1/admin/vouchers (HTTP 403)')

    const buyerSellerRes = await fetch(`${backendUrl}/api/v1/seller/vouchers`, {
      headers: { Authorization: `Bearer ${buyerToken}` },
    })
    assert(buyerSellerRes.status === 403, 'Người mua (Buyer) không thể truy cập GET /api/v1/seller/vouchers (HTTP 403)')

    // -------------------------------------------------------------
    // 2. Quản lý Voucher Toàn Sàn (Admin Vouchers)
    // -------------------------------------------------------------
    console.log('\n--- [2/3] Quản lý Voucher Toàn Sàn (Admin Vouchers) ---')
    const adminListRes = await fetch(`${backendUrl}/api/v1/admin/vouchers`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    })
    assert(adminListRes.status === 200, 'Admin lấy danh sách voucher toàn sàn thành công (HTTP 200)')
    const adminListData = await adminListRes.json()
    assert(adminListData.success === true, 'Phản hồi danh sách voucher có success === true')
    assert(Array.isArray(adminListData.data.vouchers), 'Dữ liệu trả về mảng data.vouchers')

    // Admin tạo voucher toàn sàn mới
    const testAdminCode = `ADM${Date.now().toString().slice(-6)}`
    const createAdminRes = await fetch(`${backendUrl}/api/v1/admin/vouchers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        code: testAdminCode,
        name: 'Đại Tiệc Siêu Sale Toàn Sàn ShopNova',
        discountAmount: 50000,
        minSubtotal: 300000,
        startsAt: new Date().toISOString(),
        endsAt: new Date(Date.now() + 30 * 86400000).toISOString(),
        usageLimit: 1000,
        perUserLimit: 2,
      }),
    })
    assert(createAdminRes.status === 201, 'Admin tạo voucher toàn sàn thành công (HTTP 201)')
    const createAdminJson = await createAdminRes.json()
    assert(createAdminJson.success === true, 'Phản hồi tạo voucher có success === true')
    const adminVoucherId = createAdminJson.data.id || createAdminJson.data.data?.id
    assert(Boolean(adminVoucherId), `Đã nhận ID voucher mới: ${adminVoucherId}`)

    // Admin cập nhật trạng thái Bật / Tắt voucher
    const patchAdminRes = await fetch(`${backendUrl}/api/v1/admin/vouchers/${adminVoucherId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ isActive: false, status: 'inactive' }),
    })
    assert(patchAdminRes.status === 200, 'Admin cập nhật trạng thái voucher toàn sàn thành công (HTTP 200)')
    const patchAdminJson = await patchAdminRes.json()
    assert(patchAdminJson.data?.isActive === false || patchAdminJson.success === true, 'Voucher đã được chuyển sang trạng thái tắt/tạm dừng')

    // Admin xóa voucher toàn sàn
    const delAdminRes = await fetch(`${backendUrl}/api/v1/admin/vouchers/${adminVoucherId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${adminToken}` },
    })
    assert(delAdminRes.status === 200, 'Admin xóa voucher toàn sàn thành công (HTTP 200)')

    // -------------------------------------------------------------
    // 3. Quản lý Voucher Gian Hàng (Seller Vouchers)
    // -------------------------------------------------------------
    console.log('\n--- [3/3] Quản lý Voucher Gian Hàng (Seller Vouchers) ---')
    const testSellerCode = `SHOP${Date.now().toString().slice(-6)}`
    const createSellerRes = await fetch(`${backendUrl}/api/v1/seller/vouchers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${sellerToken}`,
      },
      body: JSON.stringify({
        code: testSellerCode,
        name: 'Mã Giảm Giá Bạn Mới - Gian Hàng AURA',
        discountAmount: 20000,
        minSubtotal: 150000,
        startsAt: new Date().toISOString(),
        endsAt: new Date(Date.now() + 14 * 86400000).toISOString(),
        usageLimit: 200,
        perUserLimit: 1,
      }),
    })
    assert(createSellerRes.status === 201, 'Người bán tạo voucher cho gian hàng thành công (HTTP 201)')
    const createSellerJson = await createSellerRes.json()
    const sellerVoucherId = createSellerJson.data?.id
    assert(Boolean(sellerVoucherId), `Đã nhận ID voucher của shop: ${sellerVoucherId}`)

    // Seller lấy danh sách voucher của shop
    const listSellerRes = await fetch(`${backendUrl}/api/v1/seller/vouchers`, {
      headers: { Authorization: `Bearer ${sellerToken}` },
    })
    assert(listSellerRes.status === 200, 'Người bán lấy danh sách voucher của shop thành công (HTTP 200)')
    const listSellerJson = await listSellerRes.json()
    const foundVoucher = listSellerJson.data?.items?.find((v) => v.id === String(sellerVoucherId))
    assert(Boolean(foundVoucher), 'Voucher của shop vừa tạo xuất hiện đúng trong danh sách')

    // Seller bật/tắt voucher
    const patchSellerRes = await fetch(`${backendUrl}/api/v1/seller/vouchers/${sellerVoucherId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${sellerToken}`,
      },
      body: JSON.stringify({ isActive: false }),
    })
    assert(patchSellerRes.status === 200, 'Người bán cập nhật trạng thái voucher của shop thành công (HTTP 200)')

    // Seller xóa voucher
    const delSellerRes = await fetch(`${backendUrl}/api/v1/seller/vouchers/${sellerVoucherId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${sellerToken}` },
    })
    assert(delSellerRes.status === 200, 'Người bán xóa voucher của shop thành công (HTTP 200)')

    console.log('\n🎉 TẤT CẢ CÁC BÀI KIỂM THỬ QUẢN LÝ VOUCHER ĐỀU ĐẠT (100% PASS)!')
  } finally {
    await new Promise((resolve) => backendServer.close(resolve))
    await new Promise((resolve) => dataApiServer.close(resolve))
  }
}

run().catch((err) => {
  console.error('\n❌ KIỂM THỬ THẤT BẠI:', err)
  process.exit(1)
})
