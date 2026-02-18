import { type ReactNode } from 'react';
import { AppLayout } from './AppLayout';

interface PrincipalLayoutProps {
  children: ReactNode;
}

// Only show implemented features
const principalNavItems = [
  { path: '', label: 'Dashboard', icon: '🏛️' },
  { path: '/principal/analytics', label: 'Analytics', icon: '📊' },
];

export function PrincipalLayout({ children }: PrincipalLayoutProps) {
  return <AppLayout navItems={principalNavItems}>{children}</AppLayout>;
}
