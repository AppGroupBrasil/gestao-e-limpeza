import { Router, Response } from 'express';
import { query, queryOne, execute, withTransaction } from '../db/database.js';
import { AuthRequest } from '../middleware/auth.js';

const router = Router();

function gerarProtocolo(): string {
  const now = new Date();
  const y = String(now.getFullYear()).slice(-2);
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const r = String(Math.floor(Math.random() * 9999)).padStart(4, '0');
  return `MAT-${y}${m}${d}-${r}`;
}

// GET /api/materiais
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const ids: string[] = (req as any).condominioIds;
    if (ids.length === 0) { res.json([]); return; }
    const rows = await query(
      `SELECT m.*, c.nome as condominio_nome FROM materiais m
       LEFT JOIN condominios c ON c.id = m.condominio_id
       WHERE m.condominio_id = ANY($1) ORDER BY m.nome`,
      [ids]
    );
    res.json(rows);
  } catch (err: any) {
    console.error('GET /materiais erro:', err.message);
    res.status(500).json({ error: 'Erro interno no servidor' });
  }
});

// POST /api/materiais
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const ids: string[] = (req as any).condominioIds;
    const { nome, categoria, unidade, quantidade, quantidadeMinima, custoUnitario, condominioId, emailNotificacao } = req.body;
    if (!condominioId || !ids.includes(condominioId)) {
      res.status(403).json({ error: 'Sem acesso' });
      return;
    }
    const protocolo = gerarProtocolo();
    const row = await queryOne(
      `INSERT INTO materiais (protocolo, nome, categoria, unidade, quantidade, quantidade_minima, custo_unitario, condominio_id, email_notificacao)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [protocolo, nome, categoria, unidade || 'un', quantidade || 0, quantidadeMinima || 0, custoUnitario || 0, condominioId, emailNotificacao]
    );
    res.status(201).json(row);
  } catch (err: any) {
    console.error('POST /materiais erro:', err.message);
    res.status(500).json({ error: 'Erro interno no servidor' });
  }
});

// PUT /api/materiais/:id
router.put('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const ids: string[] = (req as any).condominioIds;
    const { nome, categoria, unidade, quantidadeMinima, custoUnitario, emailNotificacao } = req.body;
    const row = await queryOne(
      `UPDATE materiais SET nome=$1, categoria=$2, unidade=$3, quantidade_minima=$4, custo_unitario=$5, email_notificacao=$6
       WHERE id=$7 AND condominio_id = ANY($8) RETURNING *`,
      [nome, categoria, unidade, quantidadeMinima, custoUnitario, emailNotificacao, req.params.id, ids]
    );
    if (!row) { res.status(404).json({ error: 'Material não encontrado' }); return; }
    res.json(row);
  } catch (err: any) {
    console.error('PUT /materiais erro:', err.message);
    res.status(500).json({ error: 'Erro interno no servidor' });
  }
});

// DELETE /api/materiais/:id
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const ids: string[] = (req as any).condominioIds;
    const count = await execute('DELETE FROM materiais WHERE id = $1 AND condominio_id = ANY($2)', [req.params.id, ids]);
    if (count === 0) { res.status(404).json({ error: 'Material não encontrado' }); return; }
    res.json({ ok: true });
  } catch (err: any) {
    console.error('DELETE /materiais erro:', err.message);
    res.status(500).json({ error: 'Erro interno no servidor' });
  }
});

// ── Movimentações ──

/** Garante que o material pertence a um condomínio do escopo */
async function materialNoEscopo(req: AuthRequest): Promise<boolean> {
  const ids: string[] = (req as any).condominioIds;
  const row = await queryOne(
    'SELECT 1 FROM materiais WHERE id = $1 AND (condominio_id IS NULL OR condominio_id = ANY($2))',
    [req.params.id, ids]
  );
  return !!row;
}

// GET /api/materiais/:id/movimentacoes
router.get('/:id/movimentacoes', async (req: AuthRequest, res: Response) => {
  try {
    if (!await materialNoEscopo(req)) { res.status(404).json({ error: 'Material não encontrado' }); return; }
    const rows = await query(
      `SELECT * FROM materiais_movimentacoes WHERE material_id = $1 ORDER BY data DESC`,
      [req.params.id]
    );
    res.json(rows);
  } catch (err: any) {
    console.error('GET /materiais/:id/movimentacoes erro:', err.message);
    res.status(500).json({ error: 'Erro interno no servidor' });
  }
});

// POST /api/materiais/:id/movimentacoes
router.post('/:id/movimentacoes', async (req: AuthRequest, res: Response) => {
  try {
    if (!await materialNoEscopo(req)) { res.status(404).json({ error: 'Material não encontrado' }); return; }
    const { tipo, quantidade, observacao, fotos, notaFiscalUrl, audioUrl, funcionarioNome } = req.body;
    const materialId = req.params.id;
    const qtd = Number(quantidade);
    if (!Number.isFinite(qtd) || qtd <= 0) { res.status(400).json({ error: 'Quantidade inválida' }); return; }
    if (tipo !== 'entrada' && tipo !== 'saida') { res.status(400).json({ error: 'Tipo inválido' }); return; }

    const row = await withTransaction(async (client) => {
      // Atualizar quantidade do material
      const op = tipo === 'entrada' ? '+' : '-';
      await client.query(
        `UPDATE materiais SET quantidade = GREATEST(quantidade ${op} $1, 0) WHERE id = $2`,
        [qtd, materialId]
      );

      const { rows } = await client.query(
        `INSERT INTO materiais_movimentacoes (material_id, tipo, quantidade, observacao, fotos, nota_fiscal_url, audio_url, funcionario_id, funcionario_nome)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
        [materialId, tipo, qtd, observacao, fotos || [], notaFiscalUrl, audioUrl, req.user!.id, funcionarioNome || req.user!.nome]
      );
      return rows[0];
    });

    res.status(201).json(row);
  } catch (err: any) {
    console.error('POST /materiais/:id/movimentacoes erro:', err.message);
    res.status(500).json({ error: 'Erro interno no servidor' });
  }
});

export default router;
