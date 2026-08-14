import { Router, Response } from 'express';
import { query, queryOne, execute } from '../db/database.js';
import { AuthRequest } from '../middleware/auth.js';
import { dataUrlToAttachment, isMailerConfigured, sendMail } from '../services/mailer.js';
import { escapeHtml, sanitizeEmailHtml } from '../utils/html.js';

const router = Router();

const MAX_DESTINATARIOS = 500;
const CONCORRENCIA_ENVIO = 5;

function buildFallbackHtml(titulo: string, mensagem: string) {
  return `
    <div style="font-family:Arial,sans-serif;background:#f5f7fa;padding:24px;color:#1f2937;">
      <div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:16px;padding:32px;border:1px solid #e5e7eb;">
        <h1 style="margin:0 0 16px;font-size:24px;color:#111827;">${escapeHtml(titulo)}</h1>
        <div style="line-height:1.7;white-space:pre-wrap;">${escapeHtml(mensagem || '')}</div>
      </div>
    </div>
  `;
}

// GET /api/comunicados
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const ids: string[] = (req as any).condominioIds;
    if (ids.length === 0) { res.json([]); return; }
    const rows = await query(
      `SELECT cm.*, c.nome as condominio_nome FROM comunicados cm
       LEFT JOIN condominios c ON c.id = cm.condominio_id
       WHERE cm.condominio_id = ANY($1) ORDER BY cm.criado_em DESC`,
      [ids]
    );
    res.json(rows);
  } catch (err: any) {
    console.error('GET /comunicados erro:', err.message);
    res.status(500).json({ error: 'Erro interno no servidor' });
  }
});

// POST /api/comunicados
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const ids: string[] = (req as any).condominioIds;
    const { tipo, titulo, mensagem, destinatarioTipo, condominioId, emailsEnviados, tracking, emailHtml, assunto, pdfAnexo, pdfNome } = req.body;
    if (!condominioId || !ids.includes(condominioId)) {
      res.status(403).json({ error: 'Sem acesso' });
      return;
    }

    if (!titulo?.trim()) {
      res.status(400).json({ error: 'Título é obrigatório' });
      return;
    }

    if (!isMailerConfigured()) {
      res.status(503).json({ error: 'Google SMTP não configurado no backend.' });
      return;
    }

    let destinatarios;
    if (Array.isArray(tracking) && tracking.length > 0) {
      destinatarios = tracking.map((item: any) => ({ email: item.email, nome: item.nome || item.email }));
    } else {
      const emails = Array.isArray(emailsEnviados) ? emailsEnviados : [];
      destinatarios = emails.map((email: string) => ({ email, nome: email }));
    }

    destinatarios = destinatarios.filter((d: any) => /^[^@\s]+@[^@\s.]+\.[^@\s]+$/.test(String(d.email || '').trim()));

    if (destinatarios.length === 0) {
      res.status(400).json({ error: 'Nenhum destinatário com e-mail informado.' });
      return;
    }
    if (destinatarios.length > MAX_DESTINATARIOS) {
      res.status(400).json({ error: `Máximo de ${MAX_DESTINATARIOS} destinatários por envio.` });
      return;
    }

    const attachments = pdfAnexo && pdfNome ? [dataUrlToAttachment(pdfAnexo, pdfNome)] : [];
    const trackingFinal: any[] = [];
    const htmlBase = emailHtml ? sanitizeEmailHtml(emailHtml) : buildFallbackHtml(titulo, mensagem);
    const subject = assunto || titulo;

    const fila = [...destinatarios];
    const worker = async () => {
      for (let destinatario = fila.shift(); destinatario; destinatario = fila.shift()) {
        const atualizadoEm = new Date().toISOString();
        try {
          await sendMail({ to: destinatario.email, subject, html: htmlBase, attachments });
          trackingFinal.push({ ...destinatario, status: 'enviado', atualizadoEm });
        } catch {
          trackingFinal.push({ ...destinatario, status: 'erro', atualizadoEm });
        }
      }
    };
    await Promise.all(Array.from({ length: Math.min(CONCORRENCIA_ENVIO, fila.length) }, worker));

    const emailsComSucesso = trackingFinal.filter((item) => item.status === 'enviado').map((item) => item.email);
    if (emailsComSucesso.length === 0) {
      res.status(502).json({ error: 'Falha ao enviar e-mails para todos os destinatários.' });
      return;
    }

    const row = await queryOne(
      `INSERT INTO comunicados (tipo, titulo, mensagem, destinatario_tipo, condominio_id, emails_enviados, tracking, enviado_por, enviado_por_nome)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [tipo || 'comunicado', titulo, mensagem, destinatarioTipo, condominioId, emailsComSucesso, JSON.stringify(trackingFinal), req.user!.id, req.user!.nome]
    );
    res.status(201).json({ ...row, assunto: subject, emailHtml: htmlBase, pdfNome: pdfNome || null });
  } catch (err: any) {
    console.error('POST /comunicados erro:', err.message);
    res.status(500).json({ error: 'Erro interno no servidor' });
  }
});

// DELETE /api/comunicados/:id
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const ids: string[] = (req as any).condominioIds;
    const count = await execute('DELETE FROM comunicados WHERE id = $1 AND condominio_id = ANY($2)', [req.params.id, ids]);
    if (count === 0) { res.status(404).json({ error: 'Comunicado não encontrado' }); return; }
    res.json({ ok: true });
  } catch (err: any) {
    console.error('DELETE /comunicados erro:', err.message);
    res.status(500).json({ error: 'Erro interno no servidor' });
  }
});

export default router;
