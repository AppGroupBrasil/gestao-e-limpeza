import bcrypt from 'bcrypt';
import pool from './database.js';

async function seed() {
  const email = process.env.SEED_MASTER_EMAIL;
  const senha = process.env.SEED_MASTER_PASSWORD;
  const nome = process.env.SEED_MASTER_NOME || 'Master Admin';

  if (!email || !senha) {
    console.error('Defina SEED_MASTER_EMAIL e SEED_MASTER_PASSWORD para criar o usuário master.');
    process.exit(1);
  }
  if (senha.length < 12) {
    console.error('SEED_MASTER_PASSWORD deve ter no mínimo 12 caracteres.');
    process.exit(1);
  }

  const client = await pool.connect();
  try {
    // Verificar se master já existe
    const { rows } = await client.query("SELECT id FROM usuarios WHERE role = 'master' LIMIT 1");
    if (rows.length > 0) {
      console.log('Usuário master já existe. Seed ignorado.');
      return;
    }

    const senhaHash = await bcrypt.hash(senha, 12);
    await client.query(
      `INSERT INTO usuarios (email, senha_hash, nome, role, criado_por)
       VALUES ($1, $2, $3, 'master', NULL)`,
      [email, senhaHash, nome]
    );
    console.log(`Usuário master criado: ${email}`);
  } finally {
    client.release();
    await pool.end();
  }
}

seed().catch(err => {
  console.error('Erro no seed:', err);
  process.exit(1);
});
