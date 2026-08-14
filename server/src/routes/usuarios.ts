import { Router, Response } from 'express';
import bcrypt from 'bcrypt';
import { query, queryOne, execute, withTransaction, cacheDel } from '../db/database.js';
import { AuthRequest, invalidateUserCache } from '../middleware/auth.js';
import { requireMinRole, ROLE_LEVEL } from '../middleware/rbac.js';
import { isMailerConfigured, sendMail } from '../services/mailer.js';
import { escapeHtml } from '../utils/html.js';

function buildNovoCadastroHtml(novoNome: string, novoEmail: string, novoRole: string, criadoPor: string): string {
  const roleLabels: Record<string, string> = {
    master: 'Master', administrador: 'Administrador', supervisor: 'Supervisor', funcionario: 'Funcionário'
  };
  return `
    <div style="font-family:Arial,sans-serif;background:#f5f7fa;padding:24px;color:#1f2937;">
      <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:16px;padding:32px;border:1px solid #e5e7eb;">
        <h1 style="margin:0 0 16px;font-size:24px;color:#111827;">Novo cadastro na plataforma</h1>
        <p style="margin:0 0 12px;font-size:16px;line-height:1.5;color:#374151;">
          Um novo usuário foi cadastrado no sistema <strong>Gestão e Limpeza</strong>.
        </p>
        <table style="width:100%;border-collapse:collapse;margin:16px 0;">
          <tr><td style="padding:8px 12px;font-weight:bold;color:#6b7280;">Nome</td><td style="padding:8px 12px;">${escapeHtml(novoNome)}</td></tr>
          <tr style="background:#f9fafb;"><td style="padding:8px 12px;font-weight:bold;color:#6b7280;">E-mail</td><td style="padding:8px 12px;">${escapeHtml(novoEmail)}</td></tr>
          <tr><td style="padding:8px 12px;font-weight:bold;color:#6b7280;">Perfil</td><td style="padding:8px 12px;">${escapeHtml(roleLabels[novoRole] || novoRole)}</td></tr>
          <tr style="background:#f9fafb;"><td style="padding:8px 12px;font-weight:bold;color:#6b7280;">Cadastrado por</td><td style="padding:8px 12px;">${escapeHtml(criadoPor)}</td></tr>
        </table>
        <p style="margin:16px 0 0;font-size:13px;color:#9ca3af;">Este é um e-mail automático do sistema Gestão e Limpeza.</p>
      </div>
    </div>`;
}

async function notificarMastersNovoCadastro(novoNome: string, novoEmail: string, novoRole: string, criadoPor: string) {
  if (!isMailerConfigured()) return;
  try {
    const masters = await query<any>('SELECT email, nome FROM usuarios WHERE role = $1 AND ativo = true', ['master']);
    const html = buildNovoCadastroHtml(novoNome, novoEmail, novoRole, criadoPor);
    for (const m of masters) {
      await sendMail({
        to: m.email,
        subject: `Novo cadastro: ${novoNome} (${novoRole})`,
        html,
      });
    }
  } catch (err) {
    console.error('[NOTIF-NOVO-CADASTRO] Erro ao enviar e-mail (não fatal):', err);
  }
}

const router = Router();

function resolveAdminId(caller: { role: string; id: string; administrador_id?: string | null }): string | null {
  if (caller.role === 'master') return null;
  if (caller.role === 'administrador') return caller.id;
  return caller.administrador_id ?? null;
}

/** Leitura de um usuário: master vê todos; demais só a si mesmo e a própria hierarquia */
function podeVerUsuario(
  caller: NonNullable<AuthRequest['user']>,
  alvo: { id: string; administrador_id: string | null; supervisor_id: string | null; role: string }
): boolean {
  if (caller.role === 'master') return true;
  if (alvo.id === caller.id) return true;
  const adminId = resolveAdminId(caller);
  if (adminId && alvo.administrador_id === adminId) return true;
  if (caller.role === 'supervisor' && alvo.supervisor_id === caller.id) return true;
  return alvo.administrador_id === null && alvo.role === 'funcionario';
}

