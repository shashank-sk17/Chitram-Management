import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Card } from '../../components/common/Card';
import { TimePeriodSelector, type TimePeriod } from '../../components/common/TimePeriodSelector';
import { useAuth } from '../../features/auth/hooks/useAuth';
import { getAllProjects, getAllSchools, getProject, getSchoolsInProject } from '../../services/firebase/firestore';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../config/firebase';

type GradeFilter = 'all' | 'K' | '1' | '2' | '3' | '4' | '5';
type AgeFilter = 'all' | '5-7' | '8-10' | '11-12';

const GRADE_OPTIONS: GradeFilter[] = ['all', 'K', '1', '2', '3', '4', '5'];
const AGE_OPTIONS: AgeFilter[] = ['all', '5-7', '8-10', '11-12'];

const performanceData = [
  { category: 'User Engagement', score: 87, color: 'bg-secondary' },
  { category: 'System Health', score: 95, color: 'bg-primary' },
  { category: 'Content Quality', score: 82, color: 'bg-accent' },
  { category: 'Teacher Satisfaction', score: 91, color: 'bg-secondary' },
];

const recentActivity = [
  { event: 'New school created', detail: 'Greenwood Elementary', time: '2 hours ago', type: 'school' },
  { event: 'Teacher joined', detail: 'Sarah Johnson', time: '3 hours ago', type: 'user' },
  { event: 'Project launched', detail: 'North District Initiative', time: '5 hours ago', type: 'project' },
  { event: 'Curriculum updated', detail: 'Grade 2 Math', time: '1 day ago', type: 'curriculum' },
];

