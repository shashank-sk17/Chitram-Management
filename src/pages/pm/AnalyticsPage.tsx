import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Card } from '../../components/common/Card';
import { StatCardSkeleton, RowSkeleton } from '../../components/common/Skeleton';
import { useAuth } from '../../features/auth/hooks/useAuth';
import { useAuthStore } from '../../stores/authStore';
import {
  getSchoolsInProject,
  getClassesBySchool,
  getStudentsByClass,
} from '../../services/firebase/firestore';
import type { SchoolDoc, ClassDoc } from '../../types/firestore';
import { GamificationPanel, type GamificationStudent } from '../../components/common/GamificationPanel';
import { useAnalyticsVisibility } from '../../hooks/useAnalyticsVisibility';

// ── Types ─────────────────────────────────────────────────────────────────────

interface StatCard {
  label: string;
  value: string | number;
  icon: string;
  color: string;
  note?: string;
}

interface SchoolRow {
  id: string;
  name: string;
  classCount: number;
  studentCount: number;
  status: 'active' | 'empty';
}

interface GradeBar {
  grade: string;
  count: number;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function PMAnalyticsPage() {
  const { claims } = useAuth();
  const projectId: string | undefined = claims?.projectId;
  const { user: authUser } = useAuthStore();
  const { sections } = useAnalyticsVisibility({ role: 'pm', projectId, uid: authUser?.uid });

  // Phase 1: schools + stat cards
  const [loadingPhase1, setLoadingPhase1] = useState(true);
  const [phase1Error, setPhase1Error] = useState<string | null>(null);
  const [statCards, setStatCards] = useState<StatCard[]>([]);
  const [schools, setSchools] = useState<Array<SchoolDoc & { id: string }>>([]);

  // Phase 2: classes + school rows + grade distribution
  const [loadingPhase2, setLoadingPhase2] = useState(true);
  const [phase2Error, setPhase2Error] = useState<string | null>(null);
  const [schoolRows, setSchoolRows] = useState<SchoolRow[]>([]);
  const [gradeBars, setGradeBars] = useState<GradeBar[]>([]);
  const [maxGradeCount, setMaxGradeCount] = useState(1);

  // Phase 3: gamification
  const [loadingGamif, setLoadingGamif] = useState(true);
  const [gamifStudents, setGamifStudents] = useState<GamificationStudent[]>([]);
  const [schoolOptions, setSchoolOptions] = useState<{ id: string; name: string }[]>([]);
  const [classOptions,  setClassOptions]  = useState<{ id: string; name: string }[]>([]);

  // ── Phase 1 ──────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!projectId) {
      setLoadingPhase1(false);
      return;
    }

    async function loadPhase1() {
      try {
        const fetchedSchools = await getSchoolsInProject(projectId!);
        setSchools(fetchedSchools);

        setStatCards([
          {
            label: 'Total Schools',
            value: fetchedSchools.length,
            icon: '🏫',
            color: 'from-primary to-primary/70',
          },
          {
            label: 'Total Classes',
            value: '—',
            icon: '📚',
            color: 'from-secondary to-secondary/70',
            note: 'Loading...',
          },
          {
            label: 'Total Students',
            value: '—',
            icon: '👨‍🎓',
            color: 'from-accent to-accent/70',
            note: 'Loading...',
          },
          {
            label: 'Active Today',
            value: '—',
            icon: '⚡',
            color: 'from-primary to-secondary',
            note: 'Updates daily',
          },
        ]);
      } catch (err: any) {
        console.error('Phase 1 error:', err);
        setPhase1Error(err?.message ?? 'Failed to load schools');
      } finally {
        setLoadingPhase1(false);
      }
    }

