import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from '../../stores/authStore';
import { useAuth } from '../../features/auth/hooks/useAuth';
import { usePermission } from '../../hooks/usePermission';
import type { WordBankDoc, LanguageCode } from '../../types/firestore';
import { getWordBankPage, updateWord, approveWord, rejectWord, uploadWordImage, setWordImageUrls } from '../../services/firebase/wordBank';
import type { WordBankFilters } from '../../services/firebase/wordBank';
import { LANGUAGE_LABELS } from '../../services/firebase/languageCurricula';

const LANGS: LanguageCode[] = ['te', 'en', 'hi', 'mr', 'es', 'fr'];
const STATUS_BADGE: Record<string, string> = {
  active: 'bg-success/10 text-success',
  pending: 'bg-amber-50 text-amber-600',
  rejected: 'bg-error/10 text-error',
};

type WordWithId = { id: string } & WordBankDoc;
type ModalTab = 'review' | 'content' | 'media' | 'settings';

// ── Read-only field display ───────────────────────────────────────────────────
function FieldRow({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div>
      <span className="font-baloo text-xs text-text-muted block mb-0.5 capitalize">{label}</span>
      <span className="font-baloo text-sm text-text-dark">{value}</span>
    </div>
  );
}

// ── TTS helper ───────────────────────────────────────────────────────────────
const LANG_BCP47: Record<LanguageCode, string> = {
  te: 'te-IN', en: 'en-US', hi: 'hi-IN', mr: 'mr-IN', es: 'es-ES', fr: 'fr-FR',
};
function speakText(text: string, lang: LanguageCode) {
  if (!text || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const utt = new SpeechSynthesisUtterance(text);
  utt.lang = LANG_BCP47[lang];
  window.speechSynthesis.speak(utt);
}

// ── Language content card (review mode) ──────────────────────────────────────
function LangCard({ lang, word }: { lang: LanguageCode; word: WordBankDoc }) {
  const wordVal = word.word?.[lang];
  const pronVal = word.pronunciation?.[lang];
  const meaningVal = word.meaning?.[lang];
  const sentenceVal = word.sentence?.[lang];

  if (!wordVal && !meaningVal) return null;

  return (
    <div className="bg-gray-50 rounded-xl p-md space-y-sm border border-divider">
      <div className="flex items-center justify-between gap-xs mb-xs">
        <span className="font-baloo font-bold text-sm text-primary">{LANGUAGE_LABELS[lang]}</span>
        <div className="flex gap-xs">
          {wordVal && (
            <button onClick={() => speakText(wordVal, lang)} title="Hear word"
              className="text-xs px-xs py-0.5 rounded-lg bg-white border border-divider text-text-muted hover:text-primary hover:border-primary transition-colors font-baloo">
              🔊 Word
            </button>
          )}
          {meaningVal && (
            <button onClick={() => speakText(meaningVal, lang)} title="Hear meaning"
              className="text-xs px-xs py-0.5 rounded-lg bg-white border border-divider text-text-muted hover:text-secondary hover:border-secondary transition-colors font-baloo">
              🔊 Meaning
            </button>
          )}
          {sentenceVal && (
            <button onClick={() => speakText(sentenceVal, lang)} title="Hear sentence"
              className="text-xs px-xs py-0.5 rounded-lg bg-white border border-divider text-text-muted hover:text-accent hover:border-accent transition-colors font-baloo">
              🔊 Sentence
            </button>
          )}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-sm">
        <FieldRow label="Word" value={wordVal} />
        <FieldRow label="Pronunciation" value={pronVal} />
        <FieldRow label="Meaning" value={meaningVal} />
        <FieldRow label="Sentence" value={sentenceVal} />
      </div>
    </div>
  );
}

export default function WordBankPage() {
  const { user } = useAuthStore();
  const { claims } = useAuth();
  const { can } = usePermission();
  const isProjectAdmin = claims?.role === 'projectAdmin';
  const myProjectId = claims?.projectId;

  const [words, setWords] = useState<WordWithId[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'active' | 'pending' | 'rejected'>(isProjectAdmin ? 'pending' : 'active');
  const [search, setSearch] = useState('');
  const [editWord, setEditWord] = useState<WordWithId | null>(null);
  const [modalTab, setModalTab] = useState<ModalTab>('review');
  const [editForm, setEditForm] = useState<Partial<WordBankDoc>>({});
  const [saving, setSaving] = useState(false);
  const [rejectNote, setRejectNote] = useState('');
  const [showRejectInput, setShowRejectInput] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const MAX_IMAGES = 20;
  const emptyMediaSlots = () => Array<string | null>(MAX_IMAGES).fill(null);
  const [mediaSlots, setMediaSlots] = useState<(string | null)[]>(emptyMediaSlots());

  const load = async (f: WordBankFilters) => {
    setLoading(true);
    try {
      const { words: fetched } = await getWordBankPage(f, undefined, 100);
      setWords(fetched);
    } catch {}
    setLoading(false);
  };

  useEffect(() => {
    const f: WordBankFilters = {
      status: activeTab === 'all' ? undefined : activeTab as any,
      search: search || undefined,
      projectId: isProjectAdmin && myProjectId ? myProjectId : undefined,
    };
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => load(f), search ? 300 : 0);
  }, [activeTab, search, isProjectAdmin, myProjectId]);

  const openWord = (w: WordWithId) => {
    setEditWord(w);
    setEditForm({ ...w });
    setModalTab(w.status === 'pending' ? 'review' : 'content');
    setShowRejectInput(false);
    setRejectNote('');
    const urls = w.imageUrls ?? (w.imageUrl ? [w.imageUrl] : []);
    const slots = emptyMediaSlots();
    urls.slice(0, MAX_IMAGES).forEach((url, i) => { if (url) slots[i] = url; });
    setMediaSlots(slots);
  };

  const saveEdit = async () => {
    if (!editWord || !user) return;
    setSaving(true);
    try {
      await updateWord(editWord.id, editForm);
      setWords(prev => prev.map(w => w.id === editWord.id ? { ...w, ...editForm } : w));
      setEditWord(null);
    } catch (err) {
      console.error('Failed to save word:', err);
    }
    setSaving(false);
  };

  const handleApprove = async (wordId: string) => {
    if (!user) return;
    setSaving(true);
    try {
      await approveWord(wordId, user.uid);
      setWords(prev => prev.map(w => w.id === wordId ? { ...w, status: 'active', active: true } : w));
      setEditWord(null);
    } catch (err) {
      console.error('Failed to approve word:', err);
    }
    setSaving(false);
  };

  const handleReject = async (wordId: string) => {
    if (!user || !rejectNote.trim()) return;
    setSaving(true);
    try {
      await rejectWord(wordId, user.uid, rejectNote);
      setWords(prev => prev.map(w => w.id === wordId ? { ...w, status: 'rejected' } : w));
      setEditWord(null);
    } catch (err) {
      console.error('Failed to reject word:', err);
    }
    setSaving(false);
  };

  const handleMediaSlotUpload = (index: number) => async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!editWord || !e.target.files?.[0]) return;
    setSaving(true);
    try {
      const url = await uploadWordImage(editWord.id, e.target.files[0], index);
      setMediaSlots(prev => { const n = [...prev]; n[index] = url; return n; });
      setEditForm(prev => ({ ...prev, imageUrl: url || prev.imageUrl }));
      setWords(prev => prev.map(w => {
        if (w.id !== editWord.id) return w;
        const newUrls = [...(w.imageUrls ?? [])];
        newUrls[index] = url;
        const compacted = newUrls.filter(Boolean) as string[];
        return { ...w, imageUrl: compacted[0] ?? null, imageUrls: compacted };
      }));
    } catch (err) {
      console.error('Failed to upload image:', err);
    }
    setSaving(false);
  };

  const handleBulkMediaUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!editWord) return;
    const files = Array.from(e.target.files ?? []).slice(0, MAX_IMAGES);
    if (!files.length) return;
    setSaving(true);
    try {
      const newSlots = [...mediaSlots];
      for (const file of files) {
        const emptyIdx = newSlots.findIndex(s => !s);
        if (emptyIdx === -1) break;
        const url = await uploadWordImage(editWord.id, file, emptyIdx);
        newSlots[emptyIdx] = url;
      }
      setMediaSlots(newSlots);
      const compacted = newSlots.filter(Boolean) as string[];
      setEditForm(prev => ({ ...prev, imageUrl: compacted[0] ?? null }));
      setWords(prev => prev.map(w => w.id === editWord.id ? { ...w, imageUrl: compacted[0] ?? null, imageUrls: compacted } : w));
    } catch (err) {
      console.error('Bulk upload failed:', err);
    }
    setSaving(false);
    e.target.value = '';
  };

  const removeMediaSlot = async (index: number) => {
    if (!editWord) return;
    setSaving(true);
    try {
      const newSlots = [...mediaSlots];
      newSlots[index] = null;
      const compacted = newSlots.filter(Boolean) as string[];
      await setWordImageUrls(editWord.id, compacted);
      setMediaSlots(newSlots);
      setEditForm(prev => ({ ...prev, imageUrl: compacted[0] ?? null }));
      setWords(prev => prev.map(w => w.id === editWord.id ? { ...w, imageUrl: compacted[0] ?? null, imageUrls: compacted } : w));
    } catch (err) {
      console.error('Failed to remove image:', err);
    }
    setSaving(false);
  };

  const tabCounts = {
    all: words.length,
    active: words.filter(w => w.status === 'active').length,
    pending: words.filter(w => w.status === 'pending').length,
    rejected: words.filter(w => w.status === 'rejected').length,
  };

  const isPending = editWord?.status === 'pending';
  const modalTabs: { id: ModalTab; label: string }[] = isPending
    ? [{ id: 'review', label: '👁 Review' }, { id: 'content', label: 'Content' }, { id: 'media', label: 'Media' }, { id: 'settings', label: 'Settings' }]
    : [{ id: 'content', label: 'Content' }, { id: 'media', label: 'Media' }, { id: 'settings', label: 'Settings' }];

  return (
    <div className="space-y-lg">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-baloo font-extrabold text-xxl text-text-dark">Word Bank</h1>
          <p className="font-baloo text-text-muted">
            {isProjectAdmin ? 'Reviewing word submissions from your project' : 'Manage all vocabulary words'}
          </p>
        </div>
        <div className="flex items-center gap-sm bg-white rounded-xl px-md py-sm shadow-sm border border-divider">
          <span className="text-2xl">📚</span>
          <div>
            <p className="font-baloo font-bold text-lg text-text-dark">{words.length}</p>
            <p className="font-baloo text-xs text-text-muted">words loaded</p>
          </div>
        </div>
      </div>

      {/* Status tabs */}
      <div className="flex gap-xs bg-white rounded-xl p-xs shadow-sm border border-divider w-fit">
        {(['all', 'active', 'pending', 'rejected'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-md py-xs rounded-lg font-baloo font-semibold text-sm capitalize transition-all ${
              activeTab === tab ? 'bg-primary text-white shadow-sm' : 'text-text-muted hover:text-text-dark'
            }`}
          >
            {tab}
            {tabCounts[tab] > 0 && (
              <span className={`ml-xs text-[11px] px-xs py-0.5 rounded-full ${
                activeTab === tab ? 'bg-white/20 text-white' : 'bg-gray-100 text-text-muted'
              }`}>
                {tabCounts[tab]}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <span className="absolute left-md top-1/2 -translate-y-1/2 text-text-muted">🔍</span>
        <input
          type="text"
          placeholder="Search words in any language…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full pl-10 pr-md py-sm rounded-xl border border-divider font-baloo text-sm focus:outline-none focus:ring-2 focus:ring-primary bg-white shadow-sm"
        />
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-divider overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-lavender-light/30 border-b border-divider">
                <th className="px-md py-sm text-left font-baloo font-bold text-sm text-text-dark w-14">#</th>
                <th className="px-md py-sm text-left font-baloo font-bold text-sm text-text-dark w-16">Image</th>
                <th className="px-md py-sm text-left font-baloo font-bold text-sm text-text-dark">Telugu</th>
                <th className="px-md py-sm text-left font-baloo font-bold text-sm text-text-dark">English</th>
                <th className="px-md py-sm text-left font-baloo font-bold text-sm text-text-dark">Pronunciation</th>
                <th className="px-md py-sm text-left font-baloo font-bold text-sm text-text-dark">Meaning (EN)</th>
                <th className="px-md py-sm text-left font-baloo font-bold text-sm text-text-dark">Type</th>
                <th className="px-md py-sm text-left font-baloo font-bold text-sm text-text-dark">Status</th>
                <th className="px-md py-sm text-left font-baloo font-bold text-sm text-text-dark">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={9} className="px-md py-xl text-center font-baloo text-text-muted">
                    Loading words…
                  </td>
                </tr>
              ) : words.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-md py-xl text-center font-baloo text-text-muted">
                    No words found
                  </td>
                </tr>
              ) : (
                words.map((w, i) => (
                  <tr key={w.id} className="border-b border-divider hover:bg-lavender-light/20 transition-colors">
                    <td className="px-md py-sm font-baloo text-sm text-text-muted">{i + 1}</td>
                    <td className="px-md py-sm">
                      {w.imageUrl ? (
                        <img src={w.imageUrl} alt="" className="w-10 h-10 rounded-lg object-cover" />
                      ) : (
                        <div className="w-10 h-10 rounded-lg bg-lavender-light flex items-center justify-center text-xl">📝</div>
                      )}
                    </td>
                    <td className="px-md py-sm font-baloo font-semibold text-sm text-text-dark">{w.word?.te || '—'}</td>
                    <td className="px-md py-sm font-baloo text-sm text-text-muted">{w.word?.en || '—'}</td>
                    <td className="px-md py-sm font-baloo text-sm text-text-muted">{w.pronunciation?.te || w.pronunciation?.en || '—'}</td>
                    <td className="px-md py-sm font-baloo text-sm text-text-muted max-w-[160px] truncate">{w.meaning?.en || '—'}</td>
                    <td className="px-md py-sm">
                      <span className="px-sm py-0.5 bg-lavender-light text-primary font-baloo font-semibold text-xs rounded-full">{w.wordType}</span>
                    </td>
                    <td className="px-md py-sm">
                      <span className={`px-sm py-0.5 font-baloo font-semibold text-xs rounded-full capitalize ${STATUS_BADGE[w.status] || ''}`}>
                        {w.status}
                      </span>
                    </td>
                    <td className="px-md py-sm">
                      <button
                        onClick={() => openWord(w)}
                        className={`px-sm py-xs font-baloo font-semibold text-xs rounded-lg transition-colors ${
                          w.status === 'pending'
                            ? 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                            : 'bg-lavender-light text-primary hover:bg-primary hover:text-white'
                        }`}
                      >
                        {w.status === 'pending' ? '👁 Review' : 'Edit'}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Word Detail Modal */}
      <AnimatePresence>
        {editWord && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/40 z-50"
              onClick={() => setEditWord(null)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="fixed inset-x-4 top-8 bottom-8 md:inset-x-auto md:left-1/2 md:-translate-x-1/2 md:w-[720px] bg-white rounded-2xl shadow-2xl z-50 flex flex-col overflow-hidden"
            >
              {/* Modal header */}
              <div className="px-lg py-md border-b border-divider bg-lavender-light/30">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-sm">
                    <div>
                      <h2 className="font-baloo font-bold text-lg text-text-dark">
                        {editWord.word?.te || editWord.word?.en || 'Word Details'}
                        {editWord.word?.en && editWord.word?.te && (
                          <span className="text-text-muted font-normal ml-sm text-base">· {editWord.word.en}</span>
                        )}
                      </h2>
                      <div className="flex items-center gap-xs mt-0.5">
                        <span className={`text-xs font-baloo font-semibold px-sm py-0.5 rounded-full capitalize ${STATUS_BADGE[editWord.status] || ''}`}>
                          {editWord.status}
                        </span>
                        <span className="text-xs font-baloo text-text-muted px-sm py-0.5 bg-white/60 rounded-full">{editWord.wordType}</span>
                        <span className="text-xs font-baloo text-text-muted px-sm py-0.5 bg-white/60 rounded-full">{editWord.difficulty}</span>
                      </div>
                    </div>
                  </div>
                  <button onClick={() => setEditWord(null)} className="w-8 h-8 rounded-full bg-white/60 flex items-center justify-center text-text-muted hover:text-text-dark">✕</button>
                </div>
                {/* Tabs */}
                <div className="flex gap-xs mt-sm">
                  {modalTabs.map(t => (
                    <button
                      key={t.id}
                      onClick={() => setModalTab(t.id)}
                      className={`px-md py-xs rounded-lg font-baloo font-semibold text-sm transition-all ${
                        modalTab === t.id ? 'bg-white text-primary shadow-sm' : 'text-text-muted hover:text-text-dark'
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Modal body */}
              <div className="flex-1 overflow-y-auto p-lg space-y-md">

                {/* ── Review tab ── */}
                {modalTab === 'review' && (
                  <div className="space-y-md">
                    {/* Image + meta row */}
                    <div className="flex gap-md">
                      {/* Image */}
                      <div className="flex-shrink-0">
                        {editWord.imageUrl ? (
                          <img
                            src={editWord.imageUrl}
                            alt={editWord.word?.en || ''}
                            className="w-40 h-40 object-cover rounded-2xl border border-divider shadow-sm"
                          />
                        ) : (
                          <div className="w-40 h-40 rounded-2xl bg-lavender-light/60 border-2 border-dashed border-divider flex flex-col items-center justify-center gap-sm text-text-muted">
                            <span className="text-4xl">🖼</span>
                            <span className="font-baloo text-xs">No image</span>
                          </div>
                        )}
                      </div>

                      {/* Submitter meta */}
                      <div className="flex-1 space-y-sm">
                        <div className="bg-amber-50 rounded-xl p-md space-y-xs border border-amber-100">
                          <p className="font-baloo font-bold text-sm text-amber-700">Pending Review</p>
                          <div className="space-y-1">
                            {editWord.submittedByName ? (
                              <p className="font-baloo text-xs text-amber-600">
                                Teacher: <span className="font-semibold text-amber-800">{editWord.submittedByName}</span>
                              </p>
                            ) : editWord.submittedBy ? (
                              <p className="font-baloo text-xs text-amber-600">
                                Teacher UID: <span className="font-semibold font-mono">{editWord.submittedBy.slice(0, 12)}…</span>
                              </p>
                            ) : null}
                            {editWord.submittedBySchoolName ? (
                              <p className="font-baloo text-xs text-amber-600">
                                School: <span className="font-semibold text-amber-800">{editWord.submittedBySchoolName}</span>
                              </p>
                            ) : editWord.submittedBySchoolId ? (
                              <p className="font-baloo text-xs text-amber-600">
                                School ID: <span className="font-semibold font-mono">{editWord.submittedBySchoolId.slice(0, 10)}…</span>
                              </p>
                            ) : null}
                            {editWord.submittedByProjectId && (
                              <p className="font-baloo text-xs text-amber-600">
                                Project: <span className="font-semibold font-mono">{editWord.submittedByProjectId.slice(0, 10)}…</span>
                              </p>
                            )}
                            {editWord.gradeContext && (
                              <p className="font-baloo text-xs text-amber-600">
                                Grade: <span className="font-semibold text-amber-800">{editWord.gradeContext}</span>
                              </p>
                            )}
                            {editWord.submittedAt && (
                              <p className="font-baloo text-xs text-amber-600">
                                Submitted: <span className="font-semibold">{(editWord.submittedAt as any).toDate?.().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) || '—'}</span>
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-xs">
                          <div className="bg-gray-50 rounded-lg px-sm py-xs">
                            <p className="font-baloo text-xs text-text-muted">Type</p>
                            <p className="font-baloo font-semibold text-sm text-text-dark">{editWord.wordType}</p>
                          </div>
                          <div className="bg-gray-50 rounded-lg px-sm py-xs">
                            <p className="font-baloo text-xs text-text-muted">Difficulty</p>
                            <p className="font-baloo font-semibold text-sm text-text-dark">{editWord.difficulty}</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Language content cards */}
                    <div>
                      <p className="font-baloo font-bold text-sm text-text-dark mb-sm">Word Content</p>
                      <div className="space-y-sm">
                        {LANGS.map(lang => (
                          <LangCard key={lang} lang={lang} word={editWord} />
                        ))}
                      </div>
                    </div>

                    {/* Approve / Reject */}
                    {(can('wordBank.approve') || can('wordBank.reject')) && (
                      <div className="border-t border-divider pt-md">
                        {showRejectInput ? (
                          <div className="space-y-sm">
                            <p className="font-baloo font-bold text-sm text-error">Rejection reason</p>
                            <textarea
                              value={rejectNote}
                              onChange={e => setRejectNote(e.target.value)}
                              placeholder="Explain why this word is being rejected…"
                              rows={3}
                              className="w-full px-md py-sm rounded-xl border border-error/40 font-baloo text-sm focus:outline-none focus:ring-1 focus:ring-error"
                            />
                            <div className="flex gap-sm">
                              <button onClick={() => setShowRejectInput(false)} className="flex-1 py-sm rounded-xl border-2 border-divider font-baloo font-semibold text-sm text-text-muted">
                                Cancel
                              </button>
                              {can('wordBank.reject') && (
                                <button
                                  onClick={() => handleReject(editWord.id)}
                                  disabled={!rejectNote.trim() || saving}
                                  className="flex-1 py-sm rounded-xl bg-error text-white font-baloo font-bold text-sm disabled:opacity-50"
                                >
                                  {saving ? 'Rejecting…' : 'Confirm Reject'}
                                </button>
                              )}
                            </div>
                          </div>
                        ) : (
                          <div className="flex gap-sm">
                            {can('wordBank.approve') && (
                              <button
                                onClick={() => handleApprove(editWord.id)}
                                disabled={saving}
                                className="flex-1 py-md rounded-xl bg-success text-white font-baloo font-bold text-base hover:bg-success/90 transition-colors shadow-sm"
                              >
                                {saving ? 'Approving…' : '✓ Approve Word'}
                              </button>
                            )}
                            {can('wordBank.reject') && (
                              <button
                                onClick={() => setShowRejectInput(true)}
                                className="flex-1 py-md rounded-xl border-2 border-error text-error font-baloo font-bold text-base hover:bg-error hover:text-white transition-colors"
                              >
                                ✕ Reject
                              </button>
                            )}
                          </div>
                        )}
                        <p className="font-baloo text-xs text-text-muted text-center mt-sm">
                          Switch to the Content tab to edit word details before approving.
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* ── Content tab (editable) ── */}
                {modalTab === 'content' && (
                  <div className="space-y-md">
                    {LANGS.map(lang => (
                      <div key={lang} className="bg-gray-50 rounded-xl p-md space-y-sm">
                        <h3 className="font-baloo font-bold text-sm text-text-dark">{LANGUAGE_LABELS[lang]}</h3>
                        <div className="grid grid-cols-2 gap-sm">
                          {(['word', 'pronunciation', 'meaning', 'sentence'] as const).map(field => (
                            <div key={field}>
                              <label className="font-baloo text-xs text-text-muted mb-xs block capitalize">{field}</label>
                              <input
                                type="text"
                                value={(editForm as any)[field]?.[lang] || ''}
                                onChange={e => setEditForm(prev => ({
                                  ...prev,
                                  [field]: { ...(prev as any)[field], [lang]: e.target.value }
                                }))}
                                className="w-full px-sm py-xs rounded-lg border border-divider font-baloo text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}

                    {/* Approve/reject section in edit tab too for pending words */}
                    {isPending && (can('wordBank.edit') || can('wordBank.approve')) && (
                      <div className="border-t border-divider pt-md">
                        <p className="font-baloo text-xs text-text-muted mb-sm">Save changes then approve, or approve as-is:</p>
                        <div className="flex gap-sm">
                          {can('wordBank.edit') && (
                            <button
                              onClick={saveEdit}
                              disabled={saving}
                              className="flex-1 py-sm rounded-xl bg-primary text-white font-baloo font-bold text-sm hover:bg-primary/90 disabled:opacity-50"
                            >
                              {saving ? 'Saving…' : 'Save Changes'}
                            </button>
                          )}
                          {can('wordBank.approve') && (
                            <button
                              onClick={() => handleApprove(editWord!.id)}
                              disabled={saving}
                              className="flex-1 py-sm rounded-xl bg-success text-white font-baloo font-bold text-sm hover:bg-success/90 disabled:opacity-50"
                            >
                              ✓ Approve
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* ── Media tab ── */}
                {modalTab === 'media' && (
                  <div className="space-y-md">
                    <div className="flex items-center justify-between">
                      <p className="font-baloo font-bold text-sm text-text-dark">Reference Images</p>
                      <div className="flex items-center gap-sm">
                        <p className="font-baloo text-xs text-text-muted">
                          {mediaSlots.filter(Boolean).length}/20 · one shown at random per drawing session
                        </p>
                        <label className={`cursor-pointer px-sm py-0.5 rounded-lg bg-lavender-light text-primary font-baloo font-semibold text-xs hover:bg-primary hover:text-white transition-colors ${saving ? 'pointer-events-none opacity-50' : ''}`}>
                          Upload multiple
                          <input type="file" accept="image/*" multiple className="hidden" onChange={handleBulkMediaUpload} disabled={saving} />
                        </label>
                      </div>
                    </div>
                    <div className="grid grid-cols-5 gap-sm">
                      {Array.from({ length: MAX_IMAGES }, (_, i) => (
                        <div key={i} className="relative group">
                          {mediaSlots[i] ? (
                            <>
                              <img
                                src={mediaSlots[i]!}
                                alt={`ref ${i + 1}`}
                                className="w-full aspect-square object-cover rounded-xl border border-divider"
                              />
                              {!saving && (
                                <button
                                  onClick={() => removeMediaSlot(i)}
                                  className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-black/60 text-white text-[10px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                  title="Remove"
                                >
                                  ✕
                                </button>
                              )}
                            </>
                          ) : (
                            <label className={`cursor-pointer w-full aspect-square rounded-xl border-2 border-dashed border-divider flex flex-col items-center justify-center text-text-muted hover:border-primary/40 hover:bg-lavender-light/20 transition-colors ${saving ? 'pointer-events-none opacity-50' : ''}`}>
                              <input type="file" accept="image/*" className="hidden" onChange={handleMediaSlotUpload(i)} disabled={saving} />
                              <span className="text-lg">🖼️</span>
                              <span className="text-[9px] font-baloo mt-0.5">{i + 1}</span>
                            </label>
                          )}
                        </div>
                      ))}
                    </div>
                    {saving && <p className="font-baloo text-xs text-text-muted text-center">Uploading…</p>}
                  </div>
                )}

                {/* ── Settings tab ── */}
                {modalTab === 'settings' && (
                  <div className="space-y-md">
                    <div>
                      <label className="font-baloo font-bold text-sm text-text-dark block mb-sm">Word Type</label>
                      <div className="flex gap-sm">
                        {(['NS360', 'GQD'] as const).map(t => (
                          <button
                            key={t}
                            onClick={() => setEditForm(prev => ({ ...prev, wordType: t }))}
                            className={`px-md py-sm rounded-xl font-baloo font-semibold text-sm border-2 transition-all ${
                              editForm.wordType === t ? 'border-primary bg-lavender-light text-primary' : 'border-divider text-text-muted'
                            }`}
                          >
                            {t}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="font-baloo font-bold text-sm text-text-dark block mb-sm">Difficulty</label>
                      <div className="flex gap-sm">
                        {(['Low', 'Medium', 'High'] as const).map(d => (
                          <button
                            key={d}
                            onClick={() => setEditForm(prev => ({ ...prev, difficulty: d }))}
                            className={`px-md py-sm rounded-xl font-baloo font-semibold text-sm border-2 transition-all ${
                              editForm.difficulty === d ? 'border-secondary bg-mint-light text-secondary' : 'border-divider text-text-muted'
                            }`}
                          >
                            {d}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Modal footer — only show Save for non-review, non-pending-content tabs */}
              {modalTab !== 'review' && !(modalTab === 'content' && isPending) && can('wordBank.edit') && (
                <div className="px-lg py-md border-t border-divider flex items-center justify-between">
                  <button onClick={() => setEditWord(null)} className="font-baloo font-semibold text-sm text-text-muted hover:text-text-dark">
                    Cancel
                  </button>
                  <button
                    onClick={saveEdit}
                    disabled={saving}
                    className="px-lg py-sm bg-primary text-white font-baloo font-bold text-sm rounded-xl hover:bg-primary/90 transition-colors shadow-md disabled:opacity-50"
                  >
                    {saving ? 'Saving…' : 'Save Changes'}
                  </button>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
