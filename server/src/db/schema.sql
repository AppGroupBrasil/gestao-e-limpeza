-- ╔══════════════════════════════════════════════════════════════╗
-- ║  SCHEMA: Gestão e Limpeza — PostgreSQL                      ║
-- ╚══════════════════════════════════════════════════════════════╝

-- Extensões
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ════════════════════════════════════════════
-- ENUM TYPES
-- ════════════════════════════════════════════

CREATE TYPE user_role AS ENUM ('master', 'administrador', 'supervisor', 'funcionario');
CREATE TYPE status_os AS ENUM ('aberta', 'em_andamento', 'concluida', 'cancelada', 'aguardando');
CREATE TYPE tipo_os AS ENUM ('limpeza', 'manutencao', 'emergencia', 'preventiva');
CREATE TYPE prioridade AS ENUM ('baixa', 'media', 'alta', 'urgente');
CREATE TYPE tipo_checklist AS ENUM ('diaria', 'semanal', 'mensal', 'especial');
CREATE TYPE status_checklist AS ENUM ('pendente', 'em_andamento', 'concluido');
CREATE TYPE tipo_movimentacao AS ENUM ('entrada', 'saida');
CREATE TYPE tipo_inspecao AS ENUM ('areas_comuns', 'elevadores', 'piscina', 'garagem', 'jardim', 'fachada');
CREATE TYPE status_inspecao AS ENUM ('conforme', 'nao_conforme', 'pendente');
CREATE TYPE status_reporte AS ENUM ('aberto', 'em_analise', 'resolvido');
CREATE TYPE recorrencia AS ENUM ('diaria', 'semanal', 'mensal', 'unica');
CREATE TYPE status_kanban AS ENUM ('a_fazer', 'em_andamento', 'em_revisao', 'concluido');
CREATE TYPE rotina_kanban AS ENUM ('diaria', 'semanal', 'mensal', 'anual', 'data_especifica');
CREATE TYPE tipo_vistoria AS ENUM ('rotina', 'preventiva');
CREATE TYPE tipo_comunicado AS ENUM ('comunicado', 'aviso');
CREATE TYPE perfil_morador AS ENUM ('Proprietário', 'Inquilino');
CREATE TYPE tipo_ponto AS ENUM ('entrada', 'saida');
CREATE TYPE status_sla AS ENUM ('aberto', 'em_atendimento', 'resolvido');

-- ════════════════════════════════════════════
-- TABELA: usuarios
-- ════════════════════════════════════════════

CREATE TABLE usuarios (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) UNIQUE NOT NULL,
  senha_hash VARCHAR(255) NOT NULL,
  nome VARCHAR(255) NOT NULL,
  role user_role NOT NULL DEFAULT 'funcionario',
  ativo BOOLEAN NOT NULL DEFAULT true,
  bloqueado BOOLEAN NOT NULL DEFAULT false,
  motivo_bloqueio TEXT,
  criado_por UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  administrador_id UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  supervisor_id UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  condominio_id UUID,
  avatar_url TEXT,
  telefone VARCHAR(20),
  cargo VARCHAR(100),
  senha_alterada_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_usuarios_email ON usuarios(email);
CREATE INDEX idx_usuarios_role ON usuarios(role);
CREATE INDEX idx_usuarios_admin ON usuarios(administrador_id);
CREATE INDEX idx_usuarios_supervisor ON usuarios(supervisor_id);
CREATE INDEX idx_usuarios_condominio ON usuarios(condominio_id);

-- ════════════════════════════════════════════
-- TABELA: condominios
-- ════════════════════════════════════════════

CREATE TABLE condominios (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nome VARCHAR(255) NOT NULL,
  endereco TEXT,
  cidade VARCHAR(100),
  estado VARCHAR(2),
  cep VARCHAR(10),
  sindico VARCHAR(255),
  telefone VARCHAR(20),
  email VARCHAR(255),
  logo_url TEXT,
  login_titulo VARCHAR(255),
  login_subtitulo VARCHAR(255),
  relatorio_responsavel_nome VARCHAR(255),
  relatorio_responsavel_cargo VARCHAR(255),
  relatorio_responsavel_registro VARCHAR(100),
  relatorio_telefone VARCHAR(20),
  relatorio_email VARCHAR(255),
  relatorio_documento VARCHAR(100),
  relatorio_observacoes TEXT,
  blocos INT DEFAULT 0,
  unidades INT DEFAULT 0,
  plano VARCHAR(20) DEFAULT 'teste',
  status_plano VARCHAR(20) DEFAULT 'teste',
  data_inicio_teste TIMESTAMPTZ DEFAULT NOW(),
  data_fim_teste TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '15 days'),
  valor_mensalidade DECIMAL(10,2) DEFAULT 0,
  criado_por UUID NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ativo BOOLEAN NOT NULL DEFAULT true
);

