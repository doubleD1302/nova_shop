async function searchTest() {
  const loginRes = await fetch('http://localhost:3000/api/v1/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'demo_seller_a', password: 'Seller123456' }),
  });
  const { data: { token } } = await loginRes.json();

  const queries = [
    'iPhone 13',
    'MacBook Air',
    'Canon EOS 5D',
    'Nintendo Switch',
    'Sony PlayStation 5',
    'Converse Chuck Taylor',
    'Raspberry Pi 4',
    'Casio F-91W',
  ];

  for (const q of queries) {
    const res = await fetch(`http://localhost:3000/api/v1/seller/images/search?q=${encodeURIComponent(q)}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const json = await res.json();
    console.log(`Query: "${q}" => ${json.data?.images?.length || 0} images`);
    if (json.data?.images?.length) {
      json.data.images.slice(0, 5).forEach((img, i) => {
        console.log(`  [${i+1}] ${img.title}`);
        console.log(`      ${img.url}`);
      });
    }
  }
}

searchTest().catch(console.error);

