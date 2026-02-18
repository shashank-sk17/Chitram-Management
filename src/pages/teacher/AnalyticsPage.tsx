import { motion } from 'framer-motion';
import { Card } from '../../components/common/Card';

export default function AnalyticsPage() {
  // Mock data for demonstration
  const stats = {
    totalStudents: 45,
    activeStudents: 38,
    averageProgress: 72,
    completedAssignments: 156,
  };

  const recentActivity = [
    { student: 'John Doe', activity: 'Completed "Animals" assignment', time: '2 hours ago', score: 95 },
    { student: 'Jane Smith', activity: 'Started "Colors" lesson', time: '3 hours ago', score: null },
    { student: 'Mike Johnson', activity: 'Completed "Fruits" assignment', time: '5 hours ago', score: 88 },
    { student: 'Sarah Williams', activity: 'Completed "Shapes" assignment', time: '1 day ago', score: 92 },
  ];

  const topPerformers = [
    { name: 'Emma Wilson', avgScore: 96, assignments: 12 },
    { name: 'Oliver Brown', avgScore: 94, assignments: 11 },
    { name: 'Sophia Davis', avgScore: 92, assignments: 12 },
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
          Analytics 📈
        </h1>
        <p className="font-baloo text-sm sm:text-lg text-text-muted">
          Track student performance and progress
        </p>
      </motion.div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-sm sm:gap-md mb-lg sm:mb-xl">
        {[
          { label: 'Total Students', value: stats.totalStudents, icon: '👨‍🎓', color: 'bg-gradient-to-br from-lavender-light to-primary/20' },
          { label: 'Active This Week', value: stats.activeStudents, icon: '✅', color: 'bg-gradient-to-br from-mint-light to-secondary/20' },
          { label: 'Avg Progress', value: `${stats.averageProgress}%`, icon: '📊', color: 'bg-gradient-to-br from-peach-light to-accent/20' },
          { label: 'Assignments Done', value: stats.completedAssignments, icon: '📝', color: 'bg-gradient-to-br from-lavender-light to-secondary/20' },
        ].map((stat, index) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3, delay: index * 0.1 }}
            whileHover={{ scale: 1.05, y: -5 }}
          >
            <Card className={`${stat.color} hover:shadow-xl transition-shadow`}>
              <div className="text-center">
                <span className="text-2xl sm:text-4xl block mb-xs sm:mb-md">{stat.icon}</span>
                <h3 className="font-baloo font-extrabold text-lg sm:text-xxl text-text-dark mb-xs sm:mb-sm">
                  {stat.value}
                </h3>
                <p className="font-baloo text-xs sm:text-md text-text-muted font-semibold leading-tight">
                  {stat.label}
                </p>
              </div>
            </Card>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-md sm:gap-lg">
        {/* Recent Activity */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4, delay: 0.4 }}
        >
          <Card className="bg-white">
            <h2 className="font-baloo font-bold text-xl text-text-dark mb-md flex items-center gap-sm">
              <span>🔔</span> Recent Activity
            </h2>
            <div className="space-y-md">
              {recentActivity.map((item, index) => (
                <div
                  key={index}
                  className="flex items-start gap-md p-md rounded-lg bg-lavender-light/30 hover:bg-lavender-light transition-colors"
                >
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center flex-shrink-0">
                    <span className="font-baloo font-bold text-sm text-white">
                      {item.student[0]}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-baloo font-semibold text-sm text-text-dark truncate">
                      {item.student}
                    </p>
                    <p className="font-baloo text-sm text-text-muted">
                      {item.activity}
                    </p>
                    <div className="flex items-center gap-md mt-xs">
                      <span className="font-baloo text-xs text-text-muted">
                        {item.time}
                      </span>
                      {item.score && (
                        <span className="font-baloo text-xs font-bold text-secondary">
                          Score: {item.score}%
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </motion.div>

        {/* Top Performers */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4, delay: 0.5 }}
        >
          <Card className="bg-white">
            <h2 className="font-baloo font-bold text-xl text-text-dark mb-md flex items-center gap-sm">
              <span>🏆</span> Top Performers
            </h2>
            <div className="space-y-md">
              {topPerformers.map((student, index) => (
                <div
                  key={index}
                  className="flex items-center gap-md p-md rounded-lg bg-gradient-to-r from-mint-light to-transparent hover:from-mint-light hover:to-mint-light/50 transition-all"
                >
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-accent to-primary flex items-center justify-center flex-shrink-0 shadow-md">
                    <span className="font-baloo font-extrabold text-lg text-white">
                      #{index + 1}
                    </span>
                  </div>
                  <div className="flex-1">
                    <p className="font-baloo font-bold text-body text-text-dark">
                      {student.name}
                    </p>
                    <p className="font-baloo text-sm text-text-muted">
                      {student.assignments} assignments completed
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="font-baloo font-extrabold text-lg sm:text-xxl text-secondary">
                      {student.avgScore}%
                    </p>
                    <p className="font-baloo text-xs text-text-muted">
                      Avg Score
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </motion.div>
      </div>

    </div>
  );
}
