import { useState } from 'react';
import StudentsPage from './StudentsPage';
import PracticeTrackingPage from './PracticeTrackingPage';
import AnalyticsPage from './AnalyticsPage';

type Tab = 'students' | 'practice' | 'analytics';

const TABS: { id: Tab; label: string; icon: string; desc: string }[] = [
  { id: 'students',  label: 'Students',  icon: '👨‍🎓', desc: 'Profiles & progress' },
  { id: 'practice',  label: 'Practice',  icon: '📅',  desc: 'Daily activity & accuracy' },
  { id: 'analytics', label: 'Analytics', icon: '📈',  desc: 'Performance overview' },
];

export default function StudentAnalyticsPage() {
  const [tab, setTab] = useState<Tab>('students');

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
        {tab === 'students'  && <StudentsPage />}
        {tab === 'practice'  && <PracticeTrackingPage />}
        {tab === 'analytics' && <AnalyticsPage />}
      </div>
    </div>
  );
}
