const API_BASE = import.meta.env.VITE_API_URL || '/api';

let authToken: string | null = localStorage.getItem('gestao_token');

type ParsedBody = {
  data: any;
  text: string;
  hasBody: boolean;
  invalidJson: boolean;
  isHtml: boolean;
};

export function setToken(token: string | null) {
  authToken = token;
  if (token) {
    localStorage.setItem('gestao_token', token);
  } else {
    localStorage.removeItem('gestao_token');
  }
}

export function getToken(): string | null {
  return authToken;
}

async function parseResponseBody(res: Response): Promise<ParsedBody> {
  if (res.status === 204) {
    return {
      data: null,
      text: '',
      hasBody: false,
      invalidJson: false,
      isHtml: false,
    };
  }

  const text = await res.text();
  const trimmed = text.trim();
  const contentType = (res.headers.get('content-type') || '').toLowerCase();

  if (!trimmed) {
    return {
      data: null,
      text,
      hasBody: false,
      invalidJson: false,
      isHtml: false,
    };
  }

  const looksLikeJson = contentType.includes('application/json') || trimmed.startsWith('{') || trimmed.startsWith('[');
  const isHtml = contentType.includes('text/html') || trimmed.startsWith('<!doctype html') || trimmed.startsWith('<html');

  if (!looksLikeJson) {
    return {
      data: null,
      text,
      hasBody: true,
      invalidJson: false,
      isHtml,
    };
  }

  try {
    return {
      data: JSON.parse(text),
      text,
      hasBody: true,
      invalidJson: false,
      isHtml,
    };
  } catch {
    return {
      data: null,
      text,
      hasBody: true,
      invalidJson: true,
      isHtml,
    };
  }
}

function getBodyMessage(body: ParsedBody): string | null {
  if (body.data && typeof body.data === 'object') {
    if (typeof body.data.error === 'string' && body.data.error.trim()) {
      return body.data.error;
    }

    if (typeof body.data.message === 'string' && body.data.message.trim()) {
      return body.data.message;
    }
  }

  if (body.isHtml) {
    return 'Servidor respondeu com HTML em vez de JSON. Verifique o proxy ou o backend.';
  }

  if (body.invalidJson) {
    return 'Servidor respondeu com JSON inválido. Verifique o backend.';
  }

  if (body.hasBody && body.text.trim()) {
    return body.text.trim();
  }

  return null;
}

function handleUnauthorized(path: string, body: ParsedBody) {
  if (path === '/auth/login') {
    throw new Error(getBodyMessage(body) || 'Credenciais inválidas');
  }

  if (body.data?.error === 'Token inválido' || body.data?.error === 'Token não fornecido') {
    setToken(null);
    globalThis.dispatchEvent(new Event('auth:token-invalid'));
  }

  throw new Error(getBodyMessage(body) || 'Sessão expirada');
}

function throwIfRequestFailed(path: string, res: Response, body: ParsedBody) {
  if (res.ok) {
    return;
  }

  if (res.status === 429) {
    const mins = typeof body.data?.retryAfter === 'number' ? body.data.retryAfter : 15;
    throw new Error(getBodyMessage(body) || `Muitas tentativas. Aguarde ${mins} minutos.`);
  }

  if (res.status === 401) {
    handleUnauthorized(path, body);
  }

  if (res.status === 502 || res.status === 504) {
    throw new Error('Servidor indisponível. Verifique se o backend está rodando.');
  }

  if (res.status === 500) {
    throw new Error(getBodyMessage(body) || 'Erro interno no servidor. Tente novamente.');
  }

  if (res.status === 503) {
    throw new Error('Serviço temporariamente indisponível. Tente novamente.');
  }

  throw new Error(getBodyMessage(body) || `Erro ${res.status}`);
}

/* ── snake_case → camelCase (respostas da API) ── */
function toCamel(obj: any): any {
  if (Array.isArray(obj)) return obj.map(toCamel);
  if (obj === null || obj === undefined || typeof obj !== 'object') return obj;
  if (obj instanceof Date) return obj;
  const out: any = {};
  for (const key of Object.keys(obj)) {
    const camel = key.replaceAll(/_([a-z0-9])/gi, (_: string, c: string) => c.toUpperCase());
    out[camel] = toCamel(obj[key]);
  }
  return out;
}

