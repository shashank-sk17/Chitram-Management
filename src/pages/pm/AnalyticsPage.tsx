import { motion } from 'framer-motion';
import { Card } from '../../components/common/Card';

export default function PMAnalyticsPage() {
  const projectMetrics = [
    { label: 'Active Projects', value: 12, icon: '🎯', change: '+3', color: 'from-primary to-primary/70' },
    { label: 'Total Schools', value: 45, icon: '🏫', change: '+8', color: 'from-secondary to-secondary/70' },
    { label: 'On Schedule', value: '92%', icon: '✅', change: '+5%', color: 'from-accent to-accent/70' },
    { label: 'Budget Used', value: '67%', icon: '💰', change: '+12%', color: 'from-primary to-secondary' },
  ];

  const projectStatus = [
    { name: 'North District Initiative', progress: 85, schools: 15, status: 'On Track', color: 'bg-secondary' },
    { name: 'South Region Expansion', progress: 92, schools: 12, status: 'Ahead', color: 'bg-primary' },
    { name: 'East Valley Program', progress: 68, schools: 10, status: 'At Risk', color: 'bg-accent' },
    { name: 'West Coast Rollout', progress: 78, schools: 8, status: 'On Track', color: 'bg-secondary' },
  ];

  const milestones = [
    { title: 'Phase 1 Complete', project: 'North District', date: '2 days ago', status: 'completed' },
    { title: 'Teacher Training', project: 'South Region', date: 'In Progress', status: 'active' },
    { title: 'School Onboarding', project: 'East Valley', date: 'Upcoming', status: 'pending' },
    { title: 'Curriculum Review', project: 'West Coast', date: 'Next week', status: 'pending' },
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
          Project Analytics 📊
        </h1>
        <p className="font-baloo text-sm sm:text-lg text-text-muted">
          Track project delivery and performance metrics
        </p>
      </motion.div>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-sm sm:gap-md mb-lg sm:mb-xl">
        {projectMetrics.map((metric, index) => (
          <motion.div
            key={metric.label}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3, delay: index * 0.1 }}
            whileHover={{ scale: 1.05, y: -5 }}
          >
            <Card className="bg-white hover:shadow-xl transition-shadow">
              <div className="text-center">
                <span className="text-2xl sm:text-4xl block mb-xs sm:mb-md">{metric.icon}</span>
                <h3 className="font-baloo font-extrabold text-lg sm:text-xxl text-text-dark mb-xs sm:mb-sm">
                  {metric.value}
                </h3>
                <p className="font-baloo text-xs sm:text-md text-text-muted mb-xs sm:mb-sm leading-tight">{metric.label}</p>
                <div className={`inline-block px-md py-sm rounded-full bg-gradient-to-r ${metric.color} text-white`}>
                  <span className="font-baloo text-sm font-bold">{metric.change}</span>
                </div>
              </div>
            </Card>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-md sm:gap-lg mb-lg sm:mb-xl">
        {/* Project Status */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4, delay: 0.4 }}
        >
          <Card className="bg-white h-full">
            <h2 className="font-baloo font-bold text-xl text-text-dark mb-lg flex items-center gap-sm">
              <span>📈</span> Project Status
            </h2>
            <div className="space-y-lg">
              {projectStatus.map((project, index) => (
                <div key={index}>
                  <div className="flex items-start justify-between mb-sm">
                    <div>
                      <p className="font-baloo font-bold text-body text-text-dark">
                        {project.name}
                      </p>
                      <p className="font-baloo text-sm text-text-muted">
                        {project.schools} schools • {project.status}
                      </p>
                    </div>
                    <span className="font-baloo font-bold text-lg text-text-dark">
                      {project.progress}%
                    </span>
                  </div>
                  <div className="w-full h-2 bg-divider rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${project.progress}%` }}
                      transition={{ duration: 1, delay: 0.4 + index * 0.1 }}
                      className={`h-full ${project.color} rounded-full`}
                    />
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </motion.div>

        {/* Milestones */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4, delay: 0.5 }}
        >
          <Card className="bg-white h-full">
            <h2 className="font-baloo font-bold text-xl text-text-dark mb-lg flex items-center gap-sm">
              <span>🎯</span> Key Milestones
            </h2>
            <div className="space-y-md">
              {milestones.map((milestone, index) => {
                const statusColors: Record<string, string> = {
                  completed: 'bg-secondary text-white',
                  active: 'bg-primary text-white',
                  pending: 'bg-divider text-text-muted',
                };
                const statusIcons: Record<string, string> = {
                  completed: '✓',
                  active: '⟳',
                  pending: '○',
                };
                return (
                  <div
                    key={index}
                    className="flex items-start gap-md p-md rounded-lg bg-lavender-light/30 hover:bg-lavender-light transition-colors"
                  >
                    <div className={`w-10 h-10 rounded-full ${statusColors[milestone.status]} flex items-center justify-center flex-shrink-0`}>
                      <span className="font-baloo font-bold text-lg">
                        {statusIcons[milestone.status]}
                      </span>
                    </div>
                    <div className="flex-1">
                      <p className="font-baloo font-semibold text-md text-text-dark">
                        {milestone.title}
                      </p>
                      <p className="font-baloo text-sm text-text-muted">
                        {milestone.project}
                      </p>
                      <span className="font-baloo text-xs text-text-muted">
                        {milestone.date}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </motion.div>
      </div>

    </div>
  );
}
