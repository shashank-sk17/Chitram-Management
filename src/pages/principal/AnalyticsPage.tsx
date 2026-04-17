import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Card } from '../../components/common/Card';
import { StatCardSkeleton, RowSkeleton } from '../../components/common/Skeleton';
import { useAuth } from '../../features/auth/hooks/useAuth';
import { useAuthStore } from '../../stores/authStore';
import {
  getTeachersBySchool,
  getClassesBySchool,
  getClassesByTeacher,
  getStudentsByClass,
  getSchool,
} from '../../services/firebase/firestore';
import type { TeacherDoc, ClassDoc } from '../../types/firestore';
import { GamificationPanel, type GamificationStudent } from '../../components/common/GamificationPanel';
import { useAnalyticsVisibility } from '../../hooks/useAnalyticsVisibility';

// ── Types ─────────────────────────────────────────────────────────────────────

interface StatCard {
  label: string;
  value: string | number;
  icon: string;
  color: string;
}

interface GradeRow {
  grade: string;
  classCount: number;
  studentCount: number;
}

interface TeacherRow {
  id: string;
  name: string;
  schoolId: string;
  classCount: number;
  studentCount: number;
  avatarColor: string;
}

interface AtRiskStudent {
  id: string;
  name: string;
  reason: string;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function PrincipalAnalyticsPage() {
  const { claims } = useAuth();
  const schoolIds: string[] = claims?.schoolIds ?? [];
  const { user: authUser } = useAuthStore();
  const { sections } = useAnalyticsVisibility({ role: 'principal', uid: authUser?.uid });

  // Phase 1: stat cards + grade breakdown
  const [loadingPhase1, setLoadingPhase1] = useState(true);
  const [phase1Error, setPhase1Error] = useState<string | null>(null);
  const [statCards, setStatCards] = useState<StatCard[]>([]);
  const [gradeRows, setGradeRows] = useState<GradeRow[]>([]);

  // Phase 2: teacher table + at-risk students
  const [loadingPhase2, setLoadingPhase2] = useState(true);
  const [phase2Error, setPhase2Error] = useState<string | null>(null);
  const [teacherRows, setTeacherRows] = useState<TeacherRow[]>([]);
  const [atRiskStudents, setAtRiskStudents] = useState<AtRiskStudent[]>([]);
  const [atRiskCount, setAtRiskCount] = useState(0);

  // Phase 3: gamification
  const [loadingGamif, setLoadingGamif] = useState(true);
  const [gamifStudents, setGamifStudents] = useState<GamificationStudent[]>([]);
  const [schoolOptions, setSchoolOptions] = useState<{ id: string; name: string }[]>([]);
  const [classOptions,  setClassOptions]  = useState<{ id: string; name: string }[]>([]);

  // ── Phase 1 ──────────────────────────────────────────────────────────────

  useEffect(() => {
    if (schoolIds.length === 0) {
      setLoadingPhase1(false);
      return;
    }

    async function loadPhase1() {
      try {
        // Fetch classes for all schools in parallel
        const classResults = await Promise.all(
          schoolIds.map((sid) => getClassesBySchool(sid))
        );
        const allClasses = classResults.flat() as Array<ClassDoc & { id: string }>;

        // Count teachers across all schools (fetch in parallel)
        const teacherResults = await Promise.all(
          schoolIds.map((sid) => getTeachersBySchool(sid))
        );
        const allTeachers = teacherResults.flat();

        const totalStudents = allClasses.reduce(
          (sum, cls) => sum + (cls.studentIds?.length ?? 0),
          0
        );
        const activeClasses = allClasses.filter(
          (cls) => (cls.studentIds?.length ?? 0) > 0
        ).length;

        setStatCards([
          {
            label: 'Total Teachers',
            value: allTeachers.length,
            icon: '👨‍🏫',
            color: 'from-primary to-primary/70',
          },
          {
            label: 'Total Students',
            value: totalStudents,
            icon: '👨‍🎓',
            color: 'from-secondary to-secondary/70',
          },
          {
            label: 'Active Classes',
            value: activeClasses,
            icon: '📚',
            color: 'from-accent to-accent/70',
          },
          {
            label: 'Avg Accuracy',
            value: '—',
            icon: '⭐',
            color: 'from-primary to-secondary',
          },
        ]);

        // Grade-level breakdown
        const gradeMap = new Map<string, { classCount: number; studentCount: number }>();
        for (const cls of allClasses) {
          const grade = cls.grade || 'Unknown';
          const existing = gradeMap.get(grade) ?? { classCount: 0, studentCount: 0 };
          gradeMap.set(grade, {
            classCount: existing.classCount + 1,
            studentCount: existing.studentCount + (cls.studentIds?.length ?? 0),
          });
        }
        const sortedGrades = Array.from(gradeMap.entries())
          .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }))
          .map(([grade, data]) => ({ grade, ...data }));
        setGradeRows(sortedGrades);
      } catch (err: any) {
        console.error('Phase 1 error:', err);
        setPhase1Error(err?.message ?? 'Failed to load overview data');
      } finally {
        setLoadingPhase1(false);
      }
    }

