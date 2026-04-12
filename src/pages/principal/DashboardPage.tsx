import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { StatCardSkeleton, RowSkeleton } from '../../components/common/Skeleton';
import { useAuth } from '../../features/auth/hooks/useAuth';
import {
  getTeachersBySchool,
  getClassesBySchool,
  getSchoolStats,
} from '../../services/firebase/firestore';
import type { ClassDoc } from '../../types/firestore';

interface ClassRow {
  id: string;
  name: string;
  grade: string;
  studentCount: number;
}

export default function PrincipalDashboardPage() {
  const navigate = useNavigate();
  const { user, claims } = useAuth();
  const schoolIds: string[] = claims?.schoolIds ?? [];

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [teacherCount, setTeacherCount] = useState(0);
  const [studentCount, setStudentCount] = useState(0);
  const [classCount, setClassCount] = useState(0);
  const [avgAccuracy, setAvgAccuracy] = useState<number | null>(null);
  const [topClasses, setTopClasses] = useState<ClassRow[]>([]);

  useEffect(() => {
    if (schoolIds.length === 0) return;
    loadData();
  }, [schoolIds.length]);

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const [teacherResults, classResults, statsResults] = await Promise.all([
        Promise.all(schoolIds.map((id) => getTeachersBySchool(id))),
        Promise.all(schoolIds.map((id) => getClassesBySchool(id))),
        Promise.all(schoolIds.map((id) => getSchoolStats(id, 7))),
      ]);

      // Teacher count (deduplicate by id)
      const allTeacherIds = new Set(teacherResults.flat().map((t) => t.id));
      setTeacherCount(allTeacherIds.size);

      // Classes + student count
      const allClasses = classResults.flat() as Array<ClassDoc & { id: string }>;
      setClassCount(allClasses.length);
      const totalStudents = allClasses.reduce(
        (sum, c) => sum + (c.studentIds?.length ?? 0),
        0
      );
      setStudentCount(totalStudents);

      // Avg accuracy across all school stats (last 7d)
      const allStats = statsResults.flat();
      if (allStats.length > 0) {
        const validStats = allStats.filter((s) => s.avgAccuracy > 0);
        if (validStats.length > 0) {
          const avg = validStats.reduce((sum, s) => sum + s.avgAccuracy, 0) / validStats.length;
          setAvgAccuracy(Math.round(avg * 100));
        }
      }

      // Top 3 classes by student count
      const sorted = [...allClasses]
        .sort((a, b) => (b.studentIds?.length ?? 0) - (a.studentIds?.length ?? 0))
        .slice(0, 3)
        .map((c) => ({
          id: c.id,
          name: c.name,
          grade: c.grade,
          studentCount: c.studentIds?.length ?? 0,
        }));
      setTopClasses(sorted);
    } catch (err: any) {
      console.error('Principal Dashboard load error:', err);
      setError('Failed to load school data. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  const statCards = [
    { label: 'Teachers', value: teacherCount, icon: '👨‍🏫', color: 'bg-lavender-light' },
    { label: 'Students', value: studentCount, icon: '👨‍🎓', color: 'bg-mint-light' },
    { label: 'Classes', value: classCount, icon: '📚', color: 'bg-peach-light' },
    { label: 'Avg Accuracy (7d)', value: avgAccuracy !== null ? `${avgAccuracy}%` : '—', icon: '⭐', color: 'bg-sunshine-light' },
  ];

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="mb-xl"
      >
        <h1 className="font-baloo font-bold text-xl sm:text-xxl text-text-dark mb-xs sm:mb-sm">
          Principal Dashboard
        </h1>
        <p className="font-baloo text-sm sm:text-lg text-text-muted truncate">
          {user?.email}
        </p>
      </motion.div>

      {error && (
        <div className="mb-lg p-md bg-rose-light border-2 border-error rounded-lg">
          <p className="font-baloo text-sm text-error">{error}</p>
        </div>
      )}

      {schoolIds.length === 0 && !loading && (
        <Card className="text-center py-lg">
          <p className="font-baloo text-body text-text-muted">
            No schools assigned to your account. Contact your administrator.
          </p>
        </Card>
      )}

      {/* Stat Cards */}
      {schoolIds.length > 0 && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-sm sm:gap-md mb-lg sm:mb-xl">
            {loading
              ? Array.from({ length: 4 }).map((_, i) => <StatCardSkeleton key={i} />)
              : statCards.map((stat, index) => (
                  <motion.div
                    key={stat.label}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.3, delay: index * 0.1 }}
                  >
                    <Card className={`${stat.color} text-center`}>
                      <span className="text-2xl sm:text-4xl block mb-xs sm:mb-md">{stat.icon}</span>
                      <h3 className="font-baloo font-extrabold text-lg sm:text-xxl text-text-dark mb-xs">
                        {stat.value}
                      </h3>
                      <p className="font-baloo text-xs sm:text-sm text-text-muted leading-tight">{stat.label}</p>
                    </Card>
                  </motion.div>
                ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-md sm:gap-lg">
            {/* Top Classes */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.4, delay: 0.4 }}
            >
              <Card className="bg-white">
                <h2 className="font-baloo font-bold text-xl text-text-dark mb-lg flex items-center gap-sm">
                  <span>🏆</span> Largest Classes
                </h2>
                {loading ? (
                  <div className="space-y-sm">
                    {Array.from({ length: 3 }).map((_, i) => <RowSkeleton key={i} />)}
                  </div>
                ) : topClasses.length === 0 ? (
                  <p className="font-baloo text-sm text-text-muted text-center py-lg">No classes yet.</p>
                ) : (
                  <div className="space-y-md">
                    {topClasses.map((cls, index) => (
                      <div
                        key={cls.id}
                        className="p-md rounded-lg bg-lavender-light/30"
                      >
                        <div className="flex items-center justify-between mb-sm">
                          <div>
                            <p className="font-baloo font-bold text-md text-text-dark">{cls.name}</p>
                            <p className="font-baloo text-sm text-text-muted">Grade {cls.grade}</p>
                          </div>
                          <span className="font-baloo font-extrabold text-xl text-secondary">
                            {cls.studentCount} students
                          </span>
                        </div>
                        <div className="w-full h-2 bg-divider rounded-full overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${Math.min(100, (cls.studentCount / Math.max(topClasses[0]?.studentCount, 1)) * 100)}%` }}
                            transition={{ duration: 1, delay: 0.4 + index * 0.1 }}
                            className="h-full bg-secondary"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </motion.div>

            {/* Analytics CTA */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.4, delay: 0.5 }}
            >
              <Card className="bg-lavender-light/40 flex flex-col justify-center h-full">
                <h3 className="font-baloo font-bold text-xl text-text-dark mb-sm">
                  School Performance Overview
                </h3>
                <p className="font-baloo text-sm sm:text-body text-text-muted mb-md">
                  View accuracy trends, grade breakdowns, teacher activity, and at-risk student flags.
                </p>
                <Button
                  title="View Detailed Analytics"
                  onPress={() => navigate('/principal/analytics')}
                  variant="primary"
                />
              </Card>
            </motion.div>
          </div>
        </>
      )}
    </div>
  );
}
