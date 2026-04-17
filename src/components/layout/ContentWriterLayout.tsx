import { type ReactNode } from 'react';
import { AppLayout } from './AppLayout';

export function ContentWriterLayout({ children }: { children: ReactNode }) {
  const navItems = [
    { path: '/writer', label: 'Word Editor', icon: '✍️' },
    { path: '/writer/import', label: 'CSV Import', icon: '📥' },
  ];
  return <AppLayout navItems={navItems}>{children}</AppLayout>;
}
