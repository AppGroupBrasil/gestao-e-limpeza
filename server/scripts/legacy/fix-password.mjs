import bcrypt from 'bcrypt';
import pg from 'pg';

const client = new pg.Client({
  host: 'localhost',
  port: 5432,
  database: 'gestao',
  user: 'gestao',
  password: 'gestao_secret',
});

async function main() {
  await client.connect();
  
  const hash = await bcrypt.hash('123456', 12);
  console.log('Hash gerado:', hash);
  
  const result = await client.query(
    'UPDATE usuarios SET senha_hash = $1 WHERE email = $2',
    [hash, 'eduardodominikus@hotmail.com']
  );
  
  console.log('Linhas atualizadas:', result.rowCount);
  
  // Verificação
  const check = await client.query(
    'SELECT id, email, nome, role, ativo FROM usuarios WHERE email = $1',
    ['eduardodominikus@hotmail.com']
  );
  console.log('Usuário:', check.rows[0]);
  
  await client.end();
}

main().catch(e => { console.error('ERRO:', e.message); process.exit(1); });
