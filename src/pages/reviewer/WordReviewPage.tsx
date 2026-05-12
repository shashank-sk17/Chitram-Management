import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from '../../stores/authStore';
import { usePermission } from '../../hooks/usePermission';
import type { WordBankDoc, LanguageCode } from '../../types/firestore';
import {
  getWordBankPage,
  updateWord,
  approveWord,
  rejectWord,
} from '../../services/firebase/wordBank';
import { useCurriculumStore } from '../../stores/curriculumStore';
import { LANGUAGE_LABELS } from '../../services/firebase/languageCurricula';

const LANGS: LanguageCode[] = ['te', 'en', 'hi', 'es', 'fr'];

type WordWithId = { id: string } & WordBankDoc;

// ── TTS ──────────────────────────────────────────────────────────────────────
const LANG_BCP47: Record<LanguageCode, string> = {
  te: 'te-IN', en: 'en-US', hi: 'hi-IN', es: 'es-ES', fr: 'fr-FR',
};
function speakText(text: string, lang: LanguageCode) {
  if (!text || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const utt = new SpeechSynthesisUtterance(text);
  utt.lang = LANG_BCP47[lang];
  window.speechSynthesis.speak(utt);
}

// ── Language tab content ─────────────────────────────────────────────────────
function LangDetailPanel({ lang, word }: { lang: LanguageCode; word: WordBankDoc }) {
  const w = word.word?.[lang];
  const m = word.meaning?.[lang];
  const s = word.sentence?.[lang];

  const hasContent = w || m;

  return (
    <div className={`rounded-xl border p-md space-y-sm ${hasContent ? 'border-divider bg-white' : 'border-dashed border-divider bg-gray-50/50'}`}>
      <div className="flex items-center justify-between">
        <span className="font-baloo font-bold text-sm text-primary">{LANGUAGE_LABELS[lang]}</span>
        {hasContent && (
          <div className="flex gap-xs">
            {w && (
              <button onClick={() => speakText(w, lang)}
                className="text-xs px-xs py-0.5 rounded-lg bg-lavender-light/50 text-primary border border-primary/20 hover:bg-primary/10 font-baloo transition-colors">
                🔊 Word
              </button>
            )}
            {m && (
              <button onClick={() => speakText(m, lang)}
                className="text-xs px-xs py-0.5 rounded-lg bg-teal-50 text-secondary border border-secondary/20 hover:bg-secondary/10 font-baloo transition-colors">
                🔊 Meaning
              </button>
            )}
            {s && (
              <button onClick={() => speakText(s, lang)}
                className="text-xs px-xs py-0.5 rounded-lg bg-amber-50 text-accent border border-accent/20 hover:bg-accent/10 font-baloo transition-colors">
                🔊 Sentence
              </button>
            )}
          </div>
        )}
      </div>
      {hasContent ? (
        <div className="grid grid-cols-2 gap-sm text-sm font-baloo">
          {w && (
            <div>
              <span className="text-xs text-text-muted block mb-0.5">Word</span>
              <span className="text-text-dark font-semibold">{w}</span>
            </div>
          )}
{m && (
            <div className="col-span-2">
              <span className="text-xs text-text-muted block mb-0.5">Meaning</span>
              <span className="text-text-dark">{m}</span>
            </div>
          )}
          {s && (
            <div className="col-span-2">
              <span className="text-xs text-text-muted block mb-0.5">Example sentence</span>
              <span className="text-text-dark">{s}</span>
            </div>
          )}
        </div>
      ) : (
        <p className="text-xs text-text-muted font-baloo italic">No content for this language</p>
      )}
    </div>
  );
}

// ── Pending word list item ───────────────────────────────────────────────────
function WordListItem({
  word,
  selected,
  onClick,
}: {
  word: WordWithId;
  selected: boolean;
  onClick: () => void;
}) {
  const primaryWord = word.word?.te || word.word?.en || '—';
  const secondaryWord = word.word?.en && word.word?.te ? word.word.en : '';
  const submittedAt = word.submittedAt
    ? new Date((word.submittedAt as any).seconds * 1000).toLocaleDateString()
    : '—';
  const filledLangs = LANGS.filter(l => !!word.word?.[l]);

  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-md py-sm border-b border-divider last:border-0 transition-colors ${
        selected ? 'bg-lavender-light/40 border-l-2 border-l-primary' : 'hover:bg-gray-50'
      }`}
    >
      <div className="flex items-start justify-between gap-xs">
        <div className="min-w-0">
          <p className="font-baloo font-bold text-sm text-text-dark truncate">{primaryWord}</p>
          {secondaryWord && (
            <p className="font-baloo text-xs text-text-muted truncate">{secondaryWord}</p>
          )}
        </div>
        <div className="flex items-center gap-xs shrink-0">
          <span className={`text-xs font-baloo font-semibold px-xs py-0.5 rounded-full ${
            word.wordType === 'GQD' ? 'bg-purple-50 text-purple-600' : 'bg-blue-50 text-blue-600'
          }`}>
            {word.wordType}
          </span>
        </div>
      </div>
      <div className="mt-xs flex items-center gap-xs flex-wrap">
        {filledLangs.map(l => (
          <span key={l} className="text-xs font-baloo bg-gray-100 text-text-muted px-1 rounded">
            {l}
          </span>
        ))}
      </div>
      <div className="mt-xs flex items-center justify-between">
        <span className="text-xs text-text-muted font-baloo">
          {word.submittedByName ?? 'Content writer'}
        </span>
        <span className="text-xs text-text-muted font-baloo">{submittedAt}</span>
      </div>
    </button>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────
export default function WordReviewPage() {
  const { user } = useAuthStore();
  const { can } = usePermission();
  const { refreshBadgeCounts } = useCurriculumStore();

  const [words, setWords] = useState<WordWithId[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<WordWithId | null>(null);
  const [activeLang, setActiveLang] = useState<LanguageCode>('te');
  const [rejectNote, setRejectNote] = useState('');
  const [showRejectInput, setShowRejectInput] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editForm, setEditForm] = useState<Partial<WordBankDoc>>({});
  const [editMode, setEditMode] = useState(false);
  const [actionDone, setActionDone] = useState<'approved' | 'rejected' | null>(null);
  const [showPartialWarning, setShowPartialWarning] = useState(false);
  const [missingLangs, setMissingLangs] = useState<LanguageCode[]>([]);

  const load = async () => {
    setLoading(true);
    try {
      const { words: fetched } = await getWordBankPage({ status: 'pending' }, undefined, 200);
      setWords(fetched);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const selectWord = (w: WordWithId) => {
    setSelected(w);
    setEditForm({ ...w });
    setActiveLang('te');
    setShowRejectInput(false);
    setRejectNote('');
    setEditMode(false);
    setActionDone(null);
    setShowPartialWarning(false);
    setMissingLangs([]);
  };

  const handleApprove = async () => {
    if (!selected || !user) return;
    setSaving(true);
    try {
      await approveWord(selected.id, user.uid, user.email ?? undefined);
      setWords(prev => prev.filter(w => w.id !== selected.id));
      setSelected(null);
      setActionDone('approved');
      setShowPartialWarning(false);
      refreshBadgeCounts();
    } catch (err) {
      console.error('Failed to approve:', err);
    }
    setSaving(false);
  };

  const handleApproveClick = () => {
    if (!selected) return;
    const missing = LANGS.filter(l => !selected.word?.[l]?.trim());
    if (missing.length > 0) {
      setMissingLangs(missing);
      setShowPartialWarning(true);
      return;
    }
    handleApprove();
  };

  const handleReject = async () => {
    if (!selected || !user || !rejectNote.trim()) return;
    setSaving(true);
    try {
      await rejectWord(selected.id, user.uid, rejectNote, user.email ?? undefined);
      setWords(prev => prev.filter(w => w.id !== selected.id));
      setSelected(null);
      setActionDone('rejected');
      refreshBadgeCounts();
    } catch (err) {
      console.error('Failed to reject:', err);
    }
    setSaving(false);
  };

  const handleSaveEdits = async () => {
    if (!selected || !user) return;
    setSaving(true);
    try {
      const { id, ...rest } = editForm as any;
      await updateWord(selected.id, rest);
      setWords(prev => prev.map(w => w.id === selected.id ? { ...w, ...editForm } : w));
      setSelected(prev => prev ? { ...prev, ...editForm } : prev);
      setEditMode(false);
    } catch (err) {
      console.error('Failed to save edits:', err);
    }
    setSaving(false);
  };

  const images = selected
    ? (selected.imageUrls?.filter(Boolean) ?? (selected.imageUrl ? [selected.imageUrl] : []))
    : [];

  return (
    <div className="flex h-[calc(100vh-5rem)] overflow-hidden -m-lg">
      {/* ── Left panel: pending queue ── */}
      <div className="w-80 shrink-0 border-r border-divider flex flex-col bg-white">
        <div className="px-md py-sm border-b border-divider flex items-center justify-between">
          <h2 className="font-baloo font-bold text-text-dark">Review Queue</h2>
          <span className="font-baloo text-xs bg-amber-50 text-amber-600 font-semibold px-xs py-0.5 rounded-full">
            {loading ? '…' : `${words.length} pending`}
          </span>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : words.length === 0 ? (
            <div className="text-center py-xl px-md">
              <div className="text-4xl mb-sm">🎉</div>
              <p className="font-baloo font-bold text-text-dark">All caught up!</p>
              <p className="font-baloo text-xs text-text-muted mt-xs">No pending words to review.</p>
            </div>
          ) : (
            words.map(w => (
              <WordListItem
                key={w.id}
                word={w}
                selected={selected?.id === w.id}
                onClick={() => selectWord(w)}
              />
            ))
          )}
        </div>
      </div>

      {/* ── Right panel: word detail ── */}
      <div className="flex-1 overflow-y-auto bg-bg-cream">
        {!selected ? (
          <div className="flex flex-col items-center justify-center h-full text-center p-xl">
            <div className="text-6xl mb-md">👈</div>
            <h3 className="font-baloo font-bold text-xl text-text-dark">Select a word to review</h3>
            <p className="font-baloo text-text-muted mt-xs">
              Pick a pending submission from the queue on the left.
            </p>
          </div>
        ) : (
          <div className="p-lg space-y-lg max-w-3xl mx-auto">
            {/* Header */}
            <div className="flex items-start justify-between gap-md">
              <div>
                <h1 className="font-baloo font-extrabold text-xxl text-text-dark">
                  {selected.word?.te || selected.word?.en || 'Word Review'}
                </h1>
                <div className="flex items-center gap-sm mt-xs flex-wrap">
                  <span className="font-baloo text-sm text-text-muted">
                    Submitted by <span className="font-semibold text-text-dark">{selected.submittedByName ?? 'Content writer'}</span>
                  </span>
                  <span className="font-baloo text-xs bg-amber-50 text-amber-600 font-semibold px-xs py-0.5 rounded-full">
                    pending
                  </span>
                  <span className={`font-baloo text-xs font-semibold px-xs py-0.5 rounded-full ${
                    selected.wordType === 'GQD' ? 'bg-purple-50 text-purple-600' : 'bg-blue-50 text-blue-600'
                  }`}>
                    {selected.wordType}
                  </span>
                  <span className="font-baloo text-xs bg-gray-100 text-text-muted px-xs py-0.5 rounded-full">
                    {selected.difficulty}
                  </span>
                </div>
              </div>
              {can('wordReview.edit') && (
                <button
                  onClick={() => setEditMode(v => !v)}
                  className={`font-baloo text-sm font-semibold px-md py-sm rounded-xl border transition-colors ${
                    editMode
                      ? 'bg-primary text-white border-primary'
                      : 'bg-white text-text-dark border-divider hover:border-primary/40'
                  }`}
                >
                  {editMode ? '✓ Editing' : '✏️ Edit'}
                </button>
              )}
            </div>

            {/* Images */}
            {images.length > 0 && (
              <div className="bg-white rounded-2xl border border-divider p-md">
                <h3 className="font-baloo font-bold text-sm text-text-dark mb-sm">Images</h3>
                <div className="flex gap-sm flex-wrap">
                  {images.map((url, i) => (
                    <img
                      key={i}
                      src={url}
                      alt={`Image ${i + 1}`}
                      className="w-32 h-32 object-cover rounded-xl border border-divider"
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Language tabs */}
            <div className="bg-white rounded-2xl border border-divider overflow-hidden">
              <div className="flex border-b border-divider overflow-x-auto">
                {LANGS.map(lang => {
                  const filled = !!selected.word?.[lang];
                  return (
                    <button
                      key={lang}
                      onClick={() => setActiveLang(lang)}
                      className={`px-md py-sm font-baloo font-semibold text-sm shrink-0 transition-colors border-b-2 ${
                        activeLang === lang
                          ? 'border-primary text-primary bg-lavender-light/20'
                          : 'border-transparent text-text-muted hover:text-text-dark'
                      } ${!filled ? 'opacity-50' : ''}`}
                    >
                      {LANGUAGE_LABELS[lang]}
                      {filled && <span className="ml-1 text-xs text-success">●</span>}
                    </button>
                  );
                })}
              </div>
              <div className="p-md">
                {editMode ? (
                  <div className="space-y-md">
                    {(['word', 'meaning', 'sentence'] as const).map(field => (
                      <div key={field}>
                        <label className="font-baloo text-xs text-text-muted block mb-1 capitalize">{field}</label>
                        <input
                          className="w-full border border-divider rounded-xl px-md py-sm font-baloo text-sm text-text-dark focus:outline-none focus:border-primary"
                          value={(editForm as any)[field]?.[activeLang] ?? ''}
                          onChange={e => setEditForm(prev => ({
                            ...prev,
                            [field]: { ...(prev as any)[field], [activeLang]: e.target.value },
                          }))}
                          placeholder={`${field} in ${LANGUAGE_LABELS[activeLang]}`}
                        />
                      </div>
                    ))}
                    <button
                      onClick={handleSaveEdits}
                      disabled={saving}
                      className="px-lg py-sm rounded-xl bg-secondary text-white font-baloo font-bold text-sm hover:bg-secondary/90 transition-colors disabled:opacity-50"
                    >
                      {saving ? 'Saving…' : 'Save Changes'}
                    </button>
                  </div>
                ) : (
                  <LangDetailPanel lang={activeLang} word={selected} />
                )}
              </div>
            </div>

            {/* Approve / Reject actions */}
            <div className="bg-white rounded-2xl border border-divider p-lg space-y-md">
              <h3 className="font-baloo font-bold text-sm text-text-dark">Review Decision</h3>

              {/* Partial-content warning */}
              <AnimatePresence>
                {showPartialWarning && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="rounded-xl border border-amber-300 bg-amber-50 p-md space-y-sm overflow-hidden"
                  >
                    <p className="font-baloo font-semibold text-sm text-amber-800">
                      ⚠️ Missing content in {missingLangs.length} language{missingLangs.length !== 1 ? 's' : ''}
                    </p>
                    <p className="font-baloo text-xs text-amber-700">
                      The following languages have no word text and will be excluded from{' '}
                      <code className="bg-amber-100 px-0.5 rounded">approvedLanguages</code>:
                    </p>
                    <div className="flex flex-wrap gap-xs">
                      {missingLangs.map(l => (
                        <span key={l} className="px-sm py-0.5 rounded-full bg-amber-200 text-amber-900 font-baloo font-semibold text-xs">
                          {LANGUAGE_LABELS[l]}
                        </span>
                      ))}
                    </div>
                    <p className="font-baloo text-xs text-amber-700">
                      This word will not appear in {missingLangs.map(l => LANGUAGE_LABELS[l]).join(', ')} curriculum pickers.
                      Go back to edit and translate first, or approve partially.
                    </p>
                    <div className="flex gap-sm pt-xs">
                      <button
                        onClick={handleApprove}
                        disabled={saving}
                        className="flex-1 py-sm rounded-xl bg-success text-white font-baloo font-bold text-sm hover:bg-success/90 transition-colors disabled:opacity-50"
                      >
                        {saving ? 'Processing…' : `Approve partially (${LANGS.length - missingLangs.length} language${LANGS.length - missingLangs.length !== 1 ? 's' : ''})`}
                      </button>
                      <button
                        onClick={() => setShowPartialWarning(false)}
                        className="px-md py-sm rounded-xl border border-divider text-text-muted font-baloo text-sm hover:text-text-dark transition-colors"
                      >
                        Go back
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Approve */}
              {can('wordReview.approve') && !showPartialWarning && (
                <button
                  onClick={handleApproveClick}
                  disabled={saving}
                  className="w-full py-md rounded-xl bg-success text-white font-baloo font-bold text-base hover:bg-success/90 transition-colors disabled:opacity-50"
                >
                  {saving ? 'Processing…' : '✅ Approve — Publish to Curriculum'}
                </button>
              )}

              {/* Reject */}
              <div className="space-y-sm">
                {!showRejectInput ? (
                  can('wordReview.reject') && (
                    <button
                      onClick={() => setShowRejectInput(true)}
                      disabled={saving}
                      className="w-full py-md rounded-xl border-2 border-error/30 text-error font-baloo font-bold text-base hover:bg-error/5 transition-colors disabled:opacity-50"
                    >
                      ✗ Reject
                    </button>
                  )
                ) : (
                  <AnimatePresence>
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="space-y-sm"
                    >
                      <textarea
                        className="w-full border border-divider rounded-xl px-md py-sm font-baloo text-sm text-text-dark focus:outline-none focus:border-error resize-none"
                        rows={3}
                        placeholder="Rejection reason (required — sent to the content writer)…"
                        value={rejectNote}
                        onChange={e => setRejectNote(e.target.value)}
                      />
                      <div className="flex gap-sm">
                        <button
                          onClick={handleReject}
                          disabled={saving || !rejectNote.trim()}
                          className="flex-1 py-sm rounded-xl bg-error text-white font-baloo font-bold text-sm hover:bg-error/90 transition-colors disabled:opacity-50"
                        >
                          {saving ? 'Rejecting…' : 'Confirm Reject'}
                        </button>
                        <button
                          onClick={() => { setShowRejectInput(false); setRejectNote(''); }}
                          className="px-lg py-sm rounded-xl border border-divider text-text-muted font-baloo text-sm hover:text-text-dark transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </motion.div>
                  </AnimatePresence>
                )}
              </div>
            </div>

            {/* Action success banner (shown briefly) */}
            <AnimatePresence>
              {actionDone && (
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className={`rounded-xl px-lg py-md font-baloo font-semibold text-white ${
                    actionDone === 'approved' ? 'bg-success' : 'bg-error'
                  }`}
                >
                  {actionDone === 'approved' ? '✅ Word approved and published!' : '✗ Word rejected.'}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}
