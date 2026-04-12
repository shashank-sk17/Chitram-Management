import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from '../../stores/authStore';
import { useAuth } from '../../features/auth/hooks/useAuth';
import type { WordBankDoc, LanguageCode } from '../../types/firestore';
import { getWordBankPage, updateWord, approveWord, rejectWord, uploadWordImage } from '../../services/firebase/wordBank';
import type { WordBankFilters } from '../../services/firebase/wordBank';
import { LANGUAGE_LABELS } from '../../services/firebase/languageCurricula';

const LANGS: LanguageCode[] = ['te', 'en', 'hi', 'mr', 'es', 'fr'];
const STATUS_BADGE: Record<string, string> = {
  active: 'bg-success/10 text-success',
  pending: 'bg-amber-50 text-amber-600',
  rejected: 'bg-error/10 text-error',
};

type WordWithId = { id: string } & WordBankDoc;

export default function WordBankPage() {
  const { user } = useAuthStore();
  const { claims } = useAuth();
  const isProjectAdmin = claims?.role === 'projectAdmin';
  const myProjectId = claims?.projectId;

  const [words, setWords] = useState<WordWithId[]>([]);
  const [loading, setLoading] = useState(false);
  const [_filters, _setFilters] = useState<WordBankFilters>({ status: undefined });
  // Project admins default to "pending" tab since they only act on submissions in their project
  const [activeTab, setActiveTab] = useState<'all' | 'active' | 'pending' | 'rejected'>(isProjectAdmin ? 'pending' : 'all');
  const [search, setSearch] = useState('');
  const [editWord, setEditWord] = useState<WordWithId | null>(null);
  const [editTab, setEditTab] = useState<'content' | 'media' | 'settings'>('content');
  const [editForm, setEditForm] = useState<Partial<WordBankDoc>>({});
  const [saving, setSaving] = useState(false);
  const [rejectNote, setRejectNote] = useState('');
  const [showRejectInput, setShowRejectInput] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

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
      // Project admins only see words submitted within their project
      projectId: isProjectAdmin && myProjectId ? myProjectId : undefined,
    };
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => load(f), search ? 300 : 0);
  }, [activeTab, search, isProjectAdmin, myProjectId]);

  const openEdit = (w: WordWithId) => {
    setEditWord(w);
    setEditForm({ ...w });
    setEditTab('content');
    setShowRejectInput(false);
    setRejectNote('');
  };

  const saveEdit = async () => {
    if (!editWord || !user) return;
    setSaving(true);
    try {
      await updateWord(editWord.id, editForm);
      setWords(prev => prev.map(w => w.id === editWord.id ? { ...w, ...editForm } : w));
      setEditWord(null);
    } catch {}
    setSaving(false);
  };

  const handleApprove = async (wordId: string) => {
    if (!user) return;
    setSaving(true);
    try {
      await approveWord(wordId, user.uid);
      setWords(prev => prev.map(w => w.id === wordId ? { ...w, status: 'active', active: true } : w));
      setEditWord(null);
    } catch {}
    setSaving(false);
  };

  const handleReject = async (wordId: string) => {
    if (!user || !rejectNote.trim()) return;
    setSaving(true);
    try {
      await rejectWord(wordId, user.uid, rejectNote);
      setWords(prev => prev.map(w => w.id === wordId ? { ...w, status: 'rejected' } : w));
      setEditWord(null);
    } catch {}
    setSaving(false);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!editWord || !e.target.files?.[0]) return;
    setSaving(true);
    try {
      const url = await uploadWordImage(editWord.id, e.target.files[0]);
      setEditForm(prev => ({ ...prev, imageUrl: url }));
      setWords(prev => prev.map(w => w.id === editWord.id ? { ...w, imageUrl: url } : w));
    } catch {}
    setSaving(false);
  };

  const tabCounts = {
    all: words.length,
    active: words.filter(w => w.status === 'active').length,
    pending: words.filter(w => w.status === 'pending').length,
    rejected: words.filter(w => w.status === 'rejected').length,
  };

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
                <th className="px-md py-sm text-left font-baloo font-bold text-sm text-text-dark">Type</th>
                <th className="px-md py-sm text-left font-baloo font-bold text-sm text-text-dark">Difficulty</th>
                <th className="px-md py-sm text-left font-baloo font-bold text-sm text-text-dark">Status</th>
                <th className="px-md py-sm text-left font-baloo font-bold text-sm text-text-dark">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-md py-xl text-center font-baloo text-text-muted">
                    Loading words…
                  </td>
                </tr>
              ) : words.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-md py-xl text-center font-baloo text-text-muted">
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
                    <td className="px-md py-sm">
                      <span className="px-sm py-0.5 bg-lavender-light text-primary font-baloo font-semibold text-xs rounded-full">{w.wordType}</span>
                    </td>
                    <td className="px-md py-sm font-baloo text-sm text-text-muted">{w.difficulty}</td>
                    <td className="px-md py-sm">
                      <span className={`px-sm py-0.5 font-baloo font-semibold text-xs rounded-full capitalize ${STATUS_BADGE[w.status] || ''}`}>
                        {w.status}
                      </span>
                    </td>
                    <td className="px-md py-sm">
                      <div className="flex items-center gap-xs">
                        <button
                          onClick={() => openEdit(w)}
                          className="px-sm py-xs bg-lavender-light text-primary font-baloo font-semibold text-xs rounded-lg hover:bg-primary hover:text-white transition-colors"
                        >
                          Edit
                        </button>
                        {w.status === 'pending' && (
                          <>
                            <button
                              onClick={() => handleApprove(w.id)}
                              className="px-sm py-xs bg-success/10 text-success font-baloo font-semibold text-xs rounded-lg hover:bg-success hover:text-white transition-colors"
                            >
                              ✓
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Modal */}
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
              className="fixed inset-x-4 top-8 bottom-8 md:inset-x-auto md:left-1/2 md:-translate-x-1/2 md:w-[680px] bg-white rounded-2xl shadow-2xl z-50 flex flex-col overflow-hidden"
            >
              {/* Modal header */}
              <div className="px-lg py-md border-b border-divider bg-lavender-light/30">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="font-baloo font-bold text-lg text-text-dark">
                      {editWord.word?.en || 'Edit Word'}
                    </h2>
                    <span className={`text-xs font-baloo font-semibold px-sm py-0.5 rounded-full capitalize ${STATUS_BADGE[editWord.status] || ''}`}>
                      {editWord.status}
                    </span>
                  </div>
                  <button onClick={() => setEditWord(null)} className="w-8 h-8 rounded-full bg-white/60 flex items-center justify-center">✕</button>
                </div>
                {/* Tabs */}
                <div className="flex gap-xs mt-sm">
                  {(['content', 'media', 'settings'] as const).map(t => (
                    <button
                      key={t}
                      onClick={() => setEditTab(t)}
                      className={`px-md py-xs rounded-lg font-baloo font-semibold text-sm capitalize transition-all ${
                        editTab === t ? 'bg-white text-primary shadow-sm' : 'text-text-muted hover:text-text-dark'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              {/* Modal body */}
              <div className="flex-1 overflow-y-auto p-lg space-y-md">
                {editTab === 'content' && (
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
                  </div>
                )}

                {editTab === 'media' && (
                  <div className="space-y-md">
                    <div>
                      <label className="font-baloo font-bold text-sm text-text-dark block mb-sm">Word Image</label>
                      {editForm.imageUrl ? (
                        <img src={editForm.imageUrl} alt="" className="w-32 h-32 object-cover rounded-xl border border-divider mb-sm" />
                      ) : (
                        <div className="w-32 h-32 rounded-xl bg-lavender-light flex items-center justify-center text-4xl border-2 border-dashed border-divider mb-sm">📝</div>
                      )}
                      <label className="cursor-pointer px-md py-sm bg-lavender-light text-primary font-baloo font-semibold text-sm rounded-xl hover:bg-primary hover:text-white transition-colors inline-block">
                        {saving ? 'Uploading…' : 'Upload Image'}
                        <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} disabled={saving} />
                      </label>
                    </div>
                  </div>
                )}

                {editTab === 'settings' && (
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

                {/* Approve/Reject section for pending */}
                {editWord.status === 'pending' && (
                  <div className="border-t border-divider pt-md">
                    <h3 className="font-baloo font-bold text-sm text-text-dark mb-sm">Review</h3>
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
                          <button onClick={() => setShowRejectInput(false)} className="flex-1 py-sm rounded-xl border-2 border-divider font-baloo font-semibold text-sm text-text-muted">
                            Cancel
                          </button>
                          <button
                            onClick={() => handleReject(editWord.id)}
                            disabled={!rejectNote.trim() || saving}
                            className="flex-1 py-sm rounded-xl bg-error text-white font-baloo font-bold text-sm disabled:opacity-50"
                          >
                            Reject Word
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex gap-sm">
                        <button
                          onClick={() => handleApprove(editWord.id)}
                          disabled={saving}
                          className="flex-1 py-sm rounded-xl bg-success text-white font-baloo font-bold text-sm hover:bg-success/90 transition-colors shadow-sm"
                        >
                          ✓ Approve Word
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
              </div>

              {/* Modal footer */}
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
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
