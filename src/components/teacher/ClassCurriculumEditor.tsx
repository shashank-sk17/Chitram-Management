import { useState, useEffect } from 'react';
import { getWordsByGradeLevel, getMotherCurriculum, getCurriculumWords } from '../../services/firebase/curriculum';
import { updateClassCurriculum } from '../../services/firebase/teacher';
import { WordPickerModal } from './WordPickerModal';
import { CustomWordEditModal } from './CustomWordEditModal';
import { CreateCustomWordModal } from './CreateCustomWordModal';
import type { CurriculumWordDoc, LanguageCode } from '../../types/firestore';

interface Props {
  classId: string;
  grade: string;
  /** Language kids in this class are learning (e.g. 'te') */
  learningLanguage: LanguageCode;
  /** Home language of students in this class (e.g. 'en') */
  homeLanguage: LanguageCode;
  /** Current addedWordIds from the ClassDoc (live from store) */
  addedWordIds: string[];
  /** Current removedWordIds from the ClassDoc (live from store) */
  removedWordIds: string[];
}

interface LevelWords {
  level: number;
  ns360: Array<CurriculumWordDoc & { id: string }>;
  gqd: Array<CurriculumWordDoc & { id: string }>;
}

const DIFFICULTY_COLORS: Record<string, string> = {
  Low:    'bg-mint-light text-secondary',
  Medium: 'bg-peach-light text-accent',
  High:   'bg-rose-light text-error',
};

function DiffBadge({ diff }: { diff: string }) {
  return (
    <span className={`font-baloo text-xs px-sm py-xs rounded-full font-semibold ${DIFFICULTY_COLORS[diff] ?? 'bg-divider text-text-muted'}`}>
      {diff}
    </span>
  );
}

