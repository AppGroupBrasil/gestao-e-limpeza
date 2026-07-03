import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Building2, Wrench, ClipboardCheck, Calendar, Eye, FileWarning,
  Package, Search, MapPin, BarChart3, Shield, Settings, QrCode,
  ScanLine, Flame, CalendarCheck, BookOpen, CalendarClock, Contact,
  Megaphone, Columns3, Users, ChevronRight, CheckCircle2, ArrowRight,
  Menu, X, Star, Zap, Lock, BarChart2, Smartphone, MessageCircle, Code2,
  FileText, Hotel, GraduationCap, Stethoscope, ShoppingCart, Landmark,
  Warehouse, Plane, Dumbbell, Factory
} from 'lucide-react';
import styles from './Landing.module.css';
import contratoStyles from './Contrato.module.css';
import ContratoModal from './ContratoModal';
import logoImg from '../../assets/logo.png';

interface Funcionalidade {
  icon: React.ReactNode;
  titulo: string;
  descricao: string;
  destaque?: boolean;
}

const FUNCIONALIDADES: Funcionalidade[] = [
  {
    icon: <Wrench size={28} />,
    titulo: 'Ordens de Serviço',
    descricao: 'Crie, atribua e acompanhe ordens de serviço de limpeza, manutenção, emergência e preventiva com rastreamento de status em tempo real, prioridade e avaliação do serviço.',
    destaque: true,
  },
  {
    icon: <ClipboardCheck size={28} />,
    titulo: 'Checklists de Limpeza',
    descricao: 'Monte checklists personalizados por área do condomínio com frequência diária, semanal ou mensal. Funcionários marcam itens concluídos e reportam problemas com fotos.',
    destaque: true,
  },
  {
    icon: <Columns3 size={28} />,
    titulo: 'Quadro de Atividades',
    descricao: 'Organize tarefas em formato Kanban com colunas de status. Arraste cartões entre A Fazer, Em Andamento, Em Revisão e Concluído. Defina prioridade, rotina e acompanhe o histórico completo.',
    destaque: true,
  },
  {
    icon: <BookOpen size={28} />,
    titulo: 'Roteiro de Execução',
    descricao: 'Crie roteiros visuais passo a passo com fotos e vídeos para guiar funcionários. Visualização em formato Story com checklist de progresso e registro de antes/depois.',
  },
  {
    icon: <CalendarCheck size={28} />,
    titulo: 'Tarefas Agendadas',
    descricao: 'Agende tarefas por data específica, diárias, semanais ou mensais. Funcionários registram execução com foto, áudio e geolocalização automática.',
  },
  {
    icon: <Calendar size={28} />,
    titulo: 'Escalas de Trabalho',
    descricao: 'Monte escalas por funcionário com dia, horário e local. Visualize a grade semanal completa e acompanhe tarefas agendadas, roteiros e atividades por colaborador.',
  },
  {
    icon: <Eye size={28} />,
    titulo: 'Vistorias',
    descricao: 'Realize vistorias detalhadas com galeria de fotos, descrições, status de conformidade e prioridade para cada item inspecionado.',
  },
  {
    icon: <FileWarning size={28} />,
    titulo: 'Central de Reportes',
    descricao: 'Todos os problemas reportados nos checklists são centralizados automaticamente. Busque por protocolo, filtre por status e prioridade, e atualize diretamente.',
  },
  {
    icon: <Building2 size={28} />,
    titulo: 'Gestão de Condomínios',
    descricao: 'Cadastre condomínios com blocos, unidades, síndico responsável e equipes vinculadas. Cada condomínio tem seus dados, ordens e checklists separados.',
  },
  {
    icon: <QrCode size={28} />,
    titulo: 'Criar QR Code',
    descricao: 'Monte formulários personalizados com fotos, checklists e avaliações. Gere QR Codes para moradores, funcionários e prestadores responderem pelo celular.',
  },
  {
    icon: <ScanLine size={28} />,
    titulo: 'Leitor de QR Code',
    descricao: 'Escaneie QR Codes pela câmera ou imagem. O sistema captura automaticamente identificação, localização GPS, data e hora de cada leitura.',
  },
  {
    icon: <Package size={28} />,
    titulo: 'Controle de Estoque',
    descricao: 'Gerencie materiais de limpeza e manutenção por condomínio. Registre entradas e saídas com fotos e nota fiscal. Alertas automáticos quando o estoque está baixo.',
  },
  {
    icon: <Search size={28} />,
    titulo: 'Inspeções',
    descricao: 'Inspeções detalhadas de áreas comuns, elevadores, piscina, garagem, jardim e fachada com checklist específico, fotos e relatório automático.',
  },
  {
    icon: <MapPin size={28} />,
    titulo: 'Geolocalização',
    descricao: 'Rastreio GPS em tempo real de funcionários com atualização a cada 30 segundos. Histórico filtrável por dia, semana, mês ou data específica.',
  },
  {
    icon: <Flame size={28} />,
    titulo: 'Mapa de Calor',
    descricao: 'Identifique visualmente quais espaços e categorias geram mais problemas. Filtre por período, condomínio, bloco, status e prioridade.',
  },
  {
    icon: <CalendarClock size={28} />,
    titulo: 'Agenda de Vencimentos',
    descricao: 'Cadastre vencimentos de contratos, serviços e manutenções. Configure alertas por e-mail com até 3 avisos de antecedência.',
  },
  {
    icon: <Megaphone size={28} />,
    titulo: 'Comunicados e Avisos',
    descricao: 'Envie comunicados em PDF ou avisos rápidos por e-mail para moradores. Segmentação por morador, bloco ou condomínio inteiro, com pré-visualização do e-mail.',
  },
  {
    icon: <Contact size={28} />,
    titulo: 'Cadastro de Moradores',
    descricao: 'Registre moradores individualmente ou importe em lote via planilha Excel/CSV. Busque e filtre por condomínio, bloco ou nome.',
  },
  {
    icon: <Users size={28} />,
    titulo: 'Cadastro de Usuários',
    descricao: 'Gerencie usuários com hierarquia completa: Master, Administrador, Supervisor e Funcionário. Controle de bloqueio, ativação de funções e permissões.',
  },
  {
    icon: <BarChart3 size={28} />,
    titulo: 'Relatórios e Gráficos',
    descricao: 'Relatórios completos com gráficos de barras, linhas, pizza e área. Análise de OS, checklists, materiais, produtividade, satisfação e custos.',
  },
  {
    icon: <Shield size={28} />,
    titulo: 'Permissões',
    descricao: 'Configure quais funções cada perfil pode acessar. Master tem acesso irrestrito; demais perfis são configuráveis por função.',
  },
  {
    icon: <Settings size={28} />,
    titulo: 'Configurações e Personalização',
    descricao: 'Personalize cores do menu, botões e fundo. Alterne entre modo claro e escuro. Cada condomínio pode ter sua marca na tela de login.',
  },
];

