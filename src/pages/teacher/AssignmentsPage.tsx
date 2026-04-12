import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from '../../stores/authStore';
import { useTeacherStore } from '../../stores/teacherStore';
import { useAssignmentStore } from '../../stores/assignmentStore';
import type { McqAssignmentDoc, McqQuestion, ClassDoc } from '../../types/firestore';
import {
  createMcqAssignment, closeAssignment, publishAssignment,
} from '../../services/firebase/assignments';
import { Timestamp } from 'firebase/firestore';
import GradebookPage from './GradebookPage';

type StatusFilter = 'all' | 'active' | 'draft' | 'closed';

const STATUS_BADGE: Record<string, string> = {
  active: 'bg-success/10 text-success border border-success/20',
  draft: 'bg-amber-50 text-amber-600 border border-amber-200',
  closed: 'bg-gray-100 text-text-muted border border-divider',
};

function formatDate(ts: Timestamp | string | undefined): string {
  if (!ts) return '—';
  if (ts instanceof Timestamp) return ts.toDate().toLocaleDateString();
  return String(ts);
}

function newQuestion(): McqQuestion {
  return {
    id: Math.random().toString(36).slice(2),
    questionText: '',
    options: ['', '', '', ''],
    correctIndices: [],
  };
}

// ---- Create MCQ Assignment Modal ----
interface CreateMcqAssignmentModalProps {
  open: boolean;
  onClose: () => void;
  classes: Array<ClassDoc & { id: string }>;
  teacherUid: string;
  onCreated: () => void;
}