ALTER TABLE usuarios ADD CONSTRAINT fk_usuario_condominio FOREIGN KEY (condominio_id) REFERENCES condominios(id) ON DELETE SET NULL;
CREATE INDEX idx_condominios_criado_por ON condominios(criado_por);

-- ════════════════════════════════════════════
-- TABELA: ordens_servico
-- ════════════════════════════════════════════

CREATE TABLE ordens_servico (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  protocolo VARCHAR(20) UNIQUE NOT NULL,
  condominio_id UUID NOT NULL REFERENCES condominios(id) ON DELETE CASCADE,
  titulo VARCHAR(255) NOT NULL,
  descricao TEXT,
  tipo tipo_os NOT NULL DEFAULT 'limpeza',
  prioridade prioridade NOT NULL DEFAULT 'media',
  status status_os NOT NULL DEFAULT 'aberta',
  local VARCHAR(255),
  responsavel_id UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  supervisor_id UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  fotos TEXT[] DEFAULT '{}',
  observacoes TEXT,
  data_abertura TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  data_previsao TIMESTAMPTZ,
  data_conclusao TIMESTAMPTZ,
  criado_por UUID NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
  avaliacao_nota INT CHECK (avaliacao_nota >= 1 AND avaliacao_nota <= 5),
  avaliacao_comentario TEXT
);

CREATE INDEX idx_os_condominio ON ordens_servico(condominio_id);
CREATE INDEX idx_os_status ON ordens_servico(status);
CREATE INDEX idx_os_responsavel ON ordens_servico(responsavel_id);

-- ════════════════════════════════════════════
-- TABELA: checklists
-- ════════════════════════════════════════════

CREATE TABLE checklists (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  condominio_id UUID NOT NULL REFERENCES condominios(id) ON DELETE CASCADE,
  local VARCHAR(255) NOT NULL,
  tipo tipo_checklist NOT NULL DEFAULT 'diaria',
  itens JSONB NOT NULL DEFAULT '[]',
  responsavel_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
  supervisor_id UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  data DATE NOT NULL DEFAULT CURRENT_DATE,
  hora_inicio TIMESTAMPTZ,
  hora_fim TIMESTAMPTZ,
  status status_checklist NOT NULL DEFAULT 'pendente',
  assinatura TEXT,
  criado_por UUID NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_checklists_condominio ON checklists(condominio_id);
CREATE INDEX idx_checklists_responsavel ON checklists(responsavel_id);

-- ════════════════════════════════════════════
-- TABELA: tarefas_agendadas
-- ════════════════════════════════════════════

CREATE TABLE tarefas_agendadas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  titulo VARCHAR(255) NOT NULL,
  descricao TEXT,
  funcionario_id UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  funcionario_nome VARCHAR(255),
  condominio_id UUID NOT NULL REFERENCES condominios(id) ON DELETE CASCADE,
  bloco VARCHAR(50),
  local VARCHAR(255),
  recorrencia recorrencia NOT NULL DEFAULT 'unica',
  dias_semana INT[] DEFAULT '{}',
  data_especifica DATE,
  dia_mes INT,
  criado_por UUID NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  prioridade prioridade NOT NULL DEFAULT 'media'
);

CREATE INDEX idx_tarefas_condominio ON tarefas_agendadas(condominio_id);
CREATE INDEX idx_tarefas_funcionario ON tarefas_agendadas(funcionario_id);

-- ════════════════════════════════════════════
-- TABELA: tarefas_execucoes
-- ════════════════════════════════════════════

