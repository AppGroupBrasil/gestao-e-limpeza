import { Router, Response } from 'express';
import { query, queryOne, execute } from '../db/database.js';
import { AuthRequest } from '../middleware/auth.js';
import { requireMinRole, getTenantId } from '../middleware/rbac.js';

const router = Router();

// ── Leituras de QR Code ── (ANTES de /:id para não conflitar)

// GET /api/qrcodes/respostas/all — lista respostas de formulários com dados do QR Code
router.get('/respostas/all', async (req: AuthRequest, res: Response) => {
  try {
    const ids: string[] = (req as any).condominioIds;
    const rows = await query(
      `SELECT l.*, q.nome AS qr_nome, q.descricao AS qr_descricao, q.blocos AS qr_blocos
       FROM leituras_qrcode l
       INNER JOIN qrcodes q ON q.id::text = l.qr_conteudo
       WHERE l.respostas_formulario IS NOT NULL
         AND q.condominio_id = ANY($1)
       ORDER BY l.data_hora DESC
       LIMIT 1000`,
      [ids]
    );
    res.json(rows);
  } catch (err: any) { console.error("[QRCodes]", err.message); res.status(500).json({ error: "Erro interno" }); }
});

// GET /api/qrcodes/leituras/all
router.get('/leituras/all', async (req: AuthRequest, res: Response) => {
  try {
    const ids: string[] = (req as any).condominioIds;
    const rows = await query(
      `SELECT l.* FROM leituras_qrcode l
       INNER JOIN qrcodes q ON q.id::text = l.qr_conteudo
       WHERE q.condominio_id = ANY($1)
       ORDER BY l.data_hora DESC LIMIT 500`,
      [ids]
    );
    res.json(rows);
  } catch (err: any) { console.error("[QRCodes]", err.message); res.status(500).json({ error: "Erro interno" }); }
});

// POST /api/qrcodes/leituras
router.post('/leituras', async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) { res.status(401).json({ error: 'Não autenticado' }); return; }
    const { qrConteudo, funcionarioNome, funcionarioEmail, funcionarioCargo, latitude, longitude, endereco } = req.body;
    const row = await queryOne(
      `INSERT INTO leituras_qrcode (qr_conteudo, funcionario_id, funcionario_nome, funcionario_email, funcionario_cargo, latitude, longitude, endereco)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [qrConteudo, req.user.id, funcionarioNome || req.user.nome, funcionarioEmail || req.user.email, funcionarioCargo, latitude, longitude, endereco]
    );

    // Incrementar contador de respostas se for qrcode existente
    await query(
      `UPDATE qrcodes SET respostas = respostas + 1 WHERE id::text = $1 OR nome = $1`,
      [qrConteudo]
    );

    res.status(201).json(row);
  } catch (err: any) { console.error("[QRCodes]", err.message); res.status(500).json({ error: "Erro interno" }); }
});

// ── Controle de Ponto ── (ANTES de /:id)

// GET /api/qrcodes/ponto/all
router.get('/ponto/all', async (req: AuthRequest, res: Response) => {
  try {
    const ids: string[] = (req as any).condominioIds;
    const rows = await query(
      `SELECT p.* FROM controle_ponto p
       INNER JOIN usuarios u ON u.id = p.funcionario_id
       WHERE u.condominio_id = ANY($1)
       ORDER BY p.data_hora DESC LIMIT 500`,
      [ids]
    );
    res.json(rows);
  } catch (err: any) { console.error("[QRCodes]", err.message); res.status(500).json({ error: "Erro interno" }); }
});

// POST /api/qrcodes/ponto
router.post('/ponto', async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) { res.status(401).json({ error: 'Não autenticado' }); return; }
    const { tipo, funcionarioNome, funcionarioEmail, funcionarioCargo, latitude, longitude, endereco, permanencia } = req.body;
    const row = await queryOne(
      `INSERT INTO controle_ponto (funcionario_id, funcionario_nome, funcionario_email, funcionario_cargo, tipo, latitude, longitude, endereco, permanencia)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [req.user.id, funcionarioNome || req.user.nome, funcionarioEmail || req.user.email, funcionarioCargo, tipo, latitude, longitude, endereco, permanencia]
    );
    res.status(201).json(row);
  } catch (err: any) { console.error("[QRCodes]", err.message); res.status(500).json({ error: "Erro interno" }); }
});

