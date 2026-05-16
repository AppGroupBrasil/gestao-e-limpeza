import bcrypt from 'bcrypt';
import pg from 'pg';
const { Pool } = pg;
const pool = new Pool({ host: process.env.DB_HOST, database: process.env.DB_NAME, user: process.env.DB_USER, password: process.env.DB_PASSWORD });
(async () => {
  try {
    // Test login via HTTP
    const body = JSON.stringify({ email: 'eduardodominikus@hotmail.com', senha: '123456' });
    const resp = await fetch('http://localhost:3001/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body
    });
    const text = await resp.text();
    console.log('Status:', resp.status);
    console.log('Response:', text);
    console.log('Headers:', Object.fromEntries(resp.headers.entries()));
  } catch (err) {
    console.error('ERROR:', err.message);
  } finally {
    await pool.end();
  }
})();