CREATE TABLE tarefas_execucoes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tarefa_id UUID NOT NULL REFERENCES tarefas_agendadas(id) ON DELETE CASCADE,
  funcionario_id UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  funcionario_nome VARCHAR(255),
  status VARCHAR(20) NOT NULL DEFAULT 'pendente',
  fotos TEXT[] DEFAULT '{}',
  observacao TEXT,
  data_execucao DATE NOT NULL DEFAULT CURRENT_DATE,
  hora_execucao TIME,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  audio_url TEXT
);

CREATE INDEX idx_exec_tarefa ON tarefas_execucoes(tarefa_id);

-- ════════════════════════════════════════════
-- TABELA: escalas
-- ════════════════════════════════════════════

CREATE TABLE escalas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  condominio_id UUID NOT NULL REFERENCES condominios(id) ON DELETE CASCADE,
  funcionario_id UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  funcionario_nome VARCHAR(255),
  dia_semana INT NOT NULL CHECK (dia_semana >= 0 AND dia_semana <= 6),
  hora_inicio VARCHAR(5) NOT NULL,
  hora_fim VARCHAR(5) NOT NULL,
  local VARCHAR(255),
  funcao VARCHAR(255),
  observacoes TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true
);

CREATE INDEX idx_escalas_condominio ON escalas(condominio_id);

-- ════════════════════════════════════════════
-- TABELA: materiais
-- ════════════════════════════════════════════

CREATE TABLE materiais (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  protocolo VARCHAR(20) UNIQUE NOT NULL,
  nome VARCHAR(255) NOT NULL,
  categoria VARCHAR(100),
  unidade VARCHAR(20) NOT NULL DEFAULT 'un',
  quantidade INT NOT NULL DEFAULT 0,
  quantidade_minima INT NOT NULL DEFAULT 0,
  custo_unitario DECIMAL(10,2) DEFAULT 0,
  email_notificacao VARCHAR(255),
  condominio_id UUID NOT NULL REFERENCES condominios(id) ON DELETE CASCADE
);

CREATE INDEX idx_materiais_condominio ON materiais(condominio_id);

-- ════════════════════════════════════════════
-- TABELA: materiais_movimentacoes
-- ════════════════════════════════════════════

CREATE TABLE materiais_movimentacoes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  material_id UUID NOT NULL REFERENCES materiais(id) ON DELETE CASCADE,
  tipo tipo_movimentacao NOT NULL,
  quantidade INT NOT NULL,
  observacao TEXT,
  fotos TEXT[] DEFAULT '{}',
  nota_fiscal_url TEXT,
  audio_url TEXT,
  funcionario_id UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  funcionario_nome VARCHAR(255),
  data TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_mov_material ON materiais_movimentacoes(material_id);

-- ════════════════════════════════════════════
-- TABELA: inspecoes
-- ════════════════════════════════════════════

CREATE TABLE inspecoes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  condominio_id UUID NOT NULL REFERENCES condominios(id) ON DELETE CASCADE,
  tipo tipo_inspecao NOT NULL,
  local VARCHAR(255),
  inspetor_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
  data TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status status_inspecao NOT NULL DEFAULT 'pendente',
  observacoes TEXT,
  fotos TEXT[] DEFAULT '{}',
  itens_verificados JSONB NOT NULL DEFAULT '[]',
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_inspecoes_condominio ON inspecoes(condominio_id);

-- ════════════════════════════════════════════
-- TABELA: vistorias
-- ════════════════════════════════════════════

CREATE TABLE vistorias (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  titulo VARCHAR(255) NOT NULL,
  condominio_id UUID NOT NULL REFERENCES condominios(id) ON DELETE CASCADE,
  tipo tipo_vistoria NOT NULL DEFAULT 'rotina',
  data DATE NOT NULL DEFAULT CURRENT_DATE,
  responsavel_id UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  responsavel_nome VARCHAR(255),
  status VARCHAR(50) NOT NULL DEFAULT 'pendente',
  itens JSONB NOT NULL DEFAULT '[]',
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_vistorias_condominio ON vistorias(condominio_id);

-- ════════════════════════════════════════════
-- TABELA: reportes
-- ════════════════════════════════════════════

CREATE TABLE reportes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  protocolo VARCHAR(20) UNIQUE NOT NULL,
  item_desc TEXT,
  checklist_id UUID REFERENCES checklists(id) ON DELETE SET NULL,
  vistoria_id UUID REFERENCES vistorias(id) ON DELETE SET NULL,
  descricao TEXT,
  status status_reporte NOT NULL DEFAULT 'aberto',
  prioridade prioridade NOT NULL DEFAULT 'media',
  imagens TEXT[] DEFAULT '{}',
  condominio_id UUID NOT NULL REFERENCES condominios(id) ON DELETE CASCADE,
  data TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  criado_por UUID REFERENCES usuarios(id) ON DELETE SET NULL
);

