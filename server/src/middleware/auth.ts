import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { queryOne, query } from '../db/database.js';
import { cacheGet, cacheSet, cacheDel } from '../db/database.js';

const APP_SLUG = 'gestao-limpeza';
const STATUS_VALIDOS_LICENCA = new Set(['ativa', 'trial']);

function mapearRoleCentral(role: string): string {
  const r = (role || '').toLowerCase();
  if (r === 'superadmin' || r === 'master') return 'master';
  if (r === 'admin' || r === 'administrador') return 'administrador';
  if (r === 'supervisor') return 'supervisor';
  return 'funcionario';
}

const JWT_SECRET: string = process.env.JWT_SECRET || '';
const WEAK_JWT_SECRETS = new Set([
  'troque-esta-chave-em-producao',
  'changeme',
  'default',
  'secret',
  'dev-local-secret-key-2024',
]);

if (!JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required');
}

if (process.env.NODE_ENV === 'production') {
  if (WEAK_JWT_SECRETS.has(JWT_SECRET)) {
    throw new Error('JWT_SECRET must be a strong unique value in production');
  }
  if (JWT_SECRET.length < 32) {
    throw new Error('JWT_SECRET must be at least 32 characters in production');
  }
}

export interface JwtPayload {
  userId: string;
  email: string;
  role: string;
}

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    nome: string;
    role: string;
    administrador_id: string | null;
    supervisor_id: string | null;
    condominio_id: string | null;
    ativo: boolean;
    bloqueado: boolean;
    senha_alterada_em?: string | Date | null;
  };
}

export function generateToken(payload: JwtPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d', algorithm: 'HS256' });
}

export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] }) as JwtPayload;
}

export async function authMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Token não fornecido' });
    return;
  }

  try {
    const raw: any = jwt.verify(header.slice(7), JWT_SECRET, { algorithms: ['HS256'] });
    let userId: string = raw.userId || raw.sub;

    // Token do auth-central traz apps[]
    if (Array.isArray(raw.apps)) {
      const licenca = raw.apps.find((a: any) => a.slug === APP_SLUG);
      if (!licenca || !STATUS_VALIDOS_LICENCA.has(licenca.status)) {
        res.status(403).json({ error: 'Sem licença ativa para Gestão e Limpeza' });
        return;
      }
      if (licenca.expira_em && new Date(licenca.expira_em) < new Date()) {
        res.status(403).json({ error: 'Licença expirada' });
        return;
      }
      // Procura primeiro por central_uuid; se nao, por email; se nao, cria
      let existing = await queryOne(`SELECT id FROM usuarios WHERE central_uuid = $1`, [userId]);
      if (!existing) existing = await queryOne(`SELECT id FROM usuarios WHERE email = $1`, [raw.email]);
      if (existing) {
        // Garante central_uuid setado
        await query(`UPDATE usuarios SET central_uuid = $1 WHERE id = $2 AND (central_uuid IS NULL OR central_uuid <> $1)`, [userId, existing.id]);
        userId = existing.id;
      } else {
        const novo = await queryOne(
          `INSERT INTO usuarios (central_uuid, email, senha_hash, nome, role, ativo)
           VALUES ($1, $2, '!central!', $3, $4::user_role, true) RETURNING id`,
          [userId, raw.email, raw.nome || raw.email, mapearRoleCentral(licenca.role)]
        );
        if (novo) userId = novo.id;
      }
      cacheDel(`auth:${userId}`);
    }

    const decoded = { userId, email: raw.email, role: raw.role || '' } as JwtPayload;

    // Cache user data for 30s — avoids DB hit on every single request
    const cacheKey = `auth:${decoded.userId}`;
    let user = cacheGet<AuthRequest['user']>(cacheKey);
    if (!user) {
      const dbUser = await queryOne(
        `SELECT id, email, nome, role, administrador_id, supervisor_id, condominio_id, ativo, bloqueado, senha_alterada_em
         FROM usuarios WHERE id = $1`,
        [decoded.userId]
      );
      if (dbUser) { user = dbUser; cacheSet(cacheKey, user, 30_000); }
    }

    if (!user) {
      console.warn(`[AUTH MW] User not found in DB: userId=${decoded.userId} email=${decoded.email}`);
      res.status(401).json({ error: 'Usuário não encontrado' });
      return;
    }
    if (!user.ativo || user.bloqueado) {
      console.warn(`[AUTH MW] Account disabled: userId=${decoded.userId} ativo=${user.ativo} bloqueado=${user.bloqueado}`);
      res.status(403).json({ error: 'Conta desativada ou bloqueada' });
      return;
    }
    // Tokens emitidos antes da última troca de senha deixam de valer
    if (user.senha_alterada_em && typeof raw.iat === 'number') {
      const trocaEm = new Date(user.senha_alterada_em).getTime();
      if (raw.iat * 1000 + 2000 < trocaEm) {
        res.status(401).json({ error: 'Sessão expirada. Faça login novamente.' });
        return;
      }
    }

    req.user = user;
    next();
  } catch (err: any) {
    // Distinguir erro de token vs erro de banco de dados
    if (err?.code === '28P01' || err?.code === 'ECONNREFUSED' || err?.code === '57P01' || err?.code === '53300') {
      console.error('[AUTH] Database error:', err.message);
      res.status(503).json({ error: 'Serviço temporariamente indisponível' });
    } else {
      res.status(401).json({ error: 'Token inválido' });
    }
  }
}

/** Invalidate cached auth data for a user (call after block/update/delete) */
export function invalidateUserCache(userId: string) {
  cacheDel(`auth:${userId}`);
  cacheDel(`scope:${userId}`);
}
