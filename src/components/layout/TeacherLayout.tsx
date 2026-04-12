import { type ReactNode, useMemo } from 'react';
import { AppLayout } from './AppLayout';
import { useTeacherStore } from '../../stores/teacherStore';

interface TeacherLayoutProps {
  children: ReactNode;
}

export function TeacherLayout({ children }: TeacherLayoutProps) {
  const { classes } = useTeacherStore();

  // Count total pending students across all classes
  const pendingCount = useMemo(() =>
    classes.reduce((sum, c) => sum + (c.pendingStudentIds?.length ?? 0), 0),
    [classes]
  );

  const navItems = useMemo(() => [
    { path: '', label: 'Dashboard', icon: '🏠' },
    { path: '/teacher/classes', label: 'Classes', icon: '🏫', badge: pendingCount },
    { path: '/teacher/curriculum-editor', label: 'Curriculum', icon: '📖' },
    { path: '/teacher/assignments', label: 'Assignments', icon: '📝' },
    { path: '/teacher/student-analytics', label: 'Student Analytics', icon: '📊' },
    { path: '/teacher/announcements', label: 'Announcements', icon: '📢' },
  ], [pendingCount]);

  return <AppLayout navItems={navItems}>{children}</AppLayout>;
}
