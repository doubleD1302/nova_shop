async function test() {
  const loginRes = await fetch('http://localhost:3000/api/v1/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'demo_seller_a', password: 'Seller123456' }),
  });
  const loginData = await loginRes.json();
  console.log('Login result:', loginData);

  if (!loginData.success) return;
  const token = loginData.data.token;

  const searchRes = await fetch('http://localhost:3000/api/v1/seller/images/search?q=t-shirt', {
    headers: { Authorization: `Bearer ${token}` },
  });
  const searchData = await searchRes.json();
  console.log('Search images count:', searchData.data?.images?.length, searchData);
}

test().catch(console.error);