// POST /api/usuarios
router.post('/', requireMinRole('administrador'), async (req: AuthRequest, res: Response) => {
  try {
    const caller = req.user!;
    const { email, senha, nome, role, cargo, condominioId, supervisorId } = req.body;

    if (!email || !senha || !nome || !role) {
      res.status(400).json({ error: 'email, senha, nome e role são obrigatórios' });
      return;
    }

    if (senha.length < 6) {
      res.status(400).json({ error: 'A senha deve ter no mínimo 6 caracteres' });
      return;
    }

    const roleLevel: Record<string, number> = { master: 4, administrador: 3, supervisor: 2, funcionario: 1 };
    if ((roleLevel[role] ?? 0) >= (roleLevel[caller.role] ?? 0)) {
      res.status(403).json({ error: 'Não pode criar usuário com role igual ou superior' });
      return;
    }

    const exists = await queryOne<any>('SELECT id, ativo FROM usuarios WHERE email = $1', [email]);
    if (exists && exists.ativo) {
      res.status(409).json({ error: 'Este e-mail já está em uso por outro usuário ativo' });
      return;
    }

    const senhaHash = await bcrypt.hash(senha, 12);
    const adminId = resolveAdminId(caller);
    const supId = role === 'funcionario' ? (supervisorId || caller.id) : null;

    let user: any;
    if (exists && !exists.ativo) {
      // Reactivate soft-deleted user with new data
      user = await queryOne<any>(
        `UPDATE usuarios SET senha_hash=$1, nome=$2, role=$3, cargo=$4, criado_por=$5, administrador_id=$6, supervisor_id=$7, condominio_id=$8, ativo=true, bloqueado=false, motivo_bloqueio=NULL
         WHERE id=$9
         RETURNING id, email, nome, role, cargo, ativo, bloqueado, condominio_id, supervisor_id, administrador_id, criado_em`,
        [senhaHash, nome, role, cargo || null, caller.id, adminId, supId, condominioId || null, exists.id]
      );
    } else {
      user = await queryOne<any>(
        `INSERT INTO usuarios (email, senha_hash, nome, role, cargo, criado_por, administrador_id, supervisor_id, condominio_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING id, email, nome, role, cargo, ativo, bloqueado, condominio_id, supervisor_id, administrador_id, criado_em`,
        [email, senhaHash, nome, role, cargo || null, caller.id, adminId, supId, condominioId || null]
      );
    }

    // Invalidate scope cache (new user changes condomínio/supervisor counts)
    cacheDel('scope:');
    cacheDel('dash:');

    // Notify masters by email about new registration
    notificarMastersNovoCadastro(nome, email, role, caller.nome || caller.email);

    res.status(201).json(user);
  } catch (err: any) {
    console.error('[CRIAR USUARIO ERROR]', err.message);
    res.status(500).json({ error: 'Erro interno ao criar usuário' });
  }
});

// GET /api/usuarios
router.get('/', requireMinRole('supervisor'), async (req: AuthRequest, res: Response) => {
  try {
  const user = req.user!;
  let rows;

  if (user.role === 'master') {
    rows = await query(
      `SELECT id, email, nome, role, ativo, bloqueado, motivo_bloqueio, administrador_id, supervisor_id, condominio_id, avatar_url, telefone, cargo, criado_em
       FROM usuarios WHERE ativo = true ORDER BY nome`
    );
  } else if (user.role === 'administrador') {
    rows = await query(
      `SELECT id, email, nome, role, ativo, bloqueado, motivo_bloqueio, administrador_id, supervisor_id, condominio_id, avatar_url, telefone, cargo, criado_em
       FROM usuarios WHERE ativo = true AND (administrador_id = $1 OR id = $1
         OR (administrador_id IS NULL AND role = 'funcionario'))
       ORDER BY nome`,
      [user.id]
    );
  } else {
    // supervisor — vê seus funcionários
    rows = await query(
      `SELECT id, email, nome, role, ativo, bloqueado, administrador_id, supervisor_id, condominio_id, avatar_url, telefone, cargo, criado_em
       FROM usuarios WHERE ativo = true AND (supervisor_id = $1 OR id = $1) ORDER BY nome`,
      [user.id]
    );
  }

  res.json(rows);
  } catch (err: any) {
    console.error('GET /usuarios erro:', err.message);
    res.status(500).json({ error: 'Erro interno ao listar usuários' });
  }
});

// GET /api/usuarios/:id
router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
  const caller = req.user!;
  const row = await queryOne<any>(
    `SELECT id, email, nome, role, ativo, bloqueado, motivo_bloqueio, administrador_id, supervisor_id, condominio_id, avatar_url, telefone, cargo, criado_em
     FROM usuarios WHERE id = $1`,
    [req.params.id]
  );
  if (!row) { res.status(404).json({ error: 'Usuário não encontrado' }); return; }
  if (!podeVerUsuario(caller, row)) { res.status(403).json({ error: 'Sem permissão para este usuário' }); return; }
  res.json(row);
  } catch (err: any) {
    console.error('GET /usuarios/:id erro:', err.message);
    res.status(500).json({ error: 'Erro interno ao buscar usuário' });
  }
});

