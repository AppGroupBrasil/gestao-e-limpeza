import { Router, Response } from 'express';
import { query, queryOne, execute } from '../db/database.js';
import { AuthRequest } from '../middleware/auth.js';

const router = Router();

// GET /api/moradores
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
  const ids: string[] = (req as any).condominioIds;
  if (ids.length === 0) { res.json([]); return; }
  const rows = await query(
    `SELECT m.*, c.nome as condominio_nome FROM moradores m
     LEFT JOIN condominios c ON c.id = m.condominio_id
     WHERE m.condominio_id = ANY($1) ORDER BY m.nome`,
    [ids]
  );
  res.json(rows);
  } catch (err: any) { console.error('GET /moradores erro:', err.message); res.status(500).json({ error: 'Erro interno' }); }
});

// POST /api/moradores
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
  const ids: string[] = (req as any).condominioIds;
  const { nome, condominioId, bloco, apartamento, whatsapp, email, perfil } = req.body;
  if (!condominioId || !ids.includes(condominioId)) {
    res.status(403).json({ error: 'Sem acesso' });
    return;
  }
  const row = await queryOne(
    `INSERT INTO moradores (nome, condominio_id, bloco, apartamento, whatsapp, email, perfil)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
    [nome, condominioId, bloco, apartamento, whatsapp, email, perfil || 'Proprietário']
  );
  res.status(201).json(row);
  } catch (err: any) { console.error('POST /moradores erro:', err.message); res.status(500).json({ error: 'Erro interno' }); }
});

// PUT /api/moradores/:id
router.put('/:id', async (req: AuthRequest, res: Response) => {
  try {
  const ids: string[] = (req as any).condominioIds;
  const { nome, bloco, apartamento, whatsapp, email, perfil } = req.body;
  const row = await queryOne(
    `UPDATE moradores SET nome=$1, bloco=$2, apartamento=$3, whatsapp=$4, email=$5, perfil=$6
     WHERE id=$7 AND condominio_id = ANY($8) RETURNING *`,
    [nome, bloco, apartamento, whatsapp, email, perfil, req.params.id, ids]
  );
  if (!row) { res.status(404).json({ error: 'Morador não encontrado' }); return; }
  res.json(row);
  } catch (err: any) { console.error('PUT /moradores/:id erro:', err.message); res.status(500).json({ error: 'Erro interno' }); }
});

// DELETE /api/moradores/:id
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
  const ids: string[] = (req as any).condominioIds;
  const count = await execute('DELETE FROM moradores WHERE id = $1 AND condominio_id = ANY($2)', [req.params.id, ids]);
  if (count === 0) { res.status(404).json({ error: 'Morador não encontrado' }); return; }
  res.json({ ok: true });
  } catch (err: any) { console.error('DELETE /moradores/:id erro:', err.message); res.status(500).json({ error: 'Erro interno' }); }
});

// ── WhatsApp Contatos ──

// GET /api/moradores/whatsapp-contatos
router.get('/whatsapp-contatos', async (req: AuthRequest, res: Response) => {
  try {
  const ids: string[] = (req as any).condominioIds;
  const rows = await query(
    `SELECT * FROM whats_contatos WHERE condominio_id IS NULL OR condominio_id = ANY($1) ORDER BY nome`,
    [ids]
  );
  res.json(rows);
  } catch (err: any) { console.error('GET /whatsapp-contatos erro:', err.message); res.status(500).json({ error: 'Erro interno' }); }
});

// POST /api/moradores/whatsapp-contatos
router.post('/whatsapp-contatos', async (req: AuthRequest, res: Response) => {
  try {
  const ids: string[] = (req as any).condominioIds;
  const { nome, telefone, condominioId } = req.body;
  if (condominioId && !ids.includes(condominioId)) {
    res.status(403).json({ error: 'Condomínio fora do seu escopo' });
    return;
  }
  const row = await queryOne(
    `INSERT INTO whats_contatos (nome, telefone, condominio_id) VALUES ($1,$2,$3) RETURNING *`,
    [nome, telefone, condominioId || null]
  );
  res.status(201).json(row);
  } catch (err: any) { console.error('POST /whatsapp-contatos erro:', err.message); res.status(500).json({ error: 'Erro interno' }); }
});

// DELETE /api/moradores/whatsapp-contatos/:id
router.delete('/whatsapp-contatos/:id', async (req: AuthRequest, res: Response) => {
  try {
  const ids: string[] = (req as any).condominioIds;
  const count = await execute(
    'DELETE FROM whats_contatos WHERE id = $1 AND (condominio_id IS NULL OR condominio_id = ANY($2))',
    [req.params.id, ids]
  );
  if (count === 0) { res.status(404).json({ error: 'Contato não encontrado' }); return; }
  res.json({ ok: true });
  } catch (err: any) { console.error('DELETE /whatsapp-contatos/:id erro:', err.message); res.status(500).json({ error: 'Erro interno' }); }
});

export default router;
