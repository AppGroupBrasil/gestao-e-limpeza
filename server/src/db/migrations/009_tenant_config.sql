-- ════════════════════════════════════════════
-- 009: Isolamento por tenant das configurações + segurança de sessão
-- ════════════════════════════════════════════

ALTER TABLE tema_config ALTER COLUMN id TYPE VARCHAR(64);

ALTER TABLE quadro_permissoes ALTER COLUMN id TYPE VARCHAR(64);

ALTER TABLE vencimentos_emails ALTER COLUMN id TYPE VARCHAR(64);

ALTER TABLE permissoes_funcoes ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(64) NOT NULL DEFAULT 'global';

ALTER TABLE permissoes_funcoes DROP CONSTRAINT IF EXISTS permissoes_funcoes_pkey;

ALTER TABLE permissoes_funcoes ADD PRIMARY KEY (tenant_id, id);

ALTER TABLE configuracoes_gerais ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(64) NOT NULL DEFAULT 'global';

ALTER TABLE configuracoes_gerais DROP CONSTRAINT IF EXISTS configuracoes_gerais_pkey;

ALTER TABLE configuracoes_gerais ADD PRIMARY KEY (tenant_id, chave);

-- Invalidação de tokens JWT emitidos antes da última troca de senha/bloqueio.
-- Contas existentes recebem a data de criação para não derrubar sessões válidas no deploy.
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS senha_alterada_em TIMESTAMPTZ;

UPDATE usuarios SET senha_alterada_em = COALESCE(criado_em, NOW() - INTERVAL '30 days') WHERE senha_alterada_em IS NULL;

ALTER TABLE usuarios ALTER COLUMN senha_alterada_em SET DEFAULT NOW();

ALTER TABLE usuarios ALTER COLUMN senha_alterada_em SET NOT NULL;

-- A coluna token passa a guardar somente o hash SHA-256; tokens antigos em texto puro perdem validade
UPDATE reset_tokens SET used = true WHERE used = false;
