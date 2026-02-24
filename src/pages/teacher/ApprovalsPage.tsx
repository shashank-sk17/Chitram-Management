import { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Card } from '../../components/common/Card';
import { useAuth } from '../../features/auth/hooks/useAuth';
import { getClassesByTeacher, getPendingStudentsByClass } from '../../services/firebase/firestore';
import { useTeacherStore } from '../../stores/teacherStore';

interface PendingStudent {
  id: string;
  name?: string;
  email?: string;
  age?: number;
  avatarColor?: string;
}

interface ClassWithPending {
  id: string;
  name: string;
  grade: string;
  pendingStudentIds: string[];
  pendingStudents: PendingStudent[];
}

export default function ApprovalsPage() {
  const { user } = useAuth();
  const { approveStudent, rejectStudent } = useTeacherStore();

  const [loading, setLoading] = useState(true);
  const [classesWithPending, setClassesWithPending] = useState<ClassWithPending[]>([]);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);

  const loadPending = useCallback(async () => {
    if (!user) return;

    setLoading(true);
    try {
      const classes = await getClassesByTeacher(user.uid);
      const classesWithPendingIds = classes.filter(
        (c: any) => c.pendingStudentIds && c.pendingStudentIds.length > 0,
      );

      const enriched = await Promise.all(
        classesWithPendingIds.map(async (cls: any) => {
          const pendingStudents = await getPendingStudentsByClass(cls.id);
          return {
            id: cls.id,
            name: cls.name ?? `Class ${cls.id.slice(0, 6)}`,
            grade: cls.grade ?? '',
            pendingStudentIds: cls.pendingStudentIds,
            pendingStudents,
          } as ClassWithPending;
        }),
      );

      setClassesWithPending(enriched.filter((c) => c.pendingStudents.length > 0));
    } catch (err) {
      console.error('Error loading pending students:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadPending();
  }, [loadPending]);

  async function handleApprove(classId: string, studentId: string) {
    setActionInProgress(`${classId}-${studentId}-approve`);
    try {
      await approveStudent(classId, studentId);
      // Remove student from local state optimistically
      setClassesWithPending((prev) =>
        prev
          .map((cls) =>
            cls.id === classId
              ? { ...cls, pendingStudents: cls.pendingStudents.filter((s) => s.id !== studentId) }
              : cls,
          )
          .filter((cls) => cls.pendingStudents.length > 0),
      );
    } catch (err) {
      console.error('Error approving student:', err);
    } finally {
      setActionInProgress(null);
    }
  }

  async function handleReject(classId: string, studentId: string) {
    setActionInProgress(`${classId}-${studentId}-reject`);
    try {
      await rejectStudent(classId, studentId);
      setClassesWithPending((prev) =>
        prev
          .map((cls) =>
            cls.id === classId
              ? { ...cls, pendingStudents: cls.pendingStudents.filter((s) => s.id !== studentId) }
              : cls,
          )
          .filter((cls) => cls.pendingStudents.length > 0),
      );
    } catch (err) {
      console.error('Error rejecting student:', err);
    } finally {
      setActionInProgress(null);
    }
  }

  const totalPending = classesWithPending.reduce((sum, c) => sum + c.pendingStudents.length, 0);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="mb-xl"
      >
        <h1 className="font-baloo font-bold text-xl sm:text-xxl text-text-dark mb-xs sm:mb-sm">
          Approvals ✋
        </h1>
        <p className="font-baloo text-sm sm:text-lg text-text-muted">
          {totalPending > 0
            ? `${totalPending} student${totalPending !== 1 ? 's' : ''} waiting to join your class${classesWithPending.length !== 1 ? 'es' : ''}`
            : 'No pending join requests'}
        </p>
      </motion.div>

      {/* Empty state */}
      {classesWithPending.length === 0 && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4 }}
        >
          <Card className="text-center py-lg sm:py-xxl">
            <span className="text-5xl sm:text-6xl mb-md block">🎉</span>
            <h3 className="font-baloo font-bold text-lg sm:text-xl text-text-dark mb-sm">
              All caught up!
            </h3>
            <p className="font-baloo text-sm sm:text-body text-text-muted">
              Students who request to join your classes will appear here for approval.
            </p>
          </Card>
        </motion.div>
      )}

      {/* Classes with pending students */}
      <div className="flex flex-col gap-xl">
        {classesWithPending.map((cls, classIndex) => (
          <motion.div
            key={cls.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: classIndex * 0.1 }}
          >
            {/* Class header */}
            <div className="flex items-center gap-sm mb-md">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shadow">
                <span className="text-lg">👨‍🏫</span>
              </div>
              <div>
                <h2 className="font-baloo font-bold text-lg text-text-dark">{cls.name}</h2>
                <p className="font-baloo text-xs text-text-muted">
                  {cls.grade ? `Grade ${cls.grade} · ` : ''}
                  {cls.pendingStudents.length} pending
                </p>
              </div>
            </div>

            {/* Student rows */}
            <div className="flex flex-col gap-sm">
              {cls.pendingStudents.map((student, studentIndex) => {
                const approveKey = `${cls.id}-${student.id}-approve`;
                const rejectKey = `${cls.id}-${student.id}-reject`;
                const isBusy = actionInProgress === approveKey || actionInProgress === rejectKey;
                const initials = (student.name ?? student.email ?? '?')[0].toUpperCase();
                const bgColor = student.avatarColor ?? '#7C81FF';

                return (
                  <motion.div
                    key={student.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3, delay: classIndex * 0.1 + studentIndex * 0.05 }}
                  >
                    <Card className="bg-white">
                      <div className="flex items-center gap-md">
                        {/* Avatar */}
                        <div
                          className="w-12 h-12 rounded-2xl flex items-center justify-center shadow flex-shrink-0"
                          style={{ backgroundColor: bgColor }}
                        >
                          <span className="font-baloo font-extrabold text-xl text-white">
                            {initials}
                          </span>
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <p className="font-baloo font-bold text-body text-text-dark truncate">
                            {student.name ?? 'Unknown'}
                          </p>
                          <p className="font-baloo text-xs text-text-muted truncate">
                            {student.email ?? 'No email'}
                            {student.age ? ` · Age ${student.age}` : ''}
                          </p>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-sm flex-shrink-0">
                          <button
                            onClick={() => handleReject(cls.id, student.id)}
                            disabled={isBusy}
                            className="px-md py-sm rounded-xl border-2 border-divider font-baloo font-semibold text-sm text-text-muted hover:border-error hover:text-error transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {actionInProgress === rejectKey ? '...' : 'Reject'}
                          </button>
                          <button
                            onClick={() => handleApprove(cls.id, student.id)}
                            disabled={isBusy}
                            className="px-md py-sm rounded-xl bg-secondary font-baloo font-semibold text-sm text-white hover:bg-secondary/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {actionInProgress === approveKey ? '...' : 'Approve'}
                          </button>
                        </div>
                      </div>
                    </Card>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
