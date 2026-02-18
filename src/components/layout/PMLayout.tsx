import { type ReactNode } from 'react';
import { AppLayout } from './AppLayout';

interface PMLayoutProps {
  children: ReactNode;
}

// Only show implemented features
const pmNavItems = [
  { path: '', label: 'Dashboard', icon: '🎯' },
  { path: '/pm/analytics', label: 'Analytics', icon: '📈' },
];

export function PMLayout({ children }: PMLayoutProps) {
  return <AppLayout navItems={pmNavItems}>{children}</AppLayout>;
}
