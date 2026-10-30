const COMMONS_API_URL = 'https://commons.wikimedia.org/w/api.php';

async function findMuseumSets(category, term) {
  const query = `incategory:"${category}" ${term}`;
  const params = new URLSearchParams({
    action: 'query',
    format: 'json',
    generator: 'search',
    gsrnamespace: '6',
    gsrsearch: query,
    gsrlimit: '60',
    prop: 'imageinfo',
    iiprop: 'url',
    iiurlwidth: '800',
  });
  const res = await fetch(COMMONS_API_URL + '?' + params, {
    headers: { 'User-Agent': 'NovaShopImageChecker/1.0 (contact: admin@novashop.dev)' }
  });
  const json = await res.json();
  const pages = Object.values(json.query?.pages || {}).filter(p => p.title.endsWith('.jpg') || p.title.endsWith('.png'));

  // Group by object id: e.g. "DP-14594" or "AM 2014.66.1"
  const groups = {};
  for (const p of pages) {
    const match = p.title.match(/DP-?[0-9]+/i) || p.title.match(/AM\s+[0-9.]+/i) || p.title.match(/LACMA\s+[0-9.]+/i);
    if (match) {
      const id = match[0].toUpperCase();
      if (!groups[id]) groups[id] = [];
      groups[id].push(p.title);
    }
  }

  const validSets = Object.entries(groups).filter(([id, files]) => files.length >= 4);
  console.log(`\n=== Found in ${category} [${term}]: ${validSets.length} sets >= 4 photos ===`);
  for (const [id, files] of validSets.slice(0, 5)) {
    console.log(`Set ${id} (${files.length} photos):`);
    files.slice(0, 4).forEach(f => console.log('  -', f));
  }
}

async function main() {
  await findMuseumSets('Images from the Metropolitan Museum of Art', 'Dress DP-');
  await findMuseumSets('Images from the Metropolitan Museum of Art', 'Jacket DP-');
  await findMuseumSets('Images from the Metropolitan Museum of Art', 'Shoes DP-');
  await findMuseumSets('Images from the Metropolitan Museum of Art', 'Purse DP-');
  await findMuseumSets('Images from the Metropolitan Museum of Art', 'Boots DP-');
  await findMuseumSets('Images from the Metropolitan Museum of Art', 'Fan DP-');
  await findMuseumSets('Images from the Metropolitan Museum of Art', 'Vase DP-');
  await findMuseumSets('Images from the Auckland Museum', 'AM');
}

main();

