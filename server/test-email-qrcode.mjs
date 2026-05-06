import 'dotenv/config';
import zlib from 'node:zlib';
import { sendMail, isMailerConfigured, buildRespostaPdf } from './dist/services/mailer.js';

if (!isMailerConfigured()) { console.error('SMTP não configurado.'); process.exit(1); }

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    t[n] = c >>> 0;
  }
  return t;
})();
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = (CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8)) >>> 0;
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
  const t = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([t, data])), 0);
  return Buffer.concat([len, t, data, crc]);
};
const makePng = (w, h, [r, g, b], label) => {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const stride = 1 + w * 3;
  const raw = Buffer.alloc(h * stride);
  for (let y = 0; y < h; y++) {
    raw[y * stride] = 0;
    for (let x = 0; x < w; x++) {
      const o = y * stride + 1 + x * 3;
      // gradient + label band for visual interest
      const inBand = (label && y > h / 2 - 14 && y < h / 2 + 14 && x > 8 && x < w - 8);
      const fade = 0.7 + 0.3 * (x / w);
      raw[o] = inBand ? 255 : Math.min(255, r * fade);
      raw[o + 1] = inBand ? 255 : Math.min(255, g * fade);
      raw[o + 2] = inBand ? 255 : Math.min(255, b * fade);
    }
  }
  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
};
const toDataUrl = (buf) => `data:image/png;base64,${buf.toString('base64')}`;

const fotoPiso = toDataUrl(makePng(320, 240, [180, 60, 60], 'piso'));
const fotoBanheiro = toDataUrl(makePng(320, 240, [60, 110, 180], 'banheiro'));
const fotoGaleria1 = toDataUrl(makePng(320, 240, [80, 160, 90], 'g1'));
const fotoGaleria2 = toDataUrl(makePng(320, 240, [200, 150, 60], 'g2'));

const blocos = [
  { id: 'b1', tipo: 'avaliacao_estrela', label: 'Como está a limpeza do salão de festas?' },
  { id: 'b2', tipo: 'checklist', label: 'O que precisa de atenção?', opcoes: ['Piso', 'Banheiros', 'Janelas', 'Lixeiras'] },
  { id: 'b3', tipo: 'galeria', label: 'Fotos do local' },
  { id: 'b4', tipo: 'ocorrencia', label: 'Reporte uma ocorrência', opcoes: ['Limpeza', 'Manutenção', 'Segurança'] },
  { id: 'b5', tipo: 'texto', label: 'Comentários adicionais' },
];

const respostas = {
  b1: 4,
  b2: [true, true, false, false],
  b3: [
    { nome: 'galeria-1.png', dataUrl: fotoGaleria1 },
    { nome: 'galeria-2.png', dataUrl: fotoGaleria2 },
  ],
  b4: {
    categoria: 'Limpeza',
    local: 'Salão de festas',
    descricao: 'Piso com manchas próximas ao bar e banheiro masculino sem papel.',
    fotos: [fotoPiso, fotoBanheiro],
  },
  b5: 'Ambiente bem cuidado no geral, mas precisa de atenção extra após eventos.',
};

const dataHora = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });

const pdf = await buildRespostaPdf({
  qrNome: 'Avaliação Salão de Festas — TESTE com fotos',
  dataHora, respondente: 'Eduardo (simulação)', perfil: 'morador',
  bloco: 'A', unidade: '101', email: 'eduardodominikus@hotmail.com',
  blocos, respostas,
});

await sendMail({
  to: 'eduardodominikus@hotmail.com',
  subject: 'Nova resposta no QR Code: Avaliação Salão de Festas — TESTE com fotos',
  html: `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;background:#fff;border:1px solid #e0e0e0;border-radius:8px">
      <div style="background:#1565c0;color:#fff;padding:16px 24px;border-radius:6px 6px 0 0;margin:-24px -24px 24px">
        <h1 style="margin:0;font-size:20px">Nova resposta recebida (TESTE com fotos)</h1>
      </div>
      <p style="color:#333;margin:0 0 12px"><strong>Eduardo (simulação)</strong> — Bloco A, Unidade 101 respondeu o formulário em <strong>${dataHora}</strong>.</p>
      <p style="color:#1565c0;margin:18px 0 0;font-size:14px"><strong>📎 Formulário completo em anexo (PDF)</strong> com fotos embutidas.</p>
    </div>`,
  attachments: [{ filename: 'formulario-teste-com-fotos.pdf', content: pdf, contentType: 'application/pdf' }],
});

console.log('OK — e-mail com fotos enviado.');
