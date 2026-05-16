// Test login endpoint directly
const resp = await fetch('http://localhost:3001/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'eduardodominikus@hotmail.com', senha: '123456' }),
});
console.log('Status:', resp.status);
const data = await resp.json();
console.log('Response:', JSON.stringify(data, null, 2));
