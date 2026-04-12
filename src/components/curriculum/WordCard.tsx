import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { WordBankDoc, LanguageCode } from '../../types/firestore';

interface WordCardProps {
  wordId: string;
  word: WordBankDoc;
  learningLanguage: LanguageCode;
  draggable?: boolean;
  onRemove?: () => void;
  onEdit?: () => void;
  compact?: boolean;
  isCustomized?: boolean;
}

// Static version (no DnD)
export function WordCardStatic({ wordId: _wordId, word, learningLanguage, onRemove, onEdit, compact, isCustomized }: Omit<WordCardProps, 'draggable'>) {
  const wordText = word.word?.[learningLanguage] || word.word?.en || '';
  const engText = word.word?.en || '';
  const isPending = word.status === 'pending';

  return (
    <div
      className={`relative flex flex-col items-center rounded-xl bg-white border-2 shadow-sm select-none group
        ${isPending ? 'border-amber-300' : isCustomized ? 'border-secondary/50' : 'border-divider'}
        ${compact ? 'w-20 p-1 gap-0.5' : 'w-28 p-2 gap-1'}
      `}
    >
      {/* Pending badge */}
      {isPending && (
        <span className="absolute -top-1.5 -right-1.5 bg-amber-400 text-white text-[9px] font-bold px-1 py-0.5 rounded-full leading-none">
          pending
        </span>
      )}

      {/* Customized badge */}
      {isCustomized && !isPending && (
        <span className="absolute -top-1.5 -right-1.5 bg-secondary text-white text-[9px] font-bold px-1 py-0.5 rounded-full leading-none">
          ✏️
        </span>
      )}

      {/* Remove button */}
      {onRemove && (
        <button
          onClick={onRemove}
          className="absolute -top-1.5 -left-1.5 w-4 h-4 bg-error text-white rounded-full text-[10px] font-bold flex items-center justify-center hover:bg-red-600 transition-colors z-10 leading-none"
        >
          ×
        </button>
      )}

      {/* Edit button — shown on hover */}
      {onEdit && (
        <button
          onClick={onEdit}
          className="absolute -bottom-1.5 -right-1.5 w-5 h-5 bg-primary text-white rounded-full text-[10px] font-bold flex items-center justify-center hover:bg-primary/80 transition-colors z-10 leading-none opacity-0 group-hover:opacity-100"
          title="Edit word"
        >
          ✏
        </button>
      )}

      {/* Image or placeholder */}
      {word.imageUrl ? (
        <img
          src={word.imageUrl}
          alt={engText}
          className={`object-cover rounded-lg flex-shrink-0 ${compact ? 'w-12 h-12' : 'w-16 h-16'}`}
        />
      ) : (
        <div className={`rounded-lg bg-lavender-light flex items-center justify-center flex-shrink-0 ${compact ? 'w-12 h-12 text-2xl' : 'w-16 h-16 text-3xl'}`}>
          📝
        </div>
      )}

      {/* Word */}
      <p className={`font-baloo font-bold text-text-dark text-center leading-tight line-clamp-2 w-full ${compact ? 'text-xs' : 'text-sm'}`}>
        {wordText}
      </p>
      {!compact && (
        <p className="font-baloo text-xs text-text-muted text-center leading-tight line-clamp-1 w-full">
          {engText}
        </p>
      )}
    </div>
  );
}

// Draggable version
export function WordCardDraggable({ wordId, word, learningLanguage, onRemove, onEdit, compact, isCustomized }: WordCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: wordId });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 999 : undefined,
  };

  const wordText = word.word?.[learningLanguage] || word.word?.en || '';
  const engText = word.word?.en || '';
  const isPending = word.status === 'pending';

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`relative flex flex-col items-center rounded-xl bg-white border-2 shadow-sm cursor-grab active:cursor-grabbing select-none group
        ${isPending ? 'border-amber-300' : isCustomized ? 'border-secondary/50' : 'border-divider'}
        ${isDragging ? 'shadow-lg ring-2 ring-primary' : ''}
        ${compact ? 'w-16 p-1 gap-0.5' : 'w-20 p-2 gap-1'}
      `}
      {...attributes}
      {...listeners}
    >
      {isPending && (
        <span className="absolute -top-1.5 -right-1.5 bg-amber-400 text-white text-[9px] font-bold px-1 py-0.5 rounded-full leading-none">
          pending
        </span>
      )}
      {isCustomized && !isPending && (
        <span className="absolute -top-1.5 -right-1.5 bg-secondary text-white text-[9px] font-bold px-1 py-0.5 rounded-full leading-none">
          ✏️
        </span>
      )}
      {onRemove && (
        <button
          onClick={e => { e.stopPropagation(); onRemove(); }}
          onPointerDown={e => e.stopPropagation()}
          className="absolute -top-1.5 -left-1.5 w-4 h-4 bg-error text-white rounded-full text-[10px] font-bold flex items-center justify-center hover:bg-red-600 transition-colors z-10 leading-none"
        >
          ×
        </button>
      )}
      {onEdit && (
        <button
          onClick={e => { e.stopPropagation(); onEdit(); }}
          className="absolute -bottom-1.5 -right-1.5 w-5 h-5 bg-primary text-white rounded-full text-[10px] font-bold flex items-center justify-center hover:bg-primary/80 transition-colors z-10 leading-none opacity-0 group-hover:opacity-100"
          title="Edit word"
        >
          ✏
        </button>
      )}
      {word.imageUrl ? (
        <img
          src={word.imageUrl}
          alt={engText}
          className={`object-cover rounded-lg flex-shrink-0 pointer-events-none ${compact ? 'w-12 h-12' : 'w-16 h-16'}`}
        />
      ) : (
        <div className={`rounded-lg bg-lavender-light flex items-center justify-center flex-shrink-0 pointer-events-none ${compact ? 'w-12 h-12 text-2xl' : 'w-16 h-16 text-3xl'}`}>
          📝
        </div>
      )}
      <p className={`font-baloo font-bold text-text-dark text-center leading-tight line-clamp-2 w-full pointer-events-none ${compact ? 'text-xs' : 'text-sm'}`}>
        {wordText}
      </p>
      {!compact && (
        <p className="font-baloo text-xs text-text-muted text-center leading-tight line-clamp-1 w-full pointer-events-none">
          {engText}
        </p>
      )}
    </div>
  );
}
