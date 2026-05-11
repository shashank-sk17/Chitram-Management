interface CardProps {
  children: React.ReactNode;
  className?: string;
  /** @deprecated use className directly */
  color?: string;
}

export function Card({ children, className = '', color }: CardProps) {
  return (
    <div className={`bg-white rounded-2xl border border-divider shadow-sm p-lg ${color ?? ''} ${className}`}>
      {children}
    </div>
  );
}

// ── StatCard ─────────────────────────────────────────────────────────────────
interface StatCardProps {
  icon: string;
  value: string | number;
  label: string;
  tone?: 'primary' | 'secondary' | 'accent' | 'warning' | 'muted';
}

const toneStyles: Record<NonNullable<StatCardProps['tone']>, {
  border: string;
  iconBg: string;
  iconColor: string;
  valueColor: string;
}> = {
  primary:   { border: '#7C81FF', iconBg: '#EDEEFF', iconColor: '#7C81FF', valueColor: '#1a1c42' },
  secondary: { border: '#00BBAE', iconBg: '#EBFFFE', iconColor: '#00BBAE', valueColor: '#005f59' },
  accent:    { border: '#FF9B24', iconBg: '#FFF0E0', iconColor: '#FF9B24', valueColor: '#a35200' },
  warning:   { border: '#FFB74D', iconBg: '#FFF8E1', iconColor: '#F59E0B', valueColor: '#92400e' },
  muted:     { border: '#D4D6FF', iconBg: '#F5F5F5', iconColor: '#9E9E9E', valueColor: '#1B1B1B' },
};

export function StatCard({ icon, value, label, tone = 'primary' }: StatCardProps) {
  const t = toneStyles[tone];
  return (
    <div
      className="bg-white rounded-2xl shadow-sm flex flex-col p-lg gap-md"
      style={{
        border: '1px solid #F0EDE8',
        borderTop: `4px solid ${t.border}`,
      }}
    >
      <div
        className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl flex-shrink-0"
        style={{ background: t.iconBg, color: t.iconColor }}
      >
        {icon}
      </div>
      <div>
        <p
          className="font-baloo font-extrabold leading-none"
          style={{ fontSize: 40, color: t.valueColor }}
        >
          {value}
        </p>
        <p className="font-baloo text-sm text-text-muted mt-sm leading-snug font-medium">{label}</p>
      </div>
    </div>
  );
}

// ── CompactStatCard ────────────────────────────────────────────────────────────
interface CompactStatCardProps {
  icon: string;
  value: string | number;
  label: string;
  tone?: 'primary' | 'secondary' | 'accent' | 'warning' | 'muted';
}

export function CompactStatCard({ icon, value, label, tone = 'primary' }: CompactStatCardProps) {
  const t = toneStyles[tone];
  return (
    <div
      className="bg-white rounded-xl shadow-sm p-sm flex gap-sm items-center"
      style={{ border: '1px solid #F0EDE8', borderTop: `3px solid ${t.border}` }}
    >
      <div
        className="w-7 h-7 rounded-lg flex items-center justify-center text-sm flex-shrink-0"
        style={{ background: t.iconBg }}
      >
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-baloo font-extrabold leading-none" style={{ fontSize: 20, color: t.valueColor }}>
          {value}
        </p>
        <p className="font-baloo text-[11px] text-text-muted leading-snug truncate">{label}</p>
        <p className="font-baloo leading-none mt-[2px]" style={{ fontSize: 9, color: '#c0bdb8' }}>— no trend data</p>
      </div>
    </div>
  );
}

// ── PageHeader ────────────────────────────────────────────────────────────────
interface PageHeaderProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}

export function PageHeader({ title, subtitle, actions }: PageHeaderProps) {
  return (
    <div className="flex items-start justify-between gap-lg mb-xl flex-wrap">
      <div>
        <h1 className="font-baloo font-extrabold text-xl text-text-dark leading-tight">{title}</h1>
        {subtitle && (
          <p className="font-baloo text-md text-text-muted mt-xs">{subtitle}</p>
        )}
      </div>
      {actions && (
        <div className="flex items-center gap-sm flex-shrink-0">{actions}</div>
      )}
    </div>
  );
}