export function ClassCurriculumEditor({ classId, grade, learningLanguage, homeLanguage, addedWordIds, removedWordIds }: Props) {
  const [levels, setLevels] = useState<LevelWords[]>([]);
  const [openLevel, setOpenLevel] = useState<number | null>(1);
  const [customWords, setCustomWords] = useState<Array<CurriculumWordDoc & { id: string }>>([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showWordPicker, setShowWordPicker] = useState(false);
  const [showCreateWord, setShowCreateWord] = useState(false);
  const [editingWord, setEditingWord] = useState<(CurriculumWordDoc & { id: string }) | null>(null);

  const gradeNum = parseInt(grade, 10);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const mc = await getMotherCurriculum(grade);
      const count = mc?.levelCount ?? 4;

      const levelData: LevelWords[] = [];
      for (let l = 1; l <= count; l++) {
        const words = await getWordsByGradeLevel(gradeNum, l);
        levelData.push({
          level: l,
          ns360: words.filter(w => w.wordType === 'NS360'),
          gqd:   words.filter(w => w.wordType === 'GQD'),
        });
      }
      setLevels(levelData);
      setLoading(false);
    }
    load();
  }, [grade, gradeNum]);

  // Fetch custom word docs whenever addedWordIds changes
  useEffect(() => {
    if (addedWordIds.length === 0) { setCustomWords([]); return; }
    getCurriculumWords(addedWordIds).then(setCustomWords);
  }, [addedWordIds]);

  const removedSet = new Set(removedWordIds);

  async function toggle(wordId: string) {
    setSaving(true);
    const newRemoved = removedSet.has(wordId)
      ? removedWordIds.filter(id => id !== wordId)   // restore
      : [...removedWordIds, wordId];                  // remove
    await updateClassCurriculum(classId, addedWordIds, newRemoved);
    setSaving(false);
  }

  const allMotherWords = levels.flatMap(l => [...l.ns360, ...l.gqd]);
  const activeMotherCount = allMotherWords.filter(w => !removedSet.has(w.id)).length;

  if (loading) {
    return (
      <div className="flex justify-center items-center py-xxl">
        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-md">

      {/* Summary bar */}
      <div className="flex items-center gap-md flex-wrap">
        <span className="font-baloo text-sm text-text-muted bg-lavender-light px-md py-xs rounded-full">
          <strong className="text-primary">{allMotherWords.length}</strong> mother words
        </span>
        {removedWordIds.length > 0 && (
          <span className="font-baloo text-sm text-text-muted bg-rose-light px-md py-xs rounded-full">
            <strong className="text-error">{removedWordIds.length}</strong> removed
          </span>
        )}
        {addedWordIds.length > 0 && (
          <span className="font-baloo text-sm text-text-muted bg-mint-light px-md py-xs rounded-full">
            <strong className="text-secondary">{addedWordIds.length}</strong> added
          </span>
        )}
        <span className="font-baloo text-sm text-text-muted ml-auto">
          Active: <strong className="text-text-dark">{activeMotherCount + addedWordIds.length}</strong> words
        </span>
        {saving && (
          <span className="font-baloo text-xs text-primary animate-pulse">Saving...</span>
        )}
      </div>

      {/* Level accordions */}
      {levels.map(({ level, ns360, gqd }) => {
        const levelWords = [...ns360, ...gqd];
        const activeCount = levelWords.filter(w => !removedSet.has(w.id)).length;
        const isOpen = openLevel === level;

        return (
          <div key={level} className="border-2 border-divider rounded-xl overflow-hidden">
            {/* Level header */}
            <button
              onClick={() => setOpenLevel(isOpen ? null : level)}
              className="w-full flex items-center justify-between px-md py-sm bg-white hover:bg-lavender-light/30 transition-colors"
            >
              <div className="flex items-center gap-sm">
                <span className="font-baloo font-bold text-md text-text-dark">Level {level}</span>
                <span className="font-baloo text-xs text-text-muted">
                  {ns360.length} NS360 · {gqd.length} GQD
                </span>
              </div>
              <div className="flex items-center gap-sm">
                <span className={`font-baloo text-xs font-semibold px-sm py-xs rounded-full ${
                  activeCount === levelWords.length
                    ? 'bg-mint-light text-secondary'
                    : 'bg-peach-light text-accent'
                }`}>
                  {activeCount}/{levelWords.length} active
                </span>
                <span className="text-text-muted">{isOpen ? '▲' : '▼'}</span>
              </div>
            </button>

            {/* Level body */}
            {isOpen && (
              <div className="border-t-2 border-divider bg-white">
                {ns360.length > 0 && (
                  <WordSection
                    title="NS360 Words"
                    words={ns360}
                    removedSet={removedSet}
                    onToggle={toggle}
                    disabled={saving}
                    learningLanguage={learningLanguage}
                    homeLanguage={homeLanguage}
                  />
                )}
                {gqd.length > 0 && (
                  <WordSection
                    title="GQD Words"
                    words={gqd}
                    removedSet={removedSet}
                    onToggle={toggle}
                    disabled={saving}
                    learningLanguage={learningLanguage}
                    homeLanguage={homeLanguage}
                  />
                )}
              </div>
            )}
          </div>
        );
      })}

      {/* Custom words section */}
      <div className="border-2 border-secondary/30 rounded-xl overflow-hidden">
        <div className="px-md py-sm bg-mint-light/50 flex items-center gap-sm">
          <span className="font-baloo font-bold text-md text-secondary">Custom Words</span>
          {addedWordIds.length > 0 && (
            <span className="font-baloo text-xs text-text-muted">({addedWordIds.length})</span>
          )}
        </div>
        <div className="bg-white">
          {addedWordIds.length > 0 && customWords.length === 0 ? (
            <div className="flex justify-center py-md">
              <div className="w-5 h-5 border-2 border-secondary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : customWords.length > 0 ? (
            customWords.map(word => {
              const learnWord = word.word?.[learningLanguage] || word.word?.te || '';
              const homeWord  = word.word?.[homeLanguage]     || word.word?.en || '';
              return (
                <div key={word.id} className="flex items-center gap-md px-md py-sm border-t border-divider/50 bg-white hover:bg-mint-light/10">
                  <div className="flex-1 min-w-0">
                    <span className="font-baloo font-bold text-md text-text-dark">{learnWord}</span>
                    <span className="font-baloo text-sm text-text-muted mx-xs">/</span>
                    <span className="font-baloo text-sm text-text-muted">{homeWord}</span>
                  </div>
                  <DiffBadge diff={word.difficulty} />
                  <span className="font-baloo text-xs bg-mint-light text-secondary px-sm py-xs rounded-full font-semibold">
                    Custom
                  </span>
                  {word.source === 'teacher' && (
                    <button
                      onClick={() => setEditingWord(word)}
                      className="font-baloo text-sm text-text-muted hover:text-primary transition-colors px-xs"
                      title="Edit image & sentence"
                    >
                      ✏
                    </button>
                  )}
                </div>
              );
            })
          ) : (
            <div className="px-md py-sm">
              <p className="font-baloo text-sm text-text-muted">No custom words yet. Use the button below to add words.</p>
            </div>
          )}
        </div>
      </div>

      {/* Add / Create Word buttons */}
      <div className="flex gap-sm">
        <button
          onClick={() => setShowCreateWord(true)}
          className="flex-1 py-sm border-2 border-dashed border-secondary/50 rounded-xl font-baloo text-sm text-secondary font-semibold hover:bg-mint-light/30 transition-colors"
        >
          + Create Custom Word
        </button>
        <button
          onClick={() => setShowWordPicker(true)}
          className="flex-1 py-sm border-2 border-dashed border-primary/40 rounded-xl font-baloo text-sm text-primary font-semibold hover:bg-lavender-light/30 transition-colors"
        >
          + Add from Curriculum
        </button>
      </div>

      {levels.length === 0 && (
        <div className="text-center py-xl">
          <span className="text-5xl block mb-md">📚</span>
          <p className="font-baloo text-md text-text-muted">No curriculum words found for Grade {grade}.</p>
        </div>
      )}

      {/* Create custom word modal */}
      <CreateCustomWordModal
        isOpen={showCreateWord}
        onClose={() => setShowCreateWord(false)}
        classId={classId}
        grade={gradeNum}
        levelCount={levels.length}
        addedWordIds={addedWordIds}
        removedWordIds={removedWordIds}
        learningLanguage={learningLanguage}
        homeLanguage={homeLanguage}
      />

      {/* Word picker modal */}
      <WordPickerModal
        isOpen={showWordPicker}
        onClose={() => setShowWordPicker(false)}
        classId={classId}
        grade={grade}
        addedWordIds={addedWordIds}
        removedWordIds={removedWordIds}
        motherWordIds={allMotherWords.map(w => w.id)}
        learningLanguage={learningLanguage}
        homeLanguage={homeLanguage}
      />

      {/* Custom word edit modal */}
      {editingWord && (
        <CustomWordEditModal
          isOpen={!!editingWord}
          onClose={() => setEditingWord(null)}
          word={editingWord}
          learningLanguage={learningLanguage}
          homeLanguage={homeLanguage}
        />
      )}
    </div>
  );
}