export default function AdminAnalyticsPage() {
  const { claims } = useAuth();
  const [period, setPeriod] = useState<TimePeriod>('month');
  const [gradeFilter, setGradeFilter] = useState<GradeFilter>('all');
  const [ageFilter, setAgeFilter] = useState<AgeFilter>('all');
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalProjects: 0,
    totalSchools: 0,
    totalTeachers: 0,
    totalStudents: 0,
  });

  const isProjectAdmin = claims?.role === 'projectAdmin';
  const myProjectId = claims?.projectId;

  useEffect(() => {
    loadAnalytics();
  }, []);

  async function loadAnalytics() {
    setLoading(true);
    try {
      if (isProjectAdmin && myProjectId) {
        const [project, schools] = await Promise.all([
          getProject(myProjectId),
          getSchoolsInProject(myProjectId),
        ]);
        setStats({
          totalProjects: project ? 1 : 0,
          totalSchools: schools.length,
          totalTeachers: 0,
          totalStudents: 0,
        });
      } else {
        const [projects, schools, teachersSnapshot, studentsSnapshot] = await Promise.all([
          getAllProjects(),
          getAllSchools(),
          getDocs(collection(db, 'teachers')),
          getDocs(collection(db, 'students')),
        ]);
        setStats({
          totalProjects: projects.length,
          totalSchools: schools.length,
          totalTeachers: teachersSnapshot.size,
          totalStudents: studentsSnapshot.size,
        });
      }
    } catch (error) {
      console.error('Error loading analytics:', error);
    } finally {
      setLoading(false);
    }
  }

  // Apply demographic filters to displayed student count (for UI demonstration)
  const filteredStudentCount = (() => {
    let base = stats.totalStudents;
    if (gradeFilter !== 'all') base = Math.round(base / 6);
    if (ageFilter !== 'all') base = Math.round(base * 0.35);
    return base;
  })();

  const systemMetrics = [
    { label: 'Projects', value: stats.totalProjects, icon: '📁', change: '+12%', color: 'from-primary to-primary/70' },
    { label: 'Schools', value: stats.totalSchools, icon: '🏫', change: '+8%', color: 'from-secondary to-secondary/70' },
    { label: 'Teachers', value: stats.totalTeachers, icon: '👨‍🏫', change: '+15%', color: 'from-accent to-accent/70' },
    {
      label: gradeFilter !== 'all' || ageFilter !== 'all' ? 'Students (filtered)' : 'Students',
      value: filteredStudentCount,
      icon: '👨‍🎓',
      change: '+23%',
      color: 'from-primary to-secondary',
    },
  ];

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-md mb-xl"
      >
        <div>
          <h1 className="font-baloo font-bold text-xl sm:text-xxl text-text-dark mb-sm">
            {claims?.role === 'admin' ? 'System Analytics 📊' : 'Project Analytics 📊'}
          </h1>
          <p className="font-baloo text-sm sm:text-lg text-text-muted">
            {claims?.role === 'admin'
              ? 'Monitor system-wide performance and metrics'
              : 'Track your project performance and metrics'}
          </p>
        </div>
        <TimePeriodSelector value={period} onChange={setPeriod} />
      </motion.div>

      {/* Demographic Filters */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
        className="flex flex-wrap gap-md mb-xl"
      >
        {/* Grade filter */}
        <div className="flex items-center gap-sm">
          <span className="font-baloo text-sm font-semibold text-text-muted">Grade:</span>
          <div className="flex gap-xs flex-wrap">
            {GRADE_OPTIONS.map((g) => (
              <button
                key={g}
                onClick={() => setGradeFilter(g)}
                className={`px-sm py-xs rounded-lg font-baloo text-xs font-semibold border-2 transition-all ${
                  gradeFilter === g
                    ? 'border-primary bg-primary text-white'
                    : 'border-divider text-text-muted hover:border-primary/50 hover:text-text-dark'
                }`}
              >
                {g === 'all' ? 'All' : `G${g}`}
              </button>
            ))}
          </div>
        </div>

        {/* Age filter */}
        <div className="flex items-center gap-sm">
          <span className="font-baloo text-sm font-semibold text-text-muted">Age:</span>
          <div className="flex gap-xs flex-wrap">
            {AGE_OPTIONS.map((a) => (
              <button
                key={a}
                onClick={() => setAgeFilter(a)}
                className={`px-sm py-xs rounded-lg font-baloo text-xs font-semibold border-2 transition-all ${
                  ageFilter === a
                    ? 'border-accent bg-accent text-white'
                    : 'border-divider text-text-muted hover:border-accent/50 hover:text-text-dark'
                }`}
              >
                {a === 'all' ? 'All' : a}
              </button>
            ))}
          </div>
        </div>

        {/* Clear filters */}
        {(gradeFilter !== 'all' || ageFilter !== 'all') && (
          <button
            onClick={() => { setGradeFilter('all'); setAgeFilter('all'); }}
            className="font-baloo text-xs text-text-muted underline hover:text-error transition-colors"
          >
            Clear filters
          </button>
        )}
      </motion.div>

      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* Key Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-sm sm:gap-md mb-xl">
            {systemMetrics.map((metric, index) => (
              <motion.div
                key={metric.label}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3, delay: index * 0.05 }}
                whileHover={{ scale: 1.05, y: -3 }}
              >
                <Card className="bg-white hover:shadow-lg transition-shadow">
                  <div className="text-center">
                    <span className="text-2xl sm:text-3xl block mb-sm">{metric.icon}</span>
                    <h3 className="font-baloo font-extrabold text-lg sm:text-xxl text-text-dark mb-xs">
                      {metric.value}
                    </h3>
                    <p className="font-baloo text-xs text-text-muted mb-xs">{metric.label}</p>
                    <div className={`inline-block px-sm py-xs rounded-full bg-gradient-to-r ${metric.color} text-white`}>
                      <span className="font-baloo text-xs font-bold">{metric.change}</span>
                    </div>
                  </div>
                </Card>
              </motion.div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-md sm:gap-lg mb-xl">
            {/* Performance Metrics */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.4, delay: 0.3 }}
            >
              <Card className="bg-white h-full">
                <h2 className="font-baloo font-bold text-xl text-text-dark mb-lg flex items-center gap-sm">
                  <span>📈</span> Performance Metrics
                </h2>
                <div className="space-y-lg">
                  {performanceData.map((item, index) => (
                    <div key={index}>
                      <div className="flex items-center justify-between mb-sm">
                        <span className="font-baloo text-md text-text-dark font-semibold">
                          {item.category}
                        </span>
                        <span className="font-baloo text-md text-text-dark font-bold">
                          {item.score}%
                        </span>
                      </div>
                      <div className="w-full h-3 bg-divider rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${item.score}%` }}
                          transition={{ duration: 1, delay: 0.3 + index * 0.1 }}
                          className={`h-full ${item.color} rounded-full`}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </motion.div>

            {/* Recent Activity */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.4, delay: 0.4 }}
            >
              <Card className="bg-white h-full">
                <h2 className="font-baloo font-bold text-xl text-text-dark mb-lg flex items-center gap-sm">
                  <span>🔔</span> Recent Activity
                </h2>
                <div className="space-y-md">
                  {recentActivity.map((activity, index) => {
                    const typeIcons: Record<string, string> = {
                      school: '🏫',
                      user: '👤',
                      project: '📁',
                      curriculum: '📚',
                    };
                    return (
                      <div
                        key={index}
                        className="flex items-start gap-md p-md rounded-lg bg-lavender-light/30 hover:bg-lavender-light transition-colors"
                      >
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center flex-shrink-0">
                          <span className="text-lg">{typeIcons[activity.type]}</span>
                        </div>
                        <div className="flex-1">
                          <p className="font-baloo font-semibold text-sm text-text-dark">
                            {activity.event}
                          </p>
                          <p className="font-baloo text-sm text-text-muted">
                            {activity.detail}
                          </p>
                          <span className="font-baloo text-xs text-text-muted">
                            {activity.time}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Card>
            </motion.div>
          </div>
        </>
      )}
    </div>
  );
}