function CreateMcqAssignmentModal({ open, onClose, classes, teacherUid, onCreated }: CreateMcqAssignmentModalProps) {
  const [title, setTitle] = useState('');
  const [classId, setClassId] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [totalPoints, setTotalPoints] = useState(100);
  const [questions, setQuestions] = useState<McqQuestion[]>([newQuestion()]);
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setTitle(''); setClassId(''); setDueDate(''); setTotalPoints(100);
    setQuestions([newQuestion()]);
  };

  const handleClose = () => { reset(); onClose(); };

  const addQuestion = () => setQuestions(prev => [...prev, newQuestion()]);
  const removeQuestion = (idx: number) => setQuestions(prev => prev.filter((_, i) => i !== idx));

  const updateQuestion = (idx: number, updates: Partial<McqQuestion>) =>
    setQuestions(prev => prev.map((q, i) => i === idx ? { ...q, ...updates } : q));

  const updateOption = (qIdx: number, optIdx: number, value: string) =>
    setQuestions(prev => prev.map((q, i) => {
      if (i !== qIdx) return q;
      const opts = [...q.options];
      opts[optIdx] = value;
      return { ...q, options: opts };
    }));

  const toggleCorrect = (qIdx: number, optIdx: number) =>
    setQuestions(prev => prev.map((q, i) => {
      if (i !== qIdx) return q;
      const ci = q.correctIndices.includes(optIdx)
        ? q.correctIndices.filter(x => x !== optIdx)
        : [...q.correctIndices, optIdx];
      return { ...q, correctIndices: ci };
    }));

  const save = async (status: 'draft' | 'active') => {
    if (!title.trim() || !classId) return;
    setSaving(true);
    try {
      const data: Omit<McqAssignmentDoc, 'createdAt'> = {
        title,
        classId,
        teacherUid,
        dueDate: dueDate ? Timestamp.fromDate(new Date(dueDate)) : '',
        totalPoints,
        status,
        questions,
      };
      await createMcqAssignment(data);
      onCreated();
      handleClose();
    } catch {}
    setSaving(false);
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 z-50"
            onClick={handleClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed inset-x-4 top-6 bottom-6 md:inset-x-auto md:left-1/2 md:-translate-x-1/2 md:w-[700px] bg-white rounded-2xl shadow-2xl z-50 flex flex-col overflow-hidden"
          >
            <div className="px-lg py-md border-b border-divider bg-lavender-light/30 flex items-center justify-between">
              <h2 className="font-baloo font-bold text-lg text-text-dark">Create Assignment</h2>
              <button onClick={handleClose} className="w-8 h-8 rounded-full bg-white/60 flex items-center justify-center">✕</button>
            </div>

            <div className="flex-1 overflow-y-auto p-lg space-y-md">
              <div className="grid grid-cols-2 gap-md">
                <div className="col-span-2">
                  <label className="font-baloo font-bold text-sm text-text-dark block mb-xs">Title</label>
                  <input
                    type="text"
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    placeholder="Assignment title…"
                    className="w-full px-md py-sm rounded-xl border border-divider font-baloo text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="font-baloo font-bold text-sm text-text-dark block mb-xs">Class</label>
                  <select
                    value={classId}
                    onChange={e => setClassId(e.target.value)}
                    className="w-full px-md py-sm rounded-xl border border-divider font-baloo text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="">— Select class —</option>
                    {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="font-baloo font-bold text-sm text-text-dark block mb-xs">Due Date</label>
                  <input
                    type="date"
                    value={dueDate}
                    onChange={e => setDueDate(e.target.value)}
                    className="w-full px-md py-sm rounded-xl border border-divider font-baloo text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="font-baloo font-bold text-sm text-text-dark block mb-xs">Total Points</label>
                  <input
                    type="number"
                    min={1}
                    value={totalPoints}
                    onChange={e => setTotalPoints(Number(e.target.value))}
                    className="w-full px-md py-sm rounded-xl border border-divider font-baloo text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>

              {/* Questions */}
              <div>
                <div className="flex items-center justify-between mb-md">
                  <h3 className="font-baloo font-bold text-sm text-text-dark">Questions ({questions.length})</h3>
                  <button
                    onClick={addQuestion}
                    className="px-md py-xs bg-lavender-light text-primary font-baloo font-semibold text-sm rounded-xl hover:bg-primary hover:text-white transition-colors"
                  >
                    + Add Question
                  </button>
                </div>
                <div className="space-y-md">
                  {questions.map((q, qIdx) => (
                    <div key={q.id} className="bg-gray-50 rounded-xl border border-divider p-md">
                      <div className="flex items-start gap-sm mb-sm">
                        <div className="w-6 h-6 rounded-lg bg-primary text-white flex items-center justify-center font-baloo font-bold text-xs shrink-0 mt-1">
                          {qIdx + 1}
                        </div>
                        <input
                          type="text"
                          value={q.questionText}
                          onChange={e => updateQuestion(qIdx, { questionText: e.target.value })}
                          placeholder="Question text…"
                          className="flex-1 px-md py-sm rounded-xl border border-divider font-baloo text-sm focus:outline-none focus:ring-1 focus:ring-primary bg-white"
                        />
                        {questions.length > 1 && (
                          <button onClick={() => removeQuestion(qIdx)} className="text-error hover:bg-rose-50 p-xs rounded-lg text-sm shrink-0">🗑️</button>
                        )}
                      </div>
                      <div className="space-y-xs ml-9">
                        {q.options.map((opt, optIdx) => (
                          <div key={optIdx} className="flex items-center gap-sm">
                            <button
                              onClick={() => toggleCorrect(qIdx, optIdx)}
                              className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                                q.correctIndices.includes(optIdx)
                                  ? 'border-success bg-success text-white'
                                  : 'border-divider bg-white'
                              }`}
                            >
                              {q.correctIndices.includes(optIdx) && <span className="text-[10px]">✓</span>}
                            </button>
                            <input
                              type="text"
                              value={opt}
                              onChange={e => updateOption(qIdx, optIdx, e.target.value)}
                              placeholder={`Option ${optIdx + 1}…`}
                              className={`flex-1 px-sm py-xs rounded-lg border font-baloo text-sm focus:outline-none focus:ring-1 focus:ring-primary bg-white ${
                                q.correctIndices.includes(optIdx) ? 'border-success' : 'border-divider'
                              }`}
                            />
                          </div>
                        ))}
                        <p className="font-baloo text-[11px] text-text-muted">Click the circle to mark correct answer(s)</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="px-lg py-md border-t border-divider flex items-center justify-between">
              <button onClick={handleClose} className="font-baloo font-semibold text-sm text-text-muted hover:text-text-dark">Cancel</button>
              <div className="flex gap-sm">
                <button
                  onClick={() => save('draft')}
                  disabled={saving || !title.trim() || !classId}
                  className="px-md py-sm rounded-xl border-2 border-divider font-baloo font-bold text-sm text-text-muted hover:bg-lavender-light transition-colors disabled:opacity-50"
                >
                  Save as Draft
                </button>
                <button
                  onClick={() => save('active')}
                  disabled={saving || !title.trim() || !classId}
                  className="px-lg py-sm bg-primary text-white font-baloo font-bold text-sm rounded-xl shadow-md hover:bg-primary/90 transition-colors disabled:opacity-50"
                >
                  {saving ? 'Publishing…' : 'Publish'}
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// ---- Main Page ----

export default function AssignmentsPage() {
  const { user } = useAuthStore();
  const { classes, listenToTeacherClasses } = useTeacherStore();
  const { assignments, submissions, loadingAssignments, listenToTeacherAssignments, fetchSubmissionsForAssignment } = useAssignmentStore();

  const [mainTab, setMainTab] = useState<'assignments' | 'gradebook'>('assignments');
  const [selectedClassId, setSelectedClassId] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [showCreate, setShowCreate] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [acting, setActing] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    const unsub1 = listenToTeacherClasses(user.uid);
    const unsub2 = listenToTeacherAssignments(user.uid);
    return () => { unsub1(); unsub2(); };
  }, [user]);

  const allAssignments = Object.entries(assignments)
    .map(([id, a]) => ({ id, ...a }))
    .sort((a, b) => {
      const ta = a.dueDate instanceof Timestamp ? a.dueDate.seconds : 0;
      const tb = b.dueDate instanceof Timestamp ? b.dueDate.seconds : 0;
      return tb - ta;
    });

  const displayed = allAssignments.filter(a => {
    if (selectedClassId !== 'all' && a.classId !== selectedClassId) return false;
    if (statusFilter !== 'all' && a.status !== statusFilter) return false;
    return true;
  });

  const stats = {
    active: allAssignments.filter(a => a.status === 'active').length,
    draft: allAssignments.filter(a => a.status === 'draft').length,
    closed: allAssignments.filter(a => a.status === 'closed').length,
  };

  const handleExpand = async (id: string) => {
    if (expandedId === id) { setExpandedId(null); return; }
    setExpandedId(id);
    if (!submissions[id]) await fetchSubmissionsForAssignment(id);
  };

  const handleClose = async (id: string) => {
    setActing(id);
    try { await closeAssignment(id); } catch {}
    setActing(null);
  };

  const handlePublish = async (id: string) => {
    setActing(id);
    try { await publishAssignment(id); } catch {}
    setActing(null);
  };

  return (
    <div className="space-y-lg">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-md">
        <div>
          <h1 className="font-baloo font-extrabold text-xxl text-text-dark">Assignments 📝</h1>
          <p className="font-baloo text-body text-text-muted">Manage assignments and view gradebook</p>
        </div>
        {mainTab === 'assignments' && (
          <button
            onClick={() => setShowCreate(true)}
            className="px-lg py-sm bg-primary text-white font-baloo font-bold text-md rounded-xl shadow-md hover:bg-primary/90 transition-colors"
          >
            + Create Assignment
          </button>
        )}
      </div>

      {/* Tab switcher */}
      <div className="flex gap-sm">
        {([
          { id: 'assignments', label: 'Assignments', icon: '📝' },
          { id: 'gradebook',   label: 'Gradebook',   icon: '📊' },
        ] as const).map(t => (
          <button
            key={t.id}
            onClick={() => setMainTab(t.id)}
            className={`flex items-center gap-sm px-lg py-sm rounded-xl font-baloo font-bold text-md border-2 transition-all ${
              mainTab === t.id
                ? 'border-primary bg-lavender-light text-primary shadow-sm'
                : 'border-divider bg-white text-text-muted hover:text-text-dark hover:border-primary/30'
            }`}
          >
            <span>{t.icon}</span> {t.label}
          </button>
        ))}
      </div>

      {mainTab === 'gradebook' && <GradebookPage />}
      {mainTab === 'assignments' && (<>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-md">
        {[
          { label: 'Active', value: stats.active, color: 'bg-mint-light', textColor: 'text-secondary' },
          { label: 'Draft', value: stats.draft, color: 'bg-amber-50', textColor: 'text-amber-600' },
          { label: 'Closed', value: stats.closed, color: 'bg-gray-50', textColor: 'text-text-muted' },
        ].map(s => (
          <div key={s.label} className={`${s.color} rounded-2xl border border-divider shadow-sm p-md`}>
            <p className={`font-baloo font-extrabold text-xxl leading-none ${s.textColor}`}>{s.value}</p>
            <p className="font-baloo text-xs text-text-muted mt-xs">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-divider shadow-sm p-md flex items-center gap-md flex-wrap">
        <div>
          <label className="font-baloo font-bold text-xs text-text-dark block mb-xs">Class</label>
          <select
            value={selectedClassId}
            onChange={e => setSelectedClassId(e.target.value)}
            className="px-md py-sm rounded-xl border border-divider font-baloo text-sm focus:outline-none focus:ring-2 focus:ring-primary bg-white min-w-[160px]"
          >
            <option value="all">All Classes</option>
            {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label className="font-baloo font-bold text-xs text-text-dark block mb-xs">Status</label>
          <div className="flex gap-xs bg-gray-50 rounded-xl p-xs border border-divider">
            {(['all', 'active', 'draft', 'closed'] as StatusFilter[]).map(s => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-md py-xs rounded-lg font-baloo font-semibold text-sm capitalize transition-all ${
                  statusFilter === s ? 'bg-primary text-white shadow-sm' : 'text-text-muted hover:text-text-dark'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* List */}
      {loadingAssignments ? (
        <div className="text-center py-xl font-baloo text-text-muted">Loading…</div>
      ) : displayed.length === 0 ? (
        <div className="bg-white rounded-2xl border border-divider shadow-sm p-xl text-center">
          <span className="text-5xl block mb-md">📝</span>
          <p className="font-baloo text-text-muted">No assignments found.</p>
        </div>
      ) : (
        <div className="space-y-sm">
          {displayed.map(a => {
            const cls = classes.find(c => c.id === a.classId);
            const subs = submissions[a.id] ?? [];
            const isExpanded = expandedId === a.id;

            return (
              <div key={a.id} className="bg-white rounded-2xl border border-divider shadow-sm overflow-hidden">
                <div
                  className="p-md cursor-pointer hover:bg-lavender-light/10 transition-colors"
                  onClick={() => handleExpand(a.id)}
                >
                  <div className="flex items-center justify-between gap-md flex-wrap">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-sm mb-xs flex-wrap">
                        <h3 className="font-baloo font-bold text-text-dark">{a.title}</h3>
                        <span className={`px-sm py-0.5 rounded-full font-baloo font-semibold text-xs capitalize ${STATUS_BADGE[a.status] || ''}`}>
                          {a.status}
                        </span>
                      </div>
                      <p className="font-baloo text-sm text-text-muted">
                        {cls?.name ?? a.classId} · Due: {formatDate(a.dueDate)} · {a.questions.length} question{a.questions.length !== 1 ? 's' : ''} · {a.totalPoints} pts
                      </p>
                    </div>
                    <div className="flex items-center gap-sm">
                      <span className="font-baloo text-sm text-text-muted">{subs.length} submissions</span>
                      <span className="text-text-muted transition-transform duration-200" style={{ transform: isExpanded ? 'rotate(180deg)' : 'rotate(0)' }}>▾</span>
                    </div>
                  </div>
                </div>

                <AnimatePresence initial={false}>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="border-t border-divider p-md space-y-md">
                        {/* Questions */}
                        <div>
                          <h4 className="font-baloo font-bold text-sm text-text-dark mb-sm">Questions</h4>
                          <div className="space-y-sm">
                            {a.questions.map((q, idx) => (
                              <div key={q.id} className="bg-gray-50 rounded-xl p-sm border border-divider">
                                <p className="font-baloo font-semibold text-sm text-text-dark mb-xs">{idx + 1}. {q.questionText}</p>
                                <div className="flex flex-wrap gap-xs">
                                  {q.options.map((opt, optIdx) => (
                                    <span
                                      key={optIdx}
                                      className={`px-sm py-xs rounded-lg font-baloo text-xs ${
                                        q.correctIndices.includes(optIdx)
                                          ? 'bg-success/10 text-success border border-success/20 font-semibold'
                                          : 'bg-white border border-divider text-text-muted'
                                      }`}
                                    >
                                      {opt || '—'}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Submissions */}
                        <div>
                          <h4 className="font-baloo font-bold text-sm text-text-dark mb-sm">Submissions ({subs.length})</h4>
                          {subs.length === 0 ? (
                            <p className="font-baloo text-xs text-text-muted">No submissions yet.</p>
                          ) : (
                            <div className="overflow-x-auto rounded-xl border border-divider">
                              <table className="w-full">
                                <thead>
                                  <tr className="bg-lavender-light/50 border-b border-divider">
                                    <th className="px-md py-xs text-left font-baloo font-bold text-xs text-text-dark">Student</th>
                                    <th className="px-md py-xs text-left font-baloo font-bold text-xs text-text-dark">Score</th>
                                    <th className="px-md py-xs text-left font-baloo font-bold text-xs text-text-dark">Submitted</th>
                                    <th className="px-md py-xs text-left font-baloo font-bold text-xs text-text-dark">Status</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {subs.map(sub => (
                                    <tr key={sub.id} className="border-b border-divider last:border-0">
                                      <td className="px-md py-xs font-baloo text-sm text-text-dark">{sub.uid}</td>
                                      <td className="px-md py-xs font-baloo text-sm text-text-muted">
                                        {sub.score !== undefined ? `${sub.score}/${sub.totalPoints}` : '—'}
                                      </td>
                                      <td className="px-md py-xs font-baloo text-sm text-text-muted">{formatDate(sub.submittedAt)}</td>
                                      <td className="px-md py-xs">
                                        <span className={`px-xs py-0.5 rounded-full font-baloo font-semibold text-[10px] capitalize ${STATUS_BADGE[sub.status] || 'bg-gray-100 text-text-muted'}`}>
                                          {sub.status}
                                        </span>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>

                        {/* Actions */}
                        <div className="flex gap-sm">
                          {a.status === 'active' && (
                            <button
                              onClick={() => handleClose(a.id)}
                              disabled={acting === a.id}
                              className="px-md py-sm rounded-xl border-2 border-divider font-baloo font-semibold text-sm text-text-muted hover:bg-gray-50 transition-colors disabled:opacity-50"
                            >
                              {acting === a.id ? '…' : 'Close Assignment'}
                            </button>
                          )}
                          {a.status === 'draft' && (
                            <button
                              onClick={() => handlePublish(a.id)}
                              disabled={acting === a.id}
                              className="px-md py-sm rounded-xl bg-success text-white font-baloo font-bold text-sm hover:bg-success/90 transition-colors shadow-sm disabled:opacity-50"
                            >
                              {acting === a.id ? '…' : 'Publish'}
                            </button>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      )}

      {/* Create modal */}
      {user && (
        <CreateMcqAssignmentModal
          open={showCreate}
          onClose={() => setShowCreate(false)}
          classes={classes}
          teacherUid={user.uid}
          onCreated={() => {}}
        />
      )}
      </>)}
    </div>
  );
}
