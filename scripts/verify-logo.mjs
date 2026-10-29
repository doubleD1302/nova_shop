import puppeteer from 'puppeteer-core';

async function verifyLogo() {
  const res = await fetch('http://localhost:3000/api/v1/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'demo_seller_a', password: 'Seller123456' }),
  });
  const data = await res.json();
  const token = data.data.token;

  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1440,960'],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 960 });

  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle2' });
  await page.evaluate((tok) => {
    sessionStorage.setItem('novashop_token', tok);
    sessionStorage.setItem('novashop_auth_provider', 'password');
  }, token);

  console.log('Chụp ảnh Kênh Người Bán với logo chính thức...');
  await page.goto('http://localhost:5173/nguoi-ban', { waitUntil: 'networkidle2' });
  await new Promise((r) => setTimeout(r, 1500));
  await page.screenshot({
    path: 'd:/download/nova_shop-main/nova_shop-main/verification-screenshots/verified-seller-official-logo.png',
    fullPage: false,
  });
  console.log('✓ Đã chụp verified-seller-official-logo.png');

  await browser.close();
}

verifyLogo().catch(console.error);

