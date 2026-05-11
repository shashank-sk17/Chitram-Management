import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../config/firebase';
import { useAuthStore } from '../../stores/authStore';
import { getWordBankPage, updateWord, uploadWordImageFile, setWordImageUrls } from '../../services/firebase/wordBank';
import { LANGUAGE_LABELS } from '../../services/firebase/languageCurricula';
import type { WordBankDoc, LanguageCode } from '../../types/firestore';

type WordWithId = { id: string } & WordBankDoc;

const LANGS: LanguageCode[] = ['te', 'en', 'hi', 'es', 'fr'];
const LANG_COLORS: Record<LanguageCode, string> = {
  te: 'bg-amber-50 border-amber-200 text-amber-700',
  en: 'bg-sky-50 border-sky-200 text-sky-700',
  hi: 'bg-orange-50 border-orange-200 text-orange-700',
  es: 'bg-green-50 border-green-200 text-green-700',
  fr: 'bg-blue-50 border-blue-200 text-blue-700',
};

const EMPTY_LANG = () => Object.fromEntries(LANGS.map(l => [l, ''])) as Record<LanguageCode, string>;

function speak(text: string, lang: LanguageCode) {
  if (!text || !window.speechSynthesis) return;
  const langMap: Record<LanguageCode, string> = {
    te: 'te-IN', en: 'en-US', hi: 'hi-IN', es: 'es-ES', fr: 'fr-FR',
  };
  window.speechSynthesis.cancel();
  const utt = new SpeechSynthesisUtterance(text);
  utt.lang = langMap[lang];
  window.speechSynthesis.speak(utt);
}

type FormData = {
  word: Record<LanguageCode, string>;
  meaning: Record<LanguageCode, string>;
  sentence: Record<LanguageCode, string>;
  wordType: 'NS360' | 'GQD';
  difficulty: 'Low' | 'Medium' | 'High';
  grade: number;
};

