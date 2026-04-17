import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { StatCardSkeleton, RowSkeleton } from '../../components/common/Skeleton';
import { useAuth } from '../../features/auth/hooks/useAuth';
import {
  getSchoolsInProject,
  getClassesBySchool,
  getLearningAttemptsByProject,
} from '../../services/firebase/firestore';

interface SchoolRow {
  id: string;
  name: string;
  code: string;
  classCount: number;
  activeStudents: number;
}

export default function PMDashboardPage() {
  const navigate = useNavigate();
  const { user, claims } = useAuth();
  const projectId: string | undefined = claims?.projectId;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [schoolCount, setSchoolCount] = useState(0);
  const [activeStudents, setActiveStudents] = useState(0);
  const [avgAccuracy, setAvgAccuracy] = useState<number | null>(null);
  const [totalClasses, setTotalClasses] = useState(0);
  const [schoolRows, setSchoolRows] = useState<SchoolRow[]>([]);

  useEffect(() => {
    if (!projectId) return;
    loadData();
  }, [projectId]);

  async function loadData() {
    if (!projectId) return;
    setLoading(true);
    setError(null);
    try {
      const [schools, attempts] = await Promise.all([
        getSchoolsInProject(projectId),
        getLearningAttemptsByProject(projectId, 7),
      ]);

      setSchoolCount(schools.length);

      // Active students: distinct UIDs in last 7d
      const uniqueStudents = new Set(attempts.map((a) => a.studentUid));
      setActiveStudents(uniqueStudents.size);

      // Avg accuracy across attempts
      if (attempts.length > 0) {
        const avg = attempts.reduce((sum, a) => sum + (a.accuracy || 0), 0) / attempts.length;
        setAvgAccuracy(Math.round(avg * 100));
      }

      // Per-school active student counts
      const schoolActiveMap: Record<string, Set<string>> = {};
      for (const a of attempts) {
        if (!a.classId) continue;
        if (!schoolActiveMap[a.classId]) schoolActiveMap[a.classId] = new Set();
        schoolActiveMap[a.classId].add(a.studentUid);
      }

      // Load class counts per school
      const classResults = await Promise.all(
        schools.map((s) => getClassesBySchool(s.id))
      );

      let classTotalCount = 0;
      const rows: SchoolRow[] = schools.map((school, i) => {
        const classes = classResults[i];
        classTotalCount += classes.length;
        // Count active students across all classes in this school
        let active = 0;
        for (const cls of classes) {
          active += schoolActiveMap[cls.id]?.size ?? 0;
        }
        return {
          id: school.id,
          name: school.name,
          code: school.code,
          classCount: classes.length,
          activeStudents: active,
        };
      });

      setTotalClasses(classTotalCount);
      setSchoolRows(rows.sort((a, b) => b.activeStudents - a.activeStudents));
    } catch (err: any) {
      console.error('PM Dashboard load error:', err);
      setError('Failed to load project data. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  const statCards = [
    { label: 'Schools', value: schoolCount, icon: '🏫', color: 'bg-lavender-light' },
    { label: 'Active Students (7d)', value: activeStudents, icon: '👨‍🎓', color: 'bg-mint-light' },
    { label: 'Avg Accuracy (7d)', value: avgAccuracy !== null ? `${avgAccuracy}%` : '—', icon: '🎯', color: 'bg-peach-light' },
    { label: 'Total Classes', value: totalClasses, icon: '📚', color: 'bg-sunshine-light' },
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
          PM Dashboard
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

      {/* Stat Cards */}
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

      {/* Schools Table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.4 }}
        className="mb-lg"
      >
        <Card className="bg-white">
          <h2 className="font-baloo font-bold text-xl text-text-dark mb-lg flex items-center gap-sm">
            <span>🏫</span> Schools in Project
          </h2>
          {loading ? (
            <div className="space-y-sm">
              {Array.from({ length: 3 }).map((_, i) => <RowSkeleton key={i} />)}
            </div>
          ) : schoolRows.length === 0 ? (
            <p className="font-baloo text-sm text-text-muted text-center py-lg">
              No schools assigned to this project yet.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-divider">
                    <th className="text-left font-baloo font-semibold text-sm text-text-muted pb-sm">School</th>
                    <th className="text-left font-baloo font-semibold text-sm text-text-muted pb-sm">Code</th>
                    <th className="text-center font-baloo font-semibold text-sm text-text-muted pb-sm">Classes</th>
                    <th className="text-center font-baloo font-semibold text-sm text-text-muted pb-sm">Active Students (7d)</th>
                  </tr>
                </thead>
                <tbody>
                  {schoolRows.map((school, i) => (
                    <tr key={school.id} className={`border-b border-divider last:border-0 ${i % 2 === 0 ? '' : 'bg-bg-cream/40'}`}>
                      <td className="py-sm pr-md">
                        <p className="font-baloo font-semibold text-sm text-text-dark">{school.name}</p>
                      </td>
                      <td className="py-sm pr-md">
                        <span className="font-mono text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded">{school.code}</span>
                      </td>
                      <td className="py-sm text-center">
                        <span className="font-baloo font-bold text-sm text-text-dark">{school.classCount}</span>
                      </td>
                      <td className="py-sm text-center">
                        <span className={`font-baloo font-bold text-sm ${school.activeStudents > 0 ? 'text-secondary' : 'text-text-muted'}`}>
                          {school.activeStudents}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </motion.div>

      {/* Analytics CTA */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.6 }}
      >
        <Card className="bg-lavender-light/40 text-center">
          <h3 className="font-baloo font-bold text-xl text-text-dark mb-sm">
            View Detailed Analytics
          </h3>
          <p className="font-baloo text-sm sm:text-body text-text-muted mb-md">
            Accuracy trends, grade breakdowns, and school-level comparisons
          </p>
          <Button
            title="View Analytics"
            onPress={() => navigate('/pm/analytics')}
            variant="primary"
          />
        </Card>
      </motion.div>
    </div>
  );
}
