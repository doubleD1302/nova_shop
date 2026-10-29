const COMMONS_API_URL = 'https://commons.wikimedia.org/w/api.php';

const QUERIES = [
  'Apple Watch Series 8',
  'iPad Pro',
  'MacBook Pro 14',
  'PlayStation 5 and DualSense',
  'Xbox Series X',
  'GoPro HERO',
  'Bose QuietComfort',
  'JBL Flip',
  'Zojirushi',
  'Lamy Safari',
  'Hario V60',
  'Adidas Stan Smith',
  'Vans Old Skool',
  'Nike Air Max',
  'Seiko 5',
  'Lipstick MET DP',
  'Fan MET DP',
  'Shoes MET DP',
  'Boots MET DP',
  'Bag MET DP',
  'Purse MET DP',
  'Coat MET DP',
  'Suit MET DP',
];

async function check() {
  for (const q of QUERIES) {
    const params = new URLSearchParams({
      action: 'query',
      format: 'json',
      generator: 'search',
      gsrnamespace: '6',
      gsrsearch: q,
      gsrlimit: '20',
      prop: 'imageinfo',
      iiprop: 'url',
      iiurlwidth: '800',
    });
    try {
      const res = await fetch(COMMONS_API_URL + '?' + params, {
        headers: { 'User-Agent': 'NovaShopImageChecker/1.0 (contact: admin@novashop.dev)' }
      });
      const json = await res.json();
      const pages = Object.values(json.query?.pages || {}).filter(p => p.title.endsWith('.jpg') || p.title.endsWith('.png'));
      
      // Group by title pattern
      const groups = {};
      for (const p of pages) {
        const base = p.title.replace(/[\s_-]*(?:[0-9]+|\([0-9]+\)|front|back|side|rear|top|bottom|closeup|detail|sensor|left|right).*$/i, '').trim();
        if (!groups[base]) groups[base] = [];
        groups[base].push(p.title);
      }
      for (const [k, v] of Object.entries(groups)) {
        if (v.length >= 4) {
          console.log(`[MATCH >= 4] ${k} (${v.length} files)`);
          v.slice(0, 4).forEach(f => console.log('   +', f));
        }
      }
    } catch (e) {
      console.error(q, e.message);
    }
  }
}

check();

