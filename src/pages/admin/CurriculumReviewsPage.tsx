import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useAuthStore } from '../../stores/authStore';
import { useAuth } from '../../features/auth/hooks/useAuth';
import { useCurriculumStore } from '../../stores/curriculumStore';
import type { CurriculumEditDoc, LanguageCode, TeacherDoc, WordBankDoc } from '../../types/firestore';
import { CurriculumDiffViewer } from '../../components/admin/CurriculumDiffViewer';
import { getAllEdits, approveCurriculumEdit, rejectCurriculumEdit } from '../../services/firebase/curriculumEdits';
import { getLanguageCurriculum, LANGUAGE_LABELS } from '../../services/firebase/languageCurricula';
import { getWordById, updateWord } from '../../services/firebase/wordBank';
import { sendTeacherNotification } from '../../services/firebase/notifications';
import { Timestamp } from 'firebase/firestore';
import { usePermission } from '../../hooks/usePermission';

type EditWithId = { id: string } & CurriculumEditDoc;
type WordWithId = { id: string } & WordBankDoc;

const LANG_COLORS: Record<LanguageCode, string> = {
  te: 'bg-amber-50 text-amber-700',
  en: 'bg-sky-50 text-sky-700',
  hi: 'bg-orange-50 text-orange-700',
  mr: 'bg-purple-50 text-purple-700',
  es: 'bg-green-50 text-green-700',
  fr: 'bg-blue-50 text-blue-700',
};

const STATUS_BADGE: Record<string, string> = {
  pending: 'bg-amber-50 text-amber-600 border border-amber-200',
  approved: 'bg-success/10 text-success border border-success/20',
  rejected: 'bg-error/10 text-error border border-error/20',
};

const ALL_LANGS: LanguageCode[] = ['te', 'en', 'hi', 'mr', 'es', 'fr'];
const LANG_DISPLAY: Record<LanguageCode, string> = {
  te: 'Telugu', en: 'English', hi: 'Hindi', mr: 'Marathi', es: 'Spanish', fr: 'French',
};

function formatDate(ts: Timestamp | string | undefined): string {
  if (!ts) return '—';
  if (ts instanceof Timestamp) return ts.toDate().toLocaleDateString();
  return String(ts);
}

// ── Pending Word Detail Card ────────────────────────────────────────────────

interface WordDetailCardProps {
  word: WordWithId;
  onSave: (wordId: string, data: Partial<WordBankDoc>) => Promise<void>;
}