CREATE INDEX idx_reportes_condominio ON reportes(condominio_id);
CREATE INDEX idx_reportes_status ON reportes(status);

-- ════════════════════════════════════════════
-- TABELA: antes_depois
-- ════════════════════════════════════════════

CREATE TABLE antes_depois (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  checklist_id UUID REFERENCES checklists(id) ON DELETE CASCADE,
  item_id TEXT NOT NULL,
  item_desc TEXT,
  foto_antes TEXT,
  desc_antes TEXT,
  foto_depois TEXT,
  desc_depois TEXT,
  condominio_id UUID NOT NULL REFERENCES condominios(id) ON DELETE CASCADE,
  criado_por UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_antes_depois_condominio ON antes_depois(condominio_id);
CREATE INDEX idx_antes_depois_checklist ON antes_depois(checklist_id);

-- ════════════════════════════════════════════
-- TABELA: vencimentos
-- ════════════════════════════════════════════

CREATE TABLE vencimentos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  titulo VARCHAR(255) NOT NULL,
  tipo VARCHAR(100),
  descricao TEXT,
  condominio_id UUID NOT NULL REFERENCES condominios(id) ON DELETE CASCADE,
  data_vencimento DATE NOT NULL,
  data_ultima_manutencao DATE,
  data_proxima_manutencao DATE,
  emails TEXT[] DEFAULT '{}',
  avisos JSONB DEFAULT '[]',
  qtd_notificacoes INT DEFAULT 0,
  imagens TEXT[] DEFAULT '{}',
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_vencimentos_condominio ON vencimentos(condominio_id);
CREATE INDEX idx_vencimentos_data ON vencimentos(data_vencimento);

-- ════════════════════════════════════════════
-- TABELA: moradores
-- ════════════════════════════════════════════

CREATE TABLE moradores (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nome VARCHAR(255) NOT NULL,
  condominio_id UUID NOT NULL REFERENCES condominios(id) ON DELETE CASCADE,
  bloco VARCHAR(50),
  apartamento VARCHAR(20),
  whatsapp VARCHAR(20),
  email VARCHAR(255),
  perfil perfil_morador NOT NULL DEFAULT 'Proprietário',
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_moradores_condominio ON moradores(condominio_id);

-- ════════════════════════════════════════════
-- TABELA: comunicados
-- ════════════════════════════════════════════

CREATE TABLE comunicados (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tipo tipo_comunicado NOT NULL DEFAULT 'comunicado',
  titulo VARCHAR(255) NOT NULL,
  mensagem TEXT,
  destinatario_tipo VARCHAR(100),
  condominio_id UUID NOT NULL REFERENCES condominios(id) ON DELETE CASCADE,
  emails_enviados TEXT[] DEFAULT '{}',
  tracking JSONB DEFAULT '[]',
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  enviado_por UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  enviado_por_nome VARCHAR(255)
);

CREATE INDEX idx_comunicados_condominio ON comunicados(condominio_id);

-- ════════════════════════════════════════════
-- TABELA: quadro_atividades
-- ════════════════════════════════════════════

CREATE TABLE quadro_atividades (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  titulo VARCHAR(255) NOT NULL,
  descricao TEXT,
  status status_kanban NOT NULL DEFAULT 'a_fazer',
  prioridade prioridade NOT NULL DEFAULT 'media',
  rotina rotina_kanban NOT NULL DEFAULT 'diaria',
  data_especifica DATE,
  responsavel_id UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  responsavel_nome VARCHAR(255),
  condominio_id UUID NOT NULL REFERENCES condominios(id) ON DELETE CASCADE,
  criado_por UUID NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  historico JSONB DEFAULT '[]'
);

CREATE INDEX idx_quadro_condominio ON quadro_atividades(condominio_id);
CREATE INDEX idx_quadro_status ON quadro_atividades(status);

-- ════════════════════════════════════════════
-- TABELA: roteiros
-- ════════════════════════════════════════════

CREATE TABLE roteiros (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  titulo VARCHAR(255) NOT NULL,
  descricao TEXT,
  categoria VARCHAR(100),
  capa TEXT,
  passos JSONB NOT NULL DEFAULT '[]',
  condominio_id UUID REFERENCES condominios(id) ON DELETE CASCADE,
  criado_por UUID NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ════════════════════════════════════════════
-- TABELA: roteiros_execucoes_log
-- ════════════════════════════════════════════

CREATE TABLE roteiros_execucoes_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  roteiro_id UUID NOT NULL REFERENCES roteiros(id) ON DELETE CASCADE,
  funcionario_id UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  funcionario_nome VARCHAR(255),
  data TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  passos_exec JSONB NOT NULL DEFAULT '[]'
);

CREATE INDEX idx_rot_exec_roteiro ON roteiros_execucoes_log(roteiro_id);

-- ════════════════════════════════════════════
-- TABELA: qrcodes
-- ════════════════════════════════════════════

CREATE TABLE qrcodes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nome VARCHAR(255) NOT NULL,
  descricao TEXT,
  logo TEXT,
  blocos JSONB NOT NULL DEFAULT '[]',
  dispensar_identificacao BOOLEAN DEFAULT false,
  blocos_cadastrados TEXT[] DEFAULT '{}',
  condominio_id UUID REFERENCES condominios(id) ON DELETE CASCADE,
  criado_por UUID NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  respostas INT DEFAULT 0,
  ativo BOOLEAN NOT NULL DEFAULT true
);

-- ════════════════════════════════════════════
-- TABELA: leituras_qrcode
-- ════════════════════════════════════════════

CREATE TABLE leituras_qrcode (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  qr_conteudo TEXT NOT NULL,
  funcionario_id UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  funcionario_nome VARCHAR(255),
  funcionario_email VARCHAR(255),
  funcionario_cargo VARCHAR(100),
  data_hora TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  endereco TEXT,
  identificacao JSONB,
  respostas_formulario JSONB
);

-- ════════════════════════════════════════════
-- TABELA: controle_ponto
-- ════════════════════════════════════════════

CREATE TABLE controle_ponto (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  funcionario_id UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  funcionario_nome VARCHAR(255),
  funcionario_email VARCHAR(255),
  funcionario_cargo VARCHAR(100),
  tipo tipo_ponto NOT NULL,
  data_hora TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  endereco TEXT,
  permanencia VARCHAR(50)
);

CREATE INDEX idx_ponto_funcionario ON controle_ponto(funcionario_id);

-- ════════════════════════════════════════════
-- TABELA: geolocalizacao
-- ════════════════════════════════════════════

CREATE TABLE geolocalizacao (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  endereco TEXT,
  hora_chegada TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  hora_saida TIMESTAMPTZ,
  tempo_total INT,
  data DATE NOT NULL DEFAULT CURRENT_DATE,
  funcao_id VARCHAR(100)
);

CREATE INDEX idx_geo_user ON geolocalizacao(user_id);

-- ════════════════════════════════════════════
-- TABELA: audit_logs
-- ════════════════════════════════════════════

CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  user_nome VARCHAR(255),
  user_role VARCHAR(20),
  acao VARCHAR(100) NOT NULL,
  entidade VARCHAR(100),
  entidade_id UUID,
  detalhes JSONB DEFAULT '{}',
  ip VARCHAR(45),
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_audit_user ON audit_logs(user_id);
CREATE INDEX idx_audit_acao ON audit_logs(acao);
CREATE INDEX idx_audit_data ON audit_logs(criado_em);

-- ════════════════════════════════════════════
-- TABELA: notificacoes
-- ════════════════════════════════════════════

CREATE TABLE notificacoes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  titulo VARCHAR(255) NOT NULL,
  mensagem TEXT,
  tipo VARCHAR(50) NOT NULL DEFAULT 'info',
  lida BOOLEAN NOT NULL DEFAULT false,
  link VARCHAR(255),
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_notif_user ON notificacoes(user_id);
CREATE INDEX idx_notif_lida ON notificacoes(user_id, lida);

-- ════════════════════════════════════════════
-- TABELA: metricas_uso
-- ════════════════════════════════════════════

CREATE TABLE metricas_uso (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  condominio_id UUID REFERENCES condominios(id) ON DELETE CASCADE,
  user_id UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  acao VARCHAR(100) NOT NULL,
  data DATE NOT NULL DEFAULT CURRENT_DATE,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_metricas_cond ON metricas_uso(condominio_id);
CREATE INDEX idx_metricas_data ON metricas_uso(data);

-- ════════════════════════════════════════════
-- TABELA: login_attempts
-- ════════════════════════════════════════════

CREATE TABLE login_attempts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) NOT NULL,
  ip VARCHAR(45),
  sucesso BOOLEAN NOT NULL DEFAULT false,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_login_email ON login_attempts(email, criado_em);
CREATE INDEX idx_login_ip ON login_attempts(ip, criado_em);
CREATE INDEX idx_geo_data ON geolocalizacao(data);

-- ════════════════════════════════════════════
-- TABELA: sla_registros
-- ════════════════════════════════════════════

CREATE TABLE sla_registros (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  bloco_id VARCHAR(100),
  categoria VARCHAR(100),
  descricao TEXT,
  abertura TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  inicio_atendimento TIMESTAMPTZ,
  encerramento TIMESTAMPTZ,
  status status_sla NOT NULL DEFAULT 'aberto',
  condominio_id UUID REFERENCES condominios(id) ON DELETE CASCADE,
  criado_por UUID REFERENCES usuarios(id) ON DELETE SET NULL
);

-- ════════════════════════════════════════════
-- TABELA: whats_contatos
-- ════════════════════════════════════════════

CREATE TABLE whats_contatos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nome VARCHAR(255) NOT NULL,
  telefone VARCHAR(20) NOT NULL,
  condominio_id UUID REFERENCES condominios(id) ON DELETE CASCADE
);

