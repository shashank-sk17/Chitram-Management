import { useEffect, useState } from 'react';
import { useAuth } from '../../features/auth/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { motion } from 'framer-motion';
import { getClassesByTeacher, getStudentsByTeacher } from '../../services/firebase/firestore';

export default function TeacherDashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [classes, setClasses] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);

  useEffect(() => {
    loadData();
  }, [user]);

  async function loadData() {
    if (!user) return;

    setLoading(true);
    try {
      const [classesData, studentsData] = await Promise.all([
        getClassesByTeacher(user.uid),
        getStudentsByTeacher(user.uid),
      ]);

      setClasses(classesData);
      setStudents(studentsData);
    } catch (error) {
      console.error('Error loading teacher data:', error);
    } finally {
      setLoading(false);
    }
  }

  // Calculate stats from real data
  const stats = {
    activeStudents: students.length,
    totalClasses: classes.length,
    avgClassScore: 87, // TODO: Calculate from actual assignment data
    lessonsThisWeek: 12, // TODO: Calculate from actual lesson data
  };

  // Get today's classes (mock schedule for now)
  const upcomingClasses = classes.slice(0, 2).map((cls: any) => ({
    class: cls.name || `Class ${cls.id.slice(0, 4)}`,
    subject: cls.subject || 'General',
    time: '10:00 AM', // TODO: Get from actual schedule
    students: cls.studentIds?.length || 0,
    classId: cls.id,
  }));

  // Get recent student activity (mock for now - TODO: Get from submissions)
  const recentActivity = students.slice(0, 3).map((student: any, index) => ({
    student: student.name || student.email,
    action: index === 0 ? 'Completed assignment' : index === 1 ? 'Started lesson' : 'Completed assignment',
    subject: ['Fruits', 'Colors', 'Animals'][index],
    score: index === 0 ? 95 : index === 2 ? 92 : null,
    time: ['2h ago', '3h ago', '5h ago'][index],
  }));

  // Pending tasks (mock for now - TODO: Get from actual assignments)
  const pendingTasks = [
    { id: 1, title: 'Grade recent assignments', count: students.length > 10 ? 12 : students.length, dueDate: 'Today', priority: 'high' },
    { id: 2, title: 'Review student submissions', count: Math.floor(students.length * 0.4), dueDate: 'Tomorrow', priority: 'medium' },
    { id: 3, title: 'Update lesson plan', count: 1, dueDate: 'This week', priority: 'low' },
  ].filter(task => task.count > 0);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

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
          Welcome Back! 👋
        </h1>
        <p className="font-baloo text-sm sm:text-lg text-text-muted truncate">
          {user?.email}
        </p>
      </motion.div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-sm sm:gap-md mb-lg sm:mb-xl">
        {[
          { label: 'Active Students', value: stats.activeStudents, icon: '👨‍🎓', color: 'from-primary to-primary/70' },
          { label: 'Your Classes', value: stats.totalClasses, icon: '📚', color: 'from-secondary to-secondary/70' },
          { label: 'Avg Class Score', value: `${stats.avgClassScore}%`, icon: '⭐', color: 'from-accent to-accent/70' },
          { label: 'Lessons This Week', value: stats.lessonsThisWeek, icon: '📖', color: 'from-primary to-secondary' },
        ].map((stat, index) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3, delay: index * 0.05 }}
          >
            <Card className="bg-white">
              <div className="text-center">
                <span className="text-2xl sm:text-3xl block mb-xs sm:mb-sm">{stat.icon}</span>
                <h3 className="font-baloo font-extrabold text-lg sm:text-xxl text-text-dark mb-xs">
                  {stat.value}
                </h3>
                <p className="font-baloo text-xs text-text-muted leading-tight">{stat.label}</p>
              </div>
            </Card>
          </motion.div>
        ))}
      </div>

      {students.length === 0 && classes.length === 0 ? (
        <Card className="text-center py-lg sm:py-xxl">
          <span className="text-4xl sm:text-6xl mb-md block">🏫</span>
          <h3 className="font-baloo font-bold text-lg sm:text-xl text-text-dark mb-sm">
            No Classes or Students Yet
          </h3>
          <p className="font-baloo text-sm sm:text-body text-text-muted mb-md sm:mb-lg">
            You haven't been assigned to any classes yet. Contact your school administrator to get started.
          </p>
          <Button
            title="View All Classes"
            onPress={() => navigate('/teacher/classes')}
            variant="primary"
          />
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-md sm:gap-lg mb-lg sm:mb-xl">
            {/* Pending Tasks */}
            {pendingTasks.length > 0 && (
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.4, delay: 0.2 }}
                className="lg:col-span-2"
              >
                <Card className="bg-white h-full">
                  <div className="flex items-center justify-between mb-lg">
                    <h2 className="font-baloo font-bold text-xl text-text-dark flex items-center gap-sm">
                      <span>✅</span> Pending Tasks
                    </h2>
                    <span className="font-baloo text-sm text-text-muted">{pendingTasks.length} tasks</span>
                  </div>
                  <div className="space-y-md">
                    {pendingTasks.map((task) => {
                      const priorityColors: Record<string, string> = {
                        high: 'bg-error text-white',
                        medium: 'bg-accent text-white',
                        low: 'bg-divider text-text-muted',
                      };
                      return (
                        <div
                          key={task.id}
                          className="flex items-start justify-between p-md rounded-lg bg-lavender-light/30 hover:bg-lavender-light transition-colors cursor-pointer"
                          onClick={() => navigate('/teacher/assignments')}
                        >
                          <div className="flex-1">
                            <p className="font-baloo font-bold text-md text-text-dark mb-xs">
                              {task.title}
                            </p>
                            <div className="flex items-center gap-md">
                              <span className="font-baloo text-sm text-text-muted">
                                {task.count} items
                              </span>
                              <span className="font-baloo text-sm text-text-muted">
                                Due: {task.dueDate}
                              </span>
                            </div>
                          </div>
                          <div className={`px-sm py-xs rounded-full ${priorityColors[task.priority]}`}>
                            <span className="font-baloo text-xs font-bold capitalize">
                              {task.priority}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="mt-md pt-md border-t border-divider">
                    <Button
                      title="View All Assignments"
                      onPress={() => navigate('/teacher/assignments')}
                      variant="outline"
                      size="sm"
                    />
                  </div>
                </Card>
              </motion.div>
            )}

            {/* Upcoming Classes */}
            {upcomingClasses.length > 0 && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.4, delay: 0.3 }}
              >
                <Card className="bg-white h-full">
                  <h2 className="font-baloo font-bold text-xl text-text-dark mb-lg flex items-center gap-sm">
                    <span>📅</span> Your Classes
                  </h2>
                  <div className="space-y-md">
                    {upcomingClasses.map((cls, index) => (
                      <div
                        key={index}
                        className="p-md rounded-lg bg-mint-light/30 hover:bg-mint-light transition-colors cursor-pointer"
                        onClick={() => navigate('/teacher/classes')}
                      >
                        <p className="font-baloo font-bold text-md text-text-dark mb-xs">
                          {cls.class}
                        </p>
                        <p className="font-baloo text-sm text-text-muted mb-xs">
                          {cls.subject}
                        </p>
                        <div className="flex items-center justify-between">
                          <span className="font-baloo text-xs text-text-muted">
                            🕒 {cls.time}
                          </span>
                          <span className="font-baloo text-xs text-text-muted">
                            👥 {cls.students} students
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-md pt-md border-t border-divider">
                    <Button
                      title="View All Classes"
                      onPress={() => navigate('/teacher/classes')}
                      variant="outline"
                      size="sm"
                    />
                  </div>
                </Card>
              </motion.div>
            )}
          </div>

          {/* Recent Activity */}
          {recentActivity.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.4 }}
            >
              <Card className="bg-white">
                <h2 className="font-baloo font-bold text-xl text-text-dark mb-lg flex items-center gap-sm">
                  <span>🔔</span> Your Students
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-md">
                  {recentActivity.map((activity, index) => (
                    <div
                      key={index}
                      className="flex items-start gap-md p-md rounded-lg bg-peach-light/30 hover:bg-peach-light transition-colors cursor-pointer"
                      onClick={() => navigate('/teacher/students')}
                    >
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center flex-shrink-0">
                        <span className="font-baloo font-bold text-sm text-white">
                          {activity.student[0].toUpperCase()}
                        </span>
                      </div>
                      <div className="flex-1">
                        <p className="font-baloo font-semibold text-sm text-text-dark truncate">
                          {activity.student}
                        </p>
                        <p className="font-baloo text-xs text-text-muted">
                          {activity.action}
                        </p>
                        <p className="font-baloo text-xs text-text-muted">
                          {activity.subject}
                        </p>
                        <div className="flex items-center justify-between mt-xs">
                          <span className="font-baloo text-xs text-text-muted">
                            {activity.time}
                          </span>
                          {activity.score && (
                            <span className="font-baloo text-xs font-bold text-secondary">
                              {activity.score}%
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-md pt-md border-t border-divider flex justify-center gap-md">
                  <Button
                    title="View All Students"
                    onPress={() => navigate('/teacher/students')}
                    variant="outline"
                    size="sm"
                  />
                  <Button
                    title="View Analytics"
                    onPress={() => navigate('/teacher/analytics')}
                    variant="primary"
                    size="sm"
                  />
                </div>
              </Card>
            </motion.div>
          )}
        </>
      )}
    </div>
  );
}
