import { Router, Response } from 'express';
import rateLimit from 'express-rate-limit';
import bcrypt from 'bcrypt';
import crypto from 'node:crypto';

const loginLimiter = rateLimit({
  windowMs: 15 * 60_000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: { error: 'Muitas tentativas de login. Aguarde 15 minutos.' },
});
const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60_000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Muitas solicitações. Aguarde 1 hora.' },
});
const selfRegisterLimiter = rateLimit({
  windowMs: 60 * 60_000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Muitas tentativas de cadastro. Aguarde 1 hora.' },
});
import { query, queryOne } from '../db/database.js';
import { generateToken, AuthRequest, authMiddleware } from '../middleware/auth.js';
import { checkRateLimit, recordLoginAttempt, auditLog, createNotification } from '../middleware/helpers.js';
import { isMailerConfigured, sendMail } from '../services/mailer.js';

const router = Router();

function buildSelfRegisterHtml(nome: string, email: string): string {
  return `
    <div style="font-family:Arial,sans-serif;background:#f5f7fa;padding:24px;color:#1f2937;">
      <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:16px;padding:32px;border:1px solid #e5e7eb;">
        <h1 style="margin:0 0 16px;font-size:24px;color:#111827;">Novo auto-cadastro</h1>
        <p style="margin:0 0 12px;font-size:16px;line-height:1.5;color:#374151;">
          Um novo administrador se cadastrou na plataforma <strong>Gestão e Limpeza</strong>.
        </p>
        <table style="width:100%;border-collapse:collapse;margin:16px 0;">
          <tr><td style="padding:8px 12px;font-weight:bold;color:#6b7280;">Nome</td><td style="padding:8px 12px;">${nome}</td></tr>
          <tr style="background:#f9fafb;"><td style="padding:8px 12px;font-weight:bold;color:#6b7280;">E-mail</td><td style="padding:8px 12px;">${email}</td></tr>
          <tr><td style="padding:8px 12px;font-weight:bold;color:#6b7280;">Perfil</td><td style="padding:8px 12px;">Administrador</td></tr>
        </table>
        <p style="margin:16px 0 0;font-size:13px;color:#9ca3af;">Este é um e-mail automático do sistema Gestão e Limpeza.</p>
      </div>
    </div>`;
}

function buildResetPasswordHtml(nome: string, resetUrl: string): string {
  return `
    <div style="font-family:Arial,sans-serif;background:#f5f7fa;padding:24px;color:#1f2937;">
      <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:16px;padding:32px;border:1px solid #e5e7eb;">
        <h1 style="margin:0 0 16px;font-size:24px;color:#111827;">Redefinição de senha</h1>
        <p style="margin:0 0 12px;line-height:1.6;">Olá, ${nome || 'usuário'}.</p>
        <p style="margin:0 0 20px;line-height:1.6;">Recebemos uma solicitação para redefinir a senha da sua conta no Gestão e Limpeza.</p>
        <a href="${resetUrl}" style="display:inline-block;background:#f57c00;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:10px;font-weight:700;">Redefinir senha</a>
        <p style="margin:20px 0 0;line-height:1.6;">Se o botão não funcionar, copie e cole este link no navegador:</p>
        <p style="margin:8px 0 0;word-break:break-all;color:#2563eb;">${resetUrl}</p>
        <p style="margin:20px 0 0;line-height:1.6;color:#6b7280;">Este link expira em 1 hora.</p>
      </div>
    </div>
  `;
}

function buildLoginFailMsg(remaining: number): string {
  const r = remaining - 1;
  if (r <= 0) return 'E-mail ou senha inválidos.';
  const s = r === 1 ? '' : 's';
  return `E-mail ou senha inválidos. Você ainda tem ${r} tentativa${s}.`;
}

function resolveAdminId(caller: { role: string; id: string; administrador_id?: string | null }): string | null {
  if (caller.role === 'master') return null;
  if (caller.role === 'administrador') return caller.id;
  return caller.administrador_id ?? null;
}

