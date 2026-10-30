import puppeteer from 'puppeteer-core';

async function testBrowser() {
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();
  page.on('console', msg => console.log('BROWSER LOG:', msg.type(), msg.text()));
  page.on('pageerror', err => console.log('BROWSER PAGE ERROR:', err.message));

  await page.goto('http://localhost:5174/dang-nhap', { waitUntil: 'networkidle2' });

  // Fill login
  await page.type('input[placeholder="minhanh / ankerseller / cocoonseller"]', 'demo_seller_a');
  await page.type('input[placeholder="Mật khẩu tài khoản"]', 'Seller123456');

  // Click login button specifically inside the auth form
  await page.click('form.space-y-4 button[type="submit"]');

  await new Promise(r => setTimeout(r, 2500));
  console.log('Current URL after login:', page.url());

  const token = await page.evaluate(() => sessionStorage.getItem('novashop_token'));
  console.log('Token in sessionStorage:', token ? token.slice(0, 30) + '...' : 'null');

  // Navigate to add product page
  await page.goto('http://localhost:5174/nguoi-ban/san-pham/them-moi', { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 2500));
  console.log('Current URL on add product page:', page.url());

  const userInSession = await page.evaluate(() => {
    return {
      h1: document.querySelector('h1')?.textContent,
      categoryOptions: Array.from(document.querySelectorAll('select option')).map(o => ({ value: o.value, text: o.textContent })),
      inputs: Array.from(document.querySelectorAll('input, select, textarea')).map(el => ({
        placeholder: el.placeholder || '',
        name: el.name || '',
        type: el.type || el.tagName.toLowerCase(),
      })),
    };
  });
  console.log('Form on add product page:', JSON.stringify(userInSession, null, 2));

  await browser.close();
}

testBrowser().catch(console.error);

