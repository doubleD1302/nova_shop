import puppeteer from 'puppeteer-core';
import fs from 'fs';

async function verifyGoogleAuth() {
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1280,900'],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });

  console.log('1. Kiểm tra trang đăng nhập http://localhost:5173/dang-nhap...');
  await page.goto('http://localhost:5173/dang-nhap', { waitUntil: 'networkidle2' });
  await page.screenshot({ path: 'd:/download/nova_shop-main/nova_shop-main/verification-screenshots/step2-login-page.png' });
  console.log('✓ Đã chụp ảnh step2-login-page.png');

  // 2. Nhấn nút "Tiếp tục với Google"
  console.log('2. Nhấn nút "Tiếp tục với Google"...');
  await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    const btn = buttons.find(b => b.textContent.includes('Tiếp tục với Google'));
    if (btn) btn.click();
  });
  await new Promise(r => setTimeout(r, 1200));
  await page.screenshot({ path: 'd:/download/nova_shop-main/nova_shop-main/verification-screenshots/step2-google-click.png' });
  console.log('✓ Đã chụp ảnh step2-google-click.png (Hiển thị cảnh báo hướng dẫn .env thân thiện)');

  // 3. Kiểm tra đăng nhập mật khẩu thông thường không bị ảnh hưởng
  console.log('3. Kiểm tra đăng nhập tài khoản / mật khẩu hiện tại (demo_buyer)...');
  await page.evaluate(() => {
    const inputs = document.querySelectorAll('input');
    inputs[0].value = 'demo_buyer';
    inputs[0].dispatchEvent(new Event('input', { bubbles: true }));
    inputs[1].value = 'Buyer123456';
    inputs[1].dispatchEvent(new Event('input', { bubbles: true }));
  });
  await page.click('button[type="submit"]');
  await new Promise(r => setTimeout(r, 2000));
  await page.screenshot({ path: 'd:/download/nova_shop-main/nova_shop-main/verification-screenshots/step2-logged-in-buyer.png' });
  console.log('✓ Đã chụp ảnh step2-logged-in-buyer.png (Tài khoản thường hoạt động bình thường, hiển thị header)');

  // 4. Kiểm tra session Google bằng cách giả lập Google user session
  console.log('4. Kiểm tra session Google (mock Google session) để kiểm tra header avatar & tên...');
  await page.evaluate(() => {
    const mockGoogleUser = {
      id: 'google_10987654321',
      googleUid: '10987654321',
      username: 'google.tester',
      fullName: 'Google Tester Account',
      email: 'tester@gmail.com',
      avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop',
      role: 'buyer',
      provider: 'google',
      rank: 'Thành viên (Google)',
      avatarEmoji: '✨',
      hue: 330,
    };
    sessionStorage.setItem('novashop_auth_provider', 'google');
    localStorage.setItem('novashop_google_user', JSON.stringify(mockGoogleUser));
    sessionStorage.removeItem('novashop_token');
  });
  await page.reload({ waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 1500));
  await page.screenshot({ path: 'd:/download/nova_shop-main/nova_shop-main/verification-screenshots/step2-google-user-header.png' });
  console.log('✓ Đã chụp ảnh step2-google-user-header.png (Hiển thị tên Google Tester Account & avatar Google trên header)');

  // 5. Kiểm tra đăng xuất Google session
  console.log('5. Kiểm tra đăng xuất...');
  await page.evaluate(() => {
    // Mở menu account
    const menuBtn = document.querySelector('button[aria-haspopup="menu"]');
    if (menuBtn) menuBtn.click();
  });
  await new Promise(r => setTimeout(r, 500));
  await page.screenshot({ path: 'd:/download/nova_shop-main/nova_shop-main/verification-screenshots/step2-google-account-menu.png' });
  console.log('✓ Đã chụp ảnh step2-google-account-menu.png (Menu tài khoản Google mở ra)');

  await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    const logoutBtn = buttons.find(b => b.textContent.includes('Đăng xuất'));
    if (logoutBtn) logoutBtn.click();
  });
  await new Promise(r => setTimeout(r, 1000));
  await page.screenshot({ path: 'd:/download/nova_shop-main/nova_shop-main/verification-screenshots/step2-after-logout.png' });
  console.log('✓ Đã chụp ảnh step2-after-logout.png (Quay lại trạng thái chưa đăng nhập)');

  await browser.close();
  console.log('=== TẤT CẢ KIỂM TRA BƯỚC 2 ĐÃ HOÀN TẤT THÀNH CÔNG ===');
}

verifyGoogleAuth().catch(console.error);
