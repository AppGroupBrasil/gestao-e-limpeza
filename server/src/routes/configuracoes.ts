import { Router, Response } from 'express';
import { queryOne } from '../db/database.js';
import { AuthRequest } from '../middleware/auth.js';
import { requireMinRole, getTenantId } from '../middleware/rbac.js';

const router = Router();

/** Linha do tenant; se ainda não existir, cai no padrão da plataforma */
async function loadTenantRow(table: string, tenantId: string) {
  const row = await queryOne(`SELECT * FROM ${table} WHERE id = $1`, [tenantId]);
  if (row) return row;
  if (tenantId === 'global') return null;
  return queryOne(`SELECT * FROM ${table} WHERE id = $1`, ['global']);
}

// ── Tema ──

// GET /api/configuracoes/tema
router.get('/tema', async (req: AuthRequest, res: Response) => {
  try {
    const row = await loadTenantRow('tema_config', getTenantId(req.user));
    res.json(row || {});
  } catch (err: any) {
    console.error('GET /configuracoes/tema erro:', err.message);
    res.json({});
  }
});

// PUT /api/configuracoes/tema
router.put('/tema', requireMinRole('administrador'), async (req: AuthRequest, res: Response) => {
  try {
    const { corPrimaria, corSecundaria, corMenu, corBotao, corFundo, modoEscuro, logoUrl, loginTitulo, loginSubtitulo } = req.body;
    const row = await queryOne(
      `INSERT INTO tema_config (id, cor_primaria, cor_secundaria, cor_menu, cor_botao, cor_fundo, modo_escuro, logo_url, login_titulo, login_subtitulo)
       VALUES ($10, $1,$2,$3,$4,$5,$6,$7,$8,$9)
       ON CONFLICT (id) DO UPDATE SET cor_primaria=$1, cor_secundaria=$2, cor_menu=$3, cor_botao=$4, cor_fundo=$5, modo_escuro=$6, logo_url=$7, login_titulo=$8, login_subtitulo=$9
       RETURNING *`,
      [corPrimaria, corSecundaria, corMenu, corBotao, corFundo, modoEscuro || false, logoUrl, loginTitulo, loginSubtitulo, getTenantId(req.user)]
    );
    res.json(row);
  } catch (err: any) {
    console.error('PUT /configuracoes/tema erro:', err.message);
    res.status(500).json({ error: 'Erro interno no servidor' });
  }
});

// ── Permissões do Quadro ──

// GET /api/configuracoes/quadro-permissoes
router.get('/quadro-permissoes', async (req: AuthRequest, res: Response) => {
  try {
    const row = await loadTenantRow('quadro_permissoes', getTenantId(req.user));
    res.json(row || {});
  } catch (err: any) {
    console.error('GET /configuracoes/quadro-permissoes erro:', err.message);
    res.json({});
  }
});

// PUT /api/configuracoes/quadro-permissoes
router.put('/quadro-permissoes', requireMinRole('administrador'), async (req: AuthRequest, res: Response) => {
  try {
    const { cadastrar, editar, excluir } = req.body;
    const row = await queryOne(
      `INSERT INTO quadro_permissoes (id, cadastrar, editar, excluir)
       VALUES ($4, $1, $2, $3)
       ON CONFLICT (id) DO UPDATE SET cadastrar=$1, editar=$2, excluir=$3
       RETURNING *`,
      [JSON.stringify(cadastrar), JSON.stringify(editar), JSON.stringify(excluir), getTenantId(req.user)]
    );
    res.json(row);
  } catch (err: any) {
    console.error('PUT /configuracoes/quadro-permissoes erro:', err.message);
    res.status(500).json({ error: 'Erro interno no servidor' });
  }
});

export default router;
