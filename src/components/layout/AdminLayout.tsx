import { type ReactNode, useMemo } from 'react';
import { AppLayout } from './AppLayout';
import { useAuthStore } from '../../stores/authStore';

interface AdminLayoutProps {
  children: ReactNode;
}

export function AdminLayout({ children }: AdminLayoutProps) {
  const { claims } = useAuthStore();

  // Filter nav items based on exact role
  const navItems = useMemo(() => {
    const isSuperAdmin = claims?.role === 'admin';

    const items = [
      { path: '', label: 'Dashboard', icon: '📊' },
      // Curriculum only for super admin
      ...(isSuperAdmin ? [{ path: '/admin/curriculum', label: 'Curriculum', icon: '📚' }] : []),
      { path: '/admin/projects', label: 'Projects', icon: '🎯' },
      { path: '/admin/schools', label: 'Schools', icon: '🏫' },
      { path: '/admin/users', label: 'Users', icon: '👥' },
      { path: '/admin/analytics', label: 'Analytics', icon: '📈' },
    ];

    return items;
  }, [claims]);

  return <AppLayout navItems={navItems}>{children}</AppLayout>;
}