// PUT /api/usuarios/:id
router.put('/:id', requireMinRole('administrador'), async (req: AuthRequest, res: Response) => {
  try {
  const caller = req.user!;
  const target = await queryOne<any>('SELECT id, administrador_id, supervisor_id, role FROM usuarios WHERE id = $1', [req.params.id]);
  if (!target) { res.status(404).json({ error: 'Usuário não encontrado' }); return; }

  // Verify target belongs to caller's hierarchy
  if (caller.role !== 'master') {
    const isOwner = target.administrador_id === caller.id;
    const isSelf = target.id === caller.id;
    const isOrphan = target.administrador_id === null && target.role === 'funcionario';
    if (!isOwner && !isSelf && !isOrphan) {
      res.status(403).json({ error: 'Sem permissão para este usuário' });
      return;
    }
  }

  const callerLevel = ROLE_LEVEL[caller.role] ?? 0;
  const isSelf = target.id === caller.id;
  if (!isSelf && (ROLE_LEVEL[target.role] ?? 0) >= callerLevel) {
    res.status(403).json({ error: 'Não pode editar usuário com role igual ou superior' });
    return;
  }

  const { nome, role, ativo, condominioId, supervisorId, telefone, cargo } = req.body;

  if (role !== undefined && role !== target.role) {
    if (isSelf) { res.status(403).json({ error: 'Não pode alterar o próprio perfil de acesso' }); return; }
    if ((ROLE_LEVEL[role] ?? 0) >= callerLevel) {
      res.status(403).json({ error: 'Não pode atribuir role igual ou superior ao seu' });
      return;
    }
  }
  if (ativo === false && isSelf) { res.status(403).json({ error: 'Não pode desativar a própria conta' }); return; }

  // Só atualiza o que veio no corpo — campos ausentes preservam o valor atual
  const campos: Record<string, any> = {};
  if (nome !== undefined) campos.nome = String(nome).trim().slice(0, 255);
  if (role !== undefined) campos.role = role;
  if (ativo !== undefined) campos.ativo = !!ativo;
  if (condominioId !== undefined) campos.condominio_id = condominioId || null;
  if (supervisorId !== undefined) campos.supervisor_id = supervisorId || null;
  if (telefone !== undefined) campos.telefone = telefone || null;
  if (cargo !== undefined) campos.cargo = cargo || null;

  const chaves = Object.keys(campos);
  if (chaves.length === 0) { res.status(400).json({ error: 'Nenhum campo para atualizar' }); return; }

  const row = await queryOne(
    `UPDATE usuarios SET ${chaves.map((k, i) => `${k}=$${i + 1}`).join(', ')}
     WHERE id=$${chaves.length + 1} RETURNING id, email, nome, role, ativo, condominio_id, supervisor_id`,
    [...chaves.map(k => campos[k]), req.params.id]
  );
  if (!row) { res.status(404).json({ error: 'Usuário não encontrado' }); return; }
  invalidateUserCache(req.params.id);
  cacheDel('dash:');
  res.json(row);
  } catch (err: any) {
    console.error('PUT /usuarios/:id erro:', err.message);
    res.status(500).json({ error: 'Erro interno ao atualizar usuário' });
  }
});

