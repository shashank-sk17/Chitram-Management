import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from '../../stores/authStore';
import { usePermission } from '../../hooks/usePermission';
import type { LicenseKeyDoc, LanguageCode, LicenseKeyPlan, SchoolDoc, ProjectDoc } from '../../types/firestore';
import {
  getLicenseKeys, createLicenseKeysBulk, revokeLicenseKey, exportLicenseKeysCSV,
  type LicenseKeyFilters, type LicenseKeyCreateParams,
} from '../../services/firebase/licenseKeys';
import { getAllProjects, getAllSchools } from '../../services/firebase/firestore';
import { SUPPORTED_LANGUAGES, LANGUAGE_LABELS } from '../../services/firebase/languageCurricula';
import { Timestamp } from 'firebase/firestore';

type KeyWithId = { id: string } & LicenseKeyDoc;
type ProjectWithId = ProjectDoc & { id: string };
type SchoolWithId = SchoolDoc & { id: string };

const PLAN_BADGE: Record<LicenseKeyPlan, string> = {
  free:       'bg-gray-100 text-gray-500',
  basic:      'bg-lavender-light text-primary',
  pro:        'bg-orange-50 text-accent',
  enterprise: 'bg-mint-light text-secondary',
};

const PLAN_LABEL: Record<LicenseKeyPlan, string> = {
  free: 'Free', basic: 'Basic', pro: 'Pro', enterprise: 'Enterprise',
};

const GRADES = [1, 2, 3, 4, 5];

function formatDate(ts: Timestamp | string | undefined | null): string {
  if (!ts) return '—';
  if (ts instanceof Timestamp) return ts.toDate().toLocaleDateString();
  return String(ts);
}

function isPending(k: KeyWithId): boolean {
  if (k.status !== 'unused') return false;
  if (!k.validFrom) return false;
  const vf = k.validFrom instanceof Timestamp ? k.validFrom.toDate().getTime() : 0;
  return vf > Date.now();
}

const EMPTY_FORM = (): LicenseKeyCreateParams & { count: number; expiresAtStr: string; validFromStr: string; maxRedemptionsStr: string; maxLevelStr: string } => ({
  grade: 1,
  language: 'te',
  count: 1,
  plan: 'basic',
  expiresAtStr: '',
  validFromStr: '',
  maxRedemptionsStr: '',
  projectId: '',
  schoolId: '',
  maxLevelStr: '',
  note: '',
});

