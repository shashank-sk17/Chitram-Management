import { useState, useEffect, useMemo } from 'react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { getAllCurriculumWords } from '../../services/firebase/curriculum';
import { updateClassCurriculum } from '../../services/firebase/teacher';
import type { CurriculumWordDoc } from '../../types/firestore';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  classId: string;
  grade?: string;              // class's grade (unused — kept for future filtering)
  addedWordIds: string[];      // current custom additions
  removedWordIds: string[];    // current removals (passed through unchanged)
  /** Word IDs already in the mother curriculum for this grade (to show as "Already in curriculum") */
  motherWordIds: string[];
  learningLanguage: string;
  homeLanguage: string;
}

export function WordPickerModal({
  isOpen, onClose, classId, addedWordIds, removedWordIds,
  motherWordIds, learningLanguage, homeLanguage,
}: Props) {
  const [allWords, setAllWords] = useState<Array<CurriculumWordDoc & { id: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const gradeFilter = useState<string>('all');
  const [gradeF, setGradeF] = gradeFilter;

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    setSelected(new Set());
    setSearch('');
    setGradeF('all');
    getAllCurriculumWords().then(words => {
      setAllWords(words);
      setLoading(false);
    });
  }, [isOpen]);

  const motherSet = useMemo(() => new Set(motherWordIds), [motherWordIds]);
  const addedSet  = useMemo(() => new Set(addedWordIds),  [addedWordIds]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return allWords
      .filter(w => w.source === 'mother')                   // only mother curriculum words
      .filter(w => gradeF === 'all' || String(w.grade) === gradeF)
      .filter(w => {
        if (!q) return true;
        const te = (w.word?.[learningLanguage] || w.word?.te || '').toLowerCase();
        const en = (w.word?.en || '').toLowerCase();
        return te.includes(q) || en.includes(q);
      });
  }, [allWords, search, gradeF, learningLanguage]);

  function toggle(id: string) {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function handleAdd() {
    const newIds = [...selected].filter(id => !addedSet.has(id));
    if (newIds.length === 0) { onClose(); return; }
    setSaving(true);
    await updateClassCurriculum(classId, [...addedWordIds, ...newIds], removedWordIds);
    setSaving(false);
    onClose();
  }

  const grades = ['1', '2', '3', '4', '5'];

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <div className="flex flex-col gap-md" style={{ maxHeight: '80vh' }}>
        <div>
          <h2 className="font-baloo font-bold text-xl text-text-dark mb-xs">Add Words to Class</h2>
          <p className="font-baloo text-sm text-text-muted">
            Pick words from any grade to add to this class's curriculum.
          </p>
        </div>

        {/* Search + grade filter */}
        <div className="flex flex-col gap-sm">
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by word or translation..."
            className="w-full px-md py-sm rounded-lg border-2 border-divider bg-white font-baloo text-sm focus:border-primary focus:outline-none"
            autoFocus
          />
          <div className="flex gap-xs flex-wrap">
            {['all', ...grades].map(g => (
              <button
                key={g}
                onClick={() => setGradeF(g)}
                className={`font-baloo text-xs px-sm py-xs rounded-full border transition-colors ${
                  gradeF === g
                    ? 'bg-primary text-white border-primary'
                    : 'bg-white text-text-muted border-divider hover:border-primary/50'
                }`}
              >
                {g === 'all' ? 'All Grades' : `Grade ${g}`}
              </button>
            ))}
          </div>
        </div>

        {/* Word list */}
        <div className="flex-1 overflow-y-auto border-2 border-divider rounded-xl" style={{ minHeight: 0 }}>
          {loading ? (
            <div className="flex justify-center items-center py-xl">
              <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-xl">
              <p className="font-baloo text-md text-text-muted">No words found</p>
            </div>
          ) : (
            filtered.map(word => {
              const inMother  = motherSet.has(word.id);
              const inAdded   = addedSet.has(word.id);
              const isBlocked = inMother || inAdded;
              const isChecked = selected.has(word.id);
              const learnWord = word.word?.[learningLanguage] || word.word?.te || '';
              const homeWord  = word.word?.[homeLanguage]     || word.word?.en || '';

              return (
                <div
                  key={word.id}
                  onClick={() => !isBlocked && toggle(word.id)}
                  className={`flex items-center gap-md px-md py-sm border-b border-divider/50 transition-colors ${
                    isBlocked
                      ? 'bg-divider/20 cursor-not-allowed'
                      : isChecked
                      ? 'bg-lavender-light/50 cursor-pointer'
                      : 'bg-white hover:bg-lavender-light/20 cursor-pointer'
                  }`}
                >
                  {/* Checkbox */}
                  <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 ${
                    isBlocked ? 'border-divider bg-divider/30'
                    : isChecked ? 'border-primary bg-primary'
                    : 'border-divider bg-white'
                  }`}>
                    {isChecked && !isBlocked && (
                      <span className="text-white text-xs font-bold">✓</span>
                    )}
                  </div>

                  {/* Word info */}
                  <div className="flex-1 min-w-0">
                    <span className={`font-baloo font-bold text-md ${isBlocked ? 'text-text-muted' : 'text-text-dark'}`}>
                      {learnWord}
                    </span>
                    <span className="font-baloo text-sm text-text-muted mx-xs">/</span>
                    <span className="font-baloo text-sm text-text-muted">{homeWord}</span>
                  </div>

                  {/* Meta badges */}
                  <div className="flex items-center gap-xs flex-shrink-0">
                    <span className="font-baloo text-xs text-text-muted">
                      G{word.grade}·L{word.level}
                    </span>
                    <span className={`font-baloo text-xs px-xs py-xs rounded font-semibold ${
                      word.wordType === 'NS360' ? 'bg-lavender-light text-primary' : 'bg-peach-light text-accent'
                    }`}>
                      {word.wordType}
                    </span>
                    {inMother && (
                      <span className="font-baloo text-xs text-text-muted italic">In curriculum</span>
                    )}
                    {inAdded && (
                      <span className="font-baloo text-xs text-secondary font-semibold">Added</span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between gap-md">
          <span className="font-baloo text-sm text-text-muted">
            {selected.size > 0 ? `${selected.size} word${selected.size > 1 ? 's' : ''} selected` : 'Select words to add'}
          </span>
          <div className="flex gap-sm">
            <Button title="Cancel" onPress={onClose} variant="ghost" disabled={saving} />
            <Button
              title={saving ? 'Adding...' : `Add ${selected.size > 0 ? selected.size : ''} Word${selected.size !== 1 ? 's' : ''}`}
              onPress={handleAdd}
              variant="primary"
              disabled={selected.size === 0 || saving}
            />
          </div>
        </div>
      </div>
    </Modal>
  );
}
