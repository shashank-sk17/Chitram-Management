import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../config/firebase';
import { useAuthStore } from '../../stores/authStore';
import { getWordBankPage, updateWord, uploadWordImage } from '../../services/firebase/wordBank';
import { LANGUAGE_LABELS } from '../../services/firebase/languageCurricula';
import type { WordBankDoc, LanguageCode } from '../../types/firestore';

type WordWithId = { id: string } & WordBankDoc;

const LANGS: LanguageCode[] = ['te', 'en', 'hi', 'mr', 'es', 'fr'];
const LANG_COLORS: Record<LanguageCode, string> = {
  te: 'bg-amber-50 border-amber-200 text-amber-700',
  en: 'bg-sky-50 border-sky-200 text-sky-700',
  hi: 'bg-orange-50 border-orange-200 text-orange-700',
  mr: 'bg-purple-50 border-purple-200 text-purple-700',
  es: 'bg-green-50 border-green-200 text-green-700',
  fr: 'bg-blue-50 border-blue-200 text-blue-700',
};

const EMPTY_LANG = () => Object.fromEntries(LANGS.map(l => [l, ''])) as Record<LanguageCode, string>;

function speak(text: string, lang: LanguageCode) {
  if (!text || !window.speechSynthesis) return;
  const langMap: Record<LanguageCode, string> = {
    te: 'te-IN', en: 'en-US', hi: 'hi-IN', mr: 'mr-IN', es: 'es-ES', fr: 'fr-FR',
  };
  window.speechSynthesis.cancel();
  const utt = new SpeechSynthesisUtterance(text);
  utt.lang = langMap[lang];
  window.speechSynthesis.speak(utt);
}

type FormData = {
  word: Record<LanguageCode, string>;
  pronunciation: Record<LanguageCode, string>;
  meaning: Record<LanguageCode, string>;
  sentence: Record<LanguageCode, string>;
  wordType: 'NS360' | 'GQD';
  difficulty: 'Low' | 'Medium' | 'High';
  grade: number;
};

const EMPTY_FORM = (): FormData => ({
  word: EMPTY_LANG(),
  pronunciation: EMPTY_LANG(),
  meaning: EMPTY_LANG(),
  sentence: EMPTY_LANG(),
  wordType: 'NS360',
  difficulty: 'Medium',
  grade: 1,
});

