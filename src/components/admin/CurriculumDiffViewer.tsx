import type { CurriculumLevel, WordBankDoc, LanguageCode } from '../../types/firestore';
import { WordCardStatic } from '../curriculum/WordCard';

interface CurriculumDiffViewerProps {
  masterLevels: CurriculumLevel[];
  proposedLevels: CurriculumLevel[];
  words: Record<string, WordBankDoc>;
  learningLanguage: LanguageCode;
}

interface WordDiff {
  wordId: string;
  status: 'unchanged' | 'added' | 'removed' | 'pending';
}

function computeLevelDiff(masterIds: string[], proposedIds: string[], pendingIds: string[]): WordDiff[] {
  const masterSet = new Set(masterIds);
  const proposedSet = new Set(proposedIds);
  const pendingSet = new Set(pendingIds);

  const all = new Set([...masterIds, ...proposedIds]);
  return Array.from(all).map(wordId => {
    if (pendingSet.has(wordId)) return { wordId, status: 'pending' as const };
    if (masterSet.has(wordId) && proposedSet.has(wordId)) return { wordId, status: 'unchanged' as const };
    if (!masterSet.has(wordId) && proposedSet.has(wordId)) return { wordId, status: 'added' as const };
    return { wordId, status: 'removed' as const };
  });
}

const STATUS_STYLES: Record<WordDiff['status'], string> = {
  unchanged: 'opacity-60',
  added: 'ring-2 ring-success',
  removed: 'ring-2 ring-error opacity-50',
  pending: 'ring-2 ring-amber-400',
};

const STATUS_LABEL: Record<WordDiff['status'], string | null> = {
  unchanged: null,
  added: '+ added',
  removed: '− removed',
  pending: '⏳ pending',
};

const LABEL_COLORS: Record<WordDiff['status'], string> = {
  unchanged: '',
  added: 'bg-success text-white',
  removed: 'bg-error text-white',
  pending: 'bg-amber-400 text-white',
};

export function CurriculumDiffViewer({ masterLevels, proposedLevels, words, learningLanguage }: CurriculumDiffViewerProps) {
  // Count summary
  let added = 0, removed = 0, pending = 0;

  const allLevelNums = new Set([
    ...masterLevels.map(l => l.levelNum),
    ...proposedLevels.map(l => l.levelNum),
  ]);

  const pendingIds = Object.entries(words)
    .filter(([, w]) => w.status === 'pending')
    .map(([id]) => id);

  const levelDiffs = Array.from(allLevelNums).sort((a, b) => a - b).map(levelNum => {
    const master = masterLevels.find(l => l.levelNum === levelNum);
    const proposed = proposedLevels.find(l => l.levelNum === levelNum);
    const diffs = computeLevelDiff(master?.wordIds ?? [], proposed?.wordIds ?? [], pendingIds);
    diffs.forEach(d => {
      if (d.status === 'added') added++;
      if (d.status === 'removed') removed++;
      if (d.status === 'pending') pending++;
    });
    return { levelNum, diffs };
  });

  return (
    <div className="space-y-md">
      {/* Summary */}
      <div className="flex items-center gap-sm flex-wrap">
        {added > 0 && (
          <span className="px-sm py-xs bg-success/10 text-success font-baloo font-semibold text-sm rounded-full">
            +{added} added
          </span>
        )}
        {removed > 0 && (
          <span className="px-sm py-xs bg-error/10 text-error font-baloo font-semibold text-sm rounded-full">
            −{removed} removed
          </span>
        )}
        {pending > 0 && (
          <span className="px-sm py-xs bg-amber-50 text-amber-600 font-baloo font-semibold text-sm rounded-full">
            ⏳ {pending} pending new words
          </span>
        )}
        {added === 0 && removed === 0 && pending === 0 && (
          <span className="text-text-muted font-baloo text-sm">No changes from master curriculum</span>
        )}
      </div>

      {/* Level by level diff */}
      {levelDiffs.map(({ levelNum, diffs }) => (
        <div key={levelNum} className="bg-white rounded-xl border border-divider overflow-hidden">
          <div className="px-md py-sm bg-lavender-light/50 border-b border-divider flex items-center gap-sm">
            <div className="w-6 h-6 rounded-md bg-primary text-white flex items-center justify-center font-baloo font-bold text-xs">
              {levelNum}
            </div>
            <span className="font-baloo font-semibold text-text-dark">Level {levelNum}</span>
            <span className="font-baloo text-sm text-text-muted">{diffs.length} words</span>
          </div>
          <div className="p-md flex flex-wrap gap-sm">
            {diffs.map(({ wordId, status }) => {
              const word = words[wordId];
              const label = STATUS_LABEL[status];
              return (
                <div key={wordId} className={`relative ${STATUS_STYLES[status]} rounded-xl`}>
                  {label && (
                    <span className={`absolute -top-1.5 left-1/2 -translate-x-1/2 text-[8px] font-bold px-1 py-0.5 rounded-full whitespace-nowrap z-10 ${LABEL_COLORS[status]}`}>
                      {label}
                    </span>
                  )}
                  {word ? (
                    <WordCardStatic
                      wordId={wordId}
                      word={word}
                      learningLanguage={learningLanguage}
                      compact
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-xl bg-gray-100 flex items-center justify-center">
                      <span className="text-[9px] text-text-muted text-center px-1">{wordId}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
