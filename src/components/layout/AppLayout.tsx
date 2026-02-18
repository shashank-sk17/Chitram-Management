import { type ReactNode, useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../../features/auth/hooks/useAuth';
import { useAuthStore } from '../../stores/authStore';

interface NavItem {
  path: string;
  label: string;
  icon: string;
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

export function AppLayout({ children, navItems }: AppLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { logout } = useAuth();
  const { user, claims } = useAuthStore();
  const isDesktop = useIsDesktop();

  const isActive = (path: string) => {
    const currentPath = location.pathname;
    if (path === '') {
      return currentPath === `/${claims?.role}` || currentPath === `/${claims?.role}/`;
    }
    return currentPath.includes(path);
  };

  const handleNav = (path: string) => {
    navigate(path || `/${claims?.role}`);
    setMobileMenuOpen(false);
  };

  const sidebarWidth = sidebarOpen ? 260 : 72;

  return (
    <div className="min-h-screen min-h-[100dvh] bg-gradient-to-br from-bg-cream via-lavender-light to-mint-light">
      {/* ===== DESKTOP SIDEBAR (hidden on mobile) ===== */}
      <motion.aside
        initial={false}
        animate={{ width: sidebarWidth }}
        transition={{ duration: 0.3, ease: 'easeInOut' }}
        className="fixed left-0 top-0 h-full bg-white shadow-lg z-40 overflow-hidden hidden md:flex flex-col"
      >
        {/* Logo */}
        <div className="p-md border-b border-divider flex-shrink-0">
          <div
            className="flex items-center gap-sm cursor-pointer"
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center shadow-md flex-shrink-0">
              <span className="text-xl">🎨</span>
            </div>
            <AnimatePresence>
              {sidebarOpen && (
                <motion.div
                  initial={{ opacity: 0, width: 0 }}
                  animate={{ opacity: 1, width: 'auto' }}
                  exit={{ opacity: 0, width: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden whitespace-nowrap"
                >
                  <h1 className="font-baloo font-extrabold text-lg text-primary leading-tight">
                    Chitram
                  </h1>
                  <p className="font-baloo text-xs text-text-muted leading-tight">
                    Management
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-md overflow-y-auto">
          <div className="space-y-xs px-sm">
            {navItems.map((item) => {
              const active = isActive(item.path);
              return (
                <motion.button
                  key={item.path}
                  onClick={() => handleNav(item.path)}
                  className={`
                    w-full flex items-center gap-sm px-sm py-sm rounded-lg
                    font-baloo font-semibold text-sm transition-all duration-150
                    ${active
                      ? 'bg-gradient-to-r from-primary to-secondary text-white shadow-md'
                      : 'text-text-dark hover:bg-lavender-light'
                    }
                  `}
                  whileTap={{ scale: 0.97 }}
                >
                  <span className="text-xl flex-shrink-0 w-8 text-center">{item.icon}</span>
                  <AnimatePresence>
                    {sidebarOpen && (
                      <motion.span
                        initial={{ opacity: 0, width: 0 }}
                        animate={{ opacity: 1, width: 'auto' }}
                        exit={{ opacity: 0, width: 0 }}
                        transition={{ duration: 0.15 }}
                        className="overflow-hidden whitespace-nowrap"
                      >
                        {item.label}
                      </motion.span>
                    )}
                  </AnimatePresence>
                </motion.button>
              );
            })}
          </div>
        </nav>

        {/* User */}
        <div className="p-sm border-t border-divider flex-shrink-0">
          <div className="flex items-center gap-sm mb-sm px-xs">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-accent to-primary flex items-center justify-center text-white font-baloo font-bold text-xs shadow-sm flex-shrink-0">
              {user?.email?.[0].toUpperCase()}
            </div>
            <AnimatePresence>
              {sidebarOpen && (
                <motion.div
                  initial={{ opacity: 0, width: 0 }}
                  animate={{ opacity: 1, width: 'auto' }}
                  exit={{ opacity: 0, width: 0 }}
                  className="overflow-hidden min-w-0"
                >
                  <p className="font-baloo font-semibold text-xs text-text-dark truncate max-w-[160px]">
                    {user?.email}
                  </p>
                  <p className="font-baloo text-xs text-text-muted capitalize leading-tight">
                    {claims?.role}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <motion.button
            onClick={logout}
            className="w-full flex items-center justify-center gap-xs px-sm py-xs rounded-lg font-baloo font-medium text-xs text-text-muted hover:text-error hover:bg-rose-light/50 transition-colors"
            whileTap={{ scale: 0.97 }}
          >
            <span className="text-sm">⎋</span>
            {sidebarOpen && <span>Sign Out</span>}
          </motion.button>
        </div>
      </motion.aside>

      {/* ===== MOBILE TOP BAR ===== */}
      <header className="md:hidden fixed top-0 left-0 right-0 bg-white/95 backdrop-blur-md border-b border-divider z-40">
        <div className="flex items-center justify-between px-md py-sm">
          <div className="flex items-center gap-sm">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
              <span className="text-sm">🎨</span>
            </div>
            <span className="font-baloo font-bold text-md text-primary">Chitram</span>
          </div>
          <button
            onClick={() => setMobileMenuOpen(true)}
            className="w-8 h-8 rounded-full bg-gradient-to-br from-accent to-primary flex items-center justify-center text-white font-baloo font-bold text-xs"
          >
            {user?.email?.[0].toUpperCase()}
          </button>
        </div>
      </header>

      {/* ===== MOBILE BOTTOM NAV ===== */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-divider z-40">
        <div className="flex items-center justify-around px-xs py-xs pb-[max(8px,env(safe-area-inset-bottom))]">
          {navItems.slice(0, 4).map((item) => {
            const active = isActive(item.path);
            return (
              <button
                key={item.path}
                onClick={() => handleNav(item.path)}
                className={`flex flex-col items-center gap-[2px] py-xs rounded-lg min-w-0 flex-1 transition-colors ${
                  active ? 'text-primary' : 'text-text-muted'
                }`}
              >
                <span className={`text-lg ${active ? 'scale-110' : ''} transition-transform`}>
                  {item.icon}
                </span>
                <span className={`font-baloo text-[10px] leading-tight truncate max-w-full ${
                  active ? 'font-bold' : 'font-medium'
                }`}>
                  {item.label}
                </span>
              </button>
            );
          })}
          {navItems.length > 4 && (
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="flex flex-col items-center gap-[2px] py-xs rounded-lg min-w-0 flex-1 text-text-muted"
            >
              <span className="text-lg">•••</span>
              <span className="font-baloo text-[10px] leading-tight font-medium">More</span>
            </button>
          )}
        </div>
      </nav>

      {/* ===== MOBILE MENU OVERLAY ===== */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileMenuOpen(false)}
              className="md:hidden fixed inset-0 bg-black/30 z-50"
            />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="md:hidden fixed bottom-0 left-0 right-0 bg-white rounded-t-xxl z-50 max-h-[70vh] overflow-y-auto"
            >
              <div className="p-md">
                <div className="w-10 h-1 bg-divider rounded-full mx-auto mb-md" />

                <div className="flex items-center gap-md mb-md pb-md border-b border-divider">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-accent to-primary flex items-center justify-center text-white font-baloo font-bold shadow-sm">
                    {user?.email?.[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-baloo font-semibold text-sm text-text-dark truncate">
                      {user?.email}
                    </p>
                    <p className="font-baloo text-xs text-text-muted capitalize">
                      {claims?.role}
                    </p>
                  </div>
                </div>

                <div className="space-y-xs mb-md">
                  {navItems.map((item) => {
                    const active = isActive(item.path);
                    return (
                      <button
                        key={item.path}
                        onClick={() => handleNav(item.path)}
                        className={`w-full flex items-center gap-md px-md py-sm rounded-xl font-baloo font-semibold text-sm transition-colors ${
                          active
                            ? 'bg-gradient-to-r from-primary to-secondary text-white'
                            : 'text-text-dark hover:bg-lavender-light'
                        }`}
                      >
                        <span className="text-xl">{item.icon}</span>
                        <span>{item.label}</span>
                      </button>
                    );
                  })}
                </div>

                <button
                  onClick={() => { setMobileMenuOpen(false); logout(); }}
                  className="w-full flex items-center gap-md px-md py-sm rounded-xl font-baloo font-medium text-sm text-error hover:bg-rose-light/50 transition-colors"
                >
                  <span className="text-xl">⎋</span>
                  <span>Sign Out</span>
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ===== MAIN CONTENT ===== */}
      <motion.div
        initial={false}
        animate={{ marginLeft: isDesktop ? sidebarWidth : 0 }}
        transition={{ duration: 0.3, ease: 'easeInOut' }}
        className="min-h-screen pt-[52px] pb-[72px] md:pt-0 md:pb-0"
      >
        {/* Desktop top bar */}
        <header className="hidden md:block bg-white/80 backdrop-blur-md border-b border-divider sticky top-0 z-30">
          <div className="px-lg py-sm flex items-center justify-between">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="w-9 h-9 rounded-lg bg-lavender-light flex items-center justify-center hover:bg-primary hover:text-white transition-colors"
            >
              <span className="text-lg">{sidebarOpen ? '←' : '→'}</span>
            </button>
            <div className="flex items-center gap-sm">
              <div className="w-6 h-6 rounded-md bg-gradient-to-br from-primary to-secondary opacity-20" />
              <div className="w-6 h-6 rounded-md bg-gradient-to-br from-secondary to-accent opacity-20" />
              <div className="w-6 h-6 rounded-md bg-gradient-to-br from-accent to-primary opacity-20" />
            </div>
          </div>
        </header>

        {/* Page content */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="p-md md:p-lg lg:p-xl"
        >
          {children}
        </motion.div>
      </motion.div>
    </div>
  );
}
