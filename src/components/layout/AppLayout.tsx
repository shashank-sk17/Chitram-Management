import { type ReactNode, useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../../features/auth/hooks/useAuth';
import { useAuthStore } from '../../stores/authStore';
import { AdminNotificationBell } from '../AdminNotificationBell';

export interface NavItem {
  path: string;
  label: string;
  icon: string;
  badge?: number;
  sectionLabel?: string; // renders a section header BEFORE this item in the sidebar
}

interface AppLayoutProps {
  children: ReactNode;
  navItems: NavItem[];
  showNotificationBell?: boolean;
}

function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth >= 768 : false
  );
  useEffect(() => {
    const mql = window.matchMedia('(min-width: 768px)');
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mql.addEventListener('change', handler);
    setIsDesktop(mql.matches);
    return () => mql.removeEventListener('change', handler);
  }, []);
  return isDesktop;
}

function useBreadcrumbs(_role: string | undefined) {
  const location = useLocation();
  const parts = location.pathname.split('/').filter(Boolean);
  return parts.map((part, i) => ({
    label: part.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
    path: '/' + parts.slice(0, i + 1).join('/'),
    isCurrent: i === parts.length - 1,
  }));
}

const ROLE_LABELS: Record<string, string> = {
  admin: 'Super Admin',
  projectAdmin: 'Project Admin',
  pm: 'Project Manager',
  principal: 'Principal',
  teacher: 'Teacher',
  contentWriter: 'Content Writer',
  contentReviewer: 'Reviewer',
};

const ROLE_COLORS: Record<string, { bg: string; text: string }> = {
  admin:           { bg: 'rgba(124,129,255,0.18)', text: '#a5a8ff' },
  projectAdmin:    { bg: 'rgba(0,187,174,0.18)',   text: '#00BBAE' },
  pm:              { bg: 'rgba(255,155,36,0.18)',   text: '#FF9B24' },
  principal:       { bg: 'rgba(255,87,123,0.18)',   text: '#FF577B' },
  teacher:         { bg: 'rgba(76,175,130,0.18)',   text: '#4CAF82' },
  contentWriter:   { bg: 'rgba(0,185,241,0.18)',    text: '#00B9F1' },
  contentReviewer: { bg: 'rgba(255,164,85,0.18)',   text: '#FFA455' },
};

const S = {
  bg:          '#181a3a',
  activeBg:    'rgba(255,155,36,0.15)',
  hoverBg:     'rgba(255,255,255,0.07)',
  border:      'rgba(255,255,255,0.09)',
  text:        'rgba(255,255,255,0.48)',
  textActive:  '#ffffff',
  textHover:   'rgba(255,255,255,0.82)',
  logoAccent:  'rgba(160,164,255,0.9)',
  avatarBg:    'rgba(124,129,255,0.22)',
  iconBg:      'rgba(124,129,255,0.18)',
  iconBorder:  'rgba(124,129,255,0.3)',
  accent:      '#FF9B24',
};

