import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { useAuth } from '../../features/auth/hooks/useAuth';

export default function PrincipalDashboardPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const quickStats = [
    { label: 'Total Teachers', value: '24', icon: '👨‍🏫', color: 'from-primary to-secondary' },
    { label: 'Total Students', value: '385', icon: '👨‍🎓', color: 'from-secondary to-accent' },
    { label: 'Active Classes', value: '18', icon: '📚', color: 'from-accent to-primary' },
    { label: 'Avg Performance', value: '87%', icon: '⭐', color: 'from-primary to-secondary' },
  ];

  const recentActivity = [
    { teacher: 'Sarah Johnson', action: 'Created new assignment', time: '2h ago', icon: '📝' },
    { teacher: 'Michael Chen', action: 'Completed curriculum review', time: '4h ago', icon: '✅' },
    { teacher: 'Emily Davis', action: 'Added 5 new students', time: '1d ago', icon: '👥' },
  ];

  const topPerformers = [
    { name: 'Class 2A', score: 95, students: 28, teacher: 'Sarah Johnson' },
    { name: 'Class 1B', score: 92, students: 25, teacher: 'Michael Chen' },
    { name: 'Class 3C', score: 89, students: 30, teacher: 'Emily Davis' },
  ];

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="mb-xl"
      >
        <h1 className="font-baloo font-bold text-xl sm:text-xxl text-text-dark mb-xs sm:mb-sm">
          Principal Dashboard 🏛️
        </h1>
        <p className="font-baloo text-sm sm:text-lg text-text-muted truncate">
          {user?.email}
        </p>
      </motion.div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-sm sm:gap-md mb-lg sm:mb-xl">
        {quickStats.map((stat, index) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3, delay: index * 0.1 }}
          >
            <Card className="bg-white text-center">
              <span className="text-2xl sm:text-4xl block mb-xs sm:mb-md">{stat.icon}</span>
              <h3 className="font-baloo font-extrabold text-lg sm:text-xxl text-text-dark mb-xs">
                {stat.value}
              </h3>
              <p className="font-baloo text-xs sm:text-sm text-text-muted leading-tight">{stat.label}</p>
            </Card>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-md sm:gap-lg">
        {/* Top Performing Classes */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4, delay: 0.4 }}
        >
          <Card className="bg-white">
            <h2 className="font-baloo font-bold text-xl text-text-dark mb-lg flex items-center gap-sm">
              <span>🏆</span> Top Performing Classes
            </h2>
            <div className="space-y-md">
              {topPerformers.map((performer, index) => (
                <div
                  key={performer.name}
                  className="p-md rounded-lg bg-lavender-light/30 hover:bg-lavender-light transition-colors"
                >
                  <div className="flex items-center justify-between mb-sm">
                    <div className="flex-1">
                      <p className="font-baloo font-bold text-md text-text-dark">
                        {performer.name}
                      </p>
                      <p className="font-baloo text-sm text-text-muted">
                        {performer.students} students • {performer.teacher}
                      </p>
                    </div>
                    <div className="flex items-center gap-xs">
                      <span className="font-baloo font-extrabold text-xl text-secondary">
                        {performer.score}%
                      </span>
                    </div>
                  </div>
                  <div className="w-full h-2 bg-divider rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${performer.score}%` }}
                      transition={{ duration: 1, delay: 0.4 + index * 0.1 }}
                      className="h-full bg-gradient-to-r from-secondary to-accent"
                    />
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </motion.div>

        {/* Recent Teacher Activity */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4, delay: 0.5 }}
        >
          <Card className="bg-white">
            <h2 className="font-baloo font-bold text-xl text-text-dark mb-lg flex items-center gap-sm">
              <span>🔔</span> Recent Activity
            </h2>
            <div className="space-y-md">
              {recentActivity.map((activity, index) => (
                <div
                  key={index}
                  className="flex items-start gap-md p-md rounded-lg bg-mint-light/30 hover:bg-mint-light transition-colors"
                >
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center flex-shrink-0">
                    <span className="text-lg">{activity.icon}</span>
                  </div>
                  <div className="flex-1">
                    <p className="font-baloo font-semibold text-sm text-text-dark">
                      {activity.teacher}
                    </p>
                    <p className="font-baloo text-xs text-text-muted">
                      {activity.action}
                    </p>
                    <p className="font-baloo text-xs text-text-muted">
                      {activity.time}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </motion.div>
      </div>

      {/* School Performance Summary */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.6 }}
        className="mt-xl"
      >
        <Card className="bg-gradient-to-r from-lavender-light via-mint-light to-peach-light">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-baloo font-bold text-lg sm:text-xl text-text-dark mb-xs sm:mb-sm">
                📊 School Performance Overview
              </h3>
              <p className="font-baloo text-sm sm:text-body text-text-muted mb-sm sm:mb-md">
                View comprehensive analytics for all teachers, students, and classes
              </p>
              <Button
                title="View Detailed Analytics"
                onPress={() => navigate('/principal/analytics')}
                variant="primary"
              />
            </div>
            <div className="hidden md:block">
              <div className="w-32 h-32 rounded-full bg-gradient-to-br from-primary to-secondary opacity-20"></div>
            </div>
          </div>
        </Card>
      </motion.div>
    </div>
  );
}
