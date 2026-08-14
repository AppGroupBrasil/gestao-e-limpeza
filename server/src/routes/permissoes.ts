import { Router, Response } from 'express';
import { query, queryOne } from '../db/database.js';
import { AuthRequest } from '../middleware/auth.js';
import { requireMinRole, getTenantId } from '../middleware/rbac.js';

const router = Router();

// GET /api/permissoes
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const rows = await query(
      `SELECT * FROM (
         SELECT DISTINCT ON (id) * FROM permissoes_funcoes
         WHERE tenant_id IN ($1, 'global')
         ORDER BY id, (tenant_id = $1) DESC
       ) p ORDER BY nome`,
      [getTenantId(req.user)]
    );
    res.json(rows);
  } catch (err: any) { console.error('GET /permissoes erro:', err.message); res.status(500).json({ error: 'Erro interno' }); }
});

// PUT /api/permissoes/:id
router.put('/:id', requireMinRole('administrador'), async (req: AuthRequest, res: Response) => {
  try {
    const { ativa, perfis } = req.body;
    const row = await queryOne(
      `INSERT INTO permissoes_funcoes (tenant_id, id, nome, ativa, perfis)
       SELECT $4, $3, COALESCE(g.nome, $3), $1, $2::jsonb
       FROM (SELECT 1) _
       LEFT JOIN permissoes_funcoes g ON g.id = $3 AND g.tenant_id = 'global'
       ON CONFLICT (tenant_id, id) DO UPDATE SET ativa = $1, perfis = $2::jsonb
       RETURNING *`,
      [ativa, JSON.stringify(perfis ?? {}), req.params.id, getTenantId(req.user)]
    );
    res.json(row);
  } catch (err: any) { console.error('PUT /permissoes/:id erro:', err.message); res.status(500).json({ error: 'Erro interno' }); }
});

export default router;
