import { useEffect, useState } from 'react';
import { useAuth } from '../../features/auth/hooks/useAuth';
import { Button } from '../../components/common/Button';
import { Card } from '../../components/common/Card';
import {
  getWordsByGradeLevel,
  toggleWordActive,
  updateCurriculumWord,
} from '../../services/firebase/curriculum';
import type { CurriculumWordDoc } from '../../types/firestore';

const GRADES = ['1', '2', '3', '4', '5'];
// Max levels per grade (Grade 3 has 3 levels, others have 4)
const GRADE_LEVEL_COUNTS: Record<string, number> = { '1': 4, '2': 4, '3': 3, '4': 4, '5': 4 };

const DIFFICULTY_COLORS: Record<string, string> = {
  Low: 'bg-mint-light text-secondary',
  Medium: 'bg-sunshine-light text-warning',
  High: 'bg-rose-light text-error',
};

interface WordCardProps {
  word: CurriculumWordDoc & { id: string };
  onToggleActive: (id: string, active: boolean) => void;
  onEditMeaning: (word: CurriculumWordDoc & { id: string }) => void;
  busy: boolean;
}

function WordCard({ word, onToggleActive, onEditMeaning, busy }: WordCardProps) {
  return (
    <Card className="relative">
      {/* Badge row */}
      <div className="flex gap-xs mb-sm">
        <span className={`px-sm py-xs rounded-full font-baloo text-xs font-bold ${
          word.wordType === 'NS360' ? 'bg-lavender-light text-primary' : 'bg-peach-light text-warning'
        }`}>
          {word.wordType}
        </span>
        <span className={`px-sm py-xs rounded-full font-baloo text-xs ${DIFFICULTY_COLORS[word.difficulty] ?? ''}`}>
          {word.difficulty}
        </span>
        <span className={`ml-auto px-sm py-xs rounded-full font-baloo text-xs ${
          word.active ? 'bg-mint-light text-secondary' : 'bg-rose-light text-error'
        }`}>
          {word.active ? 'Active' : 'Disabled'}
        </span>
      </div>

      {/* Word */}
      <div className="mb-sm">
        <h3 className="font-baloo font-bold text-xxl text-text-dark">#{word.numericId} {word.word.te}</h3>
        <p className="font-baloo text-body text-text-muted">{word.word.en}</p>
      </div>

      {/* Meaning */}
      {word.meaning?.te ? (
        <p className="font-baloo text-sm text-text-body italic mb-sm">{word.meaning.te}</p>
      ) : (
        <p className="font-baloo text-sm text-text-muted italic mb-sm">— meaning not set —</p>
      )}

      {/* Sentence */}
      {word.sentence?.te && (
        <p className="font-baloo text-sm text-text-muted mb-md">"{word.sentence.te}"</p>
      )}

      {/* Actions */}
      <div className="flex gap-sm">
        <button
          onClick={() => onEditMeaning(word)}
          className="flex-1 px-sm py-xs rounded-lg border border-divider font-baloo text-sm text-text-body hover:bg-bg-light transition-colors"
        >
          Edit
        </button>
        <button
          onClick={() => onToggleActive(word.id, !word.active)}
          disabled={busy}
          className={`flex-1 px-sm py-xs rounded-lg font-baloo text-sm transition-colors ${
            word.active
              ? 'border border-error text-error hover:bg-rose-light'
              : 'border border-secondary text-secondary hover:bg-mint-light'
          } disabled:opacity-50`}
        >
          {word.active ? 'Disable' : 'Enable'}
        </button>
      </div>
    </Card>
  );
}

interface EditMeaningModalProps {
  word: (CurriculumWordDoc & { id: string }) | null;
  onClose: () => void;
  onSaved: () => void;
}

