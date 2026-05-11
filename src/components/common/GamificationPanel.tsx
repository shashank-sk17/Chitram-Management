/**
 * GamificationPanel — reusable XP / badges / leaderboard panel.
 * Supports cascading filters: project → school → class.
 * All Firestore reads happen in the parent; this component is pure display + filter.
 */
import { useMemo, useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Card, StatCard } from './Card';

export interface GamificationStudent {
  id: string;
  name: string;
  avatarColor: string;
  xp: number;
  weeklyXP: number;
  playerLevel: number;
  badges: string[];
  streakDays: number;
  learnedWords: number;
  // Jurisdiction IDs for filtering
  projectId?: string;
  schoolId?: string;
  classId?: string;
}

export interface FilterOption { id: string; name: string; }

interface Props {
  students: GamificationStudent[];
  loading?: boolean;
  /** Filter options available to this role — pass only what applies */
  projects?: FilterOption[];
  schools?: FilterOption[];
  classes?: FilterOption[];
}

// ── Badge metadata ────────────────────────────────────────────────────────────

const BADGE_META: Record<string, { emoji: string; label: string }> = {
  first_word:    { emoji: '🌱', label: 'First Word' },
  streak_3:      { emoji: '🔥', label: '3-day Streak' },
  streak_7:      { emoji: '⚡', label: '7-day Streak' },
  streak_30:     { emoji: '💎', label: '30-day Streak' },
  perfect_score: { emoji: '⭐', label: 'Perfect Score' },
  wordsmith_10:  { emoji: '📚', label: 'Wordsmith 10' },
  wordsmith_50:  { emoji: '🏆', label: 'Wordsmith 50' },
  wordsmith_100: { emoji: '👑', label: 'Wordsmith 100' },
  level_5:       { emoji: '🚀', label: 'Level 5' },
  level_10:      { emoji: '🌟', label: 'Level 10' },
};

const XP_PER_LEVEL = 500;

// ── Sort ──────────────────────────────────────────────────────────────────────

type SortKey = 'xp' | 'weeklyXP' | 'streak' | 'badges' | 'level';

const SORT_OPTIONS: { key: SortKey; label: string; icon: string }[] = [
  { key: 'xp',       label: 'Total XP',  icon: '⚡' },
  { key: 'weeklyXP', label: 'This Week', icon: '📅' },
  { key: 'streak',   label: 'Streak',    icon: '🔥' },
  { key: 'badges',   label: 'Badges',    icon: '🏅' },
  { key: 'level',    label: 'Level',     icon: '🎮' },
];

function sortStudents(students: GamificationStudent[], key: SortKey) {
  return [...students].sort((a, b) => {
    if (key === 'xp')       return b.xp - a.xp;
    if (key === 'weeklyXP') return b.weeklyXP - a.weeklyXP;
    if (key === 'streak')   return b.streakDays - a.streakDays;
    if (key === 'badges')   return b.badges.length - a.badges.length;
    if (key === 'level')    return b.playerLevel - a.playerLevel;
    return 0;
  });
}

function rankMedal(rank: number) {
  if (rank === 1) return '🥇';
  if (rank === 2) return '🥈';
  if (rank === 3) return '🥉';
  return null;
}

// ── Sub-components ────────────────────────────────────────────────────────────

function AvatarCircle({ name, color }: { name: string; color: string }) {
  return (
    <div
      className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 font-baloo font-bold text-white text-sm"
      style={{ backgroundColor: color }}
    >
      {name[0]?.toUpperCase() ?? '?'}
    </div>
  );
}

function XPBar({ xp, level }: { xp: number; level: number }) {
  const xpInLevel = xp % XP_PER_LEVEL;
  const pct = Math.min((xpInLevel / XP_PER_LEVEL) * 100, 100);
  return (
    <div className="flex items-center gap-sm min-w-0">
      <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
        <span className="text-[9px] font-baloo font-bold text-white leading-none">{level}</span>
      </div>
      <div className="flex-1 h-1.5 bg-divider rounded-full overflow-hidden min-w-[40px]">
        <div className="h-full bg-primary rounded-full" style={{ width: `${pct}%` }} />
      </div>
      <span className="font-baloo text-xs text-text-muted flex-shrink-0">{xp} XP</span>
    </div>
  );
}

