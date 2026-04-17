import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useAuthStore } from '../../stores/authStore';
import {
  getAnalyticsVisibility,
  setAnalyticsVisibility,
  getProjectOverride,
  setProjectOverride,
  deleteProjectOverride,
  getUserOverride,
  setUserOverride,
  deleteUserOverride,
  DEFAULT_SECTIONS,
  SECTION_LABELS,
  type VisibilityRole,
  type AnalyticsSections,
  type SectionsOverride,
} from '../../services/firebase/analyticsVisibility';

// ── Config ────────────────────────────────────────────────────────────────────

const ROLES: { id: VisibilityRole; label: string; icon: string; desc: string }[] = [
  { id: 'pm', label: 'Program Manager', icon: '📊', desc: 'Project-level analytics and reporting' },
  { id: 'principal', label: 'Principal', icon: '🏫', desc: 'School-wide teacher and student stats' },
  { id: 'projectAdmin', label: 'Project Admin', icon: '🎯', desc: 'Project analytics and word bank stats' },
  { id: 'teacher', label: 'Teacher', icon: '✍️', desc: 'Class student progress' },
];

const ROLE_SECTIONS: Record<VisibilityRole, (keyof AnalyticsSections)[]> = {
  pm: ['overviewStats', 'engagementMetrics', 'gradeDistribution', 'gamification', 'hardestWords'],
  principal: ['overviewStats', 'teacherTable', 'atRiskStudents', 'gradeDistribution', 'gamification'],
  projectAdmin: ['overviewStats', 'engagementMetrics', 'gradeDistribution', 'hardestWords'],
  teacher: ['studentTable', 'assignmentMetrics', 'gamification', 'atRiskStudents'],
};

const ALL_SECTIONS = Object.keys(SECTION_LABELS) as (keyof AnalyticsSections)[];

const MANAGEMENT_ROLES = ['pm', 'principal', 'projectAdmin', 'teacher'];

// ── Shared components ─────────────────────────────────────────────────────────

function Toggle({ value, onChange, inherited }: { value: boolean; onChange: (v: boolean) => void; inherited?: boolean }) {
  return (
    <button
      onClick={() => onChange(!value)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
        value ? (inherited ? 'bg-primary/50' : 'bg-primary') : (inherited ? 'bg-gray-200' : 'bg-gray-300')
      }`}
      title={inherited ? 'Inherited from role default' : undefined}
    >
      <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${value ? 'translate-x-6' : 'translate-x-1'}`} />
    </button>
  );
}