function EditMeaningModal({ word, onClose, onSaved }: EditMeaningModalProps) {
  const [meaning, setMeaning] = useState({ te: '', en: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (word) setMeaning({ te: word.meaning?.te ?? '', en: word.meaning?.en ?? '' });
  }, [word]);

  if (!word) return null;

  async function handleSave() {
    if (!word) return;
    setSaving(true);
    try {
      await updateCurriculumWord(word.id, { meaning });
      onSaved();
      onClose();
    } catch (e: any) {
      alert(e.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-md">
      <div className="bg-white rounded-xxl shadow-xl max-w-lg w-full p-xl">
        <h2 className="font-baloo font-bold text-xl text-text-dark mb-md">
          Edit Meaning — {word.word.te} / {word.word.en}
        </h2>
        <div className="mb-md">
          <label className="block font-baloo text-sm text-text-muted mb-xs">Telugu meaning (te)</label>
          <input
            className="w-full border border-divider rounded-lg px-md py-sm font-baloo text-body"
            value={meaning.te}
            onChange={e => setMeaning(m => ({ ...m, te: e.target.value }))}
            placeholder="అర్థం..."
          />
        </div>
        <div className="mb-lg">
          <label className="block font-baloo text-sm text-text-muted mb-xs">English meaning (en)</label>
          <input
            className="w-full border border-divider rounded-lg px-md py-sm font-baloo text-body"
            value={meaning.en}
            onChange={e => setMeaning(m => ({ ...m, en: e.target.value }))}
            placeholder="Definition..."
          />
        </div>
        <div className="flex gap-md">
          <Button title="Cancel" onPress={onClose} variant="secondary" size="sm" />
          <Button title={saving ? 'Saving…' : 'Save'} onPress={handleSave} variant="primary" size="sm" disabled={saving} />
        </div>
      </div>
    </div>
  );
}

export default function AdminCurriculumPage() {
  const { user, claims } = useAuth();

  const [selectedGrade, setSelectedGrade] = useState('1');
  const [selectedLevel, setSelectedLevel] = useState(1);
  const [words, setWords] = useState<Array<CurriculumWordDoc & { id: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editWord, setEditWord] = useState<(CurriculumWordDoc & { id: string }) | null>(null);

  const canManageCurriculum = claims?.role === 'admin';
  const levelCount = GRADE_LEVEL_COUNTS[selectedGrade] ?? 4;
  const ns360Words = words.filter(w => w.wordType === 'NS360');
  const gqdWords = words.filter(w => w.wordType === 'GQD');

  useEffect(() => {
    // Reset level if it exceeds the new grade's level count
    if (selectedLevel > levelCount) setSelectedLevel(1);
  }, [selectedGrade]);

  useEffect(() => {
    loadWords();
  }, [selectedGrade, selectedLevel]);

  async function loadWords() {
    setLoading(true);
    try {
      const data = await getWordsByGradeLevel(Number(selectedGrade), selectedLevel);
      setWords(data);
    } catch (err) {
      console.error('Error loading words:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleToggleActive(wordId: string, active: boolean) {
    setBusyId(wordId);
    try {
      await toggleWordActive(wordId, active);
      setWords(prev => prev.map(w => w.id === wordId ? { ...w, active } : w));
    } catch (e: any) {
      alert(e.message || 'Failed to update word');
    } finally {
      setBusyId(null);
    }
  }

  if (!canManageCurriculum) {
    return (
      <div className="flex items-center justify-center">
        <Card className="text-center max-w-lg">
          <div className="w-24 h-24 rounded-full bg-rose-light flex items-center justify-center mx-auto mb-md">
            <span className="text-5xl">🚫</span>
          </div>
          <h2 className="font-baloo font-bold text-xl text-text-dark mb-sm">Access Denied</h2>
          <p className="font-baloo text-body text-text-muted mb-lg">
            Only Super Admins can manage the mother curriculum
          </p>
          <Button title="Go Back" onPress={() => window.history.back()} variant="primary" />
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-xl">
        <h1 className="font-baloo font-bold text-xxl text-text-dark">Mother Curriculum</h1>
        <p className="font-baloo text-body text-text-muted">{user?.email} • Super Admin</p>
      </div>

      {/* Grade + Level selectors */}
      <div className="flex flex-wrap gap-md mb-xl">
        <div>
          <p className="font-baloo font-semibold text-sm text-text-muted mb-xs uppercase tracking-wide">Grade</p>
          <div className="flex gap-sm">
            {GRADES.map(g => (
              <button
                key={g}
                onClick={() => setSelectedGrade(g)}
                className={`w-10 h-10 rounded-xl border-2 font-baloo font-bold transition-colors ${
                  selectedGrade === g
                    ? 'border-primary bg-lavender-light text-primary'
                    : 'border-divider bg-white text-text-dark hover:border-primary/50'
                }`}
              >
                {g}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="font-baloo font-semibold text-sm text-text-muted mb-xs uppercase tracking-wide">Level</p>
          <div className="flex gap-sm">
            {Array.from({ length: levelCount }, (_, i) => i + 1).map(l => (
              <button
                key={l}
                onClick={() => setSelectedLevel(l)}
                className={`w-10 h-10 rounded-xl border-2 font-baloo font-bold transition-colors ${
                  selectedLevel === l
                    ? 'border-primary bg-lavender-light text-primary'
                    : 'border-divider bg-white text-text-dark hover:border-primary/50'
                }`}
              >
                {l}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex justify-center items-center h-64">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {/* Grade/Level summary */}
      {!loading && (
        <p className="font-baloo text-sm text-text-muted mb-lg">
          Grade {selectedGrade} · Level {selectedLevel} — {ns360Words.length} NS360 words, {gqdWords.length} GQD words
        </p>
      )}

      {/* NS360 + GQD columns */}
      {!loading && words.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-xl">
          {/* NS360 column */}
          <div>
            <h2 className="font-baloo font-bold text-lg text-primary mb-md">
              NS360 Words ({ns360Words.length})
            </h2>
            <div className="flex flex-col gap-md">
              {ns360Words.map(word => (
                <WordCard
                  key={word.id}
                  word={word}
                  onToggleActive={handleToggleActive}
                  onEditMeaning={setEditWord}
                  busy={busyId === word.id}
                />
              ))}
            </div>
          </div>

          {/* GQD column */}
          <div>
            <h2 className="font-baloo font-bold text-lg text-warning mb-md">
              GQD Words ({gqdWords.length})
            </h2>
            <div className="flex flex-col gap-md">
              {gqdWords.map(word => (
                <WordCard
                  key={word.id}
                  word={word}
                  onToggleActive={handleToggleActive}
                  onEditMeaning={setEditWord}
                  busy={busyId === word.id}
                />
              ))}
              {gqdWords.length === 0 && (
                <p className="font-baloo text-sm text-text-muted italic">No GQD words in this level.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {!loading && words.length === 0 && (
        <Card className="text-center py-xxl">
          <span className="text-5xl mb-md block">📚</span>
          <h3 className="font-baloo font-bold text-xl text-text-dark mb-sm">No words found</h3>
          <p className="font-baloo text-body text-text-muted">
            Grade {selectedGrade} Level {selectedLevel} has no vocabulary yet. Run the seed script to populate.
          </p>
        </Card>
      )}

      {/* Edit meaning modal */}
      <EditMeaningModal
        word={editWord}
        onClose={() => setEditWord(null)}
        onSaved={loadWords}
      />
    </div>
  );
}