const DIFERENCIAIS = [
  { icon: <Smartphone size={22} />, texto: '100% responsivo — funciona em qualquer dispositivo' },
  { icon: <Zap size={22} />, texto: 'Interface rápida e intuitiva, sem necessidade de treinamento' },
  { icon: <Lock size={22} />, texto: 'Hierarquia de permissões com 4 níveis de acesso' },
  { icon: <BarChart2 size={22} />, texto: 'Relatórios e dashboards em tempo real' },
  { icon: <Star size={22} />, texto: 'Personalização visual por condomínio' },
  { icon: <CheckCircle2 size={22} />, texto: 'Registro com foto, áudio, GPS e timestamp automático' },
];

const LandingPage: React.FC = () => {
  const navigate = useNavigate();
  const [menuAberto, setMenuAberto] = useState(false);
  const [planoContrato, setPlanoContrato] = useState<{ nome: string; preco: string; usuarios: string; descricao: string } | null>(null);

  const scrollTo = (id: string) => {
    setMenuAberto(false);
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className={styles.page}>
      {/* ═══ NAVBAR ═══ */}
      <nav className={styles.navbar}>
        <div className={styles.navContainer}>
          <div className={styles.navBrand} onClick={() => scrollTo('hero')}>
            <img src={logoImg} alt="Gestão e Limpeza" className={styles.navLogoImg} style={{ width: 48, height: 48, borderRadius: 10, objectFit: 'contain' }} />
          </div>

          <div className={`${styles.navLinks} ${menuAberto ? styles.navLinksOpen : ''}`}>
            <button className={styles.navLink} onClick={() => scrollTo('funcionalidades')}>Funcionalidades</button>
            <button className={styles.navLink} onClick={() => scrollTo('diferenciais')}>Diferenciais</button>
            <button className={styles.navLink} onClick={() => scrollTo('planos')}>Planos</button>
            <button className={styles.navLink} onClick={() => scrollTo('contrato')}>Contrato</button>
            <button className={styles.navCta} onClick={() => navigate('/login')}>
              Acessar Sistema <ArrowRight size={16} />
            </button>
          </div>

          <button className={styles.navHamburger} onClick={() => setMenuAberto(!menuAberto)}>
            {menuAberto ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </nav>

      {/* ═══ HERO ═══ */}
      <section id="hero" className={styles.hero}>
        <div className={styles.heroContent}>
          <div className={styles.heroBadge}>
            <Zap size={14} /> Sistema Completo para Condomínios
          </div>
          <h1 className={styles.heroTitle}>
            Gestão Inteligente de<br />
            <span className={styles.heroHighlight}>Limpeza e Manutenção</span>
          </h1>
          <p className={styles.heroSubtitle}>
            Controle total de ordens de serviço, checklists, escalas, vistorias, estoque,
            comunicados e muito mais — tudo em uma única plataforma profissional.
          </p>
          <div className={styles.heroActions}>
            <button className={styles.btnPrimario} onClick={() => navigate('/login')}>
              Começar Agora <ArrowRight size={18} />
            </button>
            <button className={styles.btnSecundario} onClick={() => navigate('/login')}>
              Ver Tutorial <ChevronRight size={18} />
            </button>
          </div>
          <div className={styles.heroStats}>
            <div className={styles.heroStat}>
              <span className={styles.heroStatNum}>22+</span>
              <span className={styles.heroStatLabel}>Módulos</span>
            </div>
            <div className={styles.heroStatDivider} />
            <div className={styles.heroStat}>
              <span className={styles.heroStatNum}>4</span>
              <span className={styles.heroStatLabel}>Perfis de Acesso</span>
            </div>
            <div className={styles.heroStatDivider} />
            <div className={styles.heroStat}>
              <span className={styles.heroStatNum}>100%</span>
              <span className={styles.heroStatLabel}>Responsivo</span>
            </div>
          </div>
        </div>
        <div className={styles.heroVisual}>
          <div className={styles.heroCard}>
            <div className={styles.heroCardHeader}>
              <div className={styles.heroCardDot} style={{ background: '#ef4444' }} />
              <div className={styles.heroCardDot} style={{ background: '#f59e0b' }} />
              <div className={styles.heroCardDot} style={{ background: '#22c55e' }} />
            </div>
            <div className={styles.heroCardBody}>
              {[
                { icon: <Wrench size={18} />, label: 'Ordens de Serviço', color: '#f57c00' },
                { icon: <ClipboardCheck size={18} />, label: 'Checklists', color: '#00897b' },
                { icon: <Calendar size={18} />, label: 'Escalas', color: '#f57c00' },
                { icon: <Eye size={18} />, label: 'Vistorias', color: '#7b1fa2' },
                { icon: <Package size={18} />, label: 'Estoque', color: '#d32f2f' },
                { icon: <MapPin size={18} />, label: 'Geolocalização', color: '#0288d1' },
              ].map((item, i) => (
                <div key={i} className={styles.heroCardItem}>
                  <div className={styles.heroCardIcon} style={{ background: `${item.color}15`, color: item.color }}>
                    {item.icon}
                  </div>
                  <span>{item.label}</span>
                  <CheckCircle2 size={16} className={styles.heroCardCheck} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ═══ SETORES DE ATUAÇÃO ═══ */}
      <section className={styles.setores}>
        <div className={styles.sectionContainer}>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionTag}>Setores</span>
            <h2 className={styles.sectionTitle}>Setores de Atuação</h2>
            <p className={styles.sectionSubtitle}>Solução ideal para diversos segmentos que precisam de gestão de limpeza e manutenção</p>
          </div>

          <div className={styles.setoresGrid}>
            {[
              { icon: <Building2 size={32} />, nome: 'Condomínios' },
              { icon: <Hotel size={32} />, nome: 'Hotéis e Pousadas' },
              { icon: <Stethoscope size={32} />, nome: 'Hospitais e Clínicas' },
              { icon: <ShoppingCart size={32} />, nome: 'Shopping Centers' },
              { icon: <GraduationCap size={32} />, nome: 'Escolas e Universidades' },
              { icon: <Landmark size={32} />, nome: 'Órgãos Públicos' },
              { icon: <Factory size={32} />, nome: 'Indústrias' },
              { icon: <Warehouse size={32} />, nome: 'Galpões e Armazéns' },
              { icon: <Plane size={32} />, nome: 'Aeroportos e Terminais' },
              { icon: <Dumbbell size={32} />, nome: 'Academias e Clubes' },
            ].map((setor, i) => (
              <div key={i} className={styles.setorCard}>
                <div className={styles.setorIcon}>{setor.icon}</div>
                <span className={styles.setorNome}>{setor.nome}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ FUNCIONALIDADES ═══ */}
      <section id="funcionalidades" className={styles.funcionalidades}>
        <div className={styles.sectionContainer}>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionTag}>Funcionalidades</span>
            <h2 className={styles.sectionTitle}>Tudo que você precisa em um único sistema</h2>
            <p className={styles.sectionSubtitle}>
              Mais de 22 módulos integrados para uma gestão completa do seu condomínio
            </p>
          </div>

          <div className={styles.funcGrid}>
            {FUNCIONALIDADES.map((func, i) => (
              <div key={i} className={`${styles.funcCard} ${func.destaque ? styles.funcCardDestaque : ''}`}>
                <div className={styles.funcIcon}>{func.icon}</div>
                <h3 className={styles.funcTitulo}>{func.titulo}</h3>
                <p className={styles.funcDescricao}>{func.descricao}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ DIFERENCIAIS ═══ */}
      <section id="diferenciais" className={styles.diferenciais}>
        <div className={styles.sectionContainer}>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionTag}>Por que escolher o Gestão e Limpeza?</span>
            <h2 className={styles.sectionTitle}>Diferenciais que fazem a diferença</h2>
          </div>

          <div className={styles.difGrid}>
            {DIFERENCIAIS.map((dif, i) => (
              <div key={i} className={styles.difCard}>
                <div className={styles.difIcon}>{dif.icon}</div>
                <span className={styles.difTexto}>{dif.texto}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ PERFIS ═══ */}
      <section className={styles.perfis}>
        <div className={styles.sectionContainer}>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionTag}>Hierarquia</span>
            <h2 className={styles.sectionTitle}>4 Perfis de Acesso</h2>
            <p className={styles.sectionSubtitle}>Cada perfil tem permissões específicas para uma gestão segura e organizada</p>
          </div>

          <div className={styles.perfisGrid}>
            {[
              { perfil: 'Administrador', descricao: 'Gerencia condomínios, usuários e permissões. Configura escalas, relatórios, comunicados, estoque, vencimentos, QR Codes por função e personalização visual do sistema.', cor: '#f57c00' },
              { perfil: 'Supervisor', descricao: 'Acompanha equipes em campo. Cria tarefas, roteiros de execução, checklists, vistorias e inspeções. Gerencia o quadro de atividades e a escala de trabalho.', cor: '#0288d1' },
              { perfil: 'Funcionário', descricao: 'Executa tarefas do dia, marca checklists e roteiros passo a passo. Registra execuções com foto, áudio e GPS. Escaneia QR Codes, bate ponto e reporta problemas.', cor: '#00897b' },
              { perfil: 'Morador', descricao: 'Resolve tudo pelo QR Code, sem necessidade de aplicativo. Responde formulários, avalia serviços e reporta ocorrências diretamente pelo celular.', cor: '#7b1fa2' },
            ].map((p, i) => (
              <div key={i} className={styles.perfilCard}>
                <div className={styles.perfilBadge} style={{ background: `${p.cor}12`, color: p.cor, borderColor: `${p.cor}30` }}>
                  {p.perfil}
                </div>
                <p className={styles.perfilDesc}>{p.descricao}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ PREÇOS E PLANOS ═══ */}
      <section id="planos" className={styles.planos}>
        <div className={styles.sectionContainer}>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionTag}>Preços</span>
            <h2 className={styles.sectionTitle}>Planos e Preços</h2>
            <p className={styles.sectionSubtitle}>Escolha o plano ideal para o tamanho da sua operação</p>
          </div>

          <div className={styles.planosGrid}>
            {[
              { nome: 'Por Condomínio', preco: '199', descricao: '1 condomínio · usuários ilimitados' },
              { nome: 'Administradoras e Facility', preco: '350', descricao: 'Condomínios e usuários ilimitados' },
            ].map((plano, i) => (
              <div key={i} className={styles.planoCard}>
                <h3 className={styles.planoNome}>{plano.nome}</h3>
                <div className={styles.planoPreco}>
                  <span className={styles.planoCifrao}>R$</span>
                  <span className={styles.planoValor}>{plano.preco}</span>
                  <span className={styles.planoPeriodo}>/mês</span>
                </div>
                <p className={styles.planoDesc}>{plano.descricao}</p>
                <ul className={styles.planoFeatures}>
                  <li><CheckCircle2 size={16} /> <strong>Usuários ilimitados</strong></li>
                  <li><CheckCircle2 size={16} /> Todos os 22+ módulos</li>
                  <li><CheckCircle2 size={16} /> Suporte por WhatsApp</li>
                  <li><CheckCircle2 size={16} /> Atualizações inclusas</li>
                </ul>
                <button className={styles.btnPrimario} onClick={() => navigate('/login')}>
                  Começar Agora <ArrowRight size={16} />
                </button>
              </div>
            ))}
          </div>

          <p className={styles.planosNota}>
            Precisa de mais usuários? <a href="https://wa.me/5511933284364" target="_blank" rel="noopener noreferrer" className={styles.planosNotaLink}>Entre em contato com o suporte.</a>
          </p>
        </div>
      </section>

      {/* ═══ DESENVOLVIMENTO PERSONALIZADO ═══ */}
      <section className={styles.devSection}>
        <div className={styles.sectionContainer}>
          <div className={styles.devBox}>
            <div className={styles.devIcon}>
              <Code2 size={40} />
            </div>
            <h2 className={styles.devTitulo}>Precisa de uma função ou parâmetro personalizado?</h2>
            <p className={styles.devDescricao}>
              Desenvolvemos para você sem nenhum custo adicional.
            </p>
            <a
              href="https://wa.me/5511933284364"
              target="_blank"
              rel="noopener noreferrer"
              className={styles.btnPrimario}
            >
              Fale Conosco <ArrowRight size={18} />
            </a>
          </div>
        </div>
      </section>

      {/* ═══ CONTRATO ═══ */}
      <section id="contrato" className={contratoStyles.contratoSection}>
        <div className={styles.sectionContainer}>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionTag}>Contrato</span>
            <h2 className={styles.sectionTitle}>Conheça Nosso Contrato</h2>
            <p className={styles.sectionSubtitle}>Selecione o plano desejado para visualizar e preencher o contrato digitalmente</p>
          </div>

          <div className={contratoStyles.contratoGrid}>
            {[
              { nome: 'Por Condomínio', preco: '199', usuarios: 'ilimitados', descricao: '1 condomínio · usuários ilimitados' },
              { nome: 'Administradoras e Facility', preco: '350', usuarios: 'ilimitados', descricao: 'Condomínios e usuários ilimitados' },
            ].map((plano, i) => (
              <div
                key={i}
                className={contratoStyles.contratoCard}
                onClick={() => setPlanoContrato(plano)}
              >
                <div className={contratoStyles.contratoCardIcon}>
                  <FileText size={28} />
                </div>
                <span className={contratoStyles.contratoCardUsuarios}>{plano.nome}</span>
                <div className={contratoStyles.contratoCardPreco}>
                  <span className={contratoStyles.contratoCardCifrao}>R$</span>
                  <span className={contratoStyles.contratoCardValor}>{plano.preco}</span>
                  <span className={contratoStyles.contratoCardPeriodo}>/mês</span>
                </div>
                <p className={contratoStyles.contratoCardDesc}>{plano.descricao}</p>
                <button className={contratoStyles.contratoCardBtn}>
                  Preencher Contrato <ArrowRight size={16} />
                </button>
              </div>
            ))}
          </div>

          <p className={contratoStyles.contratoNota}>
            Precisa de mais usuários?{' '}
            <a href="https://wa.me/5511933284364" target="_blank" rel="noopener noreferrer" className={contratoStyles.contratoNotaLink}>
              Entre em contato conosco.
            </a>
          </p>
        </div>
      </section>

      {/* Modal do Contrato */}
      {planoContrato && (
        <ContratoModal plano={planoContrato} onClose={() => setPlanoContrato(null)} />
      )}

      {/* ═══ CTA FINAL ═══ */}
      <section className={styles.ctaSection}>
        <div className={styles.sectionContainer}>
          <div className={styles.ctaBox}>
            <h2 className={styles.ctaTitulo}>Pronto para transformar a gestão do seu condomínio?</h2>
            <p className={styles.ctaDescricao}>
              Acesse agora e comece a organizar ordens de serviço, checklists, escalas, vistorias e muito mais.
            </p>
            <button className={styles.btnPrimario} onClick={() => navigate('/login')}>
              Acessar o Sistema <ArrowRight size={18} />
            </button>
          </div>
        </div>
      </section>

      {/* ═══ WHATSAPP FLUTUANTE ═══ */}
      <a
        href="https://wa.me/5511933284364"
        target="_blank"
        rel="noopener noreferrer"
        className={styles.whatsappBtn}
        aria-label="Fale conosco pelo WhatsApp"
      >
        <MessageCircle size={28} />
      </a>

      {/* ═══ FOOTER ═══ */}
      <footer className={styles.footer}>
        <div className={styles.footerContainer}>
          <div className={styles.footerBrand}>
            <img src={logoImg} alt="Gestão e Limpeza" className={styles.navLogoImg} style={{ width: 48, height: 48, borderRadius: 10, objectFit: 'contain' }} />
            <span className={styles.navName}>Gestão e <span className={styles.navDestaque}>Limpeza</span></span>
          </div>
          <p className={styles.footerCopy}>
            © {new Date().getFullYear()} Gestão e Limpeza — Sistema de Limpeza e Manutenção para Condomínios
          </p>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
