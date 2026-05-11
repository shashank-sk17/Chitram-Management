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
  type PermissionKey,
  type PermissionsMap,
  type PermissionsOverride,
} from '../../types/permissions';
import type { UserRole } from '../../types/claims';

// ── Feature definitions ───────────────────────────────────────────────────────

type PlanTier = 'basic' | 'pro' | 'enterprise';

interface FeatureFlag {
  id: string;
  label: string;
  desc: string;
  icon: string;
  keys: PermissionKey[];
  tier: PlanTier;
  area: string;
}

const FEATURES: FeatureFlag[] = [
  // Word Bank
  { id: 'editWords',     label: 'Edit Words',              desc: 'Modify word content, translations, and pronunciations', icon: '🖊️', keys: ['wordBank.edit'],                              tier: 'pro',        area: 'Word Bank' },
  { id: 'createWords',   label: 'Create Words',            desc: 'Submit new words for admin review',                     icon: '➕', keys: ['wordBank.create'],                            tier: 'pro',        area: 'Word Bank' },
  { id: 'approveWords',  label: 'Approve / Reject Words',  desc: 'Review and publish word submissions from writers',      icon: '✅', keys: ['wordBank.approve', 'wordBank.reject'],       tier: 'enterprise', area: 'Word Bank' },
  { id: 'deleteWords',   label: 'Delete Words',            desc: 'Permanently remove words from the word bank',           icon: '🗑️', keys: ['wordBank.delete'],                            tier: 'enterprise', area: 'Word Bank' },
  // Curriculum
  { id: 'editCurriculum',     label: 'Edit Language Curricula',    desc: 'Modify grade-level curricula and word assignments',          icon: '📚', keys: ['curricula.edit'],                                             tier: 'pro',        area: 'Curriculum' },
  { id: 'curriculumEditor',   label: 'Teacher Curriculum Editor',  desc: 'Teachers can customise the curriculum for their class',      icon: '✏️', keys: ['curriculumEditor.edit'],                                       tier: 'pro',        area: 'Curriculum' },
  { id: 'curriculumReviews',  label: 'Curriculum Review Workflow', desc: 'Approve or reject teacher curriculum customisations',        icon: '🔍', keys: ['curriculumReviews.approve', 'curriculumReviews.reject'],     tier: 'pro',        area: 'Curriculum' },
  // Team management
  { id: 'inviteUsers',  label: 'Invite Team Members', desc: 'Add new admin users and teachers to the project', icon: '👥', keys: ['users.invite'],    tier: 'basic',      area: 'Team' },
  { id: 'changeRoles',  label: 'Change User Roles',   desc: 'Modify roles for existing users',                  icon: '👑', keys: ['users.editRole'], tier: 'enterprise', area: 'Team' },
  // License & Commerce
  { id: 'licenseKeys', label: 'License Keys',    desc: 'Generate and revoke student access keys',         icon: '🔑', keys: ['licenseKeys.generate', 'licenseKeys.revoke'], tier: 'pro',        area: 'License & Commerce' },
  { id: 'discounts',   label: 'Discount Codes',  desc: 'Create discount codes for subscriptions',         icon: '🏷️', keys: ['discounts.create'],                          tier: 'enterprise', area: 'License & Commerce' },
  // Branding
  { id: 'brandProfiles', label: 'Custom Branding',   desc: 'Create and apply brand profiles (colours, logos, fonts)', icon: '🎨', keys: ['brandProfiles.create', 'brandProfiles.edit'], tier: 'enterprise', area: 'Branding' },
  // Schools & Classroom
  { id: 'manageSchools',      label: 'Manage Schools',     desc: 'Create and edit schools within the project',               icon: '🏫', keys: ['schools.create', 'schools.edit'],             tier: 'basic', area: 'Schools & Classroom' },
  { id: 'createAssignments',  label: 'Assignments',        desc: 'Teachers can create and publish class assignments',         icon: '📋', keys: ['assignments.create', 'assignments.publish'],  tier: 'basic', area: 'Schools & Classroom' },
  { id: 'announcements',      label: 'Announcements',      desc: 'Teachers can post announcements to their class',            icon: '📢', keys: ['announcements.create', 'announcements.delete'], tier: 'basic', area: 'Schools & Classroom' },
];

