 import fs from 'node:fs';
import puppeteer from 'puppeteer-core';

async function runAutomation() {
  const products = JSON.parse(fs.readFileSync('d:/download/nova_shop-main/nova_shop-main/products_to_add.json', 'utf8'));

  console.log(`Starting automated product creation for ${products.length} products...`);

  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1280,900'],
  });

  const page = await browser.newPage();
  page.setViewport({ width: 1280, height: 900 });

  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('Error') || text.includes('error') || text.includes('toast')) {
      console.log('BROWSER:', msg.type(), text);
    }
  });

  // Step 1: Login
  console.log('Logging in at http://localhost:5174/dang-nhap ...');
  await page.goto('http://localhost:5174/dang-nhap', { waitUntil: 'networkidle2' });
  await page.type('input[placeholder="minhanh / ankerseller / cocoonseller"]', 'demo_seller_a');
  await page.type('input[placeholder="Mật khẩu tài khoản"]', 'Seller123456');
  await page.click('form.space-y-4 button[type="submit"]');

  await new Promise(r => setTimeout(r, 2500));
  console.log('Logged in. Current URL:', page.url());

  // Step 2: Loop through products
  for (let i = 0; i < products.length; i++) {
    const prod = products[i];
    console.log(`\n--------------------------------------------------`);
    console.log(`[${i + 1}/${products.length}] Creating product: "${prod.name}"`);

    await page.goto('http://localhost:5174/nguoi-ban/san-pham/them-moi', { waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 1500));

    // Fill Product Name
    const nameInput = await page.$('input[placeholder="Ví dụ: Áo sơ mi cotton nam"]');
    await nameInput.click({ clickCount: 3 });
    await nameInput.press('Backspace');
    await nameInput.type(prod.name);

    // Select Category
    const categorySelect = await page.$('section select');
    await categorySelect.select(prod.category);

    // Number inputs: price, originalPrice, stock
    const numberInputs = await page.$$('input[type="number"]');
    if (numberInputs.length >= 3) {
      // Price
      await numberInputs[0].click({ clickCount: 3 });
      await numberInputs[0].press('Backspace');
      await numberInputs[0].type(String(prod.price));

      // Original Price
      await numberInputs[1].click({ clickCount: 3 });
      await numberInputs[1].press('Backspace');
      await numberInputs[1].type(String(prod.originalPrice));

      // Stock
      await numberInputs[2].click({ clickCount: 3 });
      await numberInputs[2].press('Backspace');
      await numberInputs[2].type(String(prod.stock));
    }

    // Status select (second select on page)
    const selects = await page.$$('select');
    if (selects.length >= 2) {
      await selects[1].select('active');
    }

    // Description
    const descTextarea = await page.$('textarea');
    await descTextarea.click({ clickCount: 3 });
    await descTextarea.press('Backspace');
    await descTextarea.type(prod.description);

    // Free Shipping checkbox
    const freeShipCheckbox = await page.$('input[type="checkbox"]');
    if (freeShipCheckbox) {
      await freeShipCheckbox.click();
    }

    // Upload 4 real images
    const fileInput = await page.$('input[type="file"]');
    if (!fileInput) throw new Error('File input not found');

    console.log(`  Uploading 4 real product photos...`);
    await fileInput.uploadFile(...prod.localFiles);

    // Wait for 4 image previews to load
    console.log(`  Waiting for image preview cards to render...`);
    await page.waitForFunction(() => {
      const imgElements = document.querySelectorAll('.aspect-square img');
      return imgElements.length === 4;
    }, { timeout: 10000 });

    await new Promise(r => setTimeout(r, 2000));

    // Verify error box is not present
    const errorText = await page.evaluate(() => {
      const errEl = document.querySelector('.bg-rose-50');
      return errEl ? errEl.textContent : null;
    });
    if (errorText) {
      console.error(`  Form error before submit: ${errorText}`);
    }

    // Submit form
    console.log(`  Clicking "Đăng sản phẩm" button...`);
    await page.click('button[type="submit"]');

    // Wait for navigation back to products list
    await page.waitForFunction(() => {
      return window.location.pathname.includes('/nguoi-ban/san-pham') && !window.location.pathname.includes('/them-moi');
    }, { timeout: 15000 }).catch(async (e) => {
      const currentError = await page.evaluate(() => document.querySelector('.bg-rose-50')?.textContent);
      throw new Error(`Failed to submit: ${currentError || e.message}`);
    });

    console.log(`  ✓ Successfully submitted! Redirected to: ${page.url()}`);
    await new Promise(r => setTimeout(r, 2000));
  }

  console.log(`\n==================================================`);
  console.log(`All ${products.length} products created successfully through seller portal!`);

  // Verify in public marketplace
  console.log(`Verifying on public marketplace homepage...`);
  await page.goto('http://localhost:5174/', { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 3000));

  const publicProductCount = await page.evaluate(() => {
    return document.querySelectorAll('article, .product-card').length;
  });
  console.log(`Public product cards detected on homepage: ${publicProductCount}`);

  await browser.close();
}

runAutomation().catch(err => {
  console.error('Automation failed:', err);
  process.exit(1);
});

