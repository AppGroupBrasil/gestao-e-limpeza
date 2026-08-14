import { Router, Response } from 'express';
import { query, queryOne, execute } from '../db/database.js';
import { AuthRequest } from '../middleware/auth.js';

const router = Router();

// GET /api/roteiros
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
  const ids: string[] = (req as any).condominioIds;
  const rows = await query(
    `SELECT r.* FROM roteiros r
     WHERE r.condominio_id IS NULL OR r.condominio_id = ANY($1)
     ORDER BY r.criado_em DESC`,
    [ids]
  );
  res.json(rows);
  } catch (err: any) { console.error('GET /roteiros erro:', err.message); res.status(500).json({ error: 'Erro interno' }); }
});

// GET /api/roteiros/:id
router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
  const ids: string[] = (req as any).condominioIds;
  const row = await queryOne(
    'SELECT * FROM roteiros WHERE id = $1 AND (condominio_id IS NULL OR condominio_id = ANY($2))',
    [req.params.id, ids]
  );
  if (!row) { res.status(404).json({ error: 'Roteiro não encontrado' }); return; }
  res.json(row);
  } catch (err: any) { console.error('GET /roteiros/:id erro:', err.message); res.status(500).json({ error: 'Erro interno' }); }
});

// POST /api/roteiros
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
  const ids: string[] = (req as any).condominioIds;
  const { titulo, descricao, categoria, capa, passos, condominioId } = req.body;
  if (condominioId && !ids.includes(condominioId)) {
    res.status(403).json({ error: 'Condomínio fora do seu escopo' });
    return;
  }
  const row = await queryOne(
    `INSERT INTO roteiros (titulo, descricao, categoria, capa, passos, condominio_id, criado_por)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
    [titulo, descricao, categoria, capa, JSON.stringify(passos || []), condominioId || null, req.user!.id]
  );
  res.status(201).json(row);
  } catch (err: any) { console.error('POST /roteiros erro:', err.message); res.status(500).json({ error: 'Erro interno' }); }
});

// PUT /api/roteiros/:id
router.put('/:id', async (req: AuthRequest, res: Response) => {
  try {
  const ids: string[] = (req as any).condominioIds;
  const { titulo, descricao, categoria, capa, passos } = req.body;
  const row = await queryOne(
    `UPDATE roteiros SET titulo=$1, descricao=$2, categoria=$3, capa=$4, passos=$5
     WHERE id=$6 AND (condominio_id IS NULL OR condominio_id = ANY($7)) RETURNING *`,
    [titulo, descricao, categoria, capa, JSON.stringify(passos), req.params.id, ids]
  );
  if (!row) { res.status(404).json({ error: 'Roteiro não encontrado' }); return; }
  res.json(row);
  } catch (err: any) { console.error('PUT /roteiros/:id erro:', err.message); res.status(500).json({ error: 'Erro interno' }); }
});

// DELETE /api/roteiros/:id
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
  const ids: string[] = (req as any).condominioIds;
  const count = await execute('DELETE FROM roteiros WHERE id = $1 AND (condominio_id IS NULL OR condominio_id = ANY($2))', [req.params.id, ids]);
  if (count === 0) { res.status(404).json({ error: 'Roteiro não encontrado' }); return; }
  res.json({ ok: true });
  } catch (err: any) { console.error('DELETE /roteiros/:id erro:', err.message); res.status(500).json({ error: 'Erro interno' }); }
});

// ── Execuções de Roteiros ──

/** Garante que o roteiro pertence ao escopo do usuário */
async function roteiroNoEscopo(req: AuthRequest): Promise<boolean> {
  const ids: string[] = (req as any).condominioIds;
  const row = await queryOne(
    'SELECT 1 FROM roteiros WHERE id = $1 AND (condominio_id IS NULL OR condominio_id = ANY($2))',
    [req.params.id, ids]
  );
  return !!row;
}

// GET /api/roteiros/:id/execucoes
router.get('/:id/execucoes', async (req: AuthRequest, res: Response) => {
  try {
  if (!await roteiroNoEscopo(req)) { res.status(404).json({ error: 'Roteiro não encontrado' }); return; }
  const rows = await query(
    'SELECT * FROM roteiros_execucoes_log WHERE roteiro_id = $1 ORDER BY data DESC',
    [req.params.id]
  );
  res.json(rows);
  } catch (err: any) { console.error('GET /roteiros/:id/execucoes erro:', err.message); res.status(500).json({ error: 'Erro interno' }); }
});

// POST /api/roteiros/:id/execucoes
router.post('/:id/execucoes', async (req: AuthRequest, res: Response) => {
  try {
  if (!await roteiroNoEscopo(req)) { res.status(404).json({ error: 'Roteiro não encontrado' }); return; }
  const { funcionarioNome, passosExec } = req.body;
  const row = await queryOne(
    `INSERT INTO roteiros_execucoes_log (roteiro_id, funcionario_id, funcionario_nome, passos_exec)
     VALUES ($1,$2,$3,$4) RETURNING *`,
    [req.params.id, req.user!.id, funcionarioNome || req.user!.nome, JSON.stringify(passosExec || [])]
  );
  res.status(201).json(row);
  } catch (err: any) { console.error('POST /roteiros/:id/execucoes erro:', err.message); res.status(500).json({ error: 'Erro interno' }); }
});

export default router;
