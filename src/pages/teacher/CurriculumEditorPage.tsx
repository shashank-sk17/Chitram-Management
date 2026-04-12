import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from '../../stores/authStore';
import { useTeacherStore } from '../../stores/teacherStore';
import { useCurriculumStore } from '../../stores/curriculumStore';
import type { LanguageCode, CurriculumLevel, ClassDoc, WordBankDoc } from '../../types/firestore';
import { LevelEditor } from '../../components/curriculum/LevelEditor';
import { WordPickerModal } from '../../components/curriculum/WordPickerModal';
import { SharedCurriculaDrawer } from '../../components/curriculum/SharedCurriculaDrawer';
import { submitCurriculumEdit } from '../../services/firebase/curriculumEdits';
import { getLanguageCurriculum, LANGUAGE_LABELS } from '../../services/firebase/languageCurricula';
import { Timestamp } from 'firebase/firestore';

function parseGrade(grade: string | number): number {
  if (typeof grade === 'number') return grade;
  const match = String(grade).match(/\d+/);
  return match ? parseInt(match[0], 10) : 1;
}

function formatDate(ts: Timestamp | string | undefined): string {
  if (!ts) return '—';
  if (ts instanceof Timestamp) return ts.toDate().toLocaleDateString();
  return String(ts);
}

const STATUS_BADGE: Record<string, string> = {
  pending: 'bg-amber-50 text-amber-600 border border-amber-200',
  approved: 'bg-success/10 text-success border border-success/20',
  rejected: 'bg-error/10 text-error border border-error/20',
};

