import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from '../../stores/authStore';
import { useCurriculumStore } from '../../stores/curriculumStore';
import { usePermission } from '../../hooks/usePermission';
import type { LanguageCode, CurriculumLevel } from '../../types/firestore';
import { LevelEditor } from '../../components/curriculum/LevelEditor';
import { WordPickerModal } from '../../components/curriculum/WordPickerModal';
import { SUPPORTED_LANGUAGES, LANGUAGE_LABELS, updateLanguageCurriculum } from '../../services/firebase/languageCurricula';
import { Timestamp } from 'firebase/firestore';

const GRADES = [1, 2, 3, 4, 5];

export default function LanguageCurriculaPage() {
  const { user } = useAuthStore();
  const { can } = usePermission();
  const { curricula, words, loadingCurricula, fetchCurriculum, updateCurriculumLocally, fetchWordsByIds } = useCurriculumStore();

  const [selectedLang, setSelectedLang] = useState<LanguageCode>('te');
  const [selectedGrade, setSelectedGrade] = useState<number>(1);
  const [loaded, setLoaded] = useState(false);
  const [loadedKey, setLoadedKey] = useState('');
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  // Word picker state
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerLevelNum, setPickerLevelNum] = useState<number>(1);

  const currKey = `${selectedLang}_g${selectedGrade}`;
  const curriculum = curricula[currKey];
  const levels: CurriculumLevel[] = curriculum?.levels ?? [];

  const currentLevelIds = useMemo(
    () => levels.find(l => l.levelNum === pickerLevelNum)?.wordIds ?? [],
    [levels, pickerLevelNum],
  );

  const otherLevelMap = useMemo((): Record<string, number> => {
    const map: Record<string, number> = {};
    for (const l of levels) {
      if (l.levelNum === pickerLevelNum) continue;
      for (const id of l.wordIds) map[id] = l.levelNum;
    }
    return map;
  }, [levels, pickerLevelNum]);

  const handleLoad = async () => {
    await fetchCurriculum(selectedLang, selectedGrade);
    // Fetch the specific words referenced in this curriculum
    const key = `${selectedLang}_g${selectedGrade}`;
    const cur = useCurriculumStore.getState().curricula[key];
    const ids = (cur?.levels ?? []).flatMap((l: CurriculumLevel) => l.wordIds);
    if (ids.length > 0) await fetchWordsByIds(ids);
    setLoadedKey(currKey);
    setLoaded(true);
    setDirty(false);
  };

  const handleLevelsChange = (newLevels: CurriculumLevel[]) => {
    updateCurriculumLocally(selectedLang, selectedGrade, newLevels);
    setDirty(true);
  };

  const handleAddWord = (levelNum: number) => {
    setPickerLevelNum(levelNum);
    setPickerOpen(true);
  };

  const handlePickerConfirm = (wordIds: string[]) => {
    if (wordIds.length === 0) return;
    const newLevels = levels.map(l =>
      l.levelNum === pickerLevelNum
        ? { ...l, wordIds: [...l.wordIds, ...wordIds.filter(id => !l.wordIds.includes(id))] }
        : l
    );
    updateCurriculumLocally(selectedLang, selectedGrade, newLevels);
    setDirty(true);
  };

  const handleSave = async () => {
    if (!user || !dirty) return;
    setSaving(true);
    try {
      await updateLanguageCurriculum(selectedLang, selectedGrade, levels, user.uid);
      await fetchCurriculum(selectedLang, selectedGrade);
      setDirty(false);
    } catch (e) {
      console.error(e);
    }
    setSaving(false);
  };

  const handleResetToSeed = async () => {
    if (!user) return;
    setSaving(true);
    try {
      await fetchCurriculum(selectedLang, selectedGrade);
      setDirty(false);
    } catch {}
    setSaving(false);
    setShowResetConfirm(false);
  };

  const totalWords = levels.reduce((s, l) => s + l.wordIds.length, 0);
  const TARGET_LEVELS = 8;
  const TARGET_WORDS_PER_LEVEL = 10;
  const levelsOk = levels.length === TARGET_LEVELS;
  const underfullLevels = levels.filter(l => l.wordIds.length < TARGET_WORDS_PER_LEVEL);
  const overfullLevels = levels.filter(l => l.wordIds.length > TARGET_WORDS_PER_LEVEL);
  const updatedAt = curriculum?.updatedAt;
  const updatedAtStr = updatedAt instanceof Timestamp
    ? updatedAt.toDate().toLocaleDateString()
    : typeof updatedAt === 'string' ? updatedAt : '—';

  const isCurrentLoaded = loaded && loadedKey === `${selectedLang}_g${selectedGrade}`;

  return (
    <div className="space-y-lg">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-md">
        <div>
          <h1 className="font-baloo font-extrabold text-xxl text-text-dark">Language Curricula</h1>
          <p className="font-baloo text-text-muted">Edit master curriculum for each language & grade</p>
        </div>
        {isCurrentLoaded && (
          <div className="flex items-center gap-sm">
            {can('curricula.resetToSeed') && (
              <button
                onClick={() => setShowResetConfirm(true)}
                className="px-md py-sm rounded-xl border-2 border-error text-error font-baloo font-bold text-sm hover:bg-rose-50 transition-colors"
              >
                Reset to Seed
              </button>
            )}
            {can('curricula.edit') && (
              <button
                onClick={handleSave}
                disabled={!dirty || saving}
                className="px-lg py-sm bg-primary text-white font-baloo font-bold text-sm rounded-xl shadow-md hover:bg-primary/90 transition-colors disabled:opacity-40"
              >
                {saving ? 'Saving…' : 'Save Changes'}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="bg-white rounded-2xl border border-divider shadow-sm p-md flex items-end gap-md flex-wrap">
        <div>
          <label className="font-baloo font-bold text-sm text-text-dark block mb-xs">Language</label>
          <select
            value={selectedLang}
            onChange={e => { setSelectedLang(e.target.value as LanguageCode); setLoaded(false); }}
            className="px-md py-sm rounded-xl border border-divider font-baloo text-sm focus:outline-none focus:ring-2 focus:ring-primary bg-white min-w-[140px]"
          >
            {SUPPORTED_LANGUAGES.map(lang => (
              <option key={lang} value={lang}>{LANGUAGE_LABELS[lang]}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="font-baloo font-bold text-sm text-text-dark block mb-xs">Grade</label>
          <select
            value={selectedGrade}
            onChange={e => { setSelectedGrade(Number(e.target.value)); setLoaded(false); }}
            className="px-md py-sm rounded-xl border border-divider font-baloo text-sm focus:outline-none focus:ring-2 focus:ring-primary bg-white min-w-[100px]"
          >
            {GRADES.map(g => (
              <option key={g} value={g}>Grade {g}</option>
            ))}
          </select>
        </div>
        <button
          onClick={handleLoad}
          disabled={loadingCurricula}
          className="px-lg py-sm bg-secondary text-white font-baloo font-bold text-sm rounded-xl shadow-sm hover:bg-secondary/90 transition-colors disabled:opacity-50"
        >
          {loadingCurricula ? 'Loading…' : 'Load'}
        </button>
      </div>

      {/* Stat chips */}
      <AnimatePresence>
        {isCurrentLoaded && curriculum && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="flex items-center gap-sm flex-wrap"
          >
            <div className="flex items-center gap-xs bg-lavender-light px-md py-sm rounded-xl border border-divider">
              <span className="text-lg">📝</span>
              <div>
                <p className="font-baloo font-bold text-text-dark text-sm">{totalWords}</p>
                <p className="font-baloo text-xs text-text-muted">Total Words</p>
              </div>
            </div>
            <div className={`flex items-center gap-xs px-md py-sm rounded-xl border ${levelsOk ? 'bg-mint-light border-divider' : 'bg-amber-50 border-amber-200'}`}>
              <span className="text-lg">📚</span>
              <div>
                <p className={`font-baloo font-bold text-sm ${levelsOk ? 'text-text-dark' : 'text-amber-700'}`}>
                  {levels.length} / {TARGET_LEVELS}
                </p>
                <p className="font-baloo text-xs text-text-muted">Levels {levelsOk ? '✓' : '⚠️'}</p>
              </div>
            </div>
            <div className={`flex items-center gap-xs px-md py-sm rounded-xl border ${totalWords === TARGET_LEVELS * TARGET_WORDS_PER_LEVEL ? 'bg-mint-light border-divider' : 'bg-amber-50 border-amber-200'}`}>
              <span className="text-lg">🎯</span>
              <div>
                <p className={`font-baloo font-bold text-sm ${totalWords === TARGET_LEVELS * TARGET_WORDS_PER_LEVEL ? 'text-text-dark' : 'text-amber-700'}`}>
                  {totalWords} / {TARGET_LEVELS * TARGET_WORDS_PER_LEVEL}
                </p>
                <p className="font-baloo text-xs text-text-muted">Words</p>
              </div>
            </div>
            <div className="flex items-center gap-xs bg-white px-md py-sm rounded-xl border border-divider shadow-sm">
              <span className="text-lg">🕐</span>
              <div>
                <p className="font-baloo font-bold text-text-dark text-sm">{updatedAtStr}</p>
                <p className="font-baloo text-xs text-text-muted">Last Updated</p>
              </div>
            </div>
            <div className="flex items-center gap-xs bg-white px-md py-sm rounded-xl border border-divider shadow-sm">
              <span className="text-lg">🔢</span>
              <div>
                <p className="font-baloo font-bold text-text-dark text-sm">v{curriculum.version ?? 1}</p>
                <p className="font-baloo text-xs text-text-muted">Version</p>
              </div>
            </div>
            {dirty && (
              <span className="px-sm py-xs bg-amber-50 text-amber-600 font-baloo font-semibold text-xs rounded-full border border-amber-200">
                Unsaved changes
              </span>
            )}
            {underfullLevels.length > 0 && (
              <span className="px-sm py-xs bg-red-50 text-red-600 font-baloo font-semibold text-xs rounded-full border border-red-200">
                ⚠️ {underfullLevels.length} level{underfullLevels.length > 1 ? 's' : ''} under 10 words
              </span>
            )}
            {overfullLevels.length > 0 && (
              <span className="px-sm py-xs bg-red-50 text-red-600 font-baloo font-semibold text-xs rounded-full border border-red-200">
                ⚠️ {overfullLevels.length} level{overfullLevels.length > 1 ? 's' : ''} over 10 words
              </span>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main content */}
      {!isCurrentLoaded ? (
        <div className="bg-white rounded-2xl border border-divider shadow-sm p-xl flex flex-col items-center justify-center gap-md text-center">
          <span className="text-6xl">🌐</span>
          <p className="font-baloo font-bold text-lg text-text-dark">Select a language and grade, then click Load</p>
          <p className="font-baloo text-text-muted text-sm">The curriculum editor will appear here.</p>
        </div>
      ) : (
        <div className="flex gap-lg items-start">
          {/* Editor */}
          <div className="flex-1 min-w-0">
            {levels.length === 0 ? (
              <div className="bg-white rounded-2xl border border-divider shadow-sm p-xl text-center">
                <p className="font-baloo text-text-muted">No curriculum found for {LANGUAGE_LABELS[selectedLang]} Grade {selectedGrade}.</p>
                <p className="font-baloo text-sm text-text-muted mt-xs">Use the editor below to create levels and add words.</p>
              </div>
            ) : null}
            <LevelEditor
              levels={levels}
              words={words}
              learningLanguage={selectedLang}
              onChange={handleLevelsChange}
              onAddWord={handleAddWord}
              grade={selectedGrade}
            />
          </div>

          {/* Right sidebar — version info */}
          <div className="w-64 shrink-0 space-y-md">
            <div className="bg-white rounded-2xl border border-divider shadow-sm p-md">
              <h3 className="font-baloo font-bold text-sm text-text-dark mb-md">Version Info</h3>
              <div className="space-y-sm">
                <div className="flex justify-between items-center">
                  <span className="font-baloo text-xs text-text-muted">Language</span>
                  <span className="font-baloo font-semibold text-xs text-text-dark">{LANGUAGE_LABELS[selectedLang]}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="font-baloo text-xs text-text-muted">Grade</span>
                  <span className="font-baloo font-semibold text-xs text-text-dark">{selectedGrade}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="font-baloo text-xs text-text-muted">Version</span>
                  <span className="font-baloo font-bold text-xs text-primary">v{curriculum?.version ?? 1}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="font-baloo text-xs text-text-muted">Levels</span>
                  <span className="font-baloo font-semibold text-xs text-text-dark">{levels.length}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="font-baloo text-xs text-text-muted">Total Words</span>
                  <span className="font-baloo font-semibold text-xs text-text-dark">{totalWords}</span>
                </div>
                <div className="border-t border-divider pt-sm">
                  <p className="font-baloo text-xs text-text-muted">Updated</p>
                  <p className="font-baloo font-semibold text-xs text-text-dark">{updatedAtStr}</p>
                </div>
                <div>
                  <p className="font-baloo text-xs text-text-muted">Updated By</p>
                  <p className="font-baloo font-semibold text-xs text-text-dark truncate">{curriculum?.updatedBy || '—'}</p>
                </div>
              </div>
            </div>

            <div className="bg-lavender-light rounded-2xl border border-divider p-md">
              <h4 className="font-baloo font-bold text-sm text-primary mb-xs">Level Breakdown</h4>
              <div className="space-y-xs">
                {levels.map(l => (
                  <div key={l.levelNum} className="flex justify-between items-center">
                    <span className="font-baloo text-xs text-text-dark">Level {l.levelNum}</span>
                    <span className="font-baloo text-xs text-text-muted">{l.wordIds.length} words</span>
                  </div>
                ))}
                {levels.length === 0 && (
                  <p className="font-baloo text-xs text-text-muted">No levels yet</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Word Picker Modal */}
      <WordPickerModal
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        learningLanguage={selectedLang}
        levelNum={pickerLevelNum}
        currentLevelIds={currentLevelIds}
        otherLevelMap={otherLevelMap}
        onConfirm={handlePickerConfirm}
        teacherUid={user?.uid ?? ''}
      />

      {/* Reset Confirm Modal */}
      <AnimatePresence>
        {showResetConfirm && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/40 z-50"
              onClick={() => setShowResetConfirm(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[420px] bg-white rounded-2xl shadow-2xl z-50 p-lg"
            >
              <h2 className="font-baloo font-bold text-lg text-text-dark mb-sm">Reset to Seed?</h2>
              <p className="font-baloo text-sm text-text-muted mb-lg">
                This will discard all unsaved changes and reload the curriculum from Firestore. This cannot be undone.
              </p>
              <div className="flex gap-sm">
                <button
                  onClick={() => setShowResetConfirm(false)}
                  className="flex-1 py-sm rounded-xl border-2 border-divider font-baloo font-semibold text-sm text-text-muted hover:text-text-dark"
                >
                  Cancel
                </button>
                <button
                  onClick={handleResetToSeed}
                  disabled={saving}
                  className="flex-1 py-sm rounded-xl bg-error text-white font-baloo font-bold text-sm hover:bg-error/90 transition-colors disabled:opacity-50"
                >
                  {saving ? 'Resetting…' : 'Reset'}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
