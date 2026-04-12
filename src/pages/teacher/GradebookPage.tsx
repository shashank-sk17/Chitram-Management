import { useState, useEffect, useMemo } from 'react';
import { useAuthStore } from '../../stores/authStore';
import { useTeacherStore } from '../../stores/teacherStore';
import { useAssignmentStore } from '../../stores/assignmentStore';
import { Timestamp } from 'firebase/firestore';

function formatDate(ts: Timestamp | string | undefined): string {
  if (!ts) return '—';
  if (ts instanceof Timestamp) return ts.toDate().toLocaleDateString();
  return String(ts);
}

function scoreColor(pct: number | null): string {
  if (pct === null) return 'bg-gray-100 text-text-muted';
  if (pct >= 80) return 'bg-success/10 text-success';
  if (pct >= 60) return 'bg-amber-50 text-amber-600';
  return 'bg-error/10 text-error';
}

export default function GradebookPage() {
  const { user } = useAuthStore();
  const { classes, students, listenToTeacherClasses, listenToClassStudents, getStudentsForClass } = useTeacherStore();
  const { assignments, submissions, listenToTeacherAssignments, fetchSubmissionsForAssignment, getAssignmentsForClass } = useAssignmentStore();

  const [selectedClassId, setSelectedClassId] = useState<string>('');

  useEffect(() => {
    if (!user) return;
    const u1 = listenToTeacherClasses(user.uid);
    const u2 = listenToTeacherAssignments(user.uid);
    return () => { u1(); u2(); };
  }, [user]);

  useEffect(() => {
    if (!selectedClassId) return;
    const unsub = listenToClassStudents(selectedClassId);
    return unsub;
  }, [selectedClassId]);

  const classAssignments = useMemo(() => {
    if (!selectedClassId) return [];
    return getAssignmentsForClass(selectedClassId).sort((a, b) => {
      const ta = a.dueDate instanceof Timestamp ? a.dueDate.seconds : 0;
      const tb = b.dueDate instanceof Timestamp ? b.dueDate.seconds : 0;
      return ta - tb;
    });
  }, [selectedClassId, assignments]);

  // Fetch all submissions for class assignments
  useEffect(() => {
    classAssignments.forEach(a => {
      if (!submissions[a.id]) fetchSubmissionsForAssignment(a.id);
    });
  }, [classAssignments]);

  const classStudents = useMemo(() => {
    if (!selectedClassId) return [];
    return getStudentsForClass(selectedClassId);
  }, [selectedClassId, students]);

  // Build matrix: rows = students, cols = assignments
  const matrix = useMemo(() => {
    return classStudents.map(student => {
      const row = classAssignments.map(a => {
        const subs = submissions[a.id] ?? [];
        const sub = subs.find(s => s.uid === student.id);
        if (!sub || sub.score === undefined || !a.totalPoints) return null;
        return { score: sub.score, total: a.totalPoints, pct: Math.round((sub.score / a.totalPoints) * 100) };
      });
      const submitted = row.filter(r => r !== null);
      const avgPct = submitted.length > 0
        ? Math.round(submitted.reduce((s, r) => s + (r?.pct ?? 0), 0) / submitted.length)
        : null;
      return { student, row, avgPct, completedCount: submitted.length };
    });
  }, [classStudents, classAssignments, submissions]);

  // Column averages
  const colAvgs = classAssignments.map((_a, colIdx) => {
    const scores = matrix.map(r => r.row[colIdx]).filter(x => x !== null) as { pct: number }[];
    if (scores.length === 0) return null;
    return Math.round(scores.reduce((s, x) => s + x.pct, 0) / scores.length);
  });

  const exportCSV = () => {
    const headers = ['Student', ...classAssignments.map(a => a.title), 'Avg %', 'Completed'];
    const rows = matrix.map(r => [
      r.student.name,
      ...r.row.map(cell => cell ? `${cell.score}/${cell.total}` : '—'),
      r.avgPct !== null ? `${r.avgPct}%` : '—',
      `${r.completedCount}/${classAssignments.length}`,
    ]);
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `gradebook-${selectedClassId}-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-lg">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-md">
        <div>
          <h1 className="font-baloo font-extrabold text-xxl text-text-dark">Gradebook</h1>
          <p className="font-baloo text-text-muted">Assignment scores for all students</p>
        </div>
        {selectedClassId && (
          <button
            onClick={exportCSV}
            className="px-md py-sm rounded-xl border-2 border-divider font-baloo font-semibold text-sm text-text-dark hover:bg-lavender-light transition-colors"
          >
            Export CSV
          </button>
        )}
      </div>

      {/* Class selector */}
      <div className="bg-white rounded-2xl border border-divider shadow-sm p-md">
        <label className="font-baloo font-bold text-sm text-text-dark block mb-xs">Select Class</label>
        <select
          value={selectedClassId}
          onChange={e => setSelectedClassId(e.target.value)}
          className="w-full md:w-64 px-md py-sm rounded-xl border border-divider font-baloo text-sm focus:outline-none focus:ring-2 focus:ring-primary bg-white"
        >
          <option value="">— Choose a class —</option>
          {classes.map(c => <option key={c.id} value={c.id}>{c.name} · Grade {c.grade}</option>)}
        </select>
      </div>

      {!selectedClassId ? (
        <div className="bg-white rounded-2xl border border-divider shadow-sm p-xl text-center">
          <span className="text-5xl block mb-md">📊</span>
          <p className="font-baloo text-text-muted">Select a class to view the gradebook</p>
        </div>
      ) : classAssignments.length === 0 ? (
        <div className="bg-white rounded-2xl border border-divider shadow-sm p-xl text-center">
          <span className="text-5xl block mb-md">📝</span>
          <p className="font-baloo text-text-muted">No assignments for this class yet.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-divider shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-max">
              <thead>
                <tr className="bg-lavender-light/30 border-b border-divider">
                  <th className="px-md py-sm text-left font-baloo font-bold text-sm text-text-dark sticky left-0 bg-gradient-to-r from-lavender-light to-lavender-light/80 z-10 min-w-[160px]">
                    Student
                  </th>
                  {classAssignments.map(a => (
                    <th key={a.id} className="px-md py-sm text-center font-baloo font-bold text-xs text-text-dark min-w-[100px]">
                      <div className="max-w-[90px] mx-auto">
                        <p className="truncate">{a.title}</p>
                        <p className="font-normal text-text-muted text-[10px]">{formatDate(a.dueDate)}</p>
                      </div>
                    </th>
                  ))}
                  <th className="px-md py-sm text-center font-baloo font-bold text-xs text-text-dark min-w-[70px]">Avg %</th>
                  <th className="px-md py-sm text-center font-baloo font-bold text-xs text-text-dark min-w-[80px]">Done</th>
                </tr>
              </thead>
              <tbody>
                {matrix.length === 0 ? (
                  <tr>
                    <td colSpan={classAssignments.length + 3} className="px-md py-xl text-center font-baloo text-text-muted">
                      No students in this class.
                    </td>
                  </tr>
                ) : (
                  matrix.map(({ student, row, avgPct, completedCount }) => (
                    <tr key={student.id} className="border-b border-divider hover:bg-lavender-light/10 transition-colors">
                      <td className="px-md py-sm sticky left-0 bg-white z-10 border-r border-divider">
                        <div className="flex items-center gap-sm">
                          <div
                            className="w-7 h-7 rounded-full flex items-center justify-center font-baloo font-bold text-xs text-white shrink-0"
                            style={{ backgroundColor: student.avatarColor || '#7C81FF' }}
                          >
                            {student.name?.[0]?.toUpperCase() ?? '?'}
                          </div>
                          <span className="font-baloo font-semibold text-sm text-text-dark truncate max-w-[100px]">{student.name}</span>
                        </div>
                      </td>
                      {row.map((cell, colIdx) => (
                        <td key={colIdx} className="px-md py-sm text-center">
                          {cell ? (
                            <span className={`px-xs py-0.5 rounded-lg font-baloo font-semibold text-xs ${scoreColor(cell.pct)}`}>
                              {cell.score}/{cell.total}
                            </span>
                          ) : (
                            <span className="font-baloo text-xs text-text-muted">—</span>
                          )}
                        </td>
                      ))}
                      <td className="px-md py-sm text-center">
                        {avgPct !== null ? (
                          <span className={`px-sm py-xs rounded-lg font-baloo font-bold text-xs ${scoreColor(avgPct)}`}>
                            {avgPct}%
                          </span>
                        ) : (
                          <span className="font-baloo text-xs text-text-muted">—</span>
                        )}
                      </td>
                      <td className="px-md py-sm text-center font-baloo text-xs text-text-muted">
                        {completedCount}/{classAssignments.length}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              {/* Column footers */}
              <tfoot>
                <tr className="border-t-2 border-divider bg-lavender-light/30">
                  <td className="px-md py-sm sticky left-0 bg-lavender-light/50 font-baloo font-bold text-xs text-text-dark border-r border-divider">
                    Class Avg
                  </td>
                  {colAvgs.map((avg, idx) => (
                    <td key={idx} className="px-md py-sm text-center">
                      {avg !== null ? (
                        <span className={`px-xs py-0.5 rounded font-baloo font-bold text-xs ${scoreColor(avg)}`}>{avg}%</span>
                      ) : (
                        <span className="font-baloo text-xs text-text-muted">—</span>
                      )}
                    </td>
                  ))}
                  <td colSpan={2} />
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Legend */}
          <div className="px-md py-sm border-t border-divider flex items-center gap-md flex-wrap">
            <p className="font-baloo text-xs text-text-muted">Score legend:</p>
            <span className="px-sm py-0.5 bg-success/10 text-success rounded font-baloo font-semibold text-xs">≥80% Good</span>
            <span className="px-sm py-0.5 bg-amber-50 text-amber-600 rounded font-baloo font-semibold text-xs">60–79% Okay</span>
            <span className="px-sm py-0.5 bg-error/10 text-error rounded font-baloo font-semibold text-xs">&lt;60% Needs work</span>
            <span className="px-sm py-0.5 bg-gray-100 text-text-muted rounded font-baloo font-semibold text-xs">— Not submitted</span>
          </div>
        </div>
      )}
    </div>
  );
}
