import { useState, useEffect, useMemo } from 'react';
import { collection, getDocs, Timestamp, query, orderBy } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../../config/firebase';
import { useAuthStore } from '../../stores/authStore';
import { usePermission } from '../../hooks/usePermission';
import type { DiscountDoc, ProjectDoc, SchoolDoc } from '../../types/firestore';
import { getAllProjects, getAllSchools } from '../../services/firebase/firestore';

type DiscountWithId = { id: string } & DiscountDoc;
type ProjectWithId = ProjectDoc & { id: string };
type SchoolWithId = SchoolDoc & { id: string };

const APPLIES_LABELS: Record<string, string> = {
  all: 'All Plans', monthly: 'Monthly', yearly: 'Yearly', lifetime: 'Lifetime', level: 'Per-Level',
};

function formatDate(ts: Timestamp | null | undefined) {
  if (!ts) return '—';
  return ts instanceof Timestamp ? ts.toDate().toLocaleDateString() : String(ts);
}

const EMPTY_FORM = () => ({
  code: '',
  type: 'percent' as 'percent' | 'flat',
  value: 10,
  appliesTo: 'all' as DiscountDoc['appliesTo'],
  maxUses: '',
  validFromStr: '',
  expiresAt: '',
  projectId: '',
  schoolId: '',
  note: '',
});

