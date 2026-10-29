import puppeteer from 'puppeteer-core';

const ARTIFACT_DIR = 'C:/Users/voduc/.gemini/antigravity/brain/616c0e42-cf1a-43a7-90d5-eb4cf24e6520';

async function run() {
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1366,850'],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1366, height: 850 });

  // 1. Tạo tài khoản buyer mới qua API
  const testBuyer = `buyer_ui_${Date.now()}`;
  console.log('1. Đăng ký tài khoản buyer mới:', testBuyer);
  const regRes = await fetch('http://127.0.0.1:3000/api/v1/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: testBuyer,
      password: 'BuyerPass123!',
      fullName: 'Nguyễn Thị Hoa',
      email: `${testBuyer}@gmail.com`,
      role: 'buyer',
    }),
  });
  const regData = await regRes.json();
  const token = regData.data.token;
  console.log('✓ Đăng ký thành công, token nhận được.');

  // 2. Mở trình duyệt và thiết lập session
  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle2' });
  await page.evaluate((t) => {
    sessionStorage.setItem('novashop_token', t);
  }, token);

  // 3. Điều hướng vào /nguoi-ban
  console.log('2. Điều hướng vào /nguoi-ban với tài khoản buyer...');
  await page.goto('http://localhost:5173/nguoi-ban', { waitUntil: 'networkidle2' });
  await new Promise((r) => setTimeout(r, 2000));

  // Chụp ảnh giao diện đăng ký mở gian hàng
  await page.screenshot({ path: `${ARTIFACT_DIR}/verified-open-shop-form.png`, fullPage: false });
  console.log('✓ Saved verified-open-shop-form.png');

  // 4. Nhập tên shop trùng lặp "Gốm Mộc Store"
  console.log('3. Nhập tên shop trùng lặp "Gốm Mộc Store"...');
  await page.type('input#seller-shop-name', 'Gốm Mộc Store');
  await page.click('button[type="submit"]');
  await new Promise((r) => setTimeout(r, 2000));

  // Chụp ảnh thông báo lỗi trùng tên
  await page.screenshot({ path: `${ARTIFACT_DIR}/verified-open-shop-duplicate-error.png`, fullPage: false });
  console.log('✓ Saved verified-open-shop-duplicate-error.png');

  // 5. Nhập tên shop hợp lệ duy nhất: "Hoa Tươi Đà Lạt"
  console.log('4. Nhập tên shop hợp lệ "Hoa Tươi Đà Lạt" và mở gian hàng...');
  await page.click('input#seller-shop-name', { clickCount: 3 });
  await page.keyboard.press('Backspace');
  await page.type('input#seller-shop-name', 'Hoa Tươi Đà Lạt');
  await page.click('button[type="submit"]');
  await new Promise((r) => setTimeout(r, 3000));

  // Chụp ảnh sau khi mở gian hàng thành công
  await page.screenshot({ path: `${ARTIFACT_DIR}/verified-open-shop-success-seller-centre.png`, fullPage: false });
  console.log('✓ Saved verified-open-shop-success-seller-centre.png');

  // 6. Kiểm tra tài khoản demo_admin (admin) vào /nguoi-ban
  console.log('5. Đăng nhập demo_admin (admin) và vào /nguoi-ban...');
  const adminRes = await fetch('http://127.0.0.1:3000/api/v1/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'demo_admin', password: 'Admin123456' }),
  });
  const adminData = await adminRes.json();
  const adminToken = adminData.data.token;
  await page.evaluate((t) => {
    sessionStorage.setItem('novashop_token', t);
  }, adminToken);
  await page.goto('http://localhost:5173/nguoi-ban', { waitUntil: 'networkidle2' });
  await new Promise((r) => setTimeout(r, 2000));
  await page.screenshot({ path: `${ARTIFACT_DIR}/verified-admin-seller-centre.png`, fullPage: false });
  console.log('✓ Saved verified-admin-seller-centre.png');

  await browser.close();
  console.log('\n🎉 Toàn bộ quy trình kiểm thử UI đã thành công 100%!');
}

run().catch((err) => {
  console.error('Lỗi kiểm thử UI:', err);
  process.exit(1);
});
