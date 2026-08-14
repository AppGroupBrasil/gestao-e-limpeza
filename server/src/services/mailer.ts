import nodemailer from 'nodemailer';
import PDFDocument from 'pdfkit';

const DATA_URL_PATTERN = /data:(.*?);base64,(.*)$/;

type MailAttachment = {
  filename: string;
  content: Buffer;
  contentType?: string;
};

type SendMailParams = {
  to: string;
  subject: string;
  html: string;
  attachments?: MailAttachment[];
};

let transporter: nodemailer.Transporter | null = null;

function getSmtpConfig() {
  const host = process.env.SMTP_HOST || 'smtp.gmail.com';
  const port = Number.parseInt(process.env.SMTP_PORT || '465', 10);
  const secure = process.env.SMTP_SECURE ? process.env.SMTP_SECURE === 'true' : port === 465;
  const user = process.env.SMTP_USER || '';
  const pass = process.env.SMTP_PASS || '';
  const fromEmail = process.env.SMTP_FROM_EMAIL || user;
  const fromName = process.env.SMTP_FROM_NAME || 'Gestão e Limpeza';

  return { host, port, secure, user, pass, fromEmail, fromName };
}

export function isMailerConfigured(): boolean {
  const { user, pass, fromEmail } = getSmtpConfig();
  return Boolean(user && pass && fromEmail);
}

function getTransporter(): nodemailer.Transporter {
  if (transporter) return transporter;

  const { host, port, secure, user, pass } = getSmtpConfig();
  transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: {
      user,
      pass,
    },
    pool: true,
    maxConnections: 5,
    maxMessages: 100,
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 20000,
  });

  return transporter;
}

export async function sendMail(params: SendMailParams): Promise<void> {
  if (!isMailerConfigured()) {
    throw new Error('Google SMTP não configurado no backend.');
  }

  const { fromEmail, fromName } = getSmtpConfig();
  await getTransporter().sendMail({
    from: `${fromName} <${fromEmail}>`,
    to: params.to,
    subject: params.subject,
    html: params.html,
    attachments: params.attachments,
  });
}

type BlocoConfig = { id: string; tipo: string; label: string; opcoes?: string[]; maxEstrelas?: number };

type RespostaPdfOpts = {
  qrNome: string;
  dataHora: string;
  respondente: string;
  perfil: string;
  bloco?: string;
  unidade?: string;
  email?: string;
  blocos: BlocoConfig[];
  respostas: any;
};

function dataUrlToBuffer(dataUrl: string): Buffer | null {
  const m = DATA_URL_PATTERN.exec(dataUrl);
  if (!m) return null;
  try { return Buffer.from(m[2], 'base64'); } catch { return null; }
}

const COLORS = {
  primary: '#1565c0',
  primaryDark: '#0d47a1',
  accent: '#f57c00',
  text: '#1a1a2e',
  muted: '#6b7280',
  soft: '#9ca3af',
  border: '#e5e7eb',
  cardBg: '#f8fafc',
  cardBorder: '#e2e8f0',
  success: '#2e7d32',
  warn: '#d97706',
  star: '#f59e0b',
  white: '#ffffff',
};

const PAGE = { width: 595.28, height: 841.89 };
const MARGIN = { top: 110, bottom: 80, left: 50, right: 50 };
const CONTENT_W = PAGE.width - MARGIN.left - MARGIN.right;

function paintHeader(doc: any, qrNome: string) {
  doc.save();
  doc.rect(0, 0, PAGE.width, 80).fill(COLORS.primary);
  doc.rect(0, 80, PAGE.width, 4).fill(COLORS.accent);
  doc.fillColor(COLORS.white).font('Helvetica-Bold').fontSize(20)
    .text('Resposta de QR Code', MARGIN.left, 28, { width: CONTENT_W });
  doc.font('Helvetica').fontSize(11).fillColor('#dbeafe')
    .text(qrNome, MARGIN.left, 54, { width: CONTENT_W, ellipsis: true });
  doc.restore();
}

