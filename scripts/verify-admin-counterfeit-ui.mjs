import puppeteer from 'puppeteer-core';

async function verifyAdminUI() {
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1400,900'],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1400, height: 900 });

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      console.log('BROWSER ERROR:', msg.text());
    }
  });

  console.log('1. Truy cập trực tiếp trang Quản trị Admin: http://localhost:5173/admin...');
  await page.goto('http://localhost:5173/admin', { waitUntil: 'networkidle2' });
  await new Promise((r) => setTimeout(r, 1000));

  const isLoginPage = await page.evaluate(() => {
    return document.body.textContent.includes('Đăng Nhập Quản Trị');
  });

  if (isLoginPage) {
    console.log('Đang ở form Đăng Nhập Quản Trị, tiến hành đăng nhập demo_admin...');
    await page.focus('input[placeholder*="tên đăng nhập"]');
    await page.keyboard.type('demo_admin');
    await page.focus('input[placeholder*="mật khẩu"]');
    await page.keyboard.type('Admin123456');
    await page.click('button[type="submit"]');
    await new Promise((r) => setTimeout(r, 2500));
  }

  const outDir = 'C:/Users/voduc/.gemini/antigravity/brain/616c0e42-cf1a-43a7-90d5-eb4cf24e6520';

  console.log('2. Chuyển sang tab Báo cáo vi phạm...');
  await page.evaluate(() => {
    const navButtons = Array.from(document.querySelectorAll('nav button'));
    const reportsTab = navButtons.find((b) => b.textContent.includes('Báo cáo vi phạm'));
    if (reportsTab) reportsTab.click();
  });
  await new Promise((r) => setTimeout(r, 1500));

  // Chụp ảnh danh sách báo cáo
  await page.screenshot({ path: `${outDir}/verified-admin-reports-view.png` });
  console.log('✓ Đã chụp verified-admin-reports-view.png');

  // Mở modal Xem & Xử lý báo cáo đầu tiên
  console.log('3. Mở modal Xem & Xử lý báo cáo đầu tiên...');
  await page.evaluate(() => {
    const actionBtns = Array.from(document.querySelectorAll('button'));
    const viewBtn = actionBtns.find((b) => b.textContent.includes('Xem & Xử lý'));
    if (viewBtn) viewBtn.click();
  });
  await new Promise((r) => setTimeout(r, 1200));

  await page.screenshot({ path: `${outDir}/verified-admin-report-detail-modal.png` });
  console.log('✓ Đã chụp verified-admin-report-detail-modal.png');

  // Đóng modal chi tiết báo cáo
  console.log('Đóng modal chi tiết báo cáo...');
  await page.evaluate(() => {
    const closeBtns = Array.from(document.querySelectorAll('button'));
    const closeBtn = closeBtns.find((b) => b.textContent.trim() === 'Đóng');
    if (closeBtn) closeBtn.click();
  });
  await new Promise((r) => setTimeout(r, 1000));

  // Chuyển sang tab Quản lý shop
  console.log('4. Chuyển sang tab Quản lý shop...');
  await page.evaluate(() => {
    const navButtons = Array.from(document.querySelectorAll('nav button'));
    const shopsTab = navButtons.find((b) => b.textContent.includes('Quản lý shop'));
    if (shopsTab) shopsTab.click();
  });
  await new Promise((r) => setTimeout(r, 1500));

  await page.screenshot({ path: `${outDir}/verified-admin-shops-view.png` });
  console.log('✓ Đã chụp verified-admin-shops-view.png');

  // Mở modal Lịch sử vi phạm shop
  console.log('5. Mở modal Lịch sử vi phạm shop...');
  await page.evaluate(() => {
    const violBtns = Array.from(document.querySelectorAll('button'));
    const violBtn = violBtns.find((b) => b.textContent.includes('vi phạm') && b.textContent.includes('Xem lịch sử'));
    if (violBtn) violBtn.click();
  });
  await new Promise((r) => setTimeout(r, 1500));

  await page.screenshot({ path: `${outDir}/verified-admin-shop-violations-modal.png` });
  console.log('✓ Đã chụp verified-admin-shop-violations-modal.png');

  await browser.close();
  console.log('🎉 Hoàn tất chụp toàn bộ xác minh giao diện Admin!');
}

verifyAdminUI().catch((err) => {
  console.error('Lỗi kiểm tra Puppeteer:', err);
  process.exit(1);
});