function SaveBanner({ saving, savedLabel }: { saving: boolean; savedLabel: string | null }) {
  return (
    <AnimatePresence>
      {(saving || savedLabel) && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          className={`rounded-xl px-lg py-sm font-baloo text-sm font-semibold text-white ${savedLabel ? 'bg-success' : 'bg-primary'}`}
        >
          {savedLabel ? `✓ Saved for ${savedLabel}` : 'Saving…'}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ── Roles Tab ─────────────────────────────────────────────────────────────────

function RolesTab() {
  const { user } = useAuthStore();
  const [roleData, setRoleData] = useState<Record<VisibilityRole, AnalyticsSections>>({
    pm: { ...DEFAULT_SECTIONS }, principal: { ...DEFAULT_SECTIONS },
    projectAdmin: { ...DEFAULT_SECTIONS }, teacher: { ...DEFAULT_SECTIONS },
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedLabel, setSavedLabel] = useState<string | null>(null);
  const [openRole, setOpenRole] = useState<VisibilityRole | null>('pm');

  useEffect(() => {
    Promise.all(ROLES.map(r => getAnalyticsVisibility(r.id))).then(([pm, principal, projectAdmin, teacher]) => {
      setRoleData({ pm, principal, projectAdmin, teacher });
      setLoading(false);
    });
  }, []);

  const handleChange = async (role: VisibilityRole, key: keyof AnalyticsSections, value: boolean) => {
    if (!user) return;
    const updated = { ...roleData[role], [key]: value };
    setRoleData(prev => ({ ...prev, [role]: updated }));
    setSaving(true);
    try {
      await setAnalyticsVisibility(role, updated, user.uid);
      const label = ROLES.find(r => r.id === role)?.label ?? role;
      setSavedLabel(label);
      setTimeout(() => setSavedLabel(null), 1500);
    } catch { }
    setSaving(false);
  };

  if (loading) return <div className="flex justify-center py-xxl"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" /></div>;

  return (
    <div className="space-y-md">
      <SaveBanner saving={saving} savedLabel={savedLabel} />
      {ROLES.map(role => {
        const sections = roleData[role.id];
        const relevantSections = ROLE_SECTIONS[role.id];
        const disabledCount = relevantSections.filter(k => !sections[k]).length;
        const isOpen = openRole === role.id;
        return (
          <div key={role.id} className="bg-white rounded-2xl border border-divider overflow-hidden shadow-sm">
            <button onClick={() => setOpenRole(isOpen ? null : role.id)}
              className="w-full flex items-center justify-between px-lg py-md hover:bg-gray-50 transition-colors">
              <div className="flex items-center gap-sm">
                <span className="text-2xl">{role.icon}</span>
                <div className="text-left">
                  <p className="font-baloo font-bold text-text-dark">{role.label}</p>
                  <p className="font-baloo text-xs text-text-muted">{role.desc}</p>
                </div>
              </div>
              <div className="flex items-center gap-sm">
                {disabledCount > 0
                  ? <span className="font-baloo text-xs font-semibold bg-amber-50 text-amber-600 px-xs py-0.5 rounded-full">{disabledCount} hidden</span>
                  : <span className="font-baloo text-xs font-semibold bg-success/10 text-success px-xs py-0.5 rounded-full">all visible</span>}
                <span className="text-text-muted text-sm">{isOpen ? '▲' : '▼'}</span>
              </div>
            </button>
            <AnimatePresence>
              {isOpen && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
                  <div className="border-t border-divider divide-y divide-divider">
                    {relevantSections.map(key => (
                      <div key={key} className="flex items-center justify-between px-lg py-sm">
                        <span className="font-baloo text-sm text-text-dark">{SECTION_LABELS[key]}</span>
                        <Toggle value={sections[key]} onChange={v => handleChange(role.id, key, v)} />
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}

// ── Projects Tab ──────────────────────────────────────────────────────────────

interface ProjectItem { id: string; name: string; }

function ProjectsTab() {
  const { user } = useAuthStore();
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [selectedProject, setSelectedProject] = useState<ProjectItem | null>(null);
  const [override, setOverride] = useState<SectionsOverride | null>(null);
  const [loadingOverride, setLoadingOverride] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedLabel, setSavedLabel] = useState<string | null>(null);

  useEffect(() => {
    getDocs(collection(db, 'projects')).then(snap => {
      setProjects(snap.docs.map(d => ({ id: d.id, name: (d.data() as any).name ?? d.id })));
      setLoadingProjects(false);
    });
  }, []);

  const selectProject = async (project: ProjectItem) => {
    setSelectedProject(project);
    setLoadingOverride(true);
    const o = await getProjectOverride(project.id);
    setOverride(o);
    setLoadingOverride(false);
  };

  const handleToggle = async (key: keyof AnalyticsSections, value: boolean) => {
    if (!user || !selectedProject) return;
    const updated: SectionsOverride = { ...(override ?? {}), [key]: value };
    setOverride(updated);
    setSaving(true);
    try {
      await setProjectOverride(selectedProject.id, updated, user.uid);
      setSavedLabel(selectedProject.name);
      setTimeout(() => setSavedLabel(null), 1500);
    } catch { }
    setSaving(false);
  };

  const handleReset = async () => {
    if (!selectedProject) return;
    await deleteProjectOverride(selectedProject.id);
    setOverride(null);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-lg">
      {/* Project list */}
      <div className="bg-white rounded-2xl border border-divider overflow-hidden shadow-sm">
        <div className="px-md py-sm border-b border-divider">
          <p className="font-baloo font-bold text-sm text-text-dark">Projects</p>
        </div>
        <div className="overflow-y-auto max-h-96">
          {loadingProjects
            ? <div className="flex justify-center py-lg"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" /></div>
            : projects.length === 0
              ? <p className="font-baloo text-sm text-text-muted text-center py-lg">No projects found</p>
              : projects.map(p => (
                <button key={p.id} onClick={() => selectProject(p)}
                  className={`w-full text-left px-md py-sm border-b border-divider last:border-0 font-baloo text-sm transition-colors ${selectedProject?.id === p.id ? 'bg-lavender-light/40 text-primary font-semibold' : 'text-text-dark hover:bg-gray-50'}`}>
                  <p className="truncate">{p.name}</p>
                  <p className="text-xs text-text-muted truncate">{p.id}</p>
                </button>
              ))}
        </div>
      </div>

      {/* Override editor */}
      <div className="lg:col-span-2">
        <SaveBanner saving={saving} savedLabel={savedLabel} />
        {!selectedProject
          ? <div className="bg-white rounded-2xl border border-divider p-xl text-center"><p className="font-baloo text-text-muted">Select a project to configure overrides</p></div>
          : loadingOverride
            ? <div className="flex justify-center py-xl"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>
            : (
              <div className="bg-white rounded-2xl border border-divider overflow-hidden shadow-sm">
                <div className="px-lg py-md border-b border-divider flex items-center justify-between">
                  <div>
                    <p className="font-baloo font-bold text-text-dark">{selectedProject.name}</p>
                    <p className="font-baloo text-xs text-text-muted">
                      {override ? 'Custom overrides active — override role defaults for all users in this project' : 'No overrides — inheriting role defaults'}
                    </p>
                  </div>
                  {override && (
                    <button onClick={handleReset} className="font-baloo text-xs text-error hover:underline">Reset to role defaults</button>
                  )}
                </div>
                <div className="divide-y divide-divider">
                  {ALL_SECTIONS.map(key => {
                    const inherited = override === null || !(key in override);
                    const value = inherited ? DEFAULT_SECTIONS[key] : (override[key] ?? DEFAULT_SECTIONS[key]);
                    return (
                      <div key={key} className="flex items-center justify-between px-lg py-sm">
                        <div>
                          <span className="font-baloo text-sm text-text-dark">{SECTION_LABELS[key]}</span>
                          {inherited && <span className="ml-sm font-baloo text-xs text-text-muted italic">inherited</span>}
                        </div>
                        <Toggle value={value} onChange={v => handleToggle(key, v)} inherited={inherited} />
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
      </div>
    </div>
  );
}

// ── Users Tab ─────────────────────────────────────────────────────────────────

interface UserItem { id: string; name: string; email: string; role: string; }

function UsersTab() {
  const { user } = useAuthStore();
  const [users, setUsers] = useState<UserItem[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedUser, setSelectedUser] = useState<UserItem | null>(null);
  const [override, setOverride] = useState<SectionsOverride | null>(null);
  const [loadingOverride, setLoadingOverride] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedLabel, setSavedLabel] = useState<string | null>(null);

  useEffect(() => {
    getDocs(collection(db, 'users')).then(snap => {
      const all = snap.docs.map(d => {
        const data = d.data() as any;
        return { id: d.id, name: data.name ?? data.displayName ?? '—', email: data.email ?? '—', role: data.role ?? '—' };
      }).filter(u => MANAGEMENT_ROLES.includes(u.role));
      setUsers(all);
      setLoadingUsers(false);
    });
  }, []);

  const filtered = users.filter(u =>
    !search || u.name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase())
  );

  const selectUser = async (u: UserItem) => {
    setSelectedUser(u);
    setLoadingOverride(true);
    const o = await getUserOverride(u.id);
    setOverride(o);
    setLoadingOverride(false);
  };

  const handleToggle = async (key: keyof AnalyticsSections, value: boolean) => {
    if (!user || !selectedUser) return;
    const updated: SectionsOverride = { ...(override ?? {}), [key]: value };
    setOverride(updated);
    setSaving(true);
    try {
      await setUserOverride(selectedUser.id, updated, user.uid);
      setSavedLabel(selectedUser.name);
      setTimeout(() => setSavedLabel(null), 1500);
    } catch { }
    setSaving(false);
  };

  const handleReset = async () => {
    if (!selectedUser) return;
    await deleteUserOverride(selectedUser.id);
    setOverride(null);
  };

  const ROLE_BADGE: Record<string, string> = {
    pm: 'bg-blue-50 text-blue-600',
    principal: 'bg-purple-50 text-purple-600',
    projectAdmin: 'bg-orange-50 text-orange-600',
    teacher: 'bg-green-50 text-green-600',
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-lg">
      {/* User list */}
      <div className="bg-white rounded-2xl border border-divider overflow-hidden shadow-sm">
        <div className="px-md py-sm border-b border-divider">
          <input
            className="w-full font-baloo text-sm bg-gray-50 border border-divider rounded-xl px-sm py-xs focus:outline-none focus:border-primary"
            placeholder="Search users…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="overflow-y-auto max-h-[420px]">
          {loadingUsers
            ? <div className="flex justify-center py-lg"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" /></div>
            : filtered.length === 0
              ? <p className="font-baloo text-sm text-text-muted text-center py-lg">No users found</p>
              : filtered.map(u => (
                <button key={u.id} onClick={() => selectUser(u)}
                  className={`w-full text-left px-md py-sm border-b border-divider last:border-0 transition-colors ${selectedUser?.id === u.id ? 'bg-lavender-light/40' : 'hover:bg-gray-50'}`}>
                  <div className="flex items-center justify-between gap-xs">
                    <p className="font-baloo text-sm font-semibold text-text-dark truncate">{u.name}</p>
                    <span className={`font-baloo text-xs px-xs py-0.5 rounded-full shrink-0 ${ROLE_BADGE[u.role] ?? 'bg-gray-100 text-text-muted'}`}>{u.role}</span>
                  </div>
                  <p className="font-baloo text-xs text-text-muted truncate">{u.email}</p>
                </button>
              ))}
        </div>
      </div>

      {/* Override editor */}
      <div className="lg:col-span-2">
        <SaveBanner saving={saving} savedLabel={savedLabel} />
        {!selectedUser
          ? <div className="bg-white rounded-2xl border border-divider p-xl text-center"><p className="font-baloo text-text-muted">Select a user to configure overrides</p></div>
          : loadingOverride
            ? <div className="flex justify-center py-xl"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>
            : (
              <div className="bg-white rounded-2xl border border-divider overflow-hidden shadow-sm">
                <div className="px-lg py-md border-b border-divider flex items-center justify-between">
                  <div>
                    <p className="font-baloo font-bold text-text-dark">{selectedUser.name}</p>
                    <p className="font-baloo text-xs text-text-muted">
                      {selectedUser.email} · {selectedUser.role}
                      {override ? ' · Custom overrides active' : ' · Inheriting role & project defaults'}
                    </p>
                  </div>
                  {override && (
                    <button onClick={handleReset} className="font-baloo text-xs text-error hover:underline">Reset to defaults</button>
                  )}
                </div>
                <div className="divide-y divide-divider">
                  {ALL_SECTIONS.map(key => {
                    const inherited = override === null || !(key in override);
                    const value = inherited ? DEFAULT_SECTIONS[key] : (override[key] ?? DEFAULT_SECTIONS[key]);
                    return (
                      <div key={key} className="flex items-center justify-between px-lg py-sm">
                        <div>
                          <span className="font-baloo text-sm text-text-dark">{SECTION_LABELS[key]}</span>
                          {inherited && <span className="ml-sm font-baloo text-xs text-text-muted italic">inherited</span>}
                        </div>
                        <Toggle value={value} onChange={v => handleToggle(key, v)} inherited={inherited} />
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

type PageTab = 'roles' | 'projects' | 'users';

export default function AnalyticsVisibilityPage() {
  const [tab, setTab] = useState<PageTab>('roles');

  const TABS: { id: PageTab; label: string; icon: string }[] = [
    { id: 'roles', label: 'By Role', icon: '👤' },
    { id: 'projects', label: 'By Project', icon: '🎯' },
    { id: 'users', label: 'By User', icon: '🙋' },
  ];

  return (
    <div className="space-y-lg max-w-5xl">
      <div>
        <h1 className="font-baloo font-extrabold text-xxl text-text-dark">Analytics Controls</h1>
        <p className="font-baloo text-text-muted">
          Control which analytics sections are visible — by role, project, or individual user.
          More specific settings override broader ones: <span className="font-semibold">user &gt; project &gt; role</span>.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-sm border-b border-divider">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`font-baloo font-semibold text-sm px-md pb-sm border-b-2 transition-colors ${tab === t.id ? 'border-primary text-primary' : 'border-transparent text-text-muted hover:text-text-dark'}`}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {tab === 'roles' && <RolesTab />}
      {tab === 'projects' && <ProjectsTab />}
      {tab === 'users' && <UsersTab />}

      <div className="bg-lavender-light/30 rounded-xl p-md font-baloo text-sm text-primary border border-primary/20">
        <span className="font-semibold">Live updates:</span> Changes take effect immediately via Firestore real-time listeners — users don't need to refresh.
      </div>
    </div>
  );
}
