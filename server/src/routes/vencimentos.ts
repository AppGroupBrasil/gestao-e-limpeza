import { Router, Response } from 'express';
import { query, queryOne, execute } from '../db/database.js';
import { AuthRequest } from '../middleware/auth.js';
import { requireMinRole, getTenantId } from '../middleware/rbac.js';

const router = Router();

// Helper: empty string → null (PostgreSQL date columns don't accept '')
const dateOrNull = (v: any) => (v && typeof v === 'string' && v.trim() !== '' ? v : null);

// GET /api/vencimentos
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const ids: string[] = (req as any).condominioIds;
    if (ids.length === 0) { res.json([]); return; }
    const rows = await query(
      `SELECT v.*, c.nome as condominio_nome FROM vencimentos v
       LEFT JOIN condominios c ON c.id = v.condominio_id
       WHERE v.condominio_id = ANY($1) ORDER BY v.data_vencimento`,
      [ids]
    );
    res.json(rows);
  } catch (err: any) {
    console.error('[VENCIMENTOS GET]', err.message);
    res.status(500).json({ error: 'Erro ao carregar vencimentos' });
  }
});

// POST /api/vencimentos
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const ids: string[] = (req as any).condominioIds;
    const { titulo, tipo, descricao, condominioId, dataVencimento, dataUltimaManutencao, dataProximaManutencao, emails, avisos, imagens } = req.body;
    if (!condominioId || !ids.includes(condominioId)) {
      res.status(403).json({ error: 'Sem acesso a este condomínio' });
      return;
    }
    const row = await queryOne(
      `INSERT INTO vencimentos (titulo, tipo, descricao, condominio_id, data_vencimento, data_ultima_manutencao, data_proxima_manutencao, emails, avisos, imagens)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [titulo, tipo, descricao, condominioId, dateOrNull(dataVencimento), dateOrNull(dataUltimaManutencao), dateOrNull(dataProximaManutencao), emails || [], JSON.stringify(avisos || []), imagens || []]
    );
    res.status(201).json(row);
  } catch (err: any) {
    console.error('[VENCIMENTOS POST]', err.message);
    res.status(500).json({ error: 'Erro ao criar vencimento' });
  }
});

// PUT /api/vencimentos/:id
router.put('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const ids: string[] = (req as any).condominioIds;
    const { titulo, tipo, descricao, dataVencimento, dataUltimaManutencao, dataProximaManutencao, emails, avisos, imagens, qtdNotificacoes } = req.body;
    const row = await queryOne(
      `UPDATE vencimentos SET titulo=$1, tipo=$2, descricao=$3, data_vencimento=$4, data_ultima_manutencao=$5,
       data_proxima_manutencao=$6, emails=$7, avisos=$8, imagens=$9, qtd_notificacoes=$10
       WHERE id=$11 AND condominio_id = ANY($12) RETURNING *`,
      [titulo, tipo, descricao, dateOrNull(dataVencimento), dateOrNull(dataUltimaManutencao), dateOrNull(dataProximaManutencao), emails, JSON.stringify(avisos), imagens, qtdNotificacoes || 0, req.params.id, ids]
    );
    if (!row) { res.status(404).json({ error: 'Vencimento não encontrado' }); return; }
    res.json(row);
  } catch (err: any) {
    console.error('[VENCIMENTOS PUT]', err.message);
    res.status(500).json({ error: 'Erro ao atualizar vencimento' });
  }
});

// DELETE /api/vencimentos/:id
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const ids: string[] = (req as any).condominioIds;
    const count = await execute('DELETE FROM vencimentos WHERE id = $1 AND condominio_id = ANY($2)', [req.params.id, ids]);
    if (count === 0) { res.status(404).json({ error: 'Vencimento não encontrado' }); return; }
    res.json({ ok: true });
  } catch (err: any) {
    console.error('[VENCIMENTOS DELETE]', err.message);
    res.status(500).json({ error: 'Erro ao excluir vencimento' });
  }
});

// ── Emails globais de vencimentos ──

// GET /api/vencimentos/emails
router.get('/emails/global', async (req: AuthRequest, res: Response) => {
  const tenantId = getTenantId(req.user);
  const row =
    (await queryOne('SELECT emails FROM vencimentos_emails WHERE id = $1', [tenantId])) ??
    (tenantId === 'global' ? null : await queryOne('SELECT emails FROM vencimentos_emails WHERE id = $1', ['global']));
  res.json(row || { emails: [] });
});

// PUT /api/vencimentos/emails
router.put('/emails/global', requireMinRole('administrador'), async (req: AuthRequest, res: Response) => {
  const lista: string[] = Array.isArray(req.body.emails)
    ? req.body.emails.map((e: any) => String(e).trim().slice(0, 254)).filter((e: string) => /^[^@\s]+@[^@\s.]+\.[^@\s]+$/.test(e))
    : [];
  const row = await queryOne(
    `INSERT INTO vencimentos_emails (id, emails) VALUES ($2, $1)
     ON CONFLICT (id) DO UPDATE SET emails = $1 RETURNING *`,
    [lista, getTenantId(req.user)]
  );
  res.json(row);
});

export default router;
