import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth.js';
import { query, cacheGet, cacheSet } from '../db/database.js';

export const ROLE_LEVEL: Record<string, number> = {
  master: 4,
  administrador: 3,
  supervisor: 2,
  funcionario: 1,
};

/** Requer nível mínimo de papel */
export function requireRole(...roles: string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      res.status(401).json({ error: 'Não autenticado' });
      return;
    }
    if (!roles.includes(req.user.role)) {
      res.status(403).json({ error: 'Permissão insuficiente' });
      return;
    }
    next();
  };
}

/** Requer nível mínimo (ex.: supervisor = supervisor + admin + master) */
export function requireMinRole(minRole: string) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      res.status(401).json({ error: 'Não autenticado' });
      return;
    }
    const userLevel = ROLE_LEVEL[req.user.role] ?? 0;
    const requiredLevel = ROLE_LEVEL[minRole] ?? 99;
    if (userLevel < requiredLevel) {
      res.status(403).json({ error: 'Permissão insuficiente' });
      return;
    }
    next();
  };
}

/**
 * Identidade do tenant para configurações isoladas por cliente
 * (tema, permissões, e-mails de vencimento, chaves gerais).
 * master → 'global' (padrões da plataforma); demais → o administrador dono da conta.
 */
export function getTenantId(user: AuthRequest['user']): string {
  if (!user) return 'global';
  if (user.role === 'master') return 'global';
  if (user.role === 'administrador') return user.id;
  return user.administrador_id || 'global';
}

/**
 * Filtra dados por escopo do usuário na hierarquia.
 * Cached per user for 60s to avoid DB hit on every request.
 */
export async function getCondominiosScope(user: AuthRequest['user']): Promise<string[]> {
  if (!user) return [];

  // Check cache first (60s TTL)
  const cacheKey = `scope:${user.id}`;
  const cached = cacheGet<string[]>(cacheKey);
  if (cached) return cached;

  let ids: string[];

  if (user.role === 'master') {
    const rows = await query<{ id: string }>('SELECT id FROM condominios');
    ids = rows.map(r => r.id);
  } else if (user.role === 'administrador') {
    const rows = await query<{ id: string }>(
      'SELECT id FROM condominios WHERE criado_por = $1 AND ativo = true',
      [user.id]
    );
    ids = rows.map(r => r.id);
  } else if (user.role === 'supervisor') {
    const rows = await query<{ id: string }>(
      `SELECT DISTINCT c.id FROM condominios c
       WHERE c.ativo = true AND (
         c.id IN (SELECT condominio_id FROM usuarios WHERE supervisor_id = $1 AND condominio_id IS NOT NULL)
         OR c.id = $2
       )`,
      [user.id, user.condominio_id]
    );
    ids = rows.map(r => r.id);
  } else {
    ids = user.condominio_id ? [user.condominio_id] : [];
  }

  cacheSet(cacheKey, ids, 60_000);
  return ids;
}

/** Middleware que injeta req.condominioIds para filtragem */
export async function scopeMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  if (!req.user) {
    res.status(401).json({ error: 'Não autenticado' });
    return;
  }
  try {
    const ids = await getCondominiosScope(req.user);
    (req as any).condominioIds = ids;
    next();
  } catch (err: any) {
    console.error('[SCOPE MIDDLEWARE ERROR]', err.message);
    res.status(503).json({ error: 'Erro ao verificar permissões' });
  }
}