export default function CurriculumEditorPage() {
  const { user } = useAuthStore();
  const { classes, listenToTeacherClasses } = useTeacherStore();
  const { words, edits, fetchWordsByIds, fetchEditsForClass } = useCurriculumStore();

  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [localLevels, setLocalLevels] = useState<CurriculumLevel[]>([]);
  const [_masterLevels, setMasterLevels] = useState<CurriculumLevel[]>([]);
  const [dirty, setDirty] = useState(false);

  // Word picker
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerLevelNum, setPickerLevelNum] = useState(1);

  // Word editing — per-class custom overrides (never touches wordBank)
  const [editWordId, setEditWordId] = useState<string | null>(null);
  const [localCustomWords, setLocalCustomWords] = useState<Record<string, Partial<WordBankDoc>>>({});

  // Shared curricula drawer
  const [sharedDrawerOpen, setSharedDrawerOpen] = useState(false);

  // Submit modal
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [submitNote, setSubmitNote] = useState('');
  const [shareWithProject, setShareWithProject] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Listen to classes
  useEffect(() => {
    if (user) return listenToTeacherClasses(user.uid);
  }, [user]);

  const selectedClass: (ClassDoc & { id: string }) | undefined = classes.find(c => c.id === selectedClassId);

  // Load curriculum when class changes
  useEffect(() => {
    if (!selectedClass) return;
    const lang = selectedClass.learningLanguage;
    const grade = parseGrade(selectedClass.grade);

    fetchEditsForClass(selectedClassId);

    // Load master curriculum
    getLanguageCurriculum(lang, grade).then(master => {
      setMasterLevels(master?.levels ?? []);
      // Use custom curriculum if exists, else master
      const custom = selectedClass.customCurriculum;
      const levels = custom?.levels?.length ? custom.levels : master?.levels ?? [];
      setLocalLevels(levels);
      setDirty(false);
      // Fetch the specific words referenced in these levels
      const ids = levels.flatMap(l => l.wordIds);
      if (ids.length > 0) fetchWordsByIds(ids);
    });
    // Load existing custom word overrides
    const existing = selectedClass?.customCurriculum?.customWords ?? {};
    setLocalCustomWords(existing as Record<string, Partial<WordBankDoc>>);
  }, [selectedClassId, selectedClass?.id]);

  const allWordIds = useMemo(() => localLevels.flatMap(l => l.wordIds), [localLevels]);

  // For the picker: map of wordId → levelNum for all words NOT in the target level
  const buildOtherLevelMap = (targetLevelNum: number): Record<string, number> => {
    const map: Record<string, number> = {};
    for (const l of localLevels) {
      if (l.levelNum === targetLevelNum) continue;
      for (const id of l.wordIds) map[id] = l.levelNum;
    }
    return map;
  };

  const currentLevelIds = useMemo(
    () => localLevels.find(l => l.levelNum === pickerLevelNum)?.wordIds ?? [],
    [localLevels, pickerLevelNum],
  );

  const handleLevelsChange = (newLevels: CurriculumLevel[]) => {
    setLocalLevels(newLevels);
    setDirty(true);
  };

  const handleAddWord = (levelNum: number) => {
    setEditWordId(null);
    setPickerLevelNum(levelNum);
    setPickerOpen(true);
  };

  const handleEditWord = (wordId: string) => {
    setEditWordId(wordId);
    setPickerOpen(true);
  };

  const handleEditConfirm = (wordId: string, edits: {
    wordText: string; english: string; pronunciation: string;
    sentence: string; imageUrl?: string | null;
  }) => {
    const lang = selectedClass?.learningLanguage ?? 'te';
    const override: Partial<WordBankDoc> = {
      word: { ...(words[wordId]?.word ?? {}), [lang]: edits.wordText, en: edits.english } as Record<LanguageCode, string>,
      pronunciation: { ...(words[wordId]?.pronunciation ?? {}), [lang]: edits.pronunciation } as Record<LanguageCode, string>,
      sentence: { ...(words[wordId]?.sentence ?? {}), [lang]: edits.sentence } as Record<LanguageCode, string>,
      ...(edits.imageUrl !== undefined ? { imageUrl: edits.imageUrl } : {}),
    };
    setLocalCustomWords(prev => ({ ...prev, [wordId]: override }));
    setDirty(true);
    setEditWordId(null);
  };

  // Merge localCustomWords on top of store words for display
  const mergedWords = useMemo((): Record<string, WordBankDoc> => {
    const result: Record<string, WordBankDoc> = { ...words };
    for (const [id, overrides] of Object.entries(localCustomWords)) {
      if (result[id]) result[id] = { ...result[id], ...overrides } as WordBankDoc;
    }
    return result;
  }, [words, localCustomWords]);

  const customizedWordIdSet = useMemo(() => new Set(Object.keys(localCustomWords)), [localCustomWords]);

  const handlePickerConfirm = (wordIds: string[]) => {
    if (!wordIds.length) return;
    setLocalLevels(prev => prev.map(l =>
      l.levelNum === pickerLevelNum
        ? { ...l, wordIds: [...l.wordIds, ...wordIds.filter(id => !l.wordIds.includes(id))] }
        : l
    ));
    setDirty(true);
  };

  const handleSubmit = async () => {
    if (!user || !selectedClass) return;
    setSubmitting(true);
    try {
      await submitCurriculumEdit({
        classId: selectedClassId,
        projectId: selectedClass.schoolId || '',
        teacherUid: user.uid,
        grade: parseGrade(selectedClass.grade),
        language: selectedClass.learningLanguage,
        shareWithProject,
        proposedLevels: localLevels,
        pendingWordIds: [],
      });
      await fetchEditsForClass(selectedClassId);
      setShowSubmitModal(false);
      setSubmitNote('');
    } catch (e) {
      console.error(e);
    }
    setSubmitting(false);
  };

  const hasCustomCurriculum = !!selectedClass?.customCurriculum;

  return (
    <div className="space-y-lg">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-md">
        <div>
          <h1 className="font-baloo font-extrabold text-xxl text-text-dark">Curriculum Editor</h1>
          <p className="font-baloo text-text-muted">Customize your class curriculum</p>
        </div>
        <div className="flex items-center gap-sm flex-wrap">
          <button
            onClick={() => setSharedDrawerOpen(true)}
            disabled={!selectedClassId}
            className="px-md py-sm rounded-xl border-2 border-secondary text-secondary font-baloo font-semibold text-sm hover:bg-mint-light transition-colors disabled:opacity-40"
          >
            Browse Shared Curricula
          </button>
          <button
            onClick={() => setShowSubmitModal(true)}
            disabled={!dirty || !selectedClassId}
            className="px-lg py-sm bg-primary text-white font-baloo font-bold text-sm rounded-xl shadow-md hover:bg-primary/90 transition-colors disabled:opacity-40"
          >
            Submit for Approval
          </button>
        </div>
      </div>

      {/* Class selector */}
      <div className="bg-white rounded-2xl border border-divider shadow-sm p-md flex items-end gap-md flex-wrap">
        <div className="flex-1 min-w-[200px]">
          <label className="font-baloo font-bold text-sm text-text-dark block mb-xs">Select Class</label>
          <select
            value={selectedClassId}
            onChange={e => { setSelectedClassId(e.target.value); setDirty(false); }}
            className="w-full px-md py-sm rounded-xl border border-divider font-baloo text-sm focus:outline-none focus:ring-2 focus:ring-primary bg-white"
          >
            <option value="">— Choose a class —</option>
            {classes.map(c => (
              <option key={c.id} value={c.id}>{c.name} · Grade {c.grade}</option>
            ))}
          </select>
        </div>
        {selectedClass && (
          <div className="flex items-center gap-sm">
            {hasCustomCurriculum ? (
              <span className="px-sm py-xs bg-secondary/10 text-secondary font-baloo font-semibold text-xs rounded-full border border-secondary/20">
                Custom Curriculum Active
              </span>
            ) : (
              <span className="px-sm py-xs bg-lavender-light text-primary font-baloo font-semibold text-xs rounded-full border border-divider">
                Using Master Curriculum
              </span>
            )}
            {dirty && (
              <span className="px-sm py-xs bg-amber-50 text-amber-600 font-baloo font-semibold text-xs rounded-full border border-amber-200">
                Unsaved changes
              </span>
            )}
          </div>
        )}
      </div>

      {!selectedClassId ? (
        <div className="bg-white rounded-2xl border border-divider shadow-sm p-xl text-center">
          <span className="text-5xl block mb-md">📚</span>
          <p className="font-baloo font-bold text-lg text-text-dark">Select a class to start editing</p>
        </div>
      ) : (
        <div className="flex gap-lg items-start">
          {/* Editor */}
          <div className="flex-1 min-w-0">
            <LevelEditor
              levels={localLevels}
              words={mergedWords}
              learningLanguage={selectedClass?.learningLanguage ?? 'te'}
              onChange={handleLevelsChange}
              onAddWord={handleAddWord}
              onEditWord={handleEditWord}
              customizedWordIds={customizedWordIdSet}
            />
          </div>

          {/* Right sidebar */}
          <div className="w-64 shrink-0 space-y-md">
            {selectedClass && (
              <div className="bg-white rounded-2xl border border-divider shadow-sm p-md space-y-sm">
                <h3 className="font-baloo font-bold text-sm text-text-dark">Class Info</h3>
                <div className="space-y-xs">
                  <div className="flex justify-between">
                    <span className="font-baloo text-xs text-text-muted">Language</span>
                    <span className="font-baloo font-semibold text-xs text-text-dark">{LANGUAGE_LABELS[selectedClass.learningLanguage] || selectedClass.learningLanguage}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-baloo text-xs text-text-muted">Grade</span>
                    <span className="font-baloo font-semibold text-xs text-text-dark">{selectedClass.grade}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-baloo text-xs text-text-muted">Words</span>
                    <span className="font-baloo font-semibold text-xs text-text-dark">{allWordIds.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-baloo text-xs text-text-muted">Levels</span>
                    <span className="font-baloo font-semibold text-xs text-text-dark">{localLevels.length}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Pending Edits */}
            <div className="bg-white rounded-2xl border border-divider shadow-sm p-md">
              <h3 className="font-baloo font-bold text-sm text-text-dark mb-md">Pending Edits</h3>
              {edits.length === 0 ? (
                <p className="font-baloo text-xs text-text-muted">No edits submitted yet.</p>
              ) : (
                <div className="space-y-sm">
                  {edits.map(edit => (
                    <div key={edit.id} className="bg-gray-50 rounded-xl p-sm border border-divider">
                      <div className="flex items-center justify-between mb-xs">
                        <span className={`px-xs py-0.5 rounded-full font-baloo font-semibold text-[10px] capitalize ${STATUS_BADGE[edit.status] || ''}`}>
                          {edit.status}
                        </span>
                        <span className="font-baloo text-[10px] text-text-muted">{formatDate(edit.submittedAt)}</span>
                      </div>
                      <p className="font-baloo text-xs text-text-dark">
                        {edit.proposedLevels.length} levels · {edit.proposedLevels.reduce((s, l) => s + l.wordIds.length, 0)} words
                      </p>
                      {edit.status === 'rejected' && edit.rejectionNote && (
                        <p className="font-baloo text-[10px] text-error mt-xs italic">{edit.rejectionNote}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Word Picker Modal */}
      <WordPickerModal
        open={pickerOpen}
        onClose={() => { setPickerOpen(false); setEditWordId(null); }}
        learningLanguage={selectedClass?.learningLanguage ?? 'te'}
        levelNum={pickerLevelNum}
        currentLevelIds={currentLevelIds}
        otherLevelMap={buildOtherLevelMap(pickerLevelNum)}
        onConfirm={handlePickerConfirm}
        editMode={editWordId && mergedWords[editWordId]
          ? { wordId: editWordId, wordData: mergedWords[editWordId] }
          : undefined
        }
        onEditConfirm={handleEditConfirm}
        teacherUid={user?.uid ?? ''}
      />

      {/* Shared Curricula Drawer */}
      {selectedClass && (
        <SharedCurriculaDrawer
          open={sharedDrawerOpen}
          onClose={() => setSharedDrawerOpen(false)}
          projectId={selectedClass.schoolId || ''}
          grade={parseGrade(selectedClass.grade)}
          language={selectedClass.learningLanguage}
          classId={selectedClassId}
          onAdopted={() => {
            // Reload after adopting
            getLanguageCurriculum(selectedClass.learningLanguage, parseGrade(selectedClass.grade)).then(m => {
              setLocalLevels(selectedClass.customCurriculum?.levels ?? m?.levels ?? []);
            });
          }}
        />
      )}

      {/* Submit Modal */}
      <AnimatePresence>
        {showSubmitModal && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/40 z-50"
              onClick={() => setShowSubmitModal(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[480px] bg-white rounded-2xl shadow-2xl z-50 p-lg"
            >
              <h2 className="font-baloo font-bold text-lg text-text-dark mb-xs">Submit for Approval</h2>
              <p className="font-baloo text-sm text-text-muted mb-lg">
                Submit your curriculum changes for admin review. You can optionally share it with other teachers in the project.
              </p>
              <div className="space-y-md">
                <div>
                  <label className="font-baloo font-bold text-sm text-text-dark block mb-xs">Note (optional)</label>
                  <textarea
                    value={submitNote}
                    onChange={e => setSubmitNote(e.target.value)}
                    placeholder="Describe your changes…"
                    rows={3}
                    className="w-full px-md py-sm rounded-xl border border-divider font-baloo text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
                <label className="flex items-center gap-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={shareWithProject}
                    onChange={e => setShareWithProject(e.target.checked)}
                    className="w-4 h-4 rounded accent-secondary"
                  />
                  <span className="font-baloo font-semibold text-sm text-text-dark">Share with project teachers</span>
                </label>
              </div>
              <div className="flex gap-sm mt-lg">
                <button
                  onClick={() => setShowSubmitModal(false)}
                  className="flex-1 py-sm rounded-xl border-2 border-divider font-baloo font-semibold text-sm text-text-muted"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="flex-1 py-sm rounded-xl bg-primary text-white font-baloo font-bold text-sm hover:bg-primary/90 transition-colors shadow-sm disabled:opacity-50"
                >
                  {submitting ? 'Submitting…' : 'Submit'}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

    </div>
  );
}
