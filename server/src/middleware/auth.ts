import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { queryOne } from '../db/database.js';
import { cacheGet, cacheSet, cacheDel } from '../db/database.js';

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
  };
}

export function generateToken(payload: JwtPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
}

export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, JWT_SECRET) as JwtPayload;
}

export async function authMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Token não fornecido' });
    return;
  }

  try {
    const decoded = verifyToken(header.slice(7));

    // Cache user data for 30s — avoids DB hit on every single request
    const cacheKey = `auth:${decoded.userId}`;
    let user = cacheGet<AuthRequest['user']>(cacheKey);
    if (!user) {
      const dbUser = await queryOne(
        `SELECT id, email, nome, role, administrador_id, supervisor_id, condominio_id, ativo, bloqueado
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
