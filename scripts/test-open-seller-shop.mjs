import assert from 'node:assert';

const BASE_URL = 'http://127.0.0.1:3000/api/v1';

async function request(path, options = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  const data = await res.json().catch(() => null);
  return { status: res.status, ok: res.ok, data };
}

async function run() {
  console.log('=== BẮT ĐẦU KIỂM THỬ TOÀN DIỆN CHỨC NĂNG MỞ GIAN HÀNG ===\n');

  // 1. Tạo tài khoản người mua thông thường (Buyer)
  const testBuyerUsername = `buyer_${Date.now()}`;
  console.log(`1. Đăng ký tài khoản người mua thông thường: ${testBuyerUsername}...`);
  const regRes = await request('/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      username: testBuyerUsername,
      password: 'BuyerPassword123!',
      fullName: 'Người Mua Thử Nghiệm',
      email: `${testBuyerUsername}@example.test`,
      role: 'buyer',
    }),
  });

  assert(regRes.status === 201, `Đăng ký thất bại: ${JSON.stringify(regRes.data)}`);
  assert(regRes.data?.data?.user?.role === 'buyer', 'Vai trò ban đầu phải là buyer');
  assert(regRes.data?.data?.user?.shopId === null, 'Tài khoản buyer mới chưa có shopId');
  const buyerToken = regRes.data?.data?.token;
  const buyerId = regRes.data?.data?.user?.id;
  console.log(`   ✓ Đăng ký thành công: User ID = ${buyerId}, role = buyer, shopId = null`);

  // 2. Kiểm tra truy cập Kênh Người Bán khi chưa có shop (Token có quyền gọi /auth/seller-shop)
  console.log('\n2. Người mua mở gian hàng mới: "Gốm Mộc Store"...');
  const openShopRes = await request('/auth/seller-shop', {
    method: 'POST',
    headers: { Authorization: `Bearer ${buyerToken}` },
    body: JSON.stringify({ shopName: 'Gốm Mộc Store' }),
  });

  assert(openShopRes.status === 200, `Mở shop thất bại: ${JSON.stringify(openShopRes.data)}`);
  assert(openShopRes.data?.success === true, 'Mở shop phải trả về success: true');
  assert(openShopRes.data?.data?.user?.role === 'seller', 'Vai trò phải được nâng cấp thành seller');
  assert(openShopRes.data?.data?.user?.shopId, 'Phải có shopId hợp lệ sau khi mở shop');
  assert(openShopRes.data?.data?.token, 'Phải cấp token mới có cập nhật role seller');
  const newSellerToken = openShopRes.data?.data?.token;
  const shopId = openShopRes.data?.data?.user?.shopId;
  console.log(`   ✓ Mở gian hàng thành công! Shop ID = ${shopId}, Vai trò mới = ${openShopRes.data.data.user.role}`);

  // 3. Kiểm tra kiểm soát trùng tên gian hàng (Duplicate Shop Name)
  console.log('\n3. Thử nghiệm mở gian hàng với TÊN TRÙNG LẶP của người bán khác...');
  // Tạo tài khoản buyer thứ hai
  const testBuyer2Username = `buyer2_${Date.now()}`;
  const regBuyer2 = await request('/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      username: testBuyer2Username,
      password: 'BuyerPassword123!',
      fullName: 'Người Mua Thứ Hai',
      email: `${testBuyer2Username}@example.test`,
      role: 'buyer',
    }),
  });
  const buyer2Token = regBuyer2.data?.data?.token;

  // Thử mở shop với tên trùng "gốm mộc store" (case-insensitive)
  const dupRes = await request('/auth/seller-shop', {
    method: 'POST',
    headers: { Authorization: `Bearer ${buyer2Token}` },
    body: JSON.stringify({ shopName: 'gốm mộc store' }),
  });

  assert(dupRes.status === 400, `Phải trả về 400 cho tên shop trùng: ${dupRes.status}`);
  assert(dupRes.data?.error?.code === 'DUPLICATE_SHOP_NAME', 'Mã lỗi phải là DUPLICATE_SHOP_NAME');
  console.log(`   ✓ Bắt lỗi trùng tên thành công (HTTP 400): "${dupRes.data.message}"`);

  // 4. Kiểm tra gửi yêu cầu nhiều lần / người dùng đã có shop
  console.log('\n4. Kiểm tra gửi lại yêu cầu khi người dùng đã có shop...');
  const retryRes = await request('/auth/seller-shop', {
    method: 'POST',
    headers: { Authorization: `Bearer ${newSellerToken}` },
    body: JSON.stringify({ shopName: 'Gốm Mộc Store' }),
  });

  assert(retryRes.status === 200, `Phải trả về thành công: ${retryRes.status}`);
  assert(String(retryRes.data?.data?.user?.shopId) === String(shopId), 'Phải giữ nguyên shopId cũ, không tạo shop mới');
  console.log(`   ✓ Xử lý idempotency chuẩn xác: Giữ nguyên Shop ID = ${shopId}`);

  // 5. Kiểm tra quyền của Seller vừa tạo (truy cập seller API hợp lệ)
  console.log('\n5. Kiểm tra quyền truy cập API Kênh Người Bán (/api/v1/seller/products)...');
  const sellerProdRes = await request('/seller/products', {
    headers: { Authorization: `Bearer ${newSellerToken}` },
  });
  assert(sellerProdRes.status === 200, `Seller phải truy cập được /seller/products: ${sellerProdRes.status}`);
  console.log('   ✓ Seller mới truy cập thành công API Kênh Người Bán (HTTP 200)');

  // 6. Kiểm tra bảo mật: Seller thông thường KHÔNG ĐƯỢC vào Admin API
  console.log('\n6. Kiểm tra bảo mật: Đảm bảo Seller KHÔNG có quyền Admin...');
  const adminRes = await request('/admin/stats', {
    headers: { Authorization: `Bearer ${newSellerToken}` },
  });
  assert(adminRes.status === 403, `Seller truy cập admin phải bị 403: ${adminRes.status}`);
  assert(adminRes.data?.error?.code === 'FORBIDDEN', 'Mã lỗi phải là FORBIDDEN');
  console.log('   ✓ Bảo mật được bảo đảm: Seller bị từ chối 403 khi vào Admin API');

  // 7. Kiểm tra tài khoản Admin mở / quản lý gian hàng
  console.log('\n7. Kiểm tra tài khoản Admin mở / quản lý gian hàng...');
  const adminLogin = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username: 'demo_admin', password: 'Admin123456' }),
  });
  const adminToken = adminLogin.data?.data?.token;

  const adminOpenShop = await request('/auth/seller-shop', {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({ shopName: `Nova Admin Hub ${Date.now()}` }),
  });
  assert(adminOpenShop.status === 200, `Admin phải mở được shop: ${JSON.stringify(adminOpenShop.data)}`);
  assert(adminOpenShop.data?.data?.user?.role === 'admin', 'Tài khoản admin phải GIỮ NGUYÊN role admin');
  assert(adminOpenShop.data?.data?.user?.shopId, 'Admin phải có shopId');
  console.log(`   ✓ Admin mở shop thành công! Role = ${adminOpenShop.data.data.user.role}, Shop ID = ${adminOpenShop.data.data.user.shopId}`);

  // 8. Kiểm tra Admin sau khi có shop vẫn có toàn quyền Admin
  const adminCheck = await request('/admin/stats', {
    headers: { Authorization: `Bearer ${adminOpenShop.data.data.token || adminToken}` },
  });
  assert(adminCheck.status === 200, 'Admin sau khi mở shop vẫn phải truy cập được /admin/stats');
  console.log('   ✓ Admin vẫn giữ nguyên 100% quyền Quản Trị Hệ Thống (HTTP 200)');

  console.log('\n🎉 TẤT CẢ 8 MỤC KIỂM THỬ ĐÃ ĐẠT 100% THÀNH CÔNG!');
}

run().catch((err) => {
  console.error('\n❌ KIỂM THỬ THẤT BẠI:', err);
  process.exit(1);
});

