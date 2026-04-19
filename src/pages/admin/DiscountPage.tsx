import { useState, useEffect } from 'react';
import { collection, getDocs, Timestamp, query, orderBy } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../../config/firebase';
import { useAuthStore } from '../../stores/authStore';
import { usePermission } from '../../hooks/usePermission';

interface DiscountDoc {
  code: string;
  type: 'percent' | 'flat';
  value: number;           // percent (0-100) or flat ₹ off
  appliesTo: 'all' | 'monthly' | 'yearly' | 'lifetime' | 'level';
  maxUses: number | null;  // null = unlimited
  usedCount: number;
  active: boolean;
  expiresAt: Timestamp | null;
  createdAt: Timestamp;
  createdBy: string;
  note: string;
}
type DiscountWithId = { id: string } & DiscountDoc;

const APPLIES_LABELS: Record<string, string> = {
  all: 'All Plans',
  monthly: 'Monthly',
  yearly: 'Yearly',
  lifetime: 'Lifetime',
  level: 'Per-Level',
};

function formatExpiry(ts: Timestamp | null) {
  if (!ts) return 'Never';
  return ts.toDate().toLocaleDateString();
}

const EMPTY_FORM = () => ({
  code: '',
  type: 'percent' as 'percent' | 'flat',
  value: 10,
  appliesTo: 'all' as DiscountDoc['appliesTo'],
  maxUses: '' as string,
  expiresAt: '',
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

  const load = async () => {
    setLoading(true);
    try {
      const snap = await getDocs(query(collection(db, 'discounts'), orderBy('createdAt', 'desc')));
      setDiscounts(snap.docs.map(d => ({ id: d.id, ...(d.data() as DiscountDoc) })));
    } catch {}
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const toggleActive = async (d: DiscountWithId) => {
    const fn = httpsCallable(functions, 'adminToggleDiscount');
    await fn({ discountId: d.id, active: !d.active });
    setDiscounts(prev => prev.map(x => x.id === d.id ? { ...x, active: !x.active } : x));
  };

  const generateCode = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const code = Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    setForm(p => ({ ...p, code }));
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
        expiresAt: form.expiresAt ? new Date(form.expiresAt).toISOString() : null,
        note: form.note,
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
        expiresAt: form.expiresAt ? Timestamp.fromDate(new Date(form.expiresAt)) : null,
        createdAt: Timestamp.now(),
        createdBy: user.uid,
        note: form.note,
      };
      setDiscounts(prev => [newDiscount, ...prev]);
      setShowForm(false);
      setForm(EMPTY_FORM());
    } catch (e: any) {
      alert(e?.message ?? 'Failed to create discount');
    }
    setSaving(false);
  };

  return (
    <div className="space-y-lg">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-baloo font-extrabold text-xxl text-text-dark">Discount Codes</h1>
          <p className="font-baloo text-text-muted">Manage promo codes and plan discounts</p>
        </div>
        {can('discounts.create') && (
          <button
            onClick={() => setShowForm(true)}
            className="px-lg py-sm rounded-xl bg-primary text-white font-baloo font-bold text-sm hover:bg-primary/90 transition-colors shadow-sm"
          >
            + New Code
          </button>
        )}
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
                <input
                  type="text"
                  value={form.code}
                  onChange={e => setForm(p => ({ ...p, code: e.target.value.toUpperCase() }))}
                  placeholder="e.g. SAVE20"
                  className="flex-1 px-sm py-xs rounded-xl border border-divider font-baloo text-sm font-bold tracking-wider focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <button onClick={generateCode} className="px-sm py-xs rounded-xl border border-divider font-baloo text-xs text-text-muted hover:border-primary">
                  Generate
                </button>
              </div>
            </div>

            {/* Discount value */}
            <div>
              <label className="font-baloo text-xs text-text-muted block mb-xs">Discount</label>
              <div className="flex gap-xs">
                <select
                  value={form.type}
                  onChange={e => setForm(p => ({ ...p, type: e.target.value as any }))}
                  className="px-sm py-xs rounded-xl border border-divider font-baloo text-sm focus:outline-none"
                >
                  <option value="percent">% Off</option>
                  <option value="flat">₹ Off</option>
                </select>
                <input
                  type="number"
                  value={form.value}
                  onChange={e => setForm(p => ({ ...p, value: e.target.value as any }))}
                  min={1}
                  max={form.type === 'percent' ? 100 : undefined}
                  className="flex-1 px-sm py-xs rounded-xl border border-divider font-baloo text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>

            {/* Applies to */}
            <div>
              <label className="font-baloo text-xs text-text-muted block mb-xs">Applies To</label>
              <select
                value={form.appliesTo}
                onChange={e => setForm(p => ({ ...p, appliesTo: e.target.value as any }))}
                className="w-full px-sm py-xs rounded-xl border border-divider font-baloo text-sm focus:outline-none"
              >
                {Object.entries(APPLIES_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>

            {/* Max uses */}
            <div>
              <label className="font-baloo text-xs text-text-muted block mb-xs">Max Uses (blank = unlimited)</label>
              <input
                type="number"
                value={form.maxUses}
                onChange={e => setForm(p => ({ ...p, maxUses: e.target.value }))}
                placeholder="Unlimited"
                min={1}
                className="w-full px-sm py-xs rounded-xl border border-divider font-baloo text-sm focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            {/* Expiry */}
            <div>
              <label className="font-baloo text-xs text-text-muted block mb-xs">Expires At (blank = never)</label>
              <input
                type="date"
                value={form.expiresAt}
                onChange={e => setForm(p => ({ ...p, expiresAt: e.target.value }))}
                className="w-full px-sm py-xs rounded-xl border border-divider font-baloo text-sm focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            {/* Note */}
            <div>
              <label className="font-baloo text-xs text-text-muted block mb-xs">Internal Note</label>
              <input
                type="text"
                value={form.note}
                onChange={e => setForm(p => ({ ...p, note: e.target.value }))}
                placeholder="e.g. Launch promo, influencer code…"
                className="w-full px-sm py-xs rounded-xl border border-divider font-baloo text-sm focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>

          {/* Preview */}
          {form.code && (
            <div className="bg-lavender-light/40 rounded-xl p-sm font-baloo text-sm text-primary font-semibold">
              Code <span className="tracking-widest">{form.code}</span> gives{' '}
              {form.type === 'percent' ? `${form.value}% off` : `₹${form.value} off`}{' '}
              {APPLIES_LABELS[form.appliesTo].toLowerCase()} plans
              {form.maxUses ? `, up to ${form.maxUses} uses` : ''}
              {form.expiresAt ? `, expires ${new Date(form.expiresAt).toLocaleDateString()}` : ''}.
            </div>
          )}

          <div className="flex gap-sm justify-end">
            <button onClick={() => { setShowForm(false); setForm(EMPTY_FORM()); }}
              className="px-lg py-sm rounded-xl border border-divider font-baloo font-semibold text-sm text-text-muted">
              Cancel
            </button>
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
                {['Code', 'Discount', 'Applies To', 'Uses', 'Expires', 'Note', 'Status'].map(h => (
                  <th key={h} className="px-md py-sm text-left font-baloo font-semibold text-xs text-text-muted">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {discounts.map(d => (
                <tr key={d.id} className="border-b border-divider last:border-0 hover:bg-gray-50/50">
                  <td className="px-md py-sm font-baloo font-bold text-sm tracking-widest text-text-dark">{d.code}</td>
                  <td className="px-md py-sm font-baloo text-sm text-text-dark">
                    {d.type === 'percent' ? `${d.value}%` : `₹${d.value}`} off
                  </td>
                  <td className="px-md py-sm">
                    <span className="px-xs py-0.5 bg-lavender-light text-primary rounded-full font-baloo text-xs font-semibold">
                      {APPLIES_LABELS[d.appliesTo]}
                    </span>
                  </td>
                  <td className="px-md py-sm font-baloo text-sm text-text-muted">
                    {d.usedCount}{d.maxUses ? ` / ${d.maxUses}` : ''}
                  </td>
                  <td className="px-md py-sm font-baloo text-sm text-text-muted">{formatExpiry(d.expiresAt)}</td>
                  <td className="px-md py-sm font-baloo text-xs text-text-muted max-w-[120px] truncate">{d.note || '—'}</td>
                  <td className="px-md py-sm">
                    {can('discounts.toggle') ? (
                      <button
                        onClick={() => toggleActive(d)}
                        className={`px-sm py-0.5 rounded-full font-baloo font-semibold text-xs transition-colors ${
                          d.active
                            ? 'bg-success/10 text-success hover:bg-success/20'
                            : 'bg-gray-100 text-text-muted hover:bg-gray-200'
                        }`}
                      >
                        {d.active ? 'Active' : 'Inactive'}
                      </button>
                    ) : (
                      <span className={`px-sm py-0.5 rounded-full font-baloo font-semibold text-xs ${
                        d.active ? 'bg-success/10 text-success' : 'bg-gray-100 text-text-muted'
                      }`}>
                        {d.active ? 'Active' : 'Inactive'}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
