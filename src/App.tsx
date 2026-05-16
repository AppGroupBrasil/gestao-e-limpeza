import React, { Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import { ROLE_HIERARCHY } from './types';
import MainLayout from './components/Layout/MainLayout';
import ErrorBoundary from './components/ErrorBoundary';

/* ── Lazy-loaded pages (code splitting) ── */
const LoginPage = React.lazy(() => import('./pages/Auth/LoginPage'));
const BloqueadoPage = React.lazy(() => import('./pages/Auth/BloqueadoPage'));
const LandingPage = React.lazy(() => import('./pages/Landing/LandingPage'));
const PrivacidadePage = React.lazy(() => import('./pages/Landing/PrivacidadePage'));
const ExclusaoContaPage = React.lazy(() => import('./pages/Landing/ExclusaoContaPage'));
const DashboardPage = React.lazy(() => import('./pages/Dashboard/DashboardPage'));
const UsuariosPage = React.lazy(() => import('./pages/Usuarios/UsuariosPage'));
const CondominiosPage = React.lazy(() => import('./pages/Condominios/CondominiosPage'));
const OrdensServicoPage = React.lazy(() => import('./pages/OrdensServico/OrdensServicoPage'));
const ChecklistsPage = React.lazy(() => import('./pages/Checklists/ChecklistsPage'));
const EscalasPage = React.lazy(() => import('./pages/Escalas/EscalasPage'));
const MateriaisPage = React.lazy(() => import('./pages/Materiais/MateriaisPage'));
const InspecoesPage = React.lazy(() => import('./pages/Inspecoes/InspecoesPage'));
const GeolocalizacaoPage = React.lazy(() => import('./pages/Geolocalizacao/GeolocalizacaoPage'));
const RelatoriosPage = React.lazy(() => import('./pages/Relatorios/RelatoriosPage'));
const PermissoesPage = React.lazy(() => import('./pages/Permissoes/PermissoesPage'));
const ConfiguracoesPage = React.lazy(() => import('./pages/Configuracoes/ConfiguracoesPage'));
const ReportesPage = React.lazy(() => import('./pages/Reportes/ReportesPage'));
const VistoriaPage = React.lazy(() => import('./pages/Vistorias/VistoriaPage'));
const QRCodePage = React.lazy(() => import('./pages/QRCode/QRCodePage'));
const LeitorQRCodePage = React.lazy(() => import('./pages/QRCode/LeitorQRCodePage'));
const MapaCalorPage = React.lazy(() => import('./pages/MapaCalor/MapaCalorPage'));
const TarefasPage = React.lazy(() => import('./pages/Tarefas/TarefasPage'));
const RoteiroExecucaoPage = React.lazy(() => import('./pages/Roteiros/RoteiroExecucaoPage'));
const VencimentosPage = React.lazy(() => import('./pages/Vencimentos/VencimentosPage'));
const MoradoresPage = React.lazy(() => import('./pages/Moradores/MoradoresPage'));
const ComunicadosPage = React.lazy(() => import('./pages/Comunicados/ComunicadosPage'));
const QuadroAtividadesPage = React.lazy(() => import('./pages/QuadroAtividades/QuadroAtividadesPage'));
const CadastroPage = React.lazy(() => import('./pages/Auth/CadastroPage'));
const EsqueciSenhaPage = React.lazy(() => import('./pages/Auth/EsqueciSenhaPage'));
const PerfilPage = React.lazy(() => import('./pages/Perfil/PerfilPage'));
const NotificacoesPage = React.lazy(() => import('./pages/Notificacoes/NotificacoesPage'));
const AuditoriaPage = React.lazy(() => import('./pages/Auditoria/AuditoriaPage'));
const ResponderQRCodePage = React.lazy(() => import('./pages/QRCode/ResponderQRCodePage'));
const RespostasQRCodePage = React.lazy(() => import('./pages/QRCode/RespostasQRCodePage'));
const DocumentosPublicosPage = React.lazy(() => import('./pages/DocumentosPublicos/DocumentosPublicosPage'));
const VerDocumentoPage = React.lazy(() => import('./pages/DocumentosPublicos/VerDocumentoPage'));
const RondasPage = React.lazy(() => import('./pages/Rondas/RondasPage'));
const ScanRondaPage = React.lazy(() => import('./pages/Rondas/ScanRondaPage'));
const PublicChecklistPage = React.lazy(() => import('./pages/Public/PublicChecklistPage'));
const PublicVistoriaPage = React.lazy(() => import('./pages/Public/PublicVistoriaPage'));
const PublicTarefaPage = React.lazy(() => import('./pages/Public/PublicTarefaPage'));
const TutorialPage = React.lazy(() => import('./pages/Tutorial/TutorialPage'));

const PageLoader = () => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--cor-fundo)' }}>
    <div style={{ textAlign: 'center' }}>
      <div style={{ width: 40, height: 40, border: '3px solid var(--cor-borda)', borderTop: '3px solid var(--cor-primaria)', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 16px' }} />
      <p style={{ color: 'var(--cor-texto-secundario)', fontSize: 14 }}>Carregando...</p>
    </div>
  </div>
);

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { usuario, carregando } = useAuth();

  if (carregando) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--cor-fundo)' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 40, height: 40, border: '3px solid var(--cor-borda)', borderTop: '3px solid var(--cor-primaria)', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 16px' }} />
          <p style={{ color: 'var(--cor-texto-secundario)', fontSize: 14 }}>Carregando...</p>
        </div>
      </div>
    );
  }

  if (!usuario) return <Navigate to="/login" replace />;
  if (usuario.bloqueado) return <Navigate to="/bloqueado" replace />;

  return <>{children}</>;
};

