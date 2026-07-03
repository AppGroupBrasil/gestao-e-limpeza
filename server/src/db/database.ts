import { Pool, PoolClient } from 'pg';

// ── Pool sizing for production (50+ condominios) ──
// Each request uses ~1-2 connections (auth+scope cached, route uses pool)
// With 50 condos, ~30-50 concurrent users at peak → ~60-100 connections needed
const POOL_MAX = Number.parseInt(process.env.DB_POOL_MAX || '80');
const DATABASE_URL = process.env.DATABASE_URL?.trim();
// DB_SSL_CA (conteúdo PEM) ou DB_SSL_REJECT_UNAUTHORIZED=true habilitam validação do certificado
const sslCa = process.env.DB_SSL_CA?.trim();
const useSsl = process.env.DB_SSL === 'false'
  ? false
  : sslCa
    ? { ca: sslCa, rejectUnauthorized: true }
    : { rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED === 'true' };

const pool = new Pool({
  ...(DATABASE_URL
    ? {
        connectionString: DATABASE_URL,
        ssl: useSsl,
      }
    : {
        host: process.env.DB_HOST || 'localhost',
        port: Number.parseInt(process.env.DB_PORT || '5432'),
        database: process.env.DB_NAME || 'gestao',
        user: process.env.DB_USER || 'gestao',
        password: process.env.DB_PASSWORD || '',
        ssl: process.env.DB_SSL ? useSsl : false,
      }),
  max: POOL_MAX,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 15000,
  // Statements prepared once, reused across connections
  statement_timeout: 30000, // kill queries that run >30s
});

pool.on('error', (err) => {
  console.error('Pool idle client error:', err.message);
});

// Monitoramento de pool — loga quando conexões estão ficando baixas
let lastPoolWarn = 0;
pool.on('connect', () => {
  const { totalCount, idleCount, waitingCount } = pool;
  const pressure = totalCount > 0 ? ((totalCount - idleCount) / POOL_MAX) * 100 : 0;
  if ((waitingCount > 0 || pressure > 70) && Date.now() - lastPoolWarn > 10000) {
    lastPoolWarn = Date.now();
    console.warn(`[POOL PRESSURE ${Math.round(pressure)}%] total=${totalCount}/${POOL_MAX} idle=${idleCount} waiting=${waitingCount}`);
  }
});

// Prevenir crash por unhandled rejection
process.on('unhandledRejection', (err: any) => {
  console.error('[UNHANDLED REJECTION]', err?.message || err);
});

// ── In-Memory Cache (TTL-based) ──
// Reduces repeated DB hits for auth, scope, dashboard
const _cache = new Map<string, { data: any; expires: number }>();

export function cacheGet<T>(key: string): T | undefined {
  const entry = _cache.get(key);
  if (!entry) return undefined;
  if (Date.now() > entry.expires) { _cache.delete(key); return undefined; }
  return entry.data as T;
}

export function cacheSet(key: string, data: any, ttlMs: number): void {
  _cache.set(key, { data, expires: Date.now() + ttlMs });
  // Periodic cleanup (every 1000 sets, prune expired)
  if (_cache.size > 500 && Math.random() < 0.1) {
    const now = Date.now();
    for (const [k, v] of _cache) { if (now > v.expires) _cache.delete(k); }
  }
}

export function cacheDel(pattern: string): void {
  for (const key of _cache.keys()) {
    if (key.startsWith(pattern)) _cache.delete(key);
  }
}

async function getClient() {
  try {
    return await pool.connect();
  } catch (err: any) {
    const { totalCount, idleCount, waitingCount } = pool;
    console.error(`[DB CONNECTION ERROR] ${err.message} | pool: total=${totalCount}/${POOL_MAX} idle=${idleCount} waiting=${waitingCount}`);
    throw err;
  }
}

export async function query<T = any>(text: string, params?: any[]): Promise<T[]> {
  const client = await getClient();
  try {
    const { rows } = await client.query(text, params);
    return rows as T[];
  } finally {
    client.release();
  }
}

export async function queryOne<T = any>(text: string, params?: any[]): Promise<T | null> {
  const client = await getClient();
  try {
    const { rows } = await client.query(text, params);
    return (rows[0] as T) ?? null;
  } finally {
    client.release();
  }
}

export async function execute(text: string, params?: any[]): Promise<number> {
  const client = await getClient();
  try {
    const { rowCount } = await client.query(text, params);
    return rowCount ?? 0;
  } finally {
    client.release();
  }
}

/** Executa múltiplas operações dentro de uma transação atômica */
export async function withTransaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await getClient();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export default pool;
