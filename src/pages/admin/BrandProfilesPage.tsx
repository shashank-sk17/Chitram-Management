import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  collection, getDocs, addDoc, updateDoc, doc, serverTimestamp,
} from 'firebase/firestore';
import { db } from '../../config/firebase';
import { usePermission } from '../../hooks/usePermission';

interface BrandProfile {
  id: string;
  brandId: string;
  appName?: string;
  tagline?: string;
  primaryColor?: string;
  secondaryColor?: string;
  accentColor?: string;
  backgroundColor?: string;
  logoUrl?: string;
  mascotUrl?: string;
  splashLogoUrl?: string;
  backgroundPatternUrl?: string;
  fontFamily?: 'Baloo2' | 'Fredoka';
  buttonRadius?: number;
  cardStyle?: 'soft' | 'glass' | 'bold';
  hidePremiumUpsell?: boolean;
  createdAt?: any;
}

const DEFAULTS: Omit<BrandProfile, 'id' | 'createdAt'> = {
  brandId: '',
  appName: '',
  tagline: '',
  primaryColor: '#7C81FF',
  secondaryColor: '#00BBAE',
  accentColor: '#FF9B24',
  backgroundColor: '#FFF8EB',
  logoUrl: '',
  mascotUrl: '',
  splashLogoUrl: '',
  backgroundPatternUrl: '',
  fontFamily: 'Baloo2',
  buttonRadius: 999,
  cardStyle: 'soft',
  hidePremiumUpsell: false,
};

function ColorSwatch({ color }: { color?: string }) {
  if (!color) return null;
  return (
    <span
      className="inline-block w-5 h-5 rounded-full border border-divider shadow-sm flex-shrink-0"
      style={{ backgroundColor: color }}
    />
  );
}

// Mini preview of the HomeScreen header
function BrandPreview({ profile }: { profile: Partial<BrandProfile> }) {
  return (
    <div
      className="rounded-2xl overflow-hidden border border-divider shadow-md"
      style={{ background: profile.backgroundColor ?? '#FFF8EB' }}
    >
      {/* Simulated status bar */}
      <div className="h-5 bg-black/5" />

      {/* Header */}
      <div className="flex items-center gap-sm px-md py-sm" style={{ background: profile.backgroundColor ?? '#FFF8EB' }}>
        <div className="w-9 h-9 rounded-full bg-white shadow flex items-center justify-center text-sm">☰</div>
        <div className="flex-1 flex items-center gap-xs">
          {profile.logoUrl ? (
            <img src={profile.logoUrl} alt="logo" className="h-7 w-auto object-contain rounded" />
          ) : null}
          <div>
            {profile.appName ? (
              <p className="font-baloo text-[10px] font-semibold leading-tight" style={{ color: profile.primaryColor ?? '#7C81FF' }}>
                {profile.appName}
              </p>
            ) : (
              <p className="font-baloo text-[10px] text-gray-400 leading-tight">Hello,</p>
            )}
            <p className="font-baloo text-sm font-bold leading-tight text-gray-800">Friend!</p>
          </div>
        </div>
        <div className="flex items-center gap-1 bg-white rounded-full px-2 py-1 shadow text-xs font-baloo font-bold text-orange-500">
          🔥 3
        </div>
      </div>

      {/* Mascot zone */}
      {profile.mascotUrl ? (
        <div className="flex items-center gap-sm px-md pb-sm">
          <img src={profile.mascotUrl} alt="mascot" className="h-16 w-auto object-contain" />
          {profile.tagline ? (
            <p className="font-baloo font-bold text-sm" style={{ color: profile.primaryColor ?? '#7C81FF' }}>{profile.tagline}</p>
          ) : null}
        </div>
      ) : null}

      {/* Mock card */}
      <div
        className="mx-md mb-md p-md rounded-xl border shadow-sm"
        style={{
          borderColor: profile.primaryColor ?? '#7C81FF',
          borderRadius: profile.cardStyle === 'bold' ? 8 : profile.cardStyle === 'glass' ? 16 : 12,
        }}
      >
        <div className="flex items-center gap-sm">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center text-xl"
            style={{ background: (profile.primaryColor ?? '#7C81FF') + '20' }}>
            📖
          </div>
          <div>
            <p className="font-baloo font-bold text-sm text-gray-800">Level 1</p>
            <p className="font-baloo text-xs text-gray-400">Animals</p>
          </div>
        </div>
        <div
          className="mt-sm w-full py-2 flex items-center justify-center font-baloo font-bold text-xs text-white"
          style={{
            backgroundColor: profile.primaryColor ?? '#7C81FF',
            borderRadius: profile.buttonRadius ?? 999,
          }}
        >
          Start Learning →
        </div>
      </div>
    </div>
  );
}