const RoleGuard: React.FC<{ minRole: number; children: React.ReactNode }> = ({ minRole, children }) => {
  const { usuario } = useAuth();
  const nivel = ROLE_HIERARCHY[usuario?.role || 'funcionario'];
  if (nivel < minRole) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
};

const App: React.FC = () => {
  const { usuario, carregando } = useAuth();

  return (
    <ErrorBoundary>
    <Suspense fallback={<PageLoader />}>
    <Routes>
      {/* Página institucional pública */}
      <Route path="/" element={<LandingPage />} />
      <Route path="/privacidade" element={<PrivacidadePage />} />
      <Route path="/exclusao-conta" element={<ExclusaoContaPage />} />

      {/* QR Code público — formulário para responder sem login */}
      <Route path="/qrcode/responder/:id" element={<ResponderQRCodePage />} />

      {/* Documento público — visualização sem login */}
      <Route path="/doc/:slug" element={<VerDocumentoPage />} />

      {/* Ronda pública — funcionário registra ronda sem login */}
      <Route path="/ronda/:id" element={<ScanRondaPage />} />

      {/* Execução pública por link/QR */}
      <Route path="/checklist/:id" element={<PublicChecklistPage />} />
      <Route path="/vistoria/:id" element={<PublicVistoriaPage />} />
      <Route path="/tarefa/:id" element={<PublicTarefaPage />} />

      <Route path="/login" element={
        !carregando && usuario && !usuario.bloqueado ? <Navigate to="/dashboard" replace /> : <LoginPage />
      } />
      <Route path="/bloqueado" element={<BloqueadoPage />} />
      <Route path="/cadastro" element={<CadastroPage />} />
      <Route path="/esqueci-senha" element={<EsqueciSenhaPage />} />

      {/* Rotas protegidas do sistema */}
      <Route element={
        <ProtectedRoute>
          <MainLayout />
        </ProtectedRoute>
      }>
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="condominios" element={<RoleGuard minRole={2}><CondominiosPage /></RoleGuard>} />
        <Route path="usuarios" element={<RoleGuard minRole={3}><UsuariosPage /></RoleGuard>} />
        <Route path="ordens-servico" element={<OrdensServicoPage />} />
        <Route path="checklists" element={<ChecklistsPage />} />
        <Route path="vistorias" element={<VistoriaPage />} />
        <Route path="reportes" element={<ReportesPage />} />
        <Route path="escalas" element={<RoleGuard minRole={2}><EscalasPage /></RoleGuard>} />
        <Route path="materiais" element={<MateriaisPage />} />
        <Route path="inspecoes" element={<RoleGuard minRole={2}><InspecoesPage /></RoleGuard>} />
        <Route path="geolocalizacao" element={<RoleGuard minRole={2}><GeolocalizacaoPage /></RoleGuard>} />
        <Route path="relatorios" element={<RoleGuard minRole={2}><RelatoriosPage /></RoleGuard>} />
        <Route path="permissoes" element={<RoleGuard minRole={3}><PermissoesPage /></RoleGuard>} />
        <Route path="qrcode" element={<RoleGuard minRole={2}><QRCodePage /></RoleGuard>} />
        <Route path="qrcode-respostas" element={<RoleGuard minRole={2}><RespostasQRCodePage /></RoleGuard>} />
        <Route path="leitor-qrcode" element={<LeitorQRCodePage />} />
        <Route path="mapa-calor" element={<RoleGuard minRole={3}><MapaCalorPage /></RoleGuard>} />
        <Route path="tarefas" element={<TarefasPage />} />
        <Route path="roteiros" element={<RoteiroExecucaoPage />} />
        <Route path="vencimentos" element={<RoleGuard minRole={2}><VencimentosPage /></RoleGuard>} />
        <Route path="moradores" element={<RoleGuard minRole={2}><MoradoresPage /></RoleGuard>} />
        <Route path="comunicados" element={<RoleGuard minRole={2}><ComunicadosPage /></RoleGuard>} />
        <Route path="quadro-atividades" element={<QuadroAtividadesPage />} />
        <Route path="perfil" element={<PerfilPage />} />
        <Route path="notificacoes" element={<NotificacoesPage />} />
        <Route path="auditoria" element={<RoleGuard minRole={3}><AuditoriaPage /></RoleGuard>} />
        <Route path="doc-publicos" element={<RoleGuard minRole={2}><DocumentosPublicosPage /></RoleGuard>} />
        <Route path="rondas" element={<RoleGuard minRole={2}><RondasPage /></RoleGuard>} />
        <Route path="configuracoes" element={<ConfiguracoesPage />} />
        <Route path="tutorial" element={<TutorialPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </Suspense>
    </ErrorBoundary>
  );
};

export default App;