export default function LicenseKeysPage() {
  const { user } = useAuthStore();
  const { can } = usePermission();
  const [keys, setKeys] = useState<KeyWithId[]>([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState<LicenseKeyFilters>({});
  const [revoking, setRevoking] = useState<string | null>(null);

  const [projects, setProjects] = useState<ProjectWithId[]>([]);
  const [schools, setSchools] = useState<SchoolWithId[]>([]);

  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState(EMPTY_FORM());
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    load(filters);
    getAllProjects().then(setProjects).catch(() => {});
    getAllSchools().then(setSchools).catch(() => {});
  }, []);

  const filteredSchools = useMemo(() =>
    filters.projectId
      ? schools.filter(s => s.projectId === filters.projectId)
      : schools,
    [schools, filters.projectId],
  );

  const formFilteredSchools = useMemo(() =>
    createForm.projectId
      ? schools.filter(s => s.projectId === createForm.projectId)
      : schools,
    [schools, createForm.projectId],
  );

  const schoolMap = useMemo(() => new Map(schools.map(s => [s.id, s.name])), [schools]);

  const load = async (f: LicenseKeyFilters = {}) => {
    setLoading(true);
    try { setKeys(await getLicenseKeys(f)); } catch {}
    setLoading(false);
  };

  const handleRevoke = async (key: string) => {
    if (!confirm(`Revoke key ${key}?`)) return;
    setRevoking(key);
    try {
      await revokeLicenseKey(key);
      setKeys(prev => prev.map(k => k.id === key ? { ...k, status: 'expired' } : k));
    } catch {}
    setRevoking(null);
  };

  const handleCreate = async () => {
    if (!user) return;
    setCreating(true);
    try {
      const params: LicenseKeyCreateParams = {
        grade: createForm.grade,
        language: createForm.language as LanguageCode,
        count: createForm.count,
        plan: createForm.plan,
        ...(createForm.validFromStr ? { validFrom: new Date(createForm.validFromStr) } : {}),
        ...(createForm.expiresAtStr ? { expiresAt: new Date(createForm.expiresAtStr) } : {}),
        ...(createForm.maxRedemptionsStr ? { maxRedemptions: Number(createForm.maxRedemptionsStr) } : {}),
        ...(createForm.projectId ? { projectId: createForm.projectId } : {}),
        ...(createForm.schoolId ? { schoolId: createForm.schoolId } : {}),
        ...(createForm.maxLevelStr ? { maxLevel: Number(createForm.maxLevelStr) } : {}),
        ...(createForm.note ? { note: createForm.note } : {}),
      };
      await createLicenseKeysBulk(params, user.uid);
      await load(filters);
      setShowCreate(false);
      setCreateForm(EMPTY_FORM());
    } catch (e: any) {
      alert(e?.message ?? 'Failed to create keys');
    }
    setCreating(false);
  };

  const stats = {
    total: keys.length,
    active: keys.filter(k => k.status === 'active').length,
    unused: keys.filter(k => k.status === 'unused' && !isPending(k)).length,
    pending: keys.filter(isPending).length,
    expired: keys.filter(k => k.status === 'expired').length,
  };

  const cf = createForm;

  return (
    <div className="space-y-lg">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-md">
        <div>
          <h1 className="font-baloo font-extrabold text-xxl text-text-dark">License Keys</h1>
          <p className="font-baloo text-text-muted">Create and manage subscription keys by plan, project, and school</p>
        </div>
        <div className="flex items-center gap-sm">
          <button
            onClick={() => exportLicenseKeysCSV(keys, schools)}
            className="px-md py-sm rounded-xl border-2 border-divider font-baloo font-semibold text-sm text-text-dark hover:bg-lavender-light transition-colors"
          >
            Export CSV
          </button>
          {can('licenseKeys.generate') && (
            <button
              onClick={() => setShowCreate(true)}
              className="px-lg py-sm bg-primary text-white font-baloo font-bold text-sm rounded-xl shadow-md hover:bg-primary/90 transition-colors"
            >
              + Create Key(s)
            </button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-md">
        {[
          { label: 'Total', value: stats.total, icon: '🔑', color: 'bg-lavender-light' },
          { label: 'Active', value: stats.active, icon: '✅', color: 'bg-mint-light' },
          { label: 'Unused', value: stats.unused, icon: '⬜', color: 'bg-white' },
          { label: 'Pending', value: stats.pending, icon: '⏳', color: 'bg-amber-50' },
          { label: 'Expired', value: stats.expired, icon: '❌', color: 'bg-rose-50' },
        ].map(s => (
          <div key={s.label} className={`${s.color} rounded-2xl border border-divider shadow-sm p-md flex items-center gap-sm`}>
            <span className="text-2xl">{s.icon}</span>
            <div>
              <p className="font-baloo font-extrabold text-xl text-text-dark leading-none">{s.value}</p>
              <p className="font-baloo text-xs text-text-muted mt-xs">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filter bar */}
      <div className="bg-white rounded-2xl border border-divider shadow-sm p-md flex flex-wrap items-end gap-md">
        {[
          { label: 'Status', key: 'status', opts: [['', 'All Statuses'], ['unused', 'Unused'], ['active', 'Active'], ['expired', 'Expired']] },
          { label: 'Grade', key: 'grade', opts: [['', 'All Grades'], ...GRADES.map(g => [String(g), `Grade ${g}`])] },
          { label: 'Plan', key: 'plan', opts: [['', 'All Plans'], ['free', 'Free'], ['basic', 'Basic'], ['pro', 'Pro'], ['enterprise', 'Enterprise']] },
        ].map(({ label, key, opts }) => (
          <div key={key}>
            <label className="font-baloo font-bold text-xs text-text-dark block mb-xs">{label}</label>
            <select
              value={(filters as any)[key] ?? ''}
              onChange={e => setFilters(f => ({ ...f, [key]: e.target.value || undefined }))}
              className="px-md py-sm rounded-xl border border-divider font-baloo text-sm focus:outline-none focus:ring-2 focus:ring-primary bg-white min-w-[120px]"
            >
              {opts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
        ))}
        <div>
          <label className="font-baloo font-bold text-xs text-text-dark block mb-xs">Language</label>
          <select
            value={filters.language ?? ''}
            onChange={e => setFilters(f => ({ ...f, language: (e.target.value || undefined) as any }))}
            className="px-md py-sm rounded-xl border border-divider font-baloo text-sm focus:outline-none focus:ring-2 focus:ring-primary bg-white min-w-[130px]"
          >
            <option value="">All Languages</option>
            {SUPPORTED_LANGUAGES.map(l => <option key={l} value={l}>{LANGUAGE_LABELS[l]}</option>)}
          </select>
        </div>
        <div>
          <label className="font-baloo font-bold text-xs text-text-dark block mb-xs">Project</label>
          <select
            value={filters.projectId ?? ''}
            onChange={e => setFilters(f => ({ ...f, projectId: e.target.value || undefined, schoolId: undefined }))}
            className="px-md py-sm rounded-xl border border-divider font-baloo text-sm focus:outline-none focus:ring-2 focus:ring-primary bg-white min-w-[140px]"
          >
            <option value="">All Projects</option>
            {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div>
          <label className="font-baloo font-bold text-xs text-text-dark block mb-xs">School</label>
          <select
            value={filters.schoolId ?? ''}
            onChange={e => setFilters(f => ({ ...f, schoolId: e.target.value || undefined }))}
            className="px-md py-sm rounded-xl border border-divider font-baloo text-sm focus:outline-none focus:ring-2 focus:ring-primary bg-white min-w-[140px]"
          >
            <option value="">All Schools</option>
            {filteredSchools.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <button
          onClick={() => load(filters)}
          disabled={loading}
          className="px-lg py-sm bg-secondary text-white font-baloo font-bold text-sm rounded-xl hover:bg-secondary/90 transition-colors disabled:opacity-50"
        >
          {loading ? 'Loading…' : 'Apply'}
        </button>
      </div>

      {/* Keys table */}
      <div className="bg-white rounded-2xl shadow-sm border border-divider overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-lavender-light/30 border-b border-divider">
                {['Key', 'Grade', 'Language', 'Plan', 'Status', 'Valid From', 'Expires', 'School', 'Note', 'Actions'].map(h => (
                  <th key={h} className="px-md py-sm text-left font-baloo font-bold text-sm text-text-dark whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={10} className="px-md py-xl text-center font-baloo text-text-muted">Loading…</td></tr>
              ) : keys.length === 0 ? (
                <tr><td colSpan={10} className="px-md py-xl text-center font-baloo text-text-muted">No keys found</td></tr>
              ) : (
                keys.map(k => {
                  const pending = isPending(k);
                  const isMultiUse = (k.maxRedemptions ?? 0) > 1;
                  const statusLabel = pending ? 'Pending' : k.status;
                  const statusClass = pending
                    ? 'bg-amber-50 text-amber-600'
                    : k.status === 'active' ? 'bg-success/10 text-success'
                    : k.status === 'expired' ? 'bg-error/10 text-error'
                    : 'bg-lavender-light text-primary';

                  return (
                    <tr key={k.id} className="border-b border-divider hover:bg-lavender-light/20 transition-colors">
                      <td className="px-md py-sm font-baloo font-bold text-sm text-text-dark tracking-widest">{k.key}</td>
                      <td className="px-md py-sm font-baloo text-sm text-text-muted whitespace-nowrap">Grade {k.grade}</td>
                      <td className="px-md py-sm font-baloo text-sm text-text-muted">{LANGUAGE_LABELS[k.language] || k.language}</td>
                      <td className="px-md py-sm">
                        {k.plan ? (
                          <span className={`px-sm py-0.5 rounded-full font-baloo font-semibold text-xs ${PLAN_BADGE[k.plan] ?? 'bg-gray-100 text-gray-500'}`}>
                            {PLAN_LABEL[k.plan] ?? k.plan}
                          </span>
                        ) : <span className="font-baloo text-xs text-text-muted">—</span>}
                      </td>
                      <td className="px-md py-sm">
                        <span className={`px-sm py-0.5 rounded-full font-baloo font-semibold text-xs capitalize ${statusClass}`}>
                          {isMultiUse && k.status !== 'expired'
                            ? `${k.redemptionCount ?? 0} / ${k.maxRedemptions} uses`
                            : statusLabel}
                        </span>
                      </td>
                      <td className="px-md py-sm font-baloo text-sm text-text-muted whitespace-nowrap">{formatDate(k.validFrom)}</td>
                      <td className="px-md py-sm font-baloo text-sm text-text-muted whitespace-nowrap">{formatDate(k.expiresAt)}</td>
                      <td className="px-md py-sm font-baloo text-sm text-text-muted max-w-[120px] truncate">
                        {k.schoolId ? schoolMap.get(k.schoolId) ?? k.schoolId : '—'}
                      </td>
                      <td className="px-md py-sm font-baloo text-xs text-text-muted max-w-[100px] truncate">{k.note || '—'}</td>
                      <td className="px-md py-sm">
                        {k.status !== 'expired' && can('licenseKeys.revoke') && (
                          <button
                            onClick={() => handleRevoke(k.id)}
                            disabled={revoking === k.id}
                            className="px-sm py-xs bg-error/10 text-error font-baloo font-semibold text-xs rounded-lg hover:bg-error hover:text-white transition-colors disabled:opacity-50"
                          >
                            {revoking === k.id ? '…' : 'Revoke'}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Modal */}
      <AnimatePresence>
        {showCreate && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/40 z-50"
              onClick={() => setShowCreate(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="fixed inset-x-4 top-1/2 -translate-y-1/2 sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2 sm:w-[580px] bg-white rounded-2xl shadow-2xl z-50 flex flex-col overflow-hidden max-h-[90vh]"
            >
              <div className="px-lg py-md border-b border-divider bg-lavender-light/30 flex items-center justify-between shrink-0">
                <h2 className="font-baloo font-bold text-lg text-text-dark">Create License Key(s)</h2>
                <button onClick={() => setShowCreate(false)} className="w-8 h-8 rounded-full bg-white/60 flex items-center justify-center text-text-muted hover:text-text-dark">✕</button>
              </div>

              <div className="p-lg space-y-md overflow-y-auto">
                {/* Row 1: Grade + Language + Count */}
                <div className="grid grid-cols-3 gap-md">
                  <div>
                    <label className="font-baloo font-bold text-xs text-text-dark block mb-xs">Grade</label>
                    <select value={cf.grade} onChange={e => setCreateForm(f => ({ ...f, grade: Number(e.target.value) }))}
                      className="w-full px-sm py-xs rounded-xl border border-divider font-baloo text-sm focus:outline-none focus:ring-1 focus:ring-primary">
                      {GRADES.map(g => <option key={g} value={g}>Grade {g}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="font-baloo font-bold text-xs text-text-dark block mb-xs">Language</label>
                    <select value={cf.language} onChange={e => setCreateForm(f => ({ ...f, language: e.target.value as LanguageCode }))}
                      className="w-full px-sm py-xs rounded-xl border border-divider font-baloo text-sm focus:outline-none focus:ring-1 focus:ring-primary">
                      {SUPPORTED_LANGUAGES.map(l => <option key={l} value={l}>{LANGUAGE_LABELS[l]}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="font-baloo font-bold text-xs text-text-dark block mb-xs">Count (1–500)</label>
                    <input type="number" min={1} max={500} value={cf.count}
                      onChange={e => setCreateForm(f => ({ ...f, count: Math.min(500, Math.max(1, Number(e.target.value))) }))}
                      className="w-full px-sm py-xs rounded-xl border border-divider font-baloo text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
                  </div>
                </div>

                {/* Row 2: Plan + Max Redemptions */}
                <div className="grid grid-cols-2 gap-md">
                  <div>
                    <label className="font-baloo font-bold text-xs text-text-dark block mb-xs">Plan</label>
                    <select value={cf.plan} onChange={e => setCreateForm(f => ({ ...f, plan: e.target.value as LicenseKeyPlan }))}
                      className="w-full px-sm py-xs rounded-xl border border-divider font-baloo text-sm focus:outline-none focus:ring-1 focus:ring-primary">
                      <option value="free">Free (levels 1–2)</option>
                      <option value="basic">Basic (levels 1–4)</option>
                      <option value="pro">Pro (levels 1–8)</option>
                      <option value="enterprise">Enterprise (all levels)</option>
                    </select>
                  </div>
                  <div>
                    <label className="font-baloo font-bold text-xs text-text-dark block mb-xs">Max Redemptions <span className="text-text-muted font-normal">(blank = single-use)</span></label>
                    <input type="number" min={2} value={cf.maxRedemptionsStr}
                      onChange={e => setCreateForm(f => ({ ...f, maxRedemptionsStr: e.target.value }))}
                      placeholder="e.g. 50 for school key"
                      className="w-full px-sm py-xs rounded-xl border border-divider font-baloo text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
                  </div>
                </div>

                {/* Row 3: Valid From + Expires */}
                <div className="grid grid-cols-2 gap-md">
                  <div>
                    <label className="font-baloo font-bold text-xs text-text-dark block mb-xs">Valid From <span className="text-text-muted font-normal">(optional)</span></label>
                    <input type="date" value={cf.validFromStr}
                      onChange={e => setCreateForm(f => ({ ...f, validFromStr: e.target.value }))}
                      className="w-full px-sm py-xs rounded-xl border border-divider font-baloo text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
                  </div>
                  <div>
                    <label className="font-baloo font-bold text-xs text-text-dark block mb-xs">Expires <span className="text-text-muted font-normal">(optional)</span></label>
                    <input type="date" value={cf.expiresAtStr}
                      onChange={e => setCreateForm(f => ({ ...f, expiresAtStr: e.target.value }))}
                      className="w-full px-sm py-xs rounded-xl border border-divider font-baloo text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
                  </div>
                </div>

                {/* Row 4: Project + School */}
                <div className="grid grid-cols-2 gap-md">
                  <div>
                    <label className="font-baloo font-bold text-xs text-text-dark block mb-xs">Project <span className="text-text-muted font-normal">(optional scope)</span></label>
                    <select value={cf.projectId ?? ''} onChange={e => setCreateForm(f => ({ ...f, projectId: e.target.value || undefined, schoolId: undefined }))}
                      className="w-full px-sm py-xs rounded-xl border border-divider font-baloo text-sm focus:outline-none focus:ring-1 focus:ring-primary">
                      <option value="">— No project —</option>
                      {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="font-baloo font-bold text-xs text-text-dark block mb-xs">School <span className="text-text-muted font-normal">(optional scope)</span></label>
                    <select value={cf.schoolId ?? ''} onChange={e => setCreateForm(f => ({ ...f, schoolId: e.target.value || undefined }))}
                      className="w-full px-sm py-xs rounded-xl border border-divider font-baloo text-sm focus:outline-none focus:ring-1 focus:ring-primary">
                      <option value="">— No school —</option>
                      {formFilteredSchools.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </div>
                </div>

                {/* Row 5: Max Level + Note */}
                <div className="grid grid-cols-2 gap-md">
                  <div>
                    <label className="font-baloo font-bold text-xs text-text-dark block mb-xs">
                      Max Level Override <span className="text-text-muted font-normal">(blank = plan default)</span>
                    </label>
                    <input type="number" min={1} value={cf.maxLevelStr}
                      onChange={e => setCreateForm(f => ({ ...f, maxLevelStr: e.target.value }))}
                      placeholder={cf.plan === 'basic' ? 'Default: 4' : cf.plan === 'pro' ? 'Default: 8' : cf.plan === 'enterprise' ? 'Default: ∞' : 'Default: 2'}
                      className="w-full px-sm py-xs rounded-xl border border-divider font-baloo text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
                  </div>
                  <div>
                    <label className="font-baloo font-bold text-xs text-text-dark block mb-xs">Internal Note</label>
                    <input type="text" value={cf.note ?? ''} onChange={e => setCreateForm(f => ({ ...f, note: e.target.value }))}
                      placeholder="e.g. Sunrise School batch 1"
                      className="w-full px-sm py-xs rounded-xl border border-divider font-baloo text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
                  </div>
                </div>

                {/* Summary */}
                <div className="bg-lavender-light/40 rounded-xl px-md py-sm font-baloo text-sm text-primary font-semibold">
                  Creating {cf.count} × Grade {cf.grade} {LANGUAGE_LABELS[cf.language as LanguageCode] ?? cf.language} key{cf.count > 1 ? 's' : ''} —{' '}
                  {cf.plan ? `${PLAN_LABEL[cf.plan as LicenseKeyPlan]} plan` : 'Basic plan'}
                  {cf.validFromStr ? `, active from ${new Date(cf.validFromStr).toLocaleDateString()}` : ''}
                  {cf.expiresAtStr ? ` until ${new Date(cf.expiresAtStr).toLocaleDateString()}` : ''}
                  {cf.maxRedemptionsStr ? `, ${cf.maxRedemptionsStr} uses each` : ''}
                  {cf.schoolId ? `, for ${schoolMap.get(cf.schoolId) ?? 'selected school'}` : ''}
                </div>
              </div>

              <div className="px-lg py-md border-t border-divider flex items-center justify-between shrink-0">
                <button onClick={() => { setShowCreate(false); setCreateForm(EMPTY_FORM()); }}
                  className="font-baloo font-semibold text-sm text-text-muted hover:text-text-dark">Cancel</button>
                <button onClick={handleCreate} disabled={creating}
                  className="px-lg py-sm bg-primary text-white font-baloo font-bold text-sm rounded-xl shadow-md hover:bg-primary/90 transition-colors disabled:opacity-50">
                  {creating ? 'Creating…' : `Create ${cf.count > 1 ? `${cf.count} Keys` : 'Key'}`}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