function WordDetailCard({ word, onSave }: WordDetailCardProps) {
  const { can } = usePermission();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<Partial<WordBankDoc>>({});

  const startEdit = () => {
    setDraft({
      word: { ...word.word },
      pronunciation: { ...word.pronunciation },
      meaning: { ...word.meaning },
      sentence: { ...word.sentence },
    });
    setEditing(true);
  };

  const cancelEdit = () => {
    setDraft({});
    setEditing(false);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(word.id, draft);
      setEditing(false);
      setDraft({});
    } finally {
      setSaving(false);
    }
  };

  const setField = (
    field: 'word' | 'pronunciation' | 'meaning' | 'sentence',
    lang: LanguageCode,
    value: string,
  ) => {
    setDraft(prev => ({
      ...prev,
      [field]: { ...(prev[field] as Record<LanguageCode, string>), [lang]: value },
    }));
  };

  const displayWord = editing ? (draft.word as Record<LanguageCode, string>) : word.word;
  const displayPronunciation = editing ? (draft.pronunciation as Record<LanguageCode, string>) : word.pronunciation;
  const displayMeaning = editing ? (draft.meaning as Record<LanguageCode, string>) : word.meaning;
  const displaySentence = editing ? (draft.sentence as Record<LanguageCode, string>) : word.sentence;

  return (
    <div className="bg-white rounded-xl border border-amber-200 overflow-hidden shadow-sm">
      {/* Word header */}
      <div className="flex items-start gap-md p-md bg-amber-50/60">
        {word.imageUrl ? (
          <img
            src={word.imageUrl}
            alt={word.word?.en || word.word?.te || ''}
            className="w-16 h-16 rounded-lg object-cover border border-amber-200 flex-shrink-0"
          />
        ) : (
          <div className="w-16 h-16 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0 text-2xl">
            🖼️
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-sm flex-wrap mb-xs">
            <span className="font-baloo font-bold text-text-dark text-md">
              {word.word?.en || word.word?.te || word.id}
            </span>
            <span className="px-xs py-0.5 bg-amber-100 text-amber-700 rounded-full font-baloo text-xs font-semibold">
              ⏳ pending
            </span>
            {word.gradeContext && (
              <span className="px-xs py-0.5 bg-lavender-light text-primary rounded-full font-baloo text-xs">
                Grade {word.gradeContext}
              </span>
            )}
            <span className="px-xs py-0.5 bg-gray-100 text-gray-600 rounded-full font-baloo text-xs">
              {word.wordType}
            </span>
          </div>
          {word.submittedByName && (
            <p className="font-baloo text-xs text-text-muted">
              Submitted by <span className="font-semibold text-text-dark">{word.submittedByName}</span>
              {word.submittedBySchoolName && <> · {word.submittedBySchoolName}</>}
            </p>
          )}
        </div>
        <div className="flex gap-xs flex-shrink-0">
          {!editing ? (
            can('curriculumReviews.edit') && (
              <button
                onClick={startEdit}
                className="px-sm py-xs rounded-lg bg-primary text-white font-baloo font-semibold text-xs hover:bg-primary/90 transition-colors"
              >
                ✏️ Edit
              </button>
            )
          ) : (
            <>
              <button
                onClick={cancelEdit}
                className="px-sm py-xs rounded-lg border border-divider text-text-muted font-baloo text-xs"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-sm py-xs rounded-lg bg-success text-white font-baloo font-semibold text-xs hover:bg-success/90 transition-colors disabled:opacity-50"
              >
                {saving ? 'Saving…' : '✓ Save'}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Language fields grid */}
      <div className="p-md space-y-sm">
        {ALL_LANGS.map(lang => {
          const hasContent = word.word?.[lang] || word.meaning?.[lang];
          if (!hasContent && !editing) return null;
          return (
            <div key={lang} className="rounded-lg border border-divider overflow-hidden">
              <div className={`px-sm py-xs font-baloo font-semibold text-xs ${LANG_COLORS[lang]}`}>
                {LANG_DISPLAY[lang]}
              </div>
              <div className="p-sm grid grid-cols-2 gap-xs">
                {(['word', 'pronunciation', 'meaning', 'sentence'] as const).map(field => {
                  const val = field === 'word' ? displayWord?.[lang]
                    : field === 'pronunciation' ? displayPronunciation?.[lang]
                    : field === 'meaning' ? displayMeaning?.[lang]
                    : displaySentence?.[lang];
                  const label = field.charAt(0).toUpperCase() + field.slice(1);
                  return (
                    <div key={field} className="min-w-0">
                      <p className="font-baloo text-[10px] text-text-muted uppercase tracking-wide mb-0.5">{label}</p>
                      {editing ? (
                        <input
                          type="text"
                          value={(draft[field] as Record<LanguageCode, string>)?.[lang] ?? ''}
                          onChange={e => setField(field, lang, e.target.value)}
                          placeholder={`${label} in ${LANG_DISPLAY[lang]}`}
                          className="w-full text-xs font-baloo border border-divider rounded px-xs py-0.5 focus:outline-none focus:ring-1 focus:ring-primary"
                        />
                      ) : (
                        <p className="font-baloo text-sm text-text-dark truncate">{val || '—'}</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Main Page ───────────────────────────────────────────────────────────────

export default function CurriculumReviewsPage() {
  const { user } = useAuthStore();
  const { claims } = useAuth();
  const { can } = usePermission();
  const { words, fetchWordsByIds } = useCurriculumStore();
  const isProjectAdmin = claims?.role === 'projectAdmin';
  const myProjectId = claims?.projectId;

  const [activeTab, setActiveTab] = useState<'pending' | 'history'>('pending');
  const [edits, setEdits] = useState<EditWithId[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedEdit, setSelectedEdit] = useState<EditWithId | null>(null);
  const [masterLevels, setMasterLevels] = useState<{ levelNum: number; wordIds: string[] }[]>([]);
  const [loadingMaster, setLoadingMaster] = useState(false);

  // Teacher info
  const [teacherInfo, setTeacherInfo] = useState<TeacherDoc | null>(null);
  const [loadingTeacher, setLoadingTeacher] = useState(false);

  // Pending word details
  const [pendingWordDetails, setPendingWordDetails] = useState<WordWithId[]>([]);
  const [loadingWords, setLoadingWords] = useState(false);

  // Review panel state
  const [rejectNote, setRejectNote] = useState('');
  const [showRejectInput, setShowRejectInput] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);

  // Notification after word edit
  const [editAdminNote, setEditAdminNote] = useState('');
  const [showEditNoteInput, setShowEditNoteInput] = useState<string | null>(null); // wordId

  const load = async () => {
    setLoading(true);
    try {
      const all = await getAllEdits(isProjectAdmin && myProjectId ? myProjectId : undefined);
      setEdits(all.sort((a, b) => {
        const ta = a.submittedAt instanceof Timestamp ? a.submittedAt.seconds : 0;
        const tb = b.submittedAt instanceof Timestamp ? b.submittedAt.seconds : 0;
        return tb - ta;
      }));
      const allIds = all.flatMap(e => [
        ...e.proposedLevels.flatMap(l => l.wordIds),
        ...(e.resolvedLevels ?? []).flatMap(l => l.wordIds),
        ...e.pendingWordIds,
      ]);
      if (allIds.length > 0) {
        await fetchWordsByIds([...new Set(allIds)]);
      }
    } catch {}
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const openEdit = async (edit: EditWithId) => {
    setSelectedEdit(edit);
    setShowRejectInput(false);
    setRejectNote('');
    setReviewError(null);
    setTeacherInfo(null);
    setPendingWordDetails([]);
    setShowEditNoteInput(null);
    setEditAdminNote('');

    // Fetch teacher info
    setLoadingTeacher(true);
    try {
      const snap = await getDoc(doc(db, 'teachers', edit.teacherUid));
      if (snap.exists()) setTeacherInfo(snap.data() as TeacherDoc);
    } catch {}
    setLoadingTeacher(false);

    // Fetch full pending word details
    if (edit.pendingWordIds?.length > 0) {
      setLoadingWords(true);
      try {
        const details = await Promise.all(edit.pendingWordIds.map(id => getWordById(id)));
        setPendingWordDetails(details.filter((w): w is WordWithId => w !== null));
      } catch {}
      setLoadingWords(false);
    }

    // Load master curriculum for diff
    setLoadingMaster(true);
    try {
      const master = await getLanguageCurriculum(edit.language, edit.grade);
      setMasterLevels(master?.levels ?? []);
      const needed = [
        ...(master?.levels ?? []).flatMap(l => l.wordIds),
        ...edit.proposedLevels.flatMap(l => l.wordIds),
        ...edit.pendingWordIds,
      ];
      const missing = [...new Set(needed)].filter(id => !words[id]);
      if (missing.length > 0) {
        await fetchWordsByIds(missing);
      }
    } catch {}
    setLoadingMaster(false);
  };

  const handleWordSave = useCallback(async (wordId: string, data: Partial<WordBankDoc>) => {
    await updateWord(wordId, data);
    // Update local state
    setPendingWordDetails(prev =>
      prev.map(w => w.id === wordId ? { ...w, ...data } : w)
    );
    // Show note input to optionally notify teacher
    setShowEditNoteInput(wordId);
  }, []);

  const handleSendEditNotification = async (wordId: string) => {
    if (!selectedEdit) return;
    const wordDetail = pendingWordDetails.find(w => w.id === wordId);
    const wordLabel = wordDetail?.word?.en || wordDetail?.word?.te || wordId;
    await sendTeacherNotification(selectedEdit.teacherUid, {
      type: 'word_edited',
      classId: selectedEdit.classId,
      editId: selectedEdit.id,
      wordId,
      message: `Admin edited your word "${wordLabel}".${editAdminNote ? ` Note: ${editAdminNote}` : ''}`,
      adminNote: editAdminNote || undefined,
    });
    setShowEditNoteInput(null);
    setEditAdminNote('');
  };

  const handleApprove = async () => {
    if (!user || !selectedEdit) return;
    setReviewing(true);
    setReviewError(null);
    try {
      await approveCurriculumEdit(selectedEdit.id, user.uid);
      // Update UI immediately
      setEdits(prev => prev.map(e =>
        e.id === selectedEdit.id ? { ...e, status: 'approved', reviewedBy: user.uid } : e
      ));
      setSelectedEdit(null);
      // Notify teacher in background — don't block or fail the approval
      sendTeacherNotification(selectedEdit.teacherUid, {
        type: 'curriculum_approved',
        classId: selectedEdit.classId,
        editId: selectedEdit.id,
        message: 'Your curriculum proposal has been approved! Your class will now use the updated word list.',
      }).catch(() => {});
    } catch (e: any) {
      setReviewError(e?.message ?? 'Failed to approve. Please try again.');
    }
    setReviewing(false);
  };

  const handleReject = async () => {
    if (!user || !selectedEdit || !rejectNote.trim()) return;
    setReviewing(true);
    setReviewError(null);
    try {
      await rejectCurriculumEdit(selectedEdit.id, user.uid, rejectNote);
      // Update UI immediately
      setEdits(prev => prev.map(e =>
        e.id === selectedEdit.id ? { ...e, status: 'rejected', rejectionNote: rejectNote, reviewedBy: user.uid } : e
      ));
      setSelectedEdit(null);
      // Notify teacher in background
      sendTeacherNotification(selectedEdit.teacherUid, {
        type: 'curriculum_rejected',
        classId: selectedEdit.classId,
        editId: selectedEdit.id,
        message: `Your curriculum proposal was not approved. Reason: ${rejectNote}`,
        adminNote: rejectNote,
      }).catch(() => {});
    } catch (e: any) {
      setReviewError(e?.message ?? 'Failed to reject. Please try again.');
    }
    setReviewing(false);
  };

  const displayed = edits.filter(e =>
    activeTab === 'pending' ? e.status === 'pending' : e.status !== 'pending'
  );

  return (
    <div className="space-y-lg">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-baloo font-extrabold text-xxl text-text-dark">Curriculum Reviews</h1>
          <p className="font-baloo text-text-muted">
            {isProjectAdmin ? 'Reviewing teacher proposals within your project' : 'Review teacher curriculum proposals across all projects'}
          </p>
        </div>
        <div className="flex items-center gap-sm bg-white rounded-xl px-md py-sm shadow-sm border border-divider">
          <span className="text-2xl">📋</span>
          <div>
            <p className="font-baloo font-bold text-lg text-text-dark">{edits.filter(e => e.status === 'pending').length}</p>
            <p className="font-baloo text-xs text-text-muted">pending reviews</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-xs bg-white rounded-xl p-xs shadow-sm border border-divider w-fit">
        {(['pending', 'history'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-md py-xs rounded-lg font-baloo font-semibold text-sm capitalize transition-all ${
              activeTab === tab ? 'bg-primary text-white shadow-sm' : 'text-text-muted hover:text-text-dark'
            }`}
          >
            {tab === 'pending' ? 'Pending Reviews' : 'History'}
            {tab === 'pending' && edits.filter(e => e.status === 'pending').length > 0 && (
              <span className={`ml-xs text-[11px] px-xs py-0.5 rounded-full ${
                activeTab === tab ? 'bg-white/20 text-white' : 'bg-amber-100 text-amber-600'
              }`}>
                {edits.filter(e => e.status === 'pending').length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center py-xl text-text-muted font-baloo">Loading…</div>
      ) : displayed.length === 0 ? (
        <div className="bg-white rounded-2xl border border-divider shadow-sm p-xl text-center">
          <span className="text-5xl block mb-md">{activeTab === 'pending' ? '✅' : '📭'}</span>
          <p className="font-baloo text-text-muted">
            {activeTab === 'pending' ? 'No pending reviews!' : 'No review history yet.'}
          </p>
        </div>
      ) : (
        <div className="space-y-sm">
          {displayed.map(edit => {
            const pendingCount = edit.pendingWordIds?.length ?? 0;
            return (
              <motion.div
                key={edit.id}
                layout
                className="bg-white rounded-2xl border border-divider shadow-sm p-md cursor-pointer hover:border-primary/40 transition-colors"
                onClick={() => openEdit(edit)}
              >
                <div className="flex items-start justify-between gap-md flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-sm flex-wrap mb-xs">
                      <span className="font-baloo font-bold text-text-dark truncate">{edit.classId}</span>
                      <span className={`px-sm py-0.5 rounded-full font-baloo font-semibold text-xs ${LANG_COLORS[edit.language] || 'bg-gray-100 text-gray-600'}`}>
                        {LANGUAGE_LABELS[edit.language] || edit.language}
                      </span>
                      <span className="px-sm py-0.5 bg-lavender-light text-primary rounded-full font-baloo font-semibold text-xs">
                        Grade {edit.grade}
                      </span>
                      {edit.shareWithProject && (
                        <span className="px-sm py-0.5 bg-mint-light text-secondary rounded-full font-baloo font-semibold text-xs">
                          Shared with Project
                        </span>
                      )}
                      {pendingCount > 0 && (
                        <span className="px-sm py-0.5 bg-amber-50 text-amber-600 rounded-full font-baloo font-semibold text-xs border border-amber-200">
                          {pendingCount} pending word{pendingCount !== 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                    <p className="font-baloo text-sm text-text-muted">
                      Teacher: {edit.teacherUid} · Submitted: {formatDate(edit.submittedAt)}
                    </p>
                    {edit.status !== 'pending' && edit.rejectionNote && (
                      <p className="font-baloo text-xs text-error mt-xs italic">Note: {edit.rejectionNote}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-sm">
                    <span className={`px-sm py-xs rounded-full font-baloo font-semibold text-xs capitalize ${STATUS_BADGE[edit.status] || ''}`}>
                      {edit.status}
                    </span>
                    {edit.status !== 'pending' && (
                      <span className="font-baloo text-xs text-text-muted">
                        {formatDate(edit.reviewedAt)}
                      </span>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Review Panel Modal */}
      <AnimatePresence>
        {selectedEdit && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/40 z-50"
              onClick={() => setSelectedEdit(null)}
            />
            <motion.div
              initial={{ opacity: 0, x: 80 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 80 }}
              transition={{ type: 'spring', damping: 28, stiffness: 280 }}
              className="fixed right-0 top-0 h-full w-full max-w-[680px] bg-white shadow-2xl z-50 flex flex-col overflow-hidden"
            >
              {/* Panel header */}
              <div className="px-lg py-md border-b border-divider bg-lavender-light/30">
                <div className="flex items-start justify-between mb-xs gap-md">
                  <div className="flex-1 min-w-0">
                    <h2 className="font-baloo font-bold text-lg text-text-dark truncate">{selectedEdit.classId}</h2>
                    {/* Teacher info */}
                    {loadingTeacher ? (
                      <p className="font-baloo text-xs text-text-muted mt-xs">Loading teacher info…</p>
                    ) : teacherInfo ? (
                      <div className="mt-xs bg-white/70 rounded-lg px-sm py-xs border border-divider inline-flex flex-col gap-0.5">
                        <p className="font-baloo text-sm font-semibold text-text-dark">
                          👤 {teacherInfo.name}
                        </p>
                        <p className="font-baloo text-xs text-text-muted">
                          {teacherInfo.email}
                          {teacherInfo.school && <> · {teacherInfo.school}</>}
                          {teacherInfo.projectId && <> · Project: {teacherInfo.projectId}</>}
                        </p>
                      </div>
                    ) : (
                      <p className="font-baloo text-xs text-text-muted mt-xs">
                        Teacher UID: {selectedEdit.teacherUid}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => setSelectedEdit(null)}
                    className="w-8 h-8 rounded-full bg-white/60 flex items-center justify-center flex-shrink-0"
                  >
                    ✕
                  </button>
                </div>
                <div className="flex items-center gap-sm flex-wrap mt-sm">
                  <span className={`px-sm py-0.5 rounded-full font-baloo font-semibold text-xs ${LANG_COLORS[selectedEdit.language] || ''}`}>
                    {LANGUAGE_LABELS[selectedEdit.language]}
                  </span>
                  <span className="px-sm py-0.5 bg-lavender-light text-primary rounded-full font-baloo font-semibold text-xs">Grade {selectedEdit.grade}</span>
                  <span className={`px-sm py-0.5 rounded-full font-baloo font-semibold text-xs capitalize ${STATUS_BADGE[selectedEdit.status] || ''}`}>
                    {selectedEdit.status}
                  </span>
                  {selectedEdit.shareWithProject && (
                    <span className="px-sm py-0.5 bg-mint-light text-secondary rounded-full font-baloo font-semibold text-xs">Shared with Project</span>
                  )}
                  <span className="font-baloo text-xs text-text-muted ml-auto">
                    Submitted {formatDate(selectedEdit.submittedAt)}
                  </span>
                </div>
              </div>

              {/* Panel body */}
              <div className="flex-1 overflow-y-auto p-lg space-y-lg">

                {/* Pending words — full detail cards */}
                {selectedEdit.pendingWordIds?.length > 0 && (
                  <div>
                    <h3 className="font-baloo font-bold text-sm text-text-dark mb-sm">
                      New Words Submitted ({selectedEdit.pendingWordIds.length})
                    </h3>
                    {loadingWords ? (
                      <div className="text-center py-md font-baloo text-text-muted text-sm">Loading word details…</div>
                    ) : (
                      <div className="space-y-sm">
                        {pendingWordDetails.map(w => (
                          <div key={w.id}>
                            <WordDetailCard word={w} onSave={handleWordSave} />
                            {/* Notify teacher after edit */}
                            {showEditNoteInput === w.id && (
                              <div className="mt-xs bg-sky-50 rounded-xl border border-sky-200 p-sm space-y-xs">
                                <p className="font-baloo text-xs font-semibold text-sky-700">
                                  Word saved. Optionally add a note to notify the teacher:
                                </p>
                                <input
                                  type="text"
                                  value={editAdminNote}
                                  onChange={e => setEditAdminNote(e.target.value)}
                                  placeholder="Admin note (optional)…"
                                  className="w-full text-xs font-baloo border border-sky-200 rounded px-sm py-xs focus:outline-none focus:ring-1 focus:ring-primary"
                                />
                                <div className="flex gap-xs">
                                  <button
                                    onClick={() => { setShowEditNoteInput(null); setEditAdminNote(''); }}
                                    className="flex-1 py-xs rounded-lg border border-divider font-baloo text-xs text-text-muted"
                                  >
                                    Skip
                                  </button>
                                  <button
                                    onClick={() => handleSendEditNotification(w.id)}
                                    className="flex-1 py-xs rounded-lg bg-primary text-white font-baloo font-semibold text-xs"
                                  >
                                    Notify Teacher
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                        {/* Fallback for IDs not fetched */}
                        {selectedEdit.pendingWordIds
                          .filter(id => !pendingWordDetails.find(w => w.id === id))
                          .map(id => (
                            <div key={id} className="bg-amber-50 rounded-xl border border-amber-200 p-sm font-baloo text-sm text-amber-700">
                              {id} <span className="text-xs opacity-60">— not found</span>
                            </div>
                          ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Diff viewer */}
                <div>
                  <h3 className="font-baloo font-bold text-sm text-text-dark mb-sm">Curriculum Diff (Master vs Proposed)</h3>
                  {loadingMaster ? (
                    <div className="text-center py-lg font-baloo text-text-muted">Loading diff…</div>
                  ) : (
                    <CurriculumDiffViewer
                      masterLevels={masterLevels}
                      proposedLevels={selectedEdit.proposedLevels}
                      words={words}
                      learningLanguage={selectedEdit.language}
                    />
                  )}
                </div>

                {/* Review actions for pending */}
                {selectedEdit.status === 'pending' && (
                  <div className="border-t border-divider pt-md">
                    <h3 className="font-baloo font-bold text-sm text-text-dark mb-sm">Review Decision</h3>
                    {reviewError && (
                      <div className="mb-sm bg-error/10 border border-error/20 rounded-xl px-md py-sm font-baloo text-sm text-error">
                        {reviewError}
                      </div>
                    )}
                    {showRejectInput ? (
                      <div className="space-y-sm">
                        <textarea
                          value={rejectNote}
                          onChange={e => setRejectNote(e.target.value)}
                          placeholder="Rejection reason (teacher will be notified)…"
                          rows={3}
                          className="w-full px-md py-sm rounded-xl border border-divider font-baloo text-sm focus:outline-none focus:ring-1 focus:ring-error"
                        />
                        <div className="flex gap-sm">
                          <button
                            onClick={() => setShowRejectInput(false)}
                            className="flex-1 py-sm rounded-xl border-2 border-divider font-baloo font-semibold text-sm text-text-muted"
                          >
                            Cancel
                          </button>
                          {can('curriculumReviews.reject') && (
                            <button
                              onClick={handleReject}
                              disabled={!rejectNote.trim() || reviewing}
                              className="flex-1 py-sm rounded-xl bg-error text-white font-baloo font-bold text-sm disabled:opacity-50"
                            >
                              {reviewing ? 'Rejecting…' : 'Confirm Reject & Notify Teacher'}
                            </button>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="flex gap-sm">
                        {can('curriculumReviews.approve') && (
                          <button
                            onClick={handleApprove}
                            disabled={reviewing}
                            className="flex-1 py-sm rounded-xl bg-success text-white font-baloo font-bold text-sm hover:bg-success/90 transition-colors shadow-sm disabled:opacity-50"
                          >
                            ✓ Approve
                          </button>
                        )}
                        {can('curriculumReviews.reject') && (
                          <button
                            onClick={() => setShowRejectInput(true)}
                            className="flex-1 py-sm rounded-xl border-2 border-error text-error font-baloo font-bold text-sm hover:bg-error hover:text-white transition-colors"
                          >
                            ✕ Reject
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* History — show reviewer info */}
                {selectedEdit.status !== 'pending' && selectedEdit.reviewedBy && (
                  <div className="bg-gray-50 rounded-xl p-md border border-divider">
                    <p className="font-baloo text-sm text-text-muted">
                      Reviewed by <span className="font-semibold text-text-dark">{selectedEdit.reviewedBy}</span> on {formatDate(selectedEdit.reviewedAt)}
                    </p>
                    {selectedEdit.rejectionNote && (
                      <p className="font-baloo text-sm text-error mt-xs italic">"{selectedEdit.rejectionNote}"</p>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
