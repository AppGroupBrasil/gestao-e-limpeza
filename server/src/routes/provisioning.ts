import { Router, Request, Response } from 'express';
import crypto from 'node:crypto';
import { query, queryOne } from '../db/database.js';

const router = Router();

function secretValido(recebido: unknown): boolean {
  const expected = process.env.PROVISIONING_SECRET;
  if (!expected || typeof recebido !== 'string') return false;
  const a = Buffer.from(recebido);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function mapearRole(role: string): string {
  const r = (role || '').toLowerCase();
  if (r === 'superadmin' || r === 'master') return 'master';
  if (r === 'admin' || r === 'administrador') return 'administrador';
  if (r === 'supervisor') return 'supervisor';
  return 'funcionario';
}

router.post('/usuario', async (req: Request, res: Response) => {
  if (!secretValido(req.headers['x-provisioning-secret'])) {
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

  // Procura primeiro por central_uuid, depois por email
  let existing = await queryOne(`SELECT id FROM usuarios WHERE central_uuid = $1`, [b.usuario_id]);
  if (!existing) existing = await queryOne(`SELECT id FROM usuarios WHERE email = $1`, [b.email]);

  if (existing) {
    await query(
      `UPDATE usuarios SET central_uuid=$1, email=$2, nome=$3, role=$4::user_role, ativo=$5, atualizado_em=NOW()
       WHERE id=$6`,
      [b.usuario_id, b.email, b.nome, roleLocal, ativo, existing.id]
    );
  } else {
    await query(
      `INSERT INTO usuarios (central_uuid, email, senha_hash, nome, role, ativo)
       VALUES ($1, $2, '!central!', $3, $4::user_role, $5)`,
      [b.usuario_id, b.email, b.nome, roleLocal, ativo]
    );
  }
  res.json({ ok: true, usuario_id: b.usuario_id });
});

// Receiver do push de cadastro da central (Fase 2 SSO). Espelho read-only:
// usuarios (casa por email). upsert atualiza nome; delete revoga (ativo=false).
router.post('/cadastro', async (req: Request, res: Response) => {
  if (!secretValido(req.headers['x-provisioning-secret'])) {
    res.status(403).json({ error: 'Assinatura inválida' });
    return;
  }
  const ev = req.body || {};
  const d = ev.dados || {};
  if (ev.entidade === 'morador' || ev.entidade === 'funcionario') {
    const email = String(d.email || '').toLowerCase().trim();
    if (!email) { res.json({ ok: true, ignorado: 'sem email' }); return; }
    if (ev.acao === 'delete') {
      await query(`UPDATE usuarios SET ativo=false, atualizado_em=NOW() WHERE lower(email)=$1`, [email]);
      res.json({ ok: true });
      return;
    }
    if (d.nome) {
      await query(`UPDATE usuarios SET nome=$1, ativo=true, atualizado_em=NOW() WHERE lower(email)=$2`, [d.nome, email]);
    }
    res.json({ ok: true });
    return;
  }
  res.json({ ok: true, ignorado: ev.entidade });
});

export default router;
