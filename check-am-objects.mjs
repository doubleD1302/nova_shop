const COMMONS_API_URL = 'https://commons.wikimedia.org/w/api.php';

async function findAMObjects(term) {
  const params = new URLSearchParams({
    action: 'query', format: 'json', generator: 'search', gsrnamespace: '6',
    gsrsearch: `"${term}" "Auckland Museum"`, gsrlimit: '60',
    prop: 'imageinfo', iiprop: 'url', iiurlwidth: '800'
  });
  const res = await fetch(COMMONS_API_URL + '?' + params, {
    headers: { 'User-Agent': 'NovaShopImageChecker/1.0 (contact: admin@novashop.dev)' }
  });
  const json = await res.json();
  const pages = Object.values(json.query?.pages || {}).filter(p => p.title.endsWith('.jpg') || p.title.endsWith('.png'));

  // Group by accession number: e.g. "AM 2014.66.1"
  const objects = {};
  for (const p of pages) {
    const m = p.title.match(/AM\s+([0-9]+(?:\.[0-9]+)*)/i);
    if (m) {
      const id = m[1];
      if (!objects[id]) objects[id] = [];
      objects[id].push(p.title);
    }
  }

  for (const [id, files] of Object.entries(objects)) {
    if (files.length >= 4) {
      console.log(`[AM Object ${term} - ${id}] (${files.length} photos):`);
      files.slice(0, 4).forEach(f => console.log('   *', f));
    }
  }
}

async function main() {
  await findAMObjects('Handbag');
  await findAMObjects('Bag');
  await findAMObjects('Shoes');
  await findAMObjects('Boots');
  await findAMObjects('Dress');
  await findAMObjects('Jacket');
  await findAMObjects('Shirt');
  await findAMObjects('Coat');
}

main();