/* ── camelCase → snake_case (envio para API) ── */
function toSnake(obj: any): any {
  if (Array.isArray(obj)) return obj.map(toSnake);
  if (obj === null || obj === undefined || typeof obj !== 'object') return obj;
  if (obj instanceof Date) return obj;
  const out: any = {};
  for (const key of Object.keys(obj)) {
    const snake = key.replaceAll(/[A-Z]/g, (l: string) => `_${l.toLowerCase()}`);
    out[snake] = toSnake(obj[key]);
  }
  return out;
}

async function request<T = any>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }

  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers,
    });
  } catch {
    throw new Error('Servidor indisponível. Verifique se o backend está rodando.');
  }

  const body = await parseResponseBody(res);
  throwIfRequestFailed(path, res, body);

  if (res.status === 204) return {} as T;
  if (!body.hasBody) return {} as T;
  if (body.invalidJson || body.data === null) {
    throw new Error('Resposta inválida do servidor. Verifique o backend.');
  }
  return toCamel(body.data) as T;
}

async function requestPublic<T = any>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers,
    });
  } catch {
    throw new Error('Servidor indisponível. Verifique se o backend está rodando.');
  }

  const body = await parseResponseBody(res);

  if (!res.ok) {
    throw new Error(getBodyMessage(body) || `Erro ${res.status}`);
  }

  if (res.status === 204) return {} as T;
  if (!body.hasBody) return {} as T;
  if (body.invalidJson || body.data === null) {
    throw new Error('Resposta inválida do servidor. Verifique o backend.');
  }
  return toCamel(body.data) as T;
}

/* Wrapper para enviar body */
function post<T = any>(path: string, data: any) {
  return request<T>(path, { method: 'POST', body: JSON.stringify(data) });
}
function put<T = any>(path: string, data: any) {
  return request<T>(path, { method: 'PUT', body: JSON.stringify(data) });
}
function patch<T = any>(path: string, data: any) {
  return request<T>(path, { method: 'PATCH', body: JSON.stringify(data) });
}
function del<T = any>(path: string) {
  return request<T>(path, { method: 'DELETE' });
}

// ── Auth ──
export const auth = {
  login: (email: string, senha: string) =>
    request<{ token: string; user: any }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, senha }),
    }),
  register: (data: { email: string; senha: string; nome: string; role: string; condominioId?: string; supervisorId?: string }) =>
    post('/auth/register', data),
  me: () => request('/auth/me'),
  changePassword: async (senhaAtual: string, novaSenha: string) => {
    const res = await post<{ ok: boolean; token?: string }>('/auth/change-password', { senhaAtual, novaSenha });
    if (res?.token) setToken(res.token);
    return res;
  },
  selfRegister: (data: { email: string; senha: string; nome: string; telefone?: string }) =>
    request<{ message: string }>('/auth/self-register', { method: 'POST', body: JSON.stringify(data) }),
  forgotPassword: (email: string) =>
    request<{ message: string }>('/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) }),
  resetPassword: (token: string, novaSenha: string) =>
    request<{ message: string }>('/auth/reset-password', { method: 'POST', body: JSON.stringify({ token, novaSenha }) }),
};

// ── Generic CRUD factory ──
function crud<T = any>(basePath: string) {
  return {
    list: () => request<T[]>(basePath),
    get: (id: string) => request<T>(`${basePath}/${id}`),
    create: (data: Partial<T>) => post<T>(basePath, data),
    update: (id: string, data: Partial<T>) => put<T>(`${basePath}/${id}`, data),
    remove: (id: string) => del(`${basePath}/${id}`),
  };
}

