async function test() {
  const tests = [
    { email: 'admin@dgscreation.com', password: 'Admin@12345' },
    { email: 'admin@dgscreation.com', password: 'admin123' },
    { email: 'Admin@Dgscreation.Com ', password: 'admin123' },
    { email: 'admin@costumerent.com', password: 'Admin@12345' },
  ];

  for (const t of tests) {
    try {
      const res = await fetch('http://3.26.200.40/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(t),
      });
      const data = await res.json();
      console.log(`Email: "${t.email}", Pass: "${t.password}" -> Status: ${res.status}, Success: ${data.success}, Role: ${data.user?.role}`);
    } catch (e) {
      console.error(e.message);
    }
  }
}

test();
