import { Router, Response, NextFunction } from 'express';
import multer from 'multer';
import sharp from 'sharp';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { AuthRequest } from '../middleware/auth.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOADS_DIR = path.join(__dirname, '..', '..', 'uploads');

// Garantir que diretórios existam
['avatars', 'documentos', 'fotos', 'qrcodes'].forEach(dir => {
  const p = path.join(UPLOADS_DIR, dir);
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
});

const storage = multer.memoryStorage();

const fileFilter = (_req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowed = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
  if (allowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Tipo de arquivo não permitido'));
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

// Valida o conteúdo real do arquivo (mimetype do multer é declarado pelo cliente)
function detectarTipoReal(buf: Buffer): string | null {
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return '.jpg';
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return '.png';
  if (buf.subarray(0, 4).toString('ascii') === 'RIFF' && buf.subarray(8, 12).toString('ascii') === 'WEBP') return '.webp';
  if (buf.subarray(0, 5).toString('ascii') === '%PDF-') return '.pdf';
  return null;
}

const IMAGENS = ['.jpg', '.png', '.webp'];

/** Converte falhas do multer (tamanho, tipo) em 400 em vez de 500 */
function uploadSingle(campo: string) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    upload.single(campo)(req as any, res as any, (err: any) => {
      if (!err) { next(); return; }
      const tamanho = err?.code === 'LIMIT_FILE_SIZE';
      res.status(400).json({ error: tamanho ? 'Arquivo maior que 10MB' : (err.message || 'Upload inválido') });
    });
  };
}

const router = Router();

// POST /api/upload/image
router.post('/image', uploadSingle('file'), async (req: AuthRequest, res: Response) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'Nenhum arquivo enviado' });
      return;
    }

    if (!IMAGENS.includes(detectarTipoReal(req.file.buffer) || '')) {
      res.status(400).json({ error: 'Arquivo inválido — apenas JPEG, PNG ou WebP' });
      return;
    }

    const subfolder = (req.body.folder as string) || 'fotos';
    const allowedFolders = ['avatars', 'documentos', 'fotos', 'qrcodes'];
    if (!allowedFolders.includes(subfolder)) {
      res.status(400).json({ error: 'Pasta de upload inválida' });
      return;
    }
    const dir = path.join(UPLOADS_DIR, subfolder);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.webp`;
    const filepath = path.join(dir, filename);

    await sharp(req.file.buffer)
      .resize(1200, 1200, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 80 })
      .toFile(filepath);

    const url = `/uploads/${subfolder}/${filename}`;
    res.json({ url });
  } catch (err: any) {
    console.error('[UPLOAD IMAGE ERROR]', err.message);
    res.status(500).json({ error: 'Erro ao processar imagem' });
  }
});

// POST /api/upload/avatar
router.post('/avatar', uploadSingle('file'), async (req: AuthRequest, res: Response) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'Nenhum arquivo enviado' });
      return;
    }

    if (!IMAGENS.includes(detectarTipoReal(req.file.buffer) || '')) {
      res.status(400).json({ error: 'Arquivo inválido — apenas JPEG, PNG ou WebP' });
      return;
    }

    const filename = `${req.user!.id}.webp`;
    const filepath = path.join(UPLOADS_DIR, 'avatars', filename);

    await sharp(req.file.buffer)
      .resize(200, 200, { fit: 'cover' })
      .webp({ quality: 80 })
      .toFile(filepath);

    const url = `/uploads/avatars/${filename}`;
    res.json({ url });
  } catch (err: any) {
    console.error('[UPLOAD AVATAR ERROR]', err.message);
    res.status(500).json({ error: 'Erro ao processar avatar' });
  }
});

// POST /api/upload/document
router.post('/document', uploadSingle('file'), async (req: AuthRequest, res: Response) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'Nenhum arquivo enviado' });
      return;
    }

    const ext = detectarTipoReal(req.file.buffer);
    if (!ext) {
      res.status(400).json({ error: 'Arquivo inválido — apenas PDF, JPEG, PNG ou WebP' });
      return;
    }
    const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;
    const filepath = path.join(UPLOADS_DIR, 'documentos', filename);

    await fs.promises.writeFile(filepath, req.file.buffer);

    const url = `/uploads/documentos/${filename}`;
    res.json({ url });
  } catch (err: any) {
    console.error('[UPLOAD DOCUMENT ERROR]', err.message);
    res.status(500).json({ error: 'Erro ao salvar documento' });
  }
});

export default router;
