import type { Response } from 'express';
import { logger } from '../services/logger.js';

export function handle500(err: any, res: Response, ctx?: string) {
  const msg = err?.message || String(err);
  logger.error({ err: msg, ctx }, ctx ? `[${ctx}] ${msg}` : msg);
  if (!res.headersSent) {
    res.status(500).json({ error: 'Erro interno' });
  }
}
