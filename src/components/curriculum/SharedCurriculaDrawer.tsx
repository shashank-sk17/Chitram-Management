import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { CurriculumEditDoc, WordBankDoc, LanguageCode } from '../../types/firestore';
import { getSharedCurricula, adoptSharedCurriculum } from '../../services/firebase/curriculumEdits';
import { getWordBankByIds } from '../../services/firebase/wordBank';
import { LevelEditor } from './LevelEditor';

interface SharedCurriculaDrawerProps {
  open: boolean;
  onClose: () => void;
  projectId: string;
  grade: number;
  language: LanguageCode;
  classId: string;
  onAdopted: () => void;
}

export function SharedCurriculaDrawer({ open, onClose, projectId, grade, language, classId, onAdopted }: SharedCurriculaDrawerProps) {
  const [edits, setEdits] = useState<Array<{ id: string } & CurriculumEditDoc>>([]);
  const [words, setWords] = useState<Record<string, WordBankDoc>>({});
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [adopting, setAdopting] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    getSharedCurricula(projectId, grade, language)
      .then(async result => {
        setEdits(result);
        // Fetch all words needed for previews
        const allIds = result.flatMap(e => (e.resolvedLevels ?? e.proposedLevels).flatMap(l => l.wordIds));
        const unique = [...new Set(allIds)];
        if (unique.length > 0) {
          const wordMap = await getWordBankByIds(unique);
          setWords(wordMap);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [open, projectId, grade, language]);

  const handleAdopt = async (editId: string) => {
    const edit = edits.find(e => e.id === editId);
    if (!edit) return;
    setAdopting(editId);
    try {
      await adoptSharedCurriculum(classId, editId, edit.resolvedLevels ?? edit.proposedLevels);
      onAdopted();
      onClose();
    } catch {}
    setAdopting(null);
  };

  const previewEdit = previewId ? edits.find(e => e.id === previewId) : null;

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/30 z-40"
            onClick={onClose}
          />
          <motion.div
            initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 280 }}
            className="fixed right-0 top-0 h-full w-full max-w-[480px] bg-white shadow-2xl z-50 flex flex-col"
          >
            {/* Header */}
            <div className="px-lg py-md border-b border-divider bg-gradient-to-r from-mint-light to-lavender-light">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-baloo font-bold text-lg text-text-dark">Shared Curricula</h2>
                  <p className="font-baloo text-sm text-text-muted">
                    Grade {grade} · {language.toUpperCase()} · {edits.length} available
                  </p>
                </div>
                <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/60 flex items-center justify-center">✕</button>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-md space-y-md">
              {loading && (
                <div className="flex items-center justify-center h-32 text-text-muted font-baloo">Loading…</div>
              )}
              {!loading && edits.length === 0 && (
                <div className="flex flex-col items-center justify-center h-32 text-text-muted font-baloo text-center">
                  <span className="text-4xl mb-sm">📭</span>
                  <p>No shared curricula for this grade and language yet.</p>
                </div>
              )}
              {!loading && edits.map(edit => {
                const levels = edit.resolvedLevels ?? edit.proposedLevels;
                const totalWords = levels.reduce((s, l) => s + l.wordIds.length, 0);
                const isAdopted = edit.adoptedBy?.includes(classId);
                return (
                  <div key={edit.id} className="bg-white border border-divider rounded-2xl overflow-hidden shadow-sm">
                    <div className="p-md">
                      <div className="flex items-start justify-between gap-md">
                        <div className="flex-1 min-w-0">
                          <p className="font-baloo font-bold text-text-dark">{edit.classId}</p>
                          <p className="font-baloo text-sm text-text-muted">
                            {levels.length} levels · {totalWords} words
                            {edit.adoptedBy?.length ? ` · adopted by ${edit.adoptedBy.length}` : ''}
                          </p>
                        </div>
                        {isAdopted && (
                          <span className="px-sm py-xs bg-success/10 text-success font-baloo font-semibold text-xs rounded-full">
                            Already adopted
                          </span>
                        )}
                      </div>
                      <div className="flex gap-sm mt-md">
                        <button
                          onClick={() => setPreviewId(previewId === edit.id ? null : edit.id)}
                          className="flex-1 py-xs rounded-xl border-2 border-primary/30 text-primary font-baloo font-semibold text-sm hover:bg-lavender-light transition-colors"
                        >
                          {previewId === edit.id ? 'Hide Preview' : 'Preview'}
                        </button>
                        <button
                          onClick={() => handleAdopt(edit.id)}
                          disabled={!!adopting || isAdopted}
                          className={`flex-1 py-xs rounded-xl font-baloo font-bold text-sm text-white transition-all ${
                            isAdopted ? 'bg-gray-300 cursor-not-allowed' : 'bg-secondary hover:bg-secondary/90 shadow-sm'
                          }`}
                        >
                          {adopting === edit.id ? 'Adopting…' : isAdopted ? 'Adopted' : 'Adopt'}
                        </button>
                      </div>
                    </div>

                    <AnimatePresence>
                      {previewId === edit.id && previewEdit && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden border-t border-divider"
                        >
                          <div className="p-md max-h-80 overflow-y-auto">
                            <LevelEditor
                              levels={levels}
                              words={words}
                              learningLanguage={language}
                              readonly
                            />
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
