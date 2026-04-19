import { type ReactNode, useMemo, useEffect, useState } from 'react';
import { AppLayout } from './AppLayout';
import { useTeacherStore } from '../../stores/teacherStore';
import { useAuthStore } from '../../stores/authStore';
import { getUnreadNotificationCount } from '../../services/firebase/notifications';

interface TeacherLayoutProps {
  children: ReactNode;
}

export function TeacherLayout({ children }: TeacherLayoutProps) {
  const { classes } = useTeacherStore();
  const { user } = useAuthStore();
  const [unreadNotifCount, setUnreadNotifCount] = useState(0);

  useEffect(() => {
    if (!user) return;
    getUnreadNotificationCount(user.uid)
      .then(setUnreadNotifCount)
      .catch(() => {});
  }, [user]);

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
    { path: '/teacher/notifications', label: 'Notifications', icon: '🔔', badge: unreadNotifCount },
  ], [pendingCount, unreadNotifCount]);

  return <AppLayout navItems={navItems}>{children}</AppLayout>;
}
