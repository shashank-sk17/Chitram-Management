import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { httpsCallable } from 'firebase/functions';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { functions, storage } from '../../config/firebase';
import type { WordBankDoc, LanguageCode } from '../../types/firestore';
import { getWordBankPage, createPendingWord, updateWord, getTeacherPendingWords, type TeacherMeta } from '../../services/firebase/wordBank';

interface WordPickerModalProps {
  open: boolean;
  onClose: () => void;
  learningLanguage: LanguageCode;
  levelNum: number;
  /** wordIds already in this specific level — excluded from selection */
  currentLevelIds: string[];
  /** map of wordId → levelNum for words in OTHER levels — shown with badge */
  otherLevelMap: Record<string, number>;
  onConfirm: (wordIds: string[]) => void;
  /** Called when a brand-new pending word is created — separate from browsed words */
  onWordCreated?: (wordId: string) => void;
  /** When set, opens in word-edit mode instead of add mode */
  editMode?: { wordId: string; wordData: WordBankDoc };
  /** Called when an existing word edit is saved */
  onEditConfirm?: (wordId: string, edits: {
    wordText: string; english: string;
    sentence: string; imageUrl?: string | null;
  }) => void;
  teacherUid: string;
  teacherMeta?: Omit<TeacherMeta, 'teacherUid'>;
  /** Used to filter browse results to words relevant to the teacher's project */
  browseProjectId?: string;
}

type Tab = 'browse' | 'create' | 'edit';

const LANG_LABEL: Record<string, string> = {
  te: 'Telugu', en: 'English', hi: 'Hindi', es: 'Spanish', fr: 'French',
};

// ─── Spinner ──────────────────────────────────────────────────────────────────
function Spinner({ size = 16 }: { size?: number }) {
  return (
    <svg
      className="animate-spin text-current"
      style={{ width: size, height: size }}
      viewBox="0 0 24 24"
      fill="none"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  );
}

// ─── AutoButton — small pill button for AI-assist ──────────────────────────
function AutoButton({
  loading,
  disabled,
  onClick,
  label,
}: {
  loading: boolean;
  disabled: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || loading}
      className="inline-flex items-center gap-xs px-sm py-xs rounded-lg bg-secondary/10 text-secondary font-baloo font-semibold text-xs hover:bg-secondary/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
    >
      {loading ? <Spinner size={12} /> : '✨'}
      {loading ? 'Generating…' : label}
    </button>
  );
}

