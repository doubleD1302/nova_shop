import puppeteer from 'puppeteer-core';
import fs from 'node:fs';

const ARTIFACT_DIR = 'C:/Users/voduc/.gemini/antigravity/brain/616c0e42-cf1a-43a7-90d5-eb4cf24e6520';

async function run() {
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1366,850'],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1366, height: 850 });

  // 1. Đăng nhập demo_buyer
  console.log('1. Đăng nhập Buyer để vào trang sản phẩm...');
  await page.goto('http://localhost:5173/dang-nhap', { waitUntil: 'networkidle2' });
  await page.type('input[placeholder="minhanh / ankerseller / cocoonseller"]', 'demo_buyer');
  await page.type('input[placeholder="Mật khẩu tài khoản"]', 'Buyer123456');
  await page.click('button[type="submit"]');
  await new Promise((r) => setTimeout(r, 1500));

  // Vào trang chi tiết sản phẩm đầu tiên
  console.log('2. Mở trang chi tiết sản phẩm...');
  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle2' });
  await new Promise((r) => setTimeout(r, 1500));

  // Click vào sản phẩm đầu tiên
  const productCard = await page.$('a[href^="/san-pham/"]');
  if (productCard) {
    await productCard.click();
    await page.waitForNavigation({ waitUntil: 'networkidle2' }).catch(() => {});
    await new Promise((r) => setTimeout(r, 1500));
  }

  // Chụp trang chi tiết sản phẩm có nút Báo cáo
  await page.screenshot({ path: `${ARTIFACT_DIR}/step4-product-detail-report-button.png`, fullPage: false });
  console.log('✓ Saved step4-product-detail-report-button.png');

  // Click mở Modal Báo cáo sản phẩm
  const reportBtn = await page.evaluateHandle(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    return btns.find((b) => b.textContent.includes('Báo cáo sản phẩm')) || null;
  });
  if (reportBtn && reportBtn.asElement()) {
    await reportBtn.asElement().click();
    await new Promise((r) => setTimeout(r, 1000));
    await page.screenshot({ path: `${ARTIFACT_DIR}/step4-buyer-report-modal.png`, fullPage: false });
    console.log('✓ Saved step4-buyer-report-modal.png');
  }

  // 3. Đăng nhập Admin
  console.log('3. Đăng nhập Admin...');
  await page.goto('http://localhost:5173/admin', { waitUntil: 'networkidle2' });
  await new Promise((r) => setTimeout(r, 1000));

  // Nếu hiện form đăng nhập Admin:
  const adminUserInput = await page.$('input#admin-login-username');
  if (adminUserInput) {
    await page.type('input#admin-login-username', 'admin');
    await page.type('input#admin-login-password', 'Admin@123456');
    await page.click('button[type="submit"]');
    await new Promise((r) => setTimeout(r, 2000));
  }

  // 4. Mở Tab Báo cáo vi phạm trong Admin
  console.log('4. Chuyển sang Tab Báo cáo vi phạm...');
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const reportsBtn = btns.find((b) => b.textContent.includes('Báo cáo vi phạm'));
    if (reportsBtn) reportsBtn.click();
  });
  await new Promise((r) => setTimeout(r, 1500));
  await page.screenshot({ path: `${ARTIFACT_DIR}/step4-admin-reports-tab.png`, fullPage: false });
  console.log('✓ Saved step4-admin-reports-tab.png');

  // Mở modal Chi tiết báo cáo
  const detailBtn = await page.evaluateHandle(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    return btns.find((b) => b.textContent.includes('Xem & Xử lý')) || null;
  });
  if (detailBtn && detailBtn.asElement()) {
    await detailBtn.asElement().click();
    await new Promise((r) => setTimeout(r, 1000));
    await page.screenshot({ path: `${ARTIFACT_DIR}/step4-admin-report-detail-modal.png`, fullPage: false });
    console.log('✓ Saved step4-admin-report-detail-modal.png');

    // Đóng modal
    await page.evaluate(() => {
      const closeBtns = Array.from(document.querySelectorAll('button'));
      const close = closeBtns.find((b) => b.textContent.trim() === 'Đóng' || b.textContent.trim() === '✕');
      if (close) close.click();
    });
    await new Promise((r) => setTimeout(r, 500));
  }

  // 5. Mở Tab Quản lý shop trong Admin
  console.log('5. Chuyển sang Tab Quản lý shop...');
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const shopsBtn = btns.find((b) => b.textContent.includes('Quản lý shop'));
    if (shopsBtn) shopsBtn.click();
  });
  await new Promise((r) => setTimeout(r, 1500));
  await page.screenshot({ path: `${ARTIFACT_DIR}/step4-admin-shops-tab.png`, fullPage: false });
  console.log('✓ Saved step4-admin-shops-tab.png');

  // Click mở Modal Khóa Shop
  const lockBtn = await page.evaluateHandle(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    return btns.find((b) => b.textContent.includes('Khóa shop')) || null;
  });
  if (lockBtn && lockBtn.asElement()) {
    await lockBtn.asElement().click();
    await new Promise((r) => setTimeout(r, 1000));
    await page.screenshot({ path: `${ARTIFACT_DIR}/step4-admin-lock-shop-modal.png`, fullPage: false });
    console.log('✓ Saved step4-admin-lock-shop-modal.png');

    // Đóng modal
    await page.evaluate(() => {
      const closeBtns = Array.from(document.querySelectorAll('button'));
      const close = closeBtns.find((b) => b.textContent.trim() === 'Hủy bỏ' || b.textContent.trim() === '✕');
      if (close) close.click();
    });
    await new Promise((r) => setTimeout(r, 500));
  }

  // 6. Tạm khóa shop và xem Kênh Người Bán
  console.log('6. Khóa shop 1 tạm thời và chụp Kênh Người Bán...');
  await fetch('http://127.0.0.1:3000/api/v1/admin/shops/1/status', {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${await (async () => {
        const res = await fetch('http://127.0.0.1:3000/api/v1/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: 'demo_admin', password: 'Admin123456' }),
        });
        const d = await res.json();
        return d.data.token;
      })()}`,
    },
    body: JSON.stringify({
      status: 'suspended',
      reason: 'Bán sản phẩm có dấu hiệu sao chép, làm giả tem nhãn theo hồ sơ kiểm định #3.',
    }),
  });

  // Đăng nhập Seller
  await page.goto('http://localhost:5173/dang-nhap', { waitUntil: 'networkidle2' });
  await page.type('input[placeholder="minhanh / ankerseller / cocoonseller"]', 'demo_seller_a');
  await page.type('input[placeholder="Mật khẩu tài khoản"]', 'Seller123456');
  await page.click('button[type="submit"]');
  await new Promise((r) => setTimeout(r, 2000));

  await page.goto('http://localhost:5173/nguoi-ban', { waitUntil: 'networkidle2' });
  await new Promise((r) => setTimeout(r, 2000));
  await page.screenshot({ path: `${ARTIFACT_DIR}/step4-seller-suspended-banner.png`, fullPage: false });
  console.log('✓ Saved step4-seller-suspended-banner.png');

  // Mở trang Đăng sản phẩm mới của Seller
  await page.goto('http://localhost:5173/nguoi-ban/san-pham/them-moi', { waitUntil: 'networkidle2' });
  await new Promise((r) => setTimeout(r, 2000));
  await page.screenshot({ path: `${ARTIFACT_DIR}/step4-seller-product-form-suspended.png`, fullPage: false });
  console.log('✓ Saved step4-seller-product-form-suspended.png');

  // 7. Khôi phục mở khóa lại cho Shop 1
  console.log('7. Khôi phục mở khóa cho shop 1...');
  await fetch('http://127.0.0.1:3000/api/v1/admin/shops/1/status', {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${await (async () => {
        const res = await fetch('http://127.0.0.1:3000/api/v1/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: 'demo_admin', password: 'Admin123456' }),
        });
        const d = await res.json();
        return d.data.token;
      })()}`,
    },
    body: JSON.stringify({ status: 'active' }),
  });
  console.log('✓ Shop 1 restored to active.');

  await browser.close();
  console.log('\n🎉 Đã chụp toàn bộ ảnh minh chứng UI thành công!');
}

run().catch(console.error);