    loadPhase1();
  }, [schoolIds.join(',')]);

  // ── Phase 2 (runs after phase 1 completes) ────────────────────────────────

  useEffect(() => {
    if (loadingPhase1 || schoolIds.length === 0) return;

    async function loadPhase2() {
      try {
        // Teacher rows: fetch teachers + their class counts
        const teacherResults = await Promise.all(
          schoolIds.map(async (sid) => {
            const teachers = await getTeachersBySchool(sid);
            return teachers.map((t) => ({ ...t, schoolId: sid }));
          })
        );
        const allTeachersWithSchool = teacherResults.flat() as Array<
          TeacherDoc & { id: string; schoolId: string }
        >;

        const teacherRowData = await Promise.all(
          allTeachersWithSchool.map(async (t) => {
            const classes = await getClassesByTeacher(t.id);
            const studentCount = (classes as Array<ClassDoc & { id: string }>).reduce(
              (sum, cls) => sum + (cls.studentIds?.length ?? 0),
              0
            );
            return {
              id: t.id,
              name: t.name,
              schoolId: t.schoolId,
              classCount: classes.length,
              studentCount,
              avatarColor: t.avatarColor ?? '#7C81FF',
            } satisfies TeacherRow;
          })
        );
        setTeacherRows(teacherRowData);

        // At-risk students: collect from all classes
        const classResults = await Promise.all(
          schoolIds.map((sid) => getClassesBySchool(sid))
        );
        const allClasses = classResults.flat() as Array<ClassDoc & { id: string }>;

        const threeDaysAgo = new Date();
        threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
        const cutoffStr = threeDaysAgo.toISOString().split('T')[0];

        const atRisk: AtRiskStudent[] = [];
        let totalAtRisk = 0;

        for (const cls of allClasses) {
          const students = await getStudentsByClass(cls.id);
          for (const s of students) {
            const lastStudy = s.analytics?.lastStudyDate;
            const streak = s.analytics?.streakDays ?? 0;
            const isInactive = lastStudy ? lastStudy < cutoffStr : true;
            const isLowStreak = streak === 0;

            if (isInactive || isLowStreak) {
              totalAtRisk++;
              if (atRisk.length < 5) {
                atRisk.push({
                  id: s.id,
                  name: s.name,
                  reason: isInactive ? 'Inactive 3+ days' : 'Zero streak',
                });
              }
            }
          }
        }

        setAtRiskStudents(atRisk);
        setAtRiskCount(totalAtRisk);
      } catch (err: any) {
        console.error('Phase 2 error:', err);
        setPhase2Error(err?.message ?? 'Failed to load detailed data');
      } finally {
        setLoadingPhase2(false);
      }
    }

    loadPhase2();
  }, [loadingPhase1]);

  // ── Phase 3: Gamification ────────────────────────────────────────────────
  useEffect(() => {
    if (loadingPhase2 || schoolIds.length === 0) return;

    async function loadGamification() {
      try {
        // School names
        const schoolDocs = await Promise.all(schoolIds.map(async sid => {
          const s = await getSchool(sid);
          return { id: sid, name: s?.name ?? sid };
        }));
        setSchoolOptions(schoolDocs);

        // Classes per school
        const schoolClassResults = await Promise.all(
          schoolIds.map(sid => getClassesBySchool(sid).then(cls => ({ sid, cls: cls as Array<ClassDoc & { id: string }> })))
        );
        const allClasses = schoolClassResults.flatMap(({ sid, cls }) => cls.map(c => ({ ...c, schoolId: sid })));
        setClassOptions(allClasses.map(c => ({ id: c.id, name: c.name })));

        // Students per class
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
        console.error('Gamification load error:', err);
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
          School Analytics
        </h1>
        <p className="font-baloo text-sm sm:text-lg text-text-muted">
          Monitor school-wide performance and teacher effectiveness
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
                    <div
                      className={`inline-block px-md py-sm rounded-full bg-gradient-to-r ${metric.color} text-white`}
                    >
                      <span className="font-baloo text-xs font-bold">Live data</span>
                    </div>
                  </div>
                </Card>
              </motion.div>
            ))}
      </div>}

      {phase1Error && (
        <div className="mb-lg p-md rounded-lg bg-red-50 border border-red-200">
          <p className="font-baloo text-sm text-red-600">Error loading overview: {phase1Error}</p>
        </div>
      )}

      {/* Grade Breakdown */}
      {sections.gradeDistribution && <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.3 }}
        className="mb-lg sm:mb-xl"
      >
        <Card className="bg-white">
          <h2 className="font-baloo font-bold text-xl text-text-dark mb-lg flex items-center gap-sm">
            <span>📊</span> Grade-Level Breakdown
          </h2>
          {loadingPhase1 ? (
            <RowSkeleton rows={4} />
          ) : gradeRows.length === 0 ? (
            <p className="font-baloo text-md text-text-muted text-center py-lg">
              No classes found.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-divider">
                    <th className="font-baloo font-semibold text-sm text-text-muted text-left pb-sm">Grade</th>
                    <th className="font-baloo font-semibold text-sm text-text-muted text-right pb-sm">Classes</th>
                    <th className="font-baloo font-semibold text-sm text-text-muted text-right pb-sm">Students</th>
                    <th className="font-baloo font-semibold text-sm text-text-muted text-right pb-sm pr-xs">Avg Students/Class</th>
                  </tr>
                </thead>
                <tbody>
                  {gradeRows.map((row, index) => (
                    <motion.tr
                      key={row.grade}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.3, delay: 0.1 + index * 0.05 }}
                      className="border-b border-divider/50 hover:bg-lavender-light/20 transition-colors"
                    >
                      <td className="py-md">
                        <div className="flex items-center gap-sm">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center">
                            <span className="font-baloo font-bold text-xs text-primary">
                              {row.grade.replace(/[^0-9]/g, '') || '?'}
                            </span>
                          </div>
                          <span className="font-baloo font-semibold text-md text-text-dark">
                            {row.grade}
                          </span>
                        </div>
                      </td>
                      <td className="py-md text-right font-baloo font-bold text-md text-text-dark">
                        {row.classCount}
                      </td>
                      <td className="py-md text-right font-baloo font-bold text-md text-secondary">
                        {row.studentCount}
                      </td>
                      <td className="py-md text-right font-baloo text-md text-text-muted pr-xs">
                        {row.classCount > 0
                          ? Math.round(row.studentCount / row.classCount)
                          : 0}
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </motion.div>}

      {/* Teacher Table + At-Risk — Phase 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-md sm:gap-lg mb-lg sm:mb-xl">
        {/* Teacher Performance */}
        {sections.teacherTable && <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4, delay: 0.4 }}
        >
          <Card className="bg-white h-full">
            <h2 className="font-baloo font-bold text-xl text-text-dark mb-lg flex items-center gap-sm">
              <span>👨‍🏫</span> Teacher Overview
            </h2>
            {loadingPhase2 ? (
              <RowSkeleton rows={4} />
            ) : phase2Error ? (
              <p className="font-baloo text-sm text-red-600 p-sm">{phase2Error}</p>
            ) : teacherRows.length === 0 ? (
              <p className="font-baloo text-md text-text-muted text-center py-lg">
                No teachers found.
              </p>
            ) : (
              <div className="space-y-sm">
                {teacherRows.map((teacher, index) => (
                  <motion.div
                    key={teacher.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3, delay: index * 0.05 }}
                    className="flex items-center gap-md p-md rounded-lg bg-lavender-light/30 hover:bg-lavender-light transition-colors"
                  >
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 text-white font-baloo font-bold text-md"
                      style={{ background: teacher.avatarColor }}
                    >
                      {teacher.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-baloo font-bold text-md text-text-dark truncate">
                        {teacher.name}
                      </p>
                      <p className="font-baloo text-xs text-text-muted">
                        {teacher.classCount} {teacher.classCount === 1 ? 'class' : 'classes'}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="font-baloo font-extrabold text-lg text-secondary">
                        {teacher.studentCount}
                      </p>
                      <p className="font-baloo text-xs text-text-muted">students</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </Card>
        </motion.div>}

        {/* At-Risk Students */}
        {sections.atRiskStudents && <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4, delay: 0.5 }}
        >
          <Card className="bg-white h-full">
            <h2 className="font-baloo font-bold text-xl text-text-dark mb-lg flex items-center gap-sm">
              <span>⚠️</span> At-Risk Students
            </h2>
            {loadingPhase2 ? (
              <RowSkeleton rows={3} />
            ) : phase2Error ? (
              <p className="font-baloo text-sm text-red-600 p-sm">{phase2Error}</p>
            ) : atRiskCount === 0 ? (
              <div className="flex flex-col items-center justify-center py-lg gap-sm">
                <span className="text-4xl">🎉</span>
                <p className="font-baloo text-md text-secondary font-bold">All students are engaged!</p>
                <p className="font-baloo text-sm text-text-muted">No at-risk students detected.</p>
              </div>
            ) : (
              <>
                <div className="mb-md p-md rounded-lg bg-orange-50 border border-orange-200">
                  <p className="font-baloo font-bold text-lg text-orange-600">
                    {atRiskCount} student{atRiskCount !== 1 ? 's' : ''} need attention
                  </p>
                  <p className="font-baloo text-xs text-orange-500">
                    Inactive 3+ days or zero streak
                  </p>
                </div>
                <div className="space-y-sm">
                  {atRiskStudents.map((s, index) => (
                    <motion.div
                      key={s.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: index * 0.05 }}
                      className="flex items-center gap-md p-md rounded-lg bg-orange-50/50 hover:bg-orange-50 transition-colors"
                    >
                      <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center flex-shrink-0">
                        <span className="font-baloo font-bold text-xs text-orange-500">
                          {s.name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-baloo font-semibold text-sm text-text-dark truncate">
                          {s.name}
                        </p>
                        <p className="font-baloo text-xs text-orange-500">{s.reason}</p>
                      </div>
                    </motion.div>
                  ))}
                  {atRiskCount > 5 && (
                    <p className="font-baloo text-xs text-text-muted text-center pt-sm">
                      + {atRiskCount - 5} more students
                    </p>
                  )}
                </div>
              </>
            )}
          </Card>
        </motion.div>}
      </div>

      {/* Gamification Section */}
      {sections.gamification && <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.7 }}
        className="mt-xl"
      >
        <div className="mb-lg">
          <h2 className="font-baloo font-bold text-xl text-text-dark">Gamification 🏆</h2>
          <p className="font-baloo text-sm text-text-muted">School-wide XP leaderboard, badges and engagement</p>
        </div>
        <GamificationPanel students={gamifStudents} loading={loadingGamif} schools={schoolOptions} classes={classOptions} />
      </motion.div>}
    </div>
  );
}
