import puppeteer from 'puppeteer-core'
import fs from 'fs'

async function run() {
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true,
  })
  const page = await browser.newPage()
  const base64 = fs.readFileSync('C:/Users/voduc/.gemini/antigravity/brain/616c0e42-cf1a-43a7-90d5-eb4cf24e6520/.user_uploaded/media_1792650908597_447285e5.png').toString('base64')
  
  const croppedBase64 = await page.evaluate(async (b64) => {
    return new Promise((resolve) => {
      const img = new Image();
      img.src = 'data:image/png;base64,' + b64;
      img.onload = () => {
        // Find illustration area
        // In 1024x576:
        // Left column is x: 94 to 430
        // Illustration is roughly x: 130 to 390 (width 260), y: 250 to 390 (height 140)
        const canvas = document.createElement('canvas');
        canvas.width = 240;
        canvas.height = 140;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 150, 255, 240, 140, 0, 0, 240, 140);
        resolve(canvas.toDataURL('image/png').split(',')[1]);
      };
    });
  }, base64);
  
  fs.writeFileSync('d:/download/nova_shop-main/nova_shop-main/public/images/auth-illustration.png', Buffer.from(croppedBase64, 'base64'));
  console.log('Saved auth-illustration.png');
  await browser.close();
}

run().catch(console.error)

