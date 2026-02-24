export type TimePeriod = 'week' | 'month' | 'quarter' | 'all';

interface TimePeriodSelectorProps {
  value: TimePeriod;
  onChange: (period: TimePeriod) => void;
}

const OPTIONS: { label: string; value: TimePeriod }[] = [
  { label: 'This Week', value: 'week' },
  { label: 'This Month', value: 'month' },
  { label: 'This Quarter', value: 'quarter' },
  { label: 'All Time', value: 'all' },
];

export function TimePeriodSelector({ value, onChange }: TimePeriodSelectorProps) {
  return (
    <div className="flex gap-xs bg-white rounded-xl border-2 border-divider p-xs">
      {OPTIONS.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`px-sm sm:px-md py-xs rounded-lg font-baloo text-xs sm:text-sm font-semibold transition-all ${
            value === opt.value
              ? 'bg-primary text-white shadow-sm'
              : 'text-text-muted hover:text-text-dark'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
