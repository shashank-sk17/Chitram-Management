import { type ReactNode, useMemo, useEffect } from 'react';
import { AppLayout } from './AppLayout';
import { useAuthStore } from '../../stores/authStore';
import { useCurriculumStore } from '../../stores/curriculumStore';

interface AdminLayoutProps {
  children: ReactNode;
}

export function AdminLayout({ children }: AdminLayoutProps) {
  const { claims } = useAuthStore();
  const { pendingWordsCount, pendingEditsCount, refreshBadgeCounts } = useCurriculumStore();

  useEffect(() => {
    refreshBadgeCounts();
  }, []);

  const navItems = useMemo(() => {
    const isSuperAdmin = claims?.role === 'admin';
    const isProjectAdmin = claims?.role === 'projectAdmin';
    return [
      { path: '', label: 'Dashboard', icon: '🏠' },
      ...(isSuperAdmin ? [
        { path: '/admin/word-bank', label: 'Word Bank', icon: '📚', badge: pendingWordsCount },
        { path: '/admin/curricula', label: 'Language Curricula', icon: '🌐' },
        { path: '/admin/reviews', label: 'Reviews', icon: '✅', badge: pendingEditsCount },
        { path: '/admin/license-keys', label: 'License Keys', icon: '🔑' },
        { path: '/admin/brand-profiles', label: 'Brand Profiles', icon: '🎨' },
        { path: '/admin/discounts', label: 'Discounts', icon: '🏷️' },
        { path: '/admin/analytics-visibility', label: 'Analytics Controls', icon: '🎛️' },
        { path: '/admin/feature-permissions', label: 'Feature Permissions', icon: '🔐' },
      ] : []),
      ...(isProjectAdmin ? [
        { path: '/admin/word-bank', label: 'Word Bank', icon: '📚', badge: pendingWordsCount },
        { path: '/admin/reviews', label: 'Reviews', icon: '✅', badge: pendingEditsCount },
      ] : []),
      { path: '/admin/projects', label: 'Projects', icon: '🎯' },
      { path: '/admin/schools', label: 'Schools', icon: '🏫' },
      { path: '/admin/users', label: 'Users', icon: '👥' },
      { path: '/admin/analytics', label: 'Analytics', icon: '📈' },
    ];
  }, [claims, pendingWordsCount, pendingEditsCount]);

  return <AppLayout navItems={navItems} showNotificationBell>{children}</AppLayout>;
}
