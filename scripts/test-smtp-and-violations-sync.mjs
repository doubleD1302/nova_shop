import assert from 'node:assert';
import { executeQuery, closeDatabase } from '../data-api/src/config/database.js';
import { sendViolationEmail, getEmailServiceStatus } from '../backend/src/services/email.service.js';

const BACKEND_URL = 'http://127.0.0.1:3000/api/v1';

async function request(path, options = {}) {
  const url = `${BACKEND_URL}${path}`;
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  const res = await fetch(url, { ...options, headers });
  const body = await res.json().catch(() => null);
  return { status: res.status, ok: res.ok, body };
}

async function login(username, password) {
  const { ok, body } = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
  assert.strictEqual(ok, true, `Đăng nhập ${username} thất bại: ${body?.message}`);
  return { token: body.data.token, user: body.data.user };
}

async function runAllTests() {
  console.log('========================================================================');
  console.log('🧪 BẮT ĐẦU KIỂM THỬ ĐỒNG BỘ TRẠNG THÁI EMAIL VÀ CHẾ TÀI VI PHẠM');
  console.log('========================================================================\n');

  console.log('--- BƯỚC 1: Đăng nhập các chủ thể ---');
  const buyer = await login('demo_buyer', 'Buyer123456');
  console.log('✓ Buyer:', buyer.user.username, '(ID:', buyer.user.id, ')');

  const seller = await login('demo_seller_a', 'Seller123456');
  console.log('✓ Seller:', seller.user.username, '(Shop ID:', seller.user.shopId, ', Email:', seller.user.email, ')');
  const shopId = String(seller.user.shopId);

  const admin = await login('demo_admin', 'Admin123456');
  console.log('✓ Admin:', admin.user.username, '(ID:', admin.user.id, ')\n');

  // Làm sạch dữ liệu vi phạm cũ để kiểm thử độc lập
  await executeQuery('DELETE FROM shop_violations WHERE shop_id = ?', [shopId]);
  await executeQuery(
    "UPDATE shops SET status = 'active', suspension_reason = NULL, suspended_at = NULL, suspended_by = NULL WHERE id = ?",
    [shopId]
  );
  console.log('✓ Môi trường kiểm thử đã được chuẩn bị sạch sẽ.');

  // Lấy 2 sản phẩm của shop
  const productsRes = await request(`/products?shopId=${shopId}&fullImages=1`);
  assert.strictEqual(productsRes.ok, true);
  const products = productsRes.body.data.products;
  assert.ok(products.length >= 2, 'Shop cần ít nhất 2 sản phẩm.');
  const prod1 = products[0];
  const prod2 = products[1];

  // ====================================================================
  // TEST 1: SMTP chưa cấu hình -> Không được báo đã gửi
  // ====================================================================
  console.log('\n--- TEST 1: Kiểm tra SMTP chưa cấu hình ---');
  const emailStatusRes = await request('/admin/email-status', {
    headers: { Authorization: `Bearer ${admin.token}` },
  });
  assert.strictEqual(emailStatusRes.ok, true);
  console.log('✓ Trạng thái dịch vụ email từ Backend:', emailStatusRes.body.data);
  assert.strictEqual(emailStatusRes.body.data.isConfigured, false, 'Khi chưa có biến môi trường thật, isConfigured phải là false');
  assert.strictEqual(emailStatusRes.body.data.password, undefined, 'Mật khẩu SMTP tuyệt đối không được trả về trong API');

  const testUnconfiguredSend = await sendViolationEmail({
    to: 'seller@shopnova.vn',
    shopName: 'Shop Mẫu',
    reason: 'Thử nghiệm khi chưa cấu hình',
    violationNumber: 1,
    actionTaken: 'warning_email',
  });
  assert.strictEqual(testUnconfiguredSend.status, 'not_configured', 'Phải trả về trạng thái not_configured');
  assert.strictEqual(testUnconfiguredSend.success, false, 'success phải là false khi chưa cấu hình');
  console.log('✓ sendViolationEmail trả về chính xác { status: "not_configured" }, KHÔNG báo thành công giả!');

  // ====================================================================
  // TEST 2: SMTP cấu hình sai -> Báo lỗi thất bại (failed) rõ ràng
  // ====================================================================
  console.log('\n--- TEST 2: Kiểm tra khi cấu hình SMTP bị sai thông số ---');
  // Giả lập cấu hình sai thông qua biến môi trường tạm thời
  const prevHost = process.env.SMTP_HOST;
  const prevUser = process.env.SMTP_USER;
  const prevPass = process.env.SMTP_PASS;
  process.env.SMTP_HOST = '127.0.0.1';
  process.env.SMTP_PORT = '19999'; // Cổng không có dịch vụ SMTP nào lắng nghe
  process.env.SMTP_USER = 'invalid_user@test.local';
  process.env.SMTP_PASS = 'invalid_real_secret_123';

  const testFailedSend = await sendViolationEmail({
    to: 'seller@shopnova.vn',
    shopName: 'Shop Mẫu',
    reason: 'Thử nghiệm cấu hình SMTP sai',
    violationNumber: 1,
    actionTaken: 'warning_email',
  });
  assert.strictEqual(testFailedSend.status, 'failed', 'Cấu hình SMTP sai phải trả về trạng thái failed');
  assert.strictEqual(testFailedSend.success, false);
  assert.ok(testFailedSend.error.includes('Lỗi kết nối máy chủ gửi mail'), 'Phải có thông điệp lỗi rõ ràng');
  console.log('✓ Khi cấu hình SMTP sai: trả về { status: "failed" }, lỗi:', testFailedSend.error);

  // Phục hồi lại biến môi trường ban đầu
  if (prevHost) process.env.SMTP_HOST = prevHost; else delete process.env.SMTP_HOST;
  if (prevUser) process.env.SMTP_USER = prevUser; else delete process.env.SMTP_USER;
  if (prevPass) process.env.SMTP_PASS = prevPass; else delete process.env.SMTP_PASS;

  // ====================================================================
  // TEST 3: Xác minh mẫu email HTML Terracotta & Cream hợp lệ
  // ====================================================================
  console.log('\n--- TEST 3: Xác minh mẫu email HTML hợp chuẩn NOVA SHOP ---');
  assert.ok(testUnconfiguredSend.emailContent, 'Nội dung email phải được sinh đầy đủ');
  assert.ok(testUnconfiguredSend.subject.includes('[NOVA SHOP]'), 'Tiêu đề email phải có tiền tố NOVA SHOP');
  console.log('✓ Tiêu đề email:', testUnconfiguredSend.subject);
  console.log('✓ Độ dài nội dung email:', testUnconfiguredSend.emailContent.length, 'ký tự');

  // ====================================================================
  // TEST 4: Vi phạm lần 1 -> Ghi nhận cảnh cáo, shop vẫn active
  // ====================================================================
  console.log('\n--- TEST 4: Người mua gửi báo cáo #1 & Admin xác nhận vi phạm lần 1 ---');
  const rep1Res = await request('/reports', {
    method: 'POST',
    headers: { Authorization: `Bearer ${buyer.token}` },
    body: JSON.stringify({
      targetType: 'product',
      targetId: prod1.id,
      reason: 'Nghi ngờ hàng nhái: Bao bì không đúng chuẩn chính hãng',
      details: 'Sản phẩm giao về có dấu hiệu tem dán lệch, mực in nhòe.',
    }),
  });
  assert.strictEqual(rep1Res.status, 201);
  const report1Id = rep1Res.body.data.reportId;
  console.log('✓ Tạo báo cáo #1 thành công. Report ID:', report1Id);

  const confirm1Res = await request(`/admin/reports/${report1Id}/status`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${admin.token}` },
    body: JSON.stringify({ status: 'confirmed_violation' }),
  });
  assert.strictEqual(confirm1Res.ok, true);
  const data1 = confirm1Res.body.data;
  assert.strictEqual(data1.violationNumber, 1, 'Lần vi phạm phải bằng 1');
  assert.strictEqual(data1.actionTaken, 'warning_email', 'Chế tài phải là warning_email');
  assert.strictEqual(data1.shopStatus, 'active', 'Shop vẫn active sau lần 1');
  assert.strictEqual(data1.emailStatus, 'not_configured', 'Trạng thái email phải là not_configured khi chưa cấu hình');
  assert.strictEqual(data1.ownerEmail, 'seller@shopnova.vn', 'Email nhận phải đúng email chủ shop');
  console.log('✓ Vi phạm lần 1 ghi nhận thành công: vi phạm #1, shop active, trạng thái email: not_configured');

  // ====================================================================
  // TEST 5: Xử lý lại cùng báo cáo -> Idempotent, không tăng số lần vi phạm
  // ====================================================================
  console.log('\n--- TEST 5: Admin xác nhận lại cùng báo cáo #1 (Idempotency) ---');
  const repeatConfirm = await request(`/admin/reports/${report1Id}/status`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${admin.token}` },
    body: JSON.stringify({ status: 'confirmed_violation' }),
  });
  assert.strictEqual(repeatConfirm.ok, true);
  assert.strictEqual(repeatConfirm.body.data.violationNumber, 1, 'Không được tăng lần vi phạm khi xác nhận lại');
  assert.strictEqual(repeatConfirm.body.data.isNewViolation, false, 'isNewViolation phải là false');
  console.log('✓ Idempotency bảo đảm: Vi phạm không bị đếm tăng trùng lặp.');

  // ====================================================================
  // TEST 6: Thao tác Thử gửi lại email (Retry Email)
  // ====================================================================
  console.log('\n--- TEST 6: Admin bấm "Thử gửi lại email" cho vi phạm #1 ---');
  const violationId = data1.violationId;
  const retryRes = await request(`/admin/violations/${violationId}/retry-email`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${admin.token}` },
  });
  assert.strictEqual(retryRes.ok, true);
  assert.strictEqual(retryRes.body.data.violationId, String(violationId));
  assert.strictEqual(retryRes.body.data.emailStatus, 'not_configured');
  assert.strictEqual(retryRes.body.data.emailSentTo, 'seller@shopnova.vn');
  console.log('✓ Retry email trả về đúng trạng thái:', retryRes.body.data.emailStatus, '| Người nhận:', retryRes.body.data.emailSentTo);

  // Kiểm tra số lượng vi phạm của shop không bị tăng khi retry
  const shopViolationsCheck = await request(`/admin/shops/${shopId}/violations`, {
    headers: { Authorization: `Bearer ${admin.token}` },
  });
  assert.strictEqual(shopViolationsCheck.body.data.violations.length, 1, 'Thao tác retry không được tạo bản ghi vi phạm mới');
  console.log('✓ Thao tác retry KHÔNG tạo thêm vi phạm mới trong database.');

  // ====================================================================
  // TEST 7: Vi phạm lần 2 -> TỰ ĐỘNG KHÓA SHOP & GỬI THÔNG BÁO KHÓA
  // ====================================================================
  console.log('\n--- TEST 7: Báo cáo thứ hai & Xác nhận vi phạm lần 2 (Tự động khóa shop) ---');
  const rep2Res = await request('/reports', {
    method: 'POST',
    headers: { Authorization: `Bearer ${buyer.token}` },
    body: JSON.stringify({
      targetType: 'product',
      targetId: prod2.id,
      reason: 'Hàng giả thương hiệu: Logo in sai font và sai xuất xứ',
      details: 'Sản phẩm thứ hai vi phạm chính sách hàng hóa của sàn.',
    }),
  });
  assert.strictEqual(rep2Res.status, 201);
  const report2Id = rep2Res.body.data.reportId;

  const confirm2Res = await request(`/admin/reports/${report2Id}/status`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${admin.token}` },
    body: JSON.stringify({ status: 'confirmed_violation' }),
  });
  assert.strictEqual(confirm2Res.ok, true);
  const data2 = confirm2Res.body.data;
  assert.strictEqual(data2.violationNumber, 2, 'Lần vi phạm phải bằng 2');
  assert.strictEqual(data2.actionTaken, 'shop_suspended', 'Chế tài phải là shop_suspended');
  assert.strictEqual(data2.shopStatus, 'suspended', 'Shop phải tự động chuyển thành suspended');
  console.log('✓ Vi phạm lần 2 kích hoạt tự động khóa shop thành công!');

  // Kiểm tra sản phẩm bị ẩn và người bán không được đăng thêm
  const publicList = await request(`/products?shopId=${shopId}`);
  assert.strictEqual(publicList.body.data.products.length, 0, 'Sản phẩm phải bị ẩn khỏi sàn khi shop bị khóa');

  const addAttempt = await request('/seller/products', {
    method: 'POST',
    headers: { Authorization: `Bearer ${seller.token}` },
    body: JSON.stringify({
      name: 'Sản phẩm đăng lén khi bị khóa',
      categoryId: prod1.categoryId,
      price: 100000,
      stock: 10,
      description: 'Test block',
      status: 'active',
    }),
  });
  assert.strictEqual(addAttempt.status, 403, 'Người bán bị khóa phải nhận HTTP 403 khi đăng sản phẩm');
  console.log('✓ Shop bị khóa: Sản phẩm ẩn khỏi sàn & Người bán bị chặn đăng sản phẩm mới (HTTP 403).');

  // ====================================================================
  // TEST 8: Phân quyền bảo mật (RBAC)
  // ====================================================================
  console.log('\n--- TEST 8: Phân quyền bảo mật chặt chẽ ---');
  const buyerRetry = await request(`/admin/violations/${violationId}/retry-email`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${buyer.token}` },
  });
  assert.strictEqual(buyerRetry.status, 403, 'Buyer gọi retry-email phải bị 403');

  const sellerRetry = await request(`/admin/violations/${violationId}/retry-email`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${seller.token}` },
  });
  assert.strictEqual(sellerRetry.status, 403, 'Seller gọi retry-email phải bị 403');

  const buyerViolations = await request(`/admin/shops/${shopId}/violations`, {
    headers: { Authorization: `Bearer ${buyer.token}` },
  });
  assert.strictEqual(buyerViolations.status, 403, 'Buyer xem lịch sử vi phạm phải bị 403');
  console.log('✓ Buyer và Seller bị chặn hoàn toàn khi truy cập các endpoint quản trị vi phạm (HTTP 403).');

  // ====================================================================
  // TEST 9: Tính toàn vẹn sau khi tải lại trang (Persistence)
  // ====================================================================
  console.log('\n--- TEST 9: Kiểm tra dữ liệu bền vững khi tải lại trang ---');
  const reloadReports = await request('/admin/reports', {
    headers: { Authorization: `Bearer ${admin.token}` },
  });
  assert.strictEqual(reloadReports.ok, true);
  const foundR1 = reloadReports.body.data.reports.find((r) => String(r.id) === String(report1Id));
  const foundR2 = reloadReports.body.data.reports.find((r) => String(r.id) === String(report2Id));
  assert.ok(foundR1 && foundR2, 'Cả hai báo cáo phải tồn tại trong danh sách admin sau khi reload');
  assert.strictEqual(foundR1.violationNumber, 1);
  assert.strictEqual(foundR2.violationNumber, 2);
  assert.strictEqual(foundR1.violationEmailStatus, 'not_configured');
  assert.strictEqual(foundR2.violationEmailStatus, 'not_configured');

  const reloadViolations = await request(`/admin/shops/${shopId}/violations`, {
    headers: { Authorization: `Bearer ${admin.token}` },
  });
  assert.strictEqual(reloadViolations.body.data.violations.length, 2, 'Lịch sử vi phạm shop phải có đúng 2 bản ghi');
  console.log('✓ Dữ liệu báo cáo, vi phạm và trạng thái email bền vững 100% trong DB.');

  // Mở khóa phục hồi shop để hoàn tất
  console.log('\n--- BƯỚC CUỐI: Admin phục hồi mở khóa shop ---');
  const unlockRes = await request(`/admin/shops/${shopId}/status`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${admin.token}` },
    body: JSON.stringify({ status: 'active' }),
  });
  assert.strictEqual(unlockRes.ok, true);
  console.log('✓ Mở khóa shop thành công. Trạng thái hệ thống đã phục hồi an toàn.');

  console.log('\n========================================================================');
  console.log('🎉 TẤT CẢ 9 BÀI KIỂM THỬ ĐỒNG BỘ EMAIL VÀ CHẾ TÀI ĐỀU ĐẠT 100% (PASSED)!');
  console.log('========================================================================\n');
}

runAllTests()
  .catch((err) => {
    console.error('\n❌ KIỂM THỬ THẤT BÀI:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeDatabase();
  });

