import { motion } from 'framer-motion';
import { Card } from '../../components/common/Card';

export default function PrincipalAnalyticsPage() {
  const schoolMetrics = [
    { label: 'Total Teachers', value: 24, icon: '👨‍🏫', change: '+2', color: 'from-primary to-primary/70' },
    { label: 'Total Students', value: 385, icon: '👨‍🎓', change: '+45', color: 'from-secondary to-secondary/70' },
    { label: 'Active Classes', value: 18, icon: '📚', change: '+3', color: 'from-accent to-accent/70' },
    { label: 'Avg Performance', value: '87%', icon: '⭐', change: '+5%', color: 'from-primary to-secondary' },
  ];

  const teacherPerformance = [
    { name: 'Sarah Johnson', students: 25, avgScore: 94, classes: 2, status: 'Excellent' },
    { name: 'Michael Chen', students: 22, avgScore: 91, classes: 2, status: 'Excellent' },
    { name: 'Emily Davis', students: 28, avgScore: 88, classes: 2, status: 'Good' },
    { name: 'Robert Wilson', students: 24, avgScore: 85, classes: 2, status: 'Good' },
  ];

  const classroomStats = [
    { grade: 'Grade 1', enrollment: 85, capacity: 90, performance: 89 },
    { grade: 'Grade 2', enrollment: 92, capacity: 95, performance: 87 },
    { grade: 'Grade 3', enrollment: 88, capacity: 90, performance: 91 },
    { grade: 'Grade 4', enrollment: 78, capacity: 85, performance: 84 },
  ];

  const recentHighlights = [
    { event: 'Top Performer', detail: 'Class 2A achieved 95% avg score', time: '1 day ago', type: 'achievement' },
    { event: 'New Assignment', detail: 'Grade 3 - "Animals" curriculum', time: '2 days ago', type: 'curriculum' },
    { event: 'Teacher Training', detail: 'Digital learning workshop completed', time: '3 days ago', type: 'training' },
    { event: 'Parent Meeting', detail: 'Quarterly review scheduled', time: '5 days ago', type: 'event' },
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
          School Analytics 📊
        </h1>
        <p className="font-baloo text-sm sm:text-lg text-text-muted">
          Monitor school-wide performance and teacher effectiveness
        </p>
      </motion.div>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-sm sm:gap-md mb-lg sm:mb-xl">
        {schoolMetrics.map((metric, index) => (
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
                  <span className="font-baloo text-sm font-bold">+{metric.change}</span>
                </div>
              </div>
            </Card>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-md sm:gap-lg mb-lg sm:mb-xl">
        {/* Teacher Performance */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4, delay: 0.4 }}
        >
          <Card className="bg-white h-full">
            <h2 className="font-baloo font-bold text-xl text-text-dark mb-lg flex items-center gap-sm">
              <span>👨‍🏫</span> Teacher Performance
            </h2>
            <div className="space-y-md">
              {teacherPerformance.map((teacher, index) => (
                <div
                  key={index}
                  className="flex items-center gap-md p-md rounded-lg bg-lavender-light/30 hover:bg-lavender-light transition-colors"
                >
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center flex-shrink-0">
                    <span className="font-baloo font-bold text-lg text-white">
                      {teacher.name[0]}
                    </span>
                  </div>
                  <div className="flex-1">
                    <p className="font-baloo font-bold text-md text-text-dark">
                      {teacher.name}
                    </p>
                    <p className="font-baloo text-sm text-text-muted">
                      {teacher.students} students • {teacher.classes} classes
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-baloo font-extrabold text-xl text-secondary">
                      {teacher.avgScore}%
                    </p>
                    <p className="font-baloo text-xs text-text-muted">
                      {teacher.status}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </motion.div>

        {/* Classroom Statistics */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4, delay: 0.5 }}
        >
          <Card className="bg-white h-full">
            <h2 className="font-baloo font-bold text-xl text-text-dark mb-lg flex items-center gap-sm">
              <span>📚</span> Classroom Statistics
            </h2>
            <div className="space-y-lg">
              {classroomStats.map((classroom, index) => (
                <div key={index}>
                  <div className="flex items-center justify-between mb-sm">
                    <div>
                      <p className="font-baloo font-bold text-md text-text-dark">
                        {classroom.grade}
                      </p>
                      <p className="font-baloo text-sm text-text-muted">
                        {classroom.enrollment}/{classroom.capacity} students
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-baloo font-bold text-lg text-secondary">
                        {classroom.performance}%
                      </p>
                      <p className="font-baloo text-xs text-text-muted">
                        Performance
                      </p>
                    </div>
                  </div>
                  <div className="w-full h-2 bg-divider rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${(classroom.enrollment / classroom.capacity) * 100}%` }}
                      transition={{ duration: 1, delay: 0.5 + index * 0.1 }}
                      className="h-full bg-gradient-to-r from-accent to-primary rounded-full"
                    />
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </motion.div>
      </div>

      {/* Recent Highlights */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.6 }}
        className="mb-xl"
      >
        <Card className="bg-white">
          <h2 className="font-baloo font-bold text-xl text-text-dark mb-lg flex items-center gap-sm">
            <span>⭐</span> Recent Highlights
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-md">
            {recentHighlights.map((highlight, index) => {
              const typeIcons: Record<string, string> = {
                achievement: '🏆',
                curriculum: '📖',
                training: '📚',
                event: '📅',
              };
              return (
                <div
                  key={index}
                  className="flex items-start gap-md p-md rounded-lg bg-mint-light/30 hover:bg-mint-light transition-colors"
                >
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-secondary to-accent flex items-center justify-center flex-shrink-0">
                    <span className="text-lg">{typeIcons[highlight.type]}</span>
                  </div>
                  <div className="flex-1">
                    <p className="font-baloo font-semibold text-sm text-text-dark">
                      {highlight.event}
                    </p>
                    <p className="font-baloo text-sm text-text-muted">
                      {highlight.detail}
                    </p>
                    <span className="font-baloo text-xs text-text-muted">
                      {highlight.time}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </motion.div>

    </div>
  );
}
