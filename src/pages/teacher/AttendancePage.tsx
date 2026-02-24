import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '../../features/auth/hooks/useAuth';
import { Card } from '../../components/common/Card';
import { Avatar } from '../../components/common/Avatar';
import { getClassesByTeacher, getStudentsByClass, getAttemptsForDay } from '../../services/firebase/firestore';
import type { ClassDoc, StudentDoc, LearningAttemptDoc } from '../../types/firestore';

// Minimal word lookup — IDs match the mobile app's Word.id (1–55)
const WORD_MAP: Record<number, { emoji: string; name: string }> = {
  1:  { emoji: '🍎', name: 'Apple' },
  2:  { emoji: '🍌', name: 'Banana' },
  3:  { emoji: '🐱', name: 'Cat' },
  4:  { emoji: '🐶', name: 'Dog' },
  5:  { emoji: '🐘', name: 'Elephant' },
  6:  { emoji: '🐟', name: 'Fish' },
  7:  { emoji: '🍇', name: 'Grapes' },
  8:  { emoji: '🏠', name: 'House' },
  9:  { emoji: '🍦', name: 'Ice Cream' },
  10: { emoji: '🏺', name: 'Jug' },
  11: { emoji: '🪁', name: 'Kite' },
  12: { emoji: '🦁', name: 'Lion' },
  13: { emoji: '🥭', name: 'Mango' },
  14: { emoji: '🪺', name: 'Nest' },
  15: { emoji: '🍊', name: 'Orange' },
  16: { emoji: '🦜', name: 'Parrot' },
  17: { emoji: '👸', name: 'Queen' },
  18: { emoji: '🐰', name: 'Rabbit' },
  19: { emoji: '☀️', name: 'Sun' },
  20: { emoji: '🌳', name: 'Tree' },
  21: { emoji: '☂️', name: 'Umbrella' },
  22: { emoji: '🚐', name: 'Van' },
  23: { emoji: '⌚', name: 'Watch' },
  24: { emoji: '🎵', name: 'Xylophone' },
  25: { emoji: '🐂', name: 'Yak' },
  26: { emoji: '🦓', name: 'Zebra' },
  27: { emoji: '⚽', name: 'Ball' },
  28: { emoji: '📖', name: 'Book' },
  29: { emoji: '🚗', name: 'Car' },
  30: { emoji: '🦆', name: 'Duck' },
  31: { emoji: '🥚', name: 'Egg' },
  32: { emoji: '🌸', name: 'Flower' },
  33: { emoji: '🎸', name: 'Guitar' },
  34: { emoji: '🎩', name: 'Hat' },
  35: { emoji: '🖋️', name: 'Ink' },
  36: { emoji: '🧥', name: 'Jacket' },
  37: { emoji: '🔑', name: 'Key' },
  38: { emoji: '🪔', name: 'Lamp' },
  39: { emoji: '🌙', name: 'Moon' },
  40: { emoji: '👃', name: 'Nose' },
  41: { emoji: '🦉', name: 'Owl' },
  42: { emoji: '🖊️', name: 'Pen' },
  43: { emoji: '🌧️', name: 'Rain' },
  44: { emoji: '⭐', name: 'Star' },
  45: { emoji: '🐯', name: 'Tiger' },
  46: { emoji: '🎻', name: 'Violin' },
  47: { emoji: '💧', name: 'Water' },
  48: { emoji: '⛵', name: 'Boat' },
  49: { emoji: '☁️', name: 'Cloud' },
  50: { emoji: '🚪', name: 'Door' },
  51: { emoji: '👁️', name: 'Eye' },
  52: { emoji: '🐸', name: 'Frog' },
  53: { emoji: '🐐', name: 'Goat' },
  54: { emoji: '🐴', name: 'Horse' },
  55: { emoji: '🏝️', name: 'Island' },
};

function addDays(date: Date, n: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function isToday(date: Date): boolean {
  const now = new Date();
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  );
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });
}

