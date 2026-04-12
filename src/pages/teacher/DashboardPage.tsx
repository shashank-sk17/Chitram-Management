import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../../features/auth/hooks/useAuth';
import { useTeacherStore } from '../../stores/teacherStore';
import { useAssignmentStore } from '../../stores/assignmentStore';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import type { ClassDoc, StudentDoc, McqAssignmentDoc } from '../../types/firestore';
import { Timestamp } from 'firebase/firestore';

function getHourGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

function dueDateSeconds(a: McqAssignmentDoc): number {
  if (!a.dueDate) return 0;
  if (a.dueDate instanceof Timestamp) return a.dueDate.seconds;
  return 0;
}

export default function TeacherDashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const {
    classes,
    students,
    loadingClasses,
    listenToTeacherClasses,
    listenToClassStudents,
    getPendingStudentsForClass,
    approveStudent,
    rejectStudent,
  } = useTeacherStore();

  const {
    assignments,
    listenToTeacherAssignments,
  } = useAssignmentStore();

  const [approvingId, setApprovingId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    const unsubClasses = listenToTeacherClasses(user.uid);
    const unsubAssignments = listenToTeacherAssignments(user.uid);
    return () => {
      unsubClasses();
      unsubAssignments();
    };
  }, [user]);

  // Subscribe to students for each class
  useEffect(() => {
    if (classes.length === 0) return;
    const unsubs = classes.map(c => listenToClassStudents(c.id));
    return () => unsubs.forEach(u => u());
  }, [classes.map(c => c.id).join(',')]);

  // Derived stats
  const totalStudents = useMemo(
    () => classes.reduce((sum, c) => sum + (c.studentIds?.length ?? 0), 0),
    [classes],
  );

  const totalPending = useMemo(
    () => classes.reduce((sum, c) => sum + (c.pendingStudentIds?.length ?? 0), 0),
    [classes],
  );

  // All pending students with their classId
  const pendingEntries = useMemo(() => {
    const result: Array<{ classId: string; className: string; student: StudentDoc & { id: string } }> = [];
    classes.forEach(c => {
      const pending = getPendingStudentsForClass(c.id);
      pending.forEach(s => result.push({ classId: c.id, className: c.name, student: s }));
    });
    return result;
  }, [classes, students]);

  // Upcoming assignments (due within 7 days)
  const upcomingAssignments = useMemo(() => {
    const now = Date.now() / 1000;
    const week = now + 7 * 86400;
    return Object.entries(assignments)
      .map(([id, a]) => ({ id, ...a }))
      .filter(a => {
        const sec = dueDateSeconds(a);
        return sec >= now && sec <= week;
      })
      .sort((a, b) => dueDateSeconds(a) - dueDateSeconds(b))
      .slice(0, 5);
  }, [assignments]);

  const assignmentsThisWeek = upcomingAssignments.length;

  const stats = [
    { icon: '📚', value: classes.length, label: 'My Classes', color: 'bg-lavender-light' },
    { icon: '👨‍🎓', value: totalStudents, label: 'Total Students', color: 'bg-mint-light' },
    { icon: '⏳', value: totalPending, label: 'Pending Approvals', color: totalPending > 0 ? 'bg-amber-50' : 'bg-peach-light' },
    { icon: '📝', value: assignmentsThisWeek, label: 'Assignments This Week', color: 'bg-lavender-light/50' },
  ];

  const handleApprove = async (classId: string, studentId: string) => {
    setApprovingId(studentId);
    try {
      await approveStudent(classId, studentId);
    } finally {
      setApprovingId(null);
    }
  };

  const handleReject = async (classId: string, studentId: string) => {
    setApprovingId(studentId);
    try {
      await rejectStudent(classId, studentId);
    } finally {
      setApprovingId(null);
    }
  };

  if (loadingClasses) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-xl">
      {/* Welcome Banner */}
      <motion.div
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="bg-lavender-light/30 rounded-2xl px-lg py-md border border-primary/10 shadow-sm"
      >
        <h1 className="font-baloo font-extrabold text-xxl text-text-dark">
          {getHourGreeting()}, {user?.displayName || user?.email?.split('@')[0] || 'Teacher'} 👋
        </h1>
        <p className="font-baloo text-text-muted mt-xs">
          Here's what's happening with your classes today.
        </p>
      </motion.div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-sm sm:gap-md">
        {stats.map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3, delay: i * 0.05 }}
            whileHover={{ scale: 1.03, y: -3 }}
          >
            <Card className={`${stat.color} h-full`}>
              <div className="text-center">
                <span className="text-3xl block mb-sm">{stat.icon}</span>
                <p className="font-baloo font-extrabold text-xxl text-text-dark leading-none">{stat.value}</p>
                <p className="font-baloo text-xs text-text-muted mt-xs">{stat.label}</p>
              </div>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* My Classes Grid */}
      {classes.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.2 }}
        >
          <div className="flex items-center justify-between mb-md">
            <h2 className="font-baloo font-bold text-xl text-text-dark">My Classes</h2>
            <button
              onClick={() => navigate('/teacher/classes')}
              className="font-baloo text-sm text-primary hover:underline"
            >
              View all →
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-md">
            {classes.map((cls: ClassDoc & { id: string }, i) => (
              <motion.div
                key={cls.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 + i * 0.05 }}
                whileHover={{ scale: 1.02 }}
              >
                <Card className="bg-white hover:shadow-md transition-shadow cursor-pointer">
                  <div className="flex items-start gap-md" onClick={() => navigate(`/teacher/classes/${cls.id}`)}>
                    <div className="w-12 h-12 rounded-xl bg-lavender-light flex items-center justify-center text-2xl flex-shrink-0">
                      🏫
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-baloo font-bold text-md text-text-dark truncate">{cls.name}</p>
                      <div className="flex items-center gap-xs mt-xs flex-wrap">
                        <span className="font-baloo text-xs text-text-muted">Grade {cls.grade}</span>
                        {cls.homeLanguage && cls.learningLanguage && (
                          <span className="font-baloo text-xs bg-lavender-light text-primary px-sm py-0.5 rounded-full">
                            {cls.homeLanguage.toUpperCase()} → {cls.learningLanguage.toUpperCase()}
                          </span>
                        )}
                      </div>
                      <p className="font-baloo text-xs text-text-muted mt-xs">
                        {cls.studentIds?.length ?? 0} students
                        {(cls.pendingStudentIds?.length ?? 0) > 0 && (
                          <span className="ml-xs text-amber-600 font-semibold">
                            · {cls.pendingStudentIds.length} pending
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                </Card>
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Pending Students */}
      {pendingEntries.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.3 }}
        >
          <h2 className="font-baloo font-bold text-xl text-text-dark mb-md flex items-center gap-sm">
            <span>⚠️</span> Pending Students
            <span className="bg-amber-100 text-amber-700 font-baloo font-bold text-xs px-sm py-xs rounded-full">
              {pendingEntries.length}
            </span>
          </h2>
          <div className="space-y-sm">
            {pendingEntries.map(({ classId, className, student }) => (
              <Card key={`${classId}-${student.id}`} className="bg-white border border-amber-100">
                <div className="flex items-center gap-md">
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center font-baloo font-bold text-white flex-shrink-0 text-sm"
                    style={{ backgroundColor: student.avatarColor || '#7C81FF' }}
                  >
                    {(student.name || student.email || '?')[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-baloo font-bold text-sm text-text-dark truncate">
                      {student.name || 'Unnamed'}
                    </p>
                    <p className="font-baloo text-xs text-text-muted truncate">
                      {className} · Grade {student.grade}
                    </p>
                  </div>
                  <div className="flex items-center gap-xs flex-shrink-0">
                    <button
                      onClick={() => handleApprove(classId, student.id)}
                      disabled={approvingId === student.id}
                      className="px-md py-xs bg-success text-white font-baloo font-semibold text-xs rounded-lg hover:bg-success/90 transition-colors disabled:opacity-50"
                    >
                      {approvingId === student.id ? '...' : 'Approve'}
                    </button>
                    <button
                      onClick={() => handleReject(classId, student.id)}
                      disabled={approvingId === student.id}
                      className="px-md py-xs border-2 border-error text-error font-baloo font-semibold text-xs rounded-lg hover:bg-error hover:text-white transition-colors disabled:opacity-50"
                    >
                      Reject
                    </button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </motion.div>
      )}

      {/* Upcoming Assignments */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.35 }}
      >
        <div className="flex items-center justify-between mb-md">
          <h2 className="font-baloo font-bold text-xl text-text-dark flex items-center gap-sm">
            <span>📅</span> Upcoming Assignments
          </h2>
          <button
            onClick={() => navigate('/teacher/assignments')}
            className="font-baloo text-sm text-primary hover:underline"
          >
            View all →
          </button>
        </div>
        {upcomingAssignments.length === 0 ? (
          <Card className="bg-white text-center py-lg">
            <span className="text-4xl block mb-sm">✅</span>
            <p className="font-baloo text-sm text-text-muted">No assignments due in the next 7 days.</p>
          </Card>
        ) : (
          <div className="space-y-sm">
            {upcomingAssignments.map(a => {
              const sec = dueDateSeconds(a);
              const due = sec ? new Date(sec * 1000).toLocaleDateString() : '—';
              return (
                <Card key={a.id} className="bg-white hover:shadow-md transition-shadow">
                  <div className="flex items-center gap-md">
                    <div className="w-10 h-10 rounded-xl bg-lavender-light flex items-center justify-center flex-shrink-0">
                      <span className="text-xl">📝</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-baloo font-bold text-sm text-text-dark truncate">{a.title}</p>
                      <p className="font-baloo text-xs text-text-muted">Due: {due}</p>
                    </div>
                    <span className={`px-sm py-xs font-baloo font-semibold text-xs rounded-full ${
                      a.status === 'active' ? 'bg-mint-light text-secondary' :
                      a.status === 'draft' ? 'bg-lavender-light text-primary' :
                      'bg-divider text-text-muted'
                    } capitalize`}>
                      {a.status}
                    </span>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </motion.div>

      {/* Empty state */}
      {classes.length === 0 && (
        <Card className="text-center py-xxl">
          <span className="text-6xl block mb-md">🏫</span>
          <h3 className="font-baloo font-bold text-xl text-text-dark mb-sm">No classes yet</h3>
          <p className="font-baloo text-body text-text-muted mb-lg">
            You haven't been assigned to any classes. Contact your school administrator to get started.
          </p>
          <Button
            title="View Classes"
            onPress={() => navigate('/teacher/classes')}
            variant="primary"
          />
        </Card>
      )}
    </div>
  );
}
