import { type ReactNode, useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../../features/auth/hooks/useAuth';
import { useAuthStore } from '../../stores/authStore';

export interface NavItem {
  path: string;
  label: string;
  icon: string;
  badge?: number;
}

interface AppLayoutProps {
  children: ReactNode;
  navItems: NavItem[];
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
};

export function AppLayout({ children, navItems }: AppLayoutProps) {
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

  const sidebarWidth = sidebarOpen ? 256 : 64;
  const userInitial = user?.email?.[0].toUpperCase() ?? '?';
  const roleLabel = ROLE_LABELS[claims?.role ?? ''] ?? claims?.role ?? '';

  const NavButton = ({ item, onClick }: { item: NavItem; onClick: () => void }) => {
    const active = isActive(item.path);
    return (
      <motion.button
        onClick={onClick}
        whileTap={{ scale: 0.97 }}
        className={`
          w-full flex items-center gap-sm rounded-xl transition-all duration-150
          font-baloo font-semibold text-sm relative
          ${sidebarOpen ? 'px-sm py-sm' : 'px-xs py-sm justify-center'}
          ${active
            ? 'bg-primary text-white shadow-sm'
            : 'text-text-body hover:bg-lavender-light hover:text-text-dark'
          }
        `}
      >
        {/* Icon */}
        <span className={`text-lg flex-shrink-0 relative ${sidebarOpen ? 'w-7 text-center' : ''}`}>
          {item.icon}
          {!sidebarOpen && item.badge != null && item.badge > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[14px] h-[14px] bg-error text-white text-[9px] font-bold rounded-full flex items-center justify-center px-[2px] leading-none">
              {item.badge > 9 ? '9+' : item.badge}
            </span>
          )}
        </span>
        {/* Label + badge */}
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
                <span className={`min-w-[20px] h-5 text-[10px] font-bold rounded-full flex items-center justify-center px-[5px] leading-none ${active ? 'bg-white/30 text-white' : 'bg-error text-white'}`}>
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
        transition={{ duration: 0.25, ease: 'easeInOut' }}
        className="fixed left-0 top-0 h-full bg-white border-r border-divider z-40 overflow-hidden hidden md:flex flex-col"
        style={{ willChange: 'width' }}
      >
        {/* Logo / collapse toggle */}
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="flex items-center gap-sm p-md border-b border-divider hover:bg-lavender-light/40 transition-colors w-full text-left"
        >
          <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center flex-shrink-0 shadow-sm">
            <span className="text-lg">🎨</span>
          </div>
          <AnimatePresence>
            {sidebarOpen && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="overflow-hidden whitespace-nowrap"
              >
                <p className="font-baloo font-extrabold text-md text-primary leading-tight">Chitram</p>
                <p className="font-baloo text-xs text-text-muted leading-tight">Management Portal</p>
              </motion.div>
            )}
          </AnimatePresence>
        </button>

        {/* Nav items */}
        <nav className="flex-1 py-sm overflow-y-auto">
          <div className="space-y-[2px] px-sm">
            {navItems.map((item) => (
              <NavButton key={item.path} item={item} onClick={() => handleNav(item.path)} />
            ))}
          </div>
        </nav>

        {/* User footer */}
        <div className="border-t border-divider p-sm flex-shrink-0">
          <div className={`flex items-center gap-sm mb-sm ${!sidebarOpen ? 'justify-center' : ''}`}>
            <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white font-baloo font-bold text-sm flex-shrink-0">
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
                  <p className="font-baloo font-semibold text-xs text-text-dark truncate">{user?.email}</p>
                  <p className="font-baloo text-xs text-text-muted">{roleLabel}</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <motion.button
            onClick={logout}
            whileTap={{ scale: 0.97 }}
            className={`w-full flex items-center gap-xs rounded-lg font-baloo font-medium text-xs text-text-muted hover:text-error hover:bg-rose-light transition-colors py-xs ${sidebarOpen ? 'px-sm' : 'justify-center px-xs'}`}
          >
            <span className="text-sm">↩</span>
            {sidebarOpen && <span>Sign out</span>}
          </motion.button>
        </div>
      </motion.aside>

      {/* ── Mobile Top Bar ───────────────────────────────────────────────── */}
      <header className="md:hidden fixed top-0 left-0 right-0 bg-white border-b border-divider z-40 h-[52px]">
        <div className="flex items-center justify-between px-md h-full">
          <div className="flex items-center gap-sm">
            <div className="w-8 h-8 rounded-xl bg-primary flex items-center justify-center">
              <span className="text-sm">🎨</span>
            </div>
            <span className="font-baloo font-extrabold text-md text-primary">Chitram</span>
          </div>
          <button
            onClick={() => setMobileMenuOpen(true)}
            className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white font-baloo font-bold text-sm"
          >
            {userInitial}
          </button>
        </div>
      </header>

      {/* ── Mobile Bottom Nav ────────────────────────────────────────────── */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-divider z-40">
        <div className="flex items-center justify-around px-xs py-xs pb-[max(8px,env(safe-area-inset-bottom))]">
          {navItems.slice(0, 4).map((item) => {
            const active = isActive(item.path);
            return (
              <button
                key={item.path}
                onClick={() => handleNav(item.path)}
                className={`flex flex-col items-center gap-[2px] py-xs rounded-xl min-w-0 flex-1 transition-colors relative ${active ? 'text-primary' : 'text-text-muted'}`}
              >
                <span className={`text-lg transition-transform relative ${active ? 'scale-110' : ''}`}>
                  {item.icon}
                  {item.badge != null && item.badge > 0 && (
                    <span className="absolute -top-1 -right-1 min-w-[14px] h-[14px] bg-error text-white text-[8px] font-bold rounded-full flex items-center justify-center px-[2px]">
                      {item.badge}
                    </span>
                  )}
                </span>
                <span className={`font-baloo text-[10px] leading-tight truncate max-w-full ${active ? 'font-bold' : 'font-medium'}`}>
                  {item.label}
                </span>
                {active && <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-primary" />}
              </button>
            );
          })}
          {navItems.length > 4 && (
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="flex flex-col items-center gap-[2px] py-xs rounded-xl min-w-0 flex-1 text-text-muted"
            >
              <span className="text-lg">⋯</span>
              <span className="font-baloo text-[10px] leading-tight font-medium">More</span>
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
              className="md:hidden fixed inset-0 bg-black/20 z-50"
            />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 320 }}
              className="md:hidden fixed bottom-0 left-0 right-0 bg-white rounded-t-xxl z-50 max-h-[75vh] overflow-y-auto"
            >
              <div className="p-md">
                {/* Drag handle */}
                <div className="w-8 h-1 bg-divider rounded-full mx-auto mb-md" />
                {/* User info */}
                <div className="flex items-center gap-md mb-md pb-md border-b border-divider">
                  <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-white font-baloo font-bold">
                    {userInitial}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-baloo font-semibold text-sm text-text-dark truncate">{user?.email}</p>
                    <p className="font-baloo text-xs text-text-muted">{roleLabel}</p>
                  </div>
                </div>
                {/* Nav items */}
                <div className="space-y-xs mb-md">
                  {navItems.map((item) => {
                    const active = isActive(item.path);
                    return (
                      <button
                        key={item.path}
                        onClick={() => handleNav(item.path)}
                        className={`w-full flex items-center gap-md px-md py-sm rounded-xl font-baloo font-semibold text-sm transition-colors ${
                          active ? 'bg-primary text-white' : 'text-text-dark hover:bg-lavender-light'
                        }`}
                      >
                        <span className="text-xl relative">
                          {item.icon}
                          {item.badge != null && item.badge > 0 && (
                            <span className="absolute -top-1 -right-1 min-w-[14px] h-[14px] bg-error text-white text-[8px] font-bold rounded-full flex items-center justify-center px-[2px]">
                              {item.badge}
                            </span>
                          )}
                        </span>
                        <span className="flex-1 text-left">{item.label}</span>
                        {item.badge != null && item.badge > 0 && (
                          <span className={`min-w-[20px] h-5 text-[10px] font-bold rounded-full flex items-center justify-center px-[5px] ${active ? 'bg-white/30 text-white' : 'bg-error text-white'}`}>
                            {item.badge > 99 ? '99+' : item.badge}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
                <button
                  onClick={() => { setMobileMenuOpen(false); logout(); }}
                  className="w-full flex items-center gap-md px-md py-sm rounded-xl font-baloo font-medium text-sm text-error hover:bg-rose-light transition-colors"
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
        transition={{ duration: 0.25, ease: 'easeInOut' }}
        className="min-h-screen pt-[52px] pb-[72px] md:pt-0 md:pb-0"
        style={{ willChange: 'margin-left' }}
      >
        {/* Desktop top bar */}
        <header className="hidden md:flex items-center bg-white border-b border-divider sticky top-0 z-30 h-[52px] px-lg gap-sm">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="w-8 h-8 rounded-lg hover:bg-lavender-light transition-colors flex items-center justify-center text-text-muted text-sm flex-shrink-0"
            title={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
          >
            {sidebarOpen ? '◀' : '▶'}
          </button>
          <nav className="flex items-center gap-xs font-baloo text-sm">
            {breadcrumbs.map((crumb, i) => (
              <span key={crumb.path} className="flex items-center gap-xs">
                {i > 0 && <span className="text-divider select-none">/</span>}
                <button
                  onClick={() => !crumb.isCurrent && navigate(crumb.path)}
                  className={crumb.isCurrent
                    ? 'text-text-dark font-semibold cursor-default'
                    : 'text-text-muted hover:text-primary transition-colors'
                  }
                >
                  {crumb.label}
                </button>
              </span>
            ))}
          </nav>
        </header>

        {/* Page content */}
        <motion.div
          key={location.pathname}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className="p-md md:p-lg lg:p-xl"
        >
          {children}
        </motion.div>
      </motion.div>
    </div>
  );
}
