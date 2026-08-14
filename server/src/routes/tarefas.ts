import { Router, Response } from 'express';
import { query, queryOne, execute } from '../db/database.js';
import { AuthRequest } from '../middleware/auth.js';

const router = Router();

// ── Tarefas Agendadas ──

// GET /api/tarefas
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const ids: string[] = (req as any).condominioIds;
    if (ids.length === 0) { res.json([]); return; }
    const isFuncionario = req.user?.role === 'funcionario';
    const rows = isFuncionario
      ? await query(
        `SELECT t.*, c.nome as condominio_nome FROM tarefas_agendadas t
         LEFT JOIN condominios c ON c.id = t.condominio_id
         WHERE t.condominio_id = ANY($1)
           AND (
             t.funcionario_id = $2
             OR LOWER(COALESCE(t.funcionario_nome, '')) = LOWER($3)
           )
         ORDER BY t.criado_em DESC`,
        [ids, req.user!.id, req.user!.nome]
      )
      : await query(
        `SELECT t.*, c.nome as condominio_nome FROM tarefas_agendadas t
         LEFT JOIN condominios c ON c.id = t.condominio_id
         WHERE t.condominio_id = ANY($1) ORDER BY t.criado_em DESC`,
        [ids]
      );
    res.json(rows);
  } catch (err: any) {
    console.error('GET /tarefas erro:', err.message);
    res.status(500).json({ error: 'Erro interno no servidor' });
  }
});

// POST /api/tarefas
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const ids: string[] = (req as any).condominioIds;
    const { titulo, descricao, funcionarioId, funcionarioNome, condominioId, bloco, local, recorrencia, diasSemana, dataEspecifica, diaMes, prioridade } = req.body;
    if (!condominioId || !ids.includes(condominioId)) {
      res.status(403).json({ error: 'Sem acesso' });
      return;
    }
    const row = await queryOne(
      `INSERT INTO tarefas_agendadas (titulo, descricao, funcionario_id, funcionario_nome, condominio_id, bloco, local, recorrencia, dias_semana, data_especifica, dia_mes, criado_por, prioridade)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
      [titulo, descricao, funcionarioId, funcionarioNome, condominioId, bloco, local, recorrencia || 'unica', diasSemana || [], dataEspecifica, diaMes, req.user!.id, prioridade || 'media']
    );
    res.status(201).json(row);
  } catch (err: any) {
    console.error('POST /tarefas erro:', err.message);
    res.status(500).json({ error: 'Erro interno no servidor' });
  }
});

// PUT /api/tarefas/:id
router.put('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const ids: string[] = (req as any).condominioIds;
    const { titulo, descricao, funcionarioId, funcionarioNome, bloco, local, recorrencia, diasSemana, dataEspecifica, diaMes, prioridade, condominioId } = req.body;
    const destinoCondominioId = condominioId || null;
    if (destinoCondominioId && !ids.includes(destinoCondominioId)) {
      res.status(403).json({ error: 'Sem acesso' });
      return;
    }
    const row = await queryOne(
      `UPDATE tarefas_agendadas SET titulo=$1, descricao=$2, funcionario_id=$3, funcionario_nome=$4, bloco=$5, local=$6, recorrencia=$7, dias_semana=$8, data_especifica=$9, dia_mes=$10, prioridade=$11, condominio_id = COALESCE($12, condominio_id)
       WHERE id=$13 AND condominio_id = ANY($14) RETURNING *`,
      [titulo, descricao, funcionarioId, funcionarioNome, bloco, local, recorrencia, diasSemana, dataEspecifica, diaMes, prioridade, destinoCondominioId, req.params.id, ids]
    );
    if (!row) { res.status(404).json({ error: 'Tarefa não encontrada' }); return; }
    res.json(row);
  } catch (err: any) {
    console.error('PUT /tarefas erro:', err.message);
    res.status(500).json({ error: 'Erro interno no servidor' });
  }
});

// DELETE /api/tarefas/:id
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const ids: string[] = (req as any).condominioIds;
    const count = await execute('DELETE FROM tarefas_agendadas WHERE id = $1 AND condominio_id = ANY($2)', [req.params.id, ids]);
    if (count === 0) { res.status(404).json({ error: 'Tarefa não encontrada' }); return; }
    res.json({ ok: true });
  } catch (err: any) {
    console.error('DELETE /tarefas erro:', err.message);
    res.status(500).json({ error: 'Erro interno no servidor' });
  }
});

// ── Execuções de Tarefas ──

/** Garante que a tarefa pertence a um condomínio do escopo */
async function tarefaNoEscopo(req: AuthRequest): Promise<boolean> {
  const ids: string[] = (req as any).condominioIds;
  const row = await queryOne(
    'SELECT 1 FROM tarefas_agendadas WHERE id = $1 AND (condominio_id IS NULL OR condominio_id = ANY($2))',
    [req.params.id, ids]
  );
  return !!row;
}

// GET /api/tarefas/:id/execucoes
router.get('/:id/execucoes', async (req: AuthRequest, res: Response) => {
  try {
    if (!await tarefaNoEscopo(req)) { res.status(404).json({ error: 'Tarefa não encontrada' }); return; }
    const rows = await query(
      'SELECT * FROM tarefas_execucoes WHERE tarefa_id = $1 ORDER BY data_execucao DESC',
      [req.params.id]
    );
    res.json(rows);
  } catch (err: any) {
    console.error('GET /tarefas/:id/execucoes erro:', err.message);
    res.status(500).json({ error: 'Erro interno no servidor' });
  }
});

// GET /api/tarefas/execucoes/all
router.get('/execucoes/all', async (req: AuthRequest, res: Response) => {
  try {
    const ids: string[] = (req as any).condominioIds;
    if (ids.length === 0) { res.json([]); return; }
    const rows = await query(
      `SELECT te.*, ta.titulo as tarefa_titulo, ta.condominio_id
       FROM tarefas_execucoes te
       JOIN tarefas_agendadas ta ON ta.id = te.tarefa_id
       WHERE ta.condominio_id = ANY($1)
       ORDER BY te.data_execucao DESC`,
      [ids]
    );
    res.json(rows);
  } catch (err: any) {
    console.error('GET /tarefas/execucoes/all erro:', err.message);
    res.status(500).json({ error: 'Erro interno no servidor' });
  }
});

// POST /api/tarefas/:id/execucoes
router.post('/:id/execucoes', async (req: AuthRequest, res: Response) => {
  try {
    if (!await tarefaNoEscopo(req)) { res.status(404).json({ error: 'Tarefa não encontrada' }); return; }
    const { funcionarioNome, status, fotos, observacao, latitude, longitude, audioUrl } = req.body;
    const row = await queryOne(
      `INSERT INTO tarefas_execucoes (tarefa_id, funcionario_id, funcionario_nome, status, fotos, observacao, latitude, longitude, audio_url)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [req.params.id, req.user!.id, funcionarioNome || req.user!.nome, status || 'concluida', fotos || [], observacao, latitude, longitude, audioUrl]
    );
    res.status(201).json(row);
  } catch (err: any) {
    console.error('POST /tarefas/:id/execucoes erro:', err.message);
    res.status(500).json({ error: 'Erro interno no servidor' });
  }
});

export default router;
