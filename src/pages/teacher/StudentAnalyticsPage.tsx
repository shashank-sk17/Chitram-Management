import { useState } from 'react';
import StudentsPage from './StudentsPage';
import PracticeTrackingPage from './PracticeTrackingPage';
import AnalyticsPage from './AnalyticsPage';
import TeacherGamificationPage from './TeacherGamificationPage';
import { useAnalyticsVisibility } from '../../hooks/useAnalyticsVisibility';
import { useAuthStore } from '../../stores/authStore';
import { useAuth } from '../../features/auth/hooks/useAuth';

type Tab = 'students' | 'practice' | 'analytics' | 'gamification';

const ALL_TABS: { id: Tab; label: string; icon: string; desc: string; section: string }[] = [
  { id: 'students',      label: 'Students',      icon: '👨‍🎓', desc: 'Profiles & progress',      section: 'studentTable' },
  { id: 'practice',      label: 'Practice',      icon: '📅',  desc: 'Daily activity & accuracy', section: 'assignmentMetrics' },
  { id: 'analytics',     label: 'Analytics',     icon: '📈',  desc: 'Performance overview',      section: 'studentTable' },
  { id: 'gamification',  label: 'Gamification',  icon: '🏆',  desc: 'XP, levels & badges',       section: 'gamification' },
];

export default function StudentAnalyticsPage() {
  const [tab, setTab] = useState<Tab>('students');
  const { user: authUser } = useAuthStore();
  const { claims } = useAuth();
  const { sections } = useAnalyticsVisibility({ role: 'teacher', projectId: claims?.projectId, uid: authUser?.uid });
  const TABS = ALL_TABS.filter(t => sections[t.section as keyof typeof sections] !== false);

  return (
    <div className="space-y-lg">
      {/* Page header */}
      <div>
        <h1 className="font-baloo font-extrabold text-xxl text-text-dark">Student Analytics 📊</h1>
        <p className="font-baloo text-body text-text-muted">Students, practice tracking and performance in one place</p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-sm flex-wrap">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-sm px-lg py-sm rounded-2xl font-baloo font-bold text-md border-2 transition-all ${
              tab === t.id
                ? 'border-primary bg-lavender-light text-primary shadow-sm'
                : 'border-divider bg-white text-text-muted hover:text-text-dark hover:border-primary/30'
            }`}
          >
            <span className="text-xl">{t.icon}</span>
            <div className="text-left">
              <p className="leading-tight">{t.label}</p>
              <p className={`text-xs font-normal leading-tight ${tab === t.id ? 'text-primary/70' : 'text-text-muted'}`}>
                {t.desc}
              </p>
            </div>
          </button>
        ))}
      </div>

      {/* Tab content — each page manages its own data */}
      <div>
        {tab === 'students'     && <StudentsPage />}
        {tab === 'practice'     && <PracticeTrackingPage />}
        {tab === 'analytics'    && <AnalyticsPage />}
        {tab === 'gamification' && <TeacherGamificationPage />}
      </div>
    </div>
  );
}
