const COMMONS_API_URL = 'https://commons.wikimedia.org/w/api.php';

async function searchPatterns(terms) {
  for (const term of terms) {
    const params = new URLSearchParams({
      action: 'query', format: 'json', generator: 'search', gsrnamespace: '6',
      gsrsearch: term, gsrlimit: '40',
      prop: 'imageinfo', iiprop: 'url', iiurlwidth: '800'
    });
    try {
      const res = await fetch(COMMONS_API_URL + '?' + params, {
        headers: { 'User-Agent': 'NovaShopImageChecker/1.0 (contact: admin@novashop.dev)' }
      });
      const json = await res.json();
      const pages = Object.values(json.query?.pages || {}).filter(p => p.title.endsWith('.jpg') || p.title.endsWith('.png'));
      
      const clusters = {};
      for (const p of pages) {
        // Find cluster base
        const base = p.title.replace(/[\s_-]*(?:[0-9]+|\([0-9]+\)|front|back|side|rear|top|bottom|detail|closeup|rev|av|obv).*$/i, '').trim();
        if (!clusters[base]) clusters[base] = [];
        clusters[base].push(p.title);
      }
      for (const [k, v] of Object.entries(clusters)) {
        if (v.length >= 4) {
          console.log(`[SET >= 4] ${k} (${v.length} files) [query: ${term}]`);
          v.slice(0, 4).forEach(f => console.log('   *', f));
        }
      }
    } catch (e) {
      console.error(term, e.message);
    }
  }
}

searchPatterns([
  'Sneakers (AM',
  'Shoes (AM',
  'Dress (AM',
  'Jacket (AM',
  'Handbag (AM',
  'Purse (AM',
  'Boots (AM',
  'Bottle (AM',
  'Vase (AM',
  'Mug (AM',
  'Bowl (AM',
  'Plate (AM',
  'Box (AM',
  'Fan (AM',
  'Textile (AM',
  'Ring (AM',
  'Necklace (AM',
  'Earrings (AM',
  'Bracelet (AM'
]);

