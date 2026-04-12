import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../../features/auth/hooks/useAuth';
import { useTeacherStore } from '../../stores/teacherStore';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { PendingStudentsModal } from '../../components/teacher/PendingStudentsModal';
import { EditLanguagesModal } from '../../components/teacher/EditLanguagesModal';
import { deleteClass } from '../../services/firebase/teacher';
import {
  getAnnouncementsForClass,
  createAnnouncement,
} from '../../services/firebase/announcements';
import { useAssignmentStore } from '../../stores/assignmentStore';
import type { StudentDoc, AnnouncementDoc } from '../../types/firestore';

function CopyCodeButton({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  function handleCopy() {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }
  return (
    <button
      onClick={handleCopy}
      className={`flex items-center gap-xs px-md py-sm rounded-full font-baloo font-semibold text-sm transition-all ${
        copied
          ? 'bg-secondary text-white'
          : 'bg-lavender-light text-primary hover:bg-primary hover:text-white'
      }`}
    >
      <span>{copied ? '✓' : '📋'}</span>
      {code}
    </button>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    active:    'bg-mint-light text-secondary border border-secondary/30',
    upcoming:  'bg-lavender-light text-primary border border-primary/30',
    completed: 'bg-divider text-text-muted border border-divider',
  };
  return (
    <span className={`font-baloo text-xs font-semibold px-sm py-xs rounded-full ${styles[status] ?? styles.completed}`}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

export default function ClassDetailPage() {
  const { classId } = useParams<{ classId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { listenToTeacherAssignments, getAssignmentsForClass } = useAssignmentStore();
  const {
    classes,
    listenToTeacherClasses,
    listenToClassStudents,
    getStudentsForClass,
    getPendingStudentsForClass,
    loadingClasses,
  } = useTeacherStore();

  const [showPending, setShowPending] = useState(false);
  const [showEditLanguages, setShowEditLanguages] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [tab, setTab] = useState<'students' | 'curriculum' | 'assignments' | 'announcements'>('students');

  // Announcements state
  const [announcements, setAnnouncements] = useState<Array<{ id: string } & AnnouncementDoc>>([]);
  const [loadingAnnouncements, setLoadingAnnouncements] = useState(false);
  const [announceTitle, setAnnounceTitle] = useState('');
  const [announceBody, setAnnounceBody] = useState('');
  const [posting, setPosting] = useState(false);

  // Ensure store is populated if navigated directly
  useEffect(() => {
    if (!user) return;
    const unsubClasses = listenToTeacherClasses(user.uid);
    const unsubAssignments = listenToTeacherAssignments(user.uid);
    return () => {
      unsubClasses();
      unsubAssignments();
    };
  }, [user]);

  useEffect(() => {
    if (!classId) return;
    const unsub = listenToClassStudents(classId);
    return unsub;
  }, [classId]);

  useEffect(() => {
    if (tab === 'announcements' && classId) {
      loadAnnouncements();
    }
  }, [tab, classId]);

  async function loadAnnouncements() {
    if (!classId) return;
    setLoadingAnnouncements(true);
    try {
      const data = await getAnnouncementsForClass(classId);
      setAnnouncements(data);
    } catch (e) {
      console.error('Error loading announcements:', e);
    } finally {
      setLoadingAnnouncements(false);
    }
  }

  async function handlePostAnnouncement() {
    if (!classId || !user || !announceTitle.trim() || !announceBody.trim()) return;
    setPosting(true);
    try {
      await createAnnouncement({
        classId,
        teacherUid: user.uid,
        teacherName: user.displayName || user.email || 'Teacher',
        title: announceTitle.trim(),
        body: announceBody.trim(),
        pinned: false,
      });
      setAnnounceTitle('');
      setAnnounceBody('');
      await loadAnnouncements();
    } catch (e) {
      console.error('Error posting announcement:', e);
    } finally {
      setPosting(false);
    }
  }

  const classData = classes.find(c => c.id === classId);
  const approvedStudents: Array<StudentDoc & { id: string }> = classId ? getStudentsForClass(classId) : [];
  const pendingStudents: Array<StudentDoc & { id: string }> = classId ? getPendingStudentsForClass(classId) : [];
  const classAssignments = classId ? getAssignmentsForClass(classId) : [];

  if (loadingClasses) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!classData) {
    return (
      <div className="max-w-3xl mx-auto text-center py-xxl">
        <span className="text-6xl block mb-md">🔍</span>
        <h2 className="font-baloo font-bold text-xl text-text-dark mb-sm">Class Not Found</h2>
        <p className="font-baloo text-md text-text-muted mb-lg">
          This class doesn't exist or you don't have access to it.
        </p>
        <Button title="Back to Classes" onPress={() => navigate('/teacher/classes')} variant="primary" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto">
      {/* Back nav */}
      <button
        onClick={() => navigate('/teacher/classes')}
        className="flex items-center gap-xs font-baloo text-sm text-text-muted hover:text-primary transition-colors mb-lg"
      >
        ← Back to Classes
      </button>

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="mb-xl"
      >
        <Card className="bg-lavender-light/30 border border-primary/10">
          <div className="flex flex-col sm:flex-row sm:items-center gap-md">
            <div className="w-16 h-16 rounded-2xl bg-white flex items-center justify-center shadow-sm flex-shrink-0">
              <span className="text-3xl">🏫</span>
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="font-baloo font-bold text-xl sm:text-xxl text-text-dark mb-xs">
                {classData.name}
              </h1>
              <div className="flex items-center gap-sm flex-wrap">
                <p className="font-baloo text-md text-text-muted">Grade {classData.grade}</p>
                {classData.homeLanguage && classData.learningLanguage && (
                  <div className="flex items-center gap-xs">
                    <span className="font-baloo text-xs bg-white/70 border border-primary/20 text-primary px-sm py-xs rounded-full font-semibold">
                      {classData.homeLanguage.toUpperCase()} → {classData.learningLanguage.toUpperCase()}
                    </span>
                    <button
                      onClick={() => setShowEditLanguages(true)}
                      className="text-text-muted hover:text-primary transition-colors text-sm"
                      title="Edit languages"
                    >
                      ✏
                    </button>
                  </div>
                )}
              </div>
            </div>
            <div className="flex flex-col items-start sm:items-end gap-sm">
              <div className="flex items-center gap-xs">
                <span className="font-baloo text-xs text-text-muted">Class Code:</span>
                <CopyCodeButton code={classData.code} />
              </div>
              {!showDeleteConfirm ? (
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="font-baloo text-xs text-error/70 hover:text-error transition-colors"
                >
                  Delete class
                </button>
              ) : (
                <div className="flex items-center gap-xs bg-rose-light border border-error/30 rounded-lg px-sm py-xs">
                  <span className="font-baloo text-xs text-error">Delete permanently?</span>
                  <button
                    onClick={async () => {
                      setDeleting(true);
                      await deleteClass(classId!);
                      navigate('/teacher/classes');
                    }}
                    disabled={deleting}
                    className="font-baloo text-xs font-bold text-error hover:underline disabled:opacity-50"
                  >
                    {deleting ? 'Deleting...' : 'Yes, delete'}
                  </button>
                  <button
                    onClick={() => setShowDeleteConfirm(false)}
                    className="font-baloo text-xs text-text-muted hover:text-text-dark"
                  >
                    Cancel
                  </button>
                </div>
              )}
              {pendingStudents.length > 0 && (
                <button
                  onClick={() => setShowPending(true)}
                  className="flex items-center gap-xs px-md py-sm rounded-full bg-warning/10 border-2 border-warning font-baloo text-sm font-semibold text-warning hover:bg-warning hover:text-white transition-all"
                >
                  ⚠️ {pendingStudents.length} Pending Approval
                </button>
              )}
            </div>
          </div>
        </Card>
      </motion.div>

      {/* Stats row */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.1 }}
        className="grid grid-cols-2 sm:grid-cols-4 gap-sm sm:gap-md mb-xl"
      >
        {[
          { label: 'Students',           value: approvedStudents.length,                          icon: '👨‍🎓', color: 'from-lavender-light to-primary/10' },
          { label: 'Pending',            value: pendingStudents.length,                            icon: '⏳', color: 'from-peach-light to-accent/10' },
          { label: 'Active Assignments', value: classAssignments.filter(a => a.status === 'active').length,    icon: '📝', color: 'from-mint-light to-secondary/10' },
          { label: 'Closed',             value: classAssignments.filter(a => a.status === 'closed').length,     icon: '✅', color: 'from-lavender-light to-secondary/10' },
        ].map((stat, i) => (
          <motion.div key={stat.label} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.1 + i * 0.05 }}>
            <Card className={`bg-gradient-to-br ${stat.color}`}>
              <div className="text-center">
                <span className="text-2xl block mb-xs">{stat.icon}</span>
                <p className="font-baloo font-extrabold text-xxl text-text-dark">{stat.value}</p>
                <p className="font-baloo text-xs text-text-muted leading-tight">{stat.label}</p>
              </div>
            </Card>
          </motion.div>
        ))}
      </motion.div>

      {/* Tabs */}
      <div className="flex gap-sm mb-lg border-b-2 border-divider overflow-x-auto">
        {([ 'students', 'curriculum', 'assignments', 'announcements'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`font-baloo font-semibold text-md pb-sm px-sm border-b-2 -mb-[2px] transition-colors capitalize whitespace-nowrap ${
              tab === t
                ? 'border-primary text-primary'
                : 'border-transparent text-text-muted hover:text-text-dark'
            }`}
          >
            {t === 'students'      ? `Students (${approvedStudents.length})`
             : t === 'curriculum'   ? 'Curriculum'
             : t === 'assignments'  ? `Assignments (${classAssignments.length})`
             :                       'Announcements'}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <motion.div key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>

        {/* ── Students tab ── */}
        {tab === 'students' && (
          approvedStudents.length === 0 ? (
            <Card className="text-center py-xl">
              <span className="text-5xl block mb-md">👋</span>
              <h3 className="font-baloo font-bold text-lg text-text-dark mb-sm">No students yet</h3>
              <p className="font-baloo text-sm text-text-muted">
                Share the class code <span className="font-bold text-primary">{classData.code}</span> with your students to let them join.
              </p>
            </Card>
          ) : (
            <div className="flex flex-col gap-sm">
              {approvedStudents.map(student => (
                <Card key={student.id} className="bg-white hover:shadow-md transition-shadow">
                  <div className="flex items-center gap-md">
                    <div
                      className="w-11 h-11 rounded-full flex items-center justify-center font-baloo font-bold text-white flex-shrink-0"
                      style={{ backgroundColor: student.avatarColor || '#7C81FF' }}
                    >
                      {(student.name || student.email || '?')[0].toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-baloo font-bold text-md text-text-dark truncate">{student.name || 'Unnamed'}</p>
                      <p className="font-baloo text-sm text-text-muted truncate">{student.email}</p>
                      <div className="flex gap-md mt-xs flex-wrap">
                        {student.grade && (
                          <span className="font-baloo text-xs text-text-muted">Grade {student.grade}</span>
                        )}
                        {student.activeLearningLanguage && (
                          <span className="font-baloo text-xs bg-lavender-light text-primary px-sm py-xs rounded-full">
                            {student.activeLearningLanguage.toUpperCase()}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="font-baloo font-bold text-lg text-secondary">
                        {student.analytics?.averageAccuracy ?? 0}%
                      </p>
                      <p className="font-baloo text-xs text-text-muted">accuracy</p>
                      <p className="font-baloo text-xs text-text-muted">
                        {student.analytics?.totalWordsLearned ?? 0} words
                      </p>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )
        )}

        {/* ── Curriculum tab ── */}
        {tab === 'curriculum' && classId && (
          <div className="flex flex-col gap-md">
            <div className="flex items-center justify-between flex-wrap gap-sm">
              <div>
                <h2 className="font-baloo font-bold text-lg text-text-dark">
                  Grade {classData.grade} Curriculum — {classData.name}
                </h2>
                <p className="font-baloo text-sm text-text-muted">
                  Customise which words kids in this class see. Changes apply on next sign-in.
                </p>
              </div>
              <Button
                title="Go to Curriculum Editor"
                onPress={() => navigate('/teacher/curriculum-editor', { state: { classId } })}
                variant="primary"
                size="sm"
                icon={<span>✏️</span>}
              />
            </div>
          </div>
        )}

        {/* ── Announcements tab ── */}
        {tab === 'announcements' && classId && (
          <div className="flex flex-col gap-md">
            {/* Compose form */}
            <Card className="bg-white">
              <h3 className="font-baloo font-bold text-md text-text-dark mb-md">New Announcement</h3>
              <div className="space-y-sm">
                <input
                  type="text"
                  value={announceTitle}
                  onChange={e => setAnnounceTitle(e.target.value)}
                  placeholder="Title"
                  className="w-full px-md py-sm rounded-xl border border-divider font-baloo text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <textarea
                  value={announceBody}
                  onChange={e => setAnnounceBody(e.target.value)}
                  placeholder="Write your message to students and parents…"
                  rows={3}
                  className="w-full px-md py-sm rounded-xl border border-divider font-baloo text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                />
                <div className="flex justify-end">
                  <button
                    onClick={handlePostAnnouncement}
                    disabled={posting || !announceTitle.trim() || !announceBody.trim()}
                    className="px-lg py-sm bg-primary text-white font-baloo font-bold text-sm rounded-xl hover:bg-primary/90 transition-colors disabled:opacity-50"
                  >
                    {posting ? 'Posting…' : 'Post Announcement'}
                  </button>
                </div>
              </div>
            </Card>

            {/* Announcement list */}
            {loadingAnnouncements ? (
              <div className="flex justify-center py-lg">
                <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : announcements.length === 0 ? (
              <Card className="text-center py-xl">
                <span className="text-5xl block mb-md">📢</span>
                <h3 className="font-baloo font-bold text-lg text-text-dark mb-sm">No announcements yet</h3>
                <p className="font-baloo text-sm text-text-muted">
                  Post your first announcement above.
                </p>
              </Card>
            ) : (
              <div className="space-y-sm">
                {announcements.map(ann => (
                  <Card key={ann.id} className={`bg-white ${ann.pinned ? 'border border-primary/30 bg-lavender-light/20' : ''}`}>
                    <div className="flex items-start justify-between gap-md">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-xs mb-xs">
                          {ann.pinned && (
                            <span className="font-baloo text-xs bg-lavender-light text-primary px-xs py-0.5 rounded-full font-semibold">
                              📌 Pinned
                            </span>
                          )}
                          <p className="font-baloo font-bold text-md text-text-dark">{ann.title}</p>
                        </div>
                        <p className="font-baloo text-sm text-text-muted whitespace-pre-line">{ann.body}</p>
                        <p className="font-baloo text-xs text-text-muted mt-sm">
                          By {ann.teacherName}
                        </p>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Assignments tab ── */}
        {tab === 'assignments' && (
          classAssignments.length === 0 ? (
            <Card className="text-center py-xl">
              <span className="text-5xl block mb-md">📋</span>
              <h3 className="font-baloo font-bold text-lg text-text-dark mb-sm">No assignments yet</h3>
              <p className="font-baloo text-sm text-text-muted mb-lg">
                Create an assignment for this class from the Assignments tab.
              </p>
              <Button title="Go to Assignments" onPress={() => navigate('/teacher/assignments')} variant="outline" size="sm" />
            </Card>
          ) : (
            <div className="flex flex-col gap-sm">
              {classAssignments.map(assignment => (
                <Card key={assignment.id} className="bg-white hover:shadow-md transition-shadow">
                  <div className="flex items-center gap-md">
                    <div className="w-10 h-10 rounded-xl bg-lavender-light flex items-center justify-center flex-shrink-0">
                      <span className="text-xl">📝</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-sm mb-xs">
                        <p className="font-baloo font-bold text-md text-text-dark">{assignment.title}</p>
                        <StatusBadge status={assignment.status} />
                      </div>
                      <p className="font-baloo text-sm text-text-muted">
                        Due: {typeof assignment.dueDate === 'string' ? assignment.dueDate : assignment.dueDate?.toDate?.()?.toLocaleDateString?.() ?? '—'}
                        {' · '}{assignment.questions?.length ?? 0} questions
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="font-baloo text-xs text-text-muted">{assignment.totalPoints} pts</p>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )
        )}
      </motion.div>

      {/* Pending students modal */}
      {classId && (
        <PendingStudentsModal
          isOpen={showPending}
          onClose={() => setShowPending(false)}
          classId={classId}
          className={classData.name}
        />
      )}

      {/* Edit languages modal */}
      {classId && classData.homeLanguage && classData.learningLanguage && (
        <EditLanguagesModal
          isOpen={showEditLanguages}
          onClose={() => setShowEditLanguages(false)}
          classId={classId}
          currentHomeLanguage={classData.homeLanguage}
          currentLearningLanguage={classData.learningLanguage}
        />
      )}
    </div>
  );
}