-- ════════════════════════════════════════════
-- TABELA: permissoes_funcoes
-- ════════════════════════════════════════════

CREATE TABLE permissoes_funcoes (
  tenant_id VARCHAR(64) NOT NULL DEFAULT 'global',
  id VARCHAR(100) NOT NULL,
  nome VARCHAR(255) NOT NULL,
  ativa BOOLEAN NOT NULL DEFAULT true,
  perfis JSONB NOT NULL DEFAULT '{"master":true,"administrador":true,"supervisor":true,"funcionario":false}',
  PRIMARY KEY (tenant_id, id)
);

-- ════════════════════════════════════════════
-- TABELA: tema_config
-- ════════════════════════════════════════════

CREATE TABLE tema_config (
  id VARCHAR(64) PRIMARY KEY DEFAULT 'global',
  cor_primaria VARCHAR(7) DEFAULT '#1a73e8',
  cor_secundaria VARCHAR(7) DEFAULT '#1557b0',
  cor_menu VARCHAR(7) DEFAULT '#1a1a2e',
  cor_botao VARCHAR(7) DEFAULT '#1a73e8',
  cor_fundo VARCHAR(7) DEFAULT '#f5f7fa',
  modo_escuro BOOLEAN DEFAULT false,
  logo_url TEXT,
  login_titulo VARCHAR(255),
  login_subtitulo VARCHAR(255)
);

