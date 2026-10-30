async function testLogins() {
  const accounts = [
    { username: 'demo_buyer', password: 'Buyer123456', role: 'buyer' },
    { username: 'demo_seller_a', password: 'Seller123456', role: 'seller' },
    { username: 'demo_admin', password: 'Admin123456', role: 'admin' },
  ];

  for (const acc of accounts) {
    const res = await fetch('http://localhost:3000/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: acc.username, password: acc.password }),
    });
    const json = await res.json();
    console.log(`Login ${acc.username} (${acc.role}): ${json.success ? 'SUCCESS' : 'FAILED'} - ${json.message || ''}`);
  }
}

testLogins().catch(console.error);

