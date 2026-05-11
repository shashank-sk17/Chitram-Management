import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence, type Variants } from 'framer-motion';
import { useAuth } from '../../features/auth/hooks/useAuth';
import { useAuthStore } from '../../stores/authStore';
import { Button } from '../../components/common/Button';
import { Springs } from '../../theme/animations';

type Tab = 'signin' | 'register';
type ErrorType = 'credentials' | 'network' | 'permissions' | 'exists' | 'not-found' | 'generic';

interface ParsedError {
  type: ErrorType;
  icon: string;
  title: string;
  message: string;
}

function parseError(raw: string): ParsedError {
  const lower = raw.toLowerCase();
  if (lower.includes('network') || lower.includes('unavailable') || lower.includes('failed to fetch') || lower.includes('timeout'))
    return { type: 'network', icon: '📡', title: 'No Connection', message: 'Check your internet connection and try again.' };
  if (lower.includes('wrong-password') || lower.includes('invalid-credential') || lower.includes('invalid-login') || lower.includes('incorrect'))
    return { type: 'credentials', icon: '🔑', title: 'Wrong Credentials', message: 'The email or password you entered is incorrect.' };
  if (lower.includes('user-not-found') || lower.includes('no user'))
    return { type: 'credentials', icon: '🔑', title: 'Account Not Found', message: 'No account exists with this email. Try joining as a teacher.' };
  if (lower.includes('too-many-requests') || lower.includes('blocked'))
    return { type: 'credentials', icon: '🛑', title: 'Too Many Attempts', message: 'Account temporarily locked. Please wait a moment and try again.' };
  if ((lower.includes('missing') && lower.includes('role')) || lower.includes('invalid or missing role') || lower.includes('denied') || lower.includes('permission'))
    return { type: 'permissions', icon: '🚫', title: 'Access Denied', message: 'Your account does not have management portal access. Contact your administrator.' };
  if (lower.includes('already-exists') || lower.includes('email-already-in-use') || lower.includes('already exists'))
    return { type: 'exists', icon: '📧', title: 'Account Exists', message: 'An account with this email already exists. Try signing in instead.' };
  if (lower.includes('not-found') || lower.includes('school not found') || lower.includes('check the code'))
    return { type: 'not-found', icon: '🏫', title: 'School Not Found', message: 'No school matches that code. Double-check with your administrator.' };
  if (lower.includes('weak-password') || lower.includes('at least 6'))
    return { type: 'generic', icon: '🔒', title: 'Weak Password', message: 'Password must be at least 6 characters long.' };
  return { type: 'generic', icon: '⚠️', title: 'Something Went Wrong', message: raw || 'An unexpected error occurred. Please try again.' };
}

const roleRouteMap: Record<string, string> = {
  admin: '/admin',
  projectAdmin: '/admin',
  teacher: '/teacher',
  pm: '/pm',
  principal: '/principal',
  contentWriter: '/writer',
  contentReviewer: '/reviewer',
};

const shakeVariants: Variants = {
  shake: { x: [0, -12, 12, -8, 8, -4, 4, 0], transition: { duration: 0.5 } },
};
const errorVariants: Variants = {
  hidden: { opacity: 0, y: -8, scale: 0.95 },
  visible: { opacity: 1, y: 0, scale: 1, transition: { type: 'spring', ...Springs.snappy } },
  exit: { opacity: 0, y: -8, scale: 0.95, transition: { duration: 0.15 } },
};
const tabContentVariants: Variants = {
  hidden: { opacity: 0, x: 20 },
  visible: { opacity: 1, x: 0, transition: { type: 'spring', ...Springs.gentle } },
  exit: { opacity: 0, x: -20, transition: { duration: 0.15 } },
};

const SIDEBAR_BG = '#1a1c42';

// Decorative dots for the left panel
const DOTS = [
  { top: '12%', left: '8%', size: 80, opacity: 0.07 },
  { top: '60%', left: '4%', size: 140, opacity: 0.05 },
  { top: '30%', right: '6%', size: 60, opacity: 0.09 },
  { top: '75%', right: '10%', size: 100, opacity: 0.06 },
  { top: '5%', right: '18%', size: 40, opacity: 0.1 },
];

