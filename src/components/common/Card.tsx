interface CardProps {
  children: React.ReactNode;
  className?: string;
  /** @deprecated use className directly */
  color?: string;
}

export function Card({ children, className = '', color }: CardProps) {
  return (
    <div className={`bg-white rounded-xl border border-divider shadow-sm p-md sm:p-lg ${color ?? ''} ${className}`}>
      {children}
    </div>
  );
}

// ── StatCard ─────────────────────────────────────────────────────────────────
// Used across all dashboards. Replaces the random-gradient-per-card pattern.
interface StatCardProps {
  icon: string;
  value: string | number;
  label: string;
  /** 'primary' | 'secondary' | 'accent' | 'warning' | 'muted' */
  tone?: 'primary' | 'secondary' | 'accent' | 'warning' | 'muted';
}

const toneClasses = {
  primary:   { icon: 'bg-lavender-light text-primary',   value: 'text-primary' },
  secondary: { icon: 'bg-mint-light text-secondary',      value: 'text-secondary' },
  accent:    { icon: 'bg-peach-light text-accent',        value: 'text-accent' },
  warning:   { icon: 'bg-amber-50 text-amber-600',        value: 'text-amber-600' },
  muted:     { icon: 'bg-divider text-text-muted',        value: 'text-text-dark' },
};

export function StatCard({ icon, value, label, tone = 'primary' }: StatCardProps) {
  const t = toneClasses[tone];
  return (
    <div className="bg-white rounded-xl border border-divider shadow-sm p-md flex items-center gap-md">
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 text-xl ${t.icon}`}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className={`font-baloo font-extrabold text-xl leading-none ${t.value}`}>{value}</p>
        <p className="font-baloo text-xs text-text-muted mt-[2px] leading-tight">{label}</p>
      </div>
    </div>
  );
}