export default function WordEditorPage() {
  const { user } = useAuthStore();
  const [words, setWords] = useState<WordWithId[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [editWord, setEditWord] = useState<WordWithId | null>(null);
  const [form, setForm] = useState<FormData>(EMPTY_FORM());
  // 3 image slots: [File|null, File|null, File|null]
  const [imageFiles, setImageFiles] = useState<[File | null, File | null, File | null]>([null, null, null]);
  const [imagePreviews, setImagePreviews] = useState<[string | null, string | null, string | null]>([null, null, null]);
  const [activeLang, setActiveLang] = useState<LanguageCode>('te');
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3000);
  };

  const load = async (searchTerm?: string) => {
    setLoading(true);
    try {
      // Show both active and pending words submitted by this writer
      const { words: fetched } = await getWordBankPage({ search: searchTerm }, undefined, 200);
      setWords(fetched);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => load(search || undefined), search ? 300 : 0);
  }, [search]);

  const openNew = () => {
    setEditWord(null);
    setForm(EMPTY_FORM());
    setImageFiles([null, null, null]);
    setImagePreviews([null, null, null]);
    setActiveLang('te');
    return;
  };

  const openEdit = (w: WordWithId) => {
    setEditWord(w);
    setForm({
      word: { ...EMPTY_LANG(), ...(w.word ?? {}) },
      pronunciation: { ...EMPTY_LANG(), ...(w.pronunciation ?? {}) },
      meaning: { ...EMPTY_LANG(), ...(w.meaning ?? {}) },
      sentence: { ...EMPTY_LANG(), ...(w.sentence ?? {}) },
      wordType: w.wordType ?? 'NS360',
      difficulty: w.difficulty ?? 'Medium',
      grade: 1,
    });
    setImageFiles([null, null, null]);
    const urls = w.imageUrls ?? (w.imageUrl ? [w.imageUrl] : []);
    setImagePreviews([urls[0] ?? null, urls[1] ?? null, urls[2] ?? null]);
    setActiveLang('te');
  };

  const setLangField = (
    field: 'word' | 'pronunciation' | 'meaning' | 'sentence',
    lang: LanguageCode,
    value: string,
  ) => {
    setForm(prev => ({ ...prev, [field]: { ...prev[field], [lang]: value } }));
  };

  const handleImageChange = (index: 0 | 1 | 2) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFiles(prev => { const n = [...prev] as typeof prev; n[index] = file; return n; });
    setImagePreviews(prev => { const n = [...prev] as typeof prev; n[index] = URL.createObjectURL(file); return n; });
  };

  const handleSave = async () => {
    if (!user) return;
    if (!form.word.te && !form.word.en) {
      showToast('Add at least Telugu or English word', false);
      return;
    }
    setSaving(true);
    try {
      if (editWord) {
        await updateWord(editWord.id, {
          word: form.word,
          pronunciation: form.pronunciation,
          meaning: form.meaning,
          sentence: form.sentence,
          wordType: form.wordType,
          difficulty: form.difficulty,
        });
        for (const idx of [0, 1, 2] as const) {
          if (imageFiles[idx]) await uploadWordImage(editWord.id, imageFiles[idx]!, idx);
        }
        setWords(prev => prev.map(w => w.id === editWord.id
          ? { ...w, word: form.word, pronunciation: form.pronunciation, meaning: form.meaning, sentence: form.sentence }
          : w
        ));
        showToast('Word updated!');
        setEditWord(null);
      } else {
        // Submit for review via CF — creates word + admin notification atomically
        const submitWordFn = httpsCallable<unknown, { wordId: string }>(functions, 'submitWord');
        const result = await submitWordFn({
          data: {
            wordType: form.wordType,
            difficulty: form.difficulty,
            grade: form.grade,
            gradeContext: form.grade,
            word: form.word,
            pronunciation: form.pronunciation,
            meaning: form.meaning,
            sentence: form.sentence,
            imageUrl: null,
            imageUrls: [],
            audioUrl: { word: EMPTY_LANG(), meaning: EMPTY_LANG(), sentence: EMPTY_LANG() },
            submittedByName: user.email ?? 'content writer',
          },
        });
        for (const idx of [0, 1, 2] as const) {
          if (imageFiles[idx]) await uploadWordImage(result.data.wordId, imageFiles[idx]!, idx);
        }
        showToast('Submitted for review!');
        setForm(EMPTY_FORM());
        setImageFiles([null, null, null]);
        setImagePreviews([null, null, null]);
        load(search || undefined);
      }
    } catch (e: any) {
      showToast(e?.message ?? 'Failed to save', false);
    }
    setSaving(false);
  };

  return (
    <div className="flex gap-lg h-[calc(100vh-80px)]">
      {/* Left — word list */}
      <div className="w-72 flex-shrink-0 flex flex-col gap-sm">
        <div className="flex items-center gap-sm">
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search words…"
            className="flex-1 px-sm py-xs rounded-xl border border-divider font-baloo text-sm focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <button
            onClick={openNew}
            className="px-sm py-xs rounded-xl bg-primary text-white font-baloo font-bold text-sm hover:bg-primary/90 transition-colors"
          >
            + New
          </button>
        </div>

        <div className="flex-1 overflow-y-auto space-y-xs pr-xs">
          {loading ? (
            <div className="text-center py-lg font-baloo text-text-muted text-sm">Loading…</div>
          ) : words.length === 0 ? (
            <div className="text-center py-lg font-baloo text-text-muted text-sm">No words found</div>
          ) : words.map(w => (
            <button
              key={w.id}
              onClick={() => openEdit(w)}
              className={`w-full text-left px-sm py-xs rounded-xl border transition-all ${
                editWord?.id === w.id
                  ? 'bg-primary/5 border-primary text-primary'
                  : 'bg-white border-divider hover:border-primary/40'
              }`}
            >
              <div className="flex items-center gap-xs">
                {w.imageUrl && (
                  <img src={w.imageUrl} alt="" className="w-8 h-8 rounded-md object-cover flex-shrink-0" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-xs">
                    <p className="font-baloo font-semibold text-sm text-text-dark truncate">
                      {w.word?.te || w.word?.en || w.id}
                    </p>
                    {w.status === 'pending' && (
                      <span className="flex-shrink-0 text-[9px] font-baloo font-bold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700">Review</span>
                    )}
                  </div>
                  <p className="font-baloo text-xs text-text-muted truncate">{w.word?.en || ''}</p>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Right — editor */}
      <div className="flex-1 min-w-0 bg-white rounded-2xl border border-divider shadow-sm flex flex-col overflow-hidden">
        {/* Editor header */}
        <div className="px-lg py-md border-b border-divider bg-lavender-light/20 flex items-center justify-between">
          <div>
            <h2 className="font-baloo font-bold text-lg text-text-dark">
              {editWord ? `Editing: ${editWord.word?.te || editWord.word?.en || editWord.id}` : 'New Word'}
            </h2>
            <p className="font-baloo text-xs text-text-muted">
              {editWord ? 'Update word content across languages' : 'Add a new word — submitted for review'}
            </p>
          </div>
          <div className="flex gap-sm items-center">
            {/* 3 image upload slots */}
            {([0, 1, 2] as const).map(idx => (
              <label key={idx} className="cursor-pointer" title={`Image ${idx + 1}`}>
                <input type="file" accept="image/*" onChange={handleImageChange(idx)} className="hidden" />
                {imagePreviews[idx] ? (
                  <img src={imagePreviews[idx]!} alt={`preview ${idx + 1}`} className="w-10 h-10 rounded-lg object-cover border border-divider" />
                ) : (
                  <div className="w-10 h-10 rounded-lg border-2 border-dashed border-divider flex flex-col items-center justify-center text-text-muted hover:border-primary/40">
                    <span className="text-sm">🖼️</span>
                    <span className="text-[9px] font-baloo">{idx + 1}</span>
                  </div>
                )}
              </label>
            ))}
            {/* Word type + difficulty */}
            <select
              value={form.wordType}
              onChange={e => setForm(p => ({ ...p, wordType: e.target.value as any }))}
              className="font-baloo text-xs border border-divider rounded-lg px-xs py-0.5 focus:outline-none"
            >
              <option value="NS360">NS360</option>
              <option value="GQD">GQD</option>
            </select>
            <select
              value={form.difficulty}
              onChange={e => setForm(p => ({ ...p, difficulty: e.target.value as any }))}
              className="font-baloo text-xs border border-divider rounded-lg px-xs py-0.5 focus:outline-none"
            >
              <option value="Low">Low</option>
              <option value="Medium">Medium</option>
              <option value="High">High</option>
            </select>
          </div>
        </div>

        {/* Language tabs */}
        <div className="flex gap-xs px-lg pt-md pb-0 border-b border-divider">
          {LANGS.map(lang => (
            <button
              key={lang}
              onClick={() => setActiveLang(lang)}
              className={`px-md py-xs rounded-t-lg font-baloo font-semibold text-xs border-x border-t transition-all ${
                activeLang === lang
                  ? `${LANG_COLORS[lang]} border-divider -mb-px bg-white`
                  : 'border-transparent text-text-muted hover:text-text-dark'
              }`}
            >
              {LANGUAGE_LABELS[lang]}
            </button>
          ))}
        </div>

        {/* Fields for active language */}
        <div className="flex-1 overflow-y-auto p-lg space-y-md">
          {(['word', 'pronunciation', 'meaning', 'sentence'] as const).map(field => {
            const val = form[field][activeLang];
            return (
              <div key={field}>
                <div className="flex items-center justify-between mb-xs">
                  <label className="font-baloo font-semibold text-sm text-text-dark capitalize">{field}</label>
                  {val && (
                    <button
                      onClick={() => speak(val, activeLang)}
                      className="text-text-muted hover:text-primary text-lg transition-colors"
                      title={`Hear ${field}`}
                    >
                      🔊
                    </button>
                  )}
                </div>
                {field === 'sentence' ? (
                  <textarea
                    value={val}
                    onChange={e => setLangField(field, activeLang, e.target.value)}
                    rows={2}
                    placeholder={`${field} in ${LANGUAGE_LABELS[activeLang]}…`}
                    className="w-full px-md py-sm rounded-xl border border-divider font-baloo text-sm focus:outline-none focus:ring-1 focus:ring-primary resize-none"
                  />
                ) : (
                  <input
                    type="text"
                    value={val}
                    onChange={e => setLangField(field, activeLang, e.target.value)}
                    placeholder={`${field} in ${LANGUAGE_LABELS[activeLang]}…`}
                    className="w-full px-md py-sm rounded-xl border border-divider font-baloo text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                )}
              </div>
            );
          })}
        </div>

        {/* Save bar */}
        <div className="px-lg py-md border-t border-divider flex items-center justify-between bg-white">
          {editWord && (
            <button
              onClick={() => { setEditWord(null); setForm(EMPTY_FORM()); setImagePreviews([null, null, null]); }}
              className="font-baloo text-sm text-text-muted hover:text-text-dark"
            >
              ← New word
            </button>
          )}
          <div className="ml-auto flex gap-sm items-center">
            {/* Fill completion indicator */}
            <div className="flex gap-xs">
              {LANGS.map(lang => {
                const filled = !!(form.word[lang] || form.meaning[lang]);
                return (
                  <button
                    key={lang}
                    onClick={() => setActiveLang(lang)}
                    className={`w-6 h-6 rounded-full text-[10px] font-baloo font-bold border transition-all ${
                      filled
                        ? 'bg-success text-white border-success'
                        : lang === activeLang
                        ? 'border-primary text-primary'
                        : 'border-divider text-text-muted'
                    }`}
                    title={LANGUAGE_LABELS[lang]}
                  >
                    {lang.toUpperCase().slice(0, 2)}
                  </button>
                );
              })}
            </div>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-lg py-sm rounded-xl bg-primary text-white font-baloo font-bold text-sm hover:bg-primary/90 transition-colors shadow-sm disabled:opacity-50"
            >
              {saving ? 'Saving…' : editWord ? 'Update Word' : '→ Submit for Review'}
            </button>
          </div>
        </div>
      </div>

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 40 }}
            className={`fixed bottom-lg right-lg px-lg py-sm rounded-2xl font-baloo font-semibold text-white shadow-lg z-50 ${
              toast.ok ? 'bg-success' : 'bg-error'
            }`}
          >
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
