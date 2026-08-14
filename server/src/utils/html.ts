const ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

/** Escapa texto vindo do usuário antes de interpolar em HTML de e-mail */
export function escapeHtml(valor: unknown): string {
  return String(valor ?? '').replace(/[&<>"']/g, (c) => ESCAPES[c]);
}

/**
 * Remove vetores de execução de HTML montado no cliente (corpo de comunicados).
 * Mantém a formatação visual, mas descarta script/iframe, handlers on* e URLs javascript:.
 */
export function sanitizeEmailHtml(html: unknown): string {
  return String(html ?? '')
    .replace(/<\s*(script|iframe|object|embed|link|meta|base)\b[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, '')
    .replace(/<\s*(script|iframe|object|embed|link|meta|base)\b[^>]*\/?>/gi, '')
    .replace(/\son[a-z]+\s*=\s*"[^"]*"/gi, '')
    .replace(/\son[a-z]+\s*=\s*'[^']*'/gi, '')
    .replace(/\son[a-z]+\s*=\s*[^\s>]+/gi, '')
    .replace(/(href|src|action)\s*=\s*(["']?)\s*javascript:[^"'>\s]*/gi, '$1=$2#');
}