// PATCH /api/usuarios/:id/bloquear
router.patch('/:id/bloquear', requireMinRole('administrador'), async (req: AuthRequest, res: Response) => {
  try {
  const { bloqueado, motivo } = req.body;
  const targetId = req.params.id;

  // Verify target belongs to caller's hierarchy
  const caller = req.user!;
  if (caller.role !== 'master') {
    const target = await queryOne<any>('SELECT administrador_id, role FROM usuarios WHERE id = $1', [targetId]);
    if (!target) { res.status(404).json({ error: 'Usuário não encontrado' }); return; }
    const isOwner = target.administrador_id === caller.id;
    const isOrphan = target.administrador_id === null && target.role === 'funcionario';
    if (!isOwner && !isOrphan) {
      res.status(403).json({ error: 'Sem permissão para este usuário' });
      return;
    }
  }

  const row = await withTransaction(async (client) => {
    // 1. Block/unblock the target user
    const { rows } = await client.query(
      'UPDATE usuarios SET bloqueado = $1, motivo_bloqueio = $2 WHERE id = $3 RETURNING id, bloqueado, role',
      [bloqueado, motivo || null, targetId]
    );
    if (!rows[0]) return null;
    const target = rows[0];

    // 2. If target is administrador, cascade to all hierarchical users + QR codes
    if (target.role === 'administrador') {
      await client.query(
        'UPDATE usuarios SET bloqueado = $1, motivo_bloqueio = $2 WHERE administrador_id = $3',
        [bloqueado, bloqueado ? (motivo || 'Administrador bloqueado') : null, targetId]
      );
      await client.query(
        `UPDATE usuarios SET bloqueado = $1, motivo_bloqueio = $2
         WHERE supervisor_id IN (SELECT id FROM usuarios WHERE administrador_id = $3 AND role = 'supervisor')`,
        [bloqueado, bloqueado ? (motivo || 'Administrador bloqueado') : null, targetId]
      );
      await client.query(
        `UPDATE qrcodes SET ativo = $1
         WHERE condominio_id IN (SELECT id FROM condominios WHERE criado_por = $2)`,
        [!bloqueado, targetId]
      );
      await client.query(
        `UPDATE qrcodes SET ativo = $1
         WHERE criado_por = $2
            OR criado_por IN (SELECT id FROM usuarios WHERE administrador_id = $2)
            OR criado_por IN (
              SELECT id FROM usuarios WHERE supervisor_id IN (
                SELECT id FROM usuarios WHERE administrador_id = $2 AND role = 'supervisor'
              )
            )`,
        [!bloqueado, targetId]
      );
    }

    // 3. If target is supervisor, cascade to funcionários under them + their QR codes
    if (target.role === 'supervisor') {
      await client.query(
        'UPDATE usuarios SET bloqueado = $1, motivo_bloqueio = $2 WHERE supervisor_id = $3',
        [bloqueado, bloqueado ? (motivo || 'Supervisor bloqueado') : null, targetId]
      );
      await client.query(
        `UPDATE qrcodes SET ativo = $1
         WHERE criado_por = $2 OR criado_por IN (SELECT id FROM usuarios WHERE supervisor_id = $2)`,
        [!bloqueado, targetId]
      );
    }

    return target;
  });

  if (!row) { res.status(404).json({ error: 'Usuário não encontrado' }); return; }
  // Invalidate all caches — blocking cascades to sub-users
  invalidateUserCache(req.params.id);
  cacheDel('auth:');
  cacheDel('scope:');
  cacheDel('dash:');
  res.json(row);
  } catch (err: any) {
    console.error('PATCH /usuarios/:id/bloquear erro:', err.message);
    res.status(500).json({ error: 'Erro interno ao bloquear/desbloquear usuário' });
  }
});

// PATCH /api/usuarios/:id/reset-senha
router.patch('/:id/reset-senha', requireMinRole('administrador'), async (req: AuthRequest, res: Response) => {
  try {
  const { novaSenha } = req.body;
  if (!novaSenha || novaSenha.length < 6) {
    res.status(400).json({ error: 'A nova senha deve ter no mínimo 6 caracteres' });
    return;
  }
  // Verify target belongs to caller's hierarchy
  const caller = req.user!;
  if (caller.role !== 'master') {
    const target = await queryOne<any>('SELECT administrador_id FROM usuarios WHERE id = $1', [req.params.id]);
    if (!target || target.administrador_id !== caller.id) {
      res.status(403).json({ error: 'Sem permissão para este usuário' });
      return;
    }
  }
  const hash = await bcrypt.hash(novaSenha, 12);
  await execute('UPDATE usuarios SET senha_hash = $1 WHERE id = $2', [hash, req.params.id]);
  invalidateUserCache(req.params.id);
  res.json({ ok: true });
  } catch (err: any) {
    console.error('PATCH /usuarios/:id/reset-senha erro:', err.message);
    res.status(500).json({ error: 'Erro interno ao resetar senha' });
  }
});

// DELETE /api/usuarios/:id
router.delete('/:id', requireMinRole('administrador'), async (req: AuthRequest, res: Response) => {
  try {
  const caller = req.user!;
  if (caller.role !== 'master') {
    const target = await queryOne<any>('SELECT administrador_id, role FROM usuarios WHERE id = $1', [req.params.id]);
    if (!target) { res.status(404).json({ error: 'Usuário não encontrado' }); return; }
    const isOwner = target.administrador_id === caller.id;
    const isOrphan = target.administrador_id === null && target.role === 'funcionario';
    if (!isOwner && !isOrphan) {
      res.status(403).json({ error: 'Sem permissão para este usuário' });
      return;
    }
  }
  await execute('UPDATE usuarios SET ativo = false WHERE id = $1', [req.params.id]);
  invalidateUserCache(req.params.id);
  cacheDel('dash:');
  res.json({ ok: true });
  } catch (err: any) {
    console.error('DELETE /usuarios/:id erro:', err.message);
    res.status(500).json({ error: 'Erro interno ao excluir usuário' });
  }
});

export default router;