-- ════════════════════════════════════════════
-- TABELA: quadro_permissoes
-- ════════════════════════════════════════════

CREATE TABLE quadro_permissoes (
  id VARCHAR(64) PRIMARY KEY DEFAULT 'global',
  cadastrar JSONB NOT NULL DEFAULT '{"master":true,"administrador":true,"supervisor":true,"funcionario":false}',
  editar JSONB NOT NULL DEFAULT '{"master":true,"administrador":true,"supervisor":true,"funcionario":false}',
  excluir JSONB NOT NULL DEFAULT '{"master":true,"administrador":true,"supervisor":false,"funcionario":false}'
);

-- ════════════════════════════════════════════
-- TABELA: vencimentos_emails (global)
-- ════════════════════════════════════════════

CREATE TABLE vencimentos_emails (
  id VARCHAR(64) PRIMARY KEY DEFAULT 'global',
  emails TEXT[] DEFAULT '{}'
);

-- ════════════════════════════════════════════
-- INSERIR DADOS INICIAIS
-- ════════════════════════════════════════════

-- Tema padrão
INSERT INTO tema_config (id) VALUES ('global') ON CONFLICT DO NOTHING;

-- ════════════════════════════════════════════
-- TABELA: configuracoes_gerais (key-value)
-- ════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS configuracoes_gerais (
  tenant_id VARCHAR(64) NOT NULL DEFAULT 'global',
  chave VARCHAR(100) NOT NULL,
  valor TEXT NOT NULL DEFAULT '',
  PRIMARY KEY (tenant_id, chave)
);

