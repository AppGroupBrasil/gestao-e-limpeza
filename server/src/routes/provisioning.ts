import { Router, Request, Response } from 'express';
import { query, queryOne } from '../db/database.js';

const router = Router();

function mapearRole(role: string): string {
  const r = (role || '').toLowerCase();
  if (r === 'superadmin' || r === 'master') return 'master';
  if (r === 'admin' || r === 'administrador') return 'administrador';
  if (r === 'supervisor') return 'supervisor';
  return 'funcionario';
}

router.post('/usuario', async (req: Request, res: Response) => {
  const secret = req.headers['x-provisioning-secret'];
  const expected = process.env.PROVISIONING_SECRET;
  if (!expected || secret !== expected) {
    res.status(403).json({ error: 'Assinatura inválida' });
    return;
  }
  const b = req.body || {};
  if (!b.usuario_id || !b.email || !b.nome) {
    res.status(400).json({ error: 'Campos obrigatórios ausentes' });
    return;
  }
  const ativo = b.status === 'ativa' || b.status === 'trial';
  const roleLocal = mapearRole(b.role);

  const existing = await queryOne(`SELECT id FROM usuarios WHERE id = $1`, [b.usuario_id]);
  if (existing) {
    await query(
      `UPDATE usuarios SET email=$2, nome=$3, role=$4::user_role, ativo=$5, atualizado_em=NOW()
       WHERE id=$1`,
      [b.usuario_id, b.email, b.nome, roleLocal, ativo]
    );
  } else {
    await query(
      `INSERT INTO usuarios (id, email, senha_hash, nome, role, ativo)
       VALUES ($1, $2, '!central!', $3, $4::user_role, $5)`,
      [b.usuario_id, b.email, b.nome, roleLocal, ativo]
    );
  }
  res.json({ ok: true, usuario_id: b.usuario_id });
});

export default router;
