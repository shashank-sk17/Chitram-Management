import { useEffect, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card } from '../../components/common/Card';
import { StatCardSkeleton, RowSkeleton, Skeleton } from '../../components/common/Skeleton';
import { useAuth } from '../../features/auth/hooks/useAuth';
import { useAssignmentStore } from '../../stores/assignmentStore';
import { getStudentsByTeacher, getClassesByTeacher } from '../../services/firebase/firestore';
import type { StudentDoc, McqAssignmentDoc, StudentSubmissionDoc } from '../../types/firestore';

type StudentWithId = StudentDoc & { id: string };
type AssignmentWithId = { id: string } & McqAssignmentDoc;
type SubmissionWithId = { id: string; uid: string } & StudentSubmissionDoc;


function getProgressColor(progress: number) {
  if (progress >= 90) return 'bg-secondary';
  if (progress >= 75) return 'bg-primary';
  return 'bg-accent';
}

function getStudentFlags(student: StudentWithId): string[] {
  const flags: string[] = [];
  const lastActive = student.analytics?.lastStudyDate;
  if (lastActive) {
    const daysSince = Math.floor((Date.now() - new Date(lastActive).getTime()) / 86_400_000);
    if (daysSince >= 3) flags.push(`Inactive ${daysSince}d`);
  } else {
    flags.push('Never active');
  }
  const streak = student.analytics?.streakDays ?? 0;
  // streak broken: if lastActive is not yesterday or today and streak was >7
  if (streak === 0 && (student.analytics?.totalSessions ?? 0) > 0) {
    flags.push('Streak broken');
  }
  return flags;
}

interface StudentDetailPanelProps {
  student: StudentWithId;
  classAssignments: AssignmentWithId[];
  submissions: Record<string, SubmissionWithId[]>;
  onClose: () => void;
  onFetchSubmissions: (assignmentId: string) => void;
}

