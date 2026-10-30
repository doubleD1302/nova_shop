const COMMONS_API_URL = 'https://commons.wikimedia.org/w/api.php';

async function searchMuseumItems(query) {
  const params = new URLSearchParams({
    action: 'query',
    format: 'json',
    generator: 'search',
    gsrnamespace: '6',
    gsrsearch: query,
    gsrlimit: '50',
    prop: 'imageinfo',
    iiprop: 'url',
    iiurlwidth: '800',
  });
  const res = await fetch(COMMONS_API_URL + '?' + params, {
    headers: { 'User-Agent': 'NovaShopImageChecker/1.0 (contact: admin@novashop.dev)' }
  });
  const json = await res.json();
  const pages = Object.values(json.query?.pages || {}).filter(p => !p.title.endsWith('.svg'));

  const clusters = {};
  for (const p of pages) {
    // Match DPxxxxxx or object number
    const m = p.title.match(/^(.*?)[\s_-]*(?:DP[0-9]+|\(?[0-9]+\)?|front|back|detail|profile|side|rev|av).*$/i);
    const key = (m ? m[1] : p.title).trim();
    if (!clusters[key]) clusters[key] = [];
    clusters[key].push(p.title);
  }

  for (const [k, v] of Object.entries(clusters)) {
    if (v.length >= 4) {
      console.log(`[FOUND >= 4] ${k} (${v.length} photos)`);
      v.slice(0, 5).forEach(f => console.log('   *', f));
    }
  }
}

async function main() {
  await searchMuseumItems('MET dress DP');
  await searchMuseumItems('MET jacket DP');
  await searchMuseumItems('MET shoes DP');
  await searchMuseumItems('MET boots DP');
  await searchMuseumItems('MET bag DP');
  await searchMuseumItems('MET teapot DP');
}

main();

