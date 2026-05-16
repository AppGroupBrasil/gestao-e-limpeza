import pg from 'pg';
const p = new pg.Pool({ host: 'localhost', port: 5432, database: 'gestao', user: 'gestao', password: 'gestao_secret' });
p.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND (table_name LIKE 'tema%' OR table_name LIKE 'quadro%')")
  .then(r => { console.log('Tables found:', r.rows.map(x => x.table_name)); return p.end(); })
  .catch(e => { console.error(e.message); p.end(); });