export default function BrandProfilesPage() {
  const { can } = usePermission();
  const [profiles, setProfiles] = useState<BrandProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [editProfile, setEditProfile] = useState<Partial<BrandProfile> | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'identity' | 'colors' | 'assets' | 'style'>('identity');

  const loadProfiles = async () => {
    setLoading(true);
    try {
      const snap = await getDocs(collection(db, 'brandProfiles'));
      setProfiles(snap.docs.map(d => ({ id: d.id, ...d.data() } as BrandProfile)));
    } catch (err) {
      console.error('Failed to load brand profiles:', err);
    }
    setLoading(false);
  };

  useEffect(() => { loadProfiles(); }, []);

  const openNew = () => {
    setEditProfile({ ...DEFAULTS });
    setIsNew(true);
    setActiveTab('identity');
  };

  const openEdit = (p: BrandProfile) => {
    setEditProfile({ ...p });
    setIsNew(false);
    setActiveTab('identity');
  };

  const handleSave = async () => {
    if (!editProfile) return;
    if (!editProfile.brandId?.trim()) { alert('Brand ID is required'); return; }
    setSaving(true);
    try {
      const data = { ...editProfile };
      delete (data as any).id;
      if (isNew) {
        const ref = await addDoc(collection(db, 'brandProfiles'), { ...data, createdAt: serverTimestamp() });
        setProfiles(prev => [...prev, { id: ref.id, ...data } as BrandProfile]);
      } else if (editProfile.id) {
        await updateDoc(doc(db, 'brandProfiles', editProfile.id), { ...data, updatedAt: serverTimestamp() });
        setProfiles(prev => prev.map(p => p.id === editProfile.id ? { ...p, ...data } as BrandProfile : p));
      }
      setEditProfile(null);
    } catch (err) {
      console.error('Failed to save brand profile:', err);
      alert('Failed to save. Check console for details.');
    }
    setSaving(false);
  };

  const setField = <K extends keyof BrandProfile>(key: K, value: BrandProfile[K]) => {
    setEditProfile(prev => prev ? { ...prev, [key]: value } : prev);
  };

  return (
    <div className="space-y-lg">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-baloo font-extrabold text-xxl text-text-dark">Brand Profiles 🎨</h1>
          <p className="font-baloo text-text-muted">Configure partner brand takeovers (Disney-style full-app theming)</p>
        </div>
        {can('brandProfiles.create') && (
          <button
            onClick={openNew}
            className="px-lg py-sm bg-primary text-white font-baloo font-bold text-sm rounded-xl hover:bg-primary/90 transition-colors shadow-md"
          >
            + New Brand Profile
          </button>
        )}
      </div>

      {/* Profile grid */}
      {loading ? (
        <div className="text-center py-xl font-baloo text-text-muted">Loading brand profiles…</div>
      ) : profiles.length === 0 ? (
        <div className="bg-white rounded-2xl border border-divider p-xl text-center">
          <p className="text-4xl mb-md">🎨</p>
          <p className="font-baloo font-bold text-lg text-text-dark mb-xs">No brand profiles yet</p>
          <p className="font-baloo text-sm text-text-muted mb-md">Create a brand profile to enable Disney-style app theming for a class or partner.</p>
          <button onClick={openNew} className="px-lg py-sm bg-primary text-white font-baloo font-bold text-sm rounded-xl">
            Create First Profile
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-md">
          {profiles.map(p => (
            <div key={p.id} className="bg-white rounded-2xl border border-divider p-md shadow-sm space-y-md">
              {/* Preview */}
              <BrandPreview profile={p} />

              {/* Meta */}
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-baloo font-bold text-md text-text-dark">{p.appName || p.brandId}</p>
                  <p className="font-baloo text-xs text-text-muted">{p.brandId}</p>
                  {p.tagline && <p className="font-baloo text-xs text-text-muted italic">{p.tagline}</p>}
                </div>
                <div className="flex items-center gap-xs">
                  {p.primaryColor && <ColorSwatch color={p.primaryColor} />}
                  {p.secondaryColor && <ColorSwatch color={p.secondaryColor} />}
                  {p.accentColor && <ColorSwatch color={p.accentColor} />}
                </div>
              </div>

              <div className="flex gap-xs flex-wrap text-xs">
                {p.hidePremiumUpsell && (
                  <span className="px-sm py-0.5 bg-mint-light text-secondary font-baloo font-semibold rounded-full">No Paywall</span>
                )}
                {p.fontFamily && (
                  <span className="px-sm py-0.5 bg-lavender-light text-primary font-baloo font-semibold rounded-full">{p.fontFamily}</span>
                )}
                {p.mascotUrl && (
                  <span className="px-sm py-0.5 bg-amber-50 text-amber-600 font-baloo font-semibold rounded-full">Has Mascot</span>
                )}
              </div>

              {/* Profile ID (for copying into class docs) */}
              <div className="bg-gray-50 rounded-lg px-sm py-xs">
                <p className="font-baloo text-[10px] text-text-muted mb-0.5">Profile ID (copy to classDoc.brandProfileId)</p>
                <p className="font-mono text-xs text-text-dark break-all select-all">{p.id}</p>
              </div>

              {can('brandProfiles.edit') && (
                <button
                  onClick={() => openEdit(p)}
                  className="w-full py-sm rounded-xl bg-lavender-light text-primary font-baloo font-bold text-sm hover:bg-primary hover:text-white transition-colors"
                >
                  Edit Profile
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Edit Modal */}
      <AnimatePresence>
        {editProfile && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/40 z-50"
              onClick={() => setEditProfile(null)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="fixed inset-x-4 top-4 bottom-4 md:inset-x-auto md:left-1/2 md:-translate-x-1/2 md:w-[900px] bg-white rounded-2xl shadow-2xl z-50 flex overflow-hidden"
            >
              {/* Left: Form */}
              <div className="flex-1 flex flex-col min-w-0">
                {/* Modal header */}
                <div className="px-lg py-md border-b border-divider bg-lavender-light/30">
                  <div className="flex items-center justify-between mb-sm">
                    <h2 className="font-baloo font-bold text-lg text-text-dark">
                      {isNew ? 'New Brand Profile' : `Edit: ${editProfile.brandId}`}
                    </h2>
                    <button onClick={() => setEditProfile(null)} className="w-8 h-8 rounded-full bg-white/60 flex items-center justify-center text-text-muted">✕</button>
                  </div>
                  <div className="flex gap-xs">
                    {(['identity', 'colors', 'assets', 'style'] as const).map(t => (
                      <button
                        key={t}
                        onClick={() => setActiveTab(t)}
                        className={`px-md py-xs rounded-lg font-baloo font-semibold text-sm capitalize transition-all ${
                          activeTab === t ? 'bg-white text-primary shadow-sm' : 'text-text-muted hover:text-text-dark'
                        }`}
                      >
                        {t === 'identity' ? '🆔 Identity' : t === 'colors' ? '🎨 Colors' : t === 'assets' ? '🖼 Assets' : '✨ Style'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Modal body */}
                <div className="flex-1 overflow-y-auto p-lg space-y-md">
                  {activeTab === 'identity' && (
                    <>
                      <Field label="Brand ID *" hint="Unique identifier, e.g. 'disney', 'peppa_pig'">
                        <input value={editProfile.brandId ?? ''} onChange={e => setField('brandId', e.target.value)} className={INPUT} placeholder="disney" />
                      </Field>
                      <Field label="App Name" hint="Shown in header instead of 'Chitram'">
                        <input value={editProfile.appName ?? ''} onChange={e => setField('appName', e.target.value)} className={INPUT} placeholder="Learn with Disney" />
                      </Field>
                      <Field label="Tagline" hint="Shown below mascot on HomeScreen">
                        <input value={editProfile.tagline ?? ''} onChange={e => setField('tagline', e.target.value)} className={INPUT} placeholder="Learning is a magical adventure!" />
                      </Field>
                      <div className="flex items-center gap-sm bg-gray-50 rounded-xl p-md">
                        <input
                          type="checkbox"
                          id="hidePremium"
                          checked={!!editProfile.hidePremiumUpsell}
                          onChange={e => setField('hidePremiumUpsell', e.target.checked)}
                          className="w-4 h-4 accent-primary"
                        />
                        <div>
                          <label htmlFor="hidePremium" className="font-baloo font-semibold text-sm text-text-dark cursor-pointer">Hide Premium Upsell</label>
                          <p className="font-baloo text-xs text-text-muted">For school accounts — shows "managed by school" instead of paywall</p>
                        </div>
                      </div>
                    </>
                  )}

                  {activeTab === 'colors' && (
                    <>
                      <ColorField label="Primary Color" value={editProfile.primaryColor ?? '#7C81FF'} onChange={v => setField('primaryColor', v)} hint="Buttons, highlights, headers" />
                      <ColorField label="Secondary Color" value={editProfile.secondaryColor ?? '#00BBAE'} onChange={v => setField('secondaryColor', v)} hint="Secondary accents, checkmarks" />
                      <ColorField label="Accent Color" value={editProfile.accentColor ?? '#FF9B24'} onChange={v => setField('accentColor', v)} hint="Badges, streak, call-to-action" />
                      <ColorField label="Background Color" value={editProfile.backgroundColor ?? '#FFF8EB'} onChange={v => setField('backgroundColor', v)} hint="App background (replaces cream)" />
                    </>
                  )}

                  {activeTab === 'assets' && (
                    <>
                      <Field label="Logo URL" hint="Firebase Storage URL — shown in HomeScreen header (40×40px)">
                        <input value={editProfile.logoUrl ?? ''} onChange={e => setField('logoUrl', e.target.value)} className={INPUT} placeholder="https://storage.googleapis.com/..." />
                      </Field>
                      <Field label="Mascot URL" hint="Brand character image (PNG, ~120px tall) — shown below XP strip on HomeScreen">
                        <input value={editProfile.mascotUrl ?? ''} onChange={e => setField('mascotUrl', e.target.value)} className={INPUT} placeholder="https://storage.googleapis.com/..." />
                      </Field>
                      <Field label="Splash Logo URL" hint="Large logo/image shown on branded loading overlay">
                        <input value={editProfile.splashLogoUrl ?? ''} onChange={e => setField('splashLogoUrl', e.target.value)} className={INPUT} placeholder="https://storage.googleapis.com/..." />
                      </Field>
                      <Field label="Background Pattern URL" hint="Tile-repeating pattern PNG (e.g. stars, Mickey ears) — shown at 8% opacity">
                        <input value={editProfile.backgroundPatternUrl ?? ''} onChange={e => setField('backgroundPatternUrl', e.target.value)} className={INPUT} placeholder="https://storage.googleapis.com/..." />
                      </Field>
                    </>
                  )}

                  {activeTab === 'style' && (
                    <>
                      <Field label="Font Family">
                        <div className="flex gap-sm">
                          {(['Baloo2', 'Fredoka'] as const).map(f => (
                            <button
                              key={f}
                              onClick={() => setField('fontFamily', f)}
                              className={`px-md py-sm rounded-xl font-baloo font-semibold text-sm border-2 transition-all ${
                                editProfile.fontFamily === f ? 'border-primary bg-lavender-light text-primary' : 'border-divider text-text-muted'
                              }`}
                            >
                              {f}
                            </button>
                          ))}
                        </div>
                      </Field>
                      <Field label="Button Radius" hint="999 = pill, 12 = rounded, 4 = sharp corners">
                        <div className="flex items-center gap-sm">
                          <input
                            type="range" min={0} max={999} step={1}
                            value={editProfile.buttonRadius ?? 999}
                            onChange={e => setField('buttonRadius', Number(e.target.value))}
                            className="flex-1"
                          />
                          <span className="font-mono text-sm w-12 text-right">{editProfile.buttonRadius ?? 999}</span>
                        </div>
                        <div className="flex gap-xs mt-xs">
                          {[4, 12, 24, 999].map(r => (
                            <button key={r} onClick={() => setField('buttonRadius', r)}
                              className={`px-sm py-xs text-xs font-baloo rounded-lg border transition-all ${editProfile.buttonRadius === r ? 'border-primary text-primary bg-lavender-light' : 'border-divider text-text-muted'}`}>
                              {r === 999 ? 'Pill' : r === 4 ? 'Sharp' : r === 12 ? 'Rounded' : 'Large'}
                            </button>
                          ))}
                        </div>
                      </Field>
                      <Field label="Card Style">
                        <div className="flex gap-sm">
                          {(['soft', 'glass', 'bold'] as const).map(s => (
                            <button key={s} onClick={() => setField('cardStyle', s)}
                              className={`px-md py-sm rounded-xl font-baloo font-semibold text-sm border-2 capitalize transition-all ${
                                editProfile.cardStyle === s ? 'border-secondary bg-mint-light text-secondary' : 'border-divider text-text-muted'
                              }`}>
                              {s}
                            </button>
                          ))}
                        </div>
                      </Field>
                    </>
                  )}
                </div>

                {/* Footer */}
                <div className="px-lg py-md border-t border-divider flex items-center justify-between">
                  <button onClick={() => setEditProfile(null)} className="font-baloo font-semibold text-sm text-text-muted hover:text-text-dark">
                    Cancel
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="px-lg py-sm bg-primary text-white font-baloo font-bold text-sm rounded-xl hover:bg-primary/90 shadow-md disabled:opacity-50"
                  >
                    {saving ? 'Saving…' : isNew ? 'Create Profile' : 'Save Changes'}
                  </button>
                </div>
              </div>

              {/* Right: Live Preview */}
              <div className="w-[280px] border-l border-divider bg-gray-50 p-md flex flex-col">
                <p className="font-baloo font-bold text-sm text-text-dark mb-sm">Live Preview</p>
                <div className="flex-1 flex items-start justify-center pt-md">
                  <div className="w-full max-w-[240px]">
                    <BrandPreview profile={editProfile} />
                  </div>
                </div>
                <p className="font-baloo text-xs text-text-muted text-center mt-md">Preview updates as you edit</p>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Small helpers ─────────────────────────────────────────────────────────────
const INPUT = 'w-full px-sm py-xs rounded-lg border border-divider font-baloo text-sm focus:outline-none focus:ring-1 focus:ring-primary bg-white';

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="font-baloo font-semibold text-sm text-text-dark block mb-xs">{label}</label>
      {hint && <p className="font-baloo text-xs text-text-muted mb-xs">{hint}</p>}
      {children}
    </div>
  );
}

function ColorField({ label, value, onChange, hint }: { label: string; value: string; onChange: (v: string) => void; hint?: string }) {
  return (
    <div>
      <label className="font-baloo font-semibold text-sm text-text-dark block mb-xs">{label}</label>
      {hint && <p className="font-baloo text-xs text-text-muted mb-xs">{hint}</p>}
      <div className="flex items-center gap-sm">
        <input type="color" value={value} onChange={e => onChange(e.target.value)} className="w-10 h-10 rounded-lg border border-divider cursor-pointer" />
        <input type="text" value={value} onChange={e => onChange(e.target.value)} className={INPUT + ' flex-1 font-mono'} placeholder="#7C81FF" />
      </div>
    </div>
  );
}
