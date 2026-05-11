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

      // ── CONTENT ──────────────────────────────────────────────────────────
      ...(isSuperAdmin ? [
        { path: '/admin/word-bank',   label: 'Word Bank',          icon: '📚', badge: pendingWordsCount, sectionLabel: 'CONTENT' },
        { path: '/admin/curricula',   label: 'Language Curricula', icon: '🌐' },
        { path: '/admin/reviews',     label: 'Reviews',            icon: '✅', badge: pendingEditsCount },
        { path: '/admin/word-editor', label: 'Word Editor',        icon: '✏️' },
        { path: '/admin/word-review', label: 'Word Review',        icon: '🔍' },
      ] : []),
      ...(isProjectAdmin ? [
        { path: '/admin/word-bank', label: 'Word Bank', icon: '📚', badge: pendingWordsCount, sectionLabel: 'CONTENT' },
        { path: '/admin/reviews',   label: 'Reviews',   icon: '✅', badge: pendingEditsCount },
      ] : []),

      // ── MANAGEMENT ───────────────────────────────────────────────────────
      { path: '/admin/projects', label: 'Projects', icon: '🎯', sectionLabel: 'MANAGEMENT' },
      { path: '/admin/schools',  label: 'Schools',  icon: '🏫' },
      { path: '/admin/users',    label: 'Users',    icon: '👥' },

      // ── PLATFORM ─────────────────────────────────────────────────────────
      { path: '/admin/analytics', label: 'Analytics', icon: '📈', sectionLabel: 'PLATFORM' },
      ...(isSuperAdmin ? [
        { path: '/admin/license-keys',           label: 'License Keys',       icon: '🔑' },
        { path: '/admin/brand-profiles',         label: 'Brand Profiles',     icon: '🎨' },
        { path: '/admin/discounts',              label: 'Discounts',          icon: '🏷️' },
        { path: '/admin/analytics-visibility',   label: 'Analytics Controls', icon: '📊' },
        { path: '/admin/feature-controls',       label: 'Feature Controls',   icon: '🎛️' },
        { path: '/admin/feature-permissions',    label: 'Feature Permissions',icon: '🔐' },
      ] : []),
    ];
  }, [claims, pendingWordsCount, pendingEditsCount]);

  return <AppLayout navItems={navItems} showNotificationBell>{children}</AppLayout>;
}
