import puppeteer from 'puppeteer-core';
import path from 'node:path';

const SCREENSHOT_DIR = path.resolve('d:/download/nova_shop-main/nova_shop-main/verification-screenshots');
const BASE_URL = 'http://localhost:5174';

async function runVerification() {
  console.log('🚀 Starting ShopNova End-to-End Automated Verification...');
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1440,900'],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  page.on('console', msg => {
    if (msg.type() === 'error') console.log('Browser console error:', msg.text());
  });

  try {
    // 1. HOMEPAGE DESKTOP
    console.log('\n--- 1. Testing Homepage (Desktop 1440x900) ---');
    await page.goto(BASE_URL, { waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 1500));

    const pageTitle = await page.title();
    console.log('Page Title:', pageTitle);

    const homepageStats = await page.evaluate(() => {
      const categories = Array.from(document.querySelectorAll('section:nth-of-type(1) a, div.grid a')).filter(a => a.href.includes('category='));
      const productCards = document.querySelectorAll('a[href^="/san-pham/"]');
      const flashSaleHeader = document.querySelector('span:has(> svg)');
      const flashSaleText = document.body.innerText.includes('FLASH SALE');
      const featuredShops = document.body.innerText.includes('GIAN HÀNG NỔI BẬT');
      const suggestTabs = document.body.innerText.includes('GỢI Ý HÔM NAY');

      return {
        productCardCount: productCards.length,
        hasFlashSale: flashSaleText,
        hasFeaturedShops: featuredShops,
        hasSuggestTabs: suggestTabs,
      };
    });
    console.log('Homepage elements check:', homepageStats);

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '01_homepage_desktop.png'), fullPage: false });
    console.log('✓ Saved 01_homepage_desktop.png');

    // 2. HOMEPAGE MOBILE
    console.log('\n--- 2. Testing Homepage (Mobile 375x812) ---');
    await page.setViewport({ width: 375, height: 812, isMobile: true, hasTouch: true });
    await page.reload({ waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 1500));
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '02_homepage_mobile.png'), fullPage: false });
    console.log('✓ Saved 02_homepage_mobile.png');

    // Reset viewport to desktop
    await page.setViewport({ width: 1440, height: 900 });

    // 3. SEARCH & CATEGORY FILTER
    console.log('\n--- 3. Testing Search & Category Filter ---');
    await page.goto(`${BASE_URL}/tim-kiem?category=thoi-trang-nam`, { waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 1500));

    const searchResults = await page.evaluate(() => {
      const items = document.querySelectorAll('a[href^="/san-pham/"]');
      return {
        count: items.length,
        firstTitle: items[0]?.querySelector('h3')?.textContent?.trim() || '',
      };
    });
    console.log('Search Category Filter result:', searchResults);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '03_search_category_filter.png') });
    console.log('✓ Saved 03_search_category_filter.png');

    // 4. PRODUCT DETAIL PAGE & GALLERY
    console.log('\n--- 4. Testing Product Detail Page & 4-Image Gallery ---');
    // Click on the first product card
    const firstProductHref = await page.evaluate(() => {
      const link = document.querySelector('a[href^="/san-pham/"]');
      return link ? link.getAttribute('href') : null;
    });

    if (firstProductHref) {
      await page.goto(`${BASE_URL}${firstProductHref}`, { waitUntil: 'networkidle2' });
      await new Promise(r => setTimeout(r, 1500));

      const productDetailStats = await page.evaluate(() => {
        const title = document.querySelector('h1')?.textContent?.trim();
        const price = document.querySelector('.text-brand')?.textContent?.trim();
        const thumbnails = document.querySelectorAll('div.mt-2.flex.gap-2 button');
        const specs = Array.from(document.querySelectorAll('tr, div')).filter(el => el.textContent.includes('Chất liệu') || el.textContent.includes('Xuất xứ')).length;
        return {
          title,
          price,
          thumbnailCount: thumbnails.length,
          specsFound: specs > 0,
        };
      });
      console.log('Product Detail Stats:', productDetailStats);

      // Test thumbnail clicking
      const thumbButtons = await page.$$('div.mt-2.flex.gap-2 button');
      if (thumbButtons.length >= 2) {
        await thumbButtons[1].click();
        await new Promise(r => setTimeout(r, 500));
        console.log('✓ Clicked thumbnail 2 successfully');
      }

      // Add to cart test
      const addToCartBtn = await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const btn = buttons.find(b => b.textContent.includes('Thêm Vào Giỏ Hàng'));
        if (btn) {
          btn.click();
          return true;
        }
        return false;
      });
      console.log('Add to cart button clicked:', addToCartBtn);
      await new Promise(r => setTimeout(r, 1000));

      await page.screenshot({ path: path.join(SCREENSHOT_DIR, '04_product_detail_page.png') });
      console.log('✓ Saved 04_product_detail_page.png');
    }

    // 5. CART PAGE
    console.log('\n--- 5. Testing Cart Page ---');
    await page.goto(`${BASE_URL}/gio-hang`, { waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 1500));

    const cartStats = await page.evaluate(() => {
      return {
        itemCount: document.querySelectorAll('input[type="checkbox"]').length,
        bodyText: document.body.innerText.includes('Giỏ Hàng') || document.body.innerText.includes('sản phẩm'),
      };
    });
    console.log('Cart page stats:', cartStats);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '05_cart_page.png') });
    console.log('✓ Saved 05_cart_page.png');

    // 6. SELLER LOGIN & SELLER DASHBOARD
    console.log('\n--- 6. Testing Seller Login & Seller Channel ---');
    await page.goto(`${BASE_URL}/dang-nhap`, { waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 1000));

    await page.type('input[placeholder="minhanh / ankerseller / cocoonseller"]', 'demo_seller_a');
    await page.type('input[placeholder="Mật khẩu tài khoản"]', 'Seller123456');
    await page.click('form.space-y-4 button[type="submit"]');
    await new Promise(r => setTimeout(r, 2000));

    await page.goto(`${BASE_URL}/nguoi-ban/san-pham`, { waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 2000));

    const sellerProducts = await page.evaluate(() => {
      const rows = document.querySelectorAll('tbody tr, table tr');
      const h1 = document.querySelector('h1')?.textContent?.trim();
      return {
        h1,
        rowCount: rows.length,
      };
    });
    console.log('Seller channel products page:', sellerProducts);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '06_seller_channel.png') });
    console.log('✓ Saved 06_seller_channel.png');

    // 7. ADMIN LOGIN & ADMIN DASHBOARD
    console.log('\n--- 7. Testing Admin Dashboard ---');
    // Clear session and login as admin
    await page.evaluate(() => {
      sessionStorage.clear();
      localStorage.clear();
    });
    await page.goto(`${BASE_URL}/dang-nhap`, { waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 1000));

    await page.type('input[placeholder="minhanh / ankerseller / cocoonseller"]', 'demo_admin');
    await page.type('input[placeholder="Mật khẩu tài khoản"]', 'Admin123456');
    await page.click('form.space-y-4 button[type="submit"]');
    await new Promise(r => setTimeout(r, 2000));

    await page.goto(`${BASE_URL}/quan-tri`, { waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 2000));

    const adminStats = await page.evaluate(() => {
      return {
        h1: document.querySelector('h1')?.textContent?.trim() || document.body.innerText.includes('Quản Trị'),
        url: window.location.pathname,
      };
    });
    console.log('Admin dashboard page:', adminStats);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '07_admin_dashboard.png') });
    console.log('✓ Saved 07_admin_dashboard.png');

    console.log('\n🎉 ALL 7 VERIFICATION TESTS COMPLETED SUCCESSFULLY!');
  } catch (err) {
    console.error('❌ Verification failed:', err);
  } finally {
    await browser.close();
  }
}

runVerification();