export default function DiscountPage() {
  const { user } = useAuthStore();
  const { can } = usePermission();
  const [discounts, setDiscounts] = useState<DiscountWithId[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM());
  const [saving, setSaving] = useState(false);

  const [projects, setProjects] = useState<ProjectWithId[]>([]);
  const [schools, setSchools] = useState<SchoolWithId[]>([]);

  // Client-side filter state
  const [filterProject, setFilterProject] = useState('');
  const [filterSchool, setFilterSchool] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterAppliesTo, setFilterAppliesTo] = useState('');

  useEffect(() => {
    load();
    getAllProjects().then(setProjects).catch(() => {});
    getAllSchools().then(setSchools).catch(() => {});
  }, []);

  const schoolMap = useMemo(() => new Map(schools.map(s => [s.id, s.name])), [schools]);
  const projectMap = useMemo(() => new Map(projects.map(p => [p.id, p.name])), [projects]);

  const filterSchools = useMemo(() =>
    filterProject ? schools.filter(s => s.projectId === filterProject) : schools,
    [schools, filterProject],
  );
  const formSchools = useMemo(() =>
    form.projectId ? schools.filter(s => s.projectId === form.projectId) : schools,
    [schools, form.projectId],
  );

  const filtered = useMemo(() => discounts.filter(d => {
    if (filterProject && d.projectId !== filterProject) return false;
    if (filterSchool && d.schoolId !== filterSchool) return false;
    if (filterStatus === 'active' && !d.active) return false;
    if (filterStatus === 'inactive' && d.active) return false;
    if (filterAppliesTo && d.appliesTo !== filterAppliesTo) return false;
    return true;
  }), [discounts, filterProject, filterSchool, filterStatus, filterAppliesTo]);

  const load = async () => {
    setLoading(true);
    try {
      const snap = await getDocs(query(collection(db, 'discounts'), orderBy('createdAt', 'desc')));
      setDiscounts(snap.docs.map(d => ({ id: d.id, ...(d.data() as DiscountDoc) })));
    } catch {}
    setLoading(false);
  };

  const toggleActive = async (d: DiscountWithId) => {
    const fn = httpsCallable(functions, 'adminToggleDiscount');
    await fn({ discountId: d.id, active: !d.active });
    setDiscounts(prev => prev.map(x => x.id === d.id ? { ...x, active: !x.active } : x));
  };

  const generateCode = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    setForm(p => ({ ...p, code: Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join('') }));
  };

  const handleCreate = async () => {
    if (!user || !form.code.trim() || !form.value) return;
    setSaving(true);
    try {
      const fn = httpsCallable<unknown, { id: string }>(functions, 'adminCreateDiscount');
      const result = await fn({
        code: form.code.trim().toUpperCase(),
        type: form.type,
        value: Number(form.value),
        appliesTo: form.appliesTo,
        maxUses: form.maxUses ? Number(form.maxUses) : null,
        validFrom: form.validFromStr ? new Date(form.validFromStr).toISOString() : null,
        expiresAt: form.expiresAt ? new Date(form.expiresAt).toISOString() : null,
        note: form.note,
        ...(form.projectId ? { projectId: form.projectId } : {}),
        ...(form.schoolId ? { schoolId: form.schoolId } : {}),
      });
      const newDiscount: DiscountWithId = {
        id: result.data.id,
        code: form.code.trim().toUpperCase(),
        type: form.type,
        value: Number(form.value),
        appliesTo: form.appliesTo,
        maxUses: form.maxUses ? Number(form.maxUses) : null,
        usedCount: 0,
        active: true,
        validFrom: form.validFromStr ? Timestamp.fromDate(new Date(form.validFromStr)) : undefined,
        expiresAt: form.expiresAt ? Timestamp.fromDate(new Date(form.expiresAt)) : null,
        createdAt: Timestamp.now(),
        createdBy: user.uid,
        note: form.note,
        ...(form.projectId ? { projectId: form.projectId } : {}),
        ...(form.schoolId ? { schoolId: form.schoolId } : {}),
      };
      setDiscounts(prev => [newDiscount, ...prev]);
      setShowForm(false);
      setForm(EMPTY_FORM());
    } catch (e: any) {
      alert(e?.message ?? 'Failed to create discount');
    }
    setSaving(false);
  };

  const scopeLabel = (d: DiscountWithId) => {
    if (d.schoolId) return schoolMap.get(d.schoolId) ?? d.schoolId;
    if (d.projectId) return projectMap.get(d.projectId) ?? d.projectId;
    return null;
  };

  return (
    <div className="space-y-lg">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-baloo font-extrabold text-xxl text-text-dark">Discount Codes</h1>
          <p className="font-baloo text-text-muted">Manage promo codes by project and school</p>
        </div>
        {can('discounts.create') && (
          <button onClick={() => setShowForm(true)}
            className="px-lg py-sm rounded-xl bg-primary text-white font-baloo font-bold text-sm hover:bg-primary/90 transition-colors shadow-sm">
            + New Code
          </button>
        )}
      </div>

      {/* Filter bar */}
      <div className="bg-white rounded-2xl border border-divider shadow-sm p-md flex flex-wrap items-end gap-md">
        <div>
          <label className="font-baloo font-bold text-xs text-text-dark block mb-xs">Project</label>
          <select value={filterProject} onChange={e => { setFilterProject(e.target.value); setFilterSchool(''); }}
            className="px-md py-sm rounded-xl border border-divider font-baloo text-sm focus:outline-none focus:ring-2 focus:ring-primary bg-white min-w-[140px]">
            <option value="">All Projects</option>
            {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div>
          <label className="font-baloo font-bold text-xs text-text-dark block mb-xs">School</label>
          <select value={filterSchool} onChange={e => setFilterSchool(e.target.value)}
            className="px-md py-sm rounded-xl border border-divider font-baloo text-sm focus:outline-none focus:ring-2 focus:ring-primary bg-white min-w-[140px]">
            <option value="">All Schools</option>
            {filterSchools.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div>
          <label className="font-baloo font-bold text-xs text-text-dark block mb-xs">Status</label>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
            className="px-md py-sm rounded-xl border border-divider font-baloo text-sm focus:outline-none focus:ring-2 focus:ring-primary bg-white min-w-[120px]">
            <option value="">All</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
        <div>
          <label className="font-baloo font-bold text-xs text-text-dark block mb-xs">Applies To</label>
          <select value={filterAppliesTo} onChange={e => setFilterAppliesTo(e.target.value)}
            className="px-md py-sm rounded-xl border border-divider font-baloo text-sm focus:outline-none focus:ring-2 focus:ring-primary bg-white min-w-[130px]">
            <option value="">All Types</option>
            {Object.entries(APPLIES_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        {(filterProject || filterSchool || filterStatus || filterAppliesTo) && (
          <button onClick={() => { setFilterProject(''); setFilterSchool(''); setFilterStatus(''); setFilterAppliesTo(''); }}
            className="px-md py-sm rounded-xl border border-divider font-baloo text-sm text-text-muted hover:text-text-dark">
            Clear
          </button>
        )}
        <span className="ml-auto font-baloo text-xs text-text-muted self-end pb-sm">
          {filtered.length} of {discounts.length} codes
        </span>
      </div>

      {/* Create form */}
      {showForm && (
        <div className="bg-white rounded-2xl border border-divider shadow-sm p-lg space-y-md">
          <h3 className="font-baloo font-bold text-md text-text-dark">New Discount Code</h3>
          <div className="grid grid-cols-2 gap-md">
            {/* Code */}
            <div>
              <label className="font-baloo text-xs text-text-muted block mb-xs">Code</label>
              <div className="flex gap-xs">
                <input type="text" value={form.code} onChange={e => setForm(p => ({ ...p, code: e.target.value.toUpperCase() }))}
                  placeholder="e.g. SAVE20"
                  className="flex-1 px-sm py-xs rounded-xl border border-divider font-baloo text-sm font-bold tracking-wider focus:outline-none focus:ring-1 focus:ring-primary" />
                <button onClick={generateCode} className="px-sm py-xs rounded-xl border border-divider font-baloo text-xs text-text-muted hover:border-primary">
                  Generate
                </button>
              </div>
            </div>

            {/* Discount value */}
            <div>
              <label className="font-baloo text-xs text-text-muted block mb-xs">Discount</label>
              <div className="flex gap-xs">
                <select value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value as any }))}
                  className="px-sm py-xs rounded-xl border border-divider font-baloo text-sm focus:outline-none">
                  <option value="percent">% Off</option>
                  <option value="flat">₹ Off</option>
                </select>
                <input type="number" value={form.value} onChange={e => setForm(p => ({ ...p, value: e.target.value as any }))}
                  min={1} max={form.type === 'percent' ? 100 : undefined}
                  className="flex-1 px-sm py-xs rounded-xl border border-divider font-baloo text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
              </div>
            </div>

            {/* Applies to */}
            <div>
              <label className="font-baloo text-xs text-text-muted block mb-xs">Applies To</label>
              <select value={form.appliesTo} onChange={e => setForm(p => ({ ...p, appliesTo: e.target.value as any }))}
                className="w-full px-sm py-xs rounded-xl border border-divider font-baloo text-sm focus:outline-none">
                {Object.entries(APPLIES_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>

            {/* Max uses */}
            <div>
              <label className="font-baloo text-xs text-text-muted block mb-xs">Max Uses (blank = unlimited)</label>
              <input type="number" value={form.maxUses} onChange={e => setForm(p => ({ ...p, maxUses: e.target.value }))}
                placeholder="Unlimited" min={1}
                className="w-full px-sm py-xs rounded-xl border border-divider font-baloo text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
            </div>

            {/* Valid From */}
            <div>
              <label className="font-baloo text-xs text-text-muted block mb-xs">Valid From (blank = now)</label>
              <input type="date" value={form.validFromStr} onChange={e => setForm(p => ({ ...p, validFromStr: e.target.value }))}
                className="w-full px-sm py-xs rounded-xl border border-divider font-baloo text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
            </div>

            {/* Expires */}
            <div>
              <label className="font-baloo text-xs text-text-muted block mb-xs">Expires At (blank = never)</label>
              <input type="date" value={form.expiresAt} onChange={e => setForm(p => ({ ...p, expiresAt: e.target.value }))}
                className="w-full px-sm py-xs rounded-xl border border-divider font-baloo text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
            </div>

            {/* Project */}
            <div>
              <label className="font-baloo text-xs text-text-muted block mb-xs">Project Scope (optional)</label>
              <select value={form.projectId} onChange={e => setForm(p => ({ ...p, projectId: e.target.value, schoolId: '' }))}
                className="w-full px-sm py-xs rounded-xl border border-divider font-baloo text-sm focus:outline-none">
                <option value="">— Global (no scope) —</option>
                {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>

            {/* School */}
            <div>
              <label className="font-baloo text-xs text-text-muted block mb-xs">School Scope (optional)</label>
              <select value={form.schoolId} onChange={e => setForm(p => ({ ...p, schoolId: e.target.value }))}
                className="w-full px-sm py-xs rounded-xl border border-divider font-baloo text-sm focus:outline-none">
                <option value="">— No school —</option>
                {formSchools.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>

            {/* Note */}
            <div className="col-span-2">
              <label className="font-baloo text-xs text-text-muted block mb-xs">Internal Note</label>
              <input type="text" value={form.note} onChange={e => setForm(p => ({ ...p, note: e.target.value }))}
                placeholder="e.g. Launch promo, influencer code…"
                className="w-full px-sm py-xs rounded-xl border border-divider font-baloo text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
            </div>
          </div>

          {/* Preview */}
          {form.code && (
            <div className="bg-lavender-light/40 rounded-xl p-sm font-baloo text-sm text-primary font-semibold">
              Code <span className="tracking-widest">{form.code}</span> gives{' '}
              {form.type === 'percent' ? `${form.value}% off` : `₹${form.value} off`}{' '}
              {APPLIES_LABELS[form.appliesTo].toLowerCase()} plans
              {form.maxUses ? `, up to ${form.maxUses} uses` : ''}
              {form.validFromStr ? `, from ${new Date(form.validFromStr).toLocaleDateString()}` : ''}
              {form.expiresAt ? ` until ${new Date(form.expiresAt).toLocaleDateString()}` : ''}
              {form.schoolId ? `, for ${schoolMap.get(form.schoolId) ?? 'selected school'}` : form.projectId ? `, for ${projectMap.get(form.projectId) ?? 'selected project'}` : ''}.
            </div>
          )}

          <div className="flex gap-sm justify-end">
            <button onClick={() => { setShowForm(false); setForm(EMPTY_FORM()); }}
              className="px-lg py-sm rounded-xl border border-divider font-baloo font-semibold text-sm text-text-muted">Cancel</button>
            <button onClick={handleCreate} disabled={saving || !form.code.trim()}
              className="px-lg py-sm rounded-xl bg-primary text-white font-baloo font-bold text-sm disabled:opacity-50">
              {saving ? 'Creating…' : 'Create Code'}
            </button>
          </div>
        </div>
      )}

      {/* Discounts table */}
      {loading ? (
        <div className="text-center py-xl font-baloo text-text-muted">Loading…</div>
      ) : discounts.length === 0 ? (
        <div className="bg-white rounded-2xl border border-divider p-xl text-center">
          <span className="text-5xl block mb-md">🏷️</span>
          <p className="font-baloo text-text-muted">No discount codes yet. Create one above.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-divider shadow-sm overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-divider">
              <tr>
                {['Code', 'Discount', 'Applies To', 'Uses', 'Valid From', 'Expires', 'Scope', 'Note', 'Status'].map(h => (
                  <th key={h} className="px-md py-sm text-left font-baloo font-semibold text-xs text-text-muted whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(d => {
                const scope = scopeLabel(d);
                return (
                  <tr key={d.id} className="border-b border-divider last:border-0 hover:bg-gray-50/50">
                    <td className="px-md py-sm font-baloo font-bold text-sm tracking-widest text-text-dark">{d.code}</td>
                    <td className="px-md py-sm font-baloo text-sm text-text-dark whitespace-nowrap">
                      {d.type === 'percent' ? `${d.value}%` : `₹${d.value}`} off
                    </td>
                    <td className="px-md py-sm">
                      <span className="px-xs py-0.5 bg-lavender-light text-primary rounded-full font-baloo text-xs font-semibold">
                        {APPLIES_LABELS[d.appliesTo]}
                      </span>
                    </td>
                    <td className="px-md py-sm font-baloo text-sm text-text-muted whitespace-nowrap">
                      {d.usedCount}{d.maxUses ? ` / ${d.maxUses}` : ''}
                    </td>
                    <td className="px-md py-sm font-baloo text-sm text-text-muted whitespace-nowrap">{formatDate(d.validFrom)}</td>
                    <td className="px-md py-sm font-baloo text-sm text-text-muted whitespace-nowrap">{formatDate(d.expiresAt)}</td>
                    <td className="px-md py-sm">
                      {scope ? (
                        <span className="px-xs py-0.5 bg-mint-light text-secondary rounded-full font-baloo text-xs font-semibold truncate max-w-[100px] block">
                          {scope}
                        </span>
                      ) : (
                        <span className="px-xs py-0.5 bg-gray-100 text-gray-400 rounded-full font-baloo text-xs">Global</span>
                      )}
                    </td>
                    <td className="px-md py-sm font-baloo text-xs text-text-muted max-w-[100px] truncate">{d.note || '—'}</td>
                    <td className="px-md py-sm">
                      {can('discounts.toggle') ? (
                        <button onClick={() => toggleActive(d)}
                          className={`px-sm py-0.5 rounded-full font-baloo font-semibold text-xs transition-colors ${
                            d.active ? 'bg-success/10 text-success hover:bg-success/20' : 'bg-gray-100 text-text-muted hover:bg-gray-200'
                          }`}>
                          {d.active ? 'Active' : 'Inactive'}
                        </button>
                      ) : (
                        <span className={`px-sm py-0.5 rounded-full font-baloo font-semibold text-xs ${d.active ? 'bg-success/10 text-success' : 'bg-gray-100 text-text-muted'}`}>
                          {d.active ? 'Active' : 'Inactive'}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