function paintFooter(doc: any, pageNum: number, totalPages: number) {
  doc.save();
  const origBottom = doc.page.margins.bottom;
  doc.page.margins.bottom = 0;
  const y = PAGE.height - 50;
  doc.strokeColor(COLORS.border).lineWidth(0.5)
    .moveTo(MARGIN.left, y).lineTo(PAGE.width - MARGIN.right, y).stroke();
  doc.font('Helvetica').fontSize(8).fillColor(COLORS.soft);
  doc.text('Gestão e Limpeza · Documento gerado automaticamente', MARGIN.left, y + 8,
    { width: CONTENT_W / 2, align: 'left', lineBreak: false });
  doc.text(`Página ${pageNum} de ${totalPages}`, MARGIN.left + CONTENT_W / 2, y + 8,
    { width: CONTENT_W / 2, align: 'right', lineBreak: false });
  doc.page.margins.bottom = origBottom;
  doc.restore();
}

function sectionTitle(doc: any, label: string) {
  if (doc.y + 40 > PAGE.height - MARGIN.bottom) doc.addPage();
  doc.moveDown(0.6);
  doc.save();
  doc.rect(MARGIN.left, doc.y - 2, 4, 16).fill(COLORS.accent);
  doc.fillColor(COLORS.primaryDark).font('Helvetica-Bold').fontSize(12)
    .text(label.toUpperCase(), MARGIN.left + 12, doc.y, { width: CONTENT_W - 12, characterSpacing: 0.6 });
  doc.restore();
  doc.moveDown(0.3);
  doc.strokeColor(COLORS.border).lineWidth(0.5)
    .moveTo(MARGIN.left, doc.y).lineTo(PAGE.width - MARGIN.right, doc.y).stroke();
  doc.moveDown(0.4);
}

function ensureSpace(doc: any, needed: number) {
  if (doc.y + needed > PAGE.height - MARGIN.bottom) doc.addPage();
}

function infoCard(doc: any, rows: Array<[string, string]>) {
  const padding = 14;
  const rowH = 20;
  const cardH = padding * 2 + rows.length * rowH;
  ensureSpace(doc, cardH + 10);
  const startY = doc.y;
  doc.save();
  doc.roundedRect(MARGIN.left, startY, CONTENT_W, cardH, 8)
    .fillAndStroke(COLORS.cardBg, COLORS.cardBorder);
  doc.restore();
  let y = startY + padding;
  for (const [label, valor] of rows) {
    doc.font('Helvetica').fontSize(9).fillColor(COLORS.muted)
      .text(label.toUpperCase(), MARGIN.left + padding, y + 2, { width: 110, characterSpacing: 0.4 });
    doc.font('Helvetica-Bold').fontSize(10).fillColor(COLORS.text)
      .text(valor || '—', MARGIN.left + padding + 110, y, { width: CONTENT_W - padding * 2 - 110 });
    y += rowH;
  }
  doc.y = startY + cardH + 14;
}

function blocoCard(doc: any, label: string, draw: () => void) {
  ensureSpace(doc, 50);
  const titleY = doc.y;
  doc.save();
  doc.rect(MARGIN.left, titleY + 2, 3, 12).fill(COLORS.primary);
  doc.font('Helvetica-Bold').fontSize(11).fillColor(COLORS.primaryDark)
    .text(label, MARGIN.left + 10, titleY, { width: CONTENT_W - 10 });
  doc.restore();
  doc.moveDown(0.4);
  doc.x = MARGIN.left + 10;
  doc.font('Helvetica').fontSize(10).fillColor(COLORS.text);

  draw();

  doc.moveDown(0.6);
  doc.x = MARGIN.left;
  doc.save().strokeColor(COLORS.border).lineWidth(0.5)
    .moveTo(MARGIN.left + 20, doc.y).lineTo(PAGE.width - MARGIN.right - 20, doc.y).stroke().restore();
  doc.moveDown(0.5);
}

