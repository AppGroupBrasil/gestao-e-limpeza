import pg from 'pg';
const p = new pg.Pool({ host: 'localhost', port: 5432, database: 'gestao', user: 'gestao', password: 'gestao_secret' });
try {
  const r = await p.query("SELECT id, email, role, ativo, bloqueado FROM usuarios WHERE email = 'eduardodominikus@hotmail.com'");
  console.log('Found:', r.rows.length);
  if (r.rows[0]) console.log(JSON.stringify(r.rows[0], null, 2));
  else console.log('User NOT found');
} catch (e) {
  console.error('DB ERROR:', e.message);
}
await p.end();
