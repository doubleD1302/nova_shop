import assert from 'node:assert';

const BACKEND_URL = 'http://127.0.0.1:3000/api/v1';

async function request(path, options = {}) {
  const url = `${BACKEND_URL}${path}`;
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  const res = await fetch(url, { ...options, headers });
  const body = await res.json().catch(() => null);
  return { status: res.status, ok: res.ok, body };
}

async function login(username, password) {
  const { status, ok, body } = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
  assert.strictEqual(ok, true, `Đăng nhập ${username} thất bại: ${body?.message}`);
  return { token: body.data.token, user: body.data.user };
}

async function run() {
  console.log('=== BẮT ĐẦU KIỂM THỬ E2E: BÁO CÁO HÀNG GIẢ & KHÓA / MỞ KHÓA SHOP ===\n');

  // 1. Đăng nhập các tài khoản
  console.log('1. Đăng nhập các tài khoản thực nghiệm...');
  const buyer = await login('demo_buyer', 'Buyer123456');
  console.log('   ✓ Buyer đăng nhập thành công:', buyer.user.username, '(ID:', buyer.user.id, ')');

  const seller = await login('demo_seller_a', 'Seller123456');
  console.log('   ✓ Seller đăng nhập thành công:', seller.user.username, '(Shop ID:', seller.user.shopId, ')');
  const shopId = String(seller.user.shopId);

  const admin = await login('demo_admin', 'Admin123456');
  console.log('   ✓ Admin đăng nhập thành công:', admin.user.username, '(ID:', admin.user.id, ')\n');

  // Đảm bảo gian hàng ban đầu ở trạng thái hoạt động bình thường
  await request(`/admin/shops/${shopId}/status`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${admin.token}` },
    body: JSON.stringify({ status: 'active' }),
  });

  // 2. Lấy sản phẩm của shop để làm mục tiêu báo cáo
  console.log('2. Lấy sản phẩm đang bán của gian hàng để thực hiện báo cáo...');
  const initialProductsRes = await request(`/products?shopId=${shopId}&fullImages=1`);
  assert.strictEqual(initialProductsRes.ok, true);
  const products = initialProductsRes.body.data.products;
  assert.ok(products.length > 0, 'Gian hàng cần có ít nhất 1 sản phẩm đang hoạt động để thử nghiệm.');
  const targetProduct = products[0];
  console.log('   ✓ Chọn sản phẩm mục tiêu: [#' + targetProduct.id + '] ' + targetProduct.name);
  console.log('   ✓ Slug:', targetProduct.slug, '· Thuộc shop ID:', targetProduct.shopId, '\n');

  // 3. Người mua gửi báo cáo nghi hàng giả
  console.log('3. Người mua (Buyer) gửi báo cáo nghi hàng giả có bằng chứng...');
  const reportPayload = {
    targetType: 'product',
    targetId: targetProduct.id,
    reason: 'Nghi ngờ hàng giả, hàng nhái: Bao bì sai lệch so với hàng chính hãng, logo mờ',
    details: 'Tôi đã nhận hàng và kiểm tra đối chiếu tem chống giả, tem bị nhòe và mã QR không dẫn về trang chính hãng. Đính kèm ảnh chụp chi tiết tem.',
    evidenceUrl: '/uploads/counterfeit-proof-sample.jpg',
  };

  const createReportRes = await request('/reports', {
    method: 'POST',
    headers: { Authorization: `Bearer ${buyer.token}` },
    body: JSON.stringify(reportPayload),
  });
  assert.strictEqual(createReportRes.status, 201, `Gửi báo cáo thất bại: ${createReportRes.body?.message}`);
  const reportId = createReportRes.body.data.reportId;
  console.log('   ✓ Đã tạo báo cáo vi phạm thành công trong CSDL. Mã Report ID:', reportId);
  console.log('   ✓ Trạng thái khởi tạo:', createReportRes.body.data.status, '\n');

  // 4. Admin xem danh sách báo cáo
  console.log('4. Admin truy xuất danh sách báo cáo vi phạm...');
  const adminReportsRes = await request('/admin/reports', {
    headers: { Authorization: `Bearer ${admin.token}` },
  });
  assert.strictEqual(adminReportsRes.ok, true);
  const reportList = adminReportsRes.body.data.reports;
  const foundReport = reportList.find((r) => String(r.id) === String(reportId));
  assert.ok(foundReport, 'Không tìm thấy báo cáo vừa tạo trong danh sách của Admin.');
  console.log('   ✓ Admin tìm thấy báo cáo vi phạm #' + foundReport.id);
  console.log('     - Đối tượng:', foundReport.targetName, `(${foundReport.targetType} #${foundReport.targetId})`);
  console.log('     - Shop liên kết:', foundReport.shopName, `(ID: ${foundReport.shopId})`);
  console.log('     - Người báo cáo:', foundReport.reporterFullName, `(@${foundReport.reporterUsername})`);
  console.log('     - Ảnh bằng chứng:', foundReport.evidenceUrl);
  console.log('     - Trạng thái hiện tại:', foundReport.status, '\n');

  // 5. Admin chuyển trạng thái báo cáo sang "Đang xác minh"
  console.log('5. Admin chuyển trạng thái báo cáo sang "Đang xác minh" (investigating)...');
  const updateInvestigatingRes = await request(`/admin/reports/${reportId}/status`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${admin.token}` },
    body: JSON.stringify({ status: 'investigating' }),
  });
  assert.strictEqual(updateInvestigatingRes.ok, true, `Cập nhật trạng thái investigating thất bại: ${updateInvestigatingRes.body?.message}`);
  console.log('   ✓ Báo cáo #' + reportId + ' đã chuyển sang trạng thái "investigating".\n');

  // 6. Admin xác nhận vi phạm sau khi thẩm định
  console.log('6. Admin hoàn tất thẩm định, chuyển trạng thái sang "Đã xác nhận vi phạm" (confirmed_violation)...');
  const updateConfirmedRes = await request(`/admin/reports/${reportId}/status`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${admin.token}` },
    body: JSON.stringify({ status: 'confirmed_violation' }),
  });
  assert.strictEqual(updateConfirmedRes.ok, true, `Cập nhật trạng thái confirmed_violation thất bại: ${updateConfirmedRes.body?.message}`);
  console.log('   ✓ Báo cáo #' + reportId + ' đã chuyển sang trạng thái "confirmed_violation".\n');

  // 7. Admin thực hiện Khóa Shop vi phạm
  console.log('7. Admin tiến hành KHÓA GIAN HÀNG VI PHẠM (Shop ID: ' + shopId + ')...');
  const lockReason = `Khóa gian hàng do vi phạm bán hàng giả theo hồ sơ báo cáo #${reportId} đã được xác minh thực tế.`;
  const lockShopRes = await request(`/admin/shops/${shopId}/status`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${admin.token}` },
    body: JSON.stringify({ status: 'suspended', reason: lockReason }),
  });
  assert.strictEqual(lockShopRes.ok, true, `Khóa shop thất bại: ${lockShopRes.body?.message}`);
  console.log('   ✓ Đã khóa gian hàng thành công. Ghi nhận lý do:', lockReason, '\n');

  // 8. KIỂM TRA HỆ QUẢ KHI SHOP BỊ KHÓA
  console.log('8. Kiểm tra các ràng buộc và an toàn khi Shop bị tạm khóa:');

  // 8a. Sản phẩm của shop bị ẩn khỏi sàn công khai
  console.log('   8a. Kiểm tra sàn thương mại công khai:');
  const hiddenProductsRes = await request(`/products?shopId=${shopId}`);
  assert.strictEqual(hiddenProductsRes.ok, true);
  const hiddenProducts = hiddenProductsRes.body.data.products;
  assert.strictEqual(hiddenProducts.length, 0, 'Sản phẩm của shop bị khóa vẫn còn xuất hiện trên sàn công khai!');
  console.log('       ✓ ĐÃ ẨN HOÀN TOÀN: Truy vấn sản phẩm shopId trả về 0 sản phẩm.');

  const directProductRes = await request(`/products?slug=${targetProduct.slug}`);
  assert.strictEqual(directProductRes.status, 404, 'Sản phẩm của shop bị khóa vẫn truy cập được qua slug!');
  console.log('       ✓ ĐÃ ẨN HOÀN TOÀN: Truy cập trực tiếp qua slug trả về HTTP 404 PRODUCT_NOT_FOUND.');

  // 8b. Người bán bị khóa quyền đăng / sửa sản phẩm
  console.log('   8b. Kiểm tra quyền của Người Bán (Seller) khi shop bị khóa:');
  const attemptAddProductRes = await request('/seller/products', {
    method: 'POST',
    headers: { Authorization: `Bearer ${seller.token}` },
    body: JSON.stringify({
      name: 'Sản phẩm thử nghiệm khi bị khóa',
      categoryId: targetProduct.categoryId,
      price: 150000,
      stock: 10,
      description: 'Mô tả thử nghiệm kiểm tra quyền đăng bán khi gian hàng bị tạm khóa',
      status: 'active',
      images: targetProduct.images.map((img) => ({
        url: img.url,
        altText: img.altText || 'Ảnh mô tả sản phẩm',
        author: img.author || 'Ảnh do người bán tải lên',
        licenseName: img.licenseName || 'Ảnh do người bán cung cấp',
        licenseUrl: img.licenseUrl || null,
        sourcePageUrl: img.sourcePageUrl || null,
      })),
    }),
  });
  assert.strictEqual(attemptAddProductRes.status, 403, 'Người bán của shop bị khóa vẫn đăng được sản phẩm!');
  assert.strictEqual(attemptAddProductRes.body.error?.code, 'SHOP_SUSPENDED');
  console.log('       ✓ CHẶN THÀNH CÔNG: Người bán cố đăng sản phẩm bị trả mã 403 SHOP_SUSPENDED.');
  console.log('       ✓ Thông báo trả về cho Seller:', attemptAddProductRes.body.message);

  // 8c. Người bán lấy thông tin gian hàng thấy trạng thái suspended và lý do
  console.log('   8c. Kiểm tra thông tin gian hàng trả về cho Kênh Người Bán:');
  const shopProfileRes = await request(`/shops/${shopId}`);
  assert.strictEqual(shopProfileRes.ok, true);
  assert.strictEqual(shopProfileRes.body.data.shop.status, 'suspended');
  assert.strictEqual(shopProfileRes.body.data.shop.suspensionReason, lockReason);
  console.log('       ✓ Giao diện Người Bán nhận đúng trạng thái "suspended" và lý do khóa:', shopProfileRes.body.data.shop.suspensionReason, '\n');

  // 9. Admin Mở khóa gian hàng
  console.log('9. Admin tiến hành MỞ KHÓA GIAN HÀNG (Shop ID: ' + shopId + ')...');
  const unlockShopRes = await request(`/admin/shops/${shopId}/status`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${admin.token}` },
    body: JSON.stringify({ status: 'active' }),
  });
  assert.strictEqual(unlockShopRes.ok, true, `Mở khóa shop thất bại: ${unlockShopRes.body?.message}`);
  console.log('   ✓ Đã mở khóa gian hàng thành công.\n');

  // 10. KIỂM TRA PHỤC HỒI SAU KHI MỞ KHÓA
  console.log('10. Kiểm tra phục hồi hoạt động và bảo toàn dữ liệu sau khi mở khóa:');

  // 10a. Sản phẩm hiển thị lại bình thường
  const restoredProductsRes = await request(`/products?shopId=${shopId}`);
  assert.strictEqual(restoredProductsRes.ok, true);
  const restoredProducts = restoredProductsRes.body.data.products;
  assert.ok(restoredProducts.length > 0, 'Sản phẩm của shop chưa hiển thị lại sau khi mở khóa!');
  console.log('    ✓ PHỤC HỒI THÀNH CÔNG: Toàn bộ', restoredProducts.length, 'sản phẩm của shop đã xuất hiện trở lại trên sàn.');

  // 10b. Shop profile hoạt động lại
  const restoredShopRes = await request(`/shops/${shopId}`);
  assert.strictEqual(restoredShopRes.body.data.shop.status, 'active');
  assert.strictEqual(restoredShopRes.body.data.shop.suspensionReason, null);
  console.log('    ✓ Trạng thái gian hàng phục hồi: "active", lý do khóa đã được giải phóng.');

  console.log('\n=============================================================');
  console.log('🎉 TẤT CẢ CÁC BƯỚC KIỂM THỬ E2E BÁO CÁO & KHÓA/MỞ SHOP ĐỀU ĐẠT (PASS)!');
  console.log('=============================================================');
}

run().catch((err) => {
  console.error('\n❌ KIỂM THỬ THẤT BÀI:', err);
  process.exit(1);
});
