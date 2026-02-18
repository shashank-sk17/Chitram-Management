import { type ReactNode } from 'react';
import { AppLayout } from './AppLayout';

interface TeacherLayoutProps {
  children: ReactNode;
}

const teacherNavItems = [
  { path: '', label: 'Dashboard', icon: '🏠' },
  { path: '/teacher/curriculum', label: 'Curriculum', icon: '📖' },
  { path: '/teacher/classes', label: 'Classes', icon: '👨‍🏫' },
  { path: '/teacher/assignments', label: 'Assignments', icon: '📝' },
  { path: '/teacher/students', label: 'Students', icon: '👦' },
  { path: '/teacher/analytics', label: 'Analytics', icon: '📈' },
];

export function TeacherLayout({ children }: TeacherLayoutProps) {
  return <AppLayout navItems={teacherNavItems}>{children}</AppLayout>;
}
