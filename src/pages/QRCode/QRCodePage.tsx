import React, { useState, useRef, useMemo, useEffect, useCallback } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import HowItWorks from '../../components/Common/HowItWorks';
import PageHeader from '../../components/Common/PageHeader';
import Card from '../../components/Common/Card';
import StatusBadge from '../../components/Common/StatusBadge';
import Modal from '../../components/Common/Modal';
import { compartilharConteudo, imprimirElemento, gerarPdfDeElemento, gerarPdfResposta } from '../../utils/exportUtils';
import { useAuth } from '../../contexts/AuthContext';
import { usePermissions } from '../../contexts/PermissionsContext';
import {
  Plus, QrCode, Search, X, Hash, Trash2, Upload, Eye, Star,
  ChevronRight, ChevronDown, ChevronUp, GripVertical, Image, CheckSquare,
  AlertTriangle, MessageCircle, Bell, FileText, BarChart3,
  UserCheck, Building2, Home, Settings, Copy, Download, Mail, Phone, Siren, CalendarPlus, Fingerprint, MapPin, Clock, LogIn, LogOut as LogOutIcon, ClipboardCheck, Hourglass, Play, Square, Flag, PenTool, RotateCcw, Camera, Wrench, Printer, Heart, Inbox, User, FileDown
} from 'lucide-react';
import { useDemo } from '../../contexts/DemoContext';
import { qrcodes as qrcodesApi, upload as uploadApi, condominios as condominiosApi, usuarios as usuariosApi, checklists as checklistsApi, tarefas as tarefasApi, vistorias as vistoriasApi, quadroAtividades as quadroAtividadesApi } from '../../services/api';
import styles from './QRCode.module.css';

/* ═══════════════════════════════════════
   TIPOS
═══════════════════════════════════════ */

const FUNCOES_QR: { id: string; label: string; rota: string }[] = [
  { id: 'dashboard', label: 'Dashboard', rota: '/dashboard' },
  { id: 'quadro-atividades', label: 'Quadro de Atividades', rota: '/quadro-atividades' },
  { id: 'ordens', label: 'Ordens de Serviço', rota: '/ordens-servico' },
  { id: 'checklists', label: 'Checklists', rota: '/checklists' },
  { id: 'vistorias', label: 'Vistorias', rota: '/vistorias' },
  { id: 'reportes', label: 'Reportes', rota: '/reportes' },
  { id: 'tarefas', label: 'Tarefas Agendadas', rota: '/tarefas' },
  { id: 'roteiros', label: 'Roteiro de Execução', rota: '/roteiros' },
  { id: 'materiais', label: 'Controle de Estoque', rota: '/materiais' },
  { id: 'leitor-qrcode', label: 'Leitor QR Code', rota: '/leitor-qrcode' },
  { id: 'escalas', label: 'Escalas', rota: '/escalas' },
  { id: 'vencimentos', label: 'Agenda de Vencimentos', rota: '/vencimentos' },
  { id: 'inspecoes', label: 'Inspeções', rota: '/inspecoes' },
  { id: 'comunicados', label: 'Comunicados / Avisos', rota: '/comunicados' },
  { id: 'moradores', label: 'Cadastro de Moradores', rota: '/moradores' },
  { id: 'condominios', label: 'Condomínios', rota: '/condominios' },
  { id: 'usuarios', label: 'Cadastro de Usuários', rota: '/usuarios' },
  { id: 'geolocalizacao', label: 'Geolocalização', rota: '/geolocalizacao' },
  { id: 'relatorios', label: 'Relatórios', rota: '/relatorios' },
  { id: 'configuracoes', label: 'Configurações', rota: '/configuracoes' },
];
type BlocoTipo =
  | 'titulo' | 'subtitulo' | 'texto' | 'galeria' | 'descricao'
  | 'checklist' | 'status' | 'prioridade' | 'avaliacao_estrela'
  | 'avaliacao_escala' | 'pergunta' | 'aviso' | 'comunicado' | 'feedback' | 'urgencia' | 'agendar_servico' | 'pesquisa_satisfacao' | 'controle_ponto' | 'sla_tempo' | 'assinatura_digital' | 'ocorrencia' | 'manutencao' | 'download_documento';

interface BlocoConfig {
  id: string;
  tipo: BlocoTipo;
  label: string;
  obrigatorio: boolean;
  opcoes?: string[]; // para checklist, status, prioridade, pergunta
  maxFotos?: number; // para galeria
  maxEstrelas?: number; // para avaliação estrela (1-5)
  escalaMax?: number; // para avaliação escala (0-10)
  documentoUrl?: string; // para download_documento
  documentoNome?: string; // nome original do arquivo
}

interface QRCodeFormulario {
  id: string;
  nome: string;
  descricao: string;
  logo: string | null;
  blocos: BlocoConfig[];
  dispensarIdentificacao: boolean;
  blocosCadastrados: string[];
  condominioId?: string;
  criadoPor: string;
  criadoEm: number;
  respostas: number;
  ativo: boolean;
  emailNotificacao?: string;
}

interface Identificacao {
  tipo: 'morador' | 'funcionario' | 'prestador' | '';
  nome: string;
  bloco: string;
  unidade: string;
  anonimo: boolean;
}

interface RespostaBlocos {
  [blocoId: string]: any;
}

interface BlocoCatalogoItem {
  tipo: BlocoTipo;
  label: string;
  icone: React.ReactNode;
  cor: string;
}

interface BlocoCatalogoSecao {
  id: string;
  titulo: string;
  descricao: string;
  tipos: BlocoTipo[];
}

type IntegracaoSistema = 'checklists' | 'tarefas' | 'vistorias' | 'quadroAtividades';

interface FuncionarioIntegracao {
  id: string;
  nome: string;
  role: string;
  condominioId?: string;
  cargo?: string;
  ativo?: boolean;
}

/* ═══════════════════════════════════════
   CONSTANTES
═══════════════════════════════════════ */
const BLOCOS_DISPONIVEIS: BlocoCatalogoItem[] = [
  { tipo: 'titulo', label: 'Título', icone: <FileText size={18} />, cor: '#1565c0' },
  { tipo: 'subtitulo', label: 'Sub-título', icone: <FileText size={18} />, cor: '#1976d2' },
  { tipo: 'texto', label: 'Texto', icone: <FileText size={18} />, cor: '#2196f3' },
  { tipo: 'galeria', label: 'Galeria de Fotos', icone: <Image size={18} />, cor: '#7b1fa2' },
  { tipo: 'descricao', label: 'Descrição', icone: <FileText size={18} />, cor: '#00838f' },
  { tipo: 'checklist', label: 'Checklist', icone: <CheckSquare size={18} />, cor: '#2e7d32' },
  { tipo: 'status', label: 'Status', icone: <BarChart3 size={18} />, cor: '#f57c00' },
  { tipo: 'prioridade', label: 'Prioridade', icone: <AlertTriangle size={18} />, cor: '#d32f2f' },
  { tipo: 'avaliacao_estrela', label: 'Avaliação Estrela (1-5)', icone: <Star size={18} />, cor: '#fbc02d' },
  { tipo: 'avaliacao_escala', label: 'Avaliação Escala (0-10)', icone: <BarChart3 size={18} />, cor: '#e65100' },
  { tipo: 'pergunta', label: 'Perguntas e Respostas', icone: <MessageCircle size={18} />, cor: '#5c6bc0' },
  { tipo: 'aviso', label: 'Avisos', icone: <AlertTriangle size={18} />, cor: '#ff6f00' },
  { tipo: 'comunicado', label: 'Comunicados', icone: <Bell size={18} />, cor: '#00695c' },
  { tipo: 'feedback', label: 'Feedback', icone: <Mail size={18} />, cor: '#0277bd' },
  { tipo: 'urgencia', label: 'Reportar Urgências', icone: <Siren size={18} />, cor: '#b71c1c' },
  { tipo: 'agendar_servico', label: 'Agendar Serviço Extra', icone: <CalendarPlus size={18} />, cor: '#4a148c' },
  { tipo: 'pesquisa_satisfacao', label: 'Pesquisa de Satisfação', icone: <ClipboardCheck size={18} />, cor: '#00695c' },
  { tipo: 'controle_ponto', label: 'Controle de Ponto', icone: <Fingerprint size={18} />, cor: '#1565c0' },
  { tipo: 'sla_tempo', label: 'SLA — Tempo de Resposta', icone: <Hourglass size={18} />, cor: '#e65100' },
  { tipo: 'assinatura_digital', label: 'Assinatura Digital', icone: <PenTool size={18} />, cor: '#4527a0' },
  { tipo: 'ocorrencia', label: 'Informar Ocorrência', icone: <Camera size={18} />, cor: '#c62828' },
  { tipo: 'manutencao', label: 'Problema de Manutenção', icone: <Wrench size={18} />, cor: '#e65100' },
  { tipo: 'download_documento', label: 'Download de Documento', icone: <FileDown size={18} />, cor: '#0d47a1' },
];

const BLOCOS_SECOES: BlocoCatalogoSecao[] = [
  {
    id: 'conteudo',
    titulo: 'Conteúdo e Estrutura',
    descricao: 'Campos para montar a apresentação do formulário, com títulos, subtítulos, textos e descrições.',
    tipos: ['titulo', 'subtitulo', 'texto', 'descricao'],
  },
  {
    id: 'midia',
    titulo: 'Fotos, Arquivos e Comprovação',
    descricao: 'Itens visuais e de comprovação, ideais para anexos, registros com foto e documentos para download.',
    tipos: ['galeria', 'download_documento', 'assinatura_digital'],
  },
  {
    id: 'morador',
    titulo: 'Morador e Atendimento',
    descricao: 'Blocos voltados para resposta de morador, satisfação, feedback, perguntas e comunicados.',
    tipos: ['pergunta', 'feedback', 'avaliacao_estrela', 'avaliacao_escala', 'pesquisa_satisfacao', 'aviso', 'comunicado'],
  },
  {
    id: 'funcionario',
    titulo: 'Funcionário e Execução',
    descricao: 'Blocos para rotina operacional de funcionário, checklist, prioridade, status e controle de ponto.',
    tipos: ['checklist', 'status', 'prioridade', 'controle_ponto', 'sla_tempo'],
  },
  {
    id: 'ocorrencias',
    titulo: 'Ocorrências, Manutenção e Serviços',
    descricao: 'Ações voltadas a chamados, urgências, manutenção e solicitações de serviço extraordinário.',
    tipos: ['urgencia', 'ocorrencia', 'manutencao', 'agendar_servico'],
  },
];

const INTEGRACOES_FUNCIONARIO: Array<{ id: IntegracaoSistema; label: string; descricao: string }> = [
  { id: 'checklists', label: 'Checklist', descricao: 'Cria um checklist operacional para o funcionário executar.' },
  { id: 'tarefas', label: 'Tarefas Agendadas', descricao: 'Envia uma tarefa agendada vinculada ao funcionário e condomínio.' },
  { id: 'vistorias', label: 'Vistorias', descricao: 'Abre uma vistoria com itens básicos para conferência no local.' },
  { id: 'quadroAtividades', label: 'Quadro de Atividades', descricao: 'Cria atividade diretamente no quadro do funcionário.' },
];

const INTEGRACOES_INICIAIS: Record<IntegracaoSistema, boolean> = {
  checklists: false,
  tarefas: false,
  vistorias: false,
  quadroAtividades: false,
};

const BLOCOS_PADRAO = ['Bloco A', 'Bloco B', 'Bloco C', 'Bloco D', 'Torre 1', 'Torre 2', 'Funcionário', 'Prestador'];

const OPCOES_PADRAO: Partial<Record<BlocoTipo, string[]>> = {
  checklist: ['Item 1'],
  status: ['Aberto', 'Em andamento', 'Resolvido'],
  prioridade: ['Baixa', 'Média', 'Alta', 'Urgente'],
  pergunta: [''],
  urgencia: ['Vazamento de água', 'Vazamento de gás', 'Vidro quebrado', 'Curto-circuito / Problema elétrico', 'Elevador parado', 'Incêndio', 'Inundação', 'Queda de estrutura', 'Outro'],
  agendar_servico: ['Limpeza pós-festa', 'Limpeza pós-mudança', 'Limpeza pós-obra', 'Lavagem de garagem', 'Higienização especial', 'Outro'],
  pesquisa_satisfacao: ['Qualidade da limpeza', 'Pontualidade da equipe', 'Cordialidade dos funcionários', 'Conservação das áreas comuns', 'Atendimento a solicitações'],
  controle_ponto: ['Entrada', 'Saída'],
  sla_tempo: ['Limpeza', 'Manutenção', 'Segurança', 'Jardinagem', 'Outros'],
  assinatura_digital: ['Serviço executado conforme solicitado'],
  ocorrencia: ['Elétrica', 'Hidráulica', 'Estrutural', 'Pintura', 'Limpeza', 'Jardinagem', 'Elevador', 'Portão / Cerca', 'Iluminação', 'Outro'],
  manutencao: ['Vazamento de água', 'Problema elétrico', 'Porta / Fechadura quebrada', 'Vidro trincado / quebrado', 'Piso danificado', 'Infiltração / Mofo', 'Elevador com defeito', 'Ar-condicionado', 'Pintura descascando', 'Entupimento', 'Iluminação queimada', 'Outro'],
};

const updateOpcaoInBlocos = (blocos: BlocoConfig[], blocoId: string, idx: number, valor: string): BlocoConfig[] =>
  blocos.map(b => {
    if (b.id !== blocoId) return b;
    return { ...b, opcoes: b.opcoes?.map((o, i) => i === idx ? valor : o) };
  });

const removeOpcaoFromBlocos = (blocos: BlocoConfig[], blocoId: string, idx: number): BlocoConfig[] =>
  blocos.map(b => {
    if (b.id !== blocoId) return b;
    return { ...b, opcoes: b.opcoes?.filter((_, i) => i !== idx) };
  });

const removeFromArray = (arr: any[], idx: number) => arr.filter((_, j: number) => j !== idx);


interface RegistroPonto {
  funcionario: { nome: string; email: string; cargo?: string; perfil: string };
  tipo: 'entrada' | 'saida';
  dataHora: string;
  geolocalizacao: { latitude: number; longitude: number } | null;
  endereco: string | null;
  permanencia?: string;
}