// ── Entidades ──
export const condominios = {
  ...crud('/condominios'),
  patchStatus: (id: string, data: any) => patch(`/condominios/${id}/status`, data),
};
export const ordensServico = {
  ...crud('/ordens-servico'),
  updateStatus: (id: string, status: string) => patch(`/ordens-servico/${id}/status`, { status }),
  avaliar: (id: string, nota: number, comentario?: string) => patch(`/ordens-servico/${id}/avaliacao`, { nota, comentario }),
};
export const checklists = {
  ...crud('/checklists'),
  updateItens: (id: string, data: any) => patch(`/checklists/${id}/itens`, data),
};
export const escalas = crud('/escalas');
export const materiais = {
  ...crud('/materiais'),
  listMovimentacoes: (id: string) => request<any[]>(`/materiais/${id}/movimentacoes`),
  addMovimentacao: (id: string, data: any) => post(`/materiais/${id}/movimentacoes`, data),
};
export const inspecoes = crud('/inspecoes');
export const vistorias = crud('/vistorias');
export const reportes = {
  ...crud('/reportes'),
  updateStatus: (id: string, status: string) => patch(`/reportes/${id}/status`, { status }),
};
export const antesDepois = {
  ...crud('/antes-depois'),
};
export const tarefas = {
  ...crud('/tarefas'),
  listExecucoes: (id: string) => request<any[]>(`/tarefas/${id}/execucoes`),
  allExecucoes: () => request<any[]>('/tarefas/execucoes/all'),
  addExecucao: (id: string, data: any) => post(`/tarefas/${id}/execucoes`, data),
};
export const roteiros = {
  ...crud('/roteiros'),
  listExecucoes: (id: string) => request<any[]>(`/roteiros/${id}/execucoes`),
  addExecucao: (id: string, data: any) => post(`/roteiros/${id}/execucoes`, data),
};
export const qrcodes = {
  ...crud('/qrcodes'),
  leituras: () => request<any[]>('/qrcodes/leituras/all'),
  addLeitura: (data: any) => post('/qrcodes/leituras', data),
  listPonto: () => request<any[]>('/qrcodes/ponto/all'),
  addPonto: (data: any) => post('/qrcodes/ponto', data),
  listSla: () => request<any[]>('/qrcodes/sla/all'),
  createSla: (data: any) => post('/qrcodes/sla', data),
  updateSla: (id: string, status: string) => patch(`/qrcodes/sla/${id}`, { status }),
  getSupervisorPerm: () => request<{ autorizado: boolean }>('/qrcodes/supervisor-perm'),
  setSupervisorPerm: (autorizado: boolean) => put('/qrcodes/supervisor-perm', { autorizado }),
  listRespostas: () => request<any[]>('/qrcodes/respostas/all'),
};
export const geolocalizacao = {
  list: (data?: string) => {
    const path = data ? `/geolocalizacao?data=${data}` : '/geolocalizacao';
    return request<any[]>(path);
  },
  create: (data: any) => post('/geolocalizacao', data),
  registrarSaida: (id: string, tempoTotal: number) => patch(`/geolocalizacao/${id}/saida`, { tempoTotal }),
  listSla: () => request<any[]>('/geolocalizacao/sla'),
  createSla: (data: any) => post('/geolocalizacao/sla', data),
  updateSla: (id: string, status: string) => patch(`/geolocalizacao/sla/${id}`, { status }),
};
export const comunicados = crud('/comunicados');
export const moradores = {
  ...crud('/moradores'),
  listWhatsContatos: () => request<any[]>('/moradores/whatsapp-contatos'),
  addWhatsContato: (data: any) => post('/moradores/whatsapp-contatos', data),
  removeWhatsContato: (id: string) => del(`/moradores/whatsapp-contatos/${id}`),
};
export const vencimentos = {
  ...crud('/vencimentos'),
  getEmails: () => request<{ emails: string[] }>('/vencimentos/emails/global'),
  setEmails: (emails: string[]) => put('/vencimentos/emails/global', { emails }),
};
export const quadroAtividades = {
  ...crud('/quadro-atividades'),
  updateStatus: (id: string, status: string) => patch(`/quadro-atividades/${id}/status`, { status }),
};
export const usuarios = {
  ...crud('/usuarios'),
  bloquear: (id: string, bloqueado: boolean, motivo?: string) => patch(`/usuarios/${id}/bloquear`, { bloqueado, motivo }),
  resetSenha: (id: string, novaSenha: string) => patch(`/usuarios/${id}/reset-senha`, { novaSenha }),
};
export const configuracoes = {
  getTema: () => request('/configuracoes/tema'),
  setTema: (data: any) => put('/configuracoes/tema', data),
  getQuadroPermissoes: () => request('/configuracoes/quadro-permissoes'),
  setQuadroPermissoes: (data: any) => put('/configuracoes/quadro-permissoes', data),
};
export const permissoes = {
  list: () => request<any[]>('/permissoes'),
  update: (id: string, data: any) => put(`/permissoes/${id}`, data),
};
export const dashboard = {
  summary: () => request<any>('/dashboard/summary'),
  masterSummary: () => request<any>('/dashboard/master-summary'),
  masterUsers: () => request<any>('/dashboard/master-users'),
  masterReport: (params: { dataInicio?: string; dataFim?: string; statusPlano?: string }) => {
    const qs = new URLSearchParams();
    if (params.dataInicio) qs.set('dataInicio', params.dataInicio);
    if (params.dataFim) qs.set('dataFim', params.dataFim);
    if (params.statusPlano) qs.set('statusPlano', params.statusPlano);
    return request<any>(`/dashboard/master-report?${qs.toString()}`);
  },
};

