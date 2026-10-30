const COMMONS_API_URL = 'https://commons.wikimedia.org/w/api.php';

export async function fetchFileUrls(fileTitles) {
  const params = new URLSearchParams({
    action: 'query',
    format: 'json',
    titles: fileTitles.join('|'),
    prop: 'imageinfo',
    iiprop: 'url|extmetadata',
    iiurlwidth: '800',
  });
  const res = await fetch(COMMONS_API_URL + '?' + params, {
    headers: { 'User-Agent': 'NovaShopImageChecker/1.0 (contact: admin@novashop.dev)' }
  });
  const json = await res.json();
  const pages = Object.values(json.query?.pages || {});
  const map = {};
  for (const p of pages) {
    const info = p.imageinfo?.[0];
    if (info) {
      map[p.title] = {
        title: p.title,
        url: info.thumburl || info.url,
        author: info.extmetadata?.Artist?.value?.replace(/<[^>]+>/g, '').trim() || 'Wikimedia Commons',
        license: info.extmetadata?.LicenseShortName?.value || 'CC BY-SA',
        sourcePageUrl: `https://commons.wikimedia.org/wiki/${encodeURIComponent(p.title.replace(/ /g, '_'))}`
      };
    }
  }
  return map;
}

async function test() {
  const result = await fetchFileUrls([
    'File:501xx-front.jpg',
    'File:501xx-back.jpg',
    'File:501xx-red-tab-one-side.jpg',
    'File:501xx-rivet-back.jpg'
  ]);
  console.log('Result count:', Object.keys(result).length);
  for (const [k, v] of Object.entries(result)) {
    console.log(k, '->', v.url?.slice(0, 80));
  }
}

test();