// POST /api/auth/login
router.post('/login', loginLimiter, async (req, res: Response) => {
  try {
    const { email, senha } = req.body;
    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || '';

    if (!email || !senha) {
      res.status(400).json({ error: 'Email e senha obrigatórios' });
      return;
    }

    const user = await queryOne<any>(
      'SELECT * FROM usuarios WHERE email = $1',
      [email]
    );

    // Rate limiting (aplicado a todos os usuários)
    const { blocked, remaining } = await checkRateLimit(email, ip);
    if (blocked) {
      console.warn(`[LOGIN BLOCKED] email=${email} ip=${ip} - rate limited`);
      res.status(429).json({ error: 'Muitas tentativas de login. Tente novamente em 15 minutos.', retryAfter: 15 });
      return;
    }

    const isMaster = user?.role === 'master';

    if (!user) {
      await recordLoginAttempt(email, ip, false);
      console.warn(`[LOGIN FAIL] email=${email} ip=${ip} - user not found`);
      res.status(401).json({ error: buildLoginFailMsg(remaining), remaining: remaining - 1 });
      return;
    }
    // Block check (skip for master)
    if (!isMaster && (!user.ativo || user.bloqueado)) {
      console.warn(`[LOGIN FAIL] email=${email} ip=${ip} - account inactive/blocked (ativo=${user.ativo}, bloqueado=${user.bloqueado})`);
      res.status(403).json({ error: 'Conta desativada ou bloqueada', motivo: user.motivo_bloqueio });
      return;
    }

    const validPassword = await bcrypt.compare(senha, user.senha_hash);
    if (!validPassword) {
      await recordLoginAttempt(email, ip, false);
      console.warn(`[LOGIN FAIL] email=${email} ip=${ip} - wrong password`);
      res.status(401).json({ error: buildLoginFailMsg(remaining), remaining: remaining - 1 });
      return;
    }

    await recordLoginAttempt(email, ip, true);
    await auditLog({ id: user.id, nome: user.nome, role: user.role } as any, 'login', 'usuarios', user.id, {}, ip);
    console.log(`[LOGIN OK] email=${email} role=${user.role} ip=${ip}`);

    const token = generateToken({ userId: user.id, email: user.email, role: user.role });

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        nome: user.nome,
        role: user.role,
        administradorId: user.administrador_id,
        supervisorId: user.supervisor_id,
        condominioId: user.condominio_id,
        avatarUrl: user.avatar_url,
      },
    });
  } catch (err: any) {
    console.error('[LOGIN ERROR]', err);
    res.status(500).json({ error: 'Erro interno no login' });
  }
});

