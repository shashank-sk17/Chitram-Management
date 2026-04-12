import { useState, useEffect, useMemo } from 'react';
import { useAuthStore } from '../../stores/authStore';
import { useTeacherStore } from '../../stores/teacherStore';
import type { LearningAttemptDoc } from '../../types/firestore';
import { collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
import { db } from '../../config/firebase';

type DateRange = 'today' | 'week' | 'custom';

interface AttemptWithId extends LearningAttemptDoc {
  id: string;
  uid: string;
  classId: string;
}

// Inline query function — no separate service file needed
async function getLearningAttemptsForClass(
  classId: string,
  startDate: Date,
  endDate: Date,
): Promise<AttemptWithId[]> {
  const start = Timestamp.fromDate(startDate);
  const end = Timestamp.fromDate(endDate);
  const q = query(
    collection(db, 'learningAttempts'),
    where('classId', '==', classId),
    where('timestamp', '>=', start),
    where('timestamp', '<=', end),
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({
    id: d.id,
    ...(d.data() as Omit<AttemptWithId, 'id'>),
  }));
}

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

function formatDate(d: Date): string {
  return d.toISOString().split('T')[0];
}

export default function PracticeTrackingPage() {
  const { user } = useAuthStore();
  const { classes, students, listenToTeacherClasses, listenToClassStudents, getStudentsForClass } = useTeacherStore();

  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [dateRange, setDateRange] = useState<DateRange>('today');
  const [customStart, setCustomStart] = useState(formatDate(new Date()));
  const [customEnd, setCustomEnd] = useState(formatDate(new Date()));
  const [attempts, setAttempts] = useState<AttemptWithId[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) return listenToTeacherClasses(user.uid);
  }, [user]);

  useEffect(() => {
    if (!selectedClassId) return;
    const unsub = listenToClassStudents(selectedClassId);
    return unsub;
  }, [selectedClassId]);

  const getDateBounds = (): [Date, Date] => {
    const now = new Date();
    if (dateRange === 'today') return [startOfDay(now), endOfDay(now)];
    if (dateRange === 'week') {
      const weekAgo = new Date(now);
      weekAgo.setDate(weekAgo.getDate() - 7);
      return [startOfDay(weekAgo), endOfDay(now)];
    }
    return [startOfDay(new Date(customStart)), endOfDay(new Date(customEnd))];
  };

  const load = async () => {
    if (!selectedClassId) return;
    setLoading(true);
    try {
      const [start, end] = getDateBounds();
      const result = await getLearningAttemptsForClass(selectedClassId, start, end);
      setAttempts(result);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (selectedClassId) load();
  }, [selectedClassId, dateRange, customStart, customEnd]);

  const classStudents = useMemo(
    () => (selectedClassId ? getStudentsForClass(selectedClassId) : []),
    [selectedClassId, students]
  );

  // Per-student stats
  const studentStats = useMemo(() => {
    return classStudents.map(student => {
      const studentAttempts = attempts.filter(a => a.uid === student.id);
      const wordsPracticed = new Set(studentAttempts.map(a => a.wordId)).size;
      const total = studentAttempts.length;
      const correct = studentAttempts.filter(a => a.finalLabel).length;
      const accuracy = total > 0 ? Math.round((correct / total) * 100) : null;
      return { student, wordsPracticed, accuracy, attempts: total, active: total > 0 };
    });
  }, [classStudents, attempts]);

  // Summary
  const summary = useMemo(() => {
    const activeStudents = studentStats.filter(s => s.active).length;
    const totalWords = new Set(attempts.map(a => a.wordId)).size;
    const total = attempts.length;
    const correct = attempts.filter(a => a.finalLabel).length;
    const avgAccuracy = total > 0 ? Math.round((correct / total) * 100) : 0;
    return { activeStudents, totalWords, avgAccuracy, totalAttempts: total };
  }, [studentStats, attempts]);

  return (
    <div className="space-y-lg">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-md">
        <div>
          <h1 className="font-baloo font-extrabold text-xxl text-text-dark">Practice Tracking</h1>
          <p className="font-baloo text-text-muted">Monitor student practice activity</p>
        </div>
      </div>

      {/* Controls */}
      <div className="bg-white rounded-2xl border border-divider shadow-sm p-md flex items-end gap-md flex-wrap">
        <div>
          <label className="font-baloo font-bold text-xs text-text-dark block mb-xs">Class</label>
          <select
            value={selectedClassId}
            onChange={e => setSelectedClassId(e.target.value)}
            className="px-md py-sm rounded-xl border border-divider font-baloo text-sm focus:outline-none focus:ring-2 focus:ring-primary bg-white min-w-[180px]"
          >
            <option value="">— Choose a class —</option>
            {classes.map(c => <option key={c.id} value={c.id}>{c.name} · Grade {c.grade}</option>)}
          </select>
        </div>

        <div>
          <label className="font-baloo font-bold text-xs text-text-dark block mb-xs">Date Range</label>
          <div className="flex gap-xs">
            {(['today', 'week', 'custom'] as DateRange[]).map(r => (
              <button
                key={r}
                onClick={() => setDateRange(r)}
                className={`px-md py-sm rounded-xl font-baloo font-semibold text-sm capitalize border-2 transition-all ${
                  dateRange === r
                    ? 'border-primary bg-lavender-light text-primary'
                    : 'border-divider text-text-muted hover:text-text-dark'
                }`}
              >
                {r === 'today' ? 'Today' : r === 'week' ? 'This Week' : 'Custom'}
              </button>
            ))}
          </div>
        </div>

        {dateRange === 'custom' && (
          <>
            <div>
              <label className="font-baloo font-bold text-xs text-text-dark block mb-xs">From</label>
              <input
                type="date"
                value={customStart}
                onChange={e => setCustomStart(e.target.value)}
                className="px-md py-sm rounded-xl border border-divider font-baloo text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div>
              <label className="font-baloo font-bold text-xs text-text-dark block mb-xs">To</label>
              <input
                type="date"
                value={customEnd}
                onChange={e => setCustomEnd(e.target.value)}
                className="px-md py-sm rounded-xl border border-divider font-baloo text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </>
        )}
      </div>

      {!selectedClassId ? (
        <div className="bg-white rounded-2xl border border-divider shadow-sm p-xl text-center">
          <span className="text-5xl block mb-md">📈</span>
          <p className="font-baloo text-text-muted">Select a class to view practice data</p>
        </div>
      ) : (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-md">
            {[
              { label: 'Students Active', value: summary.activeStudents, icon: '👥', color: 'bg-mint-light' },
              { label: 'Words Practiced', value: summary.totalWords, icon: '📝', color: 'bg-lavender-light' },
              { label: 'Avg Accuracy', value: `${summary.avgAccuracy}%`, icon: '🎯', color: 'bg-amber-50' },
              { label: 'Total Attempts', value: summary.totalAttempts, icon: '🔁', color: 'bg-white' },
            ].map(stat => (
              <div key={stat.label} className={`${stat.color} rounded-2xl border border-divider shadow-sm p-md flex items-center gap-md`}>
                <span className="text-2xl">{stat.icon}</span>
                <div>
                  <p className="font-baloo font-extrabold text-xl text-text-dark leading-none">{loading ? '…' : stat.value}</p>
                  <p className="font-baloo text-xs text-text-muted mt-xs">{stat.label}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Student table */}
          <div className="bg-white rounded-2xl border border-divider shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-lavender-light/30 border-b border-divider">
                    <th className="px-md py-sm text-left font-baloo font-bold text-sm text-text-dark">Student</th>
                    <th className="px-md py-sm text-center font-baloo font-bold text-sm text-text-dark">Words Practiced</th>
                    <th className="px-md py-sm text-center font-baloo font-bold text-sm text-text-dark">Accuracy</th>
                    <th className="px-md py-sm text-center font-baloo font-bold text-sm text-text-dark">Attempts</th>
                    <th className="px-md py-sm text-center font-baloo font-bold text-sm text-text-dark">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={5} className="px-md py-xl text-center font-baloo text-text-muted">Loading…</td>
                    </tr>
                  ) : studentStats.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-md py-xl text-center font-baloo text-text-muted">No students found.</td>
                    </tr>
                  ) : (
                    studentStats.map(({ student, wordsPracticed, accuracy, attempts: att, active }) => (
                      <tr key={student.id} className="border-b border-divider hover:bg-lavender-light/10 transition-colors">
                        <td className="px-md py-sm">
                          <div className="flex items-center gap-sm">
                            <div
                              className="w-8 h-8 rounded-full flex items-center justify-center font-baloo font-bold text-xs text-white shrink-0"
                              style={{ backgroundColor: student.avatarColor || '#7C81FF' }}
                            >
                              {student.name?.[0]?.toUpperCase() ?? '?'}
                            </div>
                            <span className="font-baloo font-semibold text-sm text-text-dark">{student.name}</span>
                          </div>
                        </td>
                        <td className="px-md py-sm text-center font-baloo text-sm text-text-dark">{wordsPracticed}</td>
                        <td className="px-md py-sm text-center">
                          {accuracy !== null ? (
                            <span className={`px-sm py-0.5 rounded-full font-baloo font-semibold text-xs ${
                              accuracy >= 80 ? 'bg-success/10 text-success' :
                              accuracy >= 60 ? 'bg-amber-50 text-amber-600' :
                              'bg-error/10 text-error'
                            }`}>
                              {accuracy}%
                            </span>
                          ) : (
                            <span className="font-baloo text-xs text-text-muted">—</span>
                          )}
                        </td>
                        <td className="px-md py-sm text-center font-baloo text-sm text-text-muted">{att}</td>
                        <td className="px-md py-sm text-center">
                          <span className={`px-sm py-0.5 rounded-full font-baloo font-semibold text-xs ${
                            active ? 'bg-success/10 text-success' : 'bg-gray-100 text-text-muted'
                          }`}>
                            {active ? 'Active' : 'Absent'}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
