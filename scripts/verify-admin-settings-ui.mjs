import puppeteer from 'puppeteer-core';

async function verifySettings() {
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1400,900'],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1400, height: 900 });

  await page.goto('http://localhost:5173/admin', { waitUntil: 'networkidle2' });
  await new Promise((r) => setTimeout(r, 1000));

  const isLoginPage = await page.evaluate(() => {
    return document.body.textContent.includes('Đăng Nhập Quản Trị');
  });

  if (isLoginPage) {
    await page.focus('input[placeholder*="tên đăng nhập"]');
    await page.keyboard.type('demo_admin');
    await page.focus('input[placeholder*="mật khẩu"]');
    await page.keyboard.type('Admin123456');
    await page.click('button[type="submit"]');
    await new Promise((r) => setTimeout(r, 2500));
  }

  // Chuyển sang Tab Cài đặt
  await page.evaluate(() => {
    const navButtons = Array.from(document.querySelectorAll('nav button'));
    const settingsTab = navButtons.find((b) => b.textContent.includes('Cài đặt'));
    if (settingsTab) settingsTab.click();
  });
  await new Promise((r) => setTimeout(r, 1500));

  const outDir = 'C:/Users/voduc/.gemini/antigravity/brain/616c0e42-cf1a-43a7-90d5-eb4cf24e6520';
  await page.screenshot({ path: `${outDir}/verified-admin-settings.png` });
  console.log('✓ Đã chụp verified-admin-settings.png');

  await browser.close();
}

verifySettings().catch(console.error);