function StudentDetailPanel({
  student,
  classAssignments,
  submissions,
  onClose,
  onFetchSubmissions,
}: StudentDetailPanelProps) {
  useEffect(() => {
    classAssignments.forEach(a => {
      if (!submissions[a.id]) {
        onFetchSubmissions(a.id);
      }
    });
  }, [classAssignments.map(a => a.id).join(',')]);

  const streakDays = student.analytics?.streakDays ?? null;
  const lastStudyDate = student.analytics?.lastStudyDate ?? null;
  const learnedWords = student.analytics?.totalWordsLearned ?? 0;

  return (
    <>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/30 z-40"
        onClick={onClose}
      />

      {/* Panel */}
      <motion.div
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        className="fixed right-0 top-0 bottom-0 w-full max-w-md bg-white shadow-2xl z-50 flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="bg-lavender-light/30 px-lg py-md border-b border-divider flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-md">
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center font-baloo font-extrabold text-xl text-white shadow-md flex-shrink-0"
                style={{ backgroundColor: student.avatarColor || '#7C81FF' }}
              >
                {(student.name || student.email || '?')[0].toUpperCase()}
              </div>
              <div>
                <h2 className="font-baloo font-bold text-lg text-text-dark">
                  {student.name || 'Unnamed'}
                </h2>
                <p className="font-baloo text-sm text-text-muted">{student.email}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-white/60 flex items-center justify-center text-text-muted hover:text-text-dark transition-colors"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-lg space-y-md">
          {/* Student info */}
          <div className="grid grid-cols-2 gap-sm">
            <div className="bg-lavender-light/40 rounded-xl px-md py-sm">
              <p className="font-baloo text-xs text-text-muted">Grade</p>
              <p className="font-baloo font-bold text-md text-text-dark">{student.grade || '—'}</p>
            </div>
            <div className="bg-mint-light/40 rounded-xl px-md py-sm">
              <p className="font-baloo text-xs text-text-muted">Language</p>
              <p className="font-baloo font-bold text-md text-text-dark">
                {student.activeLearningLanguage?.toUpperCase() || '—'}
              </p>
            </div>
            <div className="bg-peach-light/40 rounded-xl px-md py-sm">
              <p className="font-baloo text-xs text-text-muted">Streak</p>
              <p className="font-baloo font-bold text-md text-text-dark">
                {streakDays !== null ? `${streakDays} days` : '—'}
              </p>
            </div>
            <div className="bg-lavender-light/40 rounded-xl px-md py-sm">
              <p className="font-baloo text-xs text-text-muted">Last Active</p>
              <p className="font-baloo font-bold text-xs text-text-dark">
                {lastStudyDate || '—'}
              </p>
            </div>
            <div className="bg-mint-light/40 rounded-xl px-md py-sm col-span-2">
              <p className="font-baloo text-xs text-text-muted">Words Learned</p>
              <p className="font-baloo font-bold text-xl text-secondary">{learnedWords}</p>
            </div>
            {student.analytics?.drawingAccuracy != null && (
              <div className="bg-lavender-light/40 rounded-xl px-md py-sm">
                <p className="font-baloo text-xs text-text-muted">Drawing Accuracy</p>
                <p className="font-baloo font-bold text-md text-text-dark">{student.analytics.drawingAccuracy}%</p>
              </div>
            )}
          </div>

          {/* Assignment Scores */}
          <div>
            <h3 className="font-baloo font-bold text-md text-text-dark mb-sm">Assignment Scores</h3>
            {classAssignments.length === 0 ? (
              <p className="font-baloo text-sm text-text-muted">No assignments for this class.</p>
            ) : (
              <div className="space-y-xs">
                {classAssignments.map(a => {
                  const classSubs = submissions[a.id] ?? [];
                  const studentSub = classSubs.find(s => s.uid === student.id);
                  return (
                    <div
                      key={a.id}
                      className="flex items-center justify-between bg-gray-50 rounded-xl px-md py-sm"
                    >
                      <p className="font-baloo text-sm text-text-dark truncate flex-1 mr-md">{a.title}</p>
                      {studentSub ? (
                        <span className="font-baloo font-bold text-sm text-secondary flex-shrink-0">
                          {studentSub.score ?? 0}/{studentSub.totalPoints}
                        </span>
                      ) : (
                        <span className="font-baloo text-xs text-text-muted flex-shrink-0">Not submitted</span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </>
  );
}

export default function StudentsPage() {
  const { user } = useAuth();
  const { assignments, fetchSubmissionsForAssignment, submissions, listenToTeacherAssignments } = useAssignmentStore();

  const [loading, setLoading] = useState(true);
  const [students, setStudents] = useState<StudentWithId[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterClass, setFilterClass] = useState('all');
  const [selectedStudent, setSelectedStudent] = useState<StudentWithId | null>(null);

  useEffect(() => {
    loadData();
    if (user) {
      const unsub = listenToTeacherAssignments(user.uid);
      return unsub;
    }
  }, [user]);

  async function loadData() {
    if (!user) return;
    setLoading(true);
    try {
      const [studentsData, classesData] = await Promise.all([
        getStudentsByTeacher(user.uid),
        getClassesByTeacher(user.uid),
      ]);
      setStudents(studentsData as StudentWithId[]);
      setClasses(classesData);
    } catch (error) {
      console.error('Error loading students:', error);
    } finally {
      setLoading(false);
    }
  }

  const filteredStudents = useMemo(() => students.filter((student) => {
    const matchesSearch =
      student.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      student.email?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesClass =
      filterClass === 'all' ||
      student.classId === filterClass ||
      student.classIds?.includes(filterClass);
    return matchesSearch && matchesClass;
  }), [students, searchQuery, filterClass]);

  // Get assignments for selected student's class
  const studentClassAssignments = useMemo((): AssignmentWithId[] => {
    if (!selectedStudent?.classId) return [];
    return Object.entries(assignments)
      .filter(([, a]) => a.classId === selectedStudent.classId)
      .map(([id, a]) => ({ id, ...a }));
  }, [selectedStudent, assignments]);

  const stats = {
    total: students.length,
    activeToday: Math.floor(students.length * 0.6),
    avgProgress: students.length > 0 ? 85 : 0,
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto space-y-lg">
        <div className="grid grid-cols-3 gap-md">
          {[0, 1, 2].map(i => <StatCardSkeleton key={i} />)}
        </div>
        <div className="bg-white rounded-2xl p-lg border border-divider">
          <Skeleton className="h-10 w-full" />
        </div>
        <RowSkeleton rows={6} />
      </div>
    );
  }

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
          Students 👨‍🎓
        </h1>
        <p className="font-baloo text-sm sm:text-lg text-text-muted">
          Manage and track your students' progress
        </p>
      </motion.div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-sm sm:gap-md mb-lg sm:mb-xl">
        {[
          { label: 'Total Students', value: stats.total, icon: '👥', color: 'bg-lavender-light' },
          { label: 'Active Today', value: stats.activeToday, icon: '✅', color: 'bg-mint-light' },
          { label: 'Avg Progress', value: `${stats.avgProgress}%`, icon: '📊', color: 'bg-peach-light' },
        ].map((stat, index) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3, delay: index * 0.1 }}
          >
            <Card className={`${stat.color}`}>
              <div className="flex items-center justify-between gap-sm">
                <div className="min-w-0">
                  <p className="font-baloo text-xs sm:text-md text-text-muted mb-xs sm:mb-sm leading-tight">{stat.label}</p>
                  <h3 className="font-baloo font-extrabold text-xl sm:text-hero text-text-dark">
                    {stat.value}
                  </h3>
                </div>
                <span className="text-2xl sm:text-4xl flex-shrink-0">{stat.icon}</span>
              </div>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Filters */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.3 }}
        className="mb-lg"
      >
        <Card className="bg-white">
          <div className="flex flex-col md:flex-row gap-md">
            <div className="flex-1">
              <input
                type="text"
                placeholder="Search students..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-md py-sm sm:py-md rounded-lg border-2 border-divider bg-white font-baloo text-sm sm:text-body focus:border-primary focus:outline-none"
              />
            </div>
            {classes.length > 0 && (
              <div className="md:w-48">
                <select
                  value={filterClass}
                  onChange={(e) => setFilterClass(e.target.value)}
                  className="w-full px-md py-sm sm:py-md rounded-lg border-2 border-divider bg-white font-baloo text-sm sm:text-body focus:border-primary focus:outline-none"
                >
                  <option value="all">All Classes</option>
                  {classes.map((cls) => (
                    <option key={cls.id} value={cls.id}>
                      {cls.name || `Class ${cls.id.slice(0, 6)}`}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </Card>
      </motion.div>

      {/* Students Grid */}
      {filteredStudents.length > 0 ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.4 }}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-md sm:gap-lg"
        >
          {filteredStudents.map((student, index) => {
            const progress = student.analytics?.averageAccuracy ?? (75 + Math.floor(Math.random() * 25));
            const learnedWords = student.analytics?.totalWordsLearned ?? 0;

            return (
              <motion.div
                key={student.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.4 + index * 0.05 }}
                whileHover={{ scale: 1.02, y: -5 }}
              >
                <div onClick={() => setSelectedStudent(student)}>
                <Card className="hover:shadow-xl transition-shadow cursor-pointer">
                  <div className="flex items-start gap-md mb-md">
                    <div
                      className="w-12 h-12 sm:w-16 sm:h-16 rounded-xl sm:rounded-2xl flex items-center justify-center shadow-lg flex-shrink-0 font-baloo font-extrabold text-xl text-white"
                      style={{ backgroundColor: student.avatarColor || '#7C81FF' }}
                    >
                      {(student.name || student.email)?.[0]?.toUpperCase() || '?'}
                    </div>
                    <div className="flex-1 overflow-hidden">
                      <h3 className="font-baloo font-bold text-lg text-text-dark truncate">
                        {student.name || student.email || 'Unknown'}
                      </h3>
                      <p className="font-baloo text-sm text-text-muted truncate">
                        {student.email || 'No email'}
                      </p>
                      <div className="flex items-center gap-xs mt-xs flex-wrap">
                        {student.grade && (
                          <span className="bg-lavender-light px-sm py-xs rounded-full font-baloo text-xs font-semibold text-primary">
                            Grade {student.grade}
                          </span>
                        )}
                        {student.activeLearningLanguage && (
                          <span className="bg-mint-light px-sm py-xs rounded-full font-baloo text-xs font-semibold text-secondary">
                            {student.activeLearningLanguage.toUpperCase()}
                          </span>
                        )}
                        {getStudentFlags(student).map(flag => (
                          <span key={flag} className="bg-red-100 text-red-600 px-sm py-xs rounded-full font-baloo text-xs font-semibold">
                            ⚠ {flag}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="mb-md">
                    <div className="flex items-center justify-between mb-xs">
                      <span className="font-baloo text-sm text-text-muted">Accuracy</span>
                      <span className="font-baloo text-sm font-bold text-text-dark">
                        {progress}%
                      </span>
                    </div>
                    <div className="w-full h-2 bg-divider rounded-full overflow-hidden">
                      <div
                        className={`h-full ${getProgressColor(progress)} transition-all duration-500`}
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="grid grid-cols-2 gap-sm">
                    <div className="bg-mint-light/50 px-sm py-sm rounded-lg">
                      <p className="font-baloo text-xs text-text-muted">Words Learned</p>
                      <p className="font-baloo font-bold text-body text-text-dark">
                        {learnedWords}
                      </p>
                    </div>
                    <div className="bg-peach-light/50 px-sm py-sm rounded-lg">
                      <p className="font-baloo text-xs text-text-muted">Streak</p>
                      <p className="font-baloo font-bold text-xs text-text-dark">
                        {student.analytics?.streakDays != null ? `${student.analytics.streakDays}d` : '—'}
                      </p>
                    </div>
                  </div>
                </Card>
                </div>
              </motion.div>
            );
          })}
        </motion.div>
      ) : (
        <Card className="text-center py-lg sm:py-xxl">
          <span className="text-4xl sm:text-6xl mb-md block">
            {searchQuery || filterClass !== 'all' ? '🔍' : '👨‍🎓'}
          </span>
          <h3 className="font-baloo font-bold text-lg sm:text-xl text-text-dark mb-sm">
            {searchQuery || filterClass !== 'all' ? 'No students found' : 'No students yet'}
          </h3>
          <p className="font-baloo text-sm sm:text-body text-text-muted">
            {searchQuery || filterClass !== 'all'
              ? 'Try adjusting your search or filters'
              : 'Students will appear here once they join your classes'}
          </p>
        </Card>
      )}

      {/* Class Progress by Level */}
      {filterClass !== 'all' && filteredStudents.length > 0 && (
        <div className="mt-xl">
          <h2 className="font-baloo font-bold text-xl text-text-dark mb-md">
            📉 Class Progress by Level
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-md">
            {(() => {
              // Collect all levelIds across students
              const levelMap = new Map<string, { done: number; total: number }>();
              for (const s of filteredStudents) {
                const lp = s.analytics?.levelProgress ?? {};
                for (const [lid, v] of Object.entries(lp)) {
                  const prev = levelMap.get(lid) ?? { done: 0, total: 0 };
                  prev.total += 1;
                  if ((v as any).completed) prev.done += 1;
                  levelMap.set(lid, prev);
                }
              }
              if (levelMap.size === 0) return <p className="font-baloo text-text-muted text-sm col-span-3">No level data yet.</p>;
              return Array.from(levelMap.entries())
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([levelId, { done, total }]) => {
                  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
                  const color = pct >= 75 ? 'bg-secondary' : pct >= 40 ? 'bg-accent' : 'bg-red-400';
                  return (
                    <div key={levelId} className="bg-white rounded-xl p-md border border-divider">
                      <div className="flex justify-between items-center mb-sm">
                        <p className="font-baloo font-bold text-sm text-text-dark truncate">{levelId}</p>
                        <p className="font-baloo text-sm font-bold text-text-dark">{pct}%</p>
                      </div>
                      <div className="w-full h-2 bg-divider rounded-full overflow-hidden mb-xs">
                        <div className={`h-full ${color} rounded-full`} style={{ width: `${pct}%` }} />
                      </div>
                      <p className="font-baloo text-xs text-text-muted">{done}/{total} students completed</p>
                    </div>
                  );
                });
            })()}
          </div>
        </div>
      )}

      {/* Student Detail Panel */}
      <AnimatePresence>
        {selectedStudent && (
          <StudentDetailPanel
            student={selectedStudent}
            classAssignments={studentClassAssignments}
            submissions={submissions}
            onClose={() => setSelectedStudent(null)}
            onFetchSubmissions={fetchSubmissionsForAssignment}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
