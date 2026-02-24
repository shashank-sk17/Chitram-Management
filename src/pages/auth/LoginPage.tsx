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

  if (lower.includes('network') || lower.includes('unavailable') || lower.includes('failed to fetch') || lower.includes('timeout')) {
    return { type: 'network', icon: '📡', title: 'No Connection', message: 'Check your internet connection and try again.' };
  }
  if (lower.includes('wrong-password') || lower.includes('invalid-credential') || lower.includes('invalid-login') || lower.includes('incorrect')) {
    return { type: 'credentials', icon: '🔑', title: 'Wrong Credentials', message: 'The email or password you entered is incorrect.' };
  }
  if (lower.includes('user-not-found') || lower.includes('no user')) {
    return { type: 'credentials', icon: '🔑', title: 'Account Not Found', message: 'No account exists with this email. Try joining as a teacher.' };
  }
  if (lower.includes('too-many-requests') || lower.includes('blocked')) {
    return { type: 'credentials', icon: '🛑', title: 'Too Many Attempts', message: 'Account temporarily locked. Please wait a moment and try again.' };
  }
  if ((lower.includes('missing') && lower.includes('role')) || lower.includes('invalid or missing role') || lower.includes('denied') || lower.includes('permission')) {
    return { type: 'permissions', icon: '🚫', title: 'Access Denied', message: 'Your account does not have management portal access. Contact your administrator.' };
  }
  if (lower.includes('already-exists') || lower.includes('email-already-in-use') || lower.includes('already exists')) {
    return { type: 'exists', icon: '📧', title: 'Account Exists', message: 'An account with this email already exists. Try signing in instead.' };
  }
  if (lower.includes('not-found') || lower.includes('school not found') || lower.includes('check the code')) {
    return { type: 'not-found', icon: '🏫', title: 'School Not Found', message: 'No school matches that code. Double-check with your administrator.' };
  }
  if (lower.includes('weak-password') || lower.includes('at least 6')) {
    return { type: 'generic', icon: '🔒', title: 'Weak Password', message: 'Password must be at least 6 characters long.' };
  }

  return { type: 'generic', icon: '⚠️', title: 'Something Went Wrong', message: raw || 'An unexpected error occurred. Please try again.' };
}

const roleRouteMap: Record<string, string> = {
  admin: '/admin',
  projectAdmin: '/admin',
  teacher: '/teacher',
  pm: '/pm',
  principal: '/principal',
};

const shakeVariants: Variants = {
  shake: {
    x: [0, -12, 12, -8, 8, -4, 4, 0],
    transition: { duration: 0.5 },
  },
};

const errorVariants: Variants = {
  hidden: { opacity: 0, y: -8, scale: 0.95 },
  visible: {
    opacity: 1, y: 0, scale: 1,
    transition: { type: 'spring', ...Springs.snappy },
  },
  exit: {
    opacity: 0, y: -8, scale: 0.95,
    transition: { duration: 0.15 },
  },
};

const tabContentVariants: Variants = {
  hidden: { opacity: 0, x: 20 },
  visible: { opacity: 1, x: 0, transition: { type: 'spring', ...Springs.gentle } },
  exit: { opacity: 0, x: -20, transition: { duration: 0.15 } },
};