const EMPTY_FORM = (): FormData => ({
  word: EMPTY_LANG(),
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
  const MAX_IMAGES = 20;
  // Per-slot state: preview = existing URL or object URL; file = new File pending upload; isExisting = came from Firestore
  const emptySlotPreviews = () => Array<string | null>(20).fill(null);
  const emptySlotFiles = () => Array<File | null>(20).fill(null);
  const emptySlotExisting = () => Array<boolean>(20).fill(false);
  const [slotPreviews, setSlotPreviews] = useState<(string | null)[]>(emptySlotPreviews());
  const [slotFiles, setSlotFiles] = useState<(File | null)[]>(emptySlotFiles());
  const [slotIsExisting, setSlotIsExisting] = useState<boolean[]>(emptySlotExisting());
  const [activeLang, setActiveLang] = useState<LanguageCode>('te');
  const [enabledLangs, setEnabledLangs] = useState<Set<LanguageCode>>(new Set<LanguageCode>(['te', 'en']));
  const [translating, setTranslating] = useState<LanguageCode | null>(null);
  const [translatingAll, setTranslatingAll] = useState(false);

  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [translateProvider, setTranslateProvider] = useState<'google' | 'amazon'>(
    () => (localStorage.getItem('translateProvider') as 'google' | 'amazon') ?? 'google'
  );
  const [usage, setUsage] = useState<{
    google: { chars: number; requests: number; limit: number };
    amazon: { chars: number; requests: number; limit: number };
  } | null>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchUsage = async () => {
    try {
      const fn = httpsCallable<unknown, {
        google: { chars: number; requests: number; limit: number };
        amazon: { chars: number; requests: number; limit: number };
      }>(functions, 'getTranslationUsage');
      const res = await fn({});
      setUsage(res.data);
    } catch {}
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

  useEffect(() => { load(); fetchUsage(); }, []);

  useEffect(() => {
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => load(search || undefined), search ? 300 : 0);
  }, [search]);

  const openNew = () => {
    setEditWord(null);
    setForm(EMPTY_FORM());
    setSlotPreviews(emptySlotPreviews());
    setSlotFiles(emptySlotFiles());
    setSlotIsExisting(emptySlotExisting());
    setEnabledLangs(new Set<LanguageCode>(LANGS));
    setActiveLang('te');
    return;
  };

  const openEdit = (w: WordWithId) => {
    setEditWord(w);
    setForm({
      word: { ...EMPTY_LANG(), ...(w.word ?? {}) },
      meaning: { ...EMPTY_LANG(), ...(w.meaning ?? {}) },
      sentence: { ...EMPTY_LANG(), ...(w.sentence ?? {}) },
      wordType: w.wordType ?? 'NS360',
      difficulty: w.difficulty ?? 'Medium',
      grade: 1,
    });
    const urls = w.imageUrls ?? (w.imageUrl ? [w.imageUrl] : []);
    const previews = emptySlotPreviews();
    const existing = emptySlotExisting();
    urls.slice(0, MAX_IMAGES).forEach((url, i) => { if (url) { previews[i] = url; existing[i] = true; } });
    setSlotPreviews(previews);
    setSlotFiles(emptySlotFiles());
    setSlotIsExisting(existing);
    // Enable any language that already has content
    const used = LANGS.filter(l => w.word?.[l] || w.meaning?.[l]);
    setEnabledLangs(new Set<LanguageCode>(used.length > 0 ? used : ['te', 'en']));
    setActiveLang(used[0] ?? 'te');
  };

  const toggleLang = (lang: LanguageCode) => {
    setEnabledLangs(prev => {
      const next = new Set(prev);
      if (next.has(lang)) {
        if (next.size === 1) return prev; // can't disable the last one
        next.delete(lang);
        if (activeLang === lang) setActiveLang([...next][0]);
      } else {
        next.add(lang);
        setActiveLang(lang);
      }
      return next;
    });
  };

  const autoTranslate = async (targetLang: LanguageCode) => {
    const sourceLang = LANGS.find(l => l !== targetLang && (form.word[l] || form.meaning[l]));
    if (!sourceLang) { showToast('Fill in at least one other language first', false); return; }
    setTranslating(targetLang);
    try {
      const translateFn = httpsCallable<unknown, { word: string; meaning: string; sentence: string }>(
        functions, 'translateWordContent'
      );
      const res = await translateFn({
        word: form.word[sourceLang],
        meaning: form.meaning[sourceLang],
        sentence: form.sentence[sourceLang],
        sourceLang,
        targetLang,
        provider: translateProvider,
      });
      const { word: translatedWord, meaning: translatedMeaning, sentence: translatedSentence } = res.data;
      setForm(prev => ({
        ...prev,
        word:    { ...prev.word,    [targetLang]: translatedWord },
        meaning: { ...prev.meaning, [targetLang]: translatedMeaning },
        sentence: { ...prev.sentence, [targetLang]: translatedSentence },
      }));
      showToast(`Translated to ${LANGUAGE_LABELS[targetLang]}!`);
      fetchUsage();
    } catch (e: any) {
      showToast(e?.message ?? 'Translation failed', false);
    }
    setTranslating(null);
  };

  const autoTranslateAll = async () => {
    // Prefer the active tab as source; fall back to first language with any content
    const sourceLang = (form.word[activeLang] || form.meaning[activeLang])
      ? activeLang
      : LANGS.find(l => form.word[l] || form.meaning[l]);
    if (!sourceLang) { showToast('Type a word first', false); return; }
    const targets = LANGS.filter(l => enabledLangs.has(l) && l !== sourceLang);
    if (targets.length === 0) { showToast('Enable more languages to translate into', false); return; }
    setTranslatingAll(true);
    const updated = {
      word: { ...form.word },
      meaning: { ...form.meaning },
      sentence: { ...form.sentence },
    };
    let successCount = 0;
    const translateFn = httpsCallable<unknown, { word: string; meaning: string; sentence: string }>(
      functions, 'translateWordContent'
    );
    for (const targetLang of targets) {
      try {
        const res = await translateFn({
          word: updated.word[sourceLang],
          meaning: updated.meaning[sourceLang],
          sentence: updated.sentence[sourceLang],
          sourceLang,
          targetLang,
          provider: translateProvider,
        });
        updated.word[targetLang] = res.data.word;
        updated.meaning[targetLang] = res.data.meaning;
        updated.sentence[targetLang] = res.data.sentence;
        successCount++;
      } catch {}
    }
    setForm(prev => ({ ...prev, ...updated }));
    setTranslatingAll(false);
    if (successCount > 0) { showToast(`Translated ${successCount} language${successCount !== 1 ? 's' : ''}!`); fetchUsage(); }
    else showToast('Translation failed', false);
  };

  const setLangField = (
    field: 'word' | 'meaning' | 'sentence',
    lang: LanguageCode,
    value: string,
  ) => {
    setForm(prev => ({ ...prev, [field]: { ...prev[field], [lang]: value } }));
  };

  const handleSlotFile = (index: number) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSlotFiles(prev => { const n = [...prev]; n[index] = file; return n; });
    setSlotPreviews(prev => { const n = [...prev]; n[index] = URL.createObjectURL(file); return n; });
    setSlotIsExisting(prev => { const n = [...prev]; n[index] = false; return n; });
  };

  const clearSlot = (index: number) => {
    setSlotFiles(prev => { const n = [...prev]; n[index] = null; return n; });
    setSlotPreviews(prev => { const n = [...prev]; n[index] = null; return n; });
    setSlotIsExisting(prev => { const n = [...prev]; n[index] = false; return n; });
  };

  const handleBulkImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []).slice(0, MAX_IMAGES);
    if (!files.length) return;
    const newPreviews = [...slotPreviews];
    const newFiles = [...slotFiles];
    const newExisting = [...slotIsExisting];
    let fi = 0;
    for (let slot = 0; slot < MAX_IMAGES && fi < files.length; slot++) {
      if (!newPreviews[slot]) {
        newPreviews[slot] = URL.createObjectURL(files[fi]);
        newFiles[slot] = files[fi];
        newExisting[slot] = false;
        fi++;
      }
    }
    setSlotPreviews(newPreviews);
    setSlotFiles(newFiles);
    setSlotIsExisting(newExisting);
    e.target.value = ''; // reset so same files can be re-selected
  };

  const handleSave = async () => {
    if (!user) return;
    if (!LANGS.some(l => form.word[l]?.trim())) {
      showToast('Add the word text in at least one language', false);
      return;
    }
    setSaving(true);
    try {
      if (editWord) {
        await updateWord(editWord.id, {
          word: form.word,
          meaning: form.meaning,
          sentence: form.sentence,
          wordType: form.wordType,
          difficulty: form.difficulty,
        });
        // Build final URL list: keep surviving existing URLs, upload new files
        const finalUrls: (string | null)[] = Array(MAX_IMAGES).fill(null);
        for (let i = 0; i < MAX_IMAGES; i++) {
          if (slotIsExisting[i] && slotPreviews[i]) finalUrls[i] = slotPreviews[i];
        }
        for (let i = 0; i < MAX_IMAGES; i++) {
          if (slotFiles[i]) {
            const url = await uploadWordImageFile(editWord.id, slotFiles[i]!, i);
            finalUrls[i] = url;
          }
        }
        const compacted = finalUrls.filter(Boolean) as string[];
        await setWordImageUrls(editWord.id, compacted);
        setWords(prev => prev.map(w => w.id === editWord.id
          ? { ...w, word: form.word, meaning: form.meaning, sentence: form.sentence, imageUrl: compacted[0] ?? null, imageUrls: compacted }
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
            meaning: form.meaning,
            sentence: form.sentence,
            imageUrl: null,
            imageUrls: [],
            audioUrl: { word: EMPTY_LANG(), meaning: EMPTY_LANG(), sentence: EMPTY_LANG() },
            submittedByName: user.email ?? 'content writer',
          },
        });
        const wordId = result.data.wordId;
        const newUrls: string[] = [];
        for (let i = 0; i < MAX_IMAGES; i++) {
          if (slotFiles[i]) {
            const url = await uploadWordImageFile(wordId, slotFiles[i]!, i);
            newUrls.push(url);
          }
        }
        if (newUrls.length > 0) await setWordImageUrls(wordId, newUrls);
        showToast('Submitted for review!');
        setForm(EMPTY_FORM());
        setSlotPreviews(emptySlotPreviews());
        setSlotFiles(emptySlotFiles());
        setSlotIsExisting(emptySlotExisting());
        load(search || undefined);
      }
    } catch (e: any) {
      showToast(e?.message ?? 'Failed to save', false);
    }
    setSaving(false);
  };

  const [mobileView, setMobileView] = useState<'list' | 'editor'>('list');

  const openEditMobile = (w: WordWithId) => {
    openEdit(w);
    setMobileView('editor');
  };
  const openNewMobile = () => {
    openNew();
    setMobileView('editor');
  };

  const switchProvider = (p: 'google' | 'amazon') => {
    setTranslateProvider(p);
    localStorage.setItem('translateProvider', p);
  };

  return (
    <div className="space-y-lg">

      {/* ── Translation Credits ────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-divider shadow-sm overflow-hidden">
        <div className="px-lg py-md border-b border-divider flex items-center justify-between flex-wrap gap-md" style={{ background: '#F7F6FF' }}>
          <div>
            <p className="font-baloo font-bold text-md text-text-dark">Translation Credits</p>
            <p className="font-baloo text-sm text-text-muted">{new Date().toLocaleString('default', { month: 'long', year: 'numeric' })}</p>
          </div>
          <div className="flex gap-sm">
            {(['google', 'amazon'] as const).map(p => (
              <button
                key={p}
                onClick={() => switchProvider(p)}
                className="font-baloo font-semibold text-sm px-md py-sm rounded-xl border-2 transition-all"
                style={translateProvider === p
                  ? { background: '#7C81FF', color: 'white', borderColor: '#7C81FF' }
                  : { background: 'white', color: '#9E9E9E', borderColor: '#F0EDE8' }
                }
              >
                {p === 'google' ? '🌐 Google' : '☁️ Amazon'}
              </button>
            ))}
          </div>
        </div>
        {usage ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-divider">
            {(['google', 'amazon'] as const).map(p => {
              const u = usage[p];
              const pct = Math.min(100, (u.chars / u.limit) * 100);
              const barColor = pct > 80 ? '#EF4444' : pct > 50 ? '#F59E0B' : '#00BBAE';
              const isActive = translateProvider === p;
              return (
                <div key={p} className="px-lg py-md" style={{ background: isActive ? 'rgba(124,129,255,0.03)' : 'white' }}>
                  <div className="flex items-center justify-between mb-sm">
                    <span className="font-baloo font-semibold text-md text-text-dark">
                      {p === 'google' ? '🌐 Google Translate' : '☁️ Amazon Translate'}
                    </span>
                    <span className="font-baloo text-sm text-text-muted">{u.requests.toLocaleString()} requests</span>
                  </div>
                  <div className="h-2.5 rounded-full overflow-hidden mb-sm" style={{ background: '#F0EDE8' }}>
                    <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: barColor }} />
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="font-baloo font-bold text-sm" style={{ color: barColor }}>{pct.toFixed(1)}% used</span>
                    <span className="font-baloo text-sm text-text-muted">{u.chars.toLocaleString()} / {u.limit.toLocaleString()} chars</span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="h-20 flex items-center justify-center">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </div>

      {/* ── Editor Layout ──────────────────────────────────────────────── */}
      <div className="flex gap-lg md:h-[calc(100vh-100px)]">

        {/* Left — word list */}
        <div className={`w-full md:w-80 flex-shrink-0 flex flex-col gap-md ${mobileView === 'editor' ? 'hidden md:flex' : 'flex'}`}>

          {/* Search + New */}
          <div className="flex items-center gap-sm">
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search words…"
              className="flex-1 px-md py-sm rounded-xl border border-divider font-baloo text-md focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary bg-white"
            />
            <button
              onClick={openNewMobile}
              className="px-md py-sm rounded-xl bg-primary text-white font-baloo font-bold text-md hover:bg-primary/90 transition-colors shadow-sm whitespace-nowrap"
            >
              + New
            </button>
          </div>

          {/* Word list */}
          <div className="flex-1 overflow-y-auto space-y-sm pr-xs">
            {loading ? (
              <div className="flex flex-col items-center gap-md py-xxl text-text-muted">
                <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                <p className="font-baloo text-sm">Loading words…</p>
              </div>
            ) : words.length === 0 ? (
              <div className="text-center py-xxl font-baloo text-text-muted text-md">No words found</div>
            ) : words.map(w => {
              const selected = editWord?.id === w.id;
              return (
                <button
                  key={w.id}
                  onClick={() => openEditMobile(w)}
                  className="w-full text-left rounded-xl border transition-all"
                  style={{
                    background: selected ? '#EDEEFF' : 'white',
                    borderColor: selected ? '#7C81FF' : '#F0EDE8',
                    boxShadow: selected ? '0 0 0 1px #7C81FF20' : 'none',
                  }}
                >
                  <div className="flex items-center gap-md px-md py-sm">
                    {w.imageUrl ? (
                      <img src={w.imageUrl} alt="" className="w-12 h-12 rounded-lg object-cover flex-shrink-0" />
                    ) : (
                      <div className="w-12 h-12 rounded-lg flex-shrink-0 flex items-center justify-center text-xl" style={{ background: '#F7F6F3' }}>📝</div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-xs mb-[2px]">
                        <p className="font-baloo font-bold text-md text-text-dark truncate">
                          {w.word?.te || w.word?.en || w.id}
                        </p>
                        {w.status === 'pending' && (
                          <span className="flex-shrink-0 text-xs font-baloo font-bold px-sm py-[2px] rounded-full bg-amber-100 text-amber-700">Review</span>
                        )}
                      </div>
                      <p className="font-baloo text-sm text-text-muted truncate">{w.word?.en || w.id}</p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right — editor panel */}
        <div className={`flex-1 min-w-0 bg-white rounded-2xl border border-divider shadow-sm flex flex-col overflow-hidden ${mobileView === 'list' ? 'hidden md:flex' : 'flex'}`}>

          {/* Panel header */}
          <div className="px-lg py-md border-b border-divider flex items-center justify-between gap-md flex-wrap" style={{ background: '#F7F6FF' }}>
            <div className="flex items-center gap-md min-w-0">
              <button
                onClick={() => setMobileView('list')}
                className="md:hidden w-10 h-10 rounded-xl flex items-center justify-center text-text-muted hover:bg-lavender-light transition-colors flex-shrink-0 text-lg"
              >
                ←
              </button>
              <div className="min-w-0">
                <h2 className="font-baloo font-extrabold text-lg text-text-dark truncate">
                  {editWord ? (editWord.word?.te || editWord.word?.en || editWord.id) : 'New Word'}
                </h2>
                <p className="font-baloo text-sm text-text-muted">
                  {editWord ? 'Edit content across languages' : 'Submitted for admin review'}
                </p>
              </div>
            </div>
            <div className="flex gap-sm items-center flex-shrink-0 flex-wrap">
              <select
                value={form.wordType}
                onChange={e => setForm(p => ({ ...p, wordType: e.target.value as any }))}
                className="font-baloo font-semibold text-sm border border-divider rounded-xl px-md py-sm focus:outline-none focus:ring-2 focus:ring-primary/30 bg-white"
              >
                <option value="NS360">NS360</option>
                <option value="GQD">GQD</option>
              </select>
              <select
                value={form.difficulty}
                onChange={e => setForm(p => ({ ...p, difficulty: e.target.value as any }))}
                className="font-baloo font-semibold text-sm border border-divider rounded-xl px-md py-sm focus:outline-none focus:ring-2 focus:ring-primary/30 bg-white"
              >
                <option value="Low">Low</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
              </select>
            </div>
          </div>

          {/* Language toggles */}
          <div className="flex items-center gap-sm px-lg py-sm border-b border-divider flex-wrap" style={{ background: '#FAFAFA' }}>
            <span className="font-baloo text-sm text-text-muted font-medium flex-shrink-0">Languages:</span>
            {LANGS.map(lang => {
              const on = enabledLangs.has(lang);
              return (
                <button
                  key={lang}
                  onClick={() => toggleLang(lang)}
                  className={`px-md py-xs rounded-full font-baloo font-semibold text-sm border transition-all ${
                    on
                      ? `${LANG_COLORS[lang]} shadow-sm`
                      : 'border-divider text-text-muted hover:border-primary/40 hover:text-text-dark bg-white'
                  }`}
                >
                  {on ? '✓ ' : '+ '}{LANGUAGE_LABELS[lang]}
                </button>
              );
            })}
            {/* Enable All */}
            {enabledLangs.size < LANGS.length && (
              <button
                onClick={() => setEnabledLangs(new Set(LANGS))}
                className="px-md py-xs rounded-full font-baloo font-semibold text-sm border border-dashed border-primary/40 text-primary hover:bg-lavender-light/40 bg-white transition-all"
              >
                + All
              </button>
            )}
          </div>

          {/* Language tabs */}
          <div className="flex gap-xs px-lg pt-md pb-0 border-b border-divider overflow-x-auto">
            {LANGS.filter(l => enabledLangs.has(l)).map(lang => (
              <button
                key={lang}
                onClick={() => setActiveLang(lang)}
                className={`px-lg py-sm rounded-t-xl font-baloo font-semibold text-md border-x border-t whitespace-nowrap transition-all ${
                  activeLang === lang
                    ? `${LANG_COLORS[lang]} border-divider -mb-px bg-white`
                    : 'border-transparent text-text-muted hover:text-text-dark'
                }`}
              >
                {LANGUAGE_LABELS[lang]}
              </button>
            ))}
          </div>

          {/* Form fields */}
          <div className="flex-1 overflow-y-auto p-lg space-y-lg">

            {/* Auto-translate banner — this tab is empty, fill it from another language */}
            {!form.word[activeLang] && !form.meaning[activeLang] && LANGS.some(l => l !== activeLang && (form.word[l] || form.meaning[l])) && (
              <div className="flex items-center gap-md p-lg rounded-xl border border-primary/20" style={{ background: 'rgba(124,129,255,0.05)' }}>
                <span className="text-2xl flex-shrink-0">✨</span>
                <div className="flex-1 min-w-0">
                  <p className="font-baloo font-bold text-md text-text-dark">No {LANGUAGE_LABELS[activeLang]} content yet</p>
                  <p className="font-baloo text-sm text-text-muted">Auto-fill from another language using {translateProvider === 'google' ? 'Google' : 'Amazon'} Translate</p>
                </div>
                <button
                  onClick={() => autoTranslate(activeLang)}
                  disabled={translating !== null}
                  className="flex-shrink-0 px-lg py-sm rounded-xl bg-primary text-white font-baloo font-bold text-md hover:bg-primary/90 disabled:opacity-50 transition-colors whitespace-nowrap"
                >
                  {translating === activeLang ? 'Translating…' : '✨ Translate'}
                </button>
              </div>
            )}

            {/* Translate All banner — this tab has content, push it to all other selected languages */}
            {(form.word[activeLang] || form.meaning[activeLang]) && enabledLangs.size > 1 && (
              <div className="flex items-center gap-md p-md rounded-xl border border-primary/20" style={{ background: 'rgba(124,129,255,0.05)' }}>
                <span className="text-xl flex-shrink-0">🌐</span>
                <div className="flex-1 min-w-0">
                  <p className="font-baloo font-semibold text-sm text-text-dark">
                    Translate from {LANGUAGE_LABELS[activeLang]} → all selected languages
                  </p>
                  <p className="font-baloo text-xs text-text-muted">
                    Fills word, meaning &amp; sentence for:{' '}
                    {LANGS.filter(l => enabledLangs.has(l) && l !== activeLang).map(l => LANGUAGE_LABELS[l]).join(', ')}
                  </p>
                </div>
                <button
                  onClick={autoTranslateAll}
                  disabled={translatingAll || translating !== null}
                  className="flex-shrink-0 px-lg py-sm rounded-xl font-baloo font-bold text-md transition-colors whitespace-nowrap disabled:opacity-50"
                  style={{ background: '#7C81FF', color: 'white' }}
                >
                  {translatingAll ? '⏳ Translating…' : '✨ Translate All'}
                </button>
              </div>
            )}

            {/* Reference images */}
            <div>
              <div className="flex items-center justify-between mb-md">
                <div>
                  <p className="font-baloo font-bold text-md text-text-dark">Reference Images</p>
                  <p className="font-baloo text-sm text-text-muted">{slotPreviews.filter(Boolean).length} of 20 · one random image shown per drawing session</p>
                </div>
                <label className="cursor-pointer px-md py-sm rounded-xl font-baloo font-semibold text-sm transition-colors" style={{ background: '#EDEEFF', color: '#7C81FF' }}>
                  Upload multiple
                  <input type="file" accept="image/*" multiple className="hidden" onChange={handleBulkImageSelect} />
                </label>
              </div>
              <div className="grid grid-cols-4 sm:grid-cols-5 gap-sm">
                {Array.from({ length: MAX_IMAGES }, (_, i) => (
                  <div key={i} className="relative group">
                    {slotPreviews[i] ? (
                      <>
                        <img
                          src={slotPreviews[i]!}
                          alt={`ref ${i + 1}`}
                          className="w-full aspect-square object-cover rounded-xl border border-divider"
                        />
                        <button
                          onClick={() => clearSlot(i)}
                          className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/60 text-white text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                          title="Remove"
                        >
                          ✕
                        </button>
                      </>
                    ) : (
                      <label className="cursor-pointer w-full aspect-square rounded-xl border-2 border-dashed border-divider flex flex-col items-center justify-center text-text-muted hover:border-primary/40 hover:bg-lavender-light/20 transition-colors">
                        <input type="file" accept="image/*" onChange={handleSlotFile(i)} className="hidden" />
                        <span className="text-xl">🖼️</span>
                        <span className="font-baloo text-xs mt-xs font-semibold text-text-muted">{i + 1}</span>
                      </label>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Word fields */}
            {(['word', 'meaning', 'sentence'] as const).map(field => {
              const val = form[field][activeLang];
              const fieldLabels: Record<string, string> = {
                word: 'Word',
                meaning: 'Meaning',
                sentence: 'Example Sentence',
              };
              return (
                <div key={field}>
                  <div className="flex items-center justify-between mb-sm">
                    <label className="font-baloo font-bold text-md text-text-dark">{fieldLabels[field]}</label>
                    <div className="flex items-center gap-xs">
                      {val && (
                        <button
                          onClick={() => speak(val, activeLang)}
                          className="w-9 h-9 rounded-xl flex items-center justify-center text-text-muted hover:text-primary hover:bg-lavender-light transition-colors text-lg"
                          title={`Hear ${field}`}
                        >
                          🔊
                        </button>
                      )}
                    </div>
                  </div>
                  {field === 'sentence' ? (
                    <textarea
                      value={val}
                      onChange={e => setLangField(field, activeLang, e.target.value)}
                      rows={3}
                      placeholder={`${fieldLabels[field]} in ${LANGUAGE_LABELS[activeLang]}…`}
                      className="w-full px-md py-sm rounded-xl border border-divider font-baloo text-md focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary resize-none leading-relaxed"
                    />
                  ) : (
                    <input
                      type="text"
                      value={val}
                      onChange={e => setLangField(field, activeLang, e.target.value)}
                      placeholder={`${fieldLabels[field]} in ${LANGUAGE_LABELS[activeLang]}…`}
                      className="w-full px-md py-sm rounded-xl border border-divider font-baloo text-md focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                    />
                  )}
                </div>
              );
            })}
          </div>

          {/* Save bar */}
          <div className="px-lg py-md border-t border-divider flex items-center justify-between gap-md bg-white">
            {editWord ? (
              <button
                onClick={() => { setEditWord(null); setForm(EMPTY_FORM()); setSlotPreviews(emptySlotPreviews()); setSlotFiles(emptySlotFiles()); setSlotIsExisting(emptySlotExisting()); }}
                className="font-baloo font-semibold text-sm text-text-muted hover:text-text-dark hidden sm:flex items-center gap-xs transition-colors"
              >
                ← New word
              </button>
            ) : <div />}

            <div className="flex gap-sm items-center">
              {/* Language fill dots */}
              <div className="flex gap-xs items-center">
                {LANGS.map(lang => {
                  const filled = !!(form.word[lang] || form.meaning[lang]);
                  return (
                    <button
                      key={lang}
                      onClick={() => setActiveLang(lang)}
                      className="w-8 h-8 rounded-full font-baloo font-bold text-xs border-2 transition-all flex items-center justify-center"
                      style={filled
                        ? { background: '#4CAF82', borderColor: '#4CAF82', color: 'white' }
                        : lang === activeLang
                        ? { background: 'white', borderColor: '#7C81FF', color: '#7C81FF' }
                        : { background: 'white', borderColor: '#F0EDE8', color: '#9E9E9E' }
                      }
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
                className="px-xl py-sm rounded-xl bg-primary text-white font-baloo font-bold text-md hover:bg-primary/90 transition-colors shadow-sm disabled:opacity-50"
              >
                {saving ? 'Saving…' : editWord ? 'Update Word' : 'Submit for Review →'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 40, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 40, scale: 0.95 }}
            className={`fixed bottom-xl right-xl px-xl py-md rounded-2xl font-baloo font-bold text-md text-white shadow-lg z-50 ${
              toast.ok ? 'bg-success' : 'bg-error'
            }`}
          >
            {toast.ok ? '✓ ' : '⚠ '}{toast.msg}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