// POST /api/auth/register (only admin+ can create users)
router.post('/register', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const caller = req.user!;
    const { email, senha, nome, role, condominioId, supervisorId } = req.body;

    if (!email || !senha || !nome || !role) {
      res.status(400).json({ error: 'email, senha, nome e role são obrigatórios' });
      return;
    }

    // Validar hierarquia
    const roleLevel: Record<string, number> = { master: 4, administrador: 3, supervisor: 2, funcionario: 1 };
    if ((roleLevel[role] ?? 0) >= (roleLevel[caller.role] ?? 0)) {
      res.status(403).json({ error: 'Não pode criar usuário com role igual ou superior' });
      return;
    }

    const exists = await queryOne<any>('SELECT id, ativo FROM usuarios WHERE email = $1', [email]);
    if (exists?.ativo) {
      res.status(409).json({ error: 'Este e-mail já está em uso por outro usuário ativo' });
      return;
    }

    const senhaHash = await bcrypt.hash(senha, 12);

    const adminId = resolveAdminId(caller);

    const supId = role === 'funcionario' ? (supervisorId || caller.id) : null;

    let user: any;
    if (exists && !exists.ativo) {
      user = await queryOne<any>(
        `UPDATE usuarios SET senha_hash=$1, nome=$2, role=$3, criado_por=$4, administrador_id=$5, supervisor_id=$6, condominio_id=$7, ativo=true, bloqueado=false, motivo_bloqueio=NULL
         WHERE id=$8 RETURNING *`,
        [senhaHash, nome, role, caller.id, adminId, supId, condominioId || null, exists.id]
      );
    } else {
      user = await queryOne<any>(
        `INSERT INTO usuarios (email, senha_hash, nome, role, criado_por, administrador_id, supervisor_id, condominio_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
        [email, senhaHash, nome, role, caller.id, adminId, supId, condominioId || null]
      );
    }

    res.status(201).json({
      id: user!.id,
      email: user!.email,
      nome: user!.nome,
      role: user!.role,
    });
  } catch (err: any) {
    console.error('[REGISTER ERROR]', err);
    res.status(500).json({ error: 'Erro interno ao registrar usuário' });
  }
});

// GET /api/auth/me
router.get('/me', authMiddleware, async (req: AuthRequest, res: Response) => {
  const u = req.user!;
  res.json({
    id: u.id,
    email: u.email,
    nome: u.nome,
    role: u.role,
    administradorId: u.administrador_id,
    supervisorId: u.supervisor_id,
    condominioId: u.condominio_id,
    ativo: u.ativo,
    bloqueado: u.bloqueado,
  });
});

// POST /api/auth/change-password
router.post('/change-password', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { senhaAtual, novaSenha } = req.body;
    const user = await queryOne<any>('SELECT senha_hash FROM usuarios WHERE id = $1', [req.user!.id]);

    const valid = await bcrypt.compare(senhaAtual, user!.senha_hash);
    if (!valid) {
      res.status(400).json({ error: 'Senha atual incorreta' });
      return;
    }

    const hash = await bcrypt.hash(novaSenha, 12);
    await query('UPDATE usuarios SET senha_hash = $1 WHERE id = $2', [hash, req.user!.id]);
    res.json({ ok: true });
  } catch (err: any) {
    console.error('[CHANGE-PASSWORD ERROR]', err.message);
    res.status(500).json({ error: 'Erro ao alterar senha' });
  }
});

// POST /api/auth/self-register (public — creates 'administrador' account)
router.post('/self-register', selfRegisterLimiter, async (req, res: Response) => {
  try {
    const { email, senha, nome, telefone } = req.body;

    if (!email || !senha || !nome) {
      res.status(400).json({ error: 'Email, senha e nome são obrigatórios' });
      return;
    }
    if (senha.length < 6) {
      res.status(400).json({ error: 'A senha deve ter no mínimo 6 caracteres' });
      return;
    }

    const exists = await queryOne('SELECT id FROM usuarios WHERE email = $1', [email]);
    if (exists) {
      res.status(409).json({ error: 'Este e-mail já está cadastrado' });
      return;
    }

    const senhaHash = await bcrypt.hash(senha, 12);

    const user = await queryOne<any>(
      `INSERT INTO usuarios (email, senha_hash, nome, role, telefone, ativo)
       VALUES ($1, $2, $3, 'administrador', $4, true) RETURNING id, email, nome, role`,
      [email, senhaHash, nome, telefone || null]
    );

    // Notify all masters about the new registration
    try {
      const masters = await query<any>('SELECT id, email FROM usuarios WHERE role = $1 AND ativo = true', ['master']);
      for (const m of masters) {
        await createNotification(
          m.id,
          'Novo cadastro',
          `${nome} (${email}) se cadastrou na plataforma.`,
          'info',
          '/usuarios'
        );
        // Send email notification to master
        if (isMailerConfigured()) {
          await sendMail({
            to: m.email,
            subject: `Novo auto-cadastro: ${nome}`,
            html: buildSelfRegisterHtml(nome, email),
          });
        }
      }
      await auditLog(null, 'self_register', 'usuarios', user!.id, { email, nome });
    } catch (notifErr) {
      console.error('[SELF-REGISTER] notification/audit error (non-fatal):', notifErr);
    }

    res.status(201).json({
      message: 'Conta criada com sucesso! Você já pode fazer login.',
      user: { id: user!.id, email: user!.email, nome: user!.nome },
    });
  } catch (err: any) {
    console.error('[SELF-REGISTER ERROR]', err);
    res.status(500).json({ error: 'Erro interno ao criar conta' });
  }
});

// POST /api/auth/forgot-password (public — generates reset token)
router.post('/forgot-password', passwordResetLimiter, async (req, res: Response) => {
  try {
    const { email } = req.body;

    if (!email) {
      res.status(400).json({ error: 'Informe o e-mail' });
      return;
    }

    // Always return success to avoid email enumeration
    const user = await queryOne<any>('SELECT id, nome, email FROM usuarios WHERE email = $1', [email]);

    if (user && isMailerConfigured()) {
      const token = crypto.randomBytes(32).toString('hex');
      const expiry = new Date(Date.now() + 3600000); // 1 hour
      const frontendUrl = process.env.FRONTEND_URL || process.env.CORS_ORIGIN || 'http://localhost:3000';
      const resetUrl = `${frontendUrl.replace(/\/$/, '')}/esqueci-senha?token=${token}`;

      // Invalidate previous tokens for this user
      await query('UPDATE reset_tokens SET used = true WHERE user_id = $1 AND used = false', [user.id]);

      await query(
        'INSERT INTO reset_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)',
        [user.id, token, expiry]
      );

      await sendMail({
        to: user.email,
        subject: 'Redefinição de senha - Gestão e Limpeza',
        html: buildResetPasswordHtml(user.nome, resetUrl),
      });
    }

    res.json({ message: 'Se o e-mail estiver cadastrado, você receberá instruções para redefinir sua senha.' });
  } catch (err: any) {
    console.error('[FORGOT-PASSWORD ERROR]', err.message);
    res.status(500).json({ error: 'Erro ao processar solicitação' });
  }
});

// POST /api/auth/reset-password (public — resets password with token)
router.post('/reset-password', passwordResetLimiter, async (req, res: Response) => {
  try {
    const { token, novaSenha } = req.body;

    if (!token || !novaSenha) {
      res.status(400).json({ error: 'Token e nova senha são obrigatórios' });
      return;
    }
    if (novaSenha.length < 6) {
      res.status(400).json({ error: 'A senha deve ter no mínimo 6 caracteres' });
      return;
    }

    // Atomic: mark token as used and return user_id in one query (prevents race condition)
    const record = await queryOne<any>(
      `UPDATE reset_tokens SET used = true
       WHERE token = $1 AND used = false AND expires_at > NOW()
       RETURNING user_id`,
      [token]
    );

    if (!record) {
      res.status(400).json({ error: 'Token inválido ou expirado' });
      return;
    }

    const hash = await bcrypt.hash(novaSenha, 12);
    await query('UPDATE usuarios SET senha_hash = $1 WHERE id = $2', [hash, record.user_id]);

    res.json({ message: 'Senha redefinida com sucesso! Você já pode fazer login.' });
  } catch (err: any) {
    console.error('[RESET-PASSWORD ERROR]', err.message);
    res.status(500).json({ error: 'Erro ao redefinir senha' });
  }
});

export default router;
