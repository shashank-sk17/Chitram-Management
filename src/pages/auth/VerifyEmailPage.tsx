import { useState } from 'react';
import { motion } from 'framer-motion';
import { sendEmailVerification, reload } from 'firebase/auth';
import { auth } from '../../config/firebase';
import { useAuth } from '../../features/auth/hooks/useAuth';
import { useAuthStore } from '../../stores/authStore';
import { Button } from '../../components/common/Button';
import { Card } from '../../components/common/Card';
import { Springs } from '../../theme/animations';

export default function VerifyEmailPage() {
  const { logout } = useAuth();
  const { user } = useAuthStore();
  const [resent, setResent] = useState(false);
  const [checking, setChecking] = useState(false);
  const [checkError, setCheckError] = useState('');

  const email = user?.email ?? '';

  async function handleResend() {
    if (!auth.currentUser) return;
    try {
      await sendEmailVerification(auth.currentUser);
      setResent(true);
      setTimeout(() => setResent(false), 4000);
    } catch {
      // silently ignore rate-limit errors — Firebase will show nothing
    }
  }

  async function handleCheckVerified() {
    if (!auth.currentUser) return;
    setChecking(true);
    setCheckError('');
    try {
      await reload(auth.currentUser);
      if (!auth.currentUser.emailVerified) {
        setCheckError('Email not verified yet. Click the link in your inbox first, then try again.');
      }
      // If emailVerified is now true, the onAuthStateChanged listener in useAuth
      // will fire, set claims, and AppRoutes will redirect automatically.
    } catch {
      setCheckError('Could not check status. Please try again.');
    } finally {
      setChecking(false);
    }
  }

  return (
    <div className="min-h-screen bg-bg-cream flex items-center justify-center px-md py-xl">
      <motion.div
        className="w-full max-w-sm sm:max-w-md"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', ...Springs.gentle }}
      >
        <Card className="text-center">
          <div className="flex flex-col items-center gap-md sm:gap-lg">
            {/* Icon */}
            <div className="w-16 h-16 sm:w-24 sm:h-24 rounded-full bg-lavender-light flex items-center justify-center">
              <span className="text-3xl sm:text-5xl">📧</span>
            </div>

            {/* Title */}
            <h1 className="font-baloo font-bold text-xl sm:text-xxl text-text-dark">
              Check your email
            </h1>

            {/* Message */}
            <p className="font-baloo text-sm sm:text-body text-text-muted leading-relaxed">
              We sent a verification link to{' '}
              <span className="font-bold text-primary break-all">{email}</span>.
              Click the link in that email, then come back here.
            </p>

            {/* Check verified button */}
            <div className="w-full">
              <Button
                title={checking ? 'Checking…' : "I've verified — Continue"}
                onPress={handleCheckVerified}
                disabled={checking}
                loading={checking}
                size="lg"
              />
            </div>

            {/* Error */}
            {checkError && (
              <p className="font-baloo text-sm text-error text-center leading-snug">
                {checkError}
              </p>
            )}

            {/* Resend */}
            <button
              onClick={handleResend}
              className="font-baloo text-sm text-primary hover:underline focus:outline-none"
            >
              {resent ? '✓ Email resent!' : "Didn't get it? Resend email"}
            </button>

            {/* Sign out */}
            <Button
              title="Use a different account"
              onPress={logout}
              variant="outline"
              size="sm"
            />
          </div>
        </Card>
      </motion.div>
    </div>
  );
}