function FilterSelect({
  label, value, onChange, options, disabled,
}: {
  label: string; value: string; onChange: (v: string) => void;
  options: FilterOption[]; disabled?: boolean;
}) {
  return (
    <div className="flex flex-col gap-[2px]">
      <label className="font-baloo text-xs text-text-muted uppercase tracking-wide">{label}</label>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        disabled={disabled || options.length === 0}
        className="font-baloo text-sm border border-divider rounded-xl px-md py-sm bg-white text-text-dark focus:outline-none focus:border-primary disabled:opacity-40 disabled:cursor-not-allowed min-w-[140px]"
      >
        <option value="all">All {label}s</option>
        {options.map(o => (
          <option key={o.id} value={o.id}>{o.name}</option>
        ))}
      </select>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function GamificationPanel({
  students,
  loading = false,
  projects = [],
  schools = [],
  classes = [],
}: Props) {
  const [sortKey, setSortKey] = useState<SortKey>('xp');
  const [visibleCount, setVisibleCount] = useState(10);

  // Cascading filter state
  const [selectedProject, setSelectedProject] = useState('all');
  const [selectedSchool,  setSelectedSchool]  = useState('all');
  const [selectedClass,   setSelectedClass]   = useState('all');

  // When project changes, reset downstream filters
  const handleProjectChange = (v: string) => {
    setSelectedProject(v);
    setSelectedSchool('all');
    setSelectedClass('all');
  };
  const handleSchoolChange = (v: string) => {
    setSelectedSchool(v);
    setSelectedClass('all');
  };

  // Schools available for the selected project
  const filteredSchools = useMemo((): FilterOption[] => {
    if (selectedProject === 'all' || schools.length === 0) return schools;
    // schools that belong to selected project — we filter by students who are in that project
    const studentSchoolIds = new Set(
      students
        .filter(s => s.projectId === selectedProject)
        .map(s => s.schoolId)
        .filter(Boolean) as string[]
    );
    return schools.filter(s => studentSchoolIds.has(s.id));
  }, [selectedProject, schools, students]);

  // Classes available for the selected school
  const filteredClasses = useMemo((): FilterOption[] => {
    if (selectedSchool === 'all' || classes.length === 0) return classes;
    const studentClassIds = new Set(
      students
        .filter(s => s.schoolId === selectedSchool)
        .map(s => s.classId)
        .filter(Boolean) as string[]
    );
    return classes.filter(c => studentClassIds.has(c.id));
  }, [selectedSchool, classes, students]);

  // Apply filters to students
  const filtered = useMemo(() => {
    let result = students;
    if (selectedProject !== 'all') result = result.filter(s => s.projectId === selectedProject);
    if (selectedSchool  !== 'all') result = result.filter(s => s.schoolId  === selectedSchool);
    if (selectedClass   !== 'all') result = result.filter(s => s.classId   === selectedClass);
    return result;
  }, [students, selectedProject, selectedSchool, selectedClass]);

  const sorted = useMemo(() => sortStudents(filtered, sortKey), [filtered, sortKey]);

  useEffect(() => { setVisibleCount(10); }, [sortKey, selectedProject, selectedSchool, selectedClass]);

  // Scope label for stats
  const scopeLabel = selectedClass !== 'all'
    ? (classes.find(c => c.id === selectedClass)?.name ?? 'Class')
    : selectedSchool !== 'all'
    ? (schools.find(s => s.id === selectedSchool)?.name ?? 'School')
    : selectedProject !== 'all'
    ? (projects.find(p => p.id === selectedProject)?.name ?? 'Project')
    : projects.length > 0 ? 'Platform' : schools.length > 0 ? 'School' : 'Class';

  // Summary stats
  const totalXP     = filtered.reduce((s, st) => s + st.xp, 0);
  const totalBadges = filtered.reduce((s, st) => s + st.badges.length, 0);
  const avgLevel    = filtered.length ? Math.round(filtered.reduce((s, st) => s + st.playerLevel, 0) / filtered.length) : 0;
  const onStreak    = filtered.filter(st => st.streakDays >= 3).length;

  // Badge distribution
  const badgeCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    filtered.forEach(st => st.badges.forEach(b => { counts[b] = (counts[b] ?? 0) + 1; }));
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [filtered]);

  const hasFilters = projects.length > 0 || schools.length > 0 || classes.length > 0;
  const isFiltered = selectedProject !== 'all' || selectedSchool !== 'all' || selectedClass !== 'all';

  if (loading) {
    return (
      <div className="space-y-md animate-pulse">
        <div className="h-14 bg-divider rounded-xl" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-sm">
          {[0, 1, 2, 3].map(i => <div key={i} className="h-20 bg-divider rounded-xl" />)}
        </div>
        <div className="h-64 bg-divider rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-lg">
      {/* ── Cascading filters ── */}
      {hasFilters && (
        <div className="bg-white rounded-xl border border-divider p-md flex flex-wrap items-end gap-md">
          <span className="font-baloo text-sm font-semibold text-text-muted self-center">Filter by:</span>

          {projects.length > 0 && (
            <FilterSelect
              label="Project"
              value={selectedProject}
              onChange={handleProjectChange}
              options={projects}
            />
          )}

          {schools.length > 0 && (
            <FilterSelect
              label="School"
              value={selectedSchool}
              onChange={handleSchoolChange}
              options={filteredSchools}
              disabled={filteredSchools.length === 0}
            />
          )}

          {classes.length > 0 && (
            <FilterSelect
              label="Class"
              value={selectedClass}
              onChange={setSelectedClass}
              options={filteredClasses}
              disabled={filteredClasses.length === 0}
            />
          )}

          {isFiltered && (
            <button
              onClick={() => { setSelectedProject('all'); setSelectedSchool('all'); setSelectedClass('all'); }}
              className="font-baloo text-xs text-primary border border-primary/30 rounded-full px-md py-sm hover:bg-lavender-light transition-colors self-end"
            >
              Clear filters
            </button>
          )}

          <span className="font-baloo text-xs text-text-muted self-end ml-auto">
            {filtered.length} / {students.length} students
          </span>
        </div>
      )}

      {filtered.length === 0 ? (
        <Card className="text-center py-xl">
          <p className="text-4xl mb-md">🎮</p>
          <p className="font-baloo font-bold text-lg text-text-dark">No students match this filter</p>
          <p className="font-baloo text-sm text-text-muted mt-xs">Try selecting a different project, school or class.</p>
        </Card>
      ) : (
        <>
          {/* Summary stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-sm">
            <StatCard icon="⚡" value={totalXP.toLocaleString()} label={`${scopeLabel} XP`}        tone="primary" />
            <StatCard icon="🏅" value={totalBadges}              label="Badges Earned"              tone="accent" />
            <StatCard icon="🎮" value={`Lv ${avgLevel}`}         label="Avg Player Level"           tone="secondary" />
            <StatCard icon="🔥" value={onStreak}                 label="On 3+ day streak"           tone="warning" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-lg">
            {/* Leaderboard */}
            <div className="lg:col-span-2">
              <Card>
                <div className="flex flex-wrap items-center justify-between gap-sm mb-lg">
                  <h2 className="font-baloo font-bold text-lg text-text-dark">🏆 {scopeLabel} Leaderboard</h2>
                  <div className="flex flex-wrap gap-xs">
                    {SORT_OPTIONS.map(opt => (
                      <button
                        key={opt.key}
                        onClick={() => setSortKey(opt.key)}
                        className={`px-sm py-xs rounded-full font-baloo text-xs font-semibold border transition-all ${
                          sortKey === opt.key
                            ? 'bg-primary text-white border-primary'
                            : 'bg-white text-text-muted border-divider hover:border-primary/40'
                        }`}
                      >
                        {opt.icon} {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-sm">
                  {sorted.slice(0, visibleCount).map((st, idx) => {
                    const medal = rankMedal(idx + 1);
                    const sortValue =
                      sortKey === 'xp'       ? `${st.xp} XP`
                    : sortKey === 'weeklyXP' ? `${st.weeklyXP} XP this wk`
                    : sortKey === 'streak'   ? `${st.streakDays}🔥`
                    : sortKey === 'badges'   ? `${st.badges.length} badges`
                    :                          `Lv ${st.playerLevel}`;
                    return (
                      <motion.div
                        key={st.id}
                        layout
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.2, delay: idx * 0.03 }}
                        className={`flex items-center gap-md p-sm rounded-xl transition-colors ${
                          idx === 0 ? 'bg-amber-50 border border-amber-200' :
                          idx === 1 ? 'bg-gray-50 border border-gray-200' :
                          idx === 2 ? 'bg-orange-50 border border-orange-100' :
                          'hover:bg-lavender-light/20'
                        }`}
                      >
                        <div className="w-8 flex-shrink-0 text-center">
                          {medal
                            ? <span className="text-xl">{medal}</span>
                            : <span className="font-baloo font-bold text-sm text-text-muted">#{idx + 1}</span>
                          }
                        </div>
                        <AvatarCircle name={st.name} color={st.avatarColor} />
                        <div className="flex-1 min-w-0">
                          <p className="font-baloo font-semibold text-sm text-text-dark truncate">{st.name}</p>
                          <XPBar xp={st.xp} level={st.playerLevel} />
                        </div>
                        <div className="flex-shrink-0 text-right">
                          <p className="font-baloo font-bold text-sm text-primary">{sortValue}</p>
                          {st.badges.slice(-3).map(b => (
                            <span key={b} className="text-sm" title={BADGE_META[b]?.label ?? b}>
                              {BADGE_META[b]?.emoji ?? '🏅'}
                            </span>
                          ))}
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
                {sorted.length > visibleCount && (
                  <button
                    onClick={() => setVisibleCount(c => c + 10)}
                    className="mt-md w-full py-sm rounded-xl font-baloo font-semibold text-sm text-primary border border-primary/30 hover:bg-lavender-light transition-colors"
                  >
                    Show 10 more ({sorted.length - visibleCount} remaining)
                  </button>
                )}
                {visibleCount > 10 && sorted.length <= visibleCount && (
                  <p className="mt-sm text-center font-baloo text-xs text-text-muted">
                    Showing all {sorted.length} students
                  </p>
                )}
              </Card>
            </div>

            {/* Right column */}
            <div className="space-y-lg">
              {/* Badge distribution */}
              <Card>
                <h2 className="font-baloo font-bold text-lg text-text-dark mb-md">🏅 Badges Earned</h2>
                {badgeCounts.length === 0 ? (
                  <p className="font-baloo text-sm text-text-muted text-center py-md">No badges yet</p>
                ) : (
                  <div className="space-y-sm">
                    {badgeCounts.map(([badgeId, count]) => {
                      const meta = BADGE_META[badgeId] ?? { emoji: '🏅', label: badgeId };
                      const pct = filtered.length > 0 ? Math.round((count / filtered.length) * 100) : 0;
                      return (
                        <div key={badgeId}>
                          <div className="flex items-center justify-between mb-[2px]">
                            <span className="font-baloo text-sm text-text-dark">{meta.emoji} {meta.label}</span>
                            <span className="font-baloo text-xs text-text-muted">{count}/{filtered.length} ({pct}%)</span>
                          </div>
                          <div className="h-1.5 bg-divider rounded-full overflow-hidden">
                            <div className="h-full bg-primary rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </Card>

              {/* Top streaks */}
              <Card>
                <h2 className="font-baloo font-bold text-lg text-text-dark mb-md">🔥 Top Streaks</h2>
                <div className="space-y-sm">
                  {[...filtered]
                    .sort((a, b) => b.streakDays - a.streakDays)
                    .slice(0, 5)
                    .map((st, idx) => (
                      <div key={st.id} className="flex items-center gap-sm">
                        <AvatarCircle name={st.name} color={st.avatarColor} />
                        <p className="font-baloo text-sm text-text-dark truncate flex-1">{st.name}</p>
                        <span className={`font-baloo font-bold text-sm flex-shrink-0 ${idx === 0 ? 'text-accent' : 'text-text-muted'}`}>
                          {st.streakDays}🔥
                        </span>
                      </div>
                    ))}
                  {filtered.every(st => st.streakDays === 0) && (
                    <p className="font-baloo text-sm text-text-muted text-center py-sm">No active streaks yet</p>
                  )}
                </div>
              </Card>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
