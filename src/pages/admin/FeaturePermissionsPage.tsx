import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useAuthStore } from '../../stores/authStore';
import {
  getRolePermissions,
  setRolePermissions,
  getProjectPermissionsOverride,
  setProjectPermissionsOverride,
  deleteProjectPermissionsOverride,
  getUserPermissionsOverride,
  setUserPermissionsOverride,
  deleteUserPermissionsOverride,
} from '../../services/firebase/featurePermissions';
import {
  DEFAULT_PERMISSIONS,
  PERMISSION_AREA_LABELS,
  PERMISSION_ACTION_LABELS,
  ALL_PERMISSION_KEYS,
  groupPermissionKeys,
  parsePermissionKey,
  type PermissionKey,
  type PermissionsMap,
  type PermissionsOverride,
} from '../../types/permissions';
import type { UserRole } from '../../types/claims';

// ── Config ────────────────────────────────────────────────────────────────────

const EDITABLE_ROLES: { id: UserRole; label: string; icon: string; desc: string; locked?: boolean }[] = [
  { id: 'admin', label: 'Admin', icon: '👑', desc: 'Super admin — all permissions always on', locked: true },
  { id: 'projectAdmin', label: 'Project Admin', icon: '🎯', desc: 'Manages a single project, schools, and teachers' },
  { id: 'teacher', label: 'Teacher', icon: '✍️', desc: 'Class management, assignments, and curriculum editing' },
  { id: 'contentReviewer', label: 'Content Reviewer', icon: '🔍', desc: 'Reviews and approves word submissions' },
  { id: 'contentWriter', label: 'Content Writer', icon: '✏️', desc: 'Submits words via /writer — no feature gates needed', locked: true },
  { id: 'pm', label: 'Program Manager', icon: '📊', desc: 'Analytics-only role — no action permissions', locked: true },
  { id: 'principal', label: 'Principal', icon: '🏫', desc: 'Analytics-only role — no action permissions', locked: true },
];

const MANAGEMENT_ROLES: UserRole[] = ['admin', 'projectAdmin', 'teacher', 'contentReviewer', 'contentWriter', 'pm', 'principal'];

const GROUPED_KEYS = groupPermissionKeys(ALL_PERMISSION_KEYS);

// ── Shared components ─────────────────────────────────────────────────────────

