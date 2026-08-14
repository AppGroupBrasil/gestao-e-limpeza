import React, { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { usePermissions } from '../../contexts/PermissionsContext';
import { useDemo } from '../../contexts/DemoContext';
import {
  LayoutDashboard, Users, ClipboardCheck, Wrench, Calendar,
  Package, Search, MapPin, Settings, LogOut, ChevronLeft,
    ChevronRight, Building2, BarChart3, Shield, Menu, FileWarning, Eye, EyeOff, QrCode, ScanLine, Flame, CalendarCheck, BookOpen, CalendarClock, Contact, Megaphone, Columns3, GripVertical, RotateCcw, Bell, User, ClipboardList, FileText, GraduationCap, X
} from 'lucide-react';
import styles from './Sidebar.module.css';
import logoImg from '../../assets/logo.png';
import { notificacoes as notificacoesApi } from '../../services/api';

interface MenuItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  rota: string;
  minRole: number;
}

const menuItems: MenuItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard size={20} />, rota: '/dashboard', minRole: 1 },
  { id: 'auditoria', label: 'Auditoria & Métricas', icon: <Shield size={20} />, rota: '/auditoria', minRole: 3 },
  { id: 'vencimentos', label: 'Agenda de Vencimentos', icon: <CalendarClock size={20} />, rota: '/vencimentos', minRole: 2 },
  { id: 'condominios', label: 'Cadastro de Condomínios', icon: <Building2 size={20} />, rota: '/condominios', minRole: 2 },
  { id: 'moradores', label: 'Cadastro de Moradores', icon: <Contact size={20} />, rota: '/moradores', minRole: 2 },
  { id: 'permissoes', label: 'Cadastro de Permissões', icon: <Shield size={20} />, rota: '/permissoes', minRole: 3 },
  { id: 'usuarios', label: 'Cadastro de Usuários', icon: <Users size={20} />, rota: '/usuarios', minRole: 3 },
  { id: 'checklists', label: 'Checklists', icon: <ClipboardCheck size={20} />, rota: '/checklists', minRole: 1 },
  { id: 'comunicados', label: 'Comunicados / Avisos', icon: <Megaphone size={20} />, rota: '/comunicados', minRole: 2 },
  { id: 'configuracoes', label: 'Configurações', icon: <Settings size={20} />, rota: '/configuracoes', minRole: 1 },
  { id: 'materiais', label: 'Controle de Estoque', icon: <Package size={20} />, rota: '/materiais', minRole: 1 },
  { id: 'qrcode', label: 'Criar QR Code', icon: <QrCode size={20} />, rota: '/qrcode', minRole: 2 },
  { id: 'doc-publicos', label: 'Docs Públicos (QR)', icon: <FileText size={20} />, rota: '/doc-publicos', minRole: 2 },
  { id: 'escalas', label: 'Escalas', icon: <Calendar size={20} />, rota: '/escalas', minRole: 2 },
  { id: 'geolocalizacao', label: 'Geolocalização', icon: <MapPin size={20} />, rota: '/geolocalizacao', minRole: 2 },
  { id: 'inspecoes', label: 'Inspeções', icon: <Search size={20} />, rota: '/inspecoes', minRole: 2 },
  { id: 'leitor-qrcode', label: 'Leitor QR Code', icon: <ScanLine size={20} />, rota: '/leitor-qrcode', minRole: 1 },
  { id: 'ordens', label: 'Ordens de Serviço', icon: <Wrench size={20} />, rota: '/ordens-servico', minRole: 1 },
  { id: 'quadro-atividades', label: 'Quadro de Atividades', icon: <Columns3 size={20} />, rota: '/quadro-atividades', minRole: 1 },
  { id: 'mapa-calor', label: 'Reclamações', icon: <Flame size={20} />, rota: '/mapa-calor', minRole: 3 },
  { id: 'relatorios', label: 'Relatórios', icon: <BarChart3 size={20} />, rota: '/relatorios', minRole: 2 },
  { id: 'reportes', label: 'Reportes', icon: <FileWarning size={20} />, rota: '/reportes', minRole: 1 },
  { id: 'rondas', label: 'QR Code Rondas', icon: <MapPin size={20} />, rota: '/rondas', minRole: 2 },
  { id: 'qrcode-respostas', label: 'Respostas QR Code', icon: <ClipboardList size={20} />, rota: '/qrcode-respostas', minRole: 2 },
  { id: 'roteiros', label: 'Roteiro de Execução', icon: <BookOpen size={20} />, rota: '/roteiros', minRole: 1 },
  { id: 'tarefas', label: 'Tarefas Agendadas', icon: <CalendarCheck size={20} />, rota: '/tarefas', minRole: 1 },
  { id: 'vistorias', label: 'Vistorias', icon: <Eye size={20} />, rota: '/vistorias', minRole: 1 },
  { id: 'tutorial', label: 'Tutorial do Sistema', icon: <GraduationCap size={20} />, rota: '/tutorial', minRole: 1 },
];

