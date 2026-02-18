import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { useAuth } from '../../features/auth/hooks/useAuth';

export default function PMDashboardPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const quickStats = [
    { label: 'Active Projects', value: '3', icon: '📁', color: 'from-primary to-secondary' },
    { label: 'Total Schools', value: '12', icon: '🏫', color: 'from-secondary to-accent' },
    { label: 'On Track', value: '85%', icon: '✅', color: 'from-accent to-primary' },
    { label: 'Overdue Tasks', value: '2', icon: '⚠️', color: 'from-error to-warning' },
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
          PM Dashboard 🎯
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

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-md sm:gap-lg">
        {/* Project Overview */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4, delay: 0.4 }}
        >
          <Card className="bg-white">
            <h2 className="font-baloo font-bold text-xl text-text-dark mb-lg flex items-center gap-sm">
              <span>📊</span> Project Overview
            </h2>
            <div className="space-y-md">
              {['Demo Project', 'Learning Initiative', 'Digital Classroom'].map((project, index) => (
                <div
                  key={project}
                  className="p-md rounded-lg bg-lavender-light/30 hover:bg-lavender-light transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <p className="font-baloo font-semibold text-md text-text-dark">
                        {project}
                      </p>
                      <p className="font-baloo text-sm text-text-muted">
                        {4 - index} schools • {(85 + index * 5)}% complete
                      </p>
                    </div>
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-secondary to-accent flex items-center justify-center">
                      <span className="font-baloo font-bold text-white text-sm">
                        {85 + index * 5}%
                      </span>
                    </div>
                  </div>
                  <div className="mt-md">
                    <div className="w-full h-2 bg-divider rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${85 + index * 5}%` }}
                        transition={{ duration: 1, delay: 0.4 + index * 0.1 }}
                        className="h-full bg-gradient-to-r from-secondary to-accent"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </motion.div>

        {/* Recent Activity */}
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
              {[
                { action: 'Milestone completed', project: 'Demo Project', time: '2h ago', icon: '✅' },
                { action: 'New school added', project: 'Learning Initiative', time: '5h ago', icon: '🏫' },
                { action: 'Report generated', project: 'Digital Classroom', time: '1d ago', icon: '📊' },
              ].map((activity, index) => (
                <div
                  key={index}
                  className="flex items-start gap-md p-md rounded-lg bg-mint-light/30 hover:bg-mint-light transition-colors"
                >
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center flex-shrink-0">
                    <span className="text-lg">{activity.icon}</span>
                  </div>
                  <div className="flex-1">
                    <p className="font-baloo font-semibold text-sm text-text-dark">
                      {activity.action}
                    </p>
                    <p className="font-baloo text-xs text-text-muted">
                      {activity.project}
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

      {/* Quick Actions */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.6 }}
        className="mt-xl"
      >
        <Card className="bg-white text-center">
          <h3 className="font-baloo font-bold text-xl text-text-dark mb-md">
            📈 View Detailed Analytics
          </h3>
          <p className="font-baloo text-sm sm:text-body text-text-muted mb-md sm:mb-lg">
            Get comprehensive insights into project performance and delivery metrics
          </p>
          <Button
            title="View Analytics"
            onPress={() => navigate('/pm/analytics')}
            variant="primary"
          />
        </Card>
      </motion.div>
    </div>
  );
}