    loadPhase1();
  }, [projectId]);

  // ── Phase 2 (runs after phase 1 completes) ────────────────────────────────

  useEffect(() => {
    if (loadingPhase1 || schools.length === 0) {
      if (!loadingPhase1) setLoadingPhase2(false);
      return;
    }

    async function loadPhase2() {
      try {
        // Fetch classes for all schools in parallel
        const classResults = await Promise.all(
          schools.map(async (school) => {
            const classes = await getClassesBySchool(school.id);
            return { schoolId: school.id, classes: classes as Array<ClassDoc & { id: string }> };
          })
        );

        let totalClasses = 0;
        let totalStudents = 0;

        // Build school rows
        const rows: SchoolRow[] = classResults.map(({ schoolId, classes }) => {
          const school = schools.find((s) => s.id === schoolId)!;
          const studentCount = classes.reduce(
            (sum, cls) => sum + (cls.studentIds?.length ?? 0),
            0
          );
          totalClasses += classes.length;
          totalStudents += studentCount;

          return {
            id: schoolId,
            name: school.name,
            classCount: classes.length,
            studentCount,
            status: studentCount > 0 ? 'active' : 'empty',
          };
        });

        // Sort: active schools first, then by student count desc
        rows.sort((a, b) => {
          if (a.status !== b.status) return a.status === 'active' ? -1 : 1;
          return b.studentCount - a.studentCount;
        });
        setSchoolRows(rows);

        // Update stat cards with real totals
        setStatCards([
          {
            label: 'Total Schools',
            value: schools.length,
            icon: '🏫',
            color: 'from-primary to-primary/70',
          },
          {
            label: 'Total Classes',
            value: totalClasses,
            icon: '📚',
            color: 'from-secondary to-secondary/70',
          },
          {
            label: 'Total Students',
            value: totalStudents,
            icon: '👨‍🎓',
            color: 'from-accent to-accent/70',
          },
          {
            label: 'Active Today',
            value: '—',
            icon: '⚡',
            color: 'from-primary to-secondary',
            note: 'Updates daily',
          },
        ]);

        // Grade distribution across project
        const gradeMap = new Map<string, number>();
        for (const { classes } of classResults) {
          for (const cls of classes) {
            const grade = cls.grade || 'Unknown';
            gradeMap.set(grade, (gradeMap.get(grade) ?? 0) + 1);
          }
        }
        const bars = Array.from(gradeMap.entries())
          .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }))
          .map(([grade, count]) => ({ grade, count }));

        setGradeBars(bars);
        setMaxGradeCount(bars.length > 0 ? Math.max(...bars.map((b) => b.count)) : 1);
      } catch (err: any) {
        console.error('Phase 2 error:', err);
        setPhase2Error(err?.message ?? 'Failed to load class data');
      } finally {
        setLoadingPhase2(false);
      }
    }

    loadPhase2();
  }, [loadingPhase1, schools]);

  // ── Phase 3: Gamification ─────────────────────────────────────────────────
  useEffect(() => {
    if (loadingPhase2 || schools.length === 0) {
      if (!loadingPhase2) setLoadingGamif(false);
      return;
    }

    async function loadGamification() {
      try {
        setSchoolOptions(schools.map(s => ({ id: s.id, name: s.name })));

        const schoolClassResults = await Promise.all(
          schools.map(s => getClassesBySchool(s.id).then(cls => ({ sid: s.id, cls: cls as Array<ClassDoc & { id: string }> })))
        );
        const allClasses = schoolClassResults.flatMap(({ sid, cls }) => cls.map(c => ({ ...c, schoolId: sid })));
        setClassOptions(allClasses.map(c => ({ id: c.id, name: c.name })));

        const uniqueMap = new Map<string, GamificationStudent>();
        await Promise.all(allClasses.map(async cls => {
          const students = await getStudentsByClass(cls.id);
          students.forEach(s => {
            if (!uniqueMap.has(s.id)) {
              uniqueMap.set(s.id, {
                id: s.id,
                name: s.name,
                avatarColor: s.avatarColor ?? '#7C81FF',
                xp: (s.analytics as any)?.xp ?? 0,
                weeklyXP: (s.analytics as any)?.weeklyXP ?? 0,
                playerLevel: (s.analytics as any)?.playerLevel ?? 1,
                badges: (s.analytics as any)?.badges ?? [],
                streakDays: s.analytics?.streakDays ?? 0,
                learnedWords: s.analytics?.totalWordsLearned ?? 0,
                schoolId: cls.schoolId,
                classId: cls.id,
              });
            }
          });
        }));
        setGamifStudents(Array.from(uniqueMap.values()));
      } catch (err) {
        console.error('PM gamification load error:', err);
      } finally {
        setLoadingGamif(false);
      }
    }

    loadGamification();
  }, [loadingPhase2]);

  // ── Render ────────────────────────────────────────────────────────────────

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
          Project Analytics
        </h1>
        <p className="font-baloo text-sm sm:text-lg text-text-muted">
          Track project delivery and performance metrics
        </p>
      </motion.div>

      {/* Stat Cards — Phase 1 */}
      {sections.overviewStats && <div className="grid grid-cols-2 lg:grid-cols-4 gap-sm sm:gap-md mb-lg sm:mb-xl">
        {loadingPhase1
          ? Array.from({ length: 4 }).map((_, i) => (
              <StatCardSkeleton key={i} />
            ))
          : statCards.map((metric, index) => (
              <motion.div
                key={metric.label}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3, delay: index * 0.1 }}
                whileHover={{ scale: 1.05, y: -5 }}
              >
                <Card className="bg-white hover:shadow-xl transition-shadow">
                  <div className="text-center">
                    <span className="text-2xl sm:text-4xl block mb-xs sm:mb-md">
                      {metric.icon}
                    </span>
                    <h3 className="font-baloo font-extrabold text-lg sm:text-xxl text-text-dark mb-xs sm:mb-sm">
                      {metric.value}
                    </h3>
                    <p className="font-baloo text-xs sm:text-md text-text-muted mb-xs sm:mb-sm leading-tight">
                      {metric.label}
                    </p>
                    {metric.note ? (
                      <p className="font-baloo text-xs text-text-muted italic">{metric.note}</p>
                    ) : (
                      <div
                        className={`inline-block px-md py-sm rounded-full bg-gradient-to-r ${metric.color} text-white`}
                      >
                        <span className="font-baloo text-xs font-bold">Live data</span>
                      </div>
                    )}
                  </div>
                </Card>
              </motion.div>
            ))}
      </div>}

      {phase1Error && (
        <div className="mb-lg p-md rounded-lg bg-red-50 border border-red-200">
          <p className="font-baloo text-sm text-red-600">Error loading schools: {phase1Error}</p>
        </div>
      )}

      {/* School Comparison Table + Grade Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-md sm:gap-lg mb-lg sm:mb-xl">
        {/* School Comparison */}
        {sections.engagementMetrics && <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4, delay: 0.4 }}
        >
          <Card className="bg-white h-full">
            <h2 className="font-baloo font-bold text-xl text-text-dark mb-lg flex items-center gap-sm">
              <span>🏫</span> School Comparison
            </h2>
            {loadingPhase2 ? (
              <RowSkeleton rows={4} />
            ) : phase2Error ? (
              <p className="font-baloo text-sm text-red-600 p-sm">{phase2Error}</p>
            ) : schoolRows.length === 0 ? (
              <p className="font-baloo text-md text-text-muted text-center py-lg">
                No schools found in this project.
              </p>
            ) : (
              <div className="space-y-sm">
                {schoolRows.map((school, index) => (
                  <motion.div
                    key={school.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3, delay: index * 0.05 }}
                    className={`flex items-center gap-md p-md rounded-lg transition-colors ${
                      school.status === 'active'
                        ? 'bg-mint-light/30 hover:bg-mint-light'
                        : 'bg-gray-50 hover:bg-gray-100'
                    }`}
                  >
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                        school.status === 'active'
                          ? 'bg-gradient-to-br from-secondary to-secondary/70'
                          : 'bg-gray-200'
                      }`}
                    >
                      <span className="text-lg">🏫</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-baloo font-bold text-md text-text-dark truncate">
                        {school.name}
                      </p>
                      <p className="font-baloo text-xs text-text-muted">
                        {school.classCount} {school.classCount === 1 ? 'class' : 'classes'}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p
                        className={`font-baloo font-extrabold text-lg ${
                          school.status === 'active' ? 'text-secondary' : 'text-text-muted'
                        }`}
                      >
                        {school.studentCount}
                      </p>
                      <span
                        className={`font-baloo text-xs font-semibold px-sm py-xs rounded-full ${
                          school.status === 'active'
                            ? 'bg-secondary/10 text-secondary'
                            : 'bg-gray-100 text-gray-400'
                        }`}
                      >
                        {school.status === 'active' ? 'Active' : 'Empty'}
                      </span>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </Card>
        </motion.div>}

        {/* Grade Distribution */}
        {sections.gradeDistribution && <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4, delay: 0.5 }}
        >
          <Card className="bg-white h-full">
            <h2 className="font-baloo font-bold text-xl text-text-dark mb-lg flex items-center gap-sm">
              <span>📊</span> Grade Distribution
            </h2>
            {loadingPhase2 ? (
              <div className="space-y-md">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-md">
                    <div className="w-16 font-baloo text-sm text-text-muted">Grade {i + 1}</div>
                    <div className="flex-1 h-8 bg-gray-100 rounded-full animate-pulse" />
                  </div>
                ))}
              </div>
            ) : phase2Error ? (
              <p className="font-baloo text-sm text-red-600 p-sm">{phase2Error}</p>
            ) : gradeBars.length === 0 ? (
              <p className="font-baloo text-md text-text-muted text-center py-lg">
                No class data available.
              </p>
            ) : (
              <div className="space-y-md">
                {gradeBars.map((bar, index) => (
                  <div key={bar.grade} className="flex items-center gap-md">
                    <div className="w-20 font-baloo text-sm text-text-muted flex-shrink-0">
                      {bar.grade}
                    </div>
                    <div className="flex-1 h-8 bg-lavender-light/30 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{
                          width: `${Math.round((bar.count / maxGradeCount) * 100)}%`,
                        }}
                        transition={{ duration: 1, delay: 0.5 + index * 0.08 }}
                        className="h-full bg-primary rounded-full flex items-center justify-end pr-sm"
                      >
                        <span className="font-baloo font-bold text-xs text-white">
                          {bar.count}
                        </span>
                      </motion.div>
                    </div>
                    <div className="w-12 text-right font-baloo text-sm text-text-muted flex-shrink-0">
                      {bar.count} {bar.count === 1 ? 'class' : 'classes'}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </motion.div>}
      </div>

      {/* Gamification Section */}
      {!loadingPhase1 && sections.gamification && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.6 }}
          className="mt-xl"
        >
          <div className="mb-lg">
            <h2 className="font-baloo font-bold text-xl text-text-dark">Gamification 🏆</h2>
            <p className="font-baloo text-sm text-text-muted">Project-wide XP leaderboard, badges and player levels</p>
          </div>
          <GamificationPanel students={gamifStudents} loading={loadingGamif} schools={schoolOptions} classes={classOptions} />
        </motion.div>
      )}
    </div>
  );
}