-- Permissões do quadro padrão
INSERT INTO quadro_permissoes (id) VALUES ('global') ON CONFLICT DO NOTHING;

-- Emails de vencimento padrão
INSERT INTO vencimentos_emails (id) VALUES ('global') ON CONFLICT DO NOTHING;

-- Permissões das funções (21 funções do sistema)
INSERT INTO permissoes_funcoes (id, nome, ativa, perfis) VALUES
  ('dashboard', 'Dashboard', true, '{"master":true,"administrador":true,"supervisor":true,"funcionario":true}'),
  ('condominios', 'Condomínios', true, '{"master":true,"administrador":true,"supervisor":true,"funcionario":false}'),
  ('qrcode', 'QR Code', true, '{"master":true,"administrador":true,"supervisor":true,"funcionario":true}'),
  ('leitor-qrcode', 'Leitor QR Code', true, '{"master":true,"administrador":true,"supervisor":true,"funcionario":true}'),
  ('ordens-servico', 'Ordens de Serviço', true, '{"master":true,"administrador":true,"supervisor":true,"funcionario":true}'),
  ('checklists', 'Checklists', true, '{"master":true,"administrador":true,"supervisor":true,"funcionario":true}'),
  ('vistorias', 'Vistorias', true, '{"master":true,"administrador":true,"supervisor":true,"funcionario":true}'),
  ('reportes', 'Reportes', true, '{"master":true,"administrador":true,"supervisor":true,"funcionario":true}'),
  ('escalas', 'Escalas', true, '{"master":true,"administrador":true,"supervisor":true,"funcionario":false}'),
  ('tarefas', 'Tarefas Agendadas', true, '{"master":true,"administrador":true,"supervisor":true,"funcionario":true}'),
  ('roteiros', 'Roteiro de Execução', true, '{"master":true,"administrador":true,"supervisor":true,"funcionario":true}'),
  ('vencimentos', 'Agenda de Vencimentos', true, '{"master":true,"administrador":true,"supervisor":true,"funcionario":false}'),
  ('materiais', 'Materiais', true, '{"master":true,"administrador":true,"supervisor":true,"funcionario":true}'),
  ('inspecoes', 'Inspeções', true, '{"master":true,"administrador":true,"supervisor":true,"funcionario":false}'),
  ('usuarios', 'Cadastro de Usuários', true, '{"master":true,"administrador":true,"supervisor":false,"funcionario":false}'),
  ('geolocalizacao', 'Geolocalização', true, '{"master":true,"administrador":true,"supervisor":true,"funcionario":false}'),
  ('relatorios', 'Relatórios', true, '{"master":true,"administrador":true,"supervisor":false,"funcionario":false}'),
  ('mapa-calor', 'Mapa de Calor', true, '{"master":true,"administrador":true,"supervisor":false,"funcionario":false}'),
  ('permissoes', 'Permissões', true, '{"master":true,"administrador":true,"supervisor":false,"funcionario":false}'),
  ('quadro-atividades', 'Quadro de Atividades', true, '{"master":true,"administrador":true,"supervisor":true,"funcionario":true}'),
  ('configuracoes', 'Configurações', true, '{"master":true,"administrador":true,"supervisor":true,"funcionario":true}')
ON CONFLICT DO NOTHING;

-- Função para atualizar timestamp
CREATE OR REPLACE FUNCTION update_atualizado_em()
RETURNS TRIGGER AS $$
BEGIN
  NEW.atualizado_em = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_usuarios_updated BEFORE UPDATE ON usuarios FOR EACH ROW EXECUTE FUNCTION update_atualizado_em();
CREATE TRIGGER trg_roteiros_updated BEFORE UPDATE ON roteiros FOR EACH ROW EXECUTE FUNCTION update_atualizado_em();
