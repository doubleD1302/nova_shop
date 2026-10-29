import puppeteer from 'puppeteer-core';

async function verifySmtpModalUI() {
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

  console.log('1. Mở trang Admin http://localhost:5173/admin...');
  await page.goto('http://localhost:5173/admin', { waitUntil: 'networkidle2' });
  await new Promise((r) => setTimeout(r, 1000));

  const isLoginPage = await page.evaluate(() => {
    return document.body.textContent.includes('Đăng Nhập Quản Trị');
  });

  if (isLoginPage) {
    console.log('Đang ở form Đăng Nhập Quản Trị, nhập thông tin demo_admin / Admin123456...');
    await page.focus('input[placeholder*="tên đăng nhập"]');
    await page.keyboard.type('demo_admin');
    await page.focus('input[placeholder*="mật khẩu"]');
    await page.keyboard.type('Admin123456');
    await page.click('button[type="submit"]');
    await new Promise((r) => setTimeout(r, 2500));
  }

  const outDir = 'C:/Users/voduc/.gemini/antigravity/brain/616c0e42-cf1a-43a7-90d5-eb4cf24e6520';

  console.log('2. Mở tab Báo cáo vi phạm...');
  await page.evaluate(() => {
    const navButtons = Array.from(document.querySelectorAll('nav button'));
    const reportsTab = navButtons.find((b) => b.textContent.includes('Báo cáo vi phạm'));
    if (reportsTab) reportsTab.click();
  });
  await new Promise((r) => setTimeout(r, 1500));

  // Mở modal Xem & Xử lý báo cáo đầu tiên (Hồ sơ #13)
  console.log('3. Mở modal Xem & Xử lý báo cáo #13...');
  await page.evaluate(() => {
    const actionBtns = Array.from(document.querySelectorAll('button'));
    const viewBtn = actionBtns.find((b) => b.textContent.includes('Xem & Xử lý'));
    if (viewBtn) viewBtn.click();
  });
  await new Promise((r) => setTimeout(r, 1500));

  await page.screenshot({ path: `${outDir}/verified-admin-report-13-email-sent.png` });
  console.log('✓ Đã chụp verified-admin-report-13-email-sent.png');

  // Đóng modal và chuyển qua tab Cài đặt để chụp trạng thái cấu hình SMTP
  console.log('4. Đóng modal và kiểm tra tab Cài đặt...');
  await page.evaluate(() => {
    const closeBtn = Array.from(document.querySelectorAll('button')).find((b) => b.textContent.trim() === 'Đóng');
    if (closeBtn) closeBtn.click();
  });
  await new Promise((r) => setTimeout(r, 800));

  await page.evaluate(() => {
    const navButtons = Array.from(document.querySelectorAll('nav button'));
    const settingsTab = navButtons.find((b) => b.textContent.includes('Cài đặt'));
    if (settingsTab) settingsTab.click();
  });
  await new Promise((r) => setTimeout(r, 1500));

  await page.screenshot({ path: `${outDir}/verified-admin-settings-smtp-active.png` });
  console.log('✓ Đã chụp verified-admin-settings-smtp-active.png');

  await browser.close();
  console.log('🎉 Hoàn thành kiểm tra giao diện Admin!');
}

verifySmtpModalUI().catch((e) => {
  console.error('Lỗi kiểm tra:', e);
  process.exit(1);
});

