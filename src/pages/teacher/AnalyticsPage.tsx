import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Card } from '../../components/common/Card';
import { TimePeriodSelector, type TimePeriod } from '../../components/common/TimePeriodSelector';
import { useAuth } from '../../features/auth/hooks/useAuth';
import {
  getClassesByTeacher,
  getStudentsByTeacher,
  getAssignmentsByTeacher,
} from '../../services/firebase/firestore';

interface StudentRow {
  id: string;
  name: string;
  email: string;
  avatarColor: string;
  avgAccuracy: number;
  learnedWords: number;
  totalAttempts: number;
}

interface AssignmentRow {
  id: string;
  className: string;
  status: string;
  endDate: string;
  startDate: string;
}

function periodCutoff(period: TimePeriod): Date | null {
  if (period === 'all') return null;
  const now = new Date();
  const days = period === 'week' ? 7 : period === 'month' ? 30 : 90;
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
}

function assignmentsInPeriod(assignments: AssignmentRow[], period: TimePeriod) {
  const cutoff = periodCutoff(period);
  return assignments.filter(a => {
    if (a.status !== 'completed') return false;
    if (!cutoff) return true;
    const end = new Date(a.endDate);
    return end >= cutoff;
  });
}

function activeLabel(period: TimePeriod) {
  return period === 'week'  ? 'Active This Week'
       : period === 'month'  ? 'Active This Month'
       : period === 'quarter' ? 'Active This Quarter'
       : 'All-time Active';
}

