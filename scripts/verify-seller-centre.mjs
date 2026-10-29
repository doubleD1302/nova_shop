import puppeteer from 'puppeteer-core';

async function verifySellerCentre() {
  console.log('1. Lấy token đăng nhập từ Backend API cho demo_seller_a...');
  const res = await fetch('http://localhost:3000/api/v1/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'demo_seller_a', password: 'Seller123456' }),
  });
  const data = await res.json();
  if (!data.success || !data.data?.token) {
    throw new Error(`Đăng nhập thất bại: ${JSON.stringify(data)}`);
  }
  const token = data.data.token;
  const user = data.data.user;
  console.log(`✓ Đã đăng nhập Backend thành công: ${user.fullName} (@${user.username}), shopId: ${user.shopId}`);

  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1440,960'],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 960 });

  console.log('2. Thiết lập phiên đăng nhập vào trình duyệt...');
  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle2' });
  await page.evaluate((tok) => {
    sessionStorage.setItem('novashop_token', tok);
    sessionStorage.setItem('novashop_auth_provider', 'password');
  }, token);

  console.log('3. Mở Kênh Người Bán http://localhost:5173/nguoi-ban...');
  await page.goto('http://localhost:5173/nguoi-ban', { waitUntil: 'networkidle2' });
  await new Promise((r) => setTimeout(r, 2000));
  await page.screenshot({
    path: 'd:/download/nova_shop-main/nova_shop-main/verification-screenshots/step3-seller-dashboard.png',
    fullPage: false,
  });
  console.log('✓ Đã chụp ảnh step3-seller-dashboard.png');

  console.log('4. Mở Quản lý sản phẩm http://localhost:5173/nguoi-ban/san-pham...');
  await page.goto('http://localhost:5173/nguoi-ban/san-pham', { waitUntil: 'networkidle2' });
  await new Promise((r) => setTimeout(r, 2000));
  await page.screenshot({
    path: 'd:/download/nova_shop-main/nova_shop-main/verification-screenshots/step3-seller-products.png',
    fullPage: false,
  });
  console.log('✓ Đã chụp ảnh step3-seller-products.png');

  console.log('5. Mở Quản lý đơn hàng http://localhost:5173/nguoi-ban/don-hang...');
  await page.goto('http://localhost:5173/nguoi-ban/don-hang', { waitUntil: 'networkidle2' });
  await new Promise((r) => setTimeout(r, 2000));
  await page.screenshot({
    path: 'd:/download/nova_shop-main/nova_shop-main/verification-screenshots/step3-seller-orders.png',
    fullPage: false,
  });
  console.log('✓ Đã chụp ảnh step3-seller-orders.png');

  console.log('6. Mở Thông tin gian hàng http://localhost:5173/nguoi-ban/gian-hang...');
  await page.goto('http://localhost:5173/nguoi-ban/gian-hang', { waitUntil: 'networkidle2' });
  await new Promise((r) => setTimeout(r, 2000));
  await page.screenshot({
    path: 'd:/download/nova_shop-main/nova_shop-main/verification-screenshots/step3-seller-shop.png',
    fullPage: false,
  });
  console.log('✓ Đã chụp ảnh step3-seller-shop.png');

  console.log('7. Kiểm tra giao diện Mobile (375x812)...');
  await page.setViewport({ width: 375, height: 812, isMobile: true });
  await page.goto('http://localhost:5173/nguoi-ban', { waitUntil: 'networkidle2' });
  await new Promise((r) => setTimeout(r, 2000));
  await page.screenshot({
    path: 'd:/download/nova_shop-main/nova_shop-main/verification-screenshots/step3-seller-mobile.png',
    fullPage: false,
  });
  console.log('✓ Đã chụp ảnh step3-seller-mobile.png');

  await browser.close();
  console.log('=== TẤT CẢ KIỂM THỬ KÊNH NGƯỜI BÁN ĐÃ HOÀN TẤT THÀNH CÔNG ===');
}

verifySellerCentre().catch(console.error);

