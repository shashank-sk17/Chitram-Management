import { useState } from 'react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { auth } from '../../config/firebase';
import { createTeacherWord } from '../../services/firebase/curriculum';
import { updateClassCurriculum } from '../../services/firebase/teacher';
import type { LanguageCode } from '../../types/firestore';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  classId: string;
  grade: number;
  levelCount: number;
  addedWordIds: string[];
  removedWordIds: string[];
  learningLanguage: LanguageCode;
  homeLanguage: LanguageCode;
}

const LANGUAGE_LABELS: Record<string, string> = {
  en: 'English', hi: 'Hindi', te: 'Telugu', mr: 'Marathi', es: 'Spanish', fr: 'French',
};

const DIFFICULTIES: Array<'Low' | 'Medium' | 'High'> = ['Low', 'Medium', 'High'];
const DIFFICULTY_STYLES: Record<string, string> = {
  Low:    'border-secondary text-secondary bg-mint-light',
  Medium: 'border-accent text-accent bg-peach-light',
  High:   'border-error text-error bg-rose-light',
};

export function CreateCustomWordModal({
  isOpen, onClose, classId, grade, levelCount,
  addedWordIds, removedWordIds, learningLanguage, homeLanguage,
}: Props) {
  const [learningWord, setLearningWord] = useState('');
  const [homeWord, setHomeWord] = useState('');
  const [level, setLevel] = useState(1);
  const [difficulty, setDifficulty] = useState<'Low' | 'Medium' | 'High'>('Medium');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const levels = Array.from({ length: levelCount || 4 }, (_, i) => i + 1);
  const learnLabel = LANGUAGE_LABELS[learningLanguage] ?? learningLanguage.toUpperCase();
  const homeLabel  = LANGUAGE_LABELS[homeLanguage]    ?? homeLanguage.toUpperCase();

  function reset() {
    setLearningWord('');
    setHomeWord('');
    setLevel(1);
    setDifficulty('Medium');
    setError('');
  }

  function handleClose() {
    reset();
    onClose();
  }

  async function handleCreate() {
    const lw = learningWord.trim();
    const hw = homeWord.trim();
    if (!lw || !hw) { setError('Both word fields are required.'); return; }

    const uid = auth.currentUser?.uid;
    if (!uid) { setError('Not signed in.'); return; }

    setSaving(true);
    setError('');
    try {
      const newId = await createTeacherWord({
        grade,
        level,
        learningLanguage,
        learningWord: lw,
        homeLanguage,
        homeWord: hw,
        difficulty,
        createdBy: uid,
      });
      await updateClassCurriculum(classId, [...addedWordIds, newId], removedWordIds);
      reset();
      onClose();
    } catch (e: any) {
      setError(e.message || 'Failed to create word.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose}>
      <div className="flex flex-col gap-md">
        <div>
          <h2 className="font-baloo font-bold text-xl text-text-dark mb-xs">Create Custom Word</h2>
          <p className="font-baloo text-sm text-text-muted">
            Add a new word to this class's curriculum. You can set an image and sentences later.
          </p>
        </div>

        {error && (
          <div className="bg-rose-light border-2 border-error rounded-lg px-md py-sm">
            <p className="font-baloo text-sm text-error">{error}</p>
          </div>
        )}

        {/* Word fields */}
        <div className="flex flex-col gap-sm">
          <div>
            <label className="font-baloo font-semibold text-sm text-text-dark block mb-xs">
              {learnLabel} Word <span className="text-error">*</span>
            </label>
            <input
              type="text"
              value={learningWord}
              onChange={e => setLearningWord(e.target.value)}
              placeholder={`Word in ${learnLabel}…`}
              className="w-full px-md py-sm rounded-lg border-2 border-divider bg-white font-baloo text-sm focus:border-primary focus:outline-none"
              autoFocus
            />
          </div>
          <div>
            <label className="font-baloo font-semibold text-sm text-text-dark block mb-xs">
              {homeLabel} Translation <span className="text-error">*</span>
            </label>
            <input
              type="text"
              value={homeWord}
              onChange={e => setHomeWord(e.target.value)}
              placeholder={`Translation in ${homeLabel}…`}
              className="w-full px-md py-sm rounded-lg border-2 border-divider bg-white font-baloo text-sm focus:border-secondary focus:outline-none"
            />
          </div>
        </div>

        {/* Level picker */}
        <div>
          <label className="font-baloo font-semibold text-sm text-text-dark block mb-xs">
            Level <span className="text-error">*</span>
          </label>
          <div className="flex gap-sm">
            {levels.map(l => (
              <button
                key={l}
                onClick={() => setLevel(l)}
                className={`flex-1 py-sm rounded-lg border-2 font-baloo font-semibold text-sm transition-colors ${
                  level === l
                    ? 'border-primary bg-lavender-light text-primary'
                    : 'border-divider bg-white text-text-muted hover:border-primary/50'
                }`}
              >
                Level {l}
              </button>
            ))}
          </div>
        </div>

        {/* Difficulty picker */}
        <div>
          <label className="font-baloo font-semibold text-sm text-text-dark block mb-xs">
            Difficulty
          </label>
          <div className="flex gap-sm">
            {DIFFICULTIES.map(d => (
              <button
                key={d}
                onClick={() => setDifficulty(d)}
                className={`flex-1 py-sm rounded-lg border-2 font-baloo font-semibold text-sm transition-colors ${
                  difficulty === d
                    ? DIFFICULTY_STYLES[d]
                    : 'border-divider bg-white text-text-muted hover:border-divider'
                }`}
              >
                {d}
              </button>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-between gap-md">
          <Button title="Cancel" onPress={handleClose} variant="ghost" disabled={saving} />
          <Button
            title={saving ? 'Creating…' : 'Create Word'}
            onPress={handleCreate}
            variant="primary"
            disabled={saving || !learningWord.trim() || !homeWord.trim()}
          />
        </div>
      </div>
    </Modal>
  );
}