function formatarDuracao(ms: number): string {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const seg = s % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${seg.toString().padStart(2, '0')}`;
}

const PERFIL_LABELS: Record<string, string> = { master: 'Master', administrador: 'Administrador', supervisor: 'Supervisor', funcionario: 'Funcionário' };

/* ── Componente Controle de Ponto ── */
const ControlePontoBloco: React.FC<{
  blocoId: string;
  valor: any;
  setRespostas: React.Dispatch<React.SetStateAction<Record<string, any>>>;
}> = ({ blocoId, valor, setRespostas }) => {
  const { usuario } = useAuth();
  const [carregando, setCarregando] = useState(false);
  const [pontoAtivo, setPontoAtivo] = useState<{ entrada: string; lat?: number; lon?: number } | null>(() => {
    try { const v = localStorage.getItem('gestao-ponto-ativo'); return v ? JSON.parse(v) : null; } catch { return null; }
  });
  const [timer, setTimer] = useState('00:00:00');
  const [geo, setGeo] = useState<{ lat: number; lon: number; endereco: string | null } | null>(null);
  const [registros, setRegistros] = useState<RegistroPonto[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    qrcodesApi.listPonto().then((data: any[]) => {
      setRegistros(data.map((r: any) => ({
        funcionario: { nome: r.funcionarioNome, email: r.funcionarioEmail, cargo: r.funcionarioCargo, perfil: '' },
        tipo: r.tipo,
        dataHora: r.dataHora,
        geolocalizacao: r.latitude ? { latitude: r.latitude, longitude: r.longitude } : null,
        endereco: r.endereco,
        permanencia: r.permanencia,
      })));
    }).catch(() => {});
  }, []);

  // Timer
  useEffect(() => {
    if (!pontoAtivo) { setTimer('00:00:00'); return; }
    const atualizar = () => {
      const diff = Date.now() - new Date(pontoAtivo.entrada).getTime();
      setTimer(formatarDuracao(diff));
    };
    atualizar();
    timerRef.current = globalThis.setInterval(atualizar, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [pontoAtivo]);

  const capturarGeo = useCallback(async () => {
    try {
      const pos = await new Promise<GeolocationPosition>((res, rej) =>
        navigator.geolocation.getCurrentPosition(res, rej, { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 })
      );
      let endereco: string | null = null;
      try {
        const resp = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=json&lat=${pos.coords.latitude}&lon=${pos.coords.longitude}&zoom=18&addressdetails=1`,
          { headers: { 'Accept-Language': 'pt-BR' } }
        );
        if (resp.ok) { const d = await resp.json(); endereco = d.display_name || null; }
      } catch {}
      return { lat: pos.coords.latitude, lon: pos.coords.longitude, endereco };
    } catch { return null; }
  }, []);

  const registrarEntrada = async () => {
    setCarregando(true);
    const geoData = await capturarGeo();
    setGeo(geoData);
    const agora = new Date().toISOString();
    const ativo = { entrada: agora, lat: geoData?.lat, lon: geoData?.lon };
    setPontoAtivo(ativo);
    localStorage.setItem('gestao-ponto-ativo', JSON.stringify(ativo));

    const reg: RegistroPonto = {
      funcionario: {
        nome: usuario?.nome || 'Desconhecido',
        email: usuario?.email || '',
        cargo: usuario?.cargo,
        perfil: PERFIL_LABELS[usuario?.role || 'funcionario'] || '',
      },
      tipo: 'entrada',
      dataHora: agora,
      geolocalizacao: geoData ? { latitude: geoData.lat, longitude: geoData.lon } : null,
      endereco: geoData?.endereco || null,
    };
    try {
      await qrcodesApi.addPonto({
        tipo: 'entrada',
        funcionarioNome: reg.funcionario.nome,
        funcionarioEmail: reg.funcionario.email,
        funcionarioCargo: reg.funcionario.cargo,
        latitude: geoData?.lat,
        longitude: geoData?.lon,
        endereco: geoData?.endereco,
      });
    } catch {}
    setRegistros(prev => [reg, ...prev]);
    setRespostas(prev => ({ ...prev, [blocoId]: { ...reg, tipo: 'entrada' } }));
    setCarregando(false);
  };

  const registrarSaida = async () => {
    setCarregando(true);
    const geoData = await capturarGeo();
    setGeo(geoData);
    const agora = new Date().toISOString();
    const permanencia = pontoAtivo ? formatarDuracao(Date.now() - new Date(pontoAtivo.entrada).getTime()) : '—';

    const reg: RegistroPonto = {
      funcionario: {
        nome: usuario?.nome || 'Desconhecido',
        email: usuario?.email || '',
        cargo: usuario?.cargo,
        perfil: PERFIL_LABELS[usuario?.role || 'funcionario'] || '',
      },
      tipo: 'saida',
      dataHora: agora,
      geolocalizacao: geoData ? { latitude: geoData.lat, longitude: geoData.lon } : null,
      endereco: geoData?.endereco || null,
      permanencia,
    };
    try {
      await qrcodesApi.addPonto({
        tipo: 'saida',
        funcionarioNome: reg.funcionario.nome,
        funcionarioEmail: reg.funcionario.email,
        funcionarioCargo: reg.funcionario.cargo,
        latitude: geoData?.lat,
        longitude: geoData?.lon,
        endereco: geoData?.endereco,
        permanencia,
      });
    } catch {}
    setRegistros(prev => [reg, ...prev]);
    setRespostas(prev => ({ ...prev, [blocoId]: { ...reg, tipo: 'saida', permanencia } }));
    setPontoAtivo(null);
    localStorage.removeItem('gestao-ponto-ativo');
    setCarregando(false);
  };

  const formatarDataHora = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }) +
      ' às ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  return (
    <div className={styles.pontoFields}>
      <div className={styles.pontoBanner}>
        <Fingerprint size={20} />
        <span>Registre entrada ou saída — o sistema captura localização e tempo automaticamente</span>
      </div>

      {/* Dados do funcionário */}
      <div className={styles.pontoDadosFuncionario}>
        <UserCheck size={16} />
        <div>
          <strong>{usuario?.nome || 'Funcionário'}</strong>
          <span>{usuario?.email}{usuario?.cargo ? ` · ${usuario.cargo}` : ''} · {PERFIL_LABELS[usuario?.role || 'funcionario']}</span>
        </div>
      </div>

      {/* Timer */}
      {pontoAtivo && (
        <div className={styles.pontoTimer}>
          <Clock size={18} />
          <span className={styles.pontoTimerValor}>{timer}</span>
          <span className={styles.pontoTimerLabel}>em serviço</span>
        </div>
      )}

      {/* Botões */}
      <div className={styles.pontoBotoes}>
        <button
          className={`${styles.pontoBtnEntrada} ${pontoAtivo ? styles.pontoBtnDesabilitado : ''}`}
          onClick={registrarEntrada}
          disabled={!!pontoAtivo || carregando}
        >
          <LogIn size={18} />
          {carregando && !pontoAtivo ? 'Registrando...' : 'Registrar Entrada'}
        </button>
        <button
          className={`${styles.pontoBtnSaida} ${pontoAtivo ? '' : styles.pontoBtnDesabilitado}`}
          onClick={registrarSaida}
          disabled={!pontoAtivo || carregando}
        >
          <LogOutIcon size={18} />
          {carregando && pontoAtivo ? 'Registrando...' : 'Registrar Saída'}
        </button>
      </div>

      {/* Localização atual */}
      {geo && (
        <div className={styles.pontoGeo}>
          <MapPin size={14} />
          <span>{geo.endereco || `${geo.lat.toFixed(6)}, ${geo.lon.toFixed(6)}`}</span>
        </div>
      )}

      {/* Histórico recente */}
      {registros.length > 0 && (
        <div className={styles.pontoHistorico}>
          <h5>Registros Recentes</h5>
          {registros.slice(0, 6).map((r, i) => (
            <div key={`reg-${r.tipo}-${r.dataHora}-${i}`} className={`${styles.pontoRegistro} ${r.tipo === 'entrada' ? styles.pontoRegEntrada : styles.pontoRegSaida}`}>
              <div className={styles.pontoRegIcone}>
                {r.tipo === 'entrada' ? <LogIn size={14} /> : <LogOutIcon size={14} />}
              </div>
              <div className={styles.pontoRegInfo}>
                <strong>{r.tipo === 'entrada' ? 'Entrada' : 'Saída'}</strong>
                <span>{r.funcionario.nome} · {formatarDataHora(r.dataHora)}</span>
                {r.endereco && <span className={styles.pontoRegEndereco}><MapPin size={10} /> {r.endereco.length > 60 ? r.endereco.slice(0, 60) + '...' : r.endereco}</span>}
                {r.permanencia && <span className={styles.pontoRegPermanencia}><Clock size={10} /> Permanência: {r.permanencia}</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

/* ═══════════════════════════════════════
   SLA — TEMPO DE RESPOSTA
═══════════════════════════════════════ */
interface SlaRegistro {
  id: string;
  blocoId: string;
  categoria: string;
  descricao: string;
  abertura: string;
  inicioAtendimento?: string;
  encerramento?: string;
  status: 'aberto' | 'em_atendimento' | 'resolvido';
}

const formatarTempoSla = (ms: number): string => {
  const seg = Math.floor(ms / 1000);
  const min = Math.floor(seg / 60);
  const hrs = Math.floor(min / 60);
  const dias = Math.floor(hrs / 24);
  if (dias > 0) return `${dias}d ${hrs % 24}h ${min % 60}m`;
  if (hrs > 0) return `${hrs}h ${min % 60}m ${seg % 60}s`;
  if (min > 0) return `${min}m ${seg % 60}s`;
  return `${seg}s`;
};

const SlaTempoBloco: React.FC<{
  blocoId: string;
  bloco: { opcoes?: string[] };
  valor: any;
  setRespostas: React.Dispatch<React.SetStateAction<Record<string, any>>>;
}> = ({ blocoId, bloco, valor, setRespostas }) => {
  const [registros, setRegistros] = useState<SlaRegistro[]>([]);
  const [categoria, setCategoria] = useState('');
  const [descricao, setDescricao] = useState('');
  const [agora, setAgora] = useState(Date.now());

  useEffect(() => {
    qrcodesApi.listSla().then((data: any[]) => {
      setRegistros(data.filter((r: any) => r.blocoId === blocoId).slice(-10));
    }).catch(() => {});
  }, [blocoId]);

  useEffect(() => {
    const t = setInterval(() => setAgora(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const abrirChamado = async () => {
    if (!categoria) return;
    try {
      const novo = await qrcodesApi.createSla({ blocoId, categoria, descricao, status: 'aberto' });
      const updated = [novo, ...registros].slice(-10);
      setRegistros(updated);
      setCategoria('');
      setDescricao('');
      setRespostas(prev => ({ ...prev, [blocoId]: updated }));
    } catch {}
  };

  const mudarStatus = async (id: string, novoStatus: 'em_atendimento' | 'resolvido') => {
    try {
      const updated = await qrcodesApi.updateSla(id, novoStatus);
      setRegistros(prev => prev.map(r => r.id === id ? {
        ...r,
        status: novoStatus,
        inicioAtendimento: novoStatus === 'em_atendimento' ? (updated.inicioAtendimento || new Date().toISOString()) : r.inicioAtendimento,
        encerramento: novoStatus === 'resolvido' ? (updated.encerramento || new Date().toISOString()) : r.encerramento,
      } : r));
      setRespostas(prev => ({ ...prev, [blocoId]: registros }));
    } catch {}
  };

  const tempoDecorrido = (desde: string): string => formatarTempoSla(agora - new Date(desde).getTime());

  const statusLabel: Record<string, string> = { aberto: 'Aberto', em_atendimento: 'Em Atendimento', resolvido: 'Resolvido' };
  const statusCor: Record<string, string> = { aberto: '#e53935', em_atendimento: '#fb8c00', resolvido: '#43a047' };

  return (
    <div className={styles.slaFields}>
      <div className={styles.slaBanner}>
        <Hourglass size={18} />
        <span>SLA — Tempo de Resposta</span>
      </div>

      <div className={styles.slaNovoChamado}>
        <label className={styles.slaLabel} htmlFor={`sla-cat-${blocoId}`}>Categoria</label>
        <div className={styles.slaOpcoes}>
          {(bloco.opcoes || []).map(op => (
            <button
              key={op}
              type="button"
              className={categoria === op ? styles.slaItemAtivo : styles.slaItem}
              onClick={() => setCategoria(op)}
            >
              {op}
            </button>
          ))}
        </div>

        <label className={styles.slaLabel} htmlFor={`sla-desc-${blocoId}`}>Descrição da ocorrência</label>
        <textarea
          id={`sla-desc-${blocoId}`}
          className={styles.slaTextarea}
          rows={3}
          placeholder="Descreva brevemente a ocorrência..."
          value={descricao}
          onChange={e => setDescricao(e.target.value)}
        />

        <button type="button" className={styles.slaBtnAbrir} onClick={abrirChamado} disabled={!categoria}>
          <Flag size={16} /> Abrir Chamado
        </button>
      </div>

      {registros.length > 0 && (
        <div className={styles.slaHistorico}>
          <h4 className={styles.slaHistoricoTitulo}>Chamados Recentes</h4>
          {registros.slice().reverse().map(reg => (
            <div key={reg.id} className={styles.slaRegistro}>
              <div className={styles.slaRegHeader}>
                <span className={styles.slaRegCategoria}>{reg.categoria}</span>
                <span className={styles.slaRegStatus} style={{ background: statusCor[reg.status] }}>
                  {statusLabel[reg.status]}
                </span>
              </div>
              {reg.descricao && <p className={styles.slaRegDescricao}>{reg.descricao}</p>}
              <div className={styles.slaRegTempos}>
                <div className={styles.slaRegTempo}>
                  <Clock size={14} />
                  <span>Aberto: {new Date(reg.abertura).toLocaleString('pt-BR')}</span>
                </div>
                {reg.status === 'aberto' && (
                  <div className={styles.slaRegTimer}>
                    <Hourglass size={14} className={styles.slaTimerPulse} />
                    <span>Aguardando há <strong>{tempoDecorrido(reg.abertura)}</strong></span>
                  </div>
                )}
                {reg.inicioAtendimento && (
                  <div className={styles.slaRegTempo}>
                    <Play size={14} />
                    <span>Atendimento: {new Date(reg.inicioAtendimento).toLocaleString('pt-BR')}</span>
                  </div>
                )}
                {reg.status === 'em_atendimento' && reg.inicioAtendimento && (
                  <div className={styles.slaRegTimer}>
                    <Hourglass size={14} className={styles.slaTimerPulse} />
                    <span>Em atendimento há <strong>{tempoDecorrido(reg.inicioAtendimento)}</strong></span>
                  </div>
                )}
                {reg.encerramento && (
                  <div className={styles.slaRegTempo}>
                    <Square size={14} />
                    <span>Encerrado: {new Date(reg.encerramento).toLocaleString('pt-BR')}</span>
                  </div>
                )}
                {reg.encerramento && (
                  <div className={styles.slaRegTempoTotal}>
                    Tempo total: <strong>{formatarTempoSla(new Date(reg.encerramento).getTime() - new Date(reg.abertura).getTime())}</strong>
                  </div>
                )}
              </div>
              <div className={styles.slaRegAcoes}>
                {reg.status === 'aberto' && (
                  <button type="button" className={styles.slaBtnAtender} onClick={() => mudarStatus(reg.id, 'em_atendimento')}>
                    <Play size={14} /> Iniciar Atendimento
                  </button>
                )}
                {reg.status === 'em_atendimento' && (
                  <button type="button" className={styles.slaBtnResolver} onClick={() => mudarStatus(reg.id, 'resolvido')}>
                    <Square size={14} /> Marcar Resolvido
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

/* ═══════════════════════════════════════
   ASSINATURA DIGITAL
═══════════════════════════════════════ */
const AssinaturaDigitalBloco: React.FC<{
  blocoId: string;
  bloco: { opcoes?: string[] };
  valor: any;
  setRespostas: React.Dispatch<React.SetStateAction<Record<string, any>>>;
}> = ({ blocoId, bloco, valor, setRespostas }) => {
  const { usuario } = useAuth();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [desenhando, setDesenhando] = useState(false);
  const [assinado, setAssinado] = useState(false);
  const [confirmado, setConfirmado] = useState(false);
  const [concordo, setConcordo] = useState(false);
  const [dataHora, setDataHora] = useState('');

  const getCtx = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    return canvas.getContext('2d', { willReadFrequently: true });
  }, []);

  const limparCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = getCtx();
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    // linha guia
    ctx.strokeStyle = '#e0e0e0';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(20, canvas.height - 30);
    ctx.lineTo(canvas.width - 20, canvas.height - 30);
    ctx.stroke();
    ctx.setLineDash([]);
    setAssinado(false);
    setConfirmado(false);
    setRespostas(prev => ({ ...prev, [blocoId]: undefined }));
  }, [blocoId, getCtx, setRespostas]);

  useEffect(() => {
    limparCanvas();
  }, [limparCanvas]);

  const getPos = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    if ('touches' in e) {
      const touch = e.touches[0];
      return { x: (touch.clientX - rect.left) * scaleX, y: (touch.clientY - rect.top) * scaleY };
    }
    return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
  };

  const iniciarDesenho = (e: React.MouseEvent | React.TouchEvent) => {
    if (confirmado) return;
    const ctx = getCtx();
    if (!ctx) return;
    const { x, y } = getPos(e);
    ctx.strokeStyle = '#1a1a2e';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(x, y);
    setDesenhando(true);
    setAssinado(true);
  };

  const desenhar = (e: React.MouseEvent | React.TouchEvent) => {
    if (!desenhando || confirmado) return;
    const ctx = getCtx();
    if (!ctx) return;
    const { x, y } = getPos(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const pararDesenho = () => setDesenhando(false);

  const confirmarAssinatura = () => {
    const canvas = canvasRef.current;
    if (!canvas || !assinado || !concordo) return;
    const agora = new Date();
    setDataHora(agora.toLocaleString('pt-BR'));
    const imgData = canvas.toDataURL('image/png');
    setConfirmado(true);
    setRespostas(prev => ({
      ...prev,
      [blocoId]: {
        imagem: imgData,
        signatario: usuario?.nome || 'Não identificado',
        email: usuario?.email || '',
        dataHora: agora.toISOString(),
        termoAceito: (bloco.opcoes || ['Serviço executado conforme solicitado'])[0],
      },
    }));
  };

  const termoTexto = (bloco.opcoes || ['Serviço executado conforme solicitado'])[0];

  return (
    <div className={styles.assinaturaFields}>
      <div className={styles.assinaturaBanner}>
        <PenTool size={18} />
        <span>Assinatura Digital</span>
      </div>

      <div className={styles.assinaturaInfo}>
        <div className={styles.assinaturaInfoItem}>
          <UserCheck size={14} />
          <span>{usuario?.nome || 'Não identificado'}</span>
        </div>
        {usuario?.email && (
          <div className={styles.assinaturaInfoItem}>
            <Mail size={14} />
            <span>{usuario.email}</span>
          </div>
        )}
        <div className={styles.assinaturaInfoItem}>
          <Clock size={14} />
          <span>{dataHora || new Date().toLocaleString('pt-BR')}</span>
        </div>
      </div>

      <div className={styles.assinaturaCanvasWrapper}>
        <canvas
          ref={canvasRef}
          width={500}
          height={180}
          className={`${styles.assinaturaCanvas} ${confirmado ? styles.assinaturaCanvasConfirmado : ''}`}
          onMouseDown={iniciarDesenho}
          onMouseMove={desenhar}
          onMouseUp={pararDesenho}
          onMouseLeave={pararDesenho}
          onTouchStart={iniciarDesenho}
          onTouchMove={desenhar}
          onTouchEnd={pararDesenho}
        />
        {!confirmado && (
          <button type="button" className={styles.assinaturaBtnLimpar} onClick={limparCanvas} title="Limpar assinatura">
            <RotateCcw size={16} />
          </button>
        )}
        {!assinado && !confirmado && (
          <span className={styles.assinaturaPlaceholder}>Assine aqui</span>
        )}
      </div>

      <label className={styles.assinaturaCheckbox}>
        <input type="checkbox" checked={concordo} onChange={e => setConcordo(e.target.checked)} disabled={confirmado} />
        <span>{termoTexto}</span>
      </label>

      {confirmado ? (
        <div className={styles.assinaturaConfirmada}>
          <CheckSquare size={18} />
          <div>
            <strong>Assinatura registrada</strong>
            <span>por {usuario?.nome || 'Não identificado'} em {dataHora}</span>
          </div>
        </div>
      ) : (
        <button
          type="button"
          className={styles.assinaturaBtnConfirmar}
          onClick={confirmarAssinatura}
          disabled={!assinado || !concordo}
        >
          <PenTool size={16} /> Confirmar Assinatura
        </button>
      )}
    </div>
  );
};

/* ── Sub-componente: Linha de critério da Pesquisa de Satisfação ── */
const PesquisaCriterioRow: React.FC<{
  criterio: string;
  nota: number;
  onRate: (n: number) => void;
}> = ({ criterio, nota, onRate }) => (
  <div className={styles.pesquisaCriterio}>
    <span className={styles.pesquisaCriterioLabel}>{criterio}</span>
    <div className={styles.pesquisaEstrelas}>
      {[1, 2, 3, 4, 5].map(n => (
        <button
          key={n}
          className={`${styles.pesquisaEstrela} ${nota >= n ? styles.pesquisaEstrelaAtiva : ''}`}
          onClick={() => onRate(n)}
        >
          <Star size={20} fill={nota >= n ? '#00897b' : 'none'} />
        </button>
      ))}
      <span className={styles.pesquisaNota}>{nota ? `${nota}/5` : ''}</span>
    </div>
  </div>
);

/* ═══════════════════════════════════════
   HELPERS LOCALSTORAGE
═══════════════════════════════════════ */
const getRespostasVistas = (): number => {
  try { return Number(localStorage.getItem('gestao-qr-respostas-vistas') || '0'); } catch { return 0; }
};
const getFavoritos = (): BlocoTipo[] => {
  try { const v = localStorage.getItem('gestao-qr-favoritos'); return v ? JSON.parse(v) : []; } catch { return []; }
};
const isIdentificacaoValida = (id: Identificacao): boolean =>
  id.anonimo || !!(id.tipo && id.nome && id.bloco && id.unidade);

const obterCondominioSelecionado = (
  formCondominioId: string,
  usuarioCondominioId: string | undefined,
  condominios: Array<{ id: string; nome: string }>
) => formCondominioId || usuarioCondominioId || condominios[0]?.id || '';

const mapApiQRCode = (qr: any, criadoPorPadrao: string, respostasPadrao = 0): QRCodeFormulario => ({
  id: qr.id,
  nome: qr.nome,
  descricao: qr.descricao || '',
  logo: qr.logo,
  blocos: typeof qr.blocos === 'string' ? JSON.parse(qr.blocos) : (qr.blocos || []),
  dispensarIdentificacao: qr.dispensarIdentificacao,
  blocosCadastrados: typeof qr.blocosCadastrados === 'string' ? JSON.parse(qr.blocosCadastrados) : (qr.blocosCadastrados || []),
  condominioId: qr.condominioId || qr.condominio_id,
  criadoPor: qr.criadoPor || criadoPorPadrao,
  criadoEm: qr.criadoEm ? new Date(qr.criadoEm).getTime() : Date.now(),
  respostas: qr.respostas || respostasPadrao,
  ativo: qr.ativo !== false,
  emailNotificacao: qr.emailNotificacao || qr.email_notificacao || '',
});

const cloneBlocosConfig = (blocos: BlocoConfig[]): BlocoConfig[] => blocos.map(bloco => ({
  ...bloco,
  opcoes: bloco.opcoes ? [...bloco.opcoes] : undefined,
}));

interface EnviarIntegracoesParams {
  condominioId: string;
  funcionario: FuncionarioIntegracao;
  integracoesSelecionadas: Record<IntegracaoSistema, boolean>;
  formNome: string;
  formDesc: string;
  formBlocos: BlocoConfig[];
}

const enviarIntegracoesParaFuncionario = async ({
  condominioId,
  funcionario,
  integracoesSelecionadas,
  formNome,
  formDesc,
  formBlocos,
}: EnviarIntegracoesParams) => {
  const tituloBase = formNome.trim() || 'Fluxo enviado via QR Code';
  const descricaoBase = formDesc.trim() || 'Integração criada a partir do painel de QR Code.';
  const itensChecklist = formBlocos.length > 0
    ? formBlocos.slice(0, 5).map((bloco, idx) => ({
      id: `chk-${Date.now()}-${idx}`,
      descricao: bloco.label,
      concluido: false,
    }))
    : [{ id: `chk-${Date.now()}`, descricao: 'Executar atividade enviada via QR Code', concluido: false }];
  const itensVistoria = formBlocos.length > 0
    ? formBlocos.slice(0, 5).map((bloco, idx) => ({
      id: `vist-${Date.now()}-${idx}`,
      local: bloco.label,
      descricao: `Validar item: ${bloco.label}`,
      fotos: [],
      status: 'pendente',
      prioridade: 'media',
      observacao: '',
    }))
    : [{
      id: `vist-${Date.now()}`,
      local: 'Área comum',
      descricao: 'Validar condições gerais do local',
      fotos: [],
      status: 'pendente',
      prioridade: 'media',
      observacao: '',
    }];

  const operacoes: Promise<unknown>[] = [];

  if (integracoesSelecionadas.checklists) {
    operacoes.push(checklistsApi.create({
      condominioId,
      local: tituloBase,
      tipo: 'diaria',
      itens: itensChecklist,
      responsavelId: funcionario.id,
      data: new Date().toISOString().slice(0, 10),
    }));
  }

  if (integracoesSelecionadas.tarefas) {
    operacoes.push(tarefasApi.create({
      titulo: tituloBase,
      descricao: descricaoBase,
      funcionarioId: funcionario.id,
      funcionarioNome: funcionario.nome,
      condominioId,
      bloco: 'Geral',
      local: tituloBase,
      recorrencia: 'unica',
      prioridade: 'media',
    }));
  }

  if (integracoesSelecionadas.vistorias) {
    operacoes.push(vistoriasApi.create({
      titulo: `Vistoria - ${tituloBase}`,
      condominioId,
      tipo: 'rotina',
      data: new Date().toISOString().slice(0, 10),
      responsavelNome: funcionario.nome,
      itens: itensVistoria,
    }));
  }

  if (integracoesSelecionadas.quadroAtividades) {
    operacoes.push(quadroAtividadesApi.create({
      titulo: tituloBase,
      descricao: descricaoBase,
      status: 'a_fazer',
      prioridade: 'media',
      rotina: 'diaria',
      responsavelId: funcionario.id,
      responsavelNome: funcionario.nome,
      condominioId,
    }));
  }

  await Promise.all(operacoes);
};

interface ExecutarEnvioIntegracoesParams {
  formCondominioId: string;
  usuarioCondominioId: string | undefined;
  condominios: Array<{ id: string; nome: string }>;
  funcionariosFiltrados: FuncionarioIntegracao[];
  funcionarioIntegracaoId: string;
  integracoesSelecionadas: Record<IntegracaoSistema, boolean>;
  formNome: string;
  formDesc: string;
  formBlocos: BlocoConfig[];
}

const executarEnvioIntegracoes = async ({
  formCondominioId,
  usuarioCondominioId,
  condominios,
  funcionariosFiltrados,
  funcionarioIntegracaoId,
  integracoesSelecionadas,
  formNome,
  formDesc,
  formBlocos,
}: ExecutarEnvioIntegracoesParams) => {
  const condominioId = obterCondominioSelecionado(formCondominioId, usuarioCondominioId, condominios);
  const funcionario = funcionariosFiltrados.find(item => item.id === funcionarioIntegracaoId);
  const integracoesAtivas = Object.entries(integracoesSelecionadas)
    .filter(([, ativo]) => ativo)
    .map(([id]) => id as IntegracaoSistema);

  if (!condominioId) {
    return { sucesso: false, mensagem: 'Selecione um condomínio para enviar as integrações.', cor: '#d32f2f' };
  }
  if (!funcionario) {
    return { sucesso: false, mensagem: 'Selecione um funcionário para receber as integrações.', cor: '#d32f2f' };
  }
  if (integracoesAtivas.length === 0) {
    return { sucesso: false, mensagem: 'Marque pelo menos uma integração para enviar.', cor: '#d32f2f' };
  }

  await enviarIntegracoesParaFuncionario({
    condominioId,
    funcionario,
    integracoesSelecionadas,
    formNome,
    formDesc,
    formBlocos,
  });

  return { sucesso: true, mensagem: `Integrações enviadas para ${funcionario.nome}.`, cor: '#2e7d32' };
};

interface CriarQRCodeParams {
  formNome: string;
  formDesc: string;
  formLogo: string | null;
  formBlocos: BlocoConfig[];
  formDispensarId: boolean;
  formBlocosCad: string[];
  condominioId: string;
  usuarioNome: string | undefined;
  emailNotificacao?: string;
}

const criarQRCodeFormulario = async ({
  formNome,
  formDesc,
  formLogo,
  formBlocos,
  formDispensarId,
  formBlocosCad,
  condominioId,
  usuarioNome,
  emailNotificacao,
}: CriarQRCodeParams): Promise<QRCodeFormulario> => {
  const created = await qrcodesApi.create({
    nome: formNome.trim(),
    descricao: formDesc.trim(),
    logo: formLogo,
    blocos: formBlocos,
    dispensarIdentificacao: formDispensarId,
    blocosCadastrados: formBlocosCad.filter(b => b.trim()),
    condominioId,
    emailNotificacao: emailNotificacao?.trim() || null,
  });

  return mapApiQRCode(created, usuarioNome || 'Sistema', 0);
};

interface ExecutarCriacaoQRCodeParams {
  formNome: string;
  formDesc: string;
  formLogo: string | null;
  formBlocos: BlocoConfig[];
  formDispensarId: boolean;
  formBlocosCad: string[];
  formCondominioId: string;
  usuarioCondominioId: string | undefined;
  condominios: Array<{ id: string; nome: string }>;
  usuarioNome: string | undefined;
  emailNotificacao?: string;
}

const executarCriacaoQRCode = async ({
  formNome,
  formDesc,
  formLogo,
  formBlocos,
  formDispensarId,
  formBlocosCad,
  formCondominioId,
  usuarioCondominioId,
  condominios,
  usuarioNome,
  emailNotificacao,
}: ExecutarCriacaoQRCodeParams) => {
  if (!formNome.trim()) {
    return { sucesso: false, mensagem: 'Preencha o nome do formulário', cor: '#d32f2f' };
  }
  if (formBlocos.length === 0) {
    return { sucesso: false, mensagem: 'Adicione pelo menos um bloco', cor: '#d32f2f' };
  }

  const condominioId = obterCondominioSelecionado(formCondominioId, usuarioCondominioId, condominios);
  if (!condominioId) {
    return { sucesso: false, mensagem: 'Selecione um condomínio para criar o QR Code.', cor: '#d32f2f' };
  }

  const novo = await criarQRCodeFormulario({
    formNome,
    formDesc,
    formLogo,
    formBlocos,
    formDispensarId,
    formBlocosCad,
    condominioId,
    usuarioNome,
    emailNotificacao,
  });

  return { sucesso: true, novo, mensagem: `✓ QR Code "${novo.nome}" criado!`, cor: '#2e7d32' };
};

interface BlocoRespostaItemProps {
  bloco: BlocoConfig;
  valor: any;
  updateResposta: (blocoId: string, value: any) => void;
  updateRespostaProp: (blocoId: string, prop: string, value: any) => void;
  removeRespostaFoto: (blocoId: string, idx: number) => void;
  removeGalleryItem: (blocoId: string, idx: number) => void;
  processGalleryFiles: (blocoId: string, files: FileList, max: number, currentCount: number) => void;
  processPhotoFile: (blocoId: string, file: File) => void;
  updateChecklistItem: (blocoId: string, idx: number, checked: boolean, opcoes: string[]) => void;
  updatePerguntaItem: (blocoId: string, idx: number, value: string, opcoes: string[]) => void;
  updatePesquisaItem: (blocoId: string, idx: number, nota: number, opcoes: string[]) => void;
  setRespostas: React.Dispatch<React.SetStateAction<Record<string, any>>>;
}

const BlocoRespostaItem: React.FC<BlocoRespostaItemProps> = ({
  bloco,
  valor,
  updateResposta,
  updateRespostaProp,
  removeRespostaFoto,
  removeGalleryItem,
  processGalleryFiles,
  processPhotoFile,
  updateChecklistItem,
  updatePerguntaItem,
  updatePesquisaItem,
  setRespostas,
}) => {
  const info = BLOCOS_DISPONIVEIS.find(b => b.tipo === bloco.tipo);

  return (
    <div className={styles.blocoResposta}>
      <div className={styles.blocoRespostaHeader}>
        <span className={styles.blocoRespostaIcone} style={{ color: info?.cor }}>{info?.icone}</span>
        <span className={styles.blocoRespostaLabel}>{bloco.label}</span>
        {bloco.obrigatorio && <span className={styles.blocoReq}>*</span>}
      </div>

      {(bloco.tipo === 'titulo' || bloco.tipo === 'subtitulo' || bloco.tipo === 'texto' || bloco.tipo === 'descricao') && (
        <textarea
          className={styles.respostaTextarea}
          placeholder={`Digite ${bloco.label.toLowerCase()}...`}
          value={valor || ''}
          onChange={e => updateResposta(bloco.id, e.target.value)}
          rows={bloco.tipo === 'titulo' || bloco.tipo === 'subtitulo' ? 1 : 3}
        />
      )}

      {bloco.tipo === 'galeria' && (
        <div className={styles.respostaGaleria}>
          <p className={styles.respostaHint}>Anexe até {bloco.maxFotos || 5} fotos</p>
          <input
            type="file"
            accept="image/*"
            multiple
            style={{ display: 'none' }}
            id={`foto-input-${bloco.id}`}
            onChange={e => {
              const files = e.target.files;
              if (!files) return;
              processGalleryFiles(bloco.id, files, bloco.maxFotos || 5, (valor || []).length);
              e.target.value = '';
            }}
          />
          {(valor || []).length < (bloco.maxFotos || 5) && (
            <button className={styles.respostaUploadBtn} onClick={() => {
              document.getElementById(`foto-input-${bloco.id}`)?.click();
            }}>
              <Upload size={16} /> Adicionar Foto
            </button>
          )}
          {(valor || []).length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
              {(valor as any[]).map((foto: any, i: number) => (
                <div key={`gallery-${bloco.id}-${i}-${foto.nome}`} style={{ position: 'relative' }}>
                  <img src={foto.dataUrl} alt={foto.nome} style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 8, border: '1px solid #e0e0e0' }} />
                  <button
                    onClick={() => removeGalleryItem(bloco.id, i)}
                    style={{ position: 'absolute', top: -6, right: -6, width: 20, height: 20, borderRadius: '50%', background: '#e53935', color: '#fff', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, lineHeight: 1, padding: 0 }}
                  >×</button>
                </div>
              ))}
            </div>
          )}
          {(valor || []).length > 0 && <span className={styles.respostaFotoCount}>{(valor || []).length} foto(s) anexada(s)</span>}
        </div>
      )}

      {bloco.tipo === 'checklist' && (
        <div className={styles.respostaChecklist}>
          {bloco.opcoes?.map((op, idx) => (
            <label key={`check-${bloco.id}-${op}-${idx}`} className={styles.checkItem}>
              <input type="checkbox" checked={valor?.[idx] || false} onChange={e => {
                updateChecklistItem(bloco.id, idx, e.target.checked, bloco.opcoes!);
              }} />
              <span>{op}</span>
            </label>
          ))}
        </div>
      )}

      {(bloco.tipo === 'status' || bloco.tipo === 'prioridade') && (
        <select className={styles.respostaSelect} value={valor || ''} onChange={e => updateResposta(bloco.id, e.target.value)}>
          <option value="">Selecione...</option>
          {bloco.opcoes?.map(op => <option key={op} value={op}>{op}</option>)}
        </select>
      )}

      {bloco.tipo === 'avaliacao_estrela' && (
        <div className={styles.respostaEstrelas}>
          {[1, 2, 3, 4, 5].map(n => (
            <button key={n} className={`${styles.estrela} ${(valor || 0) >= n ? styles.estrelaAtiva : ''}`}
              onClick={() => updateResposta(bloco.id, n)}>
              <Star size={28} fill={(valor || 0) >= n ? '#fbc02d' : 'none'} />
            </button>
          ))}
          <span className={styles.estrelaTexto}>{valor ? `${valor}/5` : 'Toque para avaliar'}</span>
        </div>
      )}

      {bloco.tipo === 'avaliacao_escala' && (
        <div className={styles.respostaEscala}>
          <div className={styles.escalaNumeros}>
            {Array.from({ length: 11 }, (_, i) => (
              <button key={i} className={`${styles.escalaNum} ${valor === i ? styles.escalaNumAtivo : ''}`}
                onClick={() => updateResposta(bloco.id, i)}>
                {i}
              </button>
            ))}
          </div>
          <div className={styles.escalaLabels}>
            <span>Muito ruim</span>
            <span>Excelente</span>
          </div>
        </div>
      )}

      {bloco.tipo === 'pergunta' && (
        <div className={styles.respostaPerguntas}>
          {bloco.opcoes?.map((pergunta, idx) => (
            <div key={`perg-${bloco.id}-${idx}`} className={styles.perguntaItem}>
              <label className={styles.perguntaLabel}>{pergunta || `Pergunta ${idx + 1}`}</label>
              <textarea
                className={styles.respostaTextarea}
                placeholder="Sua resposta..."
                value={valor?.[idx] || ''}
                onChange={e => updatePerguntaItem(bloco.id, idx, e.target.value, bloco.opcoes!)}
                rows={2}
              />
            </div>
          ))}
        </div>
      )}

      {(bloco.tipo === 'aviso' || bloco.tipo === 'comunicado') && (
        <textarea
          className={styles.respostaTextarea}
          placeholder={bloco.tipo === 'aviso' ? 'Registre o aviso...' : 'Registre o comunicado...'}
          value={valor || ''}
          onChange={e => updateResposta(bloco.id, e.target.value)}
          rows={3}
        />
      )}

      {bloco.tipo === 'feedback' && (
        <div className={styles.feedbackFields}>
          <p className={styles.feedbackHint}>Informe seu contato para receber um retorno:</p>
          <div className={styles.feedbackRow}>
            <Phone size={16} className={styles.feedbackIcon} />
            <input
              className={styles.formInput}
              placeholder="WhatsApp (ex: 11 99999-9999)"
              value={valor?.whatsapp || ''}
              onChange={e => updateRespostaProp(bloco.id, 'whatsapp', e.target.value)}
            />
          </div>
          <div className={styles.feedbackRow}>
            <Mail size={16} className={styles.feedbackIcon} />
            <input
              className={styles.formInput}
              type="email"
              placeholder="E-mail (ex: nome@email.com)"
              value={valor?.email || ''}
              onChange={e => updateRespostaProp(bloco.id, 'email', e.target.value)}
            />
          </div>
        </div>
      )}

      {bloco.tipo === 'urgencia' && (
        <div className={styles.urgenciaFields}>
          <div className={styles.urgenciaBanner}>
            <Siren size={20} />
            <span>Selecione o tipo de urgência e descreva o ocorrido</span>
          </div>
          <div className={styles.urgenciaOpcoes}>
            {bloco.opcoes?.map(op => (
              <label key={`urg-${bloco.id}-${op}`} className={`${styles.urgenciaItem} ${valor?.tipo === op ? styles.urgenciaItemAtivo : ''}`}>
                <input
                  type="radio"
                  name={`urgencia-${bloco.id}`}
                  checked={valor?.tipo === op}
                  onChange={() => updateRespostaProp(bloco.id, 'tipo', op)}
                  hidden
                />
                <AlertTriangle size={14} />
                <span>{op}</span>
              </label>
            ))}
          </div>
          <textarea
            className={styles.respostaTextarea}
            placeholder="Descreva a urgência com detalhes (local, gravidade, etc.)..."
            value={valor?.descricao || ''}
            onChange={e => updateRespostaProp(bloco.id, 'descricao', e.target.value)}
            rows={3}
          />
          <div className={styles.urgenciaAlerta}>
            <AlertTriangle size={14} />
            <span>Ao enviar, uma notificação será disparada imediatamente para os responsáveis.</span>
          </div>
        </div>
      )}

      {bloco.tipo === 'agendar_servico' && (
        <div className={styles.agendarFields}>
          <div className={styles.agendarBanner}>
            <CalendarPlus size={20} />
            <span>Solicite limpeza fora do horário (pós-festa, mudança, etc.)</span>
          </div>
          <div className={styles.agendarOpcoes}>
            {bloco.opcoes?.map(op => (
              <label key={`agendar-${bloco.id}-${op}`} className={`${styles.agendarItem} ${valor?.tipoServico === op ? styles.agendarItemAtivo : ''}`}>
                <input
                  type="radio"
                  name={`agendar-${bloco.id}`}
                  checked={valor?.tipoServico === op}
                  onChange={() => updateRespostaProp(bloco.id, 'tipoServico', op)}
                  hidden
                />
                <span>{op}</span>
              </label>
            ))}
          </div>
          <div className={styles.agendarCampos}>
            <div className={styles.agendarRow}>
              <span>Data desejada</span>
              <input
                type="date"
                className={styles.formInput}
                value={valor?.data || ''}
                onChange={e => updateRespostaProp(bloco.id, 'data', e.target.value)}
              />
            </div>
            <div className={styles.agendarRow}>
              <span>Horário preferido</span>
              <input
                type="time"
                className={styles.formInput}
                value={valor?.horario || ''}
                onChange={e => updateRespostaProp(bloco.id, 'horario', e.target.value)}
              />
            </div>
          </div>
          <textarea
            className={styles.respostaTextarea}
            placeholder="Observações (local, detalhes adicionais, etc.)..."
            value={valor?.observacoes || ''}
            onChange={e => updateRespostaProp(bloco.id, 'observacoes', e.target.value)}
            rows={3}
          />
        </div>
      )}

      {bloco.tipo === 'pesquisa_satisfacao' && (
        <div className={styles.pesquisaFields}>
          <div className={styles.pesquisaBanner}>
            <ClipboardCheck size={20} />
            <span>Avalie o serviço geral da empresa</span>
          </div>
          <div className={styles.pesquisaCriterios}>
            {bloco.opcoes?.map((criterio, idx) => (
              <PesquisaCriterioRow
                key={`pesq-${bloco.id}-${criterio}-${idx}`}
                criterio={criterio}
                nota={valor?.[idx] || 0}
                onRate={n => updatePesquisaItem(bloco.id, idx, n, bloco.opcoes!)}
              />
            ))}
          </div>
          <textarea
            className={styles.respostaTextarea}
            placeholder="Comentários ou sugestões (opcional)..."
            value={valor?.comentario || (typeof valor === 'object' && !Array.isArray(valor) ? valor?.comentario : '') || ''}
            onChange={e => {
              const notas = Array.isArray(valor) ? valor : (bloco.opcoes || []).map(() => 0);
              setRespostas(prev => ({ ...prev, [bloco.id]: { notas, comentario: e.target.value } }));
            }}
            rows={2}
          />
        </div>
      )}

      {bloco.tipo === 'controle_ponto' && (
        <ControlePontoBloco blocoId={bloco.id} valor={valor} setRespostas={setRespostas} />
      )}

      {bloco.tipo === 'sla_tempo' && (
        <SlaTempoBloco blocoId={bloco.id} bloco={bloco} valor={valor} setRespostas={setRespostas} />
      )}

      {bloco.tipo === 'assinatura_digital' && (
        <AssinaturaDigitalBloco blocoId={bloco.id} bloco={bloco} valor={valor} setRespostas={setRespostas} />
      )}

      {bloco.tipo === 'ocorrencia' && (
        <div className={styles.ocorrenciaFields}>
          <div className={styles.ocorrenciaBanner}>
            <Camera size={20} />
            <span>Informe a ocorrência com foto e descrição</span>
          </div>
          <div className={styles.ocorrenciaCategoria}>
            <span className={styles.ocorrenciaCatLabel}>Categoria do problema:</span>
            <div className={styles.ocorrenciaOpcoes}>
              {bloco.opcoes?.map(op => (
                <label key={`ocorr-${bloco.id}-${op}`} className={`${styles.ocorrenciaItem} ${valor?.categoria === op ? styles.ocorrenciaItemAtivo : ''}`}>
                  <input
                    type="radio"
                    name={`ocorrencia-${bloco.id}`}
                    checked={valor?.categoria === op}
                    onChange={() => updateRespostaProp(bloco.id, 'categoria', op)}
                    hidden
                  />
                  <AlertTriangle size={14} />
                  <span>{op}</span>
                </label>
              ))}
            </div>
          </div>
          <div className={styles.ocorrenciaLocal}>
            <span className={styles.ocorrenciaCatLabel}>Local da ocorrência:</span>
            <input
              className={styles.formInput}
              placeholder="Ex: Hall do Bloco A, Garagem 2, Piscina..."
              value={valor?.local || ''}
              onChange={e => updateRespostaProp(bloco.id, 'local', e.target.value)}
            />
          </div>
          <div className={styles.ocorrenciaDescricao}>
            <span className={styles.ocorrenciaCatLabel}>Descrição detalhada:</span>
            <textarea
              className={styles.respostaTextarea}
              placeholder="Descreva o problema encontrado com o máximo de detalhes (o que aconteceu, quando percebeu, gravidade)..."
              value={valor?.descricao || ''}
              onChange={e => updateRespostaProp(bloco.id, 'descricao', e.target.value)}
              rows={4}
            />
          </div>
          <div className={styles.ocorrenciaFotos}>
            <span className={styles.ocorrenciaCatLabel}>Fotos do problema:</span>
            <div className={styles.ocorrenciaFotoGrid}>
              {(valor?.fotos || []).map((foto: string, idx: number) => (
                <div key={`ocorr-foto-${bloco.id}-${idx}`} className={styles.ocorrenciaFotoThumb}>
                  <img src={foto} alt={`Foto ${idx + 1}`} />
                  <button
                    type="button"
                    className={styles.ocorrenciaFotoRemover}
                    onClick={() => removeRespostaFoto(bloco.id, idx)}
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
              {(valor?.fotos || []).length < 5 && (
                <label className={styles.ocorrenciaFotoAdd}>
                  <Camera size={24} />
                  <span>Adicionar foto</span>
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    hidden
                    onChange={e => {
                      const file = e.target.files?.[0];
                      if (file) processPhotoFile(bloco.id, file);
                      e.target.value = '';
                    }}
                  />
                </label>
              )}
            </div>
            <span className={styles.ocorrenciaFotoHint}>{(valor?.fotos || []).length}/5 fotos — tire fotos claras do problema</span>
          </div>
          <div className={styles.ocorrenciaAlerta}>
            <AlertTriangle size={14} />
            <span>A ocorrência será registrada e encaminhada à equipe de manutenção.</span>
          </div>
        </div>
      )}

      {bloco.tipo === 'manutencao' && (
        <div className={styles.manutencaoFields}>
          <div className={styles.manutencaoBanner}>
            <Wrench size={20} />
            <span>Reportar problema de manutenção com foto e descrição</span>
          </div>
          <div className={styles.manutencaoSecao}>
            <span className={styles.manutencaoLabel}>Tipo do problema:</span>
            <div className={styles.manutencaoOpcoes}>
              {bloco.opcoes?.map(op => (
                <label key={`manut-${bloco.id}-${op}`} className={`${styles.manutencaoItem} ${valor?.tipo === op ? styles.manutencaoItemAtivo : ''}`}>
                  <input
                    type="radio"
                    name={`manutencao-${bloco.id}`}
                    checked={valor?.tipo === op}
                    onChange={() => updateRespostaProp(bloco.id, 'tipo', op)}
                    hidden
                  />
                  <Wrench size={14} />
                  <span>{op}</span>
                </label>
              ))}
            </div>
          </div>
          <div className={styles.manutencaoSecao}>
            <span className={styles.manutencaoLabel}>Prioridade:</span>
            <div className={styles.manutencaoPrioridades}>
              {['Baixa', 'Média', 'Alta', 'Urgente'].map(p => {
                const priClass = styles[`manutencaoPri${p}` as keyof typeof styles] || '';
                return (
                <button
                  key={p}
                  type="button"
                  className={`${styles.manutencaoPri} ${priClass} ${valor?.prioridade === p ? styles.manutencaoPriAtivo : ''}`}
                  onClick={() => updateRespostaProp(bloco.id, 'prioridade', p)}
                >
                  <Flag size={14} />
                  {p}
                </button>
                );
              })}
            </div>
          </div>
          <div className={styles.manutencaoSecao}>
            <span className={styles.manutencaoLabel}>Local exato:</span>
            <input
              className={styles.formInput}
              placeholder="Ex: Banheiro do 3º andar, Garagem subsolo, Portaria..."
              value={valor?.local || ''}
              onChange={e => updateRespostaProp(bloco.id, 'local', e.target.value)}
            />
          </div>
          <div className={styles.manutencaoSecao}>
            <span className={styles.manutencaoLabel}>Descrição do problema:</span>
            <textarea
              className={styles.respostaTextarea}
              placeholder="Descreva o que está quebrado, vazando ou com defeito. Inclua detalhes como há quanto tempo o problema existe e se está piorando..."
              value={valor?.descricao || ''}
              onChange={e => updateRespostaProp(bloco.id, 'descricao', e.target.value)}
              rows={4}
            />
          </div>
          <div className={styles.manutencaoSecao}>
            <span className={styles.manutencaoLabel}>Fotos do problema:</span>
            <div className={styles.manutencaoFotoGrid}>
              {(valor?.fotos || []).map((foto: string, idx: number) => (
                <div key={`manut-foto-${bloco.id}-${idx}`} className={styles.manutencaoFotoThumb}>
                  <img src={foto} alt={`Foto ${idx + 1}`} />
                  <button
                    type="button"
                    className={styles.manutencaoFotoRemover}
                    onClick={() => removeRespostaFoto(bloco.id, idx)}
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
              {(valor?.fotos || []).length < 5 && (
                <label className={styles.manutencaoFotoAdd}>
                  <Camera size={24} />
                  <span>Tirar / anexar foto</span>
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    hidden
                    onChange={e => {
                      const file = e.target.files?.[0];
                      if (file) processPhotoFile(bloco.id, file);
                      e.target.value = '';
                    }}
                  />
                </label>
              )}
            </div>
            <span className={styles.manutencaoFotoHint}>{(valor?.fotos || []).length}/5 fotos — registre o estado atual do problema</span>
          </div>
          <div className={styles.manutencaoAlerta}>
            <Wrench size={14} />
            <span>O chamado será aberto automaticamente e encaminhado à equipe de manutenção responsável.</span>
          </div>
        </div>
      )}

      {bloco.tipo === 'download_documento' && (
        <div className={styles.documentoDownloadArea}>
          {bloco.documentoUrl ? (
            <a
              href={bloco.documentoUrl}
              download={bloco.documentoNome || 'documento'}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.documentoDownloadBtn}
            >
              <FileDown size={20} />
              <div>
                <strong>{bloco.documentoNome || 'Documento'}</strong>
                <span>Clique para baixar</span>
              </div>
            </a>
          ) : (
            <p className={styles.documentoVazio}>Nenhum documento anexado a este bloco.</p>
          )}
        </div>
      )}
    </div>
  );
};

interface BlocoBuilderItemProps {
  bloco: BlocoConfig;
  atualizarBloco: (id: string, campo: string, valor: any) => void;
  atualizarOpcao: (blocoId: string, idx: number, valor: string) => void;
  removerOpcao: (blocoId: string, idx: number) => void;
  adicionarOpcao: (blocoId: string) => void;
  removerBloco: (id: string) => void;
  mostrarToast: (msg: string, cor: string) => void;
}

const BlocoBuilderItem: React.FC<BlocoBuilderItemProps> = ({
  bloco,
  atualizarBloco,
  atualizarOpcao,
  removerOpcao,
  adicionarOpcao,
  removerBloco,
  mostrarToast,
}) => {
  const info = BLOCOS_DISPONIVEIS.find(b => b.tipo === bloco.tipo);

  return (
    <div className={styles.blocoBuilder}>
      <div className={styles.blocoBuilderHeader}>
        <GripVertical size={16} className={styles.blocoGrip} />
        <div className={styles.blocoIcone} style={{ background: info?.cor + '18', color: info?.cor }}>
          {info?.icone}
        </div>
        <input
          className={styles.blocoLabelInput}
          value={bloco.label}
          onChange={e => atualizarBloco(bloco.id, 'label', e.target.value)}
          placeholder="Nome do campo"
        />
        <label className={styles.blocoObrigatorio}>
          <input type="checkbox" checked={bloco.obrigatorio} onChange={e => atualizarBloco(bloco.id, 'obrigatorio', e.target.checked)} />
          <span>Obrigatório</span>
        </label>
        <button className={styles.blocoRemover} onClick={() => removerBloco(bloco.id)}>
          <Trash2 size={14} />
        </button>
      </div>

      {bloco.opcoes && (
        <div className={styles.blocoOpcoes}>
          {bloco.opcoes.map((op, idx) => (
            <div key={`${bloco.id}-opt-${idx}`} className={styles.opcaoRow}>
              <input
                className={styles.opcaoInput}
                value={op}
                onChange={e => atualizarOpcao(bloco.id, idx, e.target.value)}
                placeholder={bloco.tipo === 'pergunta' ? `Pergunta ${idx + 1}` : `Opção ${idx + 1}`}
              />
              {bloco.opcoes!.length > 1 && (
                <button className={styles.opcaoRemover} onClick={() => removerOpcao(bloco.id, idx)}>
                  <X size={12} />
                </button>
              )}
            </div>
          ))}
          <button className={styles.opcaoAdd} onClick={() => adicionarOpcao(bloco.id)}>
            <Plus size={14} /> Adicionar {bloco.tipo === 'pergunta' ? 'Pergunta' : 'Opção'}
          </button>
        </div>
      )}

      {bloco.tipo === 'galeria' && (
        <div className={styles.blocoConfig}>
          <span>Máx. fotos:</span>
          <input type="number" min={1} max={20} value={bloco.maxFotos || 5} onChange={e => atualizarBloco(bloco.id, 'maxFotos', Number(e.target.value))} className={styles.configInput} />
        </div>
      )}

      {bloco.tipo === 'download_documento' && (
        <div className={styles.blocoConfig} style={{ flexDirection: 'column', alignItems: 'stretch' }}>
          {bloco.documentoUrl ? (
            <div className={styles.documentoPreview}>
              <FileDown size={18} style={{ color: '#0d47a1' }} />
              <span className={styles.documentoNome}>{bloco.documentoNome || 'Documento'}</span>
              <button className={styles.documentoRemover} onClick={() => { atualizarBloco(bloco.id, 'documentoUrl', undefined); atualizarBloco(bloco.id, 'documentoNome', undefined); }}>
                <X size={14} /> Remover
              </button>
            </div>
          ) : (
            <>
              <input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.webp"
                style={{ display: 'none' }}
                id={`doc-input-${bloco.id}`}
                onChange={async e => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  try {
                    mostrarToast('Enviando documento...', '#1565c0');
                    const url = await uploadApi.document(file);
                    atualizarBloco(bloco.id, 'documentoUrl', url);
                    atualizarBloco(bloco.id, 'documentoNome', file.name);
                    mostrarToast('✓ Documento enviado com sucesso', '#2e7d32');
                  } catch {
                    mostrarToast('Erro ao enviar documento', '#d32f2f');
                  }
                  e.target.value = '';
                }}
              />
              <button className={styles.documentoUploadBtn} onClick={() => document.getElementById(`doc-input-${bloco.id}`)?.click()}>
                <Upload size={16} /> Enviar Documento (PDF ou imagem)
              </button>
              <span className={styles.documentoHint}>O morador poderá baixar este documento ao ler o QR Code</span>
            </>
          )}
        </div>
      )}
    </div>
  );
};

/* ═══════════════════════════════════════
   COMPONENTE PRINCIPAL
═══════════════════════════════════════ */
// NOSONAR: tela de orquestração com múltiplos estados e fluxos já extraídos para helpers dedicados.
const QRCodePage: React.FC = () => {
  const { usuario } = useAuth();
  const { roleNivel } = usePermissions();
  const { tentarAcao } = useDemo();
  const role = usuario?.role || 'funcionario';
  const ehMasterOuAdmin = roleNivel >= 3;
  const ehSupervisor = role === 'supervisor';

  const [qrcodes, setQrcodes] = useState<QRCodeFormulario[]>([]);
  const [condominios, setCondominios] = useState<Array<{ id: string; nome: string }>>([]);
  const [funcionarios, setFuncionarios] = useState<FuncionarioIntegracao[]>([]);
  const [supervisorAutorizado, setSupervisorAutorizado] = useState(false);
  const [busca, setBusca] = useState('');
  const [loading, setLoading] = useState(true);

  // Modal Criar QR Code
  const [showCriar, setShowCriar] = useState(false);
  const [qrEmEdicao, setQrEmEdicao] = useState<QRCodeFormulario | null>(null);
  const [formNome, setFormNome] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formLogo, setFormLogo] = useState<string | null>(null);
  const [formBlocos, setFormBlocos] = useState<BlocoConfig[]>([]);
  const [formDispensarId, setFormDispensarId] = useState(false);
  const [formBlocosCad, setFormBlocosCad] = useState<string[]>(BLOCOS_PADRAO);
  const [formCondominioId, setFormCondominioId] = useState('');
  const [formEmailNotif, setFormEmailNotif] = useState('');
  const [funcionarioIntegracaoId, setFuncionarioIntegracaoId] = useState('');
  const [enviandoIntegracoes, setEnviandoIntegracoes] = useState(false);
  const [integracoesSelecionadas, setIntegracoesSelecionadas] = useState<Record<IntegracaoSistema, boolean>>(INTEGRACOES_INICIAIS);
  const [novoBlocoNome, setNovoBlocoNome] = useState('');
  const logoInputRef = useRef<HTMLInputElement>(null);
  const qrFuncoesRef = useRef<HTMLDivElement>(null);
  const [showFuncoesQR, setShowFuncoesQR] = useState(false);
  const [toast, setToast] = useState<{ msg: string; cor: string } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Respostas recebidas (dropdown laranja) ──
  const [respostasRecebidas, setRespostasRecebidas] = useState<any[]>([]);
  const [showRespostas, setShowRespostas] = useState(false);
  const [respostasVistas, setRespostasVistas] = useState<number>(getRespostasVistas);
  const novasRespostas = respostasRecebidas.length - respostasVistas;
  const temNovas = novasRespostas > 0;

  useEffect(() => {
    qrcodesApi.listRespostas().then((data: any[]) => setRespostasRecebidas(data)).catch(() => {});
    // Poll a cada 30s
    const interval = setInterval(() => {
      qrcodesApi.listRespostas().then((data: any[]) => setRespostasRecebidas(data)).catch(() => {});
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  const marcarRespostasVistas = useCallback(() => {
    setRespostasVistas(respostasRecebidas.length);
    localStorage.setItem('gestao-qr-respostas-vistas', String(respostasRecebidas.length));
  }, [respostasRecebidas.length]);

  const toggleRespostas = useCallback(() => {
    if (!showRespostas && temNovas) marcarRespostasVistas();
    setShowRespostas(v => !v);
  }, [showRespostas, temNovas, marcarRespostasVistas]);

  const formatarDataResp = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) +
      ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  };

  useEffect(() => {
    Promise.all([
      qrcodesApi.list().catch(() => []),
      qrcodesApi.getSupervisorPerm().catch(() => ({ autorizado: false })),
      condominiosApi.list().catch(() => []),
      usuariosApi.list().catch(() => []),
    ]).then(([qrs, perm, conds, users]: any) => {
      setQrcodes(qrs.map((q: any) => mapApiQRCode(q, 'Sistema')));
      const listaCondominios = (conds as any[])
        .map(c => ({ id: c.id, nome: c.nome }))
        .filter(c => c.id && c.nome);
      const listaFuncionarios = (users as any[])
        .filter(userItem => userItem?.role === 'funcionario' && userItem?.ativo !== false)
        .map(userItem => ({
          id: userItem.id,
          nome: userItem.nome,
          role: userItem.role,
          condominioId: userItem.condominioId || userItem.condominio_id,
          cargo: userItem.cargo,
          ativo: userItem.ativo,
        }));
      setCondominios(listaCondominios);
      setFuncionarios(listaFuncionarios);
      setFormCondominioId(prev => prev || obterCondominioSelecionado('', usuario?.condominioId, listaCondominios));
      setSupervisorAutorizado(perm.autorizado);
    }).finally(() => setLoading(false));
  }, [usuario?.condominioId]);

  const funcionariosFiltrados = useMemo(() => {
    const condominioId = formCondominioId || usuario?.condominioId || '';
    if (!condominioId) return funcionarios;
    return funcionarios.filter(funcionario => !funcionario.condominioId || funcionario.condominioId === condominioId);
  }, [formCondominioId, funcionarios, usuario?.condominioId]);

  useEffect(() => {
    setFuncionarioIntegracaoId(prev => {
      if (prev && funcionariosFiltrados.some(funcionario => funcionario.id === prev)) return prev;
      return funcionariosFiltrados[0]?.id || '';
    });
  }, [funcionariosFiltrados]);

  const removerBlocoCad = useCallback((idx: number) => {
    setFormBlocosCad(prev => prev.filter((_, j) => j !== idx));
  }, []);

  // Favoritos (persistência em localStorage)
  const [favoritos, setFavoritos] = useState<BlocoTipo[]>(getFavoritos);

  const toggleFavorito = useCallback((tipo: BlocoTipo) => {
    setFavoritos(prev => {
      const next = prev.includes(tipo) ? prev.filter(t => t !== tipo) : [...prev, tipo];
      localStorage.setItem('gestao-qr-favoritos', JSON.stringify(next));
      return next;
    });
  }, []);

  const mostrarToast = useCallback((msg: string, cor: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ msg, cor });
    toastTimer.current = setTimeout(() => setToast(null), 2200);
  }, []);

  // Modal Preview / Visualizar QR
  const [previewQR, setPreviewQR] = useState<QRCodeFormulario | null>(null);

  // Modal Responder QR Code (simula leitura)
  const [responderQR, setResponderQR] = useState<QRCodeFormulario | null>(null);
  const [etapaResposta, setEtapaResposta] = useState<'identificacao' | 'formulario' | 'enviado'>('identificacao');
  const [identificacao, setIdentificacao] = useState<Identificacao>({ tipo: '', nome: '', bloco: '', unidade: '', anonimo: false });
  const [respostas, setRespostas] = useState<RespostaBlocos>({});

  // ── Helpers para reduzir nesting depth ──
  const updateResposta = useCallback((blocoId: string, value: any) => {
    setRespostas(prev => ({ ...prev, [blocoId]: value }));
  }, []);

  const updateRespostaProp = useCallback((blocoId: string, prop: string, value: any) => {
    setRespostas(prev => ({ ...prev, [blocoId]: { ...prev[blocoId], [prop]: value } }));
  }, []);

  const removeRespostaFoto = useCallback((blocoId: string, idx: number) => {
    setRespostas(prev => {
      const fotos = (prev[blocoId]?.fotos || []).filter((_: any, i: number) => i !== idx);
      return { ...prev, [blocoId]: { ...prev[blocoId], fotos } };
    });
  }, []);

  const addRespostaFoto = useCallback((blocoId: string, foto: string) => {
    setRespostas(prev => ({ ...prev, [blocoId]: { ...prev[blocoId], fotos: [...(prev[blocoId]?.fotos || []), foto] } }));
  }, []);

  const removeGalleryItem = useCallback((blocoId: string, idx: number) => {
    setRespostas(prev => ({ ...prev, [blocoId]: (prev[blocoId] || []).filter((_: any, i: number) => i !== idx) }));
  }, []);

  const addGalleryItem = useCallback((blocoId: string, photo: { nome: string; dataUrl: string }, max: number) => {
    setRespostas(prev => {
      const arr = prev[blocoId] || [];
      if (arr.length >= max) return prev;
      return { ...prev, [blocoId]: [...arr, photo] };
    });
  }, []);

  const updateChecklistItem = useCallback((blocoId: string, idx: number, checked: boolean, opcoes: string[]) => {
    setRespostas(prev => {
      const arr = [...(prev[blocoId] || opcoes.map(() => false))];
      arr[idx] = checked;
      return { ...prev, [blocoId]: arr };
    });
  }, []);

  const updatePerguntaItem = useCallback((blocoId: string, idx: number, value: string, opcoes: string[]) => {
    setRespostas(prev => {
      const arr = [...(prev[blocoId] || opcoes.map(() => ''))];
      arr[idx] = value;
      return { ...prev, [blocoId]: arr };
    });
  }, []);

  const updatePesquisaItem = useCallback((blocoId: string, idx: number, nota: number, opcoes: string[]) => {
    setRespostas(prev => {
      const arr = [...(prev[blocoId] || opcoes.map(() => 0))];
      arr[idx] = nota;
      return { ...prev, [blocoId]: arr };
    });
  }, []);

  // Permissão: supervisor pode criar?
  const podeCriarQR = ehMasterOuAdmin || (ehSupervisor && supervisorAutorizado);

  const imprimirQRFuncoes = useCallback(() => {
    const el = qrFuncoesRef.current;
    if (!el) return;
    const win = globalThis.open('', '_blank');
    if (!win) return;

    const { document: printDoc } = win;
    printDoc.title = 'QR Codes - Funções';

    const style = printDoc.createElement('style');
    style.textContent = `
      @page { size: A4 portrait; margin: 10mm; }
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #fff; color: #222; }
      .titulo { text-align: center; font-size: 18px; font-weight: 700; padding: 14px 0 4px; }
      .subtitulo { text-align: center; font-size: 11px; color: #888; margin-bottom: 12px; }
      .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; padding: 0 4px; }
      .item { border: 1.5px solid #ddd; border-radius: 8px; padding: 8px 4px 10px; display: flex; flex-direction: column; align-items: center; gap: 6px; }
      .item canvas, .item img { width: 90px !important; height: 90px !important; }
      .item span { font-size: 9px; font-weight: 600; text-align: center; line-height: 1.2; }
      .item small { font-size: 7px; color: #999; word-break: break-all; text-align: center; }
      @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
    `;
    printDoc.head.appendChild(style);

    const title = printDoc.createElement('div');
    title.className = 'titulo';
    title.textContent = 'QR Codes — Acesso Rápido às Funções';
    printDoc.body.appendChild(title);

    const subtitle = printDoc.createElement('div');
    subtitle.className = 'subtitulo';
    subtitle.textContent = 'Escaneie o QR Code para acessar a função diretamente no celular';
    printDoc.body.appendChild(subtitle);

    const grid = printDoc.createElement('div');
    grid.className = 'grid';
    el.querySelectorAll('[data-qr-item]').forEach(item => {
      grid.appendChild(item.cloneNode(true));
    });
    printDoc.body.appendChild(grid);
    printDoc.close();
    setTimeout(() => { win.print(); }, 600);
  }, []);

  const toggleSupervisorPerm = async () => {
    const novo = !supervisorAutorizado;
    setSupervisorAutorizado(novo);
    try { await qrcodesApi.setSupervisorPerm(novo); } catch {}
  };

  const processGalleryFiles = useCallback((blocoId: string, files: FileList, max: number, currentCount: number) => {
    const remaining = max - currentCount;
    if (remaining <= 0) return;
    Array.from(files).slice(0, remaining).forEach(file => {
      const reader = new FileReader();
      reader.addEventListener('load', () => addGalleryItem(blocoId, { nome: file.name, dataUrl: reader.result as string }, max));
      reader.readAsDataURL(file);
    });
  }, [addGalleryItem]);

  const processPhotoFile = useCallback((blocoId: string, file: File) => {
    const reader = new FileReader();
    reader.addEventListener('load', ev => {
      if (ev.target?.result) addRespostaFoto(blocoId, ev.target.result as string);
    });
    reader.readAsDataURL(file);
  }, [addRespostaFoto]);

  /* ── Filtro ── */
  const filtrados = useMemo(() => {
    if (!busca.trim()) return qrcodes;
    const termos = busca.toLowerCase().split(/\s+/);
    return qrcodes.filter(q => {
      const texto = `${q.nome} ${q.descricao} ${q.id}`.toLowerCase();
      return termos.every(t => texto.includes(t));
    });
  }, [qrcodes, busca]);

  /* ── Logo upload ── */
  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => { if (ev.target?.result) setFormLogo(ev.target.result as string); };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  /* ── Adicionar bloco ao formulário ── */
  const adicionarBloco = (tipo: BlocoTipo) => {
    const info = BLOCOS_DISPONIVEIS.find(b => b.tipo === tipo);
    const novo: BlocoConfig = {
      id: `blk-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      tipo,
      label: info?.label || tipo,
      obrigatorio: false,
      opcoes: OPCOES_PADRAO[tipo],
      maxFotos: tipo === 'galeria' ? 5 : undefined,
      maxEstrelas: tipo === 'avaliacao_estrela' ? 5 : undefined,
      escalaMax: tipo === 'avaliacao_escala' ? 10 : undefined,
      documentoUrl: undefined,
      documentoNome: undefined,
    };
    setFormBlocos(prev => [...prev, novo]);
    mostrarToast(`✓ "${info?.label || tipo}" adicionado`, info?.cor || '#4caf50');
  };

  const removerBloco = (id: string) => {
    setFormBlocos(prev => prev.filter(b => b.id !== id));
  };

  const atualizarBloco = (id: string, campo: string, valor: any) => {
    setFormBlocos(prev => prev.map(b => b.id === id ? { ...b, [campo]: valor } : b));
  };

  const adicionarOpcao = (blocoId: string) => {
    setFormBlocos(prev => prev.map(b =>
      b.id === blocoId ? { ...b, opcoes: [...(b.opcoes || []), ''] } : b
    ));
  };

  const atualizarOpcao = (blocoId: string, idx: number, valor: string) => {
    setFormBlocos(prev => updateOpcaoInBlocos(prev, blocoId, idx, valor));
  };

  const removerOpcao = (blocoId: string, idx: number) => {
    setFormBlocos(prev => removeOpcaoFromBlocos(prev, blocoId, idx));
  };

  const alternarIntegracao = (integracaoId: IntegracaoSistema) => {
    setIntegracoesSelecionadas(prev => ({ ...prev, [integracaoId]: !prev[integracaoId] }));
  };

  const enviarIntegracoesFuncionario = async () => {
    if (!tentarAcao()) return;
    try {
      setEnviandoIntegracoes(true);
      const resultado = await executarEnvioIntegracoes({
        formCondominioId,
        usuarioCondominioId: usuario?.condominioId,
        condominios,
        funcionariosFiltrados,
        funcionarioIntegracaoId,
        integracoesSelecionadas,
        formNome,
        formDesc,
        formBlocos,
      });
      if (resultado.sucesso) {
        setIntegracoesSelecionadas({ ...INTEGRACOES_INICIAIS });
      }
      mostrarToast(resultado.mensagem, resultado.cor);
    } catch (err: any) {
      mostrarToast(err?.message || 'Não foi possível enviar as integrações para o funcionário.', '#d32f2f');
    } finally {
      setEnviandoIntegracoes(false);
    }
  };

  /* ── Criar QR Code ── */
  const criarQRCode = async () => {
    if (!tentarAcao()) return;
    try {
      if (qrEmEdicao) {
        const atualizado = await qrcodesApi.update(qrEmEdicao.id, {
          nome: formNome.trim(),
          descricao: formDesc.trim(),
          logo: formLogo,
          blocos: formBlocos,
          dispensarIdentificacao: formDispensarId,
          blocosCadastrados: formBlocosCad.filter(b => b.trim()),
          condominioId: obterCondominioSelecionado(formCondominioId, usuario?.condominioId, condominios),
          ativo: qrEmEdicao.ativo,
          emailNotificacao: formEmailNotif.trim() || null,
        });
        const qrAtualizado = mapApiQRCode(atualizado, qrEmEdicao.criadoPor, qrEmEdicao.respostas);
        setQrcodes(prev => prev.map(qr => qr.id === qrEmEdicao.id ? qrAtualizado : qr));
        resetForm();
        setQrEmEdicao(null);
        setShowCriar(false);
        mostrarToast(`✓ QR Code "${qrAtualizado.nome}" atualizado!`, '#2e7d32');
        return;
      }

      const resultado = await executarCriacaoQRCode({
        formNome,
        formDesc,
        formLogo,
        formBlocos,
        formDispensarId,
        formBlocosCad,
        formCondominioId,
        usuarioCondominioId: usuario?.condominioId,
        condominios,
        usuarioNome: usuario?.nome,
        emailNotificacao: formEmailNotif.trim() || undefined,
      });
      if (!resultado.sucesso || !resultado.novo) {
        mostrarToast(resultado.mensagem, resultado.cor);
        return;
      }
      setQrcodes(prev => [resultado.novo, ...prev]);
      resetForm();
      setShowCriar(false);
      mostrarToast(resultado.mensagem, resultado.cor);
    } catch (err: any) {
      mostrarToast(err?.message || 'Não foi possível criar o QR Code.', '#d32f2f');
    }
  };

  const resetForm = () => {
    setFormNome(''); setFormDesc(''); setFormLogo(null);
    setFormBlocos([]); setFormDispensarId(false);
    setFormBlocosCad(BLOCOS_PADRAO); setFormCondominioId(obterCondominioSelecionado('', usuario?.condominioId, condominios)); setNovoBlocoNome('');
    setFuncionarioIntegracaoId(''); setIntegracoesSelecionadas({ ...INTEGRACOES_INICIAIS }); setQrEmEdicao(null); setFormEmailNotif('');
  };

  const editarQRCode = (qr: QRCodeFormulario) => {
    setQrEmEdicao(qr);
    setFormNome(qr.nome);
    setFormDesc(qr.descricao || '');
    setFormLogo(qr.logo || null);
    setFormBlocos(cloneBlocosConfig(qr.blocos || []));
    setFormDispensarId(qr.dispensarIdentificacao);
    setFormBlocosCad([...(qr.blocosCadastrados?.length ? qr.blocosCadastrados : BLOCOS_PADRAO)]);
    setFormCondominioId(qr.condominioId || obterCondominioSelecionado('', usuario?.condominioId, condominios));
    setFormEmailNotif(qr.emailNotificacao || '');
    setNovoBlocoNome('');
    setIntegracoesSelecionadas({ ...INTEGRACOES_INICIAIS });
    setShowCriar(true);
  };

  const qrEdicaoAlterada = useMemo(() => {
    if (!qrEmEdicao) return false;
    return (
      formNome.trim() !== qrEmEdicao.nome ||
      formDesc.trim() !== (qrEmEdicao.descricao || '') ||
      formLogo !== (qrEmEdicao.logo || null) ||
      formDispensarId !== qrEmEdicao.dispensarIdentificacao ||
      formCondominioId !== (qrEmEdicao.condominioId || obterCondominioSelecionado('', usuario?.condominioId, condominios)) ||
      formEmailNotif.trim() !== (qrEmEdicao.emailNotificacao || '') ||
      JSON.stringify(formBlocos) !== JSON.stringify(qrEmEdicao.blocos || []) ||
      JSON.stringify(formBlocosCad.filter(bloco => bloco.trim())) !== JSON.stringify((qrEmEdicao.blocosCadastrados || []).filter(bloco => bloco.trim()))
    );
  }, [condominios, formBlocos, formBlocosCad, formCondominioId, formDesc, formDispensarId, formEmailNotif, formLogo, formNome, qrEmEdicao, usuario?.condominioId]);

  const fecharModalQRCode = useCallback(() => {
    if (qrEmEdicao && qrEdicaoAlterada && !globalThis.confirm('Descartar as alterações deste QR Code?')) {
      return;
    }
    setShowCriar(false);
    setFormNome('');
    setFormDesc('');
    setFormLogo(null);
    setFormBlocos([]);
    setFormDispensarId(false);
    setFormBlocosCad(BLOCOS_PADRAO);
    setFormCondominioId(obterCondominioSelecionado('', usuario?.condominioId, condominios));
    setFormEmailNotif('');
    setNovoBlocoNome('');
    setFuncionarioIntegracaoId('');
    setIntegracoesSelecionadas({ ...INTEGRACOES_INICIAIS });
    setQrEmEdicao(null);
  }, [condominios, qrEdicaoAlterada, qrEmEdicao, usuario?.condominioId]);

  const toggleAtivoQR = async (id: string) => {
    if (!tentarAcao()) return;
    const qr = qrcodes.find(q => q.id === id);
    if (!qr) return;
    try {
      await qrcodesApi.update(id, { ...qr, blocos: qr.blocos, ativo: !qr.ativo });
      setQrcodes(prev => prev.map(q => q.id === id ? { ...q, ativo: !q.ativo } : q));
    } catch {}
  };

  const excluirQR = async (id: string) => {
    if (!tentarAcao()) return;
    try {
      await qrcodesApi.remove(id);
      setQrcodes(prev => prev.filter(q => q.id !== id));
    } catch {}
  };

  /* ── Abrir responder ── */
  const abrirResponder = (qr: QRCodeFormulario) => {
    setResponderQR(qr);
    setEtapaResposta(qr.dispensarIdentificacao ? 'formulario' : 'identificacao');
    setIdentificacao({ tipo: '', nome: '', bloco: '', unidade: '', anonimo: false });
    setRespostas({});
  };

  const avancarIdentificacao = () => {
    if (!isIdentificacaoValida(identificacao)) return;
    setEtapaResposta('formulario');
  };

  const toggleAnonimo = useCallback((checked: boolean) => {
    if (checked) {
      setIdentificacao({ tipo: '', nome: '', bloco: '', unidade: '', anonimo: true });
    } else {
      setIdentificacao(prev => ({ ...prev, anonimo: false }));
    }
  }, []);

  const enviarRespostas = async () => {
    if (!responderQR) return;
    try {
      const API_BASE = import.meta.env.VITE_API_URL || '/api';
      await fetch(`${API_BASE}/public/qrcodes/${encodeURIComponent(responderQR.id)}/resposta`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identificacao, respostas }),
      });
    } catch {}
    setQrcodes(prev => prev.map(q => q.id === responderQR.id ? { ...q, respostas: q.respostas + 1 } : q));
    setEtapaResposta('enviado');
  };

  /* ── Download QR code como imagem ── */
  const downloadQR = (qrId: string) => {
    const canvas = document.querySelector(`#qr-canvas-${qrId} canvas`) as HTMLCanvasElement;
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = `qrcode-${qrId}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  if (loading) return <div style={{ padding: 40, textAlign: 'center' }}>Carregando...</div>;

  let headerAcoes: React.ReactNode | undefined;
  if (podeCriarQR) {
    headerAcoes = (
      <button className={styles.addBtn} onClick={() => { resetForm(); setShowCriar(true); }}>
        <Plus size={18} /> <span>Novo QR Code</span>
      </button>
    );
  } else if (ehSupervisor) {
    headerAcoes = (
      <div className={styles.semPermissao}>
        <AlertTriangle size={16} />
        <span>Aguardando autorização do administrador</span>
      </div>
    );
  }

  return (
    <div id="qrcode-content">
      <HowItWorks
        titulo="Criar QR Code"
        descricao="Monte formulários personalizados e gere QR Codes para moradores, funcionários e prestadores responderem."
        passos={[
          'Crie um formulário adicionando blocos: título, fotos, checklist, avaliações, etc.',
          'Opcionalmente importe a logo da empresa para aparecer no QR Code',
          'Defina se deseja dispensar a identificação do respondente',
          'Gere o QR Code e compartilhe — qualquer pessoa pode escanear e responder',
          'Acompanhe as respostas recebidas em cada QR Code',
        ]}
      />

      <PageHeader
        titulo="Criar QR Code"
        subtitulo={`${filtrados.length} formulários`}
        onCompartilhar={() => compartilharConteudo('QR Codes', 'Listagem de QR Codes')}
        onImprimir={() => imprimirElemento('qrcode-content')}
        onGerarPdf={() => gerarPdfDeElemento('qrcode-content', 'qrcodes')}
        acoes={headerAcoes}
      />

      {/* Controle de permissão do supervisor (visível só para admin/master) */}
      {ehMasterOuAdmin && (
        <div className={styles.permCard}>
          <div className={styles.permInfo}>
            <Settings size={18} />
            <div>
              <strong>Permissão do Supervisor</strong>
              <span>Autorizar supervisores a criar QR Codes</span>
            </div>
          </div>
          <button className={`${styles.permToggle} ${supervisorAutorizado ? styles.permToggleOn : ''}`} onClick={toggleSupervisorPerm}>
            <span className={styles.permToggleDot} />
            <span>{supervisorAutorizado ? 'Autorizado' : 'Bloqueado'}</span>
          </button>
        </div>
      )}

      {/* QR Code para Rondas */}
      <button type="button" className={styles.rondasBar} onClick={() => globalThis.location.assign('/rondas')}>
        <div className={styles.permInfo}>
          <MapPin size={18} />
          <div>
            <strong>QR Code para Rondas</strong>
            <span>Gere QR Codes fixos em pontos de ronda — o funcionário escaneia e registra data, horário e GPS automaticamente</span>
          </div>
        </div>
        <ChevronRight size={20} style={{ color: 'var(--cor-texto-secundario)' }} />
      </button>

      {/* QR Codes das Funções */}
      {ehMasterOuAdmin && (
        <div className={styles.funcQrPanel}>
          <button className={styles.funcQrToggle} onClick={() => setShowFuncoesQR(v => !v)}>
            <div className={styles.funcQrToggleLeft}>
              <QrCode size={18} />
              <div>
                <strong>QR Codes das Funções</strong>
                <span>{FUNCOES_QR.length} funções disponíveis — escaneie para ir direto à página</span>
              </div>
            </div>
            <div className={styles.funcQrToggleRight}>
              {showFuncoesQR && (
                <button className={styles.funcQrPrintBtn} onClick={e => { e.stopPropagation(); imprimirQRFuncoes(); }}>
                  <Printer size={15} /> Imprimir A4
                </button>
              )}
              {showFuncoesQR ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
            </div>
          </button>
          {showFuncoesQR && (
            <div className={styles.funcQrGrid} ref={qrFuncoesRef}>
              {FUNCOES_QR.map(f => (
                <div key={f.id} className={styles.funcQrItem} data-qr-item>
                  <QRCodeCanvas value={`${globalThis.location.origin}${f.rota}`} size={90} level="M" />
                  <span className={styles.funcQrLabel}>{f.label}</span>
                  <small className={styles.funcQrUrl}>{f.rota}</small>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ═══ BARRA LARANJA — Respostas Recebidas ═══ */}
      <div className={styles.respostasBar}>
        <button
          className={`${styles.respostasToggle} ${temNovas ? styles.respostasTogglePulse : ''}`}
          onClick={toggleRespostas}
        >
          <div className={styles.respostasToggleLeft}>
            <Inbox size={20} />
            <div>
              <strong>Respostas Recebidas</strong>
              <span>{(() => { const envioLabel = respostasRecebidas.length === 1 ? 'envio' : 'envios'; let novaLabel = ''; if (temNovas) { novaLabel = ` · ${novasRespostas} nova${novasRespostas > 1 ? 's' : ''}`; } return `${respostasRecebidas.length} ${envioLabel}${novaLabel}`; })()}</span>
            </div>
          </div>
          <div className={styles.respostasToggleRight}>
            {temNovas && <span className={styles.respostasBadge}>{novasRespostas}</span>}
            {showRespostas ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
          </div>
        </button>
        {showRespostas && (
          <div className={styles.respostasDropdown}>
            {respostasRecebidas.length === 0 ? (
              <div className={styles.respostasVazio}>
                <Inbox size={28} strokeWidth={1.2} />
                <span>Nenhuma resposta recebida ainda</span>
              </div>
            ) : (
              <div className={styles.respostasLista}>
                {respostasRecebidas.slice(0, 50).map((r: any) => (
                  <div key={r.id} className={styles.respostaItem}>
                    <div className={styles.respostaItemIcone}>
                      <User size={16} />
                    </div>
                    <div className={styles.respostaItemInfo}>
                      <div className={styles.respostaItemTop}>
                        <strong>{r.funcionarioNome || 'Anônimo'}</strong>
                        {r.funcionarioCargo && (
                          <span className={styles.respostaItemTipo}>{r.funcionarioCargo}</span>
                        )}
                      </div>
                      <div className={styles.respostaItemMeta}>
                        <span><QrCode size={11} /> {r.qrNome || 'QR Code'}</span>
                        <span><Clock size={11} /> {formatarDataResp(r.dataHora)}</span>
                        {r.funcionarioEmail && <span><Mail size={11} /> {r.funcionarioEmail}</span>}
                      </div>
                    </div>
                    <button
                      className={styles.respostaItemPdf}
                      title="Gerar PDF"
                      onClick={e => {
                        e.stopPropagation();
                        const blocos = (() => { try { const b = typeof r.qrBlocos === 'string' ? JSON.parse(r.qrBlocos) : r.qrBlocos; return Array.isArray(b) ? b : []; } catch { return []; } })();
                        const respostasForm = typeof r.respostasFormulario === 'string' ? JSON.parse(r.respostasFormulario) : (r.respostasFormulario || {});
                        gerarPdfResposta({ id: r.id, funcionarioNome: r.funcionarioNome || 'Anônimo', funcionarioEmail: r.funcionarioEmail, funcionarioCargo: r.funcionarioCargo, dataHora: r.dataHora, identificacao: typeof r.identificacao === 'string' ? JSON.parse(r.identificacao) : r.identificacao, respostasFormulario: respostasForm, qrNome: r.qrNome || 'QR Code', qrBlocos: blocos } as any);
                      }}
                    >
                      <FileDown size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Busca */}
      <div className={styles.buscaArea}>
        <Search size={18} className={styles.buscaIcon} />
        <input className={styles.buscaInput} placeholder="Buscar QR Codes..." value={busca} onChange={e => setBusca(e.target.value)} />
        {busca && <button className={styles.buscaLimpar} onClick={() => setBusca('')}><X size={16} /></button>}
      </div>

      {/* Lista de QR Codes */}
      <div className={styles.list}>
        {filtrados.length === 0 ? (
          <div className={styles.vazio}>
            <QrCode size={44} strokeWidth={1.2} />
            <span>{qrcodes.length === 0 ? 'Nenhum QR Code criado ainda' : 'Nenhum resultado encontrado'}</span>
          </div>
        ) : filtrados.map(qr => (
          <Card key={qr.id} padding="md" hover>
            <div className={styles.qrCard}>
              <div className={styles.qrCardTop}>
                <div className={styles.qrCardInfo}>
                  <div className={styles.qrCardHeader}>
                    <span className={styles.qrId}><Hash size={12} />{qr.id}</span>
                    <StatusBadge texto={qr.ativo ? 'Ativo' : 'Inativo'} variante={qr.ativo ? 'sucesso' : 'neutro'} />
                  </div>
                  <h4 className={styles.qrNome}>{qr.nome}</h4>
                  {qr.descricao && <p className={styles.qrDesc}>{qr.descricao}</p>}
                  <div className={styles.qrMeta}>
                    <span>{qr.blocos.length} blocos</span>
                    <span>•</span>
                    <span>{qr.respostas} respostas</span>
                    <span>•</span>
                    <span>Por {qr.criadoPor}</span>
                  </div>
                  <div className={styles.qrTags}>
                    {qr.blocos.slice(0, 4).map(b => {
                      const info = BLOCOS_DISPONIVEIS.find(bd => bd.tipo === b.tipo);
                      return <span key={b.id} className={styles.qrTag} style={{ background: info?.cor + '15', color: info?.cor }}>{b.label}</span>;
                    })}
                    {qr.blocos.length > 4 && <span className={styles.qrTag}>+{qr.blocos.length - 4}</span>}
                  </div>
                </div>
                <div className={styles.qrCardPreview} id={`qr-canvas-${qr.id}`}>
                  <QRCodeCanvas
                    value={`${globalThis.location.origin}/qrcode/responder/${qr.id}`}
                    size={110}
                    level="H"
                    imageSettings={qr.logo ? { src: qr.logo, height: 24, width: 24, excavate: true } : undefined}
                  />
                </div>
              </div>
              <div className={styles.qrCardActions}>
                <button className={styles.btnResponder} onClick={() => abrirResponder(qr)}>
                  <Eye size={14} /> Responder
                </button>
                <button className={styles.btnPreview} onClick={() => setPreviewQR(qr)}>
                  <QrCode size={14} /> Ver QR Code
                </button>
                {podeCriarQR && (
                  <button className={styles.btnPreview} onClick={() => editarQRCode(qr)}>
                    <PenTool size={14} /> Editar
                  </button>
                )}
                <button className={styles.btnDownload} onClick={() => downloadQR(qr.id)}>
                  <Download size={14} /> Baixar
                </button>
                {podeCriarQR && (
                  <>
                    <button className={styles.btnToggle} onClick={() => toggleAtivoQR(qr.id)}>
                      {qr.ativo ? 'Desativar' : 'Ativar'}
                    </button>
                    <button className={styles.btnExcluir} onClick={() => excluirQR(qr.id)}>
                      <Trash2 size={14} />
                    </button>
                  </>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* ═══ MODAL: Criar QR Code ═══ */}
      <Modal aberto={showCriar} onFechar={fecharModalQRCode} titulo={qrEmEdicao ? 'Editar QR Code' : 'Criar QR Code'} largura="lg">
        <div className={styles.criarForm}>
          {qrEmEdicao && (
            <div className={styles.editingBanner}>
              <PenTool size={16} /> Você está editando este QR Code. As respostas já recebidas serão preservadas.
            </div>
          )}
          {/* Identificação */}
          <div className={styles.formSection}>
            <h4 className={styles.formSectionTitle}>Identificação do Respondente</h4>
            <label className={styles.checkboxLabel}>
              <input type="checkbox" checked={formDispensarId} onChange={e => setFormDispensarId(e.target.checked)} />
              <span>Dispensar identificação do usuário</span>
            </label>
            <div className={styles.identificacaoAviso}>
              <p className={styles.formHint}>Se desmarcado, o respondente deverá se identificar antes de acessar o formulário.</p>
              <div className={styles.identificacaoDestaque}>
                Morador/funcionário/prestador, bloco e unidade
              </div>
            </div>
          </div>

          {/* Informações básicas */}
          <div className={styles.formSection}>
            <h4 className={styles.formSectionTitle}>Informações</h4>
            <div className={styles.formGrid}>
              <div className={styles.formGroupFull}>
                <label className={styles.formLabel} htmlFor="qr-form-condominio">Condomínio</label>
                <select
                  id="qr-form-condominio"
                  className={styles.formSelect}
                  value={formCondominioId}
                  onChange={e => setFormCondominioId(e.target.value)}
                  disabled={condominios.length === 0}
                >
                  {condominios.length === 0 ? (
                    <option value="">Nenhum condomínio disponível</option>
                  ) : (
                    condominios.map(condominio => (
                      <option key={condominio.id} value={condominio.id}>{condominio.nome}</option>
                    ))
                  )}
                </select>
              </div>
              <div className={styles.formGroupFull}>
                <label className={styles.formLabel} htmlFor="qr-form-nome">Nome do Formulário *</label>
                <input id="qr-form-nome" className={styles.formInput} placeholder="Ex: Pesquisa de Satisfação" value={formNome} onChange={e => setFormNome(e.target.value)} />
              </div>
              <div className={styles.formGroupFull}>
                <label className={styles.formLabel} htmlFor="qr-form-desc">Descrição</label>
                <input id="qr-form-desc" className={styles.formInput} placeholder="Descrição breve..." value={formDesc} onChange={e => setFormDesc(e.target.value)} />
              </div>
              <div className={styles.formGroupFull}>
                <label className={styles.formLabel} htmlFor="qr-form-email-notif">E-mail para notificação de respostas</label>
                <input
                  id="qr-form-email-notif"
                  className={styles.formInput}
                  type="email"
                  placeholder="Ex: sindico@condominio.com.br (deixe em branco para usar o e-mail do criador)"
                  value={formEmailNotif}
                  onChange={e => setFormEmailNotif(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Logo */}
          <div className={styles.formSection}>
            <h4 className={styles.formSectionTitle}>Logo da Empresa</h4>
            <div className={styles.logoArea}>
              {formLogo ? (
                <div className={styles.logoPreview}>
                  <img src={formLogo} alt="Logo" />
                  <button className={styles.logoRemover} onClick={() => setFormLogo(null)}><X size={14} /></button>
                </div>
              ) : (
                <button className={styles.logoUploadBtn} onClick={() => logoInputRef.current?.click()}>
                  <Upload size={20} />
                  <span>Importar Logo</span>
                  <small>Insira sua logo para personalizar o QR Code</small>
                </button>
              )}
              <input ref={logoInputRef} type="file" accept="image/*" hidden onChange={handleLogoUpload} />
            </div>
          </div>

          {/* Blocos cadastrados */}
          <div className={styles.formSection}>
            <h4 className={styles.formSectionTitle}>Blocos do Condomínio</h4>
            <p className={styles.formHint} style={{ background: '#fff3e0', padding: '10px 14px', borderRadius: 'var(--raio-borda-sm)', border: '1px solid #ffe0b2', color: '#bf360c' }}>
              <strong>Atenção:</strong> Só é necessário cadastrar os blocos caso exija a identificação do usuário. Se a identificação estiver dispensada, não precisa cadastrar os blocos.
            </p>
            <div className={styles.blocosTagList}>
              {formBlocosCad.map((b, i) => (
                <span key={`bloco-cad-${b}-${i}`} className={styles.blocoTag}>
                  {b}
                  <button onClick={() => removerBlocoCad(i)}><X size={10} /></button>
                </span>
              ))}
              <div className={styles.blocosAddRow}>
                <input className={styles.formInputSm} placeholder="Novo bloco..." value={novoBlocoNome} onChange={e => setNovoBlocoNome(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && novoBlocoNome.trim()) { setFormBlocosCad(prev => [...prev, novoBlocoNome.trim()]); setNovoBlocoNome(''); } }} />
                <button className={styles.blocosAddBtn} onClick={() => { if (novoBlocoNome.trim()) { setFormBlocosCad(prev => [...prev, novoBlocoNome.trim()]); setNovoBlocoNome(''); } }}>
                  <Plus size={14} />
                </button>
              </div>
            </div>
          </div>

          {/* Criar QR Code */}
          <div className={styles.formSection}>
            <h4 className={styles.formSectionTitle}>Criar QR Code</h4>
            <p className={styles.formHint}>Adicione os campos que deseja no formulário. O respondente preencherá nessa ordem.</p>

            {/* Favoritos */}
            {favoritos.length > 0 && (
              <div className={styles.favSection}>
                <h5 className={styles.favTitulo}><Heart size={14} /> Favoritos</h5>
                <div className={styles.favGrid}>
                  {favoritos.map(tipo => {
                    const bd = BLOCOS_DISPONIVEIS.find(b => b.tipo === tipo);
                    if (!bd) return null;
                    return (
                      <div key={bd.tipo} className={styles.blocoAddCardWrap}>
                        <button
                          type="button"
                          className={styles.blocoAddCard}
                          onClick={() => adicionarBloco(bd.tipo)}
                        >
                          <span className={styles.blocoAddIcon} style={{ background: bd.cor + '18', color: bd.cor }}>{bd.icone}</span>
                          <span>{bd.label}</span>
                        </button>
                        <button
                          type="button"
                          className={`${styles.favBtn} ${styles.favBtnAtivo}`}
                          onClick={() => toggleFavorito(bd.tipo)}
                          title="Remover dos favoritos"
                        >
                          <Heart size={12} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className={styles.blocosCatalogoLista}>
              {BLOCOS_SECOES.map(secao => {
                const blocosDaSecao = secao.tipos
                  .map(tipo => BLOCOS_DISPONIVEIS.find(bloco => bloco.tipo === tipo))
                  .filter((bloco): bloco is BlocoCatalogoItem => !!bloco);

                return (
                  <section key={secao.id} className={styles.blocosCatalogoSection}>
                    <div className={styles.blocosCatalogoHeader}>
                      <h5 className={styles.blocosCatalogoTitulo}>{secao.titulo}</h5>
                      <p className={styles.blocosCatalogoDescricao}>{secao.descricao}</p>
                    </div>
                    <div className={styles.blocosGrid}>
                      {blocosDaSecao.map(bd => (
                        <div key={bd.tipo} className={styles.blocoAddCardWrap}>
                          <button
                            type="button"
                            className={styles.blocoAddCard}
                            onClick={() => adicionarBloco(bd.tipo)}
                          >
                            <span className={styles.blocoAddIcon} style={{ background: bd.cor + '18', color: bd.cor }}>{bd.icone}</span>
                            <span>{bd.label}</span>
                          </button>
                          <button
                            type="button"
                            className={`${styles.favBtn} ${favoritos.includes(bd.tipo) ? styles.favBtnAtivo : ''}`}
                            onClick={() => toggleFavorito(bd.tipo)}
                            title={favoritos.includes(bd.tipo) ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
                          >
                            <Heart size={12} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </section>
                );
              })}
            </div>

            {formBlocos.length > 0 && (
              <div className={styles.blocosBuildList}>
                <h5 className={styles.blocosSubtitle}>{formBlocos.length} blocos adicionados</h5>
                {formBlocos.map(bloco => (
                  <BlocoBuilderItem
                    key={bloco.id}
                    bloco={bloco}
                    atualizarBloco={atualizarBloco}
                    atualizarOpcao={atualizarOpcao}
                    removerOpcao={removerOpcao}
                    adicionarOpcao={adicionarOpcao}
                    removerBloco={removerBloco}
                    mostrarToast={mostrarToast}
                  />
                ))}
              </div>
            )}
          </div>

          {!qrEmEdicao && (
            <div className={styles.formSection}>
              <h4 className={styles.formSectionTitle}>Integrações com o Sistema do Funcionário</h4>
              <p className={styles.formHint}>Selecione os módulos que devem ser enviados ao funcionário. O sistema cria os registros já vinculados ao condomínio e ao colaborador escolhido.</p>

              <div className={styles.integracaoGrid}>
                {INTEGRACOES_FUNCIONARIO.map(integracao => (
                  <label key={integracao.id} className={styles.integracaoItem} aria-label={integracao.label}>
                    <input
                      type="checkbox"
                      aria-label={integracao.label}
                      checked={integracoesSelecionadas[integracao.id]}
                      onChange={() => alternarIntegracao(integracao.id)}
                    />
                    <div>
                      <strong>{integracao.label}</strong>
                      <span>{integracao.descricao}</span>
                    </div>
                  </label>
                ))}
              </div>

              <div className={styles.integracaoSelectors}>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel} htmlFor="qr-integracao-condominio">Condomínio</label>
                  <select
                    id="qr-integracao-condominio"
                    className={styles.formSelect}
                    value={formCondominioId}
                    onChange={e => setFormCondominioId(e.target.value)}
                    disabled={condominios.length === 0}
                  >
                    {condominios.length === 0 ? (
                      <option value="">Nenhum condomínio disponível</option>
                    ) : (
                      condominios.map(condominio => (
                        <option key={condominio.id} value={condominio.id}>{condominio.nome}</option>
                      ))
                    )}
                  </select>
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel} htmlFor="qr-integracao-funcionario">Funcionário</label>
                  <select
                    id="qr-integracao-funcionario"
                    className={styles.formSelect}
                    value={funcionarioIntegracaoId}
                    onChange={e => setFuncionarioIntegracaoId(e.target.value)}
                    disabled={funcionariosFiltrados.length === 0}
                  >
                    {funcionariosFiltrados.length === 0 ? (
                      <option value="">Nenhum funcionário disponível</option>
                    ) : (
                      funcionariosFiltrados.map(funcionario => (
                        <option key={funcionario.id} value={funcionario.id}>
                          {funcionario.nome}{funcionario.cargo ? ` · ${funcionario.cargo}` : ''}
                        </option>
                      ))
                    )}
                  </select>
                </div>
              </div>

              <button
                type="button"
                className={styles.integracaoSubmit}
                onClick={enviarIntegracoesFuncionario}
                disabled={enviandoIntegracoes}
              >
                <UserCheck size={18} /> {enviandoIntegracoes ? 'Enviando...' : 'Enviar para o Funcionário'}
              </button>
            </div>
          )}

          {/* Botão criar */}
          <div className={styles.formActions}>
            <button className={styles.secondaryButton} onClick={fecharModalQRCode}>
              Cancelar
            </button>
            <button className={styles.formSubmit} onClick={criarQRCode} disabled={!formNome.trim() || formBlocos.length === 0}>
              <QrCode size={18} /> {qrEmEdicao ? 'Salvar Alterações' : 'Gerar QR Code'}
            </button>
          </div>
        </div>
      </Modal>

      {/* ═══ MODAL: Preview QR Code ═══ */}
      <Modal aberto={!!previewQR} onFechar={() => setPreviewQR(null)} titulo="QR Code" largura="sm">
        {previewQR && (
          <div className={styles.previewModal}>
            <div className={styles.previewQR}>
              <QRCodeCanvas
                value={`${globalThis.location.origin}/qrcode/responder/${previewQR.id}`}
                size={240}
                level="H"
                imageSettings={previewQR.logo ? { src: previewQR.logo, height: 40, width: 40, excavate: true } : undefined}
              />
            </div>
            <h4 className={styles.previewNome}>{previewQR.nome}</h4>
            {previewQR.descricao && <p className={styles.previewDesc}>{previewQR.descricao}</p>}
            <div className={styles.previewUrl}>
              <code>{`${globalThis.location.origin}/qrcode/responder/${previewQR.id}`}</code>
              <button onClick={() => navigator.clipboard.writeText(`${globalThis.location.origin}/qrcode/responder/${previewQR.id}`)}><Copy size={14} /></button>
            </div>
            <div className={styles.previewActions}>
              <button className={styles.btnResponder} onClick={() => { setPreviewQR(null); abrirResponder(previewQR); }}>
                <Eye size={14} /> Testar Resposta
              </button>
              <button className={styles.btnDownload} onClick={() => {
                const canvas = document.querySelector(`.${styles.previewQR} canvas`) as HTMLCanvasElement;
                if (!canvas) return;
                const link = document.createElement('a');
                link.download = `qrcode-${previewQR.id}.png`;
                link.href = canvas.toDataURL('image/png');
                link.click();
              }}>
                <Download size={14} /> Baixar PNG
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* ═══ MODAL: Responder QR Code ═══ */}
      <Modal aberto={!!responderQR} onFechar={() => setResponderQR(null)} titulo={responderQR?.nome || 'Formulário'} largura="md">
        {responderQR && etapaResposta === 'identificacao' && (
          <div className={styles.idForm}>
            <h4 className={styles.idTitulo}>Identificação</h4>
            <p className={styles.idDesc}>Por favor, identifique-se antes de continuar.</p>

            {/* Tipo */}
            <span className={styles.formLabel}>Você é:</span>
            <div className={styles.idTipoGrid}>
              {([
                { val: 'morador', label: 'Morador', icon: <Home size={20} /> },
                { val: 'funcionario', label: 'Funcionário', icon: <UserCheck size={20} /> },
                { val: 'prestador', label: 'Prestador', icon: <Building2 size={20} /> },
              ] as const).map(t => (
                <button key={t.val}
                  className={`${styles.idTipoBtn} ${identificacao.tipo === t.val ? styles.idTipoBtnAtivo : ''}`}
                  onClick={() => setIdentificacao(prev => ({ ...prev, tipo: t.val }))}
                >
                  {t.icon}
                  <span>{t.label}</span>
                </button>
              ))}
            </div>

            {/* Nome */}
            <label className={styles.formLabel} htmlFor="qr-resp-nome">Seu Nome</label>
            <input id="qr-resp-nome" className={styles.formInput} placeholder="Digite seu nome completo..." value={identificacao.nome} onChange={e => setIdentificacao(prev => ({ ...prev, nome: e.target.value }))} />

            {/* Bloco */}
            <label className={styles.formLabel} htmlFor="qr-resp-bloco">Bloco</label>
            <select id="qr-resp-bloco" className={styles.formSelect} value={identificacao.bloco} onChange={e => setIdentificacao(prev => ({ ...prev, bloco: e.target.value }))}>
              <option value="">Selecione o bloco...</option>
              {responderQR.blocosCadastrados.map(b => <option key={b} value={b}>{b}</option>)}
            </select>

            {/* Unidade */}
            <label className={styles.formLabel} htmlFor="qr-resp-unidade">Apartamento / Casa</label>
            <input id="qr-resp-unidade" className={styles.formInput} placeholder="Ex: 204, Casa 12..." value={identificacao.unidade} onChange={e => setIdentificacao(prev => ({ ...prev, unidade: e.target.value }))} />

            {/* Anônimo */}
            <label className={`${styles.checkboxLabel} ${styles.checkboxDestaque}`}>
              <input type="checkbox" checked={identificacao.anonimo}
                onChange={e => toggleAnonimo(e.target.checked)} />
              <span>Não quero me identificar</span>
            </label>

            <button className={styles.formSubmit}
              onClick={avancarIdentificacao}
              disabled={!isIdentificacaoValida(identificacao)}>
              Continuar <ChevronRight size={16} />
            </button>
          </div>
        )}

        {responderQR && etapaResposta === 'formulario' && (
          <div className={styles.respForm}>
            {responderQR.logo && (
              <div className={styles.respLogo}>
                <img src={responderQR.logo} alt="Logo" />
              </div>
            )}
            {responderQR.descricao && <p className={styles.respDesc}>{responderQR.descricao}</p>}

            <div className={styles.respBlocos}>
              {responderQR.blocos.map(bloco => (
                <BlocoRespostaItem
                  key={bloco.id}
                  bloco={bloco}
                  valor={respostas[bloco.id]}
                  updateResposta={updateResposta}
                  updateRespostaProp={updateRespostaProp}
                  removeRespostaFoto={removeRespostaFoto}
                  removeGalleryItem={removeGalleryItem}
                  processGalleryFiles={processGalleryFiles}
                  processPhotoFile={processPhotoFile}
                  updateChecklistItem={updateChecklistItem}
                  updatePerguntaItem={updatePerguntaItem}
                  updatePesquisaItem={updatePesquisaItem}
                  setRespostas={setRespostas}
                />
              ))}
            </div>

            <button className={styles.formSubmit} onClick={enviarRespostas}>
              Enviar Respostas
            </button>
          </div>
        )}

        {responderQR && etapaResposta === 'enviado' && (
          <div className={styles.enviadoMsg}>
            <div className={styles.enviadoIcone}>
              <CheckSquare size={48} />
            </div>
            <h4>Respostas enviadas!</h4>
            <p>Obrigado por participar. Suas respostas foram registradas com sucesso.</p>
            <button className={styles.formSubmit} onClick={() => setResponderQR(null)}>Fechar</button>
          </div>
        )}
      </Modal>
      {/* Toast de feedback */}
      {toast && (
        <div className={styles.toast} style={{ borderLeftColor: toast.cor }}>
          <span>{toast.msg}</span>
        </div>
      )}
    </div>
  );
};

export default QRCodePage;
