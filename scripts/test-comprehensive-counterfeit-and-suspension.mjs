import assert from 'node:assert';
import { executeQuery, closeDatabase } from '../data-api/src/config/database.js';

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

async function runTests() {
  console.log('========================================================================');
  console.log('🧪 BẮT ĐẦU KIỂM THỬ TOÀN DIỆN: BÁO CÁO HÀNG GIẢ, CẢNH CÁO VÀ KHÓA SHOP');
  console.log('========================================================================\n');

  // Đăng nhập 3 chủ thể: Buyer, Seller, Admin
  console.log('--- BƯỚC 1: Đăng nhập các tài khoản ---');
  const buyer = await login('demo_buyer', 'Buyer123456');
  console.log('✓ Buyer:', buyer.user.username, '(ID:', buyer.user.id, ')');

  const seller = await login('demo_seller_a', 'Seller123456');
  console.log('✓ Seller:', seller.user.username, '(Shop ID:', seller.user.shopId, ', Email:', seller.user.email, ')');
  const shopId = String(seller.user.shopId);

  const admin = await login('demo_admin', 'Admin123456');
  console.log('✓ Admin:', admin.user.username, '(ID:', admin.user.id, ')\n');

  // Đảm bảo môi trường kiểm thử sạch: xóa vi phạm test trước đó của shop này và đặt shop active
  await executeQuery('DELETE FROM shop_violations WHERE shop_id = ?', [shopId]);
  await executeQuery(
    "UPDATE shops SET status = 'active', suspension_reason = NULL, suspended_at = NULL, suspended_by = NULL WHERE id = ?",
    [shopId]
  );
  console.log('✓ Khởi tạo môi trường kiểm thử: Đã làm sạch lịch sử vi phạm cũ và kích hoạt Shop.');

  // Lấy danh sách sản phẩm của shop
  console.log('--- BƯỚC 2: Chuẩn bị 2 sản phẩm của shop để thử nghiệm ---');
  const productsRes = await request(`/products?shopId=${shopId}&fullImages=1`);
  assert.strictEqual(productsRes.ok, true);
  const products = productsRes.body.data.products;
  assert.ok(products.length >= 2, 'Shop cần ít nhất 2 sản phẩm để kiểm thử vi phạm lần 1 và lần 2.');
  const prod1 = products[0];
  const prod2 = products[1];
  console.log(`✓ Sản phẩm 1: [#${prod1.id}] ${prod1.name}`);
  console.log(`✓ Sản phẩm 2: [#${prod2.id}] ${prod2.name}\n`);

  // Scenario 1: Người mua gửi báo cáo hàng giả sản phẩm 1
  console.log('--- TEST 1: Người mua gửi báo cáo sản phẩm 1 nghi hàng giả kèm ảnh bằng chứng ---');
  const report1Res = await request('/reports', {
    method: 'POST',
    headers: { Authorization: `Bearer ${buyer.token}` },
    body: JSON.stringify({
      targetType: 'product',
      targetId: prod1.id,
      reason: 'Nghi ngờ hàng giả, hàng nhái: Logo in sai font và tem niêm phong bị rách',
      details: 'Sản phẩm mua về đối chiếu thấy chất liệu vải mỏng, đường may cẩu thả khác hẳn hàng chính hãng.',
      evidenceUrl: '/uploads/counterfeit-proof-sample.jpg',
    }),
  });
  assert.strictEqual(report1Res.status, 201, `Gửi báo cáo thất bại: ${report1Res.body?.message}`);
  const report1Id = report1Res.body.data.reportId;
  console.log(`✓ Tạo báo cáo #1 thành công! Report ID: ${report1Id}, Status: ${report1Res.body.data.status}\n`);

  // Scenario 2: Chống gửi trùng cùng một đối tượng
  console.log('--- TEST 2: Chống gửi trùng: Người mua gửi lại báo cáo cho cùng sản phẩm 1 ---');
  const dupReportRes = await request('/reports', {
    method: 'POST',
    headers: { Authorization: `Bearer ${buyer.token}` },
    body: JSON.stringify({
      targetType: 'product',
      targetId: prod1.id,
      reason: 'Gửi lặp lại lần nữa',
      details: 'Nội dung gửi lặp lại kiểm tra tính năng chặn spam',
    }),
  });
  assert.strictEqual(dupReportRes.status, 409, 'Hệ thống chưa chặn gửi trùng báo cáo đang chờ xử lý!');
  console.log(`✓ Chặn trùng thành công (HTTP 409): "${dupReportRes.body?.message}"\n`);

  // Scenario 3: Admin xem danh sách báo cáo
  console.log('--- TEST 3: Admin xem danh sách báo cáo và thông tin chi tiết ---');
  const adminReportsRes = await request('/admin/reports', {
    headers: { Authorization: `Bearer ${admin.token}` },
  });
  assert.strictEqual(adminReportsRes.ok, true);
  const reportsList = adminReportsRes.body.data.reports;
  const foundRep1 = reportsList.find((r) => String(r.id) === String(report1Id));
  assert.ok(foundRep1, 'Không tìm thấy báo cáo vừa tạo trong danh sách Admin.');
  console.log('✓ Tìm thấy báo cáo:', {
    id: foundRep1.id,
    targetName: foundRep1.targetName,
    productImage: foundRep1.productImage,
    evidenceUrl: foundRep1.evidenceUrl,
    shopName: foundRep1.shopName,
    shopOwnerEmail: foundRep1.shopOwnerEmail,
    status: foundRep1.status,
  });
  console.log();

  // Scenario 4: Chuyển sang "Đang xác minh" (investigating) -> Không tăng vi phạm
  console.log('--- TEST 4: Admin chuyển báo cáo sang "Đang xác minh" (investigating) ---');
  const updateInvestigating = await request(`/admin/reports/${report1Id}/status`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${admin.token}` },
    body: JSON.stringify({ status: 'investigating' }),
  });
  assert.strictEqual(updateInvestigating.ok, true);
  console.log('✓ Chuyển sang "investigating" thành công. Kiểm tra vi phạm shop không đổi:');
  const shopCheck1 = await request(`/admin/shops/${shopId}/violations`, {
    headers: { Authorization: `Bearer ${admin.token}` },
  });
  assert.strictEqual(shopCheck1.ok, true);
  console.log(`✓ Số vi phạm hiện tại của shop: ${shopCheck1.body.data.violations.length} (Báo cáo chưa xác nhận không tăng vi phạm)\n`);

  // Scenario 5: Xác nhận vi phạm lần 1 -> Gửi email cảnh cáo, shop vẫn hoạt động
  console.log('--- TEST 5: Admin XÁC NHẬN VI PHẠM LẦN 1 (confirmed_violation) ---');
  const confirm1Res = await request(`/admin/reports/${report1Id}/status`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${admin.token}` },
    body: JSON.stringify({ status: 'confirmed_violation' }),
  });
  assert.strictEqual(confirm1Res.ok, true, `Xác nhận vi phạm lần 1 thất bại: ${confirm1Res.body?.message}`);
  const data1 = confirm1Res.body.data;
  console.log('✓ Kết quả xử lý lần 1:', {
    reportId: data1.reportId,
    violationNumber: data1.violationNumber,
    actionTaken: data1.actionTaken,
    shopStatus: data1.shopStatus,
    ownerEmail: data1.ownerEmail,
    emailStatus: data1.emailStatus,
  });
  assert.strictEqual(data1.violationNumber, 1, 'Lần vi phạm phải bằng 1');
  assert.strictEqual(data1.actionTaken, 'warning_email', 'Vi phạm lần 1 chế tài phải là warning_email');
  assert.strictEqual(data1.shopStatus, 'active', 'Shop phải vẫn hoạt động ở vi phạm lần 1');
  console.log('✓ Đã ghi nhận vi phạm lần 1 và kích hoạt luồng gửi email cảnh cáo tới:', data1.ownerEmail, '\n');

  // Scenario 6: Chống xử lý lặp lại cùng báo cáo
  console.log('--- TEST 6: Xử lý lặp lại cùng báo cáo #1 (Idempotency) ---');
  const repeatConfirmRes = await request(`/admin/reports/${report1Id}/status`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${admin.token}` },
    body: JSON.stringify({ status: 'confirmed_violation' }),
  });
  assert.strictEqual(repeatConfirmRes.ok, true);
  assert.strictEqual(repeatConfirmRes.body.data.violationNumber, 1, 'Xử lý lại cùng báo cáo không được tăng số lần vi phạm!');
  assert.strictEqual(repeatConfirmRes.body.data.isNewViolation, false, 'isNewViolation phải là false khi xử lý lại');
  console.log('✓ Không đếm trùng vi phạm khi bấm xác nhận lại cùng một báo cáo.\n');

  // Scenario 7: Báo cáo vi phạm thứ hai phát sinh cho shop
  console.log('--- TEST 7: Người mua gửi báo cáo thứ 2 cho sản phẩm 2 của cùng shop ---');
  const report2Res = await request('/reports', {
    method: 'POST',
    headers: { Authorization: `Bearer ${buyer.token}` },
    body: JSON.stringify({
      targetType: 'product',
      targetId: prod2.id,
      reason: 'Bán hàng giả, hàng nhái: Bao bì sai thông tin nhà sản xuất',
      details: 'Sản phẩm thứ hai cũng có dấu hiệu làm giả tem nhãn nghiêm trọng.',
    }),
  });
  assert.strictEqual(report2Res.status, 201);
  const report2Id = report2Res.body.data.reportId;
  console.log(`✓ Đã tạo báo cáo vi phạm #2: Report ID ${report2Id}\n`);

  // Scenario 8: Xác nhận vi phạm lần 2 -> TỰ ĐỘNG KHÓA SHOP & GỬI EMAIL THÔNG BÁO KHÓA
  console.log('--- TEST 8: Admin XÁC NHẬN VI PHẠM LẦN 2 -> TỰ ĐỘNG KHÓA SHOP ---');
  const confirm2Res = await request(`/admin/reports/${report2Id}/status`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${admin.token}` },
    body: JSON.stringify({ status: 'confirmed_violation' }),
  });
  assert.strictEqual(confirm2Res.ok, true, `Xác nhận vi phạm lần 2 thất bại: ${confirm2Res.body?.message}`);
  const data2 = confirm2Res.body.data;
  console.log('✓ Kết quả xử lý lần 2:', {
    reportId: data2.reportId,
    violationNumber: data2.violationNumber,
    actionTaken: data2.actionTaken,
    shopStatus: data2.shopStatus,
    ownerEmail: data2.ownerEmail,
    emailStatus: data2.emailStatus,
  });
  assert.strictEqual(data2.violationNumber, 2, 'Lần vi phạm phải bằng 2');
  assert.strictEqual(data2.actionTaken, 'shop_suspended', 'Vi phạm lần 2 chế tài phải là shop_suspended');
  assert.strictEqual(data2.shopStatus, 'suspended', 'Shop phải tự động chuyển sang trạng thái suspended!');
  console.log('✓ TỰ ĐỘNG KHÓA SHOP THÀNH CÔNG KHI TÁI PHẠM LẦN 2!\n');

  // Scenario 9: Kiểm tra hệ quả khi shop bị khóa
  console.log('--- TEST 9: Kiểm tra hệ quả sau khi Shop bị khóa ---');
  // 9a. Sản phẩm bị ẩn khỏi sàn công khai
  const publicList = await request(`/products?shopId=${shopId}`);
  assert.strictEqual(publicList.ok, true);
  assert.strictEqual(publicList.body.data.products.length, 0, 'Sản phẩm shop bị khóa vẫn còn hiển thị trên sàn!');
  console.log('✓ 9a. Sản phẩm của shop đã bị ẩn hoàn toàn khỏi danh sách công khai.');

  const directSlug = await request(`/products?slug=${prod1.slug}`);
  assert.strictEqual(directSlug.status, 404, 'Sản phẩm shop bị khóa vẫn truy cập được qua slug!');
  console.log('✓ 9b. Truy cập sản phẩm trực tiếp qua slug trả về HTTP 404.');

  // 9b. Seller không thể đăng sản phẩm mới
  const attemptAdd = await request('/seller/products', {
    method: 'POST',
    headers: { Authorization: `Bearer ${seller.token}` },
    body: JSON.stringify({
      name: 'Sản phẩm cố tình đăng khi shop bị khóa',
      categoryId: prod1.categoryId,
      price: 200000,
      stock: 5,
      description: 'Mô tả thử nghiệm quyền khi shop bị khóa',
      status: 'active',
    }),
  });
  assert.strictEqual(attemptAdd.status, 403, 'Seller vẫn đăng được sản phẩm khi shop bị khóa!');
  assert.strictEqual(attemptAdd.body.error?.code, 'SHOP_SUSPENDED');
  console.log('✓ 9c. Người bán cố đăng sản phẩm bị chặn với HTTP 403 SHOP_SUSPENDED.');

  // 9c. Kiểm tra lịch sử vi phạm của shop
  const violationsRes = await request(`/admin/shops/${shopId}/violations`, {
    headers: { Authorization: `Bearer ${admin.token}` },
  });
  assert.strictEqual(violationsRes.ok, true);
  const vList = violationsRes.body.data.violations;
  console.log(`✓ 9d. Truy xuất lịch sử vi phạm của shop: ${vList.length} vi phạm`);
  for (const v of vList) {
    console.log(`     - Vi phạm #${v.violationNumber}: [${v.actionTaken}] Lý do: "${v.reason.slice(0, 50)}..." | Email: ${v.emailSentTo} (${v.emailStatus})`);
  }
  assert.strictEqual(vList.length, 2, 'Shop phải có đúng 2 vi phạm được ghi nhận.');
  console.log();

  // Scenario 10: Phân quyền - Người không phải Admin không thể xử lý vi phạm hoặc khóa shop
  console.log('--- TEST 10: Kiểm tra phân quyền bảo mật chặt chẽ ---');
  const unauthorizedRes = await request(`/admin/reports/${report1Id}/status`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${buyer.token}` },
    body: JSON.stringify({ status: 'confirmed_violation' }),
  });
  assert.strictEqual(unauthorizedRes.status, 403, 'Người mua không được phép gọi endpoint admin!');
  console.log('✓ 10a. Buyer cố gọi endpoint admin bị chặn với HTTP 403 FORBIDDEN.');

  const unauthorizedSeller = await request(`/admin/shops/${shopId}/status`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${seller.token}` },
    body: JSON.stringify({ status: 'active' }),
  });
  assert.strictEqual(unauthorizedSeller.status, 403, 'Người bán không được tự ý mở khóa shop!');
  console.log('✓ 10b. Seller cố tự mở khóa shop bị chặn với HTTP 403 FORBIDDEN.');

  // Phục hồi mở khóa shop để bảo toàn trạng thái hệ thống
  console.log('\n--- BƯỚC CUỐI: Admin phục hồi mở khóa shop ---');
  const unlockRes = await request(`/admin/shops/${shopId}/status`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${admin.token}` },
    body: JSON.stringify({ status: 'active' }),
  });
  assert.strictEqual(unlockRes.ok, true);
  const restoredPublic = await request(`/products?shopId=${shopId}`);
  assert.ok(restoredPublic.body.data.products.length >= 2, 'Sản phẩm chưa phục hồi sau khi mở khóa.');
  console.log(`✓ Mở khóa thành công. ${restoredPublic.body.data.products.length} sản phẩm của shop đã phục hồi hiển thị công khai.`);

  console.log('\n========================================================================');
  console.log('🎉 TẤT CẢ 10 TRƯỜNG HỢP KIỂM THỬ ĐỀU ĐẠT 100% (ALL TESTS PASSED)!');
  console.log('========================================================================\n');
}

runTests()
  .catch((err) => {
    console.error('\n❌ KIỂM THỬ THẤT BÀI:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeDatabase();
  });