// ── Word section (NS360 or GQD) ───────────────────────────────────────────────

interface WordSectionProps {
  title: string;
  words: Array<CurriculumWordDoc & { id: string }>;
  removedSet: Set<string>;
  onToggle: (id: string) => Promise<void>;
  disabled: boolean;
  learningLanguage: LanguageCode;
  homeLanguage: LanguageCode;
}

function WordSection({ title, words, removedSet, onToggle, disabled, learningLanguage, homeLanguage }: WordSectionProps) {
  return (
    <div className="border-b border-divider last:border-b-0">
      <p className="font-baloo text-xs font-semibold text-text-muted px-md pt-sm pb-xs uppercase tracking-wide">
        {title}
      </p>
      {words.map(word => {
        const isRemoved = removedSet.has(word.id);
        const learnWord = word.word?.[learningLanguage] || word.word?.te || '';
        const homeWord  = word.word?.[homeLanguage]     || word.word?.en || '';
        return (
          <div
            key={word.id}
            className={`flex items-center gap-md px-md py-sm border-t border-divider/50 transition-colors ${
              isRemoved ? 'bg-divider/30 opacity-60' : 'bg-white hover:bg-lavender-light/20'
            }`}
          >
            <span className={`font-baloo text-sm w-5 text-center flex-shrink-0 ${isRemoved ? 'text-error' : 'text-secondary'}`}>
              {isRemoved ? '✗' : '✓'}
            </span>
            <div className="flex-1 min-w-0">
              <span className={`font-baloo font-bold text-md text-text-dark ${isRemoved ? 'line-through' : ''}`}>
                {learnWord}
              </span>
              <span className="font-baloo text-sm text-text-muted mx-xs">/</span>
              <span className={`font-baloo text-sm text-text-muted ${isRemoved ? 'line-through' : ''}`}>
                {homeWord}
              </span>
            </div>
            <DiffBadge diff={word.difficulty} />
            <button
              onClick={() => onToggle(word.id)}
              disabled={disabled}
              className={`font-baloo text-xs font-semibold px-sm py-xs rounded-lg border transition-colors min-w-[64px] text-center ${
                isRemoved
                  ? 'border-secondary text-secondary hover:bg-mint-light'
                  : 'border-error text-error hover:bg-rose-light'
              } disabled:opacity-50`}
            >
              {isRemoved ? 'Restore' : 'Remove'}
            </button>
          </div>
        );
      })}
    </div>
  );
}