export function WordPickerModal({
  open,
  onClose,
  learningLanguage,
  levelNum,
  currentLevelIds,
  otherLevelMap,
  onConfirm,
  onWordCreated,
  editMode,
  onEditConfirm,
  teacherUid,
  teacherMeta,
  browseProjectId,
}: WordPickerModalProps) {
  // ── Browse tab state ───────────────────────────────────────────────────────
  const [tab, setTab] = useState<Tab>('browse');
  const [search, setSearch] = useState('');
  const [words, setWords] = useState<Array<{ id: string } & WordBankDoc>>([]);
  const [myPendingWords, setMyPendingWords] = useState<Array<{ id: string } & WordBankDoc>>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // ── Create tab — form fields ───────────────────────────────────────────────
  const [wordText, setWordText] = useState('');
  const [english, setEnglish] = useState('');

  const [sentence, setSentence] = useState('');

  // ── Create tab — image ────────────────────────────────────────────────────
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>(''); // local blob or remote URL
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string>(''); // CF-returned URL
  const [imageGenerating, setImageGenerating] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Create tab — AI generation states ─────────────────────────────────────

  const [sentenceGenerating, setSentenceGenerating] = useState(false);

  // ── Create tab — submission ────────────────────────────────────────────────
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  // ── Reset on open ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (open) {
      if (editMode) {
        // Pre-fill with existing word data
        setTab('edit');
        setWordText(editMode.wordData.word?.[learningLanguage] || editMode.wordData.word?.en || '');
        setEnglish(editMode.wordData.word?.en || '');
        setSentence(editMode.wordData.sentence?.[learningLanguage] || '');
        setImagePreview(editMode.wordData.imageUrl || '');
        setGeneratedImageUrl(editMode.wordData.imageUrl || '');
      } else {
        setTab('browse');
        setSearch('');
        setSelected(new Set());
        setWordText('');
        setEnglish('');

        setSentence('');
        setImageFile(null);
        setImagePreview('');
        setGeneratedImageUrl('');
      }
      setCreateError('');
    }
  }, [open, editMode?.wordId]);

  // ── Browse: load words ─────────────────────────────────────────────────────
  const load = useCallback(async (searchTerm: string) => {
    setLoading(true);
    try {
      const [{ words: fetched }, myPending] = await Promise.all([
        getWordBankPage(
          {
            status: 'active',
            approvedLanguage: learningLanguage,
            search: searchTerm || undefined,
            ...(browseProjectId ? { projectId: browseProjectId } : {}),
          },
          undefined,
          100,
        ),
        teacherUid ? getTeacherPendingWords(teacherUid) : Promise.resolve([]),
      ]);
      const excluded = new Set(currentLevelIds);
      setWords(fetched.filter(w => !excluded.has(w.id)));
      // Show teacher's own pending words (filtered by search, not already in level)
      const searchLower = searchTerm.toLowerCase();
      setMyPendingWords(
        myPending.filter(w => {
          if (excluded.has(w.id)) return false;
          if (!searchLower) return true;
          return Object.values(w.word ?? {}).some(v => v?.toLowerCase().includes(searchLower))
            || Object.values(w.meaning ?? {}).some(v => v?.toLowerCase().includes(searchLower));
        })
      );
    } catch (err) {
      console.error('WordPickerModal load error:', err);
    }
    setLoading(false);
  }, [currentLevelIds.join(','), browseProjectId, teacherUid]);

  useEffect(() => {
    if (open && tab === 'browse') load(search);
  }, [open, tab]);

  useEffect(() => {
    const t = setTimeout(() => { if (open && tab === 'browse') load(search); }, 300);
    return () => clearTimeout(t);
  }, [search, open, tab]);

  // ── Browse: toggle selection ───────────────────────────────────────────────
  const toggle = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleBrowseConfirm = () => {
    onConfirm(Array.from(selected));
    onClose();
  };

  // ── Create: file upload ────────────────────────────────────────────────────
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    setGeneratedImageUrl('');
    const objectUrl = URL.createObjectURL(file);
    setImagePreview(objectUrl);
  };

  const clearImage = () => {
    setImageFile(null);
    setImagePreview('');
    setGeneratedImageUrl('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // ── Create: AI — generate image ────────────────────────────────────────────
  const handleGenerateImage = async () => {
    if (!wordText.trim()) return;
    setImageGenerating(true);
    setCreateError('');
    try {
      const fn = httpsCallable<{ word: string; englishWord?: string }, { imageUrl: string }>(
        functions, 'generateWordImage',
      );
      const res = await fn({ word: wordText.trim(), englishWord: english.trim() || undefined });
      setGeneratedImageUrl(res.data.imageUrl);
      setImagePreview(res.data.imageUrl);
      setImageFile(null);
    } catch {
      setCreateError('Image generation failed. Try uploading manually.');
    }
    setImageGenerating(false);
  };

// ── Create: AI — generate sentence ────────────────────────────────────────
  const handleGenerateSentence = async () => {
    if (!wordText.trim()) return;
    setSentenceGenerating(true);
    try {
      const fn = httpsCallable<
        { word: string; language: string; englishWord?: string; type: string },
        { result: string }
      >(functions, 'generateWordContent');
      const res = await fn({
        word: wordText.trim(),
        language: learningLanguage,
        englishWord: english.trim() || undefined,
        type: 'sentence',
      });
      setSentence(res.data.result);
    } catch {
      setCreateError('Sentence generation failed.');
    }
    setSentenceGenerating(false);
  };

  // ── Create: submit ─────────────────────────────────────────────────────────
  const handleCreate = async () => {
    if (!wordText.trim()) {
      setCreateError(`${LANG_LABEL[learningLanguage] || learningLanguage} word is required.`);
      return;
    }
    setCreating(true);
    setCreateError('');

    try {
      const wordId = await createPendingWord(
        {
          word: {
            te: '', en: english, hi: '', es: '', fr: '',
            [learningLanguage]: wordText,
          } as Record<LanguageCode, string>,

          sentence: {
            te: '', en: '', hi: '', es: '', fr: '',
            [learningLanguage]: sentence,
          } as Record<LanguageCode, string>,
          // Use AI-generated URL directly if available
          ...(generatedImageUrl ? { imageUrl: generatedImageUrl } : {}),
        },
        { teacherUid, ...teacherMeta },
      );

      // Upload manually selected file after word creation
      if (imageFile) {
        const fileRef = storageRef(storage, `wordbank-images/${wordId}/image.jpg`);
        await uploadBytes(fileRef, imageFile, { contentType: 'image/jpeg' });
        const uploadedUrl = await getDownloadURL(fileRef);
        await updateWord(wordId, { imageUrl: uploadedUrl });
      }

      onWordCreated?.(wordId);
      onConfirm([wordId]);
      onClose();
    } catch (err) {
      console.error('Failed to create word:', err);
      setCreateError('Failed to create word. Please try again.');
    }
    setCreating(false);
  };

  // ── Edit: save customisation ───────────────────────────────────────────────
  const handleEditSave = () => {
    if (!editMode || !onEditConfirm) return;
    if (!wordText.trim()) {
      setCreateError(`${LANG_LABEL[learningLanguage] || learningLanguage} word is required.`);
      return;
    }
    onEditConfirm(editMode.wordId, {
      wordText: wordText.trim(),
      english: english.trim(),

      sentence: sentence.trim(),
      imageUrl: generatedImageUrl || (imagePreview !== editMode.wordData.imageUrl ? null : editMode.wordData.imageUrl),
    });
    onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 z-50"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed inset-x-4 top-16 bottom-16 md:inset-x-auto md:left-1/2 md:-translate-x-1/2 md:w-[700px] bg-white rounded-2xl shadow-2xl z-50 flex flex-col overflow-hidden"
          >
            {/* ── Header ───────────────────────────────────────────────────── */}
            <div className="px-lg py-md border-b border-divider bg-gradient-to-r from-lavender-light to-mint-light">
              <div className="flex items-center justify-between mb-sm">
                <div>
                  <h2 className="font-baloo font-bold text-lg text-text-dark">
                    {editMode ? `Edit Word — ${editMode.wordData.word?.en || editMode.wordId}` : `Add Words to Level ${levelNum}`}
                  </h2>
                  <p className="font-baloo text-sm text-text-muted">
                    {editMode
                      ? 'Changes saved to this class only — original word bank unchanged'
                      : tab === 'browse' ? `${selected.size} selected` : 'Submit a new word for admin approval'}
                  </p>
                </div>
                <button
                  onClick={onClose}
                  className="w-8 h-8 rounded-full bg-white/60 flex items-center justify-center text-text-muted hover:text-text-dark"
                >
                  ✕
                </button>
              </div>

              {/* Tabs — hidden in edit mode */}
              {!editMode && (
                <div className="flex gap-xs">
                  <button
                    onClick={() => setTab('browse')}
                    className={`px-md py-xs rounded-lg font-baloo font-semibold text-sm transition-colors ${
                      tab === 'browse'
                        ? 'bg-white text-primary shadow-sm'
                        : 'text-text-muted hover:text-text-dark'
                    }`}
                  >
                    Browse Word Bank
                  </button>
                  <button
                    onClick={() => setTab('create')}
                    className={`px-md py-xs rounded-lg font-baloo font-semibold text-sm transition-colors ${
                      tab === 'create'
                        ? 'bg-white text-primary shadow-sm'
                        : 'text-text-muted hover:text-text-dark'
                    }`}
                  >
                    + Create New Word
                  </button>
                </div>
              )}
            </div>

            {/* ── Browse tab ───────────────────────────────────────────────── */}
            {tab === 'browse' && (
              <>
                <div className="px-lg pt-md pb-sm border-b border-divider/50">
                  <input
                    type="text"
                    placeholder={`Search in ${LANG_LABEL[learningLanguage] || learningLanguage} or English…`}
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="w-full px-md py-sm rounded-xl border border-divider font-baloo text-sm focus:outline-none focus:ring-2 focus:ring-primary bg-white"
                    autoFocus
                  />
                  {Object.keys(otherLevelMap).length > 0 && (
                    <p className="font-baloo text-xs text-text-muted mt-xs">
                      Words with an{' '}
                      <span className="inline-block px-xs py-0.5 bg-amber-100 text-amber-700 rounded text-[10px] font-semibold">
                        Lv N
                      </span>{' '}
                      badge are in another level — you can still add them here.
                    </p>
                  )}
                </div>

                <div className="flex-1 overflow-y-auto p-md space-y-md">
                  {/* ── Teacher's own pending words ── */}
                  {myPendingWords.length > 0 && (
                    <div>
                      <div className="flex items-center gap-xs mb-sm">
                        <span className="font-baloo font-bold text-xs text-amber-700">⏳ Your Pending Words</span>
                        <span className="text-[10px] font-baloo text-amber-600 bg-amber-50 border border-amber-200 px-xs py-0.5 rounded-full">awaiting approval — select to reuse</span>
                      </div>
                      <div className="grid grid-cols-3 sm:grid-cols-4 gap-sm">
                        {myPendingWords.map(w => {
                          const isSelected = selected.has(w.id);
                          return (
                            <button
                              key={w.id}
                              onClick={() => toggle(w.id)}
                              className={`relative flex flex-col items-center p-sm rounded-xl border-2 transition-all ${
                                isSelected
                                  ? 'border-amber-500 bg-amber-50 shadow-md'
                                  : 'border-amber-200 bg-amber-50/40 hover:border-amber-400'
                              }`}
                            >
                              {isSelected && (
                                <div className="absolute top-1 right-1 w-5 h-5 bg-amber-500 rounded-full flex items-center justify-center z-10">
                                  <span className="text-white text-[10px]">✓</span>
                                </div>
                              )}
                              <div className="absolute top-1 left-1 px-xs py-0.5 bg-amber-400 text-white rounded text-[8px] font-baloo font-bold z-10">
                                pending
                              </div>
                              <div className="flex flex-col items-center w-full mt-xs">
                                {w.imageUrl ? (
                                  <img src={w.imageUrl} alt="" className="w-12 h-12 object-cover rounded-lg mb-xs" />
                                ) : (
                                  <div className="w-12 h-12 rounded-lg bg-amber-100 flex items-center justify-center text-2xl mb-xs">📝</div>
                                )}
                                <p className="font-baloo font-bold text-[11px] text-text-dark text-center leading-tight line-clamp-2">
                                  {w.word?.[learningLanguage] || w.word?.en}
                                </p>
                                <p className="font-baloo text-[9px] text-text-muted text-center leading-tight">
                                  {w.word?.en}
                                </p>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* ── Active words from word bank ── */}
                  {loading ? (
                    <div className="flex items-center justify-center py-xl gap-sm text-text-muted font-baloo">
                      <Spinner /> Loading…
                    </div>
                  ) : words.length === 0 && myPendingWords.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-xl gap-sm text-text-muted">
                      <span className="text-4xl">🔍</span>
                      <p className="font-baloo font-semibold">No words found</p>
                      <p className="font-baloo text-sm text-center">
                        {search ? 'Try a different search term, or ' : 'All active words are already in this level, or '}
                        <button onClick={() => setTab('create')} className="text-primary underline">
                          create a new word
                        </button>
                      </p>
                    </div>
                  ) : words.length > 0 ? (
                    <div>
                      {myPendingWords.length > 0 && (
                        <p className="font-baloo font-bold text-xs text-text-muted mb-sm">Active Words</p>
                      )}
                      <div className="grid grid-cols-3 sm:grid-cols-4 gap-sm">
                        {words.map(w => {
                          const isSelected = selected.has(w.id);
                          const inOtherLevel = otherLevelMap[w.id];
                          return (
                            <button
                              key={w.id}
                              onClick={() => toggle(w.id)}
                              className={`relative flex flex-col items-center p-sm rounded-xl border-2 transition-all ${
                                isSelected
                                  ? 'border-primary bg-lavender-light shadow-md'
                                  : 'border-divider bg-white hover:border-primary/40'
                              }`}
                            >
                              {isSelected && (
                                <div className="absolute top-1 right-1 w-5 h-5 bg-primary rounded-full flex items-center justify-center z-10">
                                  <span className="text-white text-[10px]">✓</span>
                                </div>
                              )}
                              {inOtherLevel && !isSelected && (
                                <div className="absolute top-1 left-1 px-xs py-0.5 bg-amber-100 text-amber-700 rounded text-[9px] font-baloo font-bold z-10">
                                  Lv {inOtherLevel}
                                </div>
                              )}
                              <div className="flex flex-col items-center w-full">
                                {w.imageUrl ? (
                                  <img src={w.imageUrl} alt="" className="w-12 h-12 object-cover rounded-lg mb-xs" />
                                ) : (
                                  <div className="w-12 h-12 rounded-lg bg-lavender-light flex items-center justify-center text-2xl mb-xs">
                                    📝
                                  </div>
                                )}
                                <p className="font-baloo font-bold text-[11px] text-text-dark text-center leading-tight line-clamp-2">
                                  {w.word?.[learningLanguage] || w.word?.en}
                                </p>
                                <p className="font-baloo text-[9px] text-text-muted text-center leading-tight">
                                  {w.word?.en}
                                </p>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ) : null}
                </div>

                <div className="px-lg py-md border-t border-divider flex items-center justify-between">
                  <button
                    onClick={onClose}
                    className="font-baloo font-semibold text-sm text-text-muted hover:text-text-dark"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleBrowseConfirm}
                    disabled={selected.size === 0}
                    className={`px-lg py-sm rounded-xl font-baloo font-bold text-sm text-white transition-all ${
                      selected.size > 0
                        ? 'bg-primary hover:bg-primary/90 shadow-md'
                        : 'bg-gray-300 cursor-not-allowed'
                    }`}
                  >
                    Add {selected.size > 0 ? selected.size : ''} word
                    {selected.size !== 1 ? 's' : ''} to Level {levelNum}
                  </button>
                </div>
              </>
            )}

            {/* ── Edit Word tab ────────────────────────────────────────────── */}
            {tab === 'edit' && editMode && (
              <>
                <div className="flex-1 overflow-y-auto p-lg">
                  <div className="max-w-lg mx-auto space-y-md">
                    {/* Info banner */}
                    <div className="bg-secondary/10 border border-secondary/20 rounded-xl p-md">
                      <p className="font-baloo text-sm text-secondary">
                        <strong>Class-only customisation:</strong> The original word bank entry stays untouched.
                        Your changes create a private override for this class, visible to all who view this curriculum.
                      </p>
                    </div>

                    {/* Image */}
                    <div>
                      <label className="font-baloo font-bold text-sm text-text-dark block mb-xs">Image</label>
                      <div className="flex gap-md items-start">
                        <div className="relative w-24 h-24 shrink-0 rounded-xl border-2 border-dashed border-divider bg-gray-50 flex items-center justify-center overflow-hidden">
                          {imagePreview ? (
                            <>
                              <img src={imagePreview} alt="" className="w-full h-full object-cover" />
                              <button onClick={clearImage} className="absolute top-0.5 right-0.5 w-5 h-5 bg-black/60 rounded-full text-white text-[10px] flex items-center justify-center hover:bg-black/80">✕</button>
                            </>
                          ) : (
                            <span className="text-3xl">🖼️</span>
                          )}
                        </div>
                        <div className="flex flex-col gap-sm flex-1">
                          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
                          <button type="button" onClick={() => fileInputRef.current?.click()} className="w-full px-md py-sm rounded-xl border-2 border-divider font-baloo font-semibold text-sm text-text-dark hover:bg-lavender-light transition-colors text-left">
                            📁 Upload image
                          </button>
                          <button type="button" onClick={handleGenerateImage} disabled={!wordText.trim() || imageGenerating} className="w-full px-md py-sm rounded-xl border-2 border-secondary/40 font-baloo font-semibold text-sm text-secondary hover:bg-mint-light transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-xs">
                            {imageGenerating ? <><Spinner size={14} /> Generating…</> : <>✨ Generate with AI</>}
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Word */}
                    <div>
                      <label className="font-baloo font-bold text-sm text-text-dark block mb-xs">
                        {LANG_LABEL[learningLanguage] || learningLanguage} Word <span className="text-error">*</span>
                      </label>
                      <input type="text" value={wordText} onChange={e => setWordText(e.target.value)} className="w-full px-md py-sm rounded-xl border border-divider font-baloo text-sm focus:outline-none focus:ring-2 focus:ring-primary" autoFocus />
                    </div>

                    {/* English */}
                    <div>
                      <label className="font-baloo font-bold text-sm text-text-dark block mb-xs">English Translation</label>
                      <input type="text" value={english} onChange={e => setEnglish(e.target.value)} className="w-full px-md py-sm rounded-xl border border-divider font-baloo text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                    </div>

                    {/* Sentence */}
                    <div>
                      <div className="flex items-center justify-between mb-xs">
                        <label className="font-baloo font-bold text-sm text-text-dark">Use in a sentence</label>
                        <AutoButton loading={sentenceGenerating} disabled={!wordText.trim()} onClick={handleGenerateSentence} label="Generate" />
                      </div>
                      <textarea value={sentence} onChange={e => setSentence(e.target.value)} rows={2} className="w-full px-md py-sm rounded-xl border border-divider font-baloo text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none" />
                    </div>

                    {createError && <p className="font-baloo text-sm text-error">{createError}</p>}
                  </div>
                </div>
                <div className="px-lg py-md border-t border-divider flex items-center justify-between">
                  <button onClick={onClose} className="font-baloo font-semibold text-sm text-text-muted hover:text-text-dark">Cancel</button>
                  <button
                    onClick={handleEditSave}
                    disabled={!wordText.trim()}
                    className={`px-lg py-sm rounded-xl font-baloo font-bold text-sm text-white transition-all ${
                      wordText.trim() ? 'bg-secondary hover:bg-secondary/90 shadow-md' : 'bg-gray-300 cursor-not-allowed'
                    }`}
                  >
                    Save to This Class
                  </button>
                </div>
              </>
            )}

            {/* ── Create New Word tab ───────────────────────────────────────── */}
            {tab === 'create' && (
              <>
                <div className="flex-1 overflow-y-auto p-lg">
                  <div className="max-w-lg mx-auto space-y-md">

                    {/* Info banner */}
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-md">
                      <p className="font-baloo text-sm text-amber-700">
                        <strong>Pending review:</strong> New words go to admin for approval before
                        appearing in the word bank. The word will be added to Level {levelNum}
                        immediately and shown as pending.
                      </p>
                    </div>

                    {/* ── Image section ──────────────────────────────────────── */}
                    <div>
                      <label className="font-baloo font-bold text-sm text-text-dark block mb-xs">
                        Image
                      </label>
                      <div className="flex gap-md items-start">
                        {/* Preview box */}
                        <div className="relative w-24 h-24 shrink-0 rounded-xl border-2 border-dashed border-divider bg-gray-50 flex items-center justify-center overflow-hidden">
                          {imagePreview ? (
                            <>
                              <img
                                src={imagePreview}
                                alt=""
                                className="w-full h-full object-cover"
                              />
                              <button
                                onClick={clearImage}
                                className="absolute top-0.5 right-0.5 w-5 h-5 bg-black/60 rounded-full text-white text-[10px] flex items-center justify-center hover:bg-black/80"
                              >
                                ✕
                              </button>
                            </>
                          ) : (
                            <span className="text-3xl">🖼️</span>
                          )}
                        </div>

                        {/* Image action buttons */}
                        <div className="flex flex-col gap-sm flex-1">
                          {/* Upload */}
                          <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={handleFileChange}
                          />
                          <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="w-full px-md py-sm rounded-xl border-2 border-divider font-baloo font-semibold text-sm text-text-dark hover:bg-lavender-light transition-colors text-left"
                          >
                            📁 Upload image
                          </button>

                          {/* AI Generate */}
                          <button
                            type="button"
                            onClick={handleGenerateImage}
                            disabled={!wordText.trim() || imageGenerating}
                            className="w-full px-md py-sm rounded-xl border-2 border-secondary/40 font-baloo font-semibold text-sm text-secondary hover:bg-mint-light transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-xs"
                          >
                            {imageGenerating ? (
                              <><Spinner size={14} /> Generating image…</>
                            ) : (
                              <>✨ Generate with AI</>
                            )}
                          </button>
                          {!wordText.trim() && (
                            <p className="font-baloo text-[10px] text-text-muted">
                              Enter the word above to enable AI generation.
                            </p>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* ── Word in learning language ───────────────────────────── */}
                    <div>
                      <label className="font-baloo font-bold text-sm text-text-dark block mb-xs">
                        {LANG_LABEL[learningLanguage] || learningLanguage} Word{' '}
                        <span className="text-error">*</span>
                      </label>
                      <input
                        type="text"
                        value={wordText}
                        onChange={e => setWordText(e.target.value)}
                        placeholder={learningLanguage === 'te' ? 'e.g. నేను' : 'Word…'}
                        className="w-full px-md py-sm rounded-xl border border-divider font-baloo text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                        autoFocus
                      />
                    </div>

                    {/* ── English translation ─────────────────────────────────── */}
                    <div>
                      <label className="font-baloo font-bold text-sm text-text-dark block mb-xs">
                        English Translation
                      </label>
                      <input
                        type="text"
                        value={english}
                        onChange={e => setEnglish(e.target.value)}
                        placeholder="e.g. I / Me"
                        className="w-full px-md py-sm rounded-xl border border-divider font-baloo text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                    </div>

                    {/* ── Use in a sentence ────────────────────────────────────── */}
                    <div>
                      <div className="flex items-center justify-between mb-xs">
                        <label className="font-baloo font-bold text-sm text-text-dark">
                          Use in a sentence
                        </label>
                        <AutoButton
                          loading={sentenceGenerating}
                          disabled={!wordText.trim()}
                          onClick={handleGenerateSentence}
                          label="Generate"
                        />
                      </div>
                      <textarea
                        value={sentence}
                        onChange={e => setSentence(e.target.value)}
                        placeholder={
                          learningLanguage === 'te'
                            ? 'e.g. నేను పాఠశాలకు వెళ్తాను.'
                            : 'A sentence using this word…'
                        }
                        rows={2}
                        className="w-full px-md py-sm rounded-xl border border-divider font-baloo text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                      />
                    </div>

                    {createError && (
                      <p className="font-baloo text-sm text-error">{createError}</p>
                    )}
                  </div>
                </div>

                <div className="px-lg py-md border-t border-divider flex items-center justify-between">
                  <button
                    onClick={onClose}
                    className="font-baloo font-semibold text-sm text-text-muted hover:text-text-dark"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCreate}
                    disabled={creating || !wordText.trim()}
                    className={`px-lg py-sm rounded-xl font-baloo font-bold text-sm text-white transition-all flex items-center gap-xs ${
                      !creating && wordText.trim()
                        ? 'bg-primary hover:bg-primary/90 shadow-md'
                        : 'bg-gray-300 cursor-not-allowed'
                    }`}
                  >
                    {creating && <Spinner size={14} />}
                    {creating ? 'Submitting…' : `Submit & Add to Level ${levelNum}`}
                  </button>
                </div>
              </>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
