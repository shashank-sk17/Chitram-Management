import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from '../../stores/authStore';
import { useAuth } from '../../features/auth/hooks/useAuth';
import { useCurriculumStore } from '../../stores/curriculumStore';
import type { CurriculumEditDoc, LanguageCode } from '../../types/firestore';
import { CurriculumDiffViewer } from '../../components/admin/CurriculumDiffViewer';
import { getAllEdits, approveCurriculumEdit, rejectCurriculumEdit } from '../../services/firebase/curriculumEdits';
import { getLanguageCurriculum, LANGUAGE_LABELS } from '../../services/firebase/languageCurricula';
import { Timestamp } from 'firebase/firestore';

type EditWithId = { id: string } & CurriculumEditDoc;

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

function formatDate(ts: Timestamp | string | undefined): string {
  if (!ts) return '—';
  if (ts instanceof Timestamp) return ts.toDate().toLocaleDateString();
  return String(ts);
}

export default function CurriculumReviewsPage() {
  const { user } = useAuthStore();
  const { claims } = useAuth();
  const { words, fetchWordsByIds } = useCurriculumStore();
  const isProjectAdmin = claims?.role === 'projectAdmin';
  const myProjectId = claims?.projectId;

  const [activeTab, setActiveTab] = useState<'pending' | 'history'>('pending');
  const [edits, setEdits] = useState<EditWithId[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedEdit, setSelectedEdit] = useState<EditWithId | null>(null);
  const [masterLevels, setMasterLevels] = useState<{ levelNum: number; wordIds: string[] }[]>([]);
  const [loadingMaster, setLoadingMaster] = useState(false);

  // Review panel state
  const [rejectNote, setRejectNote] = useState('');
  const [showRejectInput, setShowRejectInput] = useState(false);
  const [reviewing, setReviewing] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const all = await getAllEdits(isProjectAdmin && myProjectId ? myProjectId : undefined);
      setEdits(all.sort((a, b) => {
        const ta = a.submittedAt instanceof Timestamp ? a.submittedAt.seconds : 0;
        const tb = b.submittedAt instanceof Timestamp ? b.submittedAt.seconds : 0;
        return tb - ta;
      }));
      // Preload all word IDs
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
    // Load master curriculum for diff
    setLoadingMaster(true);
    try {
      const master = await getLanguageCurriculum(edit.language, edit.grade);
      setMasterLevels(master?.levels ?? []);
      // Fetch any words not yet loaded
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

  const handleApprove = async () => {
    if (!user || !selectedEdit) return;
    setReviewing(true);
    try {
      await approveCurriculumEdit(selectedEdit.id, user.uid);
      setEdits(prev => prev.map(e => e.id === selectedEdit.id ? { ...e, status: 'approved', reviewedBy: user.uid } : e));
      setSelectedEdit(null);
    } catch {}
    setReviewing(false);
  };

  const handleReject = async () => {
    if (!user || !selectedEdit || !rejectNote.trim()) return;
    setReviewing(true);
    try {
      await rejectCurriculumEdit(selectedEdit.id, user.uid, rejectNote);
      setEdits(prev => prev.map(e => e.id === selectedEdit.id ? { ...e, status: 'rejected', rejectionNote: rejectNote, reviewedBy: user.uid } : e));
      setSelectedEdit(null);
    } catch {}
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
              className="fixed right-0 top-0 h-full w-full max-w-[640px] bg-white shadow-2xl z-50 flex flex-col overflow-hidden"
            >
              {/* Panel header */}
              <div className="px-lg py-md border-b border-divider bg-lavender-light/30">
                <div className="flex items-center justify-between mb-xs">
                  <h2 className="font-baloo font-bold text-lg text-text-dark">{selectedEdit.classId}</h2>
                  <button onClick={() => setSelectedEdit(null)} className="w-8 h-8 rounded-full bg-white/60 flex items-center justify-center">✕</button>
                </div>
                <div className="flex items-center gap-sm flex-wrap">
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
                </div>
                <p className="font-baloo text-xs text-text-muted mt-xs">
                  Submitted by {selectedEdit.teacherUid} · {formatDate(selectedEdit.submittedAt)}
                </p>
              </div>

              {/* Panel body */}
              <div className="flex-1 overflow-y-auto p-lg space-y-lg">
                {/* Pending words */}
                {selectedEdit.pendingWordIds?.length > 0 && (
                  <div>
                    <h3 className="font-baloo font-bold text-sm text-text-dark mb-sm">
                      Pending New Words ({selectedEdit.pendingWordIds.length})
                    </h3>
                    <div className="bg-amber-50 rounded-xl p-md border border-amber-200">
                      <div className="flex flex-wrap gap-sm">
                        {selectedEdit.pendingWordIds.map(id => {
                          const w = words[id];
                          return (
                            <div key={id} className="bg-white rounded-lg px-sm py-xs border border-amber-200 font-baloo text-sm text-text-dark">
                              {w ? (w.word?.en || w.word?.te || id) : id}
                              <span className="ml-xs text-[10px] text-amber-600">⏳ pending</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
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
                    {showRejectInput ? (
                      <div className="space-y-sm">
                        <textarea
                          value={rejectNote}
                          onChange={e => setRejectNote(e.target.value)}
                          placeholder="Rejection reason…"
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
                          <button
                            onClick={handleReject}
                            disabled={!rejectNote.trim() || reviewing}
                            className="flex-1 py-sm rounded-xl bg-error text-white font-baloo font-bold text-sm disabled:opacity-50"
                          >
                            {reviewing ? 'Rejecting…' : 'Confirm Reject'}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex gap-sm">
                        <button
                          onClick={handleApprove}
                          disabled={reviewing}
                          className="flex-1 py-sm rounded-xl bg-success text-white font-baloo font-bold text-sm hover:bg-success/90 transition-colors shadow-sm disabled:opacity-50"
                        >
                          ✓ Approve
                        </button>
                        <button
                          onClick={() => setShowRejectInput(true)}
                          className="flex-1 py-sm rounded-xl border-2 border-error text-error font-baloo font-bold text-sm hover:bg-error hover:text-white transition-colors"
                        >
                          ✕ Reject
                        </button>
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
