const COMMONS_API_URL = 'https://commons.wikimedia.org/w/api.php';

const ALL_FILES = [
  // 1. Levi's 501
  'File:501xx-front.jpg', 'File:501xx-back.jpg', 'File:501xx-red-tab-one-side.jpg', 'File:501xx-rivet-back.jpg',
  // 2. Oxford Shirt
  'File:Shirt, man\'s (AM 1737-1).jpg', 'File:Shirt, man\'s (AM 1737-3).jpg', 'File:Shirt, man\'s (AM 1737-6).jpg', 'File:Shirt, man\'s (AM 1737-8).jpg',
  // 3. Frock coat
  'File:Frock coat (AM 1970.272-2).jpg', 'File:Uniform (AM 1970.272-3).jpg', 'File:Frock coat (AM 1970.272-6).jpg', 'File:Uniform (AM 1970.272-2).jpg',
  // 4. Shirt dress
  'File:Dress "shirt dress" (AM 2019.18.2-1).jpg', 'File:Dress "shirt dress" (AM 2019.18.2-2).jpg', 'File:Dress "shirt dress" (AM 2019.18.2-3).jpg', 'File:Dress "shirt dress" (AM 2019.18.2-4).jpg',
  // 5. Blazer jacket
  'File:Jacket (AM 15166-1).jpg', 'File:Jacket (AM 15166-4).jpg', 'File:Jacket (AM 15166-5).jpg', 'File:Jacket (AM 15166-6).jpg',
  // 6. Party dress
  'File:Dress MET DP-14594-003.jpg', 'File:Dress MET DP-14594-004.jpg', 'File:Dress MET DP-14594-005.jpg', 'File:Dress MET DP-14594-006.jpg',
  // 7. iPhone 13 Pro
  'File:Apple iPhone 13 Pro on MacBook Pro 02.jpg', 'File:Apple iPhone 13 Pro on MacBook Pro 05.jpg', 'File:Apple iPhone 13 Pro on MacBook Pro 06.jpg', 'File:Apple iPhone 13 Pro on MacBook Pro 07.jpg',
  // 8. Anker Powerbank
  'File:17-11-13-Powerbank-Anker RR79813.jpg', 'File:17-11-13-Powerbank-Anker RR79814.jpg', 'File:17-11-13-Powerbank-Anker RR79815.jpg', 'File:17-11-13-Powerbank-Anker RR79816.jpg',
  // 9. Sony WH-1000XM3
  'File:Sony-WH-1000XM3-kabellose-Bluetooth-Noise-Cancelling-Kopfhoerer.2.jpg', 'File:Sony-WH-1000XM3-kabellose-Bluetooth-Noise-Cancelling-Kopfhoerer.3.jpg', 'File:Sony-WH-1000XM3-kabellose-Bluetooth-Noise-Cancelling-Kopfhoerer.4.jpg', 'File:Sony-WH-1000XM3-kabellose-Bluetooth-Noise-Cancelling-Kopfhoerer.5.jpg',
  // 10. Bose QuietComfort
  'File:Bose QuietComfort Ultra Earbuds - 1.jpg', 'File:Bose QuietComfort Ultra Earbuds - 2.jpg', 'File:Bose QuietComfort Ultra Earbuds - 3.jpg', 'File:Bose QuietComfort Ultra Earbuds - 4.jpg',
  // 11. MacBook Pro 14
  'File:Apple Macbook Pro 14" 2021 - Keyboard.png', 'File:Apple Macbook Pro 14" 2021 - Back cover.png', 'File:Apple Macbook Pro 14" 2021 - Ports on the left side.png', 'File:Apple Macbook Pro 14" 2021 - Ports on the right side.png',
  // 12. ThinkPad X220
  'File:Open Lenovo ThinkPad X220 with Norwegian (NO) Chicony keyboard FRU 45N2161.jpg', 'File:Top cover of a closed Lenovo ThinkPad X220 laptop.jpg', 'File:Bottom view of a closed Lenovo ThinkPad X220 laptop.jpg', 'File:ThinkPad X220 closed, x201 on top.jpg',
  // 13. Logitech MX Master 3S
  'File:Logitech MX Master 3S HS01.jpg', 'File:Logitech MX Master 3S HS02.jpg', 'File:Logitech MX Master 3S HS03.jpg', 'File:Logitech MX Master 3S HS04.jpg',
  // 14. Keychron K8
  'File:Keychron K8 Non-Backlight Wireless Mechanical Keyboard.jpg', 'File:Keychron K8 Non-Backlight Wireless Mechanical Keyboard (closeup).jpg', 'File:Keychron K8 Non-Backlight Wireless Mechanical Keyboard - 52772912798.jpg', 'File:Keychron K8 Non-Backlight Wireless Mechanical Keyboard - 52772428371.jpg',
  // 15. Dr. Martens 1460
  'File:Dr. Martens 1460 01.jpg', 'File:Dr. Martens 1460 02.jpg', 'File:Dr. Martens 1460 03.jpg', 'File:Dr. Martens 1460 04.jpg',
  // 16. Leather tennis shoes
  'File:Shoes, leather tennis (pair) (AM 2017.30.1-3).jpg', 'File:Shoes, leather tennis (pair) (AM 2017.30.1-12).jpg', 'File:Shoes, leather tennis (pair) (AM 2017.30.1-13).jpg', 'File:Shoes, leather tennis (pair) (AM 2017.30.1-18).jpg',
  // 17. High heels
  'File:Shoes, pair woman\'s (AM 1992.163-1).jpg', 'File:Shoes, pair woman\'s (AM 1992.163-2).jpg', 'File:Shoes, pair woman\'s (AM 1992.163-4).jpg', 'File:Shoes, pair woman\'s (AM 1992.163-5).jpg',
  // 18. Boots woman's
  'File:Boots, pair woman\'s (AM 1992.157-3).jpg', 'File:Boots, pair woman\'s (AM 1992.157-4).jpg', 'File:Boots, pair woman\'s (AM 1992.157-5).jpg', 'File:Boots, pair woman\'s (AM 1992.157-9).jpg',
  // 19. Mountaineering boots
  'File:Boots, mountaineering (AM 2014.7.95-4).jpg', 'File:Boots, mountaineering (AM 2014.7.95-5).jpg', 'File:Boots, mountaineering (AM 2014.7.95-6).jpg', 'File:Boots, mountaineering (AM 2014.7.95-7).jpg',
  // 20. Backpack AM
  'File:Backpack (AM 2014.66.1-1).jpg', 'File:Backpack (AM 2014.66.1-8).jpg', 'File:Backpack (AM 2014.66.1-12).jpg', 'File:Backpack (AM 2014.66.1-16).jpg',
  // 21. Handbag Purse 13345
  'File:Purse (AM 13345-1).jpg', 'File:Purse (AM 13345-2).jpg', 'File:Purse (AM 13345-3).jpg', 'File:Purse (AM 13345-4).jpg',
  // 22. Purse 66957
  'File:Purse (AM 66957-1).jpg', 'File:Purse (AM 66957-2).jpg', 'File:Purse (AM 66957-3).jpg', 'File:Purse (AM 66957-4).jpg',
  // 23. Bag woman's 5059
  'File:Bag, woman\'s (AM 5059-1).jpg', 'File:Bag, woman\'s (AM 5059-3).jpg', 'File:Bag, woman\'s (AM 5059-4).jpg', 'File:Bag, woman\'s (AM 5059-5).jpg',
  // 24. Perfume Bottle
  'File:Malachite Glass Scent Perfume Bottle by Curt Schlevogt Gablonz 01.jpg', 'File:Malachite Glass Scent Perfume Bottle by Curt Schlevogt Gablonz 02.jpg', 'File:Malachite Glass Scent Perfume Bottle by Curt Schlevogt Gablonz 03.jpg', 'File:Malachite Glass Scent Perfume Bottle by Curt Schlevogt Gablonz 04.jpg',
  // 25. Gold Bracelet 1932.233
  'File:Bracelet with bonbonnière (AM 1932.233-2).jpg', 'File:Bracelet with bonbonnière (AM 1932.233-8).jpg', 'File:Bracelet with bonbonnière (AM 1932.233-11).jpg', 'File:Bracelet with bonbonnière (AM 1932.233-12).jpg',
  // 26. Mug AM 12396
  'File:Mug (AM 12396-1).jpg', 'File:Mug (AM 12396-2).jpg', 'File:Mug (AM 12396-3).jpg', 'File:Mug (AM 12396-4).jpg',
  // 27. Teapot DP-12448
  'File:Teapot MET DP-12448-044.jpg', 'File:Teapot MET DP-12448-047.jpg', 'File:Teapot MET DP-12448-052.jpg', 'File:Teapot MET DP-12448-053.jpg',
  // 28. Gold Watch 48708...
  'File:Watch, Gold (48708661002).jpg', 'File:Watch, Gold (48708161258).jpg', 'File:Watch, Gold (48708158563).jpg', 'File:Watch, Gold (48708080673).jpg',
  // 29. Bialetti Moka
  'File:Bialetti moka mini express 1 tazza 01.jpg', 'File:Bialetti moka mini express 1 tazza 02.jpg', 'File:Bialetti moka mini express 1 tazza 03.jpg', 'File:Bialetti moka mini express 1 tazza 04.jpg',
  // 30. AeroPress Go
  'File:Aeropress Go (49770779481).jpg', 'File:Aeropress Go (49770781286).jpg', 'File:Aeropress Go (49770783416).jpg', 'File:Aeropress Go (49771112987).jpg',
  // 31. Dyson DC01
  'File:Dyson DC01. 01.jpg', 'File:Dyson DC01. 02.jpg', 'File:Dyson DC01. 03.jpg', 'File:A Dyson vacuum cleaner.jpg',
  // 32. Apple Watch 8
  'File:Apple Watch 8.jpg', 'File:Apple Watch 8 with Box.jpg', 'File:Apple Watch back sensors.jpg', 'File:Close Up of Apple Watch 8.jpg',
  // 33. Sony DualSense PS5 Midnight Black
  'File:Playstation 5 DualSense controller in Midnight Black, 2026-02-07 (front).jpg', 'File:Playstation 5 DualSense controller in Midnight Black, 2026-02-07 (rear).jpg', 'File:Playstation 5 DualSense controller in Midnight Black, 2026-02-07 (detail of joysticks).jpg', 'File:PlayStation 5 and DualSense (2).jpg',
  // 34. Nintendo Switch 2
  'File:Nintendo Switch 2 in Handheld Mode.jpg', 'File:Nintendo Switch 2 in Docking Console.jpg', 'File:Nintendo Switch 2-Konsole von hinten 20250605 HOF4680-HDR RAW-Export.png', 'File:Nintendo Switch 2 von oben 20250605 HOF4734-HDR RAW-Export.png',
  // 35. Raspberry Pi 4
  'File:Raspberry Pi 4 Model B - Top.jpg', 'File:Raspberry Pi 4 Model B - Side.jpg', 'File:Raspberry Pi 4 Computer.jpg', 'File:Box-package Raspberry Pi 4 model B 4GB RAM.jpg',
  // 36. Kindle Paperwhite
  'File:2023 Amazon Kindle Paperwhite (1).jpg', 'File:2023 Amazon Kindle Paperwhite (2).jpg', 'File:2023 Amazon Kindle Paperwhite (3).jpg', 'File:Amazon Kindle Paperwhite 5 Eleventh Generation (C2V2L3) 6-inch e-reader in etui.jpg',
  // 37. Fujifilm X100
  'File:Fujifilm FinePix X100 01.jpg', 'File:Fujifilm FinePix X100 03.jpg', 'File:Fujifilm FinePix X100 04.jpg', 'File:Fujifilm FinePix X100 05.jpg',
  // 38. Nikon D850
  'File:20171009 D850 front.jpg', 'File:20171009 D850 rear.jpg', 'File:Nikon DSLR camera D850 lateral rear view.jpg', 'File:Nikon D850 sensor.jpg',
];

async function checkAll() {
  console.log(`Checking ${ALL_FILES.length} files (${ALL_FILES.length / 4} products)...`);
  const missing = [];
  
  // Batch in chunks of 50
  for (let i = 0; i < ALL_FILES.length; i += 40) {
    const chunk = ALL_FILES.slice(i, i + 40);
    const params = new URLSearchParams({
      action: 'query', format: 'json', titles: chunk.join('|'),
      prop: 'imageinfo', iiprop: 'url', iiurlwidth: '800'
    });
    const res = await fetch(COMMONS_API_URL + '?' + params, {
      headers: { 'User-Agent': 'NovaShopImageChecker/1.0 (contact: admin@novashop.dev)' }
    });
    const json = await res.json();
    const pages = json.query?.pages || {};
    for (const title of chunk) {
      const page = Object.values(pages).find(p => p.title === title);
      if (!page || page.missing !== undefined || !page.imageinfo?.[0]) {
        missing.push(title);
      }
    }
  }

  if (missing.length === 0) {
    console.log(`🎉 ALL ${ALL_FILES.length} FILES VERIFIED FOUND ON COMMONS!`);
  } else {
    console.error(`❌ Missing ${missing.length} files:`, missing);
  }
}

checkAll();