export default function TeacherAttendancePage() {
  const { user } = useAuth();

  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [classes, setClasses] = useState<Array<ClassDoc & { id: string }>>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [students, setStudents] = useState<Array<StudentDoc & { id: string }>>([]);
  const [attendanceMap, setAttendanceMap] = useState<Record<string, LearningAttemptDoc[]>>({});
  const [loading, setLoading] = useState(true);
  const [attendanceLoading, setAttendanceLoading] = useState(false);
  const [expandedStudents, setExpandedStudents] = useState<Set<string>>(new Set());

  // Load teacher's classes once on mount
  useEffect(() => {
    if (!user) return;
    setLoading(true);
    getClassesByTeacher(user.uid)
      .then((data) => {
        setClasses(data as Array<ClassDoc & { id: string }>);
        if (data.length > 0) setSelectedClassId(data[0].id);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [user]);

  // Load students when class changes
  useEffect(() => {
    if (!selectedClassId) { setStudents([]); return; }
    getStudentsByClass(selectedClassId)
      .then((data) => setStudents(data as Array<StudentDoc & { id: string }>))
      .catch(console.error);
  }, [selectedClassId]);

  // Load attendance when students or date changes
  useEffect(() => {
    if (students.length === 0) { setAttendanceMap({}); return; }
    setAttendanceLoading(true);
    Promise.all(students.map((s) => getAttemptsForDay(s.id, selectedDate)))
      .then((results) => {
        const map: Record<string, LearningAttemptDoc[]> = {};
        students.forEach((s, i) => { map[s.id] = results[i]; });
        setAttendanceMap(map);
      })
      .catch(console.error)
      .finally(() => setAttendanceLoading(false));
  }, [students, selectedDate]);

  function toggleExpand(studentId: string) {
    setExpandedStudents((prev) => {
      const next = new Set(prev);
      next.has(studentId) ? next.delete(studentId) : next.add(studentId);
      return next;
    });
  }

  // Derived
  const presentStudents = students.filter((s) => (attendanceMap[s.id]?.length ?? 0) > 0);
  const absentStudents  = students.filter((s) => (attendanceMap[s.id]?.length ?? 0) === 0);
  const classAvgAccuracy = presentStudents.length === 0 ? null : Math.round(
    presentStudents.reduce((sum, s) => {
      const attempts = attendanceMap[s.id] ?? [];
      const correct  = attempts.filter((a) => a.finalLabel === true).length;
      return sum + (attempts.length > 0 ? (correct / attempts.length) * 100 : 0);
    }, 0) / presentStudents.length
  );

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
          Attendance 📅
        </h1>
        <p className="font-baloo text-sm sm:text-lg text-text-muted">
          Daily activity and presence for your class
        </p>
      </motion.div>

      {/* Controls: date nav + class dropdown */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
        className="mb-lg"
      >
        <Card className="bg-white">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-md">

            {/* Date Navigator */}
            <div className="flex items-center gap-sm flex-1 min-w-0">
              <button
                onClick={() => setSelectedDate((d) => addDays(d, -1))}
                className="w-9 h-9 flex-shrink-0 rounded-lg border-2 border-divider flex items-center justify-center hover:border-primary hover:text-primary transition-colors font-baloo font-bold text-md"
              >
                ←
              </button>

              <p className="flex-1 text-center font-baloo font-bold text-md sm:text-lg text-text-dark truncate">
                {formatDate(selectedDate)}
              </p>

              <button
                onClick={() => setSelectedDate((d) => addDays(d, 1))}
                disabled={isToday(selectedDate)}
                className="w-9 h-9 flex-shrink-0 rounded-lg border-2 border-divider flex items-center justify-center hover:border-primary hover:text-primary transition-colors font-baloo font-bold text-md disabled:opacity-40 disabled:cursor-not-allowed"
              >
                →
              </button>

              {!isToday(selectedDate) && (
                <button
                  onClick={() => setSelectedDate(new Date())}
                  className="flex-shrink-0 px-sm py-xs rounded-full bg-primary text-white font-baloo text-xs font-semibold hover:bg-primary/80 transition-colors"
                >
                  Today
                </button>
              )}
            </div>

            {/* Class dropdown */}
            {classes.length > 0 && (
              <div className="w-full sm:w-52 flex-shrink-0">
                <select
                  value={selectedClassId}
                  onChange={(e) => setSelectedClassId(e.target.value)}
                  className="w-full px-md py-sm rounded-lg border-2 border-divider bg-white font-baloo text-sm text-text-dark focus:border-primary focus:outline-none"
                >
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

      {/* Empty: no classes */}
      {classes.length === 0 && (
        <Card className="text-center py-xl sm:py-xxl">
          <span className="text-5xl sm:text-6xl mb-md block">📭</span>
          <h3 className="font-baloo font-bold text-xl text-text-dark mb-sm">No classes yet</h3>
          <p className="font-baloo text-body text-text-muted">
            Create a class first to track attendance.
          </p>
        </Card>
      )}

      {/* Empty: class has no students */}
      {classes.length > 0 && students.length === 0 && !attendanceLoading && (
        <Card className="text-center py-xl sm:py-xxl">
          <span className="text-5xl sm:text-6xl mb-md block">👨‍🎓</span>
          <h3 className="font-baloo font-bold text-xl text-text-dark mb-sm">No students in this class</h3>
          <p className="font-baloo text-body text-text-muted">
            Students will appear here once they join the class.
          </p>
        </Card>
      )}

      {students.length > 0 && (
        <>
          {/* Inline attendance loading indicator */}
          {attendanceLoading && (
            <div className="flex items-center justify-center gap-sm py-md mb-md">
              <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              <span className="font-baloo text-sm text-text-muted">Loading attendance…</span>
            </div>
          )}

          {/* Summary stat cards */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.2 }}
            className="grid grid-cols-3 gap-sm sm:gap-md mb-lg"
          >
            {[
              {
                label: 'Present',
                value: attendanceLoading ? '—' : String(presentStudents.length),
                icon: '✅',
                color: 'bg-gradient-to-br from-mint-light to-secondary/20',
              },
              {
                label: 'Absent',
                value: attendanceLoading ? '—' : String(absentStudents.length),
                icon: '😴',
                color: 'bg-gradient-to-br from-rose-light to-error/10',
              },
              {
                label: 'Avg Accuracy',
                value: attendanceLoading ? '—' : (classAvgAccuracy !== null ? `${classAvgAccuracy}%` : '—'),
                icon: '🎯',
                color: 'bg-gradient-to-br from-lavender-light to-primary/20',
              },
            ].map((stat, index) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3, delay: 0.2 + index * 0.1 }}
              >
                <Card className={stat.color}>
                  <div className="flex items-center justify-between gap-xs sm:gap-sm">
                    <div className="min-w-0">
                      <p className="font-baloo text-xs sm:text-md text-text-muted mb-xs leading-tight">
                        {stat.label}
                      </p>
                      <h3 className="font-baloo font-extrabold text-xl sm:text-hero text-text-dark">
                        {stat.value}
                      </h3>
                    </div>
                    <span className="text-xl sm:text-4xl flex-shrink-0">{stat.icon}</span>
                  </div>
                </Card>
              </motion.div>
            ))}
          </motion.div>

          {/* Student list */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4, delay: 0.35 }}
            className="flex flex-col gap-sm"
          >
            {students.map((student, index) => {
              const attempts    = attendanceMap[student.id] ?? [];
              const isPresent   = attempts.length > 0;
              const uniqueWords = [...new Set(attempts.map((a) => a.wordId))];
              const correct     = attempts.filter((a) => a.finalLabel === true).length;
              const accuracy    = attempts.length > 0
                ? Math.round((correct / attempts.length) * 100)
                : 0;
              const isExpanded  = expandedStudents.has(student.id);

              return (
                <motion.div
                  key={student.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.25, delay: 0.35 + index * 0.04 }}
                >
                  <Card className="bg-white">
                    {/* Main row */}
                    <div className="flex items-center gap-md">
                      <Avatar
                        name={student.name || student.email || '?'}
                        size={48}
                        color={student.avatarColor || '#7C81FF'}
                      />

                      {/* Name + details */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-sm flex-wrap">
                          <p className="font-baloo font-bold text-body text-text-dark truncate">
                            {student.name || student.email || 'Unknown'}
                          </p>
                          {student.grade && (
                            <span className="bg-lavender-light px-sm py-xs rounded-full font-baloo text-xs font-semibold text-primary flex-shrink-0">
                              Gr. {student.grade}
                            </span>
                          )}
                        </div>
                        {isPresent && !attendanceLoading && (
                          <p className="font-baloo text-xs text-text-muted mt-xs">
                            {attempts.length} attempt{attempts.length !== 1 ? 's' : ''} · {uniqueWords.length} word{uniqueWords.length !== 1 ? 's' : ''} · {accuracy}% accuracy
                          </p>
                        )}
                      </div>

                      {/* Status + expand toggle */}
                      <div className="flex items-center gap-sm flex-shrink-0">
                        {!attendanceLoading && (
                          <span
                            className={`px-sm py-xs rounded-full font-baloo text-xs font-bold whitespace-nowrap ${
                              isPresent
                                ? 'bg-mint-light text-secondary'
                                : 'bg-divider text-text-muted'
                            }`}
                          >
                            {isPresent ? 'Present ✓' : 'Absent'}
                          </span>
                        )}
                        {isPresent && uniqueWords.length > 0 && (
                          <button
                            onClick={() => toggleExpand(student.id)}
                            className="w-7 h-7 rounded-lg border-2 border-divider flex items-center justify-center hover:border-primary hover:text-primary transition-colors text-text-muted text-xs font-bold"
                          >
                            {isExpanded ? '▲' : '▼'}
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Expanded word chips */}
                    {isPresent && isExpanded && uniqueWords.length > 0 && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        transition={{ duration: 0.2 }}
                        className="mt-md pt-md border-t border-divider overflow-hidden"
                      >
                        <p className="font-baloo text-xs text-text-muted mb-sm">
                          Words practiced today:
                        </p>
                        <div className="flex flex-wrap gap-sm">
                          {uniqueWords.map((wordId) => {
                            const word = WORD_MAP[wordId];
                            return (
                              <div
                                key={wordId}
                                className="flex items-center gap-xs px-sm py-xs rounded-lg bg-lavender-light/50 border border-divider"
                              >
                                <span className="text-lg leading-none">{word?.emoji ?? '❓'}</span>
                                <span className="font-baloo text-xs text-text-body">
                                  {word?.name ?? `#${wordId}`}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </motion.div>
                    )}
                  </Card>
                </motion.div>
              );
            })}
          </motion.div>
        </>
      )}
    </div>
  );
}
