import { Router, Response } from 'express';
import { query, queryOne, execute } from '../db/database.js';
import { AuthRequest } from '../middleware/auth.js';
import { requireMinRole, getTenantId } from '../middleware/rbac.js';

const router = Router();

// GET /api/documentos-publicos — listar docs do escopo
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
  const ids: string[] = (req as any).condominioIds;
  const rows = await query(
    `SELECT dp.*, c.nome AS condominio_nome
     FROM documentos_publicos dp
     INNER JOIN condominios c ON c.id = dp.condominio_id
     WHERE dp.condominio_id = ANY($1)
     ORDER BY dp.criado_em DESC`,
    [ids]
  );
  res.json(rows);
  } catch (err: any) { console.error('GET /documentos-publicos erro:', err.message); res.status(500).json({ error: 'Erro interno' }); }
});

// ── Categorias personalizadas (ANTES de /:id) ──

const CATEGORIAS_KEY = 'doc_publicos_categorias';
const CATEGORIAS_PADRAO = [
  { value: 'comunicado', label: 'Comunicado' },
  { value: 'regulamento', label: 'Regulamento' },
  { value: 'ata', label: 'Ata de Reunião' },
  { value: 'aviso', label: 'Aviso' },
  { value: 'documento', label: 'Documento' },
  { value: 'manual', label: 'Manual' },
];

// GET /api/documentos-publicos/categorias
router.get('/categorias', async (req: AuthRequest, res: Response) => {
  try {
  const row = await queryOne(
    `SELECT valor FROM configuracoes_gerais WHERE chave = $1 AND tenant_id IN ($2, 'global')
     ORDER BY (tenant_id = $2) DESC LIMIT 1`,
    [CATEGORIAS_KEY, getTenantId(req.user)]
  );
  if (row?.valor) {
    try { res.json(JSON.parse(row.valor)); return; } catch { /* fallback */ }
  }
  res.json(CATEGORIAS_PADRAO);
  } catch (err: any) { console.error('GET /documentos-publicos/categorias erro:', err.message); res.status(500).json({ error: 'Erro interno' }); }
});

// PUT /api/documentos-publicos/categorias
router.put('/categorias', requireMinRole('supervisor'), async (req: AuthRequest, res: Response) => {
  try {
  const { categorias } = req.body;
  if (!Array.isArray(categorias)) { res.status(400).json({ error: 'Lista inválida' }); return; }
  const sanitized = categorias
    .filter((c: any) => c.value && c.label)
    .map((c: any) => ({ value: String(c.value).slice(0, 50), label: String(c.label).slice(0, 80) }));
  await execute(
    `INSERT INTO configuracoes_gerais (tenant_id, chave, valor) VALUES ($3, $1, $2)
     ON CONFLICT (tenant_id, chave) DO UPDATE SET valor = $2`,
    [CATEGORIAS_KEY, JSON.stringify(sanitized), getTenantId(req.user)]
  );
  res.json(sanitized);
  } catch (err: any) { console.error('PUT /documentos-publicos/categorias erro:', err.message); res.status(500).json({ error: 'Erro interno' }); }
});

// GET /api/documentos-publicos/:id
router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
  const ids: string[] = (req as any).condominioIds;
  const row = await queryOne(
    'SELECT * FROM documentos_publicos WHERE id = $1 AND condominio_id = ANY($2)',
    [req.params.id, ids]
  );
  if (!row) { res.status(404).json({ error: 'Documento não encontrado' }); return; }
  res.json(row);
  } catch (err: any) { console.error('GET /documentos-publicos/:id erro:', err.message); res.status(500).json({ error: 'Erro interno' }); }
});

// POST /api/documentos-publicos — criar novo doc (gera slug permanente)
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
  if (!req.user) { res.status(401).json({ error: 'Não autenticado' }); return; }
  const { condominioId, titulo, tipo, conteudo, arquivoUrl, arquivoNome } = req.body;
  const ids: string[] = (req as any).condominioIds;
  if (!condominioId || !ids.includes(condominioId)) {
    res.status(403).json({ error: 'Sem permissão para este condomínio' });
    return;
  }
  const row = await queryOne(
    `INSERT INTO documentos_publicos (condominio_id, titulo, tipo, conteudo, arquivo_url, arquivo_nome, criado_por)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
    [condominioId, titulo || 'Documento Público', tipo || 'comunicado', conteudo, arquivoUrl, arquivoNome, req.user.id]
  );
  res.status(201).json(row);
  } catch (err: any) { console.error('POST /documentos-publicos erro:', err.message); res.status(500).json({ error: 'Erro interno' }); }
});

// PUT /api/documentos-publicos/:id — atualizar conteúdo (slug NÃO muda)
router.put('/:id', async (req: AuthRequest, res: Response) => {
  try {
  const ids: string[] = (req as any).condominioIds;
  const { titulo, tipo, conteudo, arquivoUrl, arquivoNome } = req.body;
  const row = await queryOne(
    `UPDATE documentos_publicos
     SET titulo=$1, tipo=$2, conteudo=$3, arquivo_url=$4, arquivo_nome=$5, atualizado_em=NOW()
     WHERE id=$6 AND condominio_id = ANY($7) RETURNING *`,
    [titulo, tipo, conteudo, arquivoUrl, arquivoNome, req.params.id, ids]
  );
  if (!row) { res.status(404).json({ error: 'Documento não encontrado' }); return; }
  res.json(row);
  } catch (err: any) { console.error('PUT /documentos-publicos/:id erro:', err.message); res.status(500).json({ error: 'Erro interno' }); }
});

// PATCH /api/documentos-publicos/:id/toggle — ativar/desativar
router.patch('/:id/toggle', async (req: AuthRequest, res: Response) => {
  try {
  const ids: string[] = (req as any).condominioIds;
  const row = await queryOne(
    `UPDATE documentos_publicos SET ativo = NOT ativo, atualizado_em=NOW()
     WHERE id=$1 AND condominio_id = ANY($2) RETURNING *`,
    [req.params.id, ids]
  );
  if (!row) { res.status(404).json({ error: 'Documento não encontrado' }); return; }
  res.json(row);
  } catch (err: any) { console.error('PATCH /documentos-publicos/:id/toggle erro:', err.message); res.status(500).json({ error: 'Erro interno' }); }
});

// DELETE /api/documentos-publicos/:id
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
  const ids: string[] = (req as any).condominioIds;
  const existing = await queryOne(
    'SELECT id FROM documentos_publicos WHERE id=$1 AND condominio_id = ANY($2)',
    [req.params.id, ids]
  );
  if (!existing) { res.status(404).json({ error: 'Documento não encontrado' }); return; }
  await execute('DELETE FROM documentos_publicos WHERE id=$1', [req.params.id]);
  res.json({ ok: true });
  } catch (err: any) { console.error('DELETE /documentos-publicos/:id erro:', err.message); res.status(500).json({ error: 'Erro interno' }); }
});

export default router;
