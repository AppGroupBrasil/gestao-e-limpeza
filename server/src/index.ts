// server restart trigger
import 'dotenv/config';
import 'express-async-errors';
import express from 'express';
import cors from 'cors';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import pool from './db/database.js';
import { runPendingMigrations } from './db/runMigrations.js';
import { authMiddleware } from './middleware/auth.js';
import { scopeMiddleware } from './middleware/rbac.js';
import { trackMetric } from './middleware/helpers.js';
import authRoutes from './routes/auth.js';
import condominiosRoutes from './routes/condominios.js';
import ordensServicoRoutes from './routes/ordensServico.js';
import checklistsRoutes from './routes/checklists.js';
import escalasRoutes from './routes/escalas.js';
import materiaisRoutes from './routes/materiais.js';
import inspecoesRoutes from './routes/inspecoes.js';
import vistoriasRoutes from './routes/vistorias.js';
import reportesRoutes from './routes/reportes.js';
import tarefasRoutes from './routes/tarefas.js';
import roteirosRoutes from './routes/roteiros.js';
import qrcodesRoutes from './routes/qrcodes.js';
import geoRoutes from './routes/geolocalizacao.js';
import comunicadosRoutes from './routes/comunicados.js';
import moradoresRoutes from './routes/moradores.js';
import vencimentosRoutes from './routes/vencimentos.js';
import quadroRoutes from './routes/quadroAtividades.js';
import usuariosRoutes from './routes/usuarios.js';
import configRoutes from './routes/configuracoes.js';
import permissoesRoutes from './routes/permissoes.js';
import uploadRoutes from './routes/upload.js';
import dashboardRoutes from './routes/dashboard.js';
import relatoriosRoutes from './routes/relatorios.js';
import notificacoesRoutes from './routes/notificacoes.js';
import perfilRoutes from './routes/perfil.js';
import auditRoutes from './routes/audit.js';
import docPublicosRoutes from './routes/documentosPublicos.js';
import rondasRoutes from './routes/rondas.js';
import antesDepoisRoutes from './routes/antesDepois.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
const PORT = Number.parseInt(process.env.PORT || '3001');

// ── Middlewares globais ──
const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:3000')
  .split(',')
  .map(o => o.trim());

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, server-to-server)
    if (!origin) return callback(null, true);
    if (allowedOrigins.some(allowed => origin === allowed || origin === allowed.replace(/\/$/, ''))) {
      return callback(null, true);
    }
    // Also allow capacitor:// and localhost variants
    if (origin.startsWith('capacitor://') || /^http:\/\/localhost(:\d+)?$/.test(origin)) {
      return callback(null, true);
    }
    callback(null, false);
  },
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

// ── Rotas públicas ──
app.use('/api/auth', authRoutes);

