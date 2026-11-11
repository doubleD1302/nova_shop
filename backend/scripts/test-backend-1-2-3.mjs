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
  console.log('=== BẮT ĐẦU KIỂM THỬ BACKEND MỤC 1 - 2 - 3 ===\n')

  const { dataApiServer, backendServer, backendUrl } = await startServers()
  const { closeDatabase, executeQuery } = await import('../../data-api/src/config/database.js')
  const { signAccessToken } = await import('../src/middlewares/auth.middleware.js')

  try {
    // Lấy thông tin tài khoản người dùng thực tế từ database
    const users = await executeQuery(`SELECT id, username, role, status FROM users WHERE status = 'active' ORDER BY id ASC`)
    const buyer = users.find((u) => u.role === 'buyer') || users[0]
    const admin = users.find((u) => u.role === 'admin') || { id: 30004, username: 'demo_admin_guest', role: 'admin' }

    // Lấy gian hàng active cùng chính xác tài khoản chủ shop
    const shopOwners = await executeQuery(
      `SELECT s.id AS shop_id, s.name AS shop_name, u.id AS user_id, u.username, u.role
       FROM shops s
       JOIN users u ON u.id = s.owner_id
       WHERE s.status = 'active' AND u.status = 'active'
       LIMIT 1`
    )
    assert(shopOwners.length > 0, 'Tìm thấy gian hàng đang hoạt động và chủ shop trong database')
    const testShop = { id: shopOwners[0].shop_id, name: shopOwners[0].shop_name }
    const seller = { id: shopOwners[0].user_id, username: shopOwners[0].username, role: shopOwners[0].role }

    const buyerToken = signAccessToken({ id: String(buyer.id), username: buyer.username, role: 'buyer' })
    const sellerToken = signAccessToken({ id: String(seller.id), username: seller.username, role: 'seller', shopId: String(testShop.id) })
    const adminToken = signAccessToken({ id: String(admin.id), username: admin.username, role: 'admin' })

    // ========================================================
    // PHẦN 1: KIỂM THỬ SELLER DASHBOARD API (MỤC 1)
    // ========================================================
    console.log('\n--- 1. KIỂM THỬ SELLER DASHBOARD API (MỤC 1) ---')

    // 1.1 Kiểm tra không có token -> 401
    const unauthRes = await fetch(`${backendUrl}/api/v1/seller/dashboard`)
    assert(unauthRes.status === 401, 'Không có token trả về 401 Unauthorized')

    // 1.2 Kiểm tra buyer gọi dashboard người bán -> 403 Forbidden
    const buyerDashRes = await fetch(`${backendUrl}/api/v1/seller/dashboard`, {
      headers: { Authorization: `Bearer ${buyerToken}` },
    })
    assert(buyerDashRes.status === 403, 'Buyer gọi dashboard người bán trả về 403 Forbidden')

    // 1.3 Seller gọi dashboard thành công -> 200
    const sellerDashRes = await fetch(`${backendUrl}/api/v1/seller/dashboard`, {
      headers: { Authorization: `Bearer ${sellerToken}` },
    })
    assert(sellerDashRes.status === 200, 'Seller gọi GET /api/v1/seller/dashboard trả về 200 OK')
    const dashBody = await sellerDashRes.json()
    assert(dashBody.success === true, 'Phản hồi dashboard có success: true')
    assert(dashBody.data?.shop?.id === String(testShop.id), 'Dashboard trả về đúng ID gian hàng')
    assert(typeof dashBody.data?.summary?.todayOrders === 'number', 'Summary chứa todayOrders')
    assert(typeof dashBody.data?.summary?.totalRevenue === 'number', 'Summary chứa totalRevenue')
    assert(typeof dashBody.data?.summary?.totalSold === 'number', 'Summary chứa totalSold')
    assert(typeof dashBody.data?.summary?.lowStockCount === 'number', 'Summary chứa lowStockCount')
    assert(typeof dashBody.data?.summary?.outOfStockCount === 'number', 'Summary chứa outOfStockCount')
    assert(typeof dashBody.data?.summary?.ordersByStatus?.pending === 'number', 'Summary chứa ordersByStatus.pending')
    assert(Array.isArray(dashBody.data?.chart), 'Dữ liệu biểu đồ chart là một mảng')
    assert(dashBody.data.chart.length === 7, 'Biểu đồ chứa đầy đủ dữ liệu 7 ngày gần nhất')
    assert(dashBody.data.chart[0]?.label && typeof dashBody.data.chart[0]?.revenue === 'number', 'Mỗi mốc biểu đồ có label và revenue')
    assert(Array.isArray(dashBody.data?.topProducts), 'Top sản phẩm bán chạy là một mảng')
    assert(Array.isArray(dashBody.data?.lowStockProducts), 'Danh sách sản phẩm sắp hết hàng là một mảng')
    assert(Array.isArray(dashBody.data?.recentOrders), 'Danh sách đơn hàng gần đây là một mảng')

    // ========================================================
    // PHẦN 2: KIỂM THỬ QUY TRÌNH TRẢ HÀNG & TRỌNG TÀI ADMIN (MỤC 2)
    // ========================================================
    console.log('\n--- 2. KIỂM THỬ QUY TRÌNH KHIẾU NẠI TRẢ HÀNG & TRỌNG TÀI ADMIN (MỤC 2) ---')

    // 2.1 Buyer tra cứu danh sách toàn bộ yêu cầu trả hàng của mình
    const buyerReturnsRes = await fetch(`${backendUrl}/api/v1/returns`, {
      headers: { Authorization: `Bearer ${buyerToken}` },
    })
    assert(buyerReturnsRes.status === 200, 'Buyer gọi GET /api/v1/returns trả về 200 OK')
    const buyerReturnsBody = await buyerReturnsRes.json()
    assert(buyerReturnsBody.success === true && Array.isArray(buyerReturnsBody.data), 'Danh sách yêu cầu trả hàng trả về mảng dữ liệu')

    // 2.2 Tìm đơn hàng con đã giao để kiểm tra luồng trả hàng
    const deliveredOrders = await executeQuery(
      `SELECT so.id, so.order_id, so.shop_id, so.total_amount, o.buyer_id, s.owner_id
       FROM shop_orders so
       JOIN orders o ON o.id = so.order_id
       JOIN shops s ON s.id = so.shop_id
       WHERE so.status = 'delivered'
       LIMIT 1`
    )

    let testShopOrderId
    let testOrderId
    let testBuyerToken = buyerToken
    let returnSellerToken = sellerToken

    if (deliveredOrders.length > 0) {
      testShopOrderId = deliveredOrders[0].id
      testOrderId = deliveredOrders[0].order_id
      const actualBuyer = users.find((u) => u.id === deliveredOrders[0].buyer_id) || buyer
      testBuyerToken = signAccessToken({ id: String(actualBuyer.id), username: actualBuyer.username, role: 'buyer' })

      const actualShopOwner = users.find((u) => u.id === deliveredOrders[0].owner_id) || seller
      returnSellerToken = signAccessToken({ id: String(actualShopOwner.id), username: actualShopOwner.username, role: 'seller', shopId: String(deliveredOrders[0].shop_id) })
    }

    if (testShopOrderId) {
      // Dọn dẹp yêu cầu trả hàng cũ nếu có cho đơn test này
      await executeQuery(`DELETE FROM order_returns WHERE shop_order_id = ?`, [testShopOrderId])

      // 2.3 Buyer tạo yêu cầu trả hàng
      const createReturnRes = await fetch(`${backendUrl}/api/v1/orders/${testOrderId}/returns`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${testBuyerToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          shopOrderId: testShopOrderId,
          reason: 'Sản phẩm lỗi không hoạt động',
          detail: 'Hàng nhận về bị trầy xước và không lên nguồn',
          images: ['https://shopnova.vn/evidence1.jpg'],
          refundAmount: 50000,
        }),
      })
      assert(createReturnRes.status === 201, 'Buyer tạo yêu cầu trả hàng thành công trả về 201 Created')
      const createReturnBody = await createReturnRes.json()
      const returnId = createReturnBody.data?.id
      assert(returnId, 'Nhận được mã returnId từ phản hồi tạo trả hàng')

      // 2.4 Kiểm tra Seller xem danh sách yêu cầu trả hàng
      const sellerReturnsRes = await fetch(`${backendUrl}/api/v1/seller/returns`, {
        headers: { Authorization: `Bearer ${returnSellerToken}` },
      })
      assert(sellerReturnsRes.status === 200, 'Seller xem danh sách trả hàng trả về 200 OK')

      // 2.5 Seller từ chối yêu cầu trả hàng
      const rejectReturnRes = await fetch(`${backendUrl}/api/v1/seller/returns/${returnId}/status`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${returnSellerToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status: 'rejected',
          sellerNote: 'Bao bì đã bị xé rách không còn nguyên vẹn tem bảo hành',
        }),
      })
      assert(rejectReturnRes.status === 200, 'Seller từ chối yêu cầu trả hàng trả về 200 OK')

      // 2.6 Buyer khiếu nại tranh chấp lên Admin
      const disputeRes = await fetch(`${backendUrl}/api/v1/returns/${returnId}/dispute`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${testBuyerToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          disputeReason: 'Shop từ chối vô lý, sản phẩm có video mở hộp chứng minh lỗi từ trước khi nhận',
        }),
      })
      assert(disputeRes.status === 200, 'Buyer gửi khiếu nại tranh chấp lên Admin trả về 200 OK')

      // 2.7 Admin xem danh sách yêu cầu trả hàng toàn sàn
      const adminReturnsRes = await fetch(`${backendUrl}/api/v1/admin/returns?status=disputed`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      })
      const adminReturnsText = await adminReturnsRes.text()
      if (adminReturnsRes.status !== 200) {
        console.log('adminReturnsRes ERROR:', adminReturnsRes.status, adminReturnsText)
      }
      assert(adminReturnsRes.status === 200, 'Admin lấy danh sách khiếu nại tranh chấp trả về 200 OK')
      const adminReturnsBody = JSON.parse(adminReturnsText)
      const foundDispute = adminReturnsBody.data?.find((r) => r.id === String(returnId))
      assert(foundDispute && foundDispute.status === 'disputed', 'Admin tìm thấy yêu cầu đang tranh chấp (disputed)')

      // 2.8 Trọng tài Admin phân xử chấp thuận hoàn tiền
      const resolveRes = await fetch(`${backendUrl}/api/v1/admin/returns/${returnId}/resolve`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${adminToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          resolution: 'approve',
          adminNote: 'Sau khi xem xét video mở hộp của người mua, sàn chấp thuận hoàn tiền cho khách.',
        }),
      })
      assert(resolveRes.status === 200, 'Admin phân xử chấp thuận hoàn tiền trả về 200 OK')
      const resolveBody = await resolveRes.json()
      assert(resolveBody.data?.status === 'completed', 'Trạng thái khiếu nại chuyển thành completed')

      // Dọn dẹp dữ liệu test return
      await executeQuery(`DELETE FROM order_returns WHERE id = ?`, [returnId])
    } else {
      console.log('  ⚠️ Bỏ qua bước tạo return do chưa có đơn hàng delivered trong DB')
    }

    // ========================================================
    // PHẦN 3: KIỂM THỬ TÀI KHOẢN NGÂN HÀNG, SỐ DƯ ESCROW & RÚT TIỀN (MỤC 3)
    // ========================================================
    console.log('\n--- 3. KIỂM THỬ TÀI KHOẢN NGÂN HÀNG, SỐ DƯ ESCROW & RÚT TIỀN (MỤC 3) ---')

    // 3.1 Seller xem số dư ví doanh thu và Escrow
    const balanceRes = await fetch(`${backendUrl}/api/v1/seller/payout/balance`, {
      headers: { Authorization: `Bearer ${sellerToken}` },
    })
    assert(balanceRes.status === 200, 'Seller xem số dư ví doanh thu trả về 200 OK')
    const balanceBody = await balanceRes.json()
    assert(balanceBody.success === true, 'Phản hồi số dư có success: true')
    assert(typeof balanceBody.data?.balance?.available === 'number', 'Có trường số dư khả dụng (available)')
    assert(typeof balanceBody.data?.balance?.pendingEscrow === 'number', 'Có trường số dư đang giữ Escrow (pendingEscrow)')
    assert(typeof balanceBody.data?.balance?.withdrawing === 'number', 'Có trường số dư đang rút (withdrawing)')
    assert(typeof balanceBody.data?.balance?.totalPaidOut === 'number', 'Có trường tổng tiền đã chi trả (totalPaidOut)')

    // 3.2 Seller liên kết tài khoản ngân hàng nhận tiền
    const saveBankRes = await fetch(`${backendUrl}/api/v1/seller/payout/bank-account`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${sellerToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        bankName: 'Ngân hàng TMCP Ngoại Thương Việt Nam (Vietcombank)',
        bankCode: 'VCB',
        accountNumber: '012345678912',
        accountHolder: 'NGUYEN VAN BAN HANG',
        branch: 'Chi nhánh Hà Nội',
      }),
    })
    assert(saveBankRes.status === 200, 'Seller liên kết tài khoản ngân hàng thành công trả về 200 OK')
    const saveBankBody = await saveBankRes.json()
    assert(saveBankBody.data?.bankCode === 'VCB', 'Mã ngân hàng được lưu chuẩn hóa VCB')
    assert(saveBankBody.data?.maskedAccountNumber?.includes('******'), 'Số tài khoản trả về được che bảo mật')

    // 3.3 Seller đọc lại thông tin tài khoản ngân hàng
    const getBankRes = await fetch(`${backendUrl}/api/v1/seller/payout/bank-account`, {
      headers: { Authorization: `Bearer ${sellerToken}` },
    })
    assert(getBankRes.status === 200, 'Seller đọc thông tin ngân hàng đã lưu trả về 200 OK')
    const getBankBody = await getBankRes.json()
    assert(getBankBody.data?.accountHolder === 'NGUYEN VAN BAN HANG', 'Tên chủ tài khoản khớp thông tin đã lưu')

    // 3.4 Tạo lệnh rút tiền với số tiền nhỏ hơn 50.000 VNĐ -> 400
    const invalidAmountRes = await fetch(`${backendUrl}/api/v1/seller/payout/request`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${sellerToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ amount: 20000 }),
    })
    assert(invalidAmountRes.status === 400, 'Rút tiền dưới 50.000 VNĐ bị từ chối với 400 Bad Request')

    // 3.5 Tạo lệnh rút tiền vượt quá số dư khả dụng -> 400 INSUFFICIENT_BALANCE
    const overBalanceRes = await fetch(`${backendUrl}/api/v1/seller/payout/request`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${sellerToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ amount: 9999999999 }),
    })
    assert(overBalanceRes.status === 400, 'Rút tiền vượt quá số dư bị từ chối với 400 Bad Request')
    const overBody = await overBalanceRes.json()
    assert(overBody.error?.code === 'INSUFFICIENT_BALANCE', 'Mã lỗi trả về là INSUFFICIENT_BALANCE')

    // 3.6 Tạo lệnh rút tiền hợp lệ (nếu có số dư) hoặc kiểm tra trực tiếp cơ chế duyệt của Admin
    // Giả lập 1 lệnh rút tiền trong CSDL để kiểm tra luồng Admin duyệt và hoàn tất
    const bankRecord = await executeQuery('SELECT id FROM seller_bank_accounts WHERE shop_id = ? LIMIT 1', [testShop.id])
    assert(bankRecord.length > 0, 'Tìm thấy tài khoản ngân hàng vừa tạo')

    const testPayoutCode = `PO-TEST-${Date.now()}`
    const insertPayoutRes = await executeQuery(
      `INSERT INTO seller_payout_requests (payout_code, shop_id, bank_account_id, amount, fee, net_amount, status)
       VALUES (?, ?, ?, 100000, 0, 100000, 'pending')`,
      [testPayoutCode, testShop.id, bankRecord[0].id]
    )
    const testPayoutId = insertPayoutRes.insertId

    // 3.7 Seller kiểm tra lịch sử rút tiền
    const historyRes = await fetch(`${backendUrl}/api/v1/seller/payout/history`, {
      headers: { Authorization: `Bearer ${sellerToken}` },
    })
    assert(historyRes.status === 200, 'Seller xem lịch sử rút tiền trả về 200 OK')
    const historyBody = await historyRes.json()
    assert(historyBody.data?.some((p) => p.payoutCode === testPayoutCode), 'Tìm thấy lệnh rút tiền trong lịch sử của seller')

    // 3.8 Admin xem danh sách yêu cầu rút tiền toàn hệ thống
    const adminPayoutsRes = await fetch(`${backendUrl}/api/v1/admin/payouts?status=pending`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    })
    assert(adminPayoutsRes.status === 200, 'Admin xem danh sách lệnh rút tiền trả về 200 OK')
    const adminPayoutsBody = await adminPayoutsRes.json()
    assert(adminPayoutsBody.data?.some((p) => p.payoutCode === testPayoutCode), 'Admin nhìn thấy lệnh rút tiền pending')

    // 3.9 Admin xác nhận hoàn tất chuyển khoản chi trả
    const approvePayoutRes = await fetch(`${backendUrl}/api/v1/admin/payouts/${testPayoutId}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        status: 'completed',
        transactionReference: 'FT261111009988',
        adminNote: 'Đã chuyển khoản qua Internet Banking Vietcombank thành công',
      }),
    })
    assert(approvePayoutRes.status === 200, 'Admin xác nhận hoàn tất chi trả trả về 200 OK')
    const approvePayoutBody = await approvePayoutRes.json()
    assert(approvePayoutBody.data?.status === 'completed', 'Trạng thái lệnh chi trả chuyển sang completed')
    assert(approvePayoutBody.data?.transactionReference === 'FT261111009988', 'Mã giao dịch ngân hàng được lưu chính xác')

    // Dọn dẹp bản ghi kiểm tra payout
    await executeQuery(`DELETE FROM seller_payout_requests WHERE id = ?`, [testPayoutId])

    console.log('\n🎉 TẤT CẢ CÁC BÀI KIỂM THỬ BACKEND MỤC 1 - 2 - 3 ĐỀU ĐẠT (100% PASS)!')
  } finally {
    await new Promise((resolve) => backendServer.close(resolve))
    await new Promise((resolve) => dataApiServer.close(resolve))
    await closeDatabase()
  }
}

run().catch((err) => {
  console.error('\n❌ KIỂM THỬ THẤT BẠI:', err)
  process.exit(1)
})
