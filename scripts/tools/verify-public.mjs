import puppeteer from 'puppeteer-core';

async function verifyPublic() {
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();
  await page.goto('http://localhost:5174/', { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 2000));

  const productLinks = await page.$$eval('a[href^="/san-pham/"]', links => links.map(a => ({
    href: a.getAttribute('href'),
    text: a.querySelector('h3')?.textContent || a.textContent.trim().slice(0, 50),
    img: a.querySelector('img')?.getAttribute('src'),
  })));

  console.log(`Found ${productLinks.length} products on Homepage:`);
  productLinks.forEach((p, idx) => {
    console.log(`  [${idx+1}] ${p.text}`);
    console.log(`      Link: ${p.href}`);
    console.log(`      Image: ${p.img}`);
  });

  // Now click into the first product detail page:
  if (productLinks.length > 0) {
    const detailUrl = 'http://localhost:5174' + productLinks[0].href;
    console.log(`\nNavigating to product detail: ${detailUrl}`);
    await page.goto(detailUrl, { waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 2000));

    const detailInfo = await page.evaluate(() => {
      const title = document.querySelector('h1')?.textContent;
      const images = Array.from(document.querySelectorAll('img')).map(img => img.src).filter(src => src.includes('/uploads/'));
      const thumbnails = Array.from(document.querySelectorAll('button img, div img')).map(img => img.src).filter(src => src.includes('/uploads/'));
      const sold = document.body.innerText.match(/Đã bán\s*\d+/)?.[0] || 'Chưa có thông tin bán';
      const rating = document.body.innerText.match(/\d+(\.\d+)?\s*\/ 5/)?.[0] || 'Chưa có đánh giá';
      return {
        title,
        uniqueUploadedImages: Array.from(new Set(images)),
        sold,
        rating,
      };
    });

    console.log('Detail page verification:');
    console.log('  Title:', detailInfo.title);
    console.log('  Number of distinct images on detail page:', detailInfo.uniqueUploadedImages.length);
    detailInfo.uniqueUploadedImages.forEach((img, i) => console.log(`    Photo ${i+1}: ${img}`));
    console.log('  Sales status:', detailInfo.sold);
    console.log('  Rating status:', detailInfo.rating);
  }

  await browser.close();
}

verifyPublic().catch(console.error);