// ── QR Code público (sem auth) ──
app.get('/api/public/qrcodes/:id', async (req, res) => {
  try {
    const { queryOne: qo } = await import('./db/database.js');
    const row = await qo('SELECT id, nome, descricao, logo, blocos, dispensar_identificacao, blocos_cadastrados, ativo FROM qrcodes WHERE id = $1', [req.params.id]);
    if (!row) { res.status(404).json({ error: 'QR Code não encontrado' }); return; }
    if (!row.ativo) { res.status(410).json({ error: 'Este QR Code está desativado' }); return; }
    res.json(row);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

app.post('/api/public/qrcodes/:id/resposta', async (req, res) => {
  try {
    const { queryOne: qo, execute: ex } = await import('./db/database.js');
    const qrRow = await qo(
      `SELECT q.id, q.nome, q.ativo, q.blocos, q.email_notificacao, u.email AS criador_email, u.nome AS criador_nome
       FROM qrcodes q
       INNER JOIN usuarios u ON u.id = q.criado_por
       WHERE q.id = $1`,
      [req.params.id]
    );
    if (!qrRow) { res.status(404).json({ error: 'QR Code não encontrado' }); return; }
    if (!qrRow.ativo) { res.status(410).json({ error: 'Este QR Code está desativado' }); return; }

    const { identificacao, respostas } = req.body;
    await qo(
      `INSERT INTO leituras_qrcode (qr_conteudo, funcionario_nome, funcionario_email, funcionario_cargo, identificacao, respostas_formulario)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [req.params.id, identificacao?.nome || 'Anônimo', identificacao?.email || null, identificacao?.tipo || 'publico', JSON.stringify(identificacao || {}), JSON.stringify(respostas || {})]
    );
    await ex('UPDATE qrcodes SET respostas = respostas + 1 WHERE id = $1', [req.params.id]);

    // ── Notificação por e-mail ──
    const destinatario: string | null = qrRow.email_notificacao || qrRow.criador_email || null;
    if (destinatario) {
      try {
        const { sendMail, isMailerConfigured, buildRespostaPdf } = await import('./services/mailer.js');
        if (isMailerConfigured()) {
          const dataHora = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
          const nomeRespondente = identificacao?.nome || 'Anônimo';
          const tipoRespondente = identificacao?.tipo || 'público';
          const blocoUnidade = identificacao?.bloco && identificacao?.unidade
            ? ` — Bloco ${identificacao.bloco}, Unidade ${identificacao.unidade}`
            : '';

          let blocosDef: any[] = [];
          try {
            blocosDef = typeof qrRow.blocos === 'string' ? JSON.parse(qrRow.blocos) : (qrRow.blocos || []);
          } catch { blocosDef = []; }

          const pdfBuffer = await buildRespostaPdf({
            qrNome: qrRow.nome,
            dataHora,
            respondente: nomeRespondente,
            perfil: tipoRespondente,
            bloco: identificacao?.bloco,
            unidade: identificacao?.unidade,
            email: identificacao?.email,
            blocos: blocosDef,
            respostas: respostas || {},
          });

          const safeNome = String(qrRow.nome || 'qrcode').replace(/[^a-z0-9-_]+/gi, '_').slice(0, 40);
          const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);

          await sendMail({
            to: destinatario,
            subject: `Nova resposta no QR Code: ${qrRow.nome}`,
            html: `
              <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;background:#fff;border:1px solid #e0e0e0;border-radius:8px">
                <div style="background:#1565c0;color:#fff;padding:16px 24px;border-radius:6px 6px 0 0;margin:-24px -24px 24px">
                  <h1 style="margin:0;font-size:20px">Nova resposta recebida</h1>
                  <p style="margin:4px 0 0;opacity:.85;font-size:13px">QR Code: <strong>${qrRow.nome}</strong></p>
                </div>
                <p style="color:#333;margin:0 0 12px"><strong>${nomeRespondente}</strong>${blocoUnidade} respondeu o formulário em <strong>${dataHora}</strong>.</p>
                <p style="color:#555;margin:0 0 8px">Perfil: ${tipoRespondente}${identificacao?.email ? ` &middot; ${identificacao.email}` : ''}</p>
                <p style="color:#1565c0;margin:18px 0 0;font-size:14px"><strong>📎 Formulário completo em anexo (PDF)</strong> — pronto para imprimir ou compartilhar.</p>
                <p style="margin:24px 0 0;font-size:12px;color:#aaa">Enviado automaticamente pelo sistema Gestão e Limpeza.</p>
              </div>`,
            attachments: [{
              filename: `formulario-${safeNome}-${stamp}.pdf`,
              content: pdfBuffer,
              contentType: 'application/pdf',
            }],
          });
        }
      } catch (mailErr: any) {
        // Falha no e-mail não deve bloquear a resposta do morador
        console.error('[QRCode] Erro ao enviar e-mail de notificação:', mailErr.message);
      }
    }

    res.status(201).json({ ok: true });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// ── Documento público por slug (sem auth) ──
app.get('/api/public/doc/:slug', async (req, res) => {
  try {
    const { queryOne: qo, execute: ex } = await import('./db/database.js');
    const row = await qo(
      `SELECT id, slug, titulo, tipo, conteudo, arquivo_url, arquivo_nome, ativo, criado_em, atualizado_em
       FROM documentos_publicos WHERE slug = $1`,
      [req.params.slug]
    );
    if (!row) { res.status(404).json({ error: 'Documento não encontrado' }); return; }
    if (!row.ativo) { res.status(410).json({ error: 'Este documento está desativado' }); return; }
    // Incrementar visualizações (não bloqueia resposta)
    ex('UPDATE documentos_publicos SET visualizacoes = visualizacoes + 1 WHERE slug = $1', [req.params.slug]).catch(() => {});
    res.json(row);
  } catch { res.status(500).json({ error: 'Erro interno' }); }
});

// ── Registro de ronda público (funcionário escaneia QR sem login) ──
app.get('/api/public/ronda/:id', async (req, res) => {
  try {
    const { queryOne: qo } = await import('./db/database.js');
    const row = await qo(
      `SELECT p.id, p.titulo, p.descricao, p.imagem, p.ativo, p.condominio_id,
              c.nome AS condominio_nome
       FROM pontos_ronda p
       INNER JOIN condominios c ON c.id = p.condominio_id
       WHERE p.id = $1`,
      [req.params.id]
    );
    if (!row) { res.status(404).json({ error: 'Ponto de ronda não encontrado' }); return; }
    if (!row.ativo) { res.status(410).json({ error: 'Este ponto de ronda está desativado' }); return; }
    res.json(row);
  } catch { res.status(500).json({ error: 'Erro interno' }); }
});

// ── Funcionários do condomínio do ponto (para dropdown público) ──
app.get('/api/public/ronda/:id/funcionarios', async (req, res) => {
  try {
    const { queryOne: qo, query: q } = await import('./db/database.js');
    const ponto = await qo(
      `SELECT p.condominio_id, c.criado_por
       FROM pontos_ronda p
       INNER JOIN condominios c ON c.id = p.condominio_id
       WHERE p.id = $1 AND p.ativo = true`,
      [req.params.id]
    );
    if (!ponto) { res.status(404).json({ error: 'Ponto não encontrado' }); return; }

    // Buscar funcionários:
    // 1. Pelo condominio_id direto OU
    // 2. Pelo administrador que criou o condominio (hierarquia)
    const rows = await q(
      `SELECT id, nome FROM usuarios
       WHERE ativo = true AND bloqueado = false
         AND role IN ('funcionario', 'supervisor')
         AND (
           condominio_id = $1
           OR administrador_id = $2
           OR supervisor_id = $2
           OR id = $2
         )
       ORDER BY nome`,
      [ponto.condominio_id, ponto.criado_por]
    );
    res.json(rows);
  } catch { res.status(500).json({ error: 'Erro interno' }); }
});

app.post('/api/public/ronda/:id/registrar', async (req, res) => {
  try {
    const { queryOne: qo } = await import('./db/database.js');
    const ponto = await qo('SELECT id, ativo FROM pontos_ronda WHERE id = $1', [req.params.id]);
    if (!ponto) { res.status(404).json({ error: 'Ponto não encontrado' }); return; }
    if (!ponto.ativo) { res.status(410).json({ error: 'Ponto desativado' }); return; }

    const { funcionarioId, funcionarioNome, latitude, longitude, endereco, observacao, fotoSelfie } = req.body;
    if (!funcionarioId && !funcionarioNome?.trim()) {
      res.status(400).json({ error: 'Selecione o funcionário' }); return;
    }

    // Salvar selfie se enviada (base64 → webp)
    let selfieUrl: string | null = null;
    if (fotoSelfie && typeof fotoSelfie === 'string') {
      const base64Data = fotoSelfie.replace(/^data:image\/\w+;base64,/, '');
      const buffer = Buffer.from(base64Data, 'base64');
      const filename = `ronda-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.webp`;
      const dir = path.join(__dirname, '..', 'uploads', 'rondas');
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      await sharp(buffer)
        .resize(800, 800, { fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 75 })
        .toFile(path.join(dir, filename));
      selfieUrl = `/uploads/rondas/${filename}`;
    }

    // Resolver nome do funcionário pelo ID se necessário
    let nome = funcionarioNome?.trim() || '';
    if (funcionarioId) {
      const func = await qo('SELECT nome FROM usuarios WHERE id = $1', [funcionarioId]);
      if (func) nome = func.nome;
    }

    const row = await qo(
      `INSERT INTO registros_ronda (ponto_id, funcionario_id, funcionario_nome, latitude, longitude, endereco, observacao, foto_selfie)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [req.params.id, funcionarioId || null, nome, latitude || null, longitude || null, endereco || null, observacao || null, selfieUrl]
    );
    res.status(201).json(row);
  } catch (err: any) {
    console.error('[RONDA REGISTRAR]', err.message);
    res.status(500).json({ error: 'Erro interno' });
  }
});

// ── Checklist público por link/QR ──
app.get('/api/public/checklists/:id', async (req, res) => {
  try {
    const { queryOne: qo } = await import('./db/database.js');
    const row = await qo(
      `SELECT ch.*, c.nome AS condominio_nome, u.nome AS responsavel_nome
       FROM checklists ch
       LEFT JOIN condominios c ON c.id = ch.condominio_id
       LEFT JOIN usuarios u ON u.id = ch.responsavel_id
       WHERE ch.id = $1`,
      [req.params.id]
    );
    if (!row) { res.status(404).json({ error: 'Checklist não encontrado' }); return; }
    res.json(row);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Erro interno' });
  }
});

app.patch('/api/public/checklists/:id/itens', async (req, res) => {
  try {
    const { queryOne: qo } = await import('./db/database.js');
    const { itens, status, horaFim, assinatura } = req.body;
    const fields: string[] = ['itens = $1'];
    const params: any[] = [JSON.stringify(itens || [])];
    let idx = 2;
    if (status) { fields.push(`status = $${idx++}`); params.push(status); }
    if (horaFim) { fields.push(`hora_fim = $${idx++}`); params.push(horaFim); }
    if (assinatura) { fields.push(`assinatura = $${idx++}`); params.push(assinatura); }
    params.push(req.params.id);

    const row = await qo(
      `UPDATE checklists SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
      params
    );
    if (!row) { res.status(404).json({ error: 'Checklist não encontrado' }); return; }
    res.json(row);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Erro interno' });
  }
});

// ── Vistoria pública por link/QR ──
app.get('/api/public/vistorias/:id', async (req, res) => {
  try {
    const { queryOne: qo } = await import('./db/database.js');
    const row = await qo(
      `SELECT v.*, c.nome AS condominio_nome
       FROM vistorias v
       LEFT JOIN condominios c ON c.id = v.condominio_id
       WHERE v.id = $1`,
      [req.params.id]
    );
    if (!row) { res.status(404).json({ error: 'Vistoria não encontrada' }); return; }
    res.json(row);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Erro interno' });
  }
});

app.put('/api/public/vistorias/:id', async (req, res) => {
  try {
    const { queryOne: qo } = await import('./db/database.js');
    const atual = await qo('SELECT * FROM vistorias WHERE id = $1', [req.params.id]);
    if (!atual) { res.status(404).json({ error: 'Vistoria não encontrada' }); return; }

    const row = await qo(
      `UPDATE vistorias
       SET titulo = $1,
           tipo = $2,
           data = $3,
           itens = $4,
           status = $5,
           responsavel_id = $6,
           responsavel_nome = $7
       WHERE id = $8
       RETURNING *`,
      [
        req.body.titulo || atual.titulo,
        req.body.tipo || atual.tipo,
        req.body.data || atual.data,
        JSON.stringify(req.body.itens || atual.itens || []),
        req.body.status || atual.status,
        req.body.responsavelId || atual.responsavel_id,
        req.body.responsavelNome || atual.responsavel_nome,
        req.params.id,
      ]
    );
    res.json(row);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Erro interno' });
  }
});

// ── Tarefa pública por link/QR ──
app.get('/api/public/tarefas/:id', async (req, res) => {
  try {
    const { queryOne: qo } = await import('./db/database.js');
    const row = await qo(
      `SELECT t.*, c.nome AS condominio_nome
       FROM tarefas_agendadas t
       LEFT JOIN condominios c ON c.id = t.condominio_id
       WHERE t.id = $1`,
      [req.params.id]
    );
    if (!row) { res.status(404).json({ error: 'Tarefa não encontrada' }); return; }
    res.json(row);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Erro interno' });
  }
});

app.post('/api/public/tarefas/:id/execucao', async (req, res) => {
  try {
    const { queryOne: qo } = await import('./db/database.js');
    const tarefa = await qo('SELECT id, funcionario_id, funcionario_nome FROM tarefas_agendadas WHERE id = $1', [req.params.id]);
    if (!tarefa) { res.status(404).json({ error: 'Tarefa não encontrada' }); return; }

    const { status, observacao, fotos, latitude, longitude, audioUrl, endereco, reporteProblema } = req.body;
    const row = await qo(
      `INSERT INTO tarefas_execucoes (
        tarefa_id, funcionario_id, funcionario_nome, status, fotos, observacao, latitude, longitude, audio_url, endereco, reporte_problema
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [
        req.params.id,
        tarefa.funcionario_id || null,
        tarefa.funcionario_nome || 'Acesso público',
        status || 'realizada',
        fotos || [],
        observacao || null,
        latitude || null,
        longitude || null,
        audioUrl || null,
        endereco || null,
        reporteProblema || null,
      ]
    );
    res.status(201).json(row);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Erro interno' });
  }
});

// ── Rotas protegidas ──
const protectedRouter = express.Router();
protectedRouter.use(authMiddleware);
protectedRouter.use(scopeMiddleware);

// Metrics tracking (non-blocking, POST/PUT/PATCH/DELETE only)
protectedRouter.use((req: any, _res, next) => {
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method) && req.user) {
    const condId = req.condominioIds?.[0] || null;
    const acao = `${req.method} ${req.baseUrl}${req.path}`.slice(0, 100);
    trackMetric(condId, req.user.id, acao);
  }
  next();
});

protectedRouter.use('/condominios', condominiosRoutes);
protectedRouter.use('/ordens-servico', ordensServicoRoutes);
protectedRouter.use('/checklists', checklistsRoutes);
protectedRouter.use('/escalas', escalasRoutes);
protectedRouter.use('/materiais', materiaisRoutes);
protectedRouter.use('/inspecoes', inspecoesRoutes);
protectedRouter.use('/vistorias', vistoriasRoutes);
protectedRouter.use('/reportes', reportesRoutes);
protectedRouter.use('/tarefas', tarefasRoutes);
protectedRouter.use('/roteiros', roteirosRoutes);
protectedRouter.use('/qrcodes', qrcodesRoutes);
protectedRouter.use('/geolocalizacao', geoRoutes);
protectedRouter.use('/comunicados', comunicadosRoutes);
protectedRouter.use('/moradores', moradoresRoutes);
protectedRouter.use('/vencimentos', vencimentosRoutes);
protectedRouter.use('/quadro-atividades', quadroRoutes);
protectedRouter.use('/usuarios', usuariosRoutes);
protectedRouter.use('/configuracoes', configRoutes);
protectedRouter.use('/permissoes', permissoesRoutes);
protectedRouter.use('/upload', uploadRoutes);
protectedRouter.use('/dashboard', dashboardRoutes);
protectedRouter.use('/relatorios', relatoriosRoutes);
protectedRouter.use('/notificacoes', notificacoesRoutes);
protectedRouter.use('/perfil', perfilRoutes);
protectedRouter.use('/audit', auditRoutes);
protectedRouter.use('/documentos-publicos', docPublicosRoutes);
protectedRouter.use('/rondas', rondasRoutes);
protectedRouter.use('/antes-depois', antesDepoisRoutes);

// ── Health check (before auth middleware) ──
app.get('/api/health', async (_req, res) => {
  const start = Date.now();
  try {
    await pool.query('SELECT 1');
    res.json({
      status: 'ok',
      db: 'connected',
      uptime: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
      responseTime: Date.now() - start,
    });
  } catch {
    res.status(503)
      .set('Retry-After', '10')
      .json({ status: 'error', db: 'disconnected' });
  }
});

app.use('/api', protectedRouter);

// ── Global error handler (captura erros não tratados em qualquer rota) ──
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[SERVER ERROR]', err?.message || err);
  if (err.status && err.status < 500) {
    res.status(err.status).json({ error: err.message });
    return;
  }
  res.status(500).json({ error: 'Erro interno no servidor' });
});

// ── Start ──
try {
  await runPendingMigrations();
  app.listen(PORT, () => {
    console.log(`API rodando em http://localhost:${PORT}`);
  });
} catch (err: any) {
  console.error('[BOOT ERROR]', err?.message || err);
  process.exit(1);
}

export default app;
