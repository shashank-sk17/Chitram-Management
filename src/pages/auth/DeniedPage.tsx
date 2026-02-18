import { useAuth } from '../../features/auth/hooks/useAuth';
import { Button } from '../../components/common/Button';
import { Card } from '../../components/common/Card';

export default function DeniedPage() {
  const { logout } = useAuth();

  return (
    <div className="min-h-screen bg-bg-cream flex items-center justify-center px-md py-xl">
      <Card className="w-full max-w-sm sm:max-w-md text-center">
        <div className="flex flex-col items-center gap-md sm:gap-lg">
          {/* Icon */}
          <div className="w-16 h-16 sm:w-24 sm:h-24 rounded-full bg-rose-light flex items-center justify-center">
            <span className="text-3xl sm:text-5xl">🚫</span>
          </div>

          {/* Title */}
          <h1 className="font-baloo font-bold text-xl sm:text-xxl text-text-dark">
            Access Denied
          </h1>

          {/* Message */}
          <p className="font-baloo text-sm sm:text-body text-text-muted leading-relaxed">
            Your account doesn't have the required permissions to access this portal.
            Please contact an administrator to set up your role.
          </p>

          {/* Logout Button */}
          <Button
            title="Sign Out"
            onPress={logout}
            variant="outline"
            size="md"
          />
        </div>
      </Card>
    </div>
  );
}