const FEATURE_AREAS = [...new Set(FEATURES.map(f => f.area))];

const PLAN_TIERS: { id: PlanTier; label: string; desc: string; bg: string; text: string; border: string }[] = [
  { id: 'basic',      label: 'Basic',        desc: 'Schools & team basics',         bg: '#F5F5F5',   text: '#616161',  border: '#E0E0E0' },
  { id: 'pro',        label: 'Professional', desc: '+ Word editing & curricula',    bg: '#EDEEFF',   text: '#5C5FD6',  border: '#7C81FF' },
  { id: 'enterprise', label: 'Enterprise',   desc: '+ Full control & branding',     bg: '#FFF3E8',   text: '#D97706',  border: '#FF9B24' },
];

const TIER_ORDER: PlanTier[] = ['basic', 'pro', 'enterprise'];

function featuresForTier(tier: PlanTier): string[] {
  return FEATURES.filter(f => TIER_ORDER.indexOf(f.tier) <= TIER_ORDER.indexOf(tier)).map(f => f.id);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function isFeatureOn(feature: FeatureFlag, perms: PermissionsMap | PermissionsOverride): boolean {
  return feature.keys.every(k => !!(perms as any)[k]);
}

function applyFeature(feature: FeatureFlag, value: boolean, base: PermissionsOverride): PermissionsOverride {
  const next = { ...base };
  for (const k of feature.keys) (next as any)[k] = value;
  return next;
}

function applyPlan(tier: PlanTier, base: PermissionsOverride): PermissionsOverride {
  const enabled = new Set(featuresForTier(tier));
  let next = { ...base };
  for (const f of FEATURES) {
    const on = enabled.has(f.id);
    for (const k of f.keys) (next as any)[k] = on;
  }
  return next;
}

function detectPlan(perms: PermissionsMap | PermissionsOverride): PlanTier | null {
  for (const tier of [...TIER_ORDER].reverse()) {
    const enabled = new Set(featuresForTier(tier));
    const match = FEATURES.every(f => {
      const shouldBeOn = enabled.has(f.id);
      const isOn = isFeatureOn(f, perms);
      return shouldBeOn === isOn;
    });
    if (match) return tier;
  }
  return null;
}

// ── Shared components ─────────────────────────────────────────────────────────

function Toggle({ value, onChange, inherited }: { value: boolean; onChange: (v: boolean) => void; inherited?: boolean }) {
  return (
    <button
      onClick={() => onChange(!value)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
        value
          ? inherited ? 'bg-primary/50' : 'bg-primary'
          : inherited ? 'bg-gray-200' : 'bg-gray-300'
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
          initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
          className={`rounded-xl px-lg py-sm font-baloo text-sm font-semibold text-white mb-md ${savedLabel ? 'bg-success' : 'bg-primary'}`}
        >
          {savedLabel ? `✓ Saved for ${savedLabel}` : 'Saving…'}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function PlanPresets({ current, onApply }: { current: PlanTier | null; onApply: (t: PlanTier) => void }) {
  return (
    <div className="flex items-center gap-sm flex-wrap mb-md">
      <span className="font-baloo text-xs font-semibold text-text-muted uppercase tracking-wide">Apply preset:</span>
      {PLAN_TIERS.map(p => (
        <button
          key={p.id}
          onClick={() => onApply(p.id)}
          className="flex items-center gap-xs px-md py-xs rounded-full font-baloo font-semibold text-sm border-2 transition-all"
          style={current === p.id
            ? { background: p.bg, color: p.text, borderColor: p.border }
            : { background: 'white', color: '#9E9E9E', borderColor: '#F0EDE8' }
          }
        >
          {current === p.id && <span>✓ </span>}
          {p.label}
        </button>
      ))}
    </div>
  );
}

function TierBadge({ tier }: { tier: PlanTier }) {
  const p = PLAN_TIERS.find(p => p.id === tier)!;
  return (
    <span className="font-baloo text-xs font-semibold px-xs py-0.5 rounded-full" style={{ background: p.bg, color: p.text }}>
      {p.label}
    </span>
  );
}

function FeatureRow({
  feature, value, inherited, onChange,
}: {
  feature: FeatureFlag;
  value: boolean;
  inherited?: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between px-lg py-sm">
      <div className="flex items-center gap-md min-w-0">
        <span className="text-xl flex-shrink-0">{feature.icon}</span>
        <div className="min-w-0">
          <div className="flex items-center gap-xs flex-wrap">
            <span className="font-baloo font-semibold text-sm text-text-dark">{feature.label}</span>
            <TierBadge tier={feature.tier} />
            {inherited && <span className="font-baloo text-xs text-text-muted italic">inherited</span>}
          </div>
          <p className="font-baloo text-xs text-text-muted">{feature.desc}</p>
        </div>
      </div>
      <Toggle value={value} onChange={onChange} inherited={inherited} />
    </div>
  );
}

function AreaSection({
  area, features, perms, overrides, onToggle,
}: {
  area: string;
  features: FeatureFlag[];
  perms: PermissionsMap | PermissionsOverride;
  overrides?: PermissionsOverride | null;
  onToggle: (f: FeatureFlag, v: boolean) => void;
}) {
  const [open, setOpen] = useState(true);
  const onCount = features.filter(f => isFeatureOn(f, perms)).length;

  return (
    <div className="border border-divider rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-lg py-sm bg-gray-50 hover:bg-gray-100 transition-colors"
      >
        <span className="font-baloo font-bold text-sm text-text-dark">{area}</span>
        <div className="flex items-center gap-sm">
          <span className={`font-baloo text-xs font-semibold px-xs py-0.5 rounded-full ${
            onCount === features.length ? 'bg-success/10 text-success' : onCount === 0 ? 'bg-gray-100 text-text-muted' : 'bg-amber-50 text-amber-600'
          }`}>{onCount}/{features.length} on</span>
          <span className="text-text-muted text-xs">{open ? '▲' : '▼'}</span>
        </div>
      </button>
      {open && (
        <div className="divide-y divide-divider">
          {features.map(f => {
            const value = isFeatureOn(f, perms);
            const inherited = overrides !== undefined && overrides !== null
              && f.keys.every(k => !(k in overrides));
            return (
              <FeatureRow
                key={f.id}
                feature={f}
                value={value}
                inherited={inherited}
                onChange={v => onToggle(f, v)}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Roles Tab ─────────────────────────────────────────────────────────────────

const ROLE_CONFIG: { id: UserRole; label: string; icon: string; desc: string; locked?: boolean }[] = [
  { id: 'projectAdmin', label: 'Project Admin', icon: '🎯', desc: 'Manages a project and its schools' },
  { id: 'teacher',      label: 'Teacher',        icon: '✍️', desc: 'Class management, assignments, and curriculum' },
  { id: 'contentReviewer', label: 'Content Reviewer', icon: '🔍', desc: 'Reviews and approves word submissions' },
  { id: 'admin', label: 'Super Admin', icon: '👑', desc: 'All features always enabled', locked: true },
];

function RolesTab() {
  const { user } = useAuthStore();
  const [roleData, setRoleData] = useState<Partial<Record<UserRole, PermissionsMap>>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedLabel, setSavedLabel] = useState<string | null>(null);
  const [openRole, setOpenRole] = useState<UserRole | null>('projectAdmin');

  useEffect(() => {
    const ids = ROLE_CONFIG.map(r => r.id);
    Promise.all(ids.map(id => getRolePermissions(id))).then(results => {
      const map: Partial<Record<UserRole, PermissionsMap>> = {};
      ids.forEach((id, i) => { map[id] = results[i]; });
      setRoleData(map);
      setLoading(false);
    });
  }, []);

  const save = async (role: UserRole, updated: PermissionsMap) => {
    if (!user) return;
    setRoleData(prev => ({ ...prev, [role]: updated }));
    setSaving(true);
    try {
      await setRolePermissions(role, updated, user.uid);
      const label = ROLE_CONFIG.find(r => r.id === role)?.label ?? role;
      setSavedLabel(label);
      setTimeout(() => setSavedLabel(null), 1500);
    } catch { }
    setSaving(false);
  };

  const handleToggle = async (role: UserRole, feature: FeatureFlag, value: boolean) => {
    const current: PermissionsMap = { ...(roleData[role] ?? DEFAULT_PERMISSIONS[role]) };
    for (const k of feature.keys) current[k] = value;
    await save(role, current);
  };

  const handlePlan = async (role: UserRole, tier: PlanTier) => {
    const current: PermissionsMap = { ...(roleData[role] ?? DEFAULT_PERMISSIONS[role]) };
    const updated = applyPlan(tier, current) as PermissionsMap;
    await save(role, updated);
  };

  if (loading) return <div className="flex justify-center py-xxl"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" /></div>;

  return (
    <div className="space-y-md">
      <SaveBanner saving={saving} savedLabel={savedLabel} />
      {ROLE_CONFIG.map(role => {
        const perms = roleData[role.id] ?? DEFAULT_PERMISSIONS[role.id];
        const isOpen = openRole === role.id;
        const onCount = FEATURES.filter(f => isFeatureOn(f, perms)).length;
        const detectedPlan = detectPlan(perms);

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
                    {role.locked && <span className="font-baloo text-xs bg-gray-100 text-text-muted px-xs py-0.5 rounded-full">locked</span>}
                    {detectedPlan && <TierBadge tier={detectedPlan} />}
                  </div>
                  <p className="font-baloo text-xs text-text-muted">{role.desc}</p>
                </div>
              </div>
              <div className="flex items-center gap-sm">
                <span className={`font-baloo text-xs font-semibold px-xs py-0.5 rounded-full ${
                  onCount === FEATURES.length ? 'bg-success/10 text-success' : onCount === 0 ? 'bg-gray-100 text-text-muted' : 'bg-lavender-light text-primary'
                }`}>
                  {onCount} / {FEATURES.length} on
                </span>
                <span className="text-text-muted text-sm">{isOpen ? '▲' : '▼'}</span>
              </div>
            </button>

            <AnimatePresence>
              {isOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="border-t border-divider p-md space-y-sm">
                    {!role.locked && (
                      <PlanPresets current={detectedPlan} onApply={t => handlePlan(role.id, t)} />
                    )}
                    {FEATURE_AREAS.map(area => (
                      <AreaSection
                        key={area}
                        area={area}
                        features={FEATURES.filter(f => f.area === area)}
                        perms={perms}
                        onToggle={(f, v) => !role.locked && handleToggle(role.id, f, v)}
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

  const save = async (updated: PermissionsOverride) => {
    if (!user || !selectedProject) return;
    setOverride(updated);
    setSaving(true);
    try {
      await setProjectPermissionsOverride(selectedProject.id, updated, user.uid);
      setSavedLabel(selectedProject.name);
      setTimeout(() => setSavedLabel(null), 1500);
    } catch { }
    setSaving(false);
  };

  const handleToggle = (feature: FeatureFlag, value: boolean) => {
    save(applyFeature(feature, value, override ?? {}));
  };

  const handlePlan = (tier: PlanTier) => {
    save(applyPlan(tier, override ?? {}));
  };

  const handleReset = async () => {
    if (!selectedProject) return;
    await deleteProjectPermissionsOverride(selectedProject.id);
    setOverride(null);
  };

  const mergedPerms: PermissionsMap = (() => {
    const base = { ...DEFAULT_PERMISSIONS['projectAdmin'] };
    if (override) for (const [k, v] of Object.entries(override)) (base as any)[k] = v;
    return base;
  })();

  const detectedPlan = selectedProject ? detectPlan(mergedPerms) : null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-lg">
      {/* Project list */}
      <div className="bg-white rounded-2xl border border-divider overflow-hidden shadow-sm">
        <div className="px-md py-sm border-b border-divider">
          <p className="font-baloo font-bold text-sm text-text-dark">Projects</p>
          <p className="font-baloo text-xs text-text-muted">Select a project to set its feature plan</p>
        </div>
        <div className="overflow-y-auto max-h-[500px]">
          {loadingProjects
            ? <div className="flex justify-center py-lg"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" /></div>
            : projects.length === 0
              ? <p className="font-baloo text-sm text-text-muted text-center py-lg">No projects found</p>
              : projects.map(p => (
                <button
                  key={p.id} onClick={() => selectProject(p)}
                  className={`w-full text-left px-md py-sm border-b border-divider last:border-0 font-baloo text-sm transition-colors ${selectedProject?.id === p.id ? 'bg-lavender-light/40 text-primary font-semibold' : 'text-text-dark hover:bg-gray-50'}`}
                >
                  <p className="truncate">{p.name}</p>
                  <p className="text-xs text-text-muted truncate">{p.id}</p>
                </button>
              ))
          }
        </div>
      </div>

      {/* Override editor */}
      <div className="lg:col-span-2">
        <SaveBanner saving={saving} savedLabel={savedLabel} />
        {!selectedProject
          ? (
            <div className="bg-white rounded-2xl border border-divider p-xl text-center space-y-sm">
              <p className="text-4xl">🎯</p>
              <p className="font-baloo font-bold text-text-dark">Select a project</p>
              <p className="font-baloo text-sm text-text-muted">Choose a project from the list to configure its feature plan</p>
            </div>
          )
          : loadingOverride
            ? <div className="flex justify-center py-xl"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>
            : (
              <div className="bg-white rounded-2xl border border-divider overflow-hidden shadow-sm">
                <div className="px-lg py-md border-b border-divider flex items-center justify-between gap-md flex-wrap">
                  <div>
                    <div className="flex items-center gap-sm">
                      <p className="font-baloo font-bold text-text-dark">{selectedProject.name}</p>
                      {detectedPlan && <TierBadge tier={detectedPlan} />}
                    </div>
                    <p className="font-baloo text-xs text-text-muted">
                      {override ? 'Custom overrides active — overrides role defaults' : 'No overrides — inheriting role defaults'}
                    </p>
                  </div>
                  {override && (
                    <button onClick={handleReset} className="font-baloo text-xs text-error hover:underline flex-shrink-0">
                      Reset to role defaults
                    </button>
                  )}
                </div>
                <div className="p-md space-y-sm">
                  <PlanPresets current={detectedPlan} onApply={handlePlan} />
                  {FEATURE_AREAS.map(area => (
                    <AreaSection
                      key={area}
                      area={area}
                      features={FEATURES.filter(f => f.area === area)}
                      perms={mergedPerms}
                      overrides={override}
                      onToggle={handleToggle}
                    />
                  ))}
                </div>
              </div>
            )
        }
      </div>
    </div>
  );
}

// ── Users Tab ─────────────────────────────────────────────────────────────────

interface UserItem { id: string; name: string; email: string; role: UserRole; }

const MANAGED_ROLES: UserRole[] = ['projectAdmin', 'teacher', 'contentReviewer'];

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
        return { id: d.id, name: data.name ?? data.displayName ?? '—', email: data.email ?? '—', role: (data.role ?? 'teacher') as UserRole };
      }).filter(u => MANAGED_ROLES.includes(u.role));
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
    const o = await getUserPermissionsOverride(u.id);
    setOverride(o);
    setLoadingOverride(false);
  };

  const save = async (updated: PermissionsOverride) => {
    if (!user || !selectedUser) return;
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

  const mergedPerms: PermissionsMap = (() => {
    if (!selectedUser) return { ...DEFAULT_PERMISSIONS['teacher'] };
    const base = { ...DEFAULT_PERMISSIONS[selectedUser.role] };
    if (override) for (const [k, v] of Object.entries(override)) (base as any)[k] = v;
    return base;
  })();

  const detectedPlan = selectedUser ? detectPlan(mergedPerms) : null;

  const ROLE_BADGE: Record<string, string> = {
    projectAdmin: 'bg-orange-50 text-orange-600',
    teacher: 'bg-green-50 text-green-600',
    contentReviewer: 'bg-purple-50 text-purple-600',
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-lg">
      <div className="bg-white rounded-2xl border border-divider overflow-hidden shadow-sm">
        <div className="px-md py-sm border-b border-divider">
          <input
            className="w-full font-baloo text-sm bg-gray-50 border border-divider rounded-xl px-sm py-xs focus:outline-none focus:border-primary"
            placeholder="Search users…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="overflow-y-auto max-h-[500px]">
          {loadingUsers
            ? <div className="flex justify-center py-lg"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" /></div>
            : filtered.length === 0
              ? <p className="font-baloo text-sm text-text-muted text-center py-lg">No users found</p>
              : filtered.map(u => (
                <button key={u.id} onClick={() => selectUser(u)}
                  className={`w-full text-left px-md py-sm border-b border-divider last:border-0 transition-colors ${selectedUser?.id === u.id ? 'bg-lavender-light/40' : 'hover:bg-gray-50'}`}
                >
                  <div className="flex items-center justify-between gap-xs">
                    <p className="font-baloo text-sm font-semibold text-text-dark truncate">{u.name}</p>
                    <span className={`font-baloo text-xs px-xs py-0.5 rounded-full shrink-0 ${ROLE_BADGE[u.role] ?? 'bg-gray-100 text-text-muted'}`}>{u.role}</span>
                  </div>
                  <p className="font-baloo text-xs text-text-muted truncate">{u.email}</p>
                </button>
              ))
          }
        </div>
      </div>

      <div className="lg:col-span-2">
        <SaveBanner saving={saving} savedLabel={savedLabel} />
        {!selectedUser
          ? <div className="bg-white rounded-2xl border border-divider p-xl text-center"><p className="font-baloo text-text-muted">Select a user to configure their feature access</p></div>
          : loadingOverride
            ? <div className="flex justify-center py-xl"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>
            : (
              <div className="bg-white rounded-2xl border border-divider overflow-hidden shadow-sm">
                <div className="px-lg py-md border-b border-divider flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-sm">
                      <p className="font-baloo font-bold text-text-dark">{selectedUser.name}</p>
                      {detectedPlan && <TierBadge tier={detectedPlan} />}
                    </div>
                    <p className="font-baloo text-xs text-text-muted">
                      {selectedUser.email} · {selectedUser.role}
                      {override ? ' · Custom overrides active' : ' · Inheriting role & project defaults'}
                    </p>
                  </div>
                  {override && (
                    <button onClick={handleReset} className="font-baloo text-xs text-error hover:underline">Reset to defaults</button>
                  )}
                </div>
                <div className="p-md space-y-sm">
                  <PlanPresets current={detectedPlan} onApply={t => save(applyPlan(t, override ?? {}))} />
                  {FEATURE_AREAS.map(area => (
                    <AreaSection
                      key={area}
                      area={area}
                      features={FEATURES.filter(f => f.area === area)}
                      perms={mergedPerms}
                      overrides={override}
                      onToggle={(f, v) => save(applyFeature(f, v, override ?? {}))}
                    />
                  ))}
                </div>
              </div>
            )
        }
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

type PageTab = 'roles' | 'projects' | 'users';

export default function FeatureControlsPage() {
  const [tab, setTab] = useState<PageTab>('projects');

  const TABS: { id: PageTab; label: string; icon: string }[] = [
    { id: 'projects', label: 'By Project', icon: '🎯' },
    { id: 'roles',    label: 'By Role',    icon: '👤' },
    { id: 'users',    label: 'By User',    icon: '🙋' },
  ];

  return (
    <div className="space-y-lg max-w-5xl">
      <div>
        <h1 className="font-baloo font-extrabold text-xxl text-text-dark">Feature Controls 🎛️</h1>
        <p className="font-baloo text-text-muted">
          Control which features are available — by project, role, or individual user.
          Use plan presets to apply a standard tier in one click, then fine-tune individual features.
          More specific settings override broader ones:{' '}
          <span className="font-semibold">user &gt; project &gt; role</span>.
        </p>
      </div>

      {/* Plan legend */}
      <div className="flex gap-sm flex-wrap">
        {PLAN_TIERS.map(p => (
          <div key={p.id} className="flex items-center gap-xs px-md py-xs rounded-full border font-baloo text-sm" style={{ background: p.bg, borderColor: p.border, color: p.text }}>
            <span className="font-bold">{p.label}</span>
            <span className="opacity-70">— {p.desc}</span>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-sm border-b border-divider">
        {TABS.map(t => (
          <button
            key={t.id} onClick={() => setTab(t.id)}
            className={`font-baloo font-semibold text-sm px-md pb-sm border-b-2 transition-colors ${tab === t.id ? 'border-primary text-primary' : 'border-transparent text-text-muted hover:text-text-dark'}`}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {tab === 'projects' && <ProjectsTab />}
      {tab === 'roles'    && <RolesTab />}
      {tab === 'users'    && <UsersTab />}

      <div className="bg-lavender-light/30 rounded-xl p-md font-baloo text-sm text-primary border border-primary/20">
        <span className="font-semibold">Live updates:</span> Changes take effect immediately — users don't need to refresh.
        The existing <span className="font-semibold">Feature Permissions</span> page gives full control over all individual action keys.
      </div>
    </div>
  );
}