// ── SLA Registros ── (ANTES de /:id)

// GET /api/qrcodes/sla/all
router.get('/sla/all', async (req: AuthRequest, res: Response) => {
  try {
    const ids: string[] = (req as any).condominioIds;
    const rows = await query(
      `SELECT s.* FROM sla_registros s
       WHERE s.criado_por IN (
         SELECT id FROM usuarios WHERE condominio_id = ANY($1)
       )
       ORDER BY s.abertura DESC LIMIT 500`,
      [ids]
    );
    res.json(rows);
  } catch (err: any) { console.error("[QRCodes]", err.message); res.status(500).json({ error: "Erro interno" }); }
});

// POST /api/qrcodes/sla
router.post('/sla', async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) { res.status(401).json({ error: 'Não autenticado' }); return; }
    const { blocoId, categoria, descricao, status } = req.body;
    const row = await queryOne(
      `INSERT INTO sla_registros (bloco_id, categoria, descricao, abertura, status, criado_por)
       VALUES ($1,$2,$3,NOW(),$4,$5) RETURNING *`,
      [blocoId, categoria, descricao || '', status || 'aberto', req.user.id]
    );
    res.status(201).json(row);
  } catch (err: any) { console.error("[QRCodes]", err.message); res.status(500).json({ error: "Erro interno" }); }
});

// PATCH /api/qrcodes/sla/:id
router.patch('/sla/:id', async (req: AuthRequest, res: Response) => {
  try {
    const ids: string[] = (req as any).condominioIds;
    const { status } = req.body;
    // Verificar que o SLA pertence a um usuário do escopo
    const existing = await queryOne(
      `SELECT s.id FROM sla_registros s
       INNER JOIN usuarios u ON u.id = s.criado_por
       WHERE s.id = $1 AND u.condominio_id = ANY($2)`,
      [req.params.id, ids]
    );
    if (!existing) { res.status(404).json({ error: 'Registro SLA não encontrado' }); return; }
    let sql = '';
    if (status === 'em_atendimento') {
      sql = `UPDATE sla_registros SET status=$1, inicio_atendimento=NOW() WHERE id=$2 RETURNING *`;
    } else if (status === 'resolvido') {
      sql = `UPDATE sla_registros SET status=$1, encerramento=NOW() WHERE id=$2 RETURNING *`;
    } else {
      sql = `UPDATE sla_registros SET status=$1 WHERE id=$2 RETURNING *`;
    }
    const row = await queryOne(sql, [status, req.params.id]);
    res.json(row);
  } catch (err: any) { console.error("[QRCodes]", err.message); res.status(500).json({ error: "Erro interno" }); }
});

// ── Supervisor Permission ── (ANTES de /:id)

// GET /api/qrcodes/supervisor-perm
router.get('/supervisor-perm', async (req: AuthRequest, res: Response) => {
  try {
    const row = await queryOne(
      `SELECT valor FROM configuracoes_gerais WHERE chave = 'qrcode_supervisor_autorizado' AND tenant_id IN ($1, 'global')
       ORDER BY (tenant_id = $1) DESC LIMIT 1`,
      [getTenantId(req.user)]
    );
    res.json({ autorizado: row?.valor === 'true' });
  } catch (err: any) { console.error("[QRCodes]", err.message); res.status(500).json({ error: "Erro interno" }); }
});

