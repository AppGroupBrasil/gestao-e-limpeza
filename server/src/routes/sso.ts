import { Router, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { query, queryOne } from '../db/database.js';
import { generateToken } from '../middleware/auth.js';

// ─────────────────────────────────────────────────────────────────────────────
// SSO da central (App Condomínio) — login único.
// A central assina o token com a chave PRIVADA (RS256); aqui verificamos só pela
// chave PÚBLICA do JWKS — não há segredo a vazar. O usuário cadastrado na central
// é a fonte única da verdade: a cada acesso regravamos (read-only) os dados dele.
// O front faz GET /sso?token=... → POST /api/sso → recebe o token PRÓPRIO do app.
// Identidade local vinculada por `usuarios.central_uuid` (id local permanece próprio).
// ─────────────────────────────────────────────────────────────────────────────

const router = Router();
const ISS = 'auth-central';
const AUDIENCE = process.env.SSO_AUDIENCE || 'gestao-limpeza';
const JWKS_URL = process.env.SSO_JWKS_URL || 'https://auth.appgroupbrasil.com.br/api/v1/sso/jwks.json';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Jwk = { kid?: string; kty: string; n: string; e: string; alg?: string };
let jwksCache: Map<string, string> | null = null;
let jwksCacheAt = 0;
const JWKS_TTL = 5 * 60 * 1000;

async function carregarJwks(): Promise<Map<string, string>> {
  if (jwksCache && Date.now() - jwksCacheAt < JWKS_TTL) return jwksCache;
  const res = await fetch(JWKS_URL, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`JWKS ${res.status}`);
  const body = (await res.json()) as { keys: Jwk[] };
  const pems = new Map<string, string>();
  for (const k of body.keys || []) {
    if (k.kty !== 'RSA') continue;
    const pem = crypto.createPublicKey({ key: k as any, format: 'jwk' }).export({ type: 'spki', format: 'pem' }) as string;
    pems.set(k.kid || 'default', pem);
  }
  jwksCache = pems;
  jwksCacheAt = Date.now();
  return pems;
}

function lerKid(token: string): string | null {
  try {
    const [h] = token.split('.');
    const head = JSON.parse(Buffer.from(h, 'base64url').toString('utf8'));
    return head.kid || null;
  } catch {
    return null;
  }
}

interface SsoClaims {
  sub: string;
  email: string;
  nome: string;
  cpf?: string | null;
  telefone?: string | null;
  perfil?: string | null;
  condominio_id?: string | null;
  condominio_nome?: string | null;
  unidade?: string | null;
  bloco?: string | null;
}

async function verificarSso(token: string): Promise<SsoClaims> {
  const pems = await carregarJwks();
  const kid = lerKid(token);
  const candidatos = kid && pems.has(kid) ? [pems.get(kid)!] : [...pems.values()];
  if (candidatos.length === 0) throw new Error('JWKS sem chave RSA');
  let ultimoErro: any;
  for (const pem of candidatos) {
    try {
      return jwt.verify(token, pem, {
        algorithms: ['RS256'],
        issuer: ISS,
        audience: AUDIENCE,
      }) as unknown as SsoClaims;
    } catch (e) {
      ultimoErro = e;
    }
  }
  throw ultimoErro || new Error('assinatura inválida');
}

// central perfil → user_role do Gestão e Limpeza
function mapRole(perfil?: string | null): string {
  switch ((perfil || '').toLowerCase()) {
    case 'master':
    case 'superadmin':
      return 'master';
    case 'gestor':
    case 'sindico':
    case 'síndico':
    case 'admin':
    case 'administrador':
      return 'administrador';
    case 'supervisor':
      return 'supervisor';
    default:
      return 'funcionario';
  }
}

interface DbUser {
  id: string;
  email: string;
  nome: string;
  role: string;
  condominio_id: string | null;
  ativo: boolean;
  bloqueado: boolean;
}

/** Upsert read-only do usuário pelos claims da central. Vínculo por central_uuid. */
async function provisionarUsuario(claims: SsoClaims): Promise<DbUser> {
  const role = mapRole(claims.perfil);
  const email = (claims.email || '').toLowerCase().trim();
  const telefone = claims.telefone ? String(claims.telefone).replace(/\D/g, '').slice(0, 20) || null : null;

  // 1) localizar por central_uuid; legado: mesmo e-mail
  let user = await queryOne<DbUser>('SELECT id, email, nome, role, condominio_id, ativo, bloqueado FROM usuarios WHERE central_uuid = $1', [claims.sub]);
  if (!user && email) {
    user = await queryOne<DbUser>('SELECT id, email, nome, role, condominio_id, ativo, bloqueado FROM usuarios WHERE email = $1', [email]);
  }

  // 2) upsert do usuário (id local permanece próprio; central_uuid sempre setado)
  if (user) {
    await query(
      `UPDATE usuarios SET central_uuid = $2, email = $3, nome = $4, role = $5::user_role,
        telefone = COALESCE($6, telefone), atualizado_em = NOW() WHERE id = $1`,
      [user.id, claims.sub, email, claims.nome, role, telefone]
    );
    user.email = email;
    user.nome = claims.nome;
    user.role = role;
  } else {
    // senha_hash inutilizável: usuário SSO nunca loga por senha (bcrypt.compare falha)
    const novo = await queryOne<DbUser>(
      `INSERT INTO usuarios (central_uuid, email, senha_hash, nome, role, telefone, ativo)
       VALUES ($1, $2, '!sso!', $3, $4::user_role, $5, true)
       RETURNING id, email, nome, role, condominio_id, ativo, bloqueado`,
      [claims.sub, email, claims.nome, role, telefone]
    );
    user = novo!;
  }

  // 3) condomínio: condominios não tem central_uuid → id local = id central (ambos UUID).
  const condId = claims.condominio_id && UUID_RE.test(claims.condominio_id) ? claims.condominio_id : null;
  if (condId) {
    const nome = claims.condominio_nome || 'Condomínio';
    const existente = await queryOne<{ id: string }>('SELECT id FROM condominios WHERE id = $1', [condId]);
    if (existente) {
      await query('UPDATE condominios SET nome = $2 WHERE id = $1', [condId, nome]);
    } else {
      await query(
        `INSERT INTO condominios (id, nome, criado_por) VALUES ($1, $2, $3)
         ON CONFLICT (id) DO UPDATE SET nome = EXCLUDED.nome`,
        [condId, nome, user.id]
      );
    }
    if (user.condominio_id !== condId) {
      await query('UPDATE usuarios SET condominio_id = $2 WHERE id = $1', [user.id, condId]);
      user.condominio_id = condId;
    }
  }

  return user;
}

const ssoLimiter = rateLimit({
  windowMs: 60_000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Muitas requisições. Tente novamente em instantes.' },
});

// POST /api/sso  { token }  → troca o token da central pelo token PRÓPRIO do app
router.post('/', ssoLimiter, async (req: Request, res: Response) => {
  const token = String(req.body?.token || '');
  if (!token) {
    res.status(400).json({ error: 'token ausente' });
    return;
  }
  try {
    const claims = await verificarSso(token);
    const user = await provisionarUsuario(claims);
    if (!user.ativo || user.bloqueado) {
      res.status(403).json({ error: 'Conta desativada ou bloqueada' });
      return;
    }
    const appToken = generateToken({ userId: user.id, email: user.email, role: user.role });
    res.json({
      token: appToken,
      user: {
        id: user.id,
        email: user.email,
        nome: user.nome,
        role: user.role,
        condominio_id: user.condominio_id,
      },
    });
  } catch (err: any) {
    console.error('[SSO] falha:', err?.message || err);
    res.status(401).json({ error: 'SSO inválido' });
  }
});

export default router;
