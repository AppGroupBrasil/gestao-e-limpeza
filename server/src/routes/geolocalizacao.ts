import { Router, Response } from 'express';
import { query, queryOne } from '../db/database.js';
import { AuthRequest } from '../middleware/auth.js';

const router = Router();

// GET /api/geolocalizacao
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const { data } = req.query;
    const user = req.user!;
    let rows;

    if (user.role === 'master') {
      rows = await query(
        `SELECT g.*, u.nome as user_nome FROM geolocalizacao g
         LEFT JOIN usuarios u ON u.id = g.user_id
         WHERE ($1::date IS NULL OR g.data = $1::date)
         ORDER BY g.hora_chegada DESC LIMIT 500`,
        [data || null]
      );
    } else if (user.role === 'administrador') {
      // Somente usuários da própria conta (ou o próprio administrador)
      rows = await query(
        `SELECT g.*, u.nome as user_nome FROM geolocalizacao g
         INNER JOIN usuarios u ON u.id = g.user_id
         WHERE (u.administrador_id = $1 OR u.id = $1) AND ($2::date IS NULL OR g.data = $2::date)
         ORDER BY g.hora_chegada DESC LIMIT 500`,
        [user.id, data || null]
      );
    } else if (user.role === 'supervisor') {
      rows = await query(
        `SELECT g.*, u.nome as user_nome FROM geolocalizacao g
         INNER JOIN usuarios u ON u.id = g.user_id
         WHERE (u.supervisor_id = $1 OR u.id = $1) AND ($2::date IS NULL OR g.data = $2::date)
         ORDER BY g.hora_chegada DESC LIMIT 500`,
        [user.id, data || null]
      );
    } else {
      rows = await query(
        `SELECT g.*, u.nome as user_nome FROM geolocalizacao g
         LEFT JOIN usuarios u ON u.id = g.user_id
         WHERE g.user_id = $1 AND ($2::date IS NULL OR g.data = $2::date)
         ORDER BY g.hora_chegada DESC LIMIT 100`,
        [user.id, data || null]
      );
    }

    res.json(rows);
  } catch (err: any) {
    console.error('[GEO GET]', err.message);
    res.status(500).json({ error: 'Erro ao carregar geolocalização' });
  }
});

// POST /api/geolocalizacao
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const { latitude, longitude, endereco, funcaoId } = req.body;
    const row = await queryOne(
      `INSERT INTO geolocalizacao (user_id, latitude, longitude, endereco, funcao_id)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [req.user!.id, latitude, longitude, endereco, funcaoId || null]
    );
    res.status(201).json(row);
  } catch (err: any) {
    console.error('[GEO POST]', err.message);
    res.status(500).json({ error: 'Erro ao registrar check-in' });
  }
});

// PATCH /api/geolocalizacao/:id/saida
router.patch('/:id/saida', async (req: AuthRequest, res: Response) => {
  try {
    const { tempoTotal } = req.body;
    const row = await queryOne(
      `UPDATE geolocalizacao SET hora_saida = NOW(), tempo_total = $1 WHERE id = $2 AND user_id = $3 RETURNING *`,
      [tempoTotal, req.params.id, req.user!.id]
    );
    if (!row) { res.status(404).json({ error: 'Registro não encontrado' }); return; }
    res.json(row);
  } catch (err: any) {
    console.error('[GEO PATCH]', err.message);
    res.status(500).json({ error: 'Erro ao registrar saída' });
  }
});

// ── SLA ──

// GET /api/geolocalizacao/sla
router.get('/sla', async (req: AuthRequest, res: Response) => {
  try {
  const ids: string[] = (req as any).condominioIds;
  const rows = await query(
    `SELECT * FROM sla_registros WHERE condominio_id IS NULL OR condominio_id = ANY($1) ORDER BY abertura DESC`,
    [ids]
  );
  res.json(rows);
  } catch (err: any) { console.error('GET /geolocalizacao/sla erro:', err.message); res.status(500).json({ error: 'Erro interno' }); }
});

// POST /api/geolocalizacao/sla
router.post('/sla', async (req: AuthRequest, res: Response) => {
  try {
  const { blocoId, categoria, descricao, condominioId } = req.body;
  const row = await queryOne(
    `INSERT INTO sla_registros (bloco_id, categoria, descricao, condominio_id)
     VALUES ($1,$2,$3,$4) RETURNING *`,
    [blocoId, categoria, descricao, condominioId]
  );
  res.status(201).json(row);
  } catch (err: any) { console.error('POST /geolocalizacao/sla erro:', err.message); res.status(500).json({ error: 'Erro interno' }); }
});

// PATCH /api/geolocalizacao/sla/:id
router.patch('/sla/:id', async (req: AuthRequest, res: Response) => {
  try {
  const ids: string[] = (req as any).condominioIds;
  const { status } = req.body;
  const validStatus = ['aberto', 'em_atendimento', 'resolvido'];
  if (!validStatus.includes(status)) { res.status(400).json({ error: 'Status inválido' }); return; }
  const extra = status === 'em_atendimento' ? ', inicio_atendimento = NOW()' :
    status === 'resolvido' ? ', encerramento = NOW()' : '';
  const row = await queryOne(
    `UPDATE sla_registros SET status = $1 ${extra} WHERE id = $2 AND (condominio_id IS NULL OR condominio_id = ANY($3)) RETURNING *`,
    [status, req.params.id, ids]
  );
  if (!row) { res.status(404).json({ error: 'Registro SLA não encontrado' }); return; }
  res.json(row);
  } catch (err: any) { console.error('PATCH /geolocalizacao/sla/:id erro:', err.message); res.status(500).json({ error: 'Erro interno' }); }
});

export default router;
