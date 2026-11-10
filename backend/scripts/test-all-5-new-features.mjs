import path from 'node:path'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
// Nạp cấu hình từ data-api/.env trước khi import data-api modules
dotenv.config({ path: path.resolve(__dirname, '../../data-api/.env') })

import { createServer } from 'node:http'
import jwt from 'jsonwebtoken'
import { WebSocket } from 'ws'

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
    wsUrl: `ws://127.0.0.1:${backendPort}/ws/chat`,
  }
}

async function run() {
  console.log('=== BẮT ĐẦU KIỂM THỬ TÍCH HỢP TOÀN DIỆN CẢ 5 TÍNH NĂNG MỚI ===\n')

  const { dataApiServer, backendServer, backendUrl, wsUrl } = await startServers()
  const { closeDatabase, executeQuery } = await import('../../data-api/src/config/database.js')
  const { env } = await import('../src/config/env.js')
  const { signAccessToken } = await import('../src/middlewares/auth.middleware.js')

  try {
    // Chuẩn bị tài khoản test từ database thực tế
    const adminUser = { id: 30004, role: 'admin' }
    const sellerUser = { id: 30003, role: 'seller' }
    const buyerUser = { id: 30002, role: 'buyer' }
    const testShop = { id: 30002, owner_id: 30003 }

    const adminToken = signAccessToken(adminUser)
    const sellerToken = signAccessToken(sellerUser)
    const buyerToken = signAccessToken(buyerUser)

    // ==========================================
    // TÍNH NĂNG 1: Cài đặt hệ thống runtime (Admin)
    // ==========================================
    console.log('\n--- [1/5] Kiểm thử Cài đặt Hệ thống Runtime (Admin) ---')
    // 1.1 Public config
    const publicRes = await fetch(`${backendUrl}/api/v1/system/config`)
    const publicText = await publicRes.text()
    console.log('publicRes:', publicRes.status, publicText)
    const publicJson = JSON.parse(publicText)
    assert(publicRes.status === 200, 'GET /api/v1/system/config trả về HTTP 200')
    assert(publicJson.success === true, 'Public config success === true')
    assert(typeof publicJson.data.maintenanceMode === 'boolean', 'Có trường maintenanceMode (boolean)')
    assert(typeof publicJson.data.platformFee === 'number', 'Có trường platformFee (number)')

    // 1.2 Admin đọc settings
    const adminGetRes = await fetch(`${backendUrl}/api/v1/admin/settings`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    })
    const adminGetText = await adminGetRes.text()
    console.log('adminGetRes:', adminGetRes.status, adminGetText)
    const adminGetJson = JSON.parse(adminGetText)
    assert(adminGetRes.status === 200, 'GET /api/v1/admin/settings trả về HTTP 200')
    assert(adminGetJson.data.commissionRate !== undefined, 'Admin đọc được commissionRate')

    // 1.3 Admin cập nhật settings
    const adminPutRes = await fetch(`${backendUrl}/api/v1/admin/settings`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        maintenanceMode: false,
        commissionRate: 7.5,
        platformFee: 2000,
      }),
    })
    const adminPutJson = await adminPutRes.json()
    assert(adminPutRes.status === 200, 'PUT /api/v1/admin/settings cập nhật thành công (HTTP 200)')
    assert(adminPutJson.data.commissionRate === 7.5, 'Tỷ lệ hoa hồng đã cập nhật lên 7.5%')
    assert(adminPutJson.data.platformFee === 2000, 'Phí sàn đã cập nhật lên 2000 VND')

    // Hoàn lại giá trị chuẩn ban đầu
    await fetch(`${backendUrl}/api/v1/admin/settings`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ commissionRate: 5.0, platformFee: 1000 }),
    })
    console.log('  ✓ Đã hoàn lại cấu hình chuẩn ban đầu (5.0%, 1000 VND)')

    // ==========================================
    // TÍNH NĂNG 2: Mã giảm giá gian hàng (Seller Vouchers)
    // ==========================================
    console.log('\n--- [2/5] Kiểm thử Mã giảm giá gian hàng (Seller Vouchers) ---')
    const testCode = `TEST${Date.now().toString().slice(-6)}`
    const createVoucherRes = await fetch(`${backendUrl}/api/v1/seller/vouchers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${sellerToken}`,
      },
      body: JSON.stringify({
        code: testCode,
        name: 'Giảm giá tri ân khách hàng',
        discountAmount: 25000,
        minSubtotal: 100000,
        startsAt: new Date().toISOString(),
        endsAt: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString(),
      }),
    })
    const createVoucherJson = await createVoucherRes.json()
    assert(createVoucherRes.status === 201, `POST /api/v1/seller/vouchers tạo voucher thành công (HTTP 201)`)
    assert(createVoucherJson.data.code === testCode, `Mã voucher đúng là ${testCode}`)
    assert(createVoucherJson.data.discountAmount === 25000, 'Mức giảm đúng 25.000 VND')
    const voucherId = createVoucherJson.data.id

    // Lấy danh sách voucher của shop
    const listVoucherRes = await fetch(`${backendUrl}/api/v1/seller/vouchers`, {
      headers: { Authorization: `Bearer ${sellerToken}` },
    })
    const listVoucherJson = await listVoucherRes.json()
    assert(listVoucherRes.status === 200, 'GET /api/v1/seller/vouchers trả về HTTP 200')
    const found = listVoucherJson.data.items.find((v) => v.id === voucherId)
    assert(Boolean(found), 'Voucher vừa tạo xuất hiện trong danh sách của gian hàng')

    // Bật / tắt voucher
    const toggleRes = await fetch(`${backendUrl}/api/v1/seller/vouchers/${voucherId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${sellerToken}`,
      },
      body: JSON.stringify({ isActive: false }),
    })
    const toggleJson = await toggleRes.json()
    assert(toggleRes.status === 200, 'PATCH /api/v1/seller/vouchers/:id/status đổi trạng thái thành công')
    assert(toggleJson.data.isActive === false, 'Voucher đã được tắt hoạt động')

    // Xóa voucher test
    const delRes = await fetch(`${backendUrl}/api/v1/seller/vouchers/${voucherId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${sellerToken}` },
    })
    assert(delRes.status === 200, 'DELETE /api/v1/seller/vouchers/:id xóa voucher thành công')

    // ==========================================
    // TÍNH NĂNG 3: Quảng cáo & Flash Sale (Marketing Campaigns & Boost)
    // ==========================================
    console.log('\n--- [3/5] Kiểm thử Quảng cáo & Flash Sale (Marketing Campaigns) ---')
    // Danh sách chiến dịch
    const campaignsRes = await fetch(`${backendUrl}/api/v1/seller/marketing/campaigns`, {
      headers: { Authorization: `Bearer ${sellerToken}` },
    })
    const campaignsJson = await campaignsRes.json()
    assert(campaignsRes.status === 200, 'GET /api/v1/seller/marketing/campaigns trả về HTTP 200')
    assert(Array.isArray(campaignsJson.data.items) && campaignsJson.data.items.length > 0, 'Có ít nhất 1 chiến dịch marketing đang mở')
    const camp = campaignsJson.data.items[0]

    // Tìm 1 sản phẩm của shop
    const prodRows = await executeQuery(
      "SELECT id FROM products WHERE shop_id = ? AND status = 'active' AND approval_status = 'approved' LIMIT 1",
      [testShop.id]
    )
    if (prodRows.length) {
      const prodId = prodRows[0].id

      // Đăng ký sản phẩm vào chiến dịch
      const regRes = await fetch(`${backendUrl}/api/v1/seller/marketing/campaigns/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sellerToken}`,
        },
        body: JSON.stringify({
          campaignId: camp.id,
          productId: prodId,
          discountPrice: 99000,
          note: 'Cam kết giảm sâu Flash Sale',
        }),
      })
      // Trả 201 hoặc 409 nếu đã từng đăng ký trước đó
      assert([201, 409].includes(regRes.status), `POST /api/v1/seller/marketing/campaigns/register trả về ${regRes.status}`)

      // Danh sách đăng ký của shop
      const regListRes = await fetch(`${backendUrl}/api/v1/seller/marketing/registrations`, {
        headers: { Authorization: `Bearer ${sellerToken}` },
      })
      const regListJson = await regListRes.json()
      assert(regListRes.status === 200, 'GET /api/v1/seller/marketing/registrations trả về HTTP 200')
      assert(Array.isArray(regListJson.data.items), 'Đọc được danh sách đăng ký chiến dịch của shop')

      // Mua gói đẩy sản phẩm (Boost)
      const boostRes = await fetch(`${backendUrl}/api/v1/seller/marketing/boost`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sellerToken}`,
        },
        body: JSON.stringify({
          productId: prodId,
          packageType: 'basic_1d',
        }),
      })
      const boostJson = await boostRes.json()
      assert(boostRes.status === 201, 'POST /api/v1/seller/marketing/boost kích hoạt gói đẩy thành công (HTTP 201)')
      assert(boostJson.data.packageType === 'basic_1d', 'Đúng gói đẩy basic_1d')
      assert(boostJson.data.status === 'active', 'Trạng thái đẩy đang hoạt động (active)')

      // Danh sách gói đẩy
      const boostListRes = await fetch(`${backendUrl}/api/v1/seller/marketing/boosts`, {
        headers: { Authorization: `Bearer ${sellerToken}` },
      })
      const boostListJson = await boostListRes.json()
      assert(boostListRes.status === 200, 'GET /api/v1/seller/marketing/boosts trả về HTTP 200')
      assert(boostListJson.data.items.length > 0, 'Shop có bản ghi gói đẩy sản phẩm')
    } else {
      console.log('  ⚠️ Shop chưa có sản phẩm approved, bỏ qua bước đăng ký sản phẩm chi tiết')
    }

    // ==========================================
    // TÍNH NĂNG 4: Báo cáo & Thống kê nâng cao (Xuất Excel)
    // ==========================================
    console.log('\n--- [4/5] Kiểm thử Báo cáo & Xuất Excel (Doanh thu & Đối soát kho) ---')
    // 4.1 Báo cáo doanh thu JSON
    const revRes = await fetch(`${backendUrl}/api/v1/seller/reports/revenue`, {
      headers: { Authorization: `Bearer ${sellerToken}` },
    })
    const revJson = await revRes.json()
    assert(revRes.status === 200, 'GET /api/v1/seller/reports/revenue trả về HTTP 200')
    assert(revJson.data.summary !== undefined, 'Báo cáo doanh thu có phần summary')

    // 4.2 Xuất Excel doanh thu
    const revExcelRes = await fetch(`${backendUrl}/api/v1/seller/reports/revenue/export`, {
      headers: { Authorization: `Bearer ${sellerToken}` },
    })
    assert(revExcelRes.status === 200, 'GET /api/v1/seller/reports/revenue/export trả về HTTP 200')
    assert(
      revExcelRes.headers.get('content-type').includes('spreadsheetml.sheet'),
      'Content-Type là file Excel (.xlsx chuẩn)'
    )
    const revExcelBuffer = await revExcelRes.arrayBuffer()
    assert(revExcelBuffer.byteLength > 1000, `File Excel doanh thu được tạo thành công (${revExcelBuffer.byteLength} bytes)`)

    // 4.3 Báo cáo đối soát kho JSON
    const invRes = await fetch(`${backendUrl}/api/v1/seller/reports/inventory`, {
      headers: { Authorization: `Bearer ${sellerToken}` },
    })
    const invJson = await invRes.json()
    assert(invRes.status === 200, 'GET /api/v1/seller/reports/inventory trả về HTTP 200')
    assert(invJson.data.summary !== undefined, 'Báo cáo đối soát kho có phần summary')

    // 4.4 Xuất Excel đối soát kho
    const invExcelRes = await fetch(`${backendUrl}/api/v1/seller/reports/inventory/export`, {
      headers: { Authorization: `Bearer ${sellerToken}` },
    })
    assert(invExcelRes.status === 200, 'GET /api/v1/seller/reports/inventory/export trả về HTTP 200')
    assert(
      invExcelRes.headers.get('content-type').includes('spreadsheetml.sheet'),
      'Content-Type đối soát kho là file Excel (.xlsx chuẩn)'
    )
    const invExcelBuffer = await invExcelRes.arrayBuffer()
    assert(invExcelBuffer.byteLength > 1000, `File Excel đối soát kho được tạo thành công (${invExcelBuffer.byteLength} bytes)`)

    // ==========================================
    // TÍNH NĂNG 5: Chăm sóc khách hàng (WebSocket Live Chat)
    // ==========================================
    console.log('\n--- [5/5] Kiểm thử WebSocket Live Chat hai chiều Realtime ---')
    // 5.1 Tạo một cuộc hội thoại chat giữa buyer và shop
    const convRows = await executeQuery(
      'SELECT id FROM chat_conversations WHERE buyer_id = ? AND shop_id = ? LIMIT 1',
      [buyerUser.id, testShop.id]
    )
    let testConvId
    if (convRows.length) {
      testConvId = convRows[0].id
    } else {
      const insConv = await executeQuery(
        'INSERT INTO chat_conversations (buyer_id, shop_id, last_message, last_message_at) VALUES (?, ?, ?, NOW())',
        [buyerUser.id, testShop.id, 'Xin chào shop']
      )
      testConvId = insConv.insertId
    }

    // 5.2 Kết nối WebSocket Người Mua
    const buyerWs = new WebSocket(`${wsUrl}?token=${buyerToken}`)
    await new Promise((resolve, reject) => {
      buyerWs.on('open', resolve)
      buyerWs.on('error', reject)
    })
    assert(buyerWs.readyState === WebSocket.OPEN, 'Người mua kết nối thành công tới WebSocket /ws/chat')

    // 5.3 Kết nối WebSocket Người Bán
    const sellerWs = new WebSocket(`${wsUrl}?token=${sellerToken}`)
    await new Promise((resolve, reject) => {
      sellerWs.on('open', resolve)
      sellerWs.on('error', reject)
    })
    assert(sellerWs.readyState === WebSocket.OPEN, 'Người bán kết nối thành công tới WebSocket /ws/chat')

    // 5.4 Lắng nghe tin nhắn realtime từ seller
    const sellerReceivedPromise = new Promise((resolve) => {
      sellerWs.on('message', (data) => {
        const msg = JSON.parse(data.toString())
        if (msg.type === 'new_message') {
          resolve(msg)
        }
      })
    })

    // 5.5 Người mua gửi tin nhắn qua WebSocket
    const testMsgText = `Tin nhắn kiểm thử WebSocket lúc ${new Date().toISOString()}`
    buyerWs.send(JSON.stringify({
      type: 'send_message',
      conversationId: String(testConvId),
      message: testMsgText,
    }))

    // 5.6 Chờ người bán nhận tin nhắn realtime
    const received = await Promise.race([
      sellerReceivedPromise,
      new Promise((_, reject) => setTimeout(() => reject(new Error('WebSocket timeout: Người bán không nhận được tin nhắn sau 5s')), 5000)),
    ])
    assert(received.type === 'new_message', 'Người bán đã nhận được sự kiện new_message qua WebSocket')
    assert(received.message.message === testMsgText, 'Nội dung tin nhắn người bán nhận khớp chính xác 100%')

    // Đóng socket
    buyerWs.close()
    sellerWs.close()
    console.log('  ✓ Đã đóng kết nối WebSocket an toàn')

    console.log('\n===============================================================')
    console.log('🎉 TẤT CẢ 5 TÍNH NĂNG MỚI ĐÃ VƯỢT QUA KIỂM THỬ THÀNH CÔNG 100%!')
    console.log('===============================================================')
  } finally {
    backendServer.close()
    dataApiServer.close()
    await closeDatabase()
  }
}

run().catch((err) => {
  console.error('\n❌ KIỂM THỬ THẤT BẠI:', err)
  process.exit(1)
})