const ORDEM_KEY = 'gestao-sidebar-ordem';
const HIDDEN_KEY = 'gestao-sidebar-hidden';
const DEFAULT_HIDDEN = ['auditoria', 'moradores', 'comunicados', 'permissoes', 'configuracoes', 'escalas', 'inspecoes', 'roteiros'];
const ALWAYS_VISIBLE = ['qrcode-respostas'];

const Sidebar: React.FC = () => {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [gridAberta, setGridAberta] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { usuario, logout } = useAuth();
  const { tema } = useTheme();
  const { roleNivel, podeVer } = usePermissions();
  const { isDemo, setDemo } = useDemo();

  // --- Ordem personalizada ---
  const [ordemIds, setOrdemIds] = useState<string[]>(() => {
    try { const v = localStorage.getItem(ORDEM_KEY); return v ? JSON.parse(v) : []; } catch { return []; }
  });
  const [editandoOrdem, setEditandoOrdem] = useState(false);

  // --- Itens ocultos ---
  const [hiddenIds, setHiddenIds] = useState<string[]>(() => {
    try { const v = localStorage.getItem(HIDDEN_KEY); return v ? JSON.parse(v) : DEFAULT_HIDDEN; } catch { return DEFAULT_HIDDEN; }
  });

  const toggleHidden = useCallback((id: string) => {
    setHiddenIds(prev => {
      const next = prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id];
      localStorage.setItem(HIDDEN_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const restaurarTodos = useCallback(() => {
    setHiddenIds([]);
    localStorage.setItem(HIDDEN_KEY, JSON.stringify([]));
  }, []);
  const dragIdx = useRef<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    setGridAberta(false);
    setMobileOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!isDemo) {
      notificacoesApi.unreadCount().then((r: any) => setUnreadCount(r.count || 0)).catch(() => {});
      const interval = setInterval(() => {
        notificacoesApi.unreadCount().then((r: any) => setUnreadCount(r.count || 0)).catch(() => {});
      }, 60000);
      return () => clearInterval(interval);
    }
  }, [isDemo]);

  const filteredItems = useMemo(() => {
    const base = menuItems.filter(item => roleNivel >= item.minRole && podeVer(item.id));
    const ordered = (() => {
      if (ordemIds.length === 0) return base;
      const mapa = new Map(base.map(item => [item.id, item]));
      const ordenados: MenuItem[] = [];
      for (const id of ordemIds) {
        const item = mapa.get(id);
        if (item) { ordenados.push(item); mapa.delete(id); }
      }
      mapa.forEach(item => ordenados.push(item));
      return ordenados;
    })();
    // Em modo edição mostra todos, senão esconde os ocultos
    if (editandoOrdem) return ordered;
    return ordered.filter(item => ALWAYS_VISIBLE.includes(item.id) || !hiddenIds.includes(item.id));
  }, [ordemIds, roleNivel, podeVer, hiddenIds, editandoOrdem]);

  const salvarOrdem = useCallback((items: MenuItem[]) => {
    const ids = items.map(i => i.id);
    setOrdemIds(ids);
    localStorage.setItem(ORDEM_KEY, JSON.stringify(ids));
  }, []);

  const resetarOrdem = useCallback(() => {
    setOrdemIds([]);
    localStorage.removeItem(ORDEM_KEY);
    setEditandoOrdem(false);
  }, []);

  const handleDragStart = useCallback((idx: number) => {
    dragIdx.current = idx;
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, idx: number) => {
    e.preventDefault();
    setDragOverIdx(idx);
  }, []);

  const handleDrop = useCallback((idx: number) => {
    const from = dragIdx.current;
    if (from === null || from === idx) { dragIdx.current = null; setDragOverIdx(null); return; }
    const copia = [...filteredItems];
    const [movido] = copia.splice(from, 1);
    copia.splice(idx, 0, movido);
    salvarOrdem(copia);
    dragIdx.current = null;
    setDragOverIdx(null);
  }, [filteredItems, salvarOrdem]);

  const handleDragEnd = useCallback(() => {
    dragIdx.current = null;
    setDragOverIdx(null);
  }, []);
  const isMobileBarUser = roleNivel <= 2;

  const handleNav = (rota: string) => {
    navigate(rota);
    setMobileOpen(false);
    setGridAberta(false);
  };

  const handleLogout = async () => {
    if (isDemo) setDemo(false);
    await logout();
    navigate('/');
  };

  const roleLabel: Record<string, string> = {
    master: 'Master',
    administrador: 'Administrador',
    supervisor: 'Supervisor',
    funcionario: 'Funcionário',
  };

  return (
    <>
      {/* Top bar for funcionario/supervisor — apenas header */}
      {isMobileBarUser && (
        <div className={styles.topBar} style={{ backgroundColor: 'var(--cor-menu)' }}>
          <div className={styles.topBarHeader}>
            <div className={styles.topBarBrand}>
              {tema.logoUrl ? (
                <img src={tema.logoUrl} alt="Logo" className={styles.logo} />
              ) : (
                <img src={logoImg} alt="Gestão e Limpeza" className={styles.logo} />
              )}
              <span className={styles.brandName}>Gestão e <span className={styles.brandDestaque}>Limpeza</span></span>
            </div>
            <div className={styles.topBarActions}>
              {isDemo && (
                <div className={styles.demoBadgeTopBar}>
                  <Eye size={12} /> DEMO
                </div>
              )}
              {usuario && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.8)', fontWeight: 500 }}>{roleLabel[usuario.role]}</span>
                  <div className={styles.topBarAvatar}>
                    {usuario.nome.charAt(0).toUpperCase()}
                  </div>
                </div>
              )}
              <button
                className={styles.topBarMenuBtn}
                onClick={() => setGridAberta(!gridAberta)}
                aria-label={gridAberta ? 'Fechar menu' : 'Abrir menu'}
                aria-expanded={gridAberta}
              >
                {gridAberta ? <X size={18} /> : <Menu size={18} />}
              </button>
              <button className={styles.topBarLogout} onClick={handleLogout}>
                <LogOut size={18} />
              </button>
            </div>
          </div>
          {gridAberta && (
          <nav className={styles.topBarNav}>
            {filteredItems.map(item => (
              <button
                key={item.id}
                className={`${styles.topBarItem} ${location.pathname === item.rota ? styles.topBarItemActive : ''}`}
                onClick={() => handleNav(item.rota)}
              >
                <span className={styles.topBarIcon}>{item.icon}</span>
                <span className={styles.topBarLabel}>{item.label}</span>
              </button>
            ))}
          </nav>
          )}
        </div>
      )}

      <button className={`${styles.mobileToggle} ${isMobileBarUser ? styles.hideAlways : ''}`} onClick={() => setMobileOpen(!mobileOpen)}>
        <Menu size={24} />
      </button>

      <div className={`${styles.overlay} ${mobileOpen ? styles.overlayVisible : ''}`} onClick={() => setMobileOpen(false)} />

      <aside
        className={`${styles.sidebar} ${collapsed ? styles.collapsed : ''} ${mobileOpen ? styles.mobileOpen : ''} ${isMobileBarUser ? styles.hideAlways : ''}`}
        style={{ backgroundColor: 'var(--cor-menu)' }}
      >
        <div className={styles.header}>
          {!collapsed && (
            <div className={styles.brand}>
              {tema.logoUrl ? (
                <img src={tema.logoUrl} alt="Logo" className={styles.logo} />
              ) : (
                <img src={logoImg} alt="Gestão e Limpeza" className={styles.logo} />
              )}
              <div className={styles.brandText}>
                <span className={styles.brandName}>Gestão e <span className={styles.brandDestaque}>Limpeza</span></span>
              </div>
            </div>
          )}
          <button className={styles.collapseBtn} onClick={() => setCollapsed(!collapsed)}>
            {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
          </button>
        </div>

        {!collapsed && usuario && (
          <div className={styles.userInfo}>
            <div className={styles.avatar} onClick={() => handleNav('/perfil')} style={{ cursor: 'pointer' }} title="Meu Perfil">
              {usuario.nome.charAt(0).toUpperCase()}
            </div>
            <div className={styles.userMeta}>
              <span className={styles.userName}>{usuario.nome}</span>
              <span className={styles.userRole}>{roleLabel[usuario.role]}</span>
            </div>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
              <button className={styles.iconBtn} onClick={() => handleNav('/perfil')} title="Meu Perfil">
                <User size={16} />
              </button>
              <button className={styles.iconBtn} onClick={() => handleNav('/notificacoes')} title="Notificações" style={{ position: 'relative' }}>
                <Bell size={16} />
                {unreadCount > 0 && <span className={styles.bellBadge}>{unreadCount > 9 ? '9+' : unreadCount}</span>}
              </button>
            </div>
          </div>
        )}

        {!collapsed && isDemo && (
          <div className={styles.demoBadge}>
            <Eye size={14} /> MODO DEMONSTRAÇÃO
          </div>
        )}

        <nav className={`${styles.nav} ${!editandoOrdem && !collapsed ? styles.navGrid : ''}`}>
          {!collapsed && (
            <div className={styles.reorderBar}>
              <button
                className={`${styles.reorderToggle} ${editandoOrdem ? styles.reorderToggleAtivo : ''}`}
                onClick={() => setEditandoOrdem(v => !v)}
                title="Reorganizar menu"
              >
                <GripVertical size={14} />
                {editandoOrdem ? 'Concluir' : 'Reorganizar'}
              </button>
              {editandoOrdem && (
                <>
                  <button className={styles.reorderReset} onClick={resetarOrdem} title="Restaurar ordem padrão">
                    <RotateCcw size={13} />
                  </button>
                  {hiddenIds.length > 0 && (
                    <button className={styles.restaurarBtn} onClick={restaurarTodos} title="Mostrar todos os itens ocultos">
                      <Eye size={13} /> Restaurar ({hiddenIds.length})
                    </button>
                  )}
                </>
              )}
            </div>
          )}
          {filteredItems.map((item, idx) => (
            <button
              key={item.id}
              className={`${styles.navItem} ${location.pathname === item.rota ? styles.active : ''} ${dragOverIdx === idx ? styles.navItemDragOver : ''}`}
              onClick={() => !editandoOrdem && handleNav(item.rota)}
              title={collapsed ? item.label : undefined}
              draggable={editandoOrdem}
              onDragStart={() => handleDragStart(idx)}
              onDragOver={e => handleDragOver(e, idx)}
              onDrop={() => handleDrop(idx)}
              onDragEnd={handleDragEnd}
            >
              {editandoOrdem && !collapsed && <GripVertical size={14} className={styles.dragHandle} />}
              <span className={styles.navIcon}>{item.icon}</span>
              {!collapsed && <span className={`${styles.navLabel} ${hiddenIds.includes(item.id) ? styles.navLabelHidden : ''}`}>{item.label}</span>}
              {!collapsed && editandoOrdem && !ALWAYS_VISIBLE.includes(item.id) && (
                <button
                  className={`${styles.hideToggle} ${hiddenIds.includes(item.id) ? styles.hideToggleOff : ''}`}
                  onClick={(e) => { e.stopPropagation(); toggleHidden(item.id); }}
                  title={hiddenIds.includes(item.id) ? 'Mostrar item' : 'Ocultar item'}
                >
                  {hiddenIds.includes(item.id) ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              )}
              {!collapsed && !editandoOrdem && location.pathname === item.rota && <div className={styles.activeIndicator} />}
            </button>
          ))}
        </nav>

        <div className={styles.footer}>
          <button className={styles.logoutBtn} onClick={handleLogout}>
            <LogOut size={20} />
            {!collapsed && <span>Sair</span>}
          </button>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