export default function AnalyticsPage() {
  const { user } = useAuth();
  const [period, setPeriod] = useState<TimePeriod>('week');
  const [loading, setLoading] = useState(true);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [assignments, setAssignments] = useState<AssignmentRow[]>([]);
  const [totalClasses, setTotalClasses] = useState(0);

  useEffect(() => {
    if (!user) return;
    loadData();
  }, [user]);

  async function loadData() {
    if (!user) return;
    setLoading(true);
    try {
      const [classesData, studentsData, assignmentsData] = await Promise.all([
        getClassesByTeacher(user.uid),
        getStudentsByTeacher(user.uid),
        getAssignmentsByTeacher(user.uid),
      ]);

      setTotalClasses(classesData.length);

      const mapped: StudentRow[] = (studentsData as any[]).map(s => ({
        id: s.id,
        name: s.name || s.email || 'Unknown',
        email: s.email || '',
        avatarColor: s.avatarColor || '#7C81FF',
        avgAccuracy: s.analytics?.averageAccuracy ?? 0,
        learnedWords: s.analytics?.learnedWords ?? 0,
        totalAttempts: s.analytics?.totalAttempts ?? 0,
      }));
      setStudents(mapped);

      const mappedA: AssignmentRow[] = (assignmentsData as any[]).map(a => ({
        id: a.id,
        className: a.className || '',
        status: a.status || '',
        endDate: a.endDate || '',
        startDate: a.startDate || '',
      }));
      setAssignments(mappedA);
    } catch (err) {
      console.error('Failed to load analytics:', err);
    } finally {
      setLoading(false);
    }
  }

  const completedThisPeriod = assignmentsInPeriod(assignments, period).length;
  const avgProgress = students.length > 0
    ? Math.round(students.reduce((sum, s) => sum + s.avgAccuracy, 0) / students.length)
    : 0;
  const topPerformers = [...students]
    .filter(s => s.totalAttempts > 0)
    .sort((a, b) => b.avgAccuracy - a.avgAccuracy)
    .slice(0, 5);
  const recentStudents = [...students]
    .sort((a, b) => b.learnedWords - a.learnedWords)
    .slice(0, 4);

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-md mb-xl"
      >
        <div>
          <h1 className="font-baloo font-bold text-xl sm:text-xxl text-text-dark mb-xs sm:mb-sm">
            Analytics 📈
          </h1>
          <p className="font-baloo text-sm sm:text-lg text-text-muted">
            Track student performance and progress across your classes
          </p>
        </div>
        <TimePeriodSelector value={period} onChange={setPeriod} />
      </motion.div>

      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* Stats Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-sm sm:gap-md mb-lg sm:mb-xl">
            {[
              { label: 'Total Students', value: students.length, icon: '👨‍🎓', color: 'bg-gradient-to-br from-lavender-light to-primary/20' },
              { label: activeLabel(period), value: students.length, icon: '✅', color: 'bg-gradient-to-br from-mint-light to-secondary/20' },
              { label: 'Avg Accuracy', value: `${avgProgress}%`, icon: '📊', color: 'bg-gradient-to-br from-peach-light to-accent/20' },
              { label: 'Assignments Done', value: completedThisPeriod, icon: '📝', color: 'bg-gradient-to-br from-lavender-light to-secondary/20' },
            ].map((stat, index) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3, delay: index * 0.1 }}
                whileHover={{ scale: 1.05, y: -5 }}
              >
                <Card className={`${stat.color} hover:shadow-xl transition-shadow`}>
                  <div className="text-center">
                    <span className="text-2xl sm:text-4xl block mb-xs sm:mb-md">{stat.icon}</span>
                    <h3 className="font-baloo font-extrabold text-lg sm:text-xxl text-text-dark mb-xs sm:mb-sm">
                      {stat.value}
                    </h3>
                    <p className="font-baloo text-xs sm:text-md text-text-muted font-semibold leading-tight">
                      {stat.label}
                    </p>
                  </div>
                </Card>
              </motion.div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-md sm:gap-lg">
            {/* Recent Students (by words learned) */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.4, delay: 0.4 }}
            >
              <Card className="bg-white">
                <h2 className="font-baloo font-bold text-xl text-text-dark mb-md flex items-center gap-sm">
                  <span>🔔</span> Student Progress
                </h2>
                {recentStudents.length === 0 ? (
                  <p className="font-baloo text-sm text-text-muted text-center py-lg">
                    No students in your classes yet.
                  </p>
                ) : (
                  <div className="space-y-md">
                    {recentStudents.map((student) => (
                      <div
                        key={student.id}
                        className="flex items-center gap-md p-md rounded-lg bg-lavender-light/30 hover:bg-lavender-light transition-colors"
                      >
                        <div
                          className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                          style={{ backgroundColor: student.avatarColor + '33' }}
                        >
                          <span
                            className="font-baloo font-bold text-sm"
                            style={{ color: student.avatarColor }}
                          >
                            {student.name[0].toUpperCase()}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-baloo font-semibold text-sm text-text-dark truncate">
                            {student.name}
                          </p>
                          <p className="font-baloo text-xs text-text-muted">
                            {student.learnedWords} words learned · {student.totalAttempts} attempts
                          </p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <span className="font-baloo text-sm font-bold text-secondary">
                            {student.avgAccuracy}%
                          </span>
                          <p className="font-baloo text-xs text-text-muted">accuracy</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </motion.div>

            {/* Top Performers */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.4, delay: 0.5 }}
            >
              <Card className="bg-white">
                <h2 className="font-baloo font-bold text-xl text-text-dark mb-md flex items-center gap-sm">
                  <span>🏆</span> Top Performers
                </h2>
                {topPerformers.length === 0 ? (
                  <p className="font-baloo text-sm text-text-muted text-center py-lg">
                    No attempt data yet. Students will appear here once they start learning.
                  </p>
                ) : (
                  <div className="space-y-md">
                    {topPerformers.map((student, index) => (
                      <div
                        key={student.id}
                        className="flex items-center gap-md p-md rounded-lg bg-gradient-to-r from-mint-light to-transparent hover:from-mint-light hover:to-mint-light/50 transition-all"
                      >
                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-accent to-primary flex items-center justify-center flex-shrink-0 shadow-md">
                          <span className="font-baloo font-extrabold text-lg text-white">
                            #{index + 1}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-baloo font-bold text-body text-text-dark truncate">
                            {student.name}
                          </p>
                          <p className="font-baloo text-sm text-text-muted">
                            {student.learnedWords} words learned
                          </p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="font-baloo font-extrabold text-lg sm:text-xxl text-secondary">
                            {student.avgAccuracy}%
                          </p>
                          <p className="font-baloo text-xs text-text-muted">
                            Avg Accuracy
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </motion.div>
          </div>

          {/* Class summary row */}
          {totalClasses > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.6 }}
              className="mt-md sm:mt-lg"
            >
              <Card className="bg-gradient-to-r from-lavender-light to-mint-light border border-primary/10">
                <div className="flex flex-wrap items-center gap-lg">
                  <div className="text-center">
                    <p className="font-baloo font-extrabold text-xxl text-primary">{totalClasses}</p>
                    <p className="font-baloo text-sm text-text-muted">Your Classes</p>
                  </div>
                  <div className="w-px h-10 bg-divider hidden sm:block" />
                  <div className="text-center">
                    <p className="font-baloo font-extrabold text-xxl text-secondary">{students.length}</p>
                    <p className="font-baloo text-sm text-text-muted">Total Students</p>
                  </div>
                  <div className="w-px h-10 bg-divider hidden sm:block" />
                  <div className="text-center">
                    <p className="font-baloo font-extrabold text-xxl text-accent">{assignments.filter(a => a.status === 'active').length}</p>
                    <p className="font-baloo text-sm text-text-muted">Active Assignments</p>
                  </div>
                  <div className="w-px h-10 bg-divider hidden sm:block" />
                  <div className="text-center">
                    <p className="font-baloo font-extrabold text-xxl text-primary">{assignments.filter(a => a.status === 'completed').length}</p>
                    <p className="font-baloo text-sm text-text-muted">Completed Assignments</p>
                  </div>
                </div>
              </Card>
            </motion.div>
          )}
        </>
      )}
    </div>
  );
}
