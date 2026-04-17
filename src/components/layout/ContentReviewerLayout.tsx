import { type ReactNode, useEffect } from 'react';
import { AppLayout } from './AppLayout';
import { useCurriculumStore } from '../../stores/curriculumStore';

export function ContentReviewerLayout({ children }: { children: ReactNode }) {
  const { pendingWordsCount, refreshBadgeCounts } = useCurriculumStore();

  useEffect(() => {
    refreshBadgeCounts();
  }, []);

  const navItems = [
    { path: '/reviewer', label: 'Review Queue', icon: '✅', badge: pendingWordsCount },
  ];

  return <AppLayout navItems={navItems}>{children}</AppLayout>;
}
