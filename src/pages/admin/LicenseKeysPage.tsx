import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from '../../stores/authStore';
import { usePermission } from '../../hooks/usePermission';
import type { LicenseKeyDoc, LanguageCode } from '../../types/firestore';
import {
  getLicenseKeys, createLicenseKey, createLicenseKeysBulk, revokeLicenseKey, exportLicenseKeysCSV,
  type LicenseKeyFilters,
} from '../../services/firebase/licenseKeys';
import { SUPPORTED_LANGUAGES, LANGUAGE_LABELS } from '../../services/firebase/languageCurricula';
import { Timestamp } from 'firebase/firestore';

type KeyWithId = { id: string } & LicenseKeyDoc;

const STATUS_BADGE: Record<string, string> = {
  unused: 'bg-lavender-light text-primary',
  active: 'bg-success/10 text-success',
  expired: 'bg-error/10 text-error',
};

const GRADES = [1, 2, 3, 4, 5];

function formatDate(ts: Timestamp | string | undefined): string {
  if (!ts) return '—';
  if (ts instanceof Timestamp) return ts.toDate().toLocaleDateString();
  return String(ts);
}

export default function LicenseKeysPage() {
  const { user } = useAuthStore();
  const { can } = usePermission();
  const [keys, setKeys] = useState<KeyWithId[]>([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState<LicenseKeyFilters>({});
  const [revoking, setRevoking] = useState<string | null>(null);

  // Create modal state
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({
    grade: 1,
    language: 'te' as LanguageCode,
    count: 1,
    expiresAt: '',
  });
  const [creating, setCreating] = useState(false);

  const load = async (f: LicenseKeyFilters = {}) => {
    setLoading(true);
    try {
      const result = await getLicenseKeys(f);
      setKeys(result);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { load(filters); }, []);

  const applyFilters = () => load(filters);

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
      const expiresDate = createForm.expiresAt ? new Date(createForm.expiresAt) : undefined;
      if (createForm.count === 1) {
        await createLicenseKey(createForm.grade, createForm.language, user.uid, expiresDate);
      } else {
        await createLicenseKeysBulk(createForm.count, createForm.grade, createForm.language, user.uid, expiresDate);
      }
      await load(filters);
      setShowCreate(false);
    } catch {}
    setCreating(false);
  };

  const stats = {
    total: keys.length,
    active: keys.filter(k => k.status === 'active').length,
    unused: keys.filter(k => k.status === 'unused').length,
    expired: keys.filter(k => k.status === 'expired').length,
  };

  return (
    <div className="space-y-lg">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-md">
        <div>
          <h1 className="font-baloo font-extrabold text-xxl text-text-dark">License Keys</h1>
          <p className="font-baloo text-text-muted">Manage app access license keys</p>
        </div>
        <div className="flex items-center gap-sm">
          <button
            onClick={() => exportLicenseKeysCSV(keys)}
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
      <div className="grid grid-cols-2 md:grid-cols-4 gap-md">
        {[
          { label: 'Total Created', value: stats.total, icon: '🔑', color: 'bg-lavender-light' },
          { label: 'Active (Used)', value: stats.active, icon: '✅', color: 'bg-mint-light' },
          { label: 'Unused', value: stats.unused, icon: '⬜', color: 'bg-white' },
          { label: 'Expired', value: stats.expired, icon: '❌', color: 'bg-rose-50' },
        ].map(stat => (
          <div key={stat.label} className={`${stat.color} rounded-2xl border border-divider shadow-sm p-md flex items-center gap-md`}>
            <span className="text-3xl">{stat.icon}</span>
            <div>
              <p className="font-baloo font-extrabold text-xxl text-text-dark leading-none">{stat.value}</p>
              <p className="font-baloo text-xs text-text-muted mt-xs">{stat.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filter bar */}
      <div className="bg-white rounded-2xl border border-divider shadow-sm p-md flex items-end gap-md flex-wrap">
        <div>
          <label className="font-baloo font-bold text-xs text-text-dark block mb-xs">Status</label>
          <select
            value={filters.status ?? ''}
            onChange={e => setFilters(f => ({ ...f, status: (e.target.value || undefined) as any }))}
            className="px-md py-sm rounded-xl border border-divider font-baloo text-sm focus:outline-none focus:ring-2 focus:ring-primary bg-white min-w-[120px]"
          >
            <option value="">All Statuses</option>
            <option value="unused">Unused</option>
            <option value="active">Active</option>
            <option value="expired">Expired</option>
          </select>
        </div>
        <div>
          <label className="font-baloo font-bold text-xs text-text-dark block mb-xs">Grade</label>
          <select
            value={filters.grade ?? ''}
            onChange={e => setFilters(f => ({ ...f, grade: e.target.value ? Number(e.target.value) : undefined }))}
            className="px-md py-sm rounded-xl border border-divider font-baloo text-sm focus:outline-none focus:ring-2 focus:ring-primary bg-white min-w-[110px]"
          >
            <option value="">All Grades</option>
            {GRADES.map(g => <option key={g} value={g}>Grade {g}</option>)}
          </select>
        </div>
        <div>
          <label className="font-baloo font-bold text-xs text-text-dark block mb-xs">Language</label>
          <select
            value={filters.language ?? ''}
            onChange={e => setFilters(f => ({ ...f, language: (e.target.value || undefined) as any }))}
            className="px-md py-sm rounded-xl border border-divider font-baloo text-sm focus:outline-none focus:ring-2 focus:ring-primary bg-white min-w-[130px]"
          >
            <option value="">All Languages</option>
            {SUPPORTED_LANGUAGES.map(l => (
              <option key={l} value={l}>{LANGUAGE_LABELS[l]}</option>
            ))}
          </select>
        </div>
        <button
          onClick={applyFilters}
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
                <th className="px-md py-sm text-left font-baloo font-bold text-sm text-text-dark">Key</th>
                <th className="px-md py-sm text-left font-baloo font-bold text-sm text-text-dark">Grade</th>
                <th className="px-md py-sm text-left font-baloo font-bold text-sm text-text-dark">Language</th>
                <th className="px-md py-sm text-left font-baloo font-bold text-sm text-text-dark">Status</th>
                <th className="px-md py-sm text-left font-baloo font-bold text-sm text-text-dark">Created</th>
                <th className="px-md py-sm text-left font-baloo font-bold text-sm text-text-dark">Expires</th>
                <th className="px-md py-sm text-left font-baloo font-bold text-sm text-text-dark">Used By</th>
                <th className="px-md py-sm text-left font-baloo font-bold text-sm text-text-dark">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-md py-xl text-center font-baloo text-text-muted">Loading…</td>
                </tr>
              ) : keys.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-md py-xl text-center font-baloo text-text-muted">No keys found</td>
                </tr>
              ) : (
                keys.map(k => (
                  <tr key={k.id} className="border-b border-divider hover:bg-lavender-light/20 transition-colors">
                    <td className="px-md py-sm font-baloo font-bold text-sm text-text-dark tracking-widest">{k.key}</td>
                    <td className="px-md py-sm font-baloo text-sm text-text-muted">Grade {k.grade}</td>
                    <td className="px-md py-sm font-baloo text-sm text-text-muted">{LANGUAGE_LABELS[k.language] || k.language}</td>
                    <td className="px-md py-sm">
                      <span className={`px-sm py-0.5 rounded-full font-baloo font-semibold text-xs capitalize ${STATUS_BADGE[k.status] || ''}`}>
                        {k.status}
                      </span>
                    </td>
                    <td className="px-md py-sm font-baloo text-sm text-text-muted">{formatDate(k.createdAt)}</td>
                    <td className="px-md py-sm font-baloo text-sm text-text-muted">{formatDate(k.expiresAt)}</td>
                    <td className="px-md py-sm font-baloo text-sm text-text-muted truncate max-w-[120px]">{k.usedBy || '—'}</td>
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
                ))
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
              className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[480px] bg-white rounded-2xl shadow-2xl z-50 flex flex-col overflow-hidden"
            >
              <div className="px-lg py-md border-b border-divider bg-lavender-light/30 flex items-center justify-between">
                <h2 className="font-baloo font-bold text-lg text-text-dark">Create License Key(s)</h2>
                <button onClick={() => setShowCreate(false)} className="w-8 h-8 rounded-full bg-white/60 flex items-center justify-center">✕</button>
              </div>
              <div className="p-lg space-y-md">
                <div className="grid grid-cols-2 gap-md">
                  <div>
                    <label className="font-baloo font-bold text-sm text-text-dark block mb-xs">Grade</label>
                    <select
                      value={createForm.grade}
                      onChange={e => setCreateForm(f => ({ ...f, grade: Number(e.target.value) }))}
                      className="w-full px-md py-sm rounded-xl border border-divider font-baloo text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                      {GRADES.map(g => <option key={g} value={g}>Grade {g}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="font-baloo font-bold text-sm text-text-dark block mb-xs">Language</label>
                    <select
                      value={createForm.language}
                      onChange={e => setCreateForm(f => ({ ...f, language: e.target.value as LanguageCode }))}
                      className="w-full px-md py-sm rounded-xl border border-divider font-baloo text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                      {SUPPORTED_LANGUAGES.map(l => (
                        <option key={l} value={l}>{LANGUAGE_LABELS[l]}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="font-baloo font-bold text-sm text-text-dark block mb-xs">Count (1–100)</label>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={createForm.count}
                    onChange={e => setCreateForm(f => ({ ...f, count: Math.min(100, Math.max(1, Number(e.target.value))) }))}
                    className="w-full px-md py-sm rounded-xl border border-divider font-baloo text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="font-baloo font-bold text-sm text-text-dark block mb-xs">Expiry Date (optional)</label>
                  <input
                    type="date"
                    value={createForm.expiresAt}
                    onChange={e => setCreateForm(f => ({ ...f, expiresAt: e.target.value }))}
                    className="w-full px-md py-sm rounded-xl border border-divider font-baloo text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>
              <div className="px-lg py-md border-t border-divider flex items-center justify-between">
                <button onClick={() => setShowCreate(false)} className="font-baloo font-semibold text-sm text-text-muted hover:text-text-dark">
                  Cancel
                </button>
                <button
                  onClick={handleCreate}
                  disabled={creating}
                  className="px-lg py-sm bg-primary text-white font-baloo font-bold text-sm rounded-xl shadow-md hover:bg-primary/90 transition-colors disabled:opacity-50"
                >
                  {creating ? 'Creating…' : `Create ${createForm.count > 1 ? `${createForm.count} Keys` : 'Key'}`}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