export default function LoginPage() {
  const [activeTab, setActiveTab] = useState<Tab>('signin');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [shakeKey, setShakeKey] = useState(0);

  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regSchoolCode, setRegSchoolCode] = useState('');
  const [regError, setRegError] = useState('');
  const [regShakeKey, setRegShakeKey] = useState(0);

  const { login, register, loading } = useAuth();
  const { loginError, setLoginError } = useAuthStore();
  const navigate = useNavigate();

  useEffect(() => {
    if (loginError) {
      setError(loginError);
      setShakeKey(k => k + 1);
      setLoginError(null);
    }
  }, []);

  function triggerShake(isReg: boolean) {
    if (isReg) setRegShakeKey(k => k + 1);
    else setShakeKey(k => k + 1);
  }

  async function handleLogin() {
    setError('');
    try {
      const claims = await login(email, password);
      navigate(roleRouteMap[claims.role] || '/denied');
    } catch (err: any) {
      setError(err.message || 'Failed to sign in');
      triggerShake(false);
    }
  }

  async function handleRegister() {
    setRegError('');
    if (!regName.trim()) { setRegError('Please enter your name'); triggerShake(true); return; }
    if (!regEmail.trim()) { setRegError('Please enter your email'); triggerShake(true); return; }
    if (regPassword.length < 6) { setRegError('Password must be at least 6 characters'); triggerShake(true); return; }
    if (!regSchoolCode.trim()) { setRegError('Please enter your school code'); triggerShake(true); return; }
    try {
      const claims = await register(regName.trim(), regEmail.trim().toLowerCase(), regPassword, regSchoolCode.trim());
      navigate(roleRouteMap[claims.role] || '/denied');
    } catch (err: any) {
      setRegError(err.message || 'Failed to register');
      triggerShake(true);
    }
  }

  function switchTab(tab: Tab) {
    setActiveTab(tab);
    setError('');
    setRegError('');
  }

  const currentError = activeTab === 'signin' ? error : regError;
  const parsed = currentError ? parseError(currentError) : null;

  return (
    <div className="min-h-screen min-h-[100dvh] flex">

      {/* ── Left panel — brand ───────────────────────────────────────────── */}
      <div
        className="hidden lg:flex flex-col justify-between w-[420px] xl:w-[480px] flex-shrink-0 relative overflow-hidden p-xl"
        style={{ background: SIDEBAR_BG }}
      >
        {/* Decorative circles */}
        {DOTS.map((d, i) => (
          <div
            key={i}
            className="absolute rounded-full pointer-events-none"
            style={{
              width: d.size,
              height: d.size,
              top: d.top,
              left: (d as any).left,
              right: (d as any).right,
              background: `rgba(124,129,255,${d.opacity})`,
              border: `1px solid rgba(124,129,255,${d.opacity * 2})`,
            }}
          />
        ))}

        {/* Logo */}
        <motion.div
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', ...Springs.gentle, delay: 0.1 }}
        >
          <div className="flex items-center gap-sm">
            <div
              className="w-11 h-11 rounded-xl flex items-center justify-center text-2xl"
              style={{ background: 'rgba(124,129,255,0.2)', border: '1px solid rgba(124,129,255,0.35)' }}
            >
              🎨
            </div>
            <div>
              <p className="font-baloo font-extrabold text-lg text-white leading-tight">chitram</p>
              <p className="font-baloo text-xs leading-tight" style={{ color: 'rgba(124,129,255,0.8)' }}>management</p>
            </div>
          </div>
        </motion.div>

        {/* Hero text */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', ...Springs.gentle, delay: 0.2 }}
          className="flex-1 flex flex-col justify-center"
        >
          <p
            className="font-baloo font-extrabold leading-tight mb-md"
            style={{ fontSize: 38, color: 'white' }}
          >
            Kids learn words<br />
            by <span style={{ color: '#FF9B24' }}>drawing</span> them.
          </p>
          <p className="font-baloo text-md" style={{ color: 'rgba(255,255,255,0.45)' }}>
            Manage content, curriculum, schools,<br />and teachers — all in one place.
          </p>
        </motion.div>

        {/* Role list */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="space-y-xs"
        >
          {[
            { icon: '🛡️', label: 'Admins' },
            { icon: '📝', label: 'Content Writers' },
            { icon: '👨‍🏫', label: 'Teachers' },
            { icon: '🏫', label: 'School Principals' },
          ].map(r => (
            <div key={r.label} className="flex items-center gap-sm">
              <span className="text-sm">{r.icon}</span>
              <span className="font-baloo text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>{r.label}</span>
            </div>
          ))}
        </motion.div>
      </div>

      {/* ── Right panel — form ───────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col items-center justify-center bg-bg-cream px-md py-xl sm:px-lg min-h-screen">

        {/* Mobile logo */}
        <motion.div
          className="lg:hidden text-center mb-xl"
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', ...Springs.gentle }}
        >
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-md"
            style={{ background: SIDEBAR_BG }}
          >
            🎨
          </div>
          <h1 className="font-baloo font-extrabold text-xxl text-primary leading-none">Chitram</h1>
          <p className="font-baloo text-sm text-text-muted mt-xs">Management Portal</p>
        </motion.div>

        <motion.div
          className="w-full max-w-[420px]"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', ...Springs.gentle, delay: 0.1 }}
        >
          {/* Hidden on mobile — shown inline on desktop */}
          <div className="hidden lg:block mb-lg">
            <h2 className="font-baloo font-extrabold text-xl text-text-dark">Welcome back</h2>
            <p className="font-baloo text-sm text-text-muted mt-xs">Sign in to your management account</p>
          </div>

          {/* Card */}
          <div
            className="bg-white rounded-xxl p-md sm:p-lg"
            style={{ boxShadow: '0 4px 32px rgba(26,28,66,0.08), 0 1px 4px rgba(26,28,66,0.04)' }}
          >
            {/* Tabs */}
            <div className="flex rounded-xl p-[3px] mb-lg" style={{ background: '#F5F2ED' }}>
              {(['signin', 'register'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => switchTab(tab)}
                  className={`relative flex-1 py-[10px] rounded-lg font-baloo font-semibold text-sm transition-colors ${
                    activeTab === tab ? 'text-text-dark' : 'text-text-muted hover:text-text-body'
                  }`}
                >
                  {activeTab === tab && (
                    <motion.div
                      layoutId="loginActiveTab"
                      className="absolute inset-0 bg-white rounded-lg"
                      style={{ boxShadow: '0 1px 6px rgba(0,0,0,0.08)' }}
                      transition={{ type: 'spring', ...Springs.snappy }}
                    />
                  )}
                  <span className="relative z-10">
                    {tab === 'signin' ? 'Sign In' : 'Join as Teacher'}
                  </span>
                </button>
              ))}
            </div>

            {/* Error Banner */}
            <AnimatePresence mode="wait">
              {parsed && (
                <motion.div
                  key={`${parsed.type}-${activeTab === 'signin' ? shakeKey : regShakeKey}`}
                  variants={{ ...errorVariants, ...shakeVariants }}
                  initial="hidden"
                  animate={['visible', 'shake']}
                  exit="exit"
                  className={`mb-md rounded-xl p-md flex items-start gap-sm ${
                    parsed.type === 'network'
                      ? 'bg-sunshine-light border border-warning/40'
                      : parsed.type === 'permissions'
                      ? 'bg-lavender-light border border-primary/30'
                      : 'bg-rose-light border border-error/30'
                  }`}
                >
                  <span className="text-lg flex-shrink-0 mt-[1px]">{parsed.icon}</span>
                  <div className="min-w-0">
                    <p className={`font-baloo font-bold text-sm ${
                      parsed.type === 'network' ? 'text-warning' : parsed.type === 'permissions' ? 'text-primary' : 'text-error'
                    }`}>
                      {parsed.title}
                    </p>
                    <p className="font-baloo text-xs text-text-body mt-[2px] leading-snug">{parsed.message}</p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Form fields */}
            <AnimatePresence mode="wait">
              {activeTab === 'signin' ? (
                <motion.div
                  key="signin"
                  variants={tabContentVariants}
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                  className="flex flex-col gap-md"
                >
                  <Field label="Email">
                    <input
                      type="email"
                      value={email}
                      onChange={e => { setEmail(e.target.value); setError(''); }}
                      placeholder="you@school.com"
                      className="w-full px-md py-[11px] rounded-xl border font-baloo text-sm text-text-dark focus:outline-none transition-colors"
                      style={{ borderColor: '#E8E5E0', background: '#FAFAF8' }}
                      onFocus={e => { e.currentTarget.style.borderColor = '#7C81FF'; e.currentTarget.style.background = '#fff'; }}
                      onBlur={e => { e.currentTarget.style.borderColor = '#E8E5E0'; e.currentTarget.style.background = '#FAFAF8'; }}
                      onKeyDown={e => { if (e.key === 'Enter' && email && password) handleLogin(); }}
                    />
                  </Field>
                  <Field label="Password">
                    <input
                      type="password"
                      value={password}
                      onChange={e => { setPassword(e.target.value); setError(''); }}
                      placeholder="••••••••"
                      className="w-full px-md py-[11px] rounded-xl border font-baloo text-sm text-text-dark focus:outline-none transition-colors"
                      style={{ borderColor: '#E8E5E0', background: '#FAFAF8' }}
                      onFocus={e => { e.currentTarget.style.borderColor = '#7C81FF'; e.currentTarget.style.background = '#fff'; }}
                      onBlur={e => { e.currentTarget.style.borderColor = '#E8E5E0'; e.currentTarget.style.background = '#FAFAF8'; }}
                      onKeyDown={e => { if (e.key === 'Enter' && email && password) handleLogin(); }}
                    />
                  </Field>
                  <div className="mt-xs">
                    <Button
                      title={loading ? 'Signing in…' : 'Sign In'}
                      onPress={handleLogin}
                      disabled={!email || !password || loading}
                      loading={loading}
                      size="lg"
                    />
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="register"
                  variants={tabContentVariants}
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                  className="flex flex-col gap-md"
                >
                  <Field label="Name">
                    <input
                      type="text"
                      value={regName}
                      onChange={e => { setRegName(e.target.value); setRegError(''); }}
                      placeholder="Your full name"
                      className="w-full px-md py-[11px] rounded-xl border font-baloo text-sm text-text-dark focus:outline-none transition-colors"
                      style={{ borderColor: '#E8E5E0', background: '#FAFAF8' }}
                      onFocus={e => { e.currentTarget.style.borderColor = '#7C81FF'; e.currentTarget.style.background = '#fff'; }}
                      onBlur={e => { e.currentTarget.style.borderColor = '#E8E5E0'; e.currentTarget.style.background = '#FAFAF8'; }}
                    />
                  </Field>
                  <Field label="Email">
                    <input
                      type="email"
                      value={regEmail}
                      onChange={e => { setRegEmail(e.target.value); setRegError(''); }}
                      placeholder="you@school.com"
                      className="w-full px-md py-[11px] rounded-xl border font-baloo text-sm text-text-dark focus:outline-none transition-colors"
                      style={{ borderColor: '#E8E5E0', background: '#FAFAF8' }}
                      onFocus={e => { e.currentTarget.style.borderColor = '#7C81FF'; e.currentTarget.style.background = '#fff'; }}
                      onBlur={e => { e.currentTarget.style.borderColor = '#E8E5E0'; e.currentTarget.style.background = '#FAFAF8'; }}
                    />
                  </Field>
                  <Field label="Password">
                    <input
                      type="password"
                      value={regPassword}
                      onChange={e => { setRegPassword(e.target.value); setRegError(''); }}
                      placeholder="At least 6 characters"
                      className="w-full px-md py-[11px] rounded-xl border font-baloo text-sm text-text-dark focus:outline-none transition-colors"
                      style={{ borderColor: '#E8E5E0', background: '#FAFAF8' }}
                      onFocus={e => { e.currentTarget.style.borderColor = '#7C81FF'; e.currentTarget.style.background = '#fff'; }}
                      onBlur={e => { e.currentTarget.style.borderColor = '#E8E5E0'; e.currentTarget.style.background = '#FAFAF8'; }}
                    />
                  </Field>
                  <Field label="School Code" hint="Ask your school administrator for this code">
                    <input
                      type="text"
                      value={regSchoolCode}
                      onChange={e => { setRegSchoolCode(e.target.value.toUpperCase()); setRegError(''); }}
                      placeholder="e.g. CHTRM1"
                      className="w-full px-md py-[11px] rounded-xl border font-baloo text-sm text-text-dark tracking-widest uppercase focus:outline-none transition-colors"
                      style={{ borderColor: '#E8E5E0', background: '#FAFAF8' }}
                      onFocus={e => { e.currentTarget.style.borderColor = '#7C81FF'; e.currentTarget.style.background = '#fff'; }}
                      onBlur={e => { e.currentTarget.style.borderColor = '#E8E5E0'; e.currentTarget.style.background = '#FAFAF8'; }}
                      onKeyDown={e => { if (e.key === 'Enter' && regName && regEmail && regPassword && regSchoolCode) handleRegister(); }}
                    />
                  </Field>
                  <div className="mt-xs">
                    <Button
                      title={loading ? 'Creating account…' : 'Join as Teacher'}
                      onPress={handleRegister}
                      disabled={!regName || !regEmail || !regPassword || !regSchoolCode || loading}
                      loading={loading}
                      size="lg"
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <p className="font-baloo text-xs text-text-muted text-center mt-lg">
            {activeTab === 'signin'
              ? 'For teachers, admins, and management roles'
              : 'Teachers can join with their school code'}
          </p>
        </motion.div>
      </div>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="font-baloo font-semibold text-sm text-text-dark block mb-xs">{label}</label>
      {children}
      {hint && <p className="font-baloo text-xs text-text-muted mt-xs">{hint}</p>}
    </div>
  );
}