export function AppLayout({ children, navItems, showNotificationBell = false }: AppLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { logout } = useAuth();
  const { user, claims } = useAuthStore();
  const isDesktop = useIsDesktop();
  const breadcrumbs = useBreadcrumbs(claims?.role);

  const isActive = (path: string) => {
    const current = location.pathname;
    if (path === '') return current === `/${claims?.role}` || current === `/${claims?.role}/`;
    return current.startsWith(path);
  };

  const handleNav = (path: string) => {
    navigate(path || `/${claims?.role}`);
    setMobileMenuOpen(false);
  };

  const sidebarWidth = sidebarOpen ? 288 : 72;
  const userInitial = user?.email?.[0].toUpperCase() ?? '?';
  const roleLabel = ROLE_LABELS[claims?.role ?? ''] ?? claims?.role ?? '';
  const roleColor = ROLE_COLORS[claims?.role ?? ''] ?? { bg: S.iconBg, text: S.logoAccent };

  const NavButton = ({ item, onClick }: { item: NavItem; onClick: () => void }) => {
    const active = isActive(item.path);
    const [hovered, setHovered] = useState(false);

    return (
      <motion.button
        onClick={onClick}
        whileTap={{ scale: 0.97 }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        className={`
          w-full flex items-center rounded-xl transition-colors duration-150
          font-baloo font-semibold relative
          ${sidebarOpen ? 'gap-sm px-sm py-[11px] text-md' : 'px-xs py-[11px] justify-center'}
        `}
        style={{
          color: active ? S.textActive : hovered ? S.textHover : S.text,
          background: active ? S.activeBg : hovered ? S.hoverBg : 'transparent',
          borderLeft: active ? `3px solid ${S.accent}` : '3px solid transparent',
        }}
      >
        <span className={`text-xl flex-shrink-0 relative ${sidebarOpen ? 'w-7 text-center' : ''}`}>
          {item.icon}
          {!sidebarOpen && item.badge != null && item.badge > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[16px] h-4 bg-accent text-white text-[9px] font-bold rounded-full flex items-center justify-center px-[3px] leading-none">
              {item.badge > 9 ? '9+' : item.badge}
            </span>
          )}
        </span>
        <AnimatePresence>
          {sidebarOpen && (
            <motion.span
              initial={{ opacity: 0, width: 0 }}
              animate={{ opacity: 1, width: 'auto' }}
              exit={{ opacity: 0, width: 0 }}
              transition={{ duration: 0.15 }}
              className="overflow-hidden whitespace-nowrap flex-1 text-left flex items-center justify-between"
            >
              <span>{item.label}</span>
              {item.badge != null && item.badge > 0 && (
                <span className="min-w-[22px] h-5 text-[11px] font-bold rounded-full flex items-center justify-center px-[6px] leading-none bg-accent text-white">
                  {item.badge > 99 ? '99+' : item.badge}
                </span>
              )}
            </motion.span>
          )}
        </AnimatePresence>
      </motion.button>
    );
  };

  return (
    <div className="min-h-screen min-h-[100dvh] bg-bg-cream">

      {/* ── Desktop Sidebar ─────────────────────────────────────────────── */}
      <motion.aside
        initial={false}
        animate={{ width: sidebarWidth }}
        transition={{ duration: 0.22, ease: 'easeInOut' }}
        className="fixed left-0 top-0 h-full z-40 overflow-hidden hidden md:flex flex-col"
        style={{ background: S.bg, willChange: 'width' }}
      >
        {/* Logo */}
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="flex items-center gap-md w-full text-left flex-shrink-0 transition-colors duration-150 px-md"
          style={{ borderBottom: `1px solid ${S.border}`, minHeight: 68 }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = S.hoverBg; }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
        >
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 text-xl"
            style={{ background: S.iconBg, border: `1px solid ${S.iconBorder}` }}
          >
            🎨
          </div>
          <AnimatePresence>
            {sidebarOpen && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.13 }}
                className="overflow-hidden whitespace-nowrap"
              >
                <p className="font-baloo font-extrabold text-lg leading-tight text-white">Chitram</p>
                <p className="font-baloo text-sm leading-tight" style={{ color: S.logoAccent }}>Management</p>
              </motion.div>
            )}
          </AnimatePresence>
        </button>

        {/* Nav */}
        <nav className="flex-1 py-md overflow-y-auto sidebar-scroll">
          <div className="space-y-[3px] px-sm">
            {navItems.map((item) => (
              <div key={item.path}>
                {item.sectionLabel && sidebarOpen && (
                  <p
                    className="font-baloo font-bold text-[10px] uppercase tracking-widest px-sm pt-sm pb-[3px] select-none"
                    style={{ color: 'rgba(255,255,255,0.22)' }}
                  >
                    {item.sectionLabel}
                  </p>
                )}
                {item.sectionLabel && !sidebarOpen && (
                  <div className="my-sm mx-sm h-px" style={{ background: 'rgba(255,255,255,0.09)' }} />
                )}
                <NavButton item={item} onClick={() => handleNav(item.path)} />
              </div>
            ))}
          </div>
        </nav>

        {/* User footer */}
        <div className="flex-shrink-0 p-sm" style={{ borderTop: `1px solid ${S.border}` }}>
          <div className={`flex items-center gap-sm mb-sm ${!sidebarOpen ? 'justify-center' : ''}`}>
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center font-baloo font-bold text-md flex-shrink-0 text-white"
              style={{ background: S.avatarBg, border: '1.5px solid rgba(124,129,255,0.4)' }}
            >
              {userInitial}
            </div>
            <AnimatePresence>
              {sidebarOpen && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="overflow-hidden min-w-0 flex-1"
                >
                  <p className="font-baloo font-semibold text-sm truncate text-white/90 leading-snug">{user?.email}</p>
                  <span
                    className="font-baloo text-xs font-semibold px-sm py-[1px] rounded-full inline-block mt-[2px]"
                    style={{ background: roleColor.bg, color: roleColor.text }}
                  >
                    {roleLabel}
                  </span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <SidebarSignOutButton sidebarOpen={sidebarOpen} onLogout={logout} />
        </div>
      </motion.aside>

      {/* ── Mobile Top Bar ───────────────────────────────────────────────── */}
      <header
        className="md:hidden fixed top-0 left-0 right-0 bg-white z-40 h-[56px]"
        style={{ borderBottom: '1px solid #F0EDE8', boxShadow: '0 1px 8px rgba(0,0,0,0.05)' }}
      >
        <div className="flex items-center justify-between px-md h-full">
          <div className="flex items-center gap-sm">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center text-lg"
              style={{ background: S.bg }}
            >
              🎨
            </div>
            <span className="font-baloo font-extrabold text-md" style={{ color: S.bg }}>Chitram</span>
          </div>
          <div className="flex items-center gap-sm">
            {showNotificationBell && <AdminNotificationBell />}
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="w-9 h-9 rounded-full flex items-center justify-center font-baloo font-bold text-md text-white"
              style={{ background: S.bg }}
            >
              {userInitial}
            </button>
          </div>
        </div>
      </header>

      {/* ── Mobile Bottom Nav ────────────────────────────────────────────── */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 bg-white z-40"
        style={{ borderTop: '1px solid #F0EDE8', boxShadow: '0 -2px 20px rgba(0,0,0,0.06)' }}
      >
        <div className="flex items-center justify-around px-xs py-xs pb-[max(10px,env(safe-area-inset-bottom))]">
          {navItems.slice(0, 4).map((item) => {
            const active = isActive(item.path);
            return (
              <button
                key={item.path}
                onClick={() => handleNav(item.path)}
                className="flex flex-col items-center gap-[3px] py-[8px] px-sm rounded-xl min-w-0 flex-1 transition-colors relative"
                style={{ color: active ? S.bg : '#9E9E9E' }}
              >
                {active && (
                  <motion.div
                    layoutId="mobileActiveIndicator"
                    className="absolute inset-0 rounded-xl"
                    style={{ background: '#EDEEFF' }}
                    transition={{ type: 'spring', stiffness: 400, damping: 32 }}
                  />
                )}
                <span className={`text-2xl relative z-10 ${active ? 'scale-110' : ''} transition-transform`}>
                  {item.icon}
                  {item.badge != null && item.badge > 0 && (
                    <span className="absolute -top-1 -right-1 min-w-[16px] h-4 bg-accent text-white text-[9px] font-bold rounded-full flex items-center justify-center px-[2px]">
                      {item.badge}
                    </span>
                  )}
                </span>
                <span className={`font-baloo text-xs leading-tight truncate max-w-full relative z-10 ${active ? 'font-bold' : 'font-medium'}`}>
                  {item.label}
                </span>
              </button>
            );
          })}
          {navItems.length > 4 && (
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="flex flex-col items-center gap-[3px] py-[8px] px-sm rounded-xl min-w-0 flex-1 text-text-muted"
            >
              <span className="text-2xl">⋯</span>
              <span className="font-baloo text-xs leading-tight font-medium">More</span>
            </button>
          )}
        </div>
      </nav>

      {/* ── Mobile Menu Sheet ─────────────────────────────────────────────── */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileMenuOpen(false)}
              className="md:hidden fixed inset-0 bg-black/30 z-50 backdrop-blur-[2px]"
            />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 340 }}
              className="md:hidden fixed bottom-0 left-0 right-0 bg-white rounded-t-xxl z-50 max-h-[80vh] overflow-y-auto"
            >
              <div className="w-10 h-1.5 rounded-full mx-auto mt-md mb-sm" style={{ background: '#E0DDD8' }} />

              {/* User card */}
              <div className="mx-md mb-md px-md py-md rounded-xl" style={{ background: S.bg }}>
                <div className="flex items-center gap-md">
                  <div
                    className="w-12 h-12 rounded-full flex items-center justify-center font-baloo font-bold text-lg text-white flex-shrink-0"
                    style={{ background: S.avatarBg }}
                  >
                    {userInitial}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-baloo font-semibold text-sm text-white truncate">{user?.email}</p>
                    <span
                      className="font-baloo text-xs font-semibold px-sm py-[2px] rounded-full inline-block mt-xs"
                      style={{ background: roleColor.bg, color: roleColor.text }}
                    >
                      {roleLabel}
                    </span>
                  </div>
                </div>
              </div>

              {/* Nav items */}
              <div className="px-md space-y-[3px] mb-md">
                {navItems.map((item) => {
                  const active = isActive(item.path);
                  return (
                    <button
                      key={item.path}
                      onClick={() => handleNav(item.path)}
                      className="w-full flex items-center gap-md px-md py-sm rounded-xl font-baloo font-semibold text-md transition-colors"
                      style={{
                        background: active ? '#EDEEFF' : 'transparent',
                        color: active ? S.bg : '#424242',
                        borderLeft: active ? `3px solid ${S.accent}` : '3px solid transparent',
                      }}
                    >
                      <span className="text-2xl relative flex-shrink-0">
                        {item.icon}
                        {item.badge != null && item.badge > 0 && (
                          <span className="absolute -top-1 -right-1 min-w-[16px] h-4 bg-accent text-white text-[9px] font-bold rounded-full flex items-center justify-center px-[2px]">
                            {item.badge}
                          </span>
                        )}
                      </span>
                      <span className="flex-1 text-left">{item.label}</span>
                      {item.badge != null && item.badge > 0 && (
                        <span className="min-w-[22px] h-5 text-[11px] font-bold rounded-full flex items-center justify-center px-[6px] bg-accent text-white">
                          {item.badge > 99 ? '99+' : item.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              <div className="px-md mb-md">
                <div className="h-px bg-divider mb-sm" />
                <button
                  onClick={() => { setMobileMenuOpen(false); logout(); }}
                  className="w-full flex items-center gap-md px-md py-sm rounded-xl font-baloo font-medium text-md text-error hover:bg-rose-light transition-colors"
                >
                  <span className="text-xl">↩</span>
                  <span>Sign Out</span>
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── Main Content ─────────────────────────────────────────────────── */}
      <motion.div
        initial={false}
        animate={{ marginLeft: isDesktop ? sidebarWidth : 0 }}
        transition={{ duration: 0.22, ease: 'easeInOut' }}
        className="min-h-screen pt-[56px] pb-[76px] md:pt-0 md:pb-0"
        style={{ willChange: 'margin-left' }}
      >
        {/* Desktop topbar */}
        <header
          className="hidden md:flex items-center bg-white sticky top-0 z-30 h-[64px] px-lg gap-md"
          style={{ borderBottom: '1px solid #F0EDE8', boxShadow: '0 1px 16px rgba(0,0,0,0.04)' }}
        >
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-text-muted flex-shrink-0 transition-colors hover:bg-lavender-light hover:text-primary"
            title={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
          >
            <span className="text-sm">{sidebarOpen ? '◀' : '▶'}</span>
          </button>

          {/* Breadcrumbs */}
          <nav className="flex items-center gap-sm font-baloo text-md flex-1 min-w-0">
            {breadcrumbs.map((crumb, i) => (
              <span key={crumb.path} className="flex items-center gap-sm min-w-0">
                {i > 0 && <span className="text-divider select-none flex-shrink-0 text-sm">/</span>}
                <button
                  onClick={() => !crumb.isCurrent && navigate(crumb.path)}
                  className={`truncate ${crumb.isCurrent
                    ? 'text-text-dark font-bold cursor-default'
                    : 'text-text-muted hover:text-primary transition-colors flex-shrink-0 font-medium'
                  }`}
                >
                  {crumb.label}
                </button>
              </span>
            ))}
          </nav>

          {/* Role chip */}
          {roleLabel && (
            <span
              className="font-baloo font-semibold text-sm px-sm py-[4px] rounded-full flex-shrink-0"
              style={{ background: roleColor.bg, color: roleColor.text }}
            >
              {roleLabel}
            </span>
          )}

          {showNotificationBell && <AdminNotificationBell />}
        </header>

        {/* Page content */}
        <motion.div
          key={location.pathname}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className="p-md md:p-xl"
        >
          {children}
        </motion.div>
      </motion.div>
    </div>
  );
}

function SidebarSignOutButton({ sidebarOpen, onLogout }: { sidebarOpen: boolean; onLogout: () => void }) {
  const [hovered, setHovered] = useState(false);
  return (
    <motion.button
      onClick={onLogout}
      whileTap={{ scale: 0.97 }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={`w-full flex items-center gap-sm rounded-xl font-baloo font-medium text-sm py-sm transition-colors ${
        sidebarOpen ? 'px-sm' : 'justify-center px-xs'
      }`}
      style={{
        color: hovered ? '#FF7C7C' : 'rgba(255,255,255,0.35)',
        background: hovered ? 'rgba(255,124,124,0.1)' : 'transparent',
      }}
    >
      <span className="text-md">↩</span>
      {sidebarOpen && <span>Sign Out</span>}
    </motion.button>
  );
}