export const publicApi = {
  getChecklist: (id: string) => requestPublic(`/public/checklists/${id}`),
  updateChecklistItens: (id: string, data: any) => requestPublic(`/public/checklists/${id}/itens`, { method: 'PATCH', body: JSON.stringify(data) }),
  getVistoria: (id: string) => requestPublic(`/public/vistorias/${id}`),
  updateVistoria: (id: string, data: any) => requestPublic(`/public/vistorias/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  getTarefa: (id: string) => requestPublic(`/public/tarefas/${id}`),
  addTarefaExecucao: (id: string, data: any) => requestPublic(`/public/tarefas/${id}/execucao`, { method: 'POST', body: JSON.stringify(data) }),
};
export const relatorios = {
  resumo: (params?: { dataInicio?: string; dataFim?: string; condominioId?: string; funcionario?: string; funcaoSistema?: string }) => {
    const qs = new URLSearchParams();
    if (params?.dataInicio) qs.set('dataInicio', params.dataInicio);
    if (params?.dataFim) qs.set('dataFim', params.dataFim);
    if (params?.condominioId) qs.set('condominioId', params.condominioId);
    if (params?.funcionario) qs.set('funcionario', params.funcionario);
    if (params?.funcaoSistema) qs.set('funcaoSistema', params.funcaoSistema);
    const suffix = qs.toString() ? `?${qs.toString()}` : '';
    return request<any>(`/relatorios/resumo${suffix}`);
  },
};
export const notificacoes = {
  list: () => request<any[]>('/notificacoes'),
  unreadCount: () => request<{ count: number }>('/notificacoes/unread-count'),
  markRead: (id: string) => patch('/notificacoes/' + id + '/read', {}),
  markAllRead: () => post('/notificacoes/read-all', {}),
  remove: (id: string) => del('/notificacoes/' + id),
};
export const perfil = {
  get: () => request<any>('/perfil'),
  update: (data: { nome?: string; telefone?: string; cargo?: string }) => put('/perfil', data),
  changeSenha: (senhaAtual: string, novaSenha: string) => put('/perfil/senha', { senhaAtual, novaSenha }),
  updateAvatar: (avatarUrl: string) => put('/perfil/avatar', { avatarUrl }),
};
export const audit = {
  list: (page?: number, limit?: number) => request<any>(`/audit?page=${page || 1}&limit=${limit || 50}`),
  metrics: () => request<any>('/audit/metrics'),
};
export const documentosPublicos = {
  ...crud('/documentos-publicos'),
  toggle: (id: string) => patch(`/documentos-publicos/${id}/toggle`, {}),
  getCategorias: () => request<{ value: string; label: string }[]>('/documentos-publicos/categorias'),
  setCategorias: (categorias: { value: string; label: string }[]) => put('/documentos-publicos/categorias', { categorias }),
};

export const rondas = {
  ...crud('/rondas'),
  toggle: (id: string) => patch(`/rondas/${id}/toggle`, {}),
  registros: (qs?: string) => request<any[]>(`/rondas/registros/all${qs ? '?' + qs : ''}`),
};

// ── Upload ──
export const upload = {
  image: async (file: File, folder?: string): Promise<string> => {
    const formData = new FormData();
    formData.append('file', file);
    if (folder) formData.append('folder', folder);
    const res = await fetch(`${API_BASE}/upload/image`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${authToken}` },
      body: formData,
    });
    const data = await res.json();
    return data.url;
  },
  avatar: async (file: File): Promise<string> => {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch(`${API_BASE}/upload/avatar`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${authToken}` },
      body: formData,
    });
    const data = await res.json();
    return data.url;
  },
  document: async (file: File): Promise<string> => {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch(`${API_BASE}/upload/document`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${authToken}` },
      body: formData,
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || `Erro ${res.status}`);
    }
    const data = await res.json();
    if (!data.url) throw new Error('URL do documento não retornada');
    return data.url;
  },
};