export default function LoginPage() {
  const [activeTab, setActiveTab] = useState<Tab>('signin');

  // Sign-in state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [shakeKey, setShakeKey] = useState(0);

  // Register state
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regSchoolCode, setRegSchoolCode] = useState('');
  const [regError, setRegError] = useState('');
  const [regShakeKey, setRegShakeKey] = useState(0);

  const { login, register, loading } = useAuth();
  const { loginError, setLoginError } = useAuthStore();
  const navigate = useNavigate();

  // On mount, steal any persisted login error (survives component remounts caused by auth state changes)
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
      const route = roleRouteMap[claims.role] || '/denied';
      navigate(route);
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
      const route = roleRouteMap[claims.role] || '/denied';
      navigate(route);
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
    <div className="min-h-screen min-h-[100dvh] bg-bg-cream flex flex-col items-center justify-center px-md py-xl sm:px-lg">
      <div className="w-full max-w-[420px]">
        {/* Logo */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', ...Springs.gentle }}
          className="text-center mb-xl"
        >
          <div className="w-[72px] h-[72px] sm:w-20 sm:h-20 rounded-full bg-white shadow-glow mx-auto mb-md flex items-center justify-center">
            <span className="text-[36px] sm:text-[40px]">🎨</span>
          </div>
          <h1 className="font-baloo font-extrabold text-xxl sm:text-hero text-primary leading-none">
            Chitram
          </h1>
          <p className="font-baloo text-sm sm:text-body text-text-muted mt-xs">
            Management Portal
          </p>
        </motion.div>

        {/* Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', ...Springs.gentle, delay: 0.1 }}
          className="bg-white rounded-xxl shadow-md p-md sm:p-lg"
        >
          {/* Tabs */}
          <div className="flex bg-bg-cream rounded-full p-[3px] mb-lg">
            <button
              onClick={() => switchTab('signin')}
              className={`relative flex-1 py-[10px] sm:py-3 rounded-full font-baloo font-semibold text-sm sm:text-md transition-colors ${
                activeTab === 'signin'
                  ? 'text-white'
                  : 'text-text-muted hover:text-text-dark'
              }`}
            >
              {activeTab === 'signin' && (
                <motion.div
                  layoutId="activeTab"
                  className="absolute inset-0 bg-primary rounded-full"
                  transition={{ type: 'spring', ...Springs.snappy }}
                />
              )}
              <span className="relative z-10">Sign In</span>
            </button>
            <button
              onClick={() => switchTab('register')}
              className={`relative flex-1 py-[10px] sm:py-3 rounded-full font-baloo font-semibold text-sm sm:text-md transition-colors ${
                activeTab === 'register'
                  ? 'text-white'
                  : 'text-text-muted hover:text-text-dark'
              }`}
            >
              {activeTab === 'register' && (
                <motion.div
                  layoutId="activeTab"
                  className="absolute inset-0 bg-primary rounded-full"
                  transition={{ type: 'spring', ...Springs.snappy }}
                />
              )}
              <span className="relative z-10">Join as Teacher</span>
            </button>
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
                    ? 'bg-sunshine-light border-2 border-warning'
                    : parsed.type === 'permissions'
                    ? 'bg-lavender-light border-2 border-primary'
                    : 'bg-rose-light border-2 border-error'
                }`}
              >
                <span className="text-lg flex-shrink-0 mt-[1px]">{parsed.icon}</span>
                <div className="min-w-0">
                  <p className={`font-baloo font-bold text-sm ${
                    parsed.type === 'network' ? 'text-warning' : parsed.type === 'permissions' ? 'text-primary' : 'text-error'
                  }`}>
                    {parsed.title}
                  </p>
                  <p className="font-baloo text-xs text-text-body mt-[2px] leading-snug">
                    {parsed.message}
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Tab Content */}
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
                <div>
                  <label className="font-baloo font-semibold text-sm sm:text-md text-text-dark block mb-xs">
                    Email
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); setError(''); }}
                    placeholder="teacher@school.com"
                    className="w-full px-md py-[12px] sm:py-md rounded-xl border-2 border-divider bg-white font-baloo text-sm sm:text-body text-text-dark focus:border-primary focus:outline-none transition-colors"
                  />
                </div>

                <div>
                  <label className="font-baloo font-semibold text-sm sm:text-md text-text-dark block mb-xs">
                    Password
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); setError(''); }}
                    placeholder="••••••••"
                    className="w-full px-md py-[12px] sm:py-md rounded-xl border-2 border-divider bg-white font-baloo text-sm sm:text-body text-text-dark focus:border-primary focus:outline-none transition-colors"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && email && password) handleLogin();
                    }}
                  />
                </div>

                <div className="mt-sm">
                  <Button
                    title={loading ? 'Signing in...' : 'Sign In'}
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
                <div>
                  <label className="font-baloo font-semibold text-sm sm:text-md text-text-dark block mb-xs">
                    Name
                  </label>
                  <input
                    type="text"
                    value={regName}
                    onChange={(e) => { setRegName(e.target.value); setRegError(''); }}
                    placeholder="Your full name"
                    className="w-full px-md py-[12px] sm:py-md rounded-xl border-2 border-divider bg-white font-baloo text-sm sm:text-body text-text-dark focus:border-primary focus:outline-none transition-colors"
                  />
                </div>

                <div>
                  <label className="font-baloo font-semibold text-sm sm:text-md text-text-dark block mb-xs">
                    Email
                  </label>
                  <input
                    type="email"
                    value={regEmail}
                    onChange={(e) => { setRegEmail(e.target.value); setRegError(''); }}
                    placeholder="teacher@school.com"
                    className="w-full px-md py-[12px] sm:py-md rounded-xl border-2 border-divider bg-white font-baloo text-sm sm:text-body text-text-dark focus:border-primary focus:outline-none transition-colors"
                  />
                </div>

                <div>
                  <label className="font-baloo font-semibold text-sm sm:text-md text-text-dark block mb-xs">
                    Password
                  </label>
                  <input
                    type="password"
                    value={regPassword}
                    onChange={(e) => { setRegPassword(e.target.value); setRegError(''); }}
                    placeholder="At least 6 characters"
                    className="w-full px-md py-[12px] sm:py-md rounded-xl border-2 border-divider bg-white font-baloo text-sm sm:text-body text-text-dark focus:border-primary focus:outline-none transition-colors"
                  />
                </div>

                <div>
                  <label className="font-baloo font-semibold text-sm sm:text-md text-text-dark block mb-xs">
                    School Code
                  </label>
                  <input
                    type="text"
                    value={regSchoolCode}
                    onChange={(e) => { setRegSchoolCode(e.target.value.toUpperCase()); setRegError(''); }}
                    placeholder="e.g. CHTRM1"
                    className="w-full px-md py-[12px] sm:py-md rounded-xl border-2 border-divider bg-white font-baloo text-sm sm:text-body text-text-dark tracking-widest uppercase focus:border-primary focus:outline-none transition-colors"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && regName && regEmail && regPassword && regSchoolCode) handleRegister();
                    }}
                  />
                  <p className="font-baloo text-xs text-text-muted mt-xs">
                    Ask your school administrator for this code
                  </p>
                </div>

                <div className="mt-sm">
                  <Button
                    title={loading ? 'Creating account...' : 'Join as Teacher'}
                    onPress={handleRegister}
                    disabled={!regName || !regEmail || !regPassword || !regSchoolCode || loading}
                    loading={loading}
                    size="lg"
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Footer */}
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