// PUT /api/qrcodes/supervisor-perm
router.put('/supervisor-perm', requireMinRole('administrador'), async (req: AuthRequest, res: Response) => {
  try {
    const { autorizado } = req.body;
    await execute(
      `INSERT INTO configuracoes_gerais (tenant_id, chave, valor) VALUES ($2, 'qrcode_supervisor_autorizado', $1)
       ON CONFLICT (tenant_id, chave) DO UPDATE SET valor = $1`,
      [autorizado ? 'true' : 'false', getTenantId(req.user)]
    );
    res.json({ autorizado });
  } catch (err: any) { console.error("[QRCodes]", err.message); res.status(500).json({ error: "Erro interno" }); }
});

// ── CRUD principal ── (/:id DEPOIS das rotas específicas)

// GET /api/qrcodes
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const ids: string[] = (req as any).condominioIds;
    const rows = await query(
      `SELECT * FROM qrcodes WHERE condominio_id = ANY($1) ORDER BY criado_em DESC`,
      [ids]
    );
    res.json(rows);
  } catch (err: any) { console.error("[QRCodes]", err.message); res.status(500).json({ error: "Erro interno" }); }
});

// GET /api/qrcodes/:id
router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const ids: string[] = (req as any).condominioIds;
    const row = await queryOne(
      'SELECT * FROM qrcodes WHERE id = $1 AND condominio_id = ANY($2)',
      [req.params.id, ids]
    );
    if (!row) { res.status(404).json({ error: 'QR Code não encontrado' }); return; }
    res.json(row);
  } catch (err: any) { console.error("[QRCodes]", err.message); res.status(500).json({ error: "Erro interno" }); }
});

// POST /api/qrcodes
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) { res.status(401).json({ error: 'Não autenticado' }); return; }
    const { nome, descricao, logo, blocos, dispensarIdentificacao, blocosCadastrados, condominioId, emailNotificacao } = req.body;
    const ids: string[] = (req as any).condominioIds;
    if (!condominioId || !ids.includes(condominioId)) {
      res.status(403).json({ error: 'Sem permissão para este condomínio' });
      return;
    }
    const row = await queryOne(
      `INSERT INTO qrcodes (nome, descricao, logo, blocos, dispensar_identificacao, blocos_cadastrados, condominio_id, criado_por, email_notificacao)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [nome, descricao, logo, JSON.stringify(blocos || []), dispensarIdentificacao || false, blocosCadastrados || [], condominioId, req.user.id, emailNotificacao || null]
    );
    res.status(201).json(row);
  } catch (err: any) { console.error("[QRCodes]", err.message); res.status(500).json({ error: "Erro interno" }); }
});

// PUT /api/qrcodes/:id
router.put('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const ids: string[] = (req as any).condominioIds;
    const { nome, descricao, logo, blocos, dispensarIdentificacao, blocosCadastrados, condominioId, emailNotificacao } = req.body;
    const destinoCondominioId = condominioId || null;
    if (destinoCondominioId && !ids.includes(destinoCondominioId)) {
      res.status(403).json({ error: 'Sem permissão para este condomínio' });
      return;
    }
    const row = await queryOne(
      `UPDATE qrcodes SET nome=$1, descricao=$2, logo=$3, blocos=$4, dispensar_identificacao=$5, blocos_cadastrados=$6, condominio_id = COALESCE($7, condominio_id), email_notificacao=$10
       WHERE id=$8 AND condominio_id = ANY($9) RETURNING *`,
      [nome, descricao, logo, JSON.stringify(blocos), dispensarIdentificacao, blocosCadastrados, destinoCondominioId, req.params.id, ids, emailNotificacao || null]
    );
    if (!row) { res.status(404).json({ error: 'QR Code não encontrado' }); return; }
    res.json(row);
  } catch (err: any) { console.error("[QRCodes]", err.message); res.status(500).json({ error: "Erro interno" }); }
});

// DELETE /api/qrcodes/:id
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const ids: string[] = (req as any).condominioIds;
    await execute(
      'DELETE FROM qrcodes WHERE id = $1 AND condominio_id = ANY($2)',
      [req.params.id, ids]
    );
    res.json({ ok: true });
  } catch (err: any) { console.error("[QRCodes]", err.message); res.status(500).json({ error: "Erro interno" }); }
});

export default router;
