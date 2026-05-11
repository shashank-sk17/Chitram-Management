import { useState, useMemo } from 'react';
import {
  DndContext,
  DragOverlay,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  horizontalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import { motion, AnimatePresence } from 'framer-motion';
import type { CurriculumLevel, WordBankDoc, LanguageCode } from '../../types/firestore';
import { WordCardDraggable, WordCardStatic } from './WordCard';

interface LevelEditorProps {
  levels: CurriculumLevel[];
  words: Record<string, WordBankDoc>;
  learningLanguage: LanguageCode;
  onChange?: (levels: CurriculumLevel[]) => void;
  onAddWord?: (levelNum: number) => void;
  onEditWord?: (wordId: string) => void;
  customizedWordIds?: Set<string>;
  readonly?: boolean;
  grade?: number;
}

function SuggestionsRow({
  levelNum,
  levelWordIds,
  otherLevelMap,
  words,
  learningLanguage,
  onAdd,
}: {
  levelNum: number;
  levelWordIds: string[];
  otherLevelMap: Map<string, number>;
  words: Record<string, WordBankDoc>;
  learningLanguage: LanguageCode;
  onAdd: (wordId: string) => void;
}) {
  const thisLevelSet = useMemo(() => new Set(levelWordIds), [levelWordIds]);

  const difficulty = useMemo((): 'Low' | 'Medium' | 'High' => {
    const counts: Record<string, number> = { Low: 0, Medium: 0, High: 0 };
    for (const id of levelWordIds) {
      const w = words[id];
      if (w?.difficulty) counts[w.difficulty]++;
    }
    const max = Math.max(...Object.values(counts));
    if (max === 0) return 'Medium';
    return (Object.entries(counts).find(([, v]) => v === max)?.[0] as 'Low' | 'Medium' | 'High') ?? 'Medium';
  }, [levelWordIds, words]);

  // Use words already loaded in the store — no extra Firestore fetch needed
  const visible = useMemo(() => {
    const candidates = Object.entries(words)
      .filter(([id]) => !thisLevelSet.has(id))
      .map(([id, w]) => ({ id, ...w }));

    // Sort: same difficulty first, then rest
    return [
      ...candidates.filter(w => w.difficulty === difficulty),
      ...candidates.filter(w => w.difficulty !== difficulty),
    ].slice(0, 15);
  }, [words, thisLevelSet, difficulty]);

  if (visible.length === 0) return null;

  return (
    <div className="mt-sm border-t border-divider pt-sm">
      <p className="font-baloo text-xs text-text-muted mb-xs px-xs">
        ✨ Suggested — click to move to Level {levelNum}
      </p>
      <div className="flex gap-xs overflow-x-auto pb-xs" style={{ scrollbarWidth: 'thin' }}>
        {visible.map(word => {
          const wordText = word.word?.[learningLanguage] || word.word?.te || word.word?.en || '';
          const inLevel = otherLevelMap.get(word.id);
          return (
            <button
              key={word.id}
              onClick={() => onAdd(word.id)}
              className="relative flex-shrink-0 flex flex-col items-center gap-xs p-xs rounded-xl border-2 border-dashed border-primary/20 hover:border-primary hover:bg-lavender-light transition-all group w-[72px]"
              title={inLevel ? `Move from Level ${inLevel} → Level ${levelNum}` : `Add to Level ${levelNum}`}
            >
              {inLevel != null && (
                <span className="absolute -top-1 -right-1 bg-amber-400 text-white font-baloo font-bold text-[9px] px-1 rounded-full leading-4">
                  L{inLevel}
                </span>
              )}
              {word.imageUrl ? (
                <img src={word.imageUrl} alt={wordText} className="w-11 h-11 object-cover rounded-lg" />
              ) : (
                <div className="w-11 h-11 rounded-lg bg-gray-100 flex items-center justify-center text-base">📝</div>
              )}
              <span className="font-baloo text-[10px] text-text-dark text-center leading-tight line-clamp-2 w-full">{wordText}</span>
              <span className="text-primary text-xs font-bold opacity-0 group-hover:opacity-100 transition-opacity leading-none">+</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function LevelEditor({ levels, words, learningLanguage, onChange, onAddWord, onEditWord, customizedWordIds, readonly, grade: _grade }: LevelEditorProps) {
  const [openLevels, setOpenLevels] = useState<Record<number, boolean>>(
    Object.fromEntries(levels.map(l => [l.levelNum, true]))
  );
  const [activeId, setActiveId] = useState<string | null>(null);
  const [_activeLevelNum, setActiveLevelNum] = useState<number | null>(null);

  const otherLevelMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const l of levels) {
      for (const id of l.wordIds) map.set(id, l.levelNum);
    }
    return map;
  }, [levels]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const toggleLevel = (levelNum: number) => {
    setOpenLevels(prev => ({ ...prev, [levelNum]: !prev[levelNum] }));
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(String(event.active.id));
    // Find which level this word belongs to
    for (const level of levels) {
      if (level.wordIds.includes(String(event.active.id))) {
        setActiveLevelNum(level.levelNum);
        break;
      }
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    setActiveLevelNum(null);

    if (!over || !onChange) return;

    const activeWordId = String(active.id);
    const overId = String(over.id);

    // Find source level
    const sourceLevelIdx = levels.findIndex(l => l.wordIds.includes(activeWordId));
    if (sourceLevelIdx === -1) return;

    // Find target: could be a word or a level number
    const targetLevelIdx = levels.findIndex(l => l.wordIds.includes(overId) || l.levelNum === Number(overId));

    if (targetLevelIdx === -1) return;

    if (sourceLevelIdx === targetLevelIdx) {
      // Reorder within same level
      const level = levels[sourceLevelIdx];
      const oldIdx = level.wordIds.indexOf(activeWordId);
      const newIdx = level.wordIds.indexOf(overId);
      if (oldIdx === newIdx) return;
      const newWordIds = arrayMove(level.wordIds, oldIdx, newIdx);
      const newLevels = levels.map((l, i) =>
        i === sourceLevelIdx ? { ...l, wordIds: newWordIds } : l
      );
      onChange(newLevels);
    } else {
      // Move between levels
      const newLevels = levels.map((l, i) => {
        if (i === sourceLevelIdx) {
          return { ...l, wordIds: l.wordIds.filter(id => id !== activeWordId) };
        }
        if (i === targetLevelIdx) {
          const insertIdx = l.wordIds.indexOf(overId);
          const newIds = [...l.wordIds];
          if (insertIdx >= 0) {
            newIds.splice(insertIdx, 0, activeWordId);
          } else {
            newIds.push(activeWordId);
          }
          return { ...l, wordIds: newIds };
        }
        return l;
      });
      onChange(newLevels);
    }
  };

  const removeWord = (levelNum: number, wordId: string) => {
    if (!onChange) return;
    onChange(levels.map(l =>
      l.levelNum === levelNum ? { ...l, wordIds: l.wordIds.filter(id => id !== wordId) } : l
    ));
  };

  const addLevel = () => {
    if (!onChange) return;
    const nextNum = Math.max(0, ...levels.map(l => l.levelNum)) + 1;
    onChange([...levels, { levelNum: nextNum, wordIds: [] }]);
    setOpenLevels(prev => ({ ...prev, [nextNum]: true }));
  };

  const deleteLevel = (levelNum: number) => {
    if (!onChange) return;
    onChange(levels.filter(l => l.levelNum !== levelNum));
  };

  const activeWord = activeId ? words[activeId] : null;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="space-y-md">
        {levels.map((level) => {
          const isOpen = openLevels[level.levelNum] !== false;
          const wordCount = level.wordIds.length;

          return (
            <div key={level.levelNum} className="bg-white rounded-xl border border-divider overflow-hidden shadow-sm">
              {/* Level Header */}
              <div
                className="flex items-center justify-between px-md py-sm bg-gradient-to-r from-lavender-light to-mint-light cursor-pointer"
                onClick={() => toggleLevel(level.levelNum)}
              >
                <div className="flex items-center gap-sm">
                  <div className="w-9 h-9 rounded-lg bg-primary text-white flex items-center justify-center font-baloo font-bold text-md">
                    {level.levelNum}
                  </div>
                  <div>
                    <span className="font-baloo font-bold text-md text-text-dark">Level {level.levelNum}</span>
                    <span className="ml-sm font-baloo text-sm text-text-muted">
                      {wordCount} word{wordCount !== 1 ? 's' : ''}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-sm">
                  {!readonly && (
                    <button
                      onClick={e => { e.stopPropagation(); deleteLevel(level.levelNum); }}
                      className="text-text-muted hover:text-error transition-colors text-sm p-xs rounded-md hover:bg-rose-light"
                    >
                      🗑️
                    </button>
                  )}
                  <span className="text-text-muted transition-transform duration-200" style={{ transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}>
                    ▾
                  </span>
                </div>
              </div>

              {/* Level Content */}
              <AnimatePresence initial={false}>
                {isOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="p-md">
                      <SortableContext
                        items={level.wordIds}
                        strategy={horizontalListSortingStrategy}
                        disabled={readonly}
                      >
                        <div className="flex flex-wrap gap-sm min-h-[130px] p-sm bg-gray-50 rounded-xl border-2 border-dashed border-divider">
                          {level.wordIds.map(wordId => {
                            const word = words[wordId];
                            if (!word) return (
                              <div key={wordId} className="w-20 h-[90px] rounded-xl bg-gray-100 flex items-center justify-center">
                                <span className="text-[10px] text-text-muted text-center px-1">{wordId}</span>
                              </div>
                            );
                            return readonly ? (
                              <WordCardStatic
                                key={wordId}
                                wordId={wordId}
                                word={word}
                                learningLanguage={learningLanguage}
                                isCustomized={customizedWordIds?.has(wordId)}
                              />
                            ) : (
                              <WordCardDraggable
                                key={wordId}
                                wordId={wordId}
                                word={word}
                                learningLanguage={learningLanguage}
                                onRemove={() => removeWord(level.levelNum, wordId)}
                                onEdit={onEditWord ? () => onEditWord(wordId) : undefined}
                                isCustomized={customizedWordIds?.has(wordId)}
                              />
                            );
                          })}
                          {level.wordIds.length === 0 && (
                            <div className="flex-1 flex items-center justify-center text-text-muted font-baloo text-sm">
                              {readonly ? 'No words in this level' : 'Drag words here or click + Add Word'}
                            </div>
                          )}
                        </div>
                      </SortableContext>

                      {!readonly && onAddWord && (
                        <button
                          onClick={() => onAddWord(level.levelNum)}
                          className="mt-sm w-full py-xs border-2 border-dashed border-primary/30 rounded-xl text-primary font-baloo font-semibold text-sm hover:border-primary hover:bg-lavender-light transition-colors"
                        >
                          + Add Word
                        </button>
                      )}

                      {!readonly && onChange && (
                        <SuggestionsRow
                          levelNum={level.levelNum}
                          levelWordIds={level.wordIds}
                          otherLevelMap={otherLevelMap}
                          words={words}
                          learningLanguage={learningLanguage}
                          onAdd={(wordId) => {
                            // Remove from other level if present, then add to this level
                            const updatedLevels = levels.map(l => {
                              if (l.levelNum === level.levelNum) {
                                return l.wordIds.includes(wordId) ? l : { ...l, wordIds: [...l.wordIds, wordId] };
                              }
                              return { ...l, wordIds: l.wordIds.filter(id => id !== wordId) };
                            });
                            onChange(updatedLevels);
                          }}
                        />
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}

        {/* Add Level button */}
        {!readonly && onChange && (
          <button
            onClick={addLevel}
            className="w-full py-sm border-2 border-dashed border-secondary/40 rounded-xl text-secondary font-baloo font-bold text-sm hover:border-secondary hover:bg-mint-light transition-colors"
          >
            + Add Level
          </button>
        )}
      </div>

      {/* Drag Overlay */}
      <DragOverlay>
        {activeId && activeWord ? (
          <WordCardStatic
            wordId={activeId}
            word={activeWord}
            learningLanguage={learningLanguage}
          />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
