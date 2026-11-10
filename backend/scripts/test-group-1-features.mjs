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
  console.log('=== BẮT ĐẦU KIỂM THỬ 7 MỤC TƯƠNG THÍCH NHÓM 1 ===\n')

  const { dataApiServer, backendServer, backendUrl } = await startServers()
  const { closeDatabase, executeQuery } = await import('../../data-api/src/config/database.js')
  const { signAccessToken } = await import('../src/middlewares/auth.middleware.js')

  try {
    // 1. Tìm tài khoản buyer và seller thực tế từ database
    const users = await executeQuery(`SELECT id, username, role, status FROM users WHERE status = 'active' ORDER BY id ASC LIMIT 10`)
    const buyer = users.find((u) => u.role === 'buyer') || users[0]
    const seller = users.find((u) => u.role === 'seller') || users[1] || users[0]

    const buyerToken = signAccessToken({ id: String(buyer.id), username: buyer.username, role: buyer.role })
    const sellerToken = signAccessToken({ id: String(seller.id), username: seller.username, role: seller.role })

    // Tìm 1 sản phẩm và 1 shop đang hoạt động
    const products = await executeQuery(`SELECT id, shop_id, name, slug FROM products WHERE status = 'active' LIMIT 1`)
    assert(products.length > 0, 'Tìm thấy sản phẩm active trong database')
    const testProduct = products[0]

    const shops = await executeQuery(`SELECT id, name, slug FROM shops WHERE status = 'active' LIMIT 1`)
    assert(shops.length > 0, 'Tìm thấy shop active trong database')
    const testShop = shops[0]

    // ----------------------------------------------------
    // MỤC 1: API SẢN PHẨM YÊU THÍCH (FAVORITES)
    // ----------------------------------------------------
    console.log('\n--- 1. Kiểm thử API Sản phẩm yêu thích (Favorites) ---')
    // 1.1. Chưa đăng nhập -> 401
    const unauthFavRes = await fetch(`${backendUrl}/api/v1/favorites`)
    assert(unauthFavRes.status === 401, 'GET /api/v1/favorites không có token trả về 401')

    // 1.2. Thêm vào yêu thích
    const addFavRes = await fetch(`${backendUrl}/api/v1/favorites/${testProduct.id}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${buyerToken}` },
    })
    const addFavData = await addFavRes.json()
    assert(addFavRes.status === 200 && addFavData.success === true, 'POST /api/v1/favorites/:productId trả về 200 thành công')
    assert(addFavData.data.isFavorite === true, 'Response xác nhận isFavorite: true')

    // 1.3. Lấy danh sách yêu thích
    const getFavRes = await fetch(`${backendUrl}/api/v1/favorites`, {
      headers: { Authorization: `Bearer ${buyerToken}` },
    })
    const getFavData = await getFavRes.json()
    assert(getFavRes.status === 200 && Array.isArray(getFavData.data), 'GET /api/v1/favorites trả về mảng danh sách')
    const hasProduct = getFavData.data.some((p) => String(p.id) === String(testProduct.id))
    assert(hasProduct, 'Danh sách yêu thích chứa sản phẩm vừa thêm')

    // 1.4. Xóa khỏi yêu thích
    const delFavRes = await fetch(`${backendUrl}/api/v1/favorites/${testProduct.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${buyerToken}` },
    })
    const delFavData = await delFavRes.json()
    assert(delFavRes.status === 200 && delFavData.data.isFavorite === false, 'DELETE /api/v1/favorites/:productId trả về 200 và isFavorite: false')

    // 1.5. Validate ID không hợp lệ
    const invalidFavRes = await fetch(`${backendUrl}/api/v1/favorites/abc-invalid`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${buyerToken}` },
    })
    assert(invalidFavRes.status === 400, 'POST /api/v1/favorites với ID sai trả về 400')

    // ----------------------------------------------------
    // MỤC 2: API THEO DÕI GIAN HÀNG (SHOP FOLLOW)
    // ----------------------------------------------------
    console.log('\n--- 2. Kiểm thử API Theo dõi gian hàng (Shop Follow) ---')
    // 2.1. Chưa đăng nhập -> 401
    const unauthFollowRes = await fetch(`${backendUrl}/api/v1/shops/${testShop.id}/follow`)
    assert(unauthFollowRes.status === 401, 'GET /api/v1/shops/:shopId/follow không có token trả về 401')

    // 2.2. Theo dõi gian hàng
    const followRes = await fetch(`${backendUrl}/api/v1/shops/${testShop.id}/follow`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${buyerToken}` },
    })
    const followData = await followRes.json()
    assert(followRes.status === 200 && followData.success === true, 'POST /api/v1/shops/:shopId/follow thành công')
    assert(followData.data.isFollowing === true, 'Response xác nhận isFollowing: true')

    // 2.3. Kiểm tra trạng thái theo dõi
    const statusRes = await fetch(`${backendUrl}/api/v1/shops/${testShop.id}/follow`, {
      headers: { Authorization: `Bearer ${buyerToken}` },
    })
    const statusData = await statusRes.json()
    assert(statusRes.status === 200 && statusData.data.isFollowing === true, 'GET /api/v1/shops/:shopId/follow trả về isFollowing: true')

    // 2.4. Hủy theo dõi gian hàng
    const unfollowRes = await fetch(`${backendUrl}/api/v1/shops/${testShop.id}/follow`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${buyerToken}` },
    })
    const unfollowData = await unfollowRes.json()
    assert(unfollowRes.status === 200 && unfollowData.data.isFollowing === false, 'DELETE /api/v1/shops/:shopId/follow trả về isFollowing: false')

    // 2.5. Alias lấy sản phẩm của shop
    const shopProductsRes = await fetch(`${backendUrl}/api/v1/shops/${testShop.id}/products`)
    const shopProductsData = await shopProductsRes.json()
    assert(shopProductsRes.status === 200 && Array.isArray(shopProductsData.data?.products), 'GET /api/v1/shops/:shopId/products trả về mảng sản phẩm')

    // ----------------------------------------------------
    // MỤC 3: API BANNER QUẢNG CÁO (/api/v1/banners)
    // ----------------------------------------------------
    console.log('\n--- 3. Kiểm thử API Banners quảng cáo ---')
    const bannersRes = await fetch(`${backendUrl}/api/v1/banners`)
    const bannersData = await bannersRes.json()
    assert(bannersRes.status === 200 && bannersData.success === true, 'GET /api/v1/banners trả về 200')
    assert(Array.isArray(bannersData.data) && bannersData.data.length > 0, 'Danh sách banner có dữ liệu mảng')
    const firstBanner = bannersData.data[0]
    assert(firstBanner.id && firstBanner.title && firstBanner.imageUrl && firstBanner.backgroundColor, 'Banner có đầy đủ id, title, imageUrl, backgroundColor')

    // ----------------------------------------------------
    // MỤC 4: SẢN PHẨM NỔI BẬT & FLASH SALE (/api/v1/products/featured)
    // ----------------------------------------------------
    console.log('\n--- 4. Kiểm thử API Featured & Flash Sale trang chủ ---')
    const featuredRes = await fetch(`${backendUrl}/api/v1/products/featured`)
    const featuredData = await featuredRes.json()
    assert(featuredRes.status === 200 && featuredData.success === true, 'GET /api/v1/products/featured trả về 200 (không bị 404)')
    assert(Array.isArray(featuredData.data?.flashSale), 'data.flashSale là một mảng')
    assert(Array.isArray(featuredData.data?.featuredProducts), 'data.featuredProducts là một mảng')

    // ----------------------------------------------------
    // MỤC 5: CHI TIẾT 1 ĐƠN HÀNG (/api/v1/orders/:orderId)
    // ----------------------------------------------------
    console.log('\n--- 5. Kiểm thử API Chi tiết 1 đơn hàng ---')
    // 5.1. Chưa đăng nhập -> 401
    const unauthOrderRes = await fetch(`${backendUrl}/api/v1/orders/1`)
    assert(unauthOrderRes.status === 401, 'GET /api/v1/orders/:orderId không có token trả về 401')

    // 5.2. Đơn không tồn tại -> 404
    const notFoundOrderRes = await fetch(`${backendUrl}/api/v1/orders/9999999999`, {
      headers: { Authorization: `Bearer ${buyerToken}` },
    })
    assert(notFoundOrderRes.status === 404, 'GET /api/v1/orders/9999999999 trả về 404')

    // 5.3. Tìm đơn hàng có thật của buyer hoặc tạo 1 đơn để test
    const buyerOrders = await executeQuery(`SELECT id FROM orders WHERE buyer_id = ? LIMIT 1`, [buyer.id])
    if (buyerOrders.length > 0) {
      const realOrderId = buyerOrders[0].id
      const orderDetailRes = await fetch(`${backendUrl}/api/v1/orders/${realOrderId}`, {
        headers: { Authorization: `Bearer ${buyerToken}` },
      })
      const orderDetailData = await orderDetailRes.json()
      assert(orderDetailRes.status === 200 && orderDetailData.success === true, `GET /api/v1/orders/${realOrderId} trả về 200`)
      assert(orderDetailData.data.id === String(realOrderId), 'Dữ liệu trả về đúng ID đơn hàng')
      assert(Array.isArray(orderDetailData.data.items), 'Đơn hàng có mảng items')
      assert(orderDetailData.data.address && orderDetailData.data.total !== undefined, 'Đơn hàng có địa chỉ và tổng tiền')
    } else {
      console.log('  ℹ Bỏ qua kiểm tra đơn thực tế vì tài khoản test chưa có đơn hàng trong DB')
    }

    // ----------------------------------------------------
    // MỤC 6: THỐNG KÊ TÀI KHOẢN (/api/v1/auth/stats)
    // ----------------------------------------------------
    console.log('\n--- 6. Kiểm thử API Thống kê tài khoản (User Stats) ---')
    // 6.1. Chưa đăng nhập -> 401
    const unauthStatsRes = await fetch(`${backendUrl}/api/v1/auth/stats`)
    assert(unauthStatsRes.status === 401, 'GET /api/v1/auth/stats không có token trả về 401')

    // 6.2. Đăng nhập -> 200
    const statsRes = await fetch(`${backendUrl}/api/v1/auth/stats`, {
      headers: { Authorization: `Bearer ${buyerToken}` },
    })
    const statsData = await statsRes.json()
    assert(statsRes.status === 200 && statsData.success === true, 'GET /api/v1/auth/stats trả về 200')
    assert(statsData.data.orderCount !== undefined, 'statsData.data.orderCount tồn tại')
    assert(statsData.data.totalSpent !== undefined, 'statsData.data.totalSpent tồn tại')
    assert(statsData.data.favoriteCount !== undefined, 'statsData.data.favoriteCount tồn tại')
    assert(statsData.data.orders && typeof statsData.data.orders === 'object', 'statsData.data.orders chứa phân loại trạng thái')

    // ----------------------------------------------------
    // MỤC 7: CHUẨN HÓA METHOD & ROUTER ALIAS
    // ----------------------------------------------------
    console.log('\n--- 7. Kiểm thử Chuẩn hóa Method & Router Alias ---')
    // 7.1. PATCH /orders/:orderId/cancel
    const patchCancelRes = await fetch(`${backendUrl}/api/v1/orders/9999999999/cancel`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${buyerToken}`, 'Content-Type': 'application/json' },
    })
    const patchCancelData = await patchCancelRes.json()
    // Route đón được request và xử lý logic nghiệp vụ từ Data API (ORDER_NOT_FOUND)
    assert(patchCancelData.error?.code === 'ORDER_NOT_FOUND', 'PATCH /api/v1/orders/:orderId/cancel được đón nhận bởi router và trả về ORDER_NOT_FOUND khi đơn không tồn tại')

    // 7.2. POST /reviews
    const postReviewsRes = await fetch(`${backendUrl}/api/v1/reviews`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${buyerToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ productId: 'invalid', rating: 5, comment: 'test' }),
    })
    assert(postReviewsRes.status === 400, 'POST /api/v1/reviews đón nhận request và validate productId (trả 400)')

    // 7.3. POST /seller/register-shop
    const regShopRes = await fetch(`${backendUrl}/api/v1/seller/register-shop`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${buyerToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ shopName: 'Shop Test Nhóm 1' }),
    })
    assert(regShopRes.status !== 404, 'POST /api/v1/seller/register-shop được đón nhận bởi router (không 404)')

    console.log('\n======================================================')
    console.log('🎉 TẤT CẢ 7 MỤC NHÓM 1 ĐÃ PASS THÀNH CÔNG 100%!')
    console.log('======================================================')
  } finally {
    await new Promise((resolve) => backendServer.close(resolve))
    await new Promise((resolve) => dataApiServer.close(resolve))
    await closeDatabase()
  }
}

run().catch((err) => {
  console.error('Lỗi khi chạy kiểm thử:', err)
  process.exit(1)
})