function drawPhotoRow(doc: any, buffers: Buffer[]) {
  const padding = 14;
  const gap = 8;
  const cols = Math.min(2, buffers.length);
  const imgW = (CONTENT_W - padding * 2 - gap * (cols - 1)) / cols;
  const imgH = imgW * 0.66;
  let i = 0;
  while (i < buffers.length) {
    ensureSpace(doc, imgH + 10);
    const rowY = doc.y;
    for (let c = 0; c < cols && i < buffers.length; c++, i++) {
      const x = MARGIN.left + padding + c * (imgW + gap);
      try {
        doc.image(buffers[i], x, rowY, { fit: [imgW, imgH], align: 'center', valign: 'center' });
        doc.save().roundedRect(x, rowY, imgW, imgH, 4).lineWidth(0.5).stroke(COLORS.cardBorder).restore();
      } catch {
        doc.fontSize(9).fillColor('#c00').text('[imagem inválida]', x, rowY);
      }
    }
    doc.y = rowY + imgH + gap;
  }
}

export async function buildRespostaPdf(opts: RespostaPdfOpts): Promise<Buffer> {
  return await new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margins: MARGIN,
      bufferPages: true,
      info: { Title: `Resposta - ${opts.qrNome}`, Author: 'Gestão e Limpeza' },
    });
    const chunks: Buffer[] = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.on('pageAdded', () => {
      paintHeader(doc, opts.qrNome);
      doc.x = MARGIN.left;
      doc.y = MARGIN.top;
    });
    paintHeader(doc, opts.qrNome);
    doc.x = MARGIN.left;
    doc.y = MARGIN.top;

    sectionTitle(doc, 'Identificação');
    infoCard(doc, [
      ['Data / Hora', opts.dataHora],
      ['Respondente', opts.respondente],
      ['Perfil', opts.perfil],
      ...(opts.bloco ? [['Bloco', opts.bloco] as [string, string]] : []),
      ...(opts.unidade ? [['Unidade', opts.unidade] as [string, string]] : []),
      ...(opts.email ? [['E-mail', opts.email] as [string, string]] : []),
    ]);

    sectionTitle(doc, 'Formulário preenchido');

    for (const bloco of opts.blocos || []) {
      const valor = opts.respostas?.[bloco.id];
      blocoCard(doc, bloco.label || bloco.tipo, () => {
        if (valor === undefined || valor === null || valor === '') {
          doc.fillColor(COLORS.soft).font('Helvetica-Oblique').text('— sem resposta —');
          return;
        }
        switch (bloco.tipo) {
          case 'galeria': {
            const bufs = (Array.isArray(valor) ? valor : [])
              .map((f: any) => dataUrlToBuffer(f?.dataUrl || ''))
              .filter((b): b is Buffer => !!b);
            if (bufs.length) drawPhotoRow(doc, bufs);
            else doc.fillColor(COLORS.soft).text('— sem fotos —');
            break;
          }
          case 'checklist':
            if (Array.isArray(valor)) {
              for (let i = 0; i < (bloco.opcoes || []).length; i++) {
                const op = bloco.opcoes![i];
                const ok = !!valor[i];
                doc.fillColor(ok ? COLORS.success : COLORS.soft)
                  .text(`${ok ? '☑' : '☐'}  ${op}`, { indent: 0 });
              }
            }
            break;
          case 'avaliacao_estrela': {
            const n = Number(valor) || 0;
            doc.fillColor(COLORS.star).font('Helvetica-Bold').fontSize(14)
              .text(`${'★'.repeat(n)}${'☆'.repeat(5 - n)}`, { continued: true });
            doc.fillColor(COLORS.muted).font('Helvetica').fontSize(10).text(`   ${n} de 5`);
            break;
          }
          case 'avaliacao_escala':
            doc.fillColor(COLORS.primary).font('Helvetica-Bold').fontSize(16)
              .text(`${valor}`, { continued: true });
            doc.fillColor(COLORS.muted).font('Helvetica').fontSize(10).text(' / 10');
            break;
          case 'pergunta':
            if (Array.isArray(valor)) {
              for (let i = 0; i < (bloco.opcoes || []).length; i++) {
                doc.font('Helvetica-Bold').fontSize(9).fillColor(COLORS.muted)
                  .text(bloco.opcoes![i] || `Pergunta ${i + 1}`);
                doc.font('Helvetica').fontSize(10).fillColor(COLORS.text)
                  .text(String(valor[i] || '—'));
                doc.moveDown(0.3);
              }
            }
            break;
          case 'pesquisa_satisfacao': {
            const notas = Array.isArray(valor) ? valor : valor?.notas || [];
            for (let i = 0; i < (bloco.opcoes || []).length; i++) {
              const n = Number(notas[i]) || 0;
              doc.font('Helvetica').fontSize(10).fillColor(COLORS.text)
                .text(bloco.opcoes![i], { continued: true });
              doc.fillColor(COLORS.star)
                .text(`   ${'★'.repeat(n)}${'☆'.repeat(5 - n)}`, { continued: true });
              doc.fillColor(COLORS.muted).text(`  ${n}/5`);
            }
            if (valor?.comentario) {
              doc.moveDown(0.4).fillColor(COLORS.muted).font('Helvetica-Oblique').fontSize(10)
                .text(`"${valor.comentario}"`);
            }
            break;
          }
          case 'urgencia':
          case 'agendar_servico':
          case 'ocorrencia':
          case 'manutencao':
            if (typeof valor === 'object') {
              for (const [k, v] of Object.entries(valor)) {
                if (v === null || v === undefined || v === '') continue;
                if (k === 'fotos' && Array.isArray(v)) {
                  doc.moveDown(0.3).font('Helvetica-Bold').fontSize(9)
                    .fillColor(COLORS.muted).text('FOTOS', { characterSpacing: 0.4 });
                  doc.moveDown(0.2);
                  const bufs = v.map((d) => dataUrlToBuffer(String(d))).filter((b): b is Buffer => !!b);
                  if (bufs.length) drawPhotoRow(doc, bufs);
                } else {
                  doc.font('Helvetica-Bold').fontSize(9).fillColor(COLORS.muted)
                    .text(String(k).toUpperCase(), { characterSpacing: 0.4 });
                  doc.font('Helvetica').fontSize(10).fillColor(COLORS.text).text(String(v));
                  doc.moveDown(0.3);
                }
              }
            } else doc.text(String(valor));
            break;
          case 'feedback':
            if (typeof valor === 'object') {
              if (valor.whatsapp) {
                doc.font('Helvetica-Bold').fontSize(9).fillColor(COLORS.muted).text('WHATSAPP');
                doc.font('Helvetica').fontSize(10).fillColor(COLORS.text).text(valor.whatsapp);
                doc.moveDown(0.2);
              }
              if (valor.email) {
                doc.font('Helvetica-Bold').fontSize(9).fillColor(COLORS.muted).text('E-MAIL');
                doc.font('Helvetica').fontSize(10).fillColor(COLORS.text).text(valor.email);
              }
            }
            break;
          default:
            doc.text(typeof valor === 'object' ? JSON.stringify(valor, null, 2) : String(valor));
        }
      });
    }

    const range = doc.bufferedPageRange();
    for (let i = 0; i < range.count; i++) {
      doc.switchToPage(range.start + i);
      paintFooter(doc, i + 1, range.count);
    }

    doc.end();
  });
}

export function dataUrlToAttachment(dataUrl: string, filename: string): MailAttachment {
  const match = DATA_URL_PATTERN.exec(dataUrl);
  if (!match) {
    throw new Error('Anexo em formato inválido.');
  }

  const [, contentType, base64] = match;
  return {
    filename,
    content: Buffer.from(base64, 'base64'),
    contentType,
  };
}