import puppeteer from 'puppeteer-core';

async function takeScreenshots() {
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1280,900'],
  });

  const page = await browser.newPage();
  page.setViewport({ width: 1280, height: 900 });

  // 1. Seller Products list
  await page.goto('http://localhost:5174/dang-nhap', { waitUntil: 'networkidle2' });
  await page.type('input[placeholder="minhanh / ankerseller / cocoonseller"]', 'demo_seller_a');
  await page.type('input[placeholder="Mật khẩu tài khoản"]', 'Seller123456');
  await page.click('form.space-y-4 button[type="submit"]');
  await new Promise(r => setTimeout(r, 2000));

  await page.goto('http://localhost:5174/nguoi-ban/san-pham', { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 2000));
  await page.screenshot({ path: 'd:/download/nova_shop-main/nova_shop-main/screenshot_seller_products.png', fullPage: true });
  console.log('Saved screenshot_seller_products.png');

  // 2. Product Detail page
  await page.goto('http://localhost:5174/san-pham/tai-nghe-bluetooth-sony-wh-1000xm4-khong-day-chong-on-dinh-cao-73ca38a261', { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 2000));
  await page.screenshot({ path: 'd:/download/nova_shop-main/nova_shop-main/screenshot_product_detail.png', fullPage: true });
  console.log('Saved screenshot_product_detail.png');

  // 3. Homepage
  await page.goto('http://localhost:5174/', { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 2000));
  await page.screenshot({ path: 'd:/download/nova_shop-main/nova_shop-main/screenshot_homepage.png', fullPage: false });
  console.log('Saved screenshot_homepage.png');

  await browser.close();
}

takeScreenshots().catch(console.error);