function Toggle({
  value,
  onChange,
  inherited,
  disabled,
}: {
  value: boolean;
  onChange: (v: boolean) => void;
  inherited?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={() => !disabled && onChange(!value)}
      disabled={disabled}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
        disabled
          ? 'opacity-40 cursor-not-allowed'
          : 'cursor-pointer'
      } ${
        value
          ? inherited ? 'bg-primary/50' : 'bg-primary'
          : inherited ? 'bg-gray-200' : 'bg-gray-300'
      }`}
      title={disabled ? 'This role is locked' : inherited ? 'Inherited from role default' : undefined}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
          value ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
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
          className={`rounded-xl px-lg py-sm font-baloo text-sm font-semibold text-white mb-md ${
            savedLabel ? 'bg-success' : 'bg-primary'
          }`}
        >
          {savedLabel ? `✓ Saved for ${savedLabel}` : 'Saving…'}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function AreaSection({
  area,
  keys,
  permissions,
  overrides,
  onToggle,
  disabled,
}: {
  area: string;
  keys: PermissionKey[];
  permissions: PermissionsMap;
  overrides?: PermissionsOverride | null;
  onToggle: (key: PermissionKey, value: boolean) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(true);
  const activeCount = keys.filter(k => permissions[k]).length;

  return (
    <div className="border border-divider rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-md py-sm bg-gray-50 hover:bg-gray-100 transition-colors"
      >
        <span className="font-baloo font-bold text-sm text-text-dark">
          {PERMISSION_AREA_LABELS[area] ?? area}
        </span>
        <div className="flex items-center gap-sm">
          <span className={`font-baloo text-xs font-semibold px-xs py-0.5 rounded-full ${
            activeCount === keys.length
              ? 'bg-success/10 text-success'
              : activeCount === 0
              ? 'bg-gray-100 text-text-muted'
              : 'bg-amber-50 text-amber-600'
          }`}>
            {activeCount}/{keys.length}
          </span>
          <span className="text-text-muted text-xs">{open ? '▲' : '▼'}</span>
        </div>
      </button>
      {open && (
        <div className="divide-y divide-divider">
          {keys.map(key => {
            const { action } = parsePermissionKey(key);
            const inherited = overrides !== undefined && overrides !== null && !(key in overrides);
            return (
              <div key={key} className="flex items-center justify-between px-md py-sm">
                <div>
                  <span className="font-baloo text-sm text-text-dark">
                    {PERMISSION_ACTION_LABELS[action] ?? action}
                  </span>
                  {inherited && (
                    <span className="ml-sm font-baloo text-xs text-text-muted italic">inherited</span>
                  )}
                </div>
                <Toggle
                  value={permissions[key]}
                  onChange={v => onToggle(key, v)}
                  inherited={inherited}
                  disabled={disabled}
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Roles Tab ─────────────────────────────────────────────────────────────────

function RolesTab() {
  const { user } = useAuthStore();
  const [roleData, setRoleData] = useState<Partial<Record<UserRole, PermissionsMap>>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedLabel, setSavedLabel] = useState<string | null>(null);
  const [openRole, setOpenRole] = useState<UserRole | null>('projectAdmin');

  useEffect(() => {
    const editableIds = EDITABLE_ROLES.map(r => r.id);
    Promise.all(editableIds.map(id => getRolePermissions(id))).then(results => {
      const map: Partial<Record<UserRole, PermissionsMap>> = {};
      editableIds.forEach((id, i) => { map[id] = results[i]; });
      setRoleData(map);
      setLoading(false);
    });
  }, []);

  const handleChange = async (role: UserRole, key: PermissionKey, value: boolean) => {
    if (!user) return;
    const current = roleData[role] ?? { ...DEFAULT_PERMISSIONS[role] };
    const updated = { ...current, [key]: value };
    setRoleData(prev => ({ ...prev, [role]: updated }));
    setSaving(true);
    try {
      await setRolePermissions(role, updated, user.uid);
      const label = EDITABLE_ROLES.find(r => r.id === role)?.label ?? role;
      setSavedLabel(label);
      setTimeout(() => setSavedLabel(null), 1500);
    } catch { }
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="flex justify-center py-xxl">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-md">
      <SaveBanner saving={saving} savedLabel={savedLabel} />
      {EDITABLE_ROLES.map(role => {
        const perms = roleData[role.id] ?? DEFAULT_PERMISSIONS[role.id];
        const isOpen = openRole === role.id;
        const relevantKeys = ALL_PERMISSION_KEYS.filter(() => true);
        const enabledCount = relevantKeys.filter(k => perms[k]).length;

        return (
          <div key={role.id} className="bg-white rounded-2xl border border-divider overflow-hidden shadow-sm">
            <button
              onClick={() => setOpenRole(isOpen ? null : role.id)}
              className="w-full flex items-center justify-between px-lg py-md hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-sm">
                <span className="text-2xl">{role.icon}</span>
                <div className="text-left">
                  <div className="flex items-center gap-xs">
                    <p className="font-baloo font-bold text-text-dark">{role.label}</p>
                    {role.locked && (
                      <span className="font-baloo text-xs bg-gray-100 text-text-muted px-xs py-0.5 rounded-full">
                        locked
                      </span>
                    )}
                  </div>
                  <p className="font-baloo text-xs text-text-muted">{role.desc}</p>
                </div>
              </div>
              <div className="flex items-center gap-sm">
                <span className={`font-baloo text-xs font-semibold px-xs py-0.5 rounded-full ${
                  enabledCount === ALL_PERMISSION_KEYS.length
                    ? 'bg-success/10 text-success'
                    : enabledCount === 0
                    ? 'bg-gray-100 text-text-muted'
                    : 'bg-lavender-light text-primary'
                }`}>
                  {enabledCount} / {ALL_PERMISSION_KEYS.length} enabled
                </span>
                <span className="text-text-muted text-sm">{isOpen ? '▲' : '▼'}</span>
              </div>
            </button>

            <AnimatePresence>
              {isOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="border-t border-divider p-md space-y-sm">
                    {Object.entries(GROUPED_KEYS).map(([area, keys]) => (
                      <AreaSection
                        key={area}
                        area={area}
                        keys={keys as PermissionKey[]}
                        permissions={perms}
                        onToggle={(key, value) => handleChange(role.id, key, value)}
                        disabled={role.locked}
                      />
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
  const [override, setOverride] = useState<PermissionsOverride | null>(null);
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
    const o = await getProjectPermissionsOverride(project.id);
    setOverride(o);
    setLoadingOverride(false);
  };

  const handleToggle = async (key: PermissionKey, value: boolean) => {
    if (!user || !selectedProject) return;
    const updated: PermissionsOverride = { ...(override ?? {}), [key]: value };
    setOverride(updated);
    setSaving(true);
    try {
      await setProjectPermissionsOverride(selectedProject.id, updated, user.uid);
      setSavedLabel(selectedProject.name);
      setTimeout(() => setSavedLabel(null), 1500);
    } catch { }
    setSaving(false);
  };

  const handleReset = async () => {
    if (!selectedProject) return;
    await deleteProjectPermissionsOverride(selectedProject.id);
    setOverride(null);
  };

  // Build a merged view: projectAdmin defaults merged with override
  const mergedPermissions: PermissionsMap = (() => {
    const base = { ...DEFAULT_PERMISSIONS['projectAdmin'] };
    if (override) {
      for (const [k, v] of Object.entries(override)) {
        (base as any)[k] = v;
      }
    }
    return base;
  })();

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-lg">
      {/* Project list */}
      <div className="bg-white rounded-2xl border border-divider overflow-hidden shadow-sm">
        <div className="px-md py-sm border-b border-divider">
          <p className="font-baloo font-bold text-sm text-text-dark">Projects</p>
          <p className="font-baloo text-xs text-text-muted">
            Overrides apply to projectAdmin users in that project
          </p>
        </div>
        <div className="overflow-y-auto max-h-96">
          {loadingProjects ? (
            <div className="flex justify-center py-lg">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
            </div>
          ) : projects.length === 0 ? (
            <p className="font-baloo text-sm text-text-muted text-center py-lg">No projects found</p>
          ) : (
            projects.map(p => (
              <button
                key={p.id}
                onClick={() => selectProject(p)}
                className={`w-full text-left px-md py-sm border-b border-divider last:border-0 font-baloo text-sm transition-colors ${
                  selectedProject?.id === p.id
                    ? 'bg-lavender-light/40 text-primary font-semibold'
                    : 'text-text-dark hover:bg-gray-50'
                }`}
              >
                <p className="truncate">{p.name}</p>
                <p className="text-xs text-text-muted truncate">{p.id}</p>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Override editor */}
      <div className="lg:col-span-2">
        <SaveBanner saving={saving} savedLabel={savedLabel} />
        {!selectedProject ? (
          <div className="bg-white rounded-2xl border border-divider p-xl text-center">
            <p className="font-baloo text-text-muted">Select a project to configure overrides</p>
          </div>
        ) : loadingOverride ? (
          <div className="flex justify-center py-xl">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-divider overflow-hidden shadow-sm">
            <div className="px-lg py-md border-b border-divider flex items-center justify-between">
              <div>
                <p className="font-baloo font-bold text-text-dark">{selectedProject.name}</p>
                <p className="font-baloo text-xs text-text-muted">
                  {override
                    ? 'Custom overrides active — overrides projectAdmin role defaults for this project'
                    : 'No overrides — inheriting projectAdmin role defaults'}
                </p>
              </div>
              {override && (
                <button
                  onClick={handleReset}
                  className="font-baloo text-xs text-error hover:underline"
                >
                  Reset to role defaults
                </button>
              )}
            </div>
            <div className="p-md space-y-sm">
              {Object.entries(GROUPED_KEYS).map(([area, keys]) => (
                <AreaSection
                  key={area}
                  area={area}
                  keys={keys as PermissionKey[]}
                  permissions={mergedPermissions}
                  overrides={override}
                  onToggle={handleToggle}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Users Tab ─────────────────────────────────────────────────────────────────

interface UserItem { id: string; name: string; email: string; role: UserRole; }

function UsersTab() {
  const { user } = useAuthStore();
  const [users, setUsers] = useState<UserItem[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedUser, setSelectedUser] = useState<UserItem | null>(null);
  const [override, setOverride] = useState<PermissionsOverride | null>(null);
  const [loadingOverride, setLoadingOverride] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedLabel, setSavedLabel] = useState<string | null>(null);

  useEffect(() => {
    getDocs(collection(db, 'users')).then(snap => {
      const all = snap.docs.map(d => {
        const data = d.data() as any;
        return {
          id: d.id,
          name: data.name ?? data.displayName ?? '—',
          email: data.email ?? '—',
          role: (data.role ?? 'teacher') as UserRole,
        };
      }).filter(u => MANAGEMENT_ROLES.includes(u.role) && u.role !== 'pm' && u.role !== 'principal');
      setUsers(all);
      setLoadingUsers(false);
    });
  }, []);

  const filtered = users.filter(u =>
    !search ||
    u.name.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase())
  );

  const selectUser = async (u: UserItem) => {
    setSelectedUser(u);
    setLoadingOverride(true);
    const o = await getUserPermissionsOverride(u.id);
    setOverride(o);
    setLoadingOverride(false);
  };

  const handleToggle = async (key: PermissionKey, value: boolean) => {
    if (!user || !selectedUser) return;
    const updated: PermissionsOverride = { ...(override ?? {}), [key]: value };
    setOverride(updated);
    setSaving(true);
    try {
      await setUserPermissionsOverride(selectedUser.id, updated, user.uid);
      setSavedLabel(selectedUser.name);
      setTimeout(() => setSavedLabel(null), 1500);
    } catch { }
    setSaving(false);
  };

  const handleReset = async () => {
    if (!selectedUser) return;
    await deleteUserPermissionsOverride(selectedUser.id);
    setOverride(null);
  };

  // Merge: role defaults + override
  const mergedPermissions: PermissionsMap = (() => {
    if (!selectedUser) return { ...DEFAULT_PERMISSIONS['teacher'] };
    const base = { ...DEFAULT_PERMISSIONS[selectedUser.role] };
    if (override) {
      for (const [k, v] of Object.entries(override)) {
        (base as any)[k] = v;
      }
    }
    return base;
  })();

  const ROLE_BADGE: Record<string, string> = {
    admin: 'bg-primary/10 text-primary',
    projectAdmin: 'bg-orange-50 text-orange-600',
    teacher: 'bg-green-50 text-green-600',
    contentReviewer: 'bg-purple-50 text-purple-600',
    contentWriter: 'bg-blue-50 text-blue-600',
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
          {loadingUsers ? (
            <div className="flex justify-center py-lg">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
            </div>
          ) : filtered.length === 0 ? (
            <p className="font-baloo text-sm text-text-muted text-center py-lg">No users found</p>
          ) : (
            filtered.map(u => (
              <button
                key={u.id}
                onClick={() => selectUser(u)}
                className={`w-full text-left px-md py-sm border-b border-divider last:border-0 transition-colors ${
                  selectedUser?.id === u.id ? 'bg-lavender-light/40' : 'hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center justify-between gap-xs">
                  <p className="font-baloo text-sm font-semibold text-text-dark truncate">{u.name}</p>
                  <span className={`font-baloo text-xs px-xs py-0.5 rounded-full shrink-0 ${ROLE_BADGE[u.role] ?? 'bg-gray-100 text-text-muted'}`}>
                    {u.role}
                  </span>
                </div>
                <p className="font-baloo text-xs text-text-muted truncate">{u.email}</p>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Override editor */}
      <div className="lg:col-span-2">
        <SaveBanner saving={saving} savedLabel={savedLabel} />
        {!selectedUser ? (
          <div className="bg-white rounded-2xl border border-divider p-xl text-center">
            <p className="font-baloo text-text-muted">Select a user to configure overrides</p>
          </div>
        ) : loadingOverride ? (
          <div className="flex justify-center py-xl">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : (
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
                <button
                  onClick={handleReset}
                  className="font-baloo text-xs text-error hover:underline"
                >
                  Reset to defaults
                </button>
              )}
            </div>
            <div className="p-md space-y-sm">
              {Object.entries(GROUPED_KEYS).map(([area, keys]) => (
                <AreaSection
                  key={area}
                  area={area}
                  keys={keys as PermissionKey[]}
                  permissions={mergedPermissions}
                  overrides={override}
                  onToggle={handleToggle}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

type PageTab = 'roles' | 'projects' | 'users';

export default function FeaturePermissionsPage() {
  const [tab, setTab] = useState<PageTab>('roles');

  const TABS: { id: PageTab; label: string; icon: string }[] = [
    { id: 'roles', label: 'By Role', icon: '👤' },
    { id: 'projects', label: 'By Project', icon: '🎯' },
    { id: 'users', label: 'By User', icon: '🙋' },
  ];

  return (
    <div className="space-y-lg max-w-5xl">
      <div>
        <h1 className="font-baloo font-extrabold text-xxl text-text-dark">Feature Permissions 🔐</h1>
        <p className="font-baloo text-text-muted">
          Control which action buttons are visible — by role, project, or individual user.
          More specific settings override broader ones:{' '}
          <span className="font-semibold">user &gt; project &gt; role</span>.
          Unauthorized buttons are hidden entirely (not disabled).
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-sm border-b border-divider">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`font-baloo font-semibold text-sm px-md pb-sm border-b-2 transition-colors ${
              tab === t.id
                ? 'border-primary text-primary'
                : 'border-transparent text-text-muted hover:text-text-dark'
            }`}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {tab === 'roles' && <RolesTab />}
      {tab === 'projects' && <ProjectsTab />}
      {tab === 'users' && <UsersTab />}
    </div>
  );
}
