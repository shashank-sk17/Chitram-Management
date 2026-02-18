import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Card } from '../../components/common/Card';
import { useAuth } from '../../features/auth/hooks/useAuth';
import { getStudentsByTeacher, getClassesByTeacher } from '../../services/firebase/firestore';

export default function StudentsPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [students, setStudents] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterClass, setFilterClass] = useState('all');

  useEffect(() => {
    loadData();
  }, [user]);

  async function loadData() {
    if (!user) return;

    setLoading(true);
    try {
      const [studentsData, classesData] = await Promise.all([
        getStudentsByTeacher(user.uid),
        getClassesByTeacher(user.uid),
      ]);

      setStudents(studentsData);
      setClasses(classesData);
    } catch (error) {
      console.error('Error loading students:', error);
    } finally {
      setLoading(false);
    }
  }

  const filteredStudents = students.filter((student) => {
    const matchesSearch =
      student.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      student.email?.toLowerCase().includes(searchQuery.toLowerCase());
    // TODO: Add class filtering when we have classId in student data
    return matchesSearch;
  });

  const stats = {
    total: students.length,
    activeToday: Math.floor(students.length * 0.6), // Mock - TODO: calculate from actual activity
    avgProgress: students.length > 0 ? 85 : 0, // Mock - TODO: calculate from assignments
  };

  const getProgressColor = (progress: number) => {
    if (progress >= 90) return 'bg-gradient-to-r from-secondary to-secondary/70';
    if (progress >= 75) return 'bg-gradient-to-r from-primary to-primary/70';
    return 'bg-gradient-to-r from-accent to-accent/70';
  };

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
          Students 👨‍🎓
        </h1>
        <p className="font-baloo text-sm sm:text-lg text-text-muted">
          Manage and track your students' progress
        </p>
      </motion.div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-sm sm:gap-md mb-lg sm:mb-xl">
        {[
          { label: 'Total Students', value: stats.total, icon: '👥', color: 'bg-gradient-to-br from-lavender-light to-primary/20' },
          { label: 'Active Today', value: stats.activeToday, icon: '✅', color: 'bg-gradient-to-br from-mint-light to-secondary/20' },
          { label: 'Avg Progress', value: `${stats.avgProgress}%`, icon: '📊', color: 'bg-gradient-to-br from-peach-light to-accent/20' },
        ].map((stat, index) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3, delay: index * 0.1 }}
          >
            <Card className={`${stat.color}`}>
              <div className="flex items-center justify-between gap-sm">
                <div className="min-w-0">
                  <p className="font-baloo text-xs sm:text-md text-text-muted mb-xs sm:mb-sm leading-tight">{stat.label}</p>
                  <h3 className="font-baloo font-extrabold text-xl sm:text-hero text-text-dark">
                    {stat.value}
                  </h3>
                </div>
                <span className="text-2xl sm:text-4xl flex-shrink-0">{stat.icon}</span>
              </div>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Filters */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.3 }}
        className="mb-lg"
      >
        <Card className="bg-white">
          <div className="flex flex-col md:flex-row gap-md">
            <div className="flex-1">
              <input
                type="text"
                placeholder="Search students..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-md py-sm sm:py-md rounded-lg border-2 border-divider bg-white font-baloo text-sm sm:text-body focus:border-primary focus:outline-none"
              />
            </div>
            {classes.length > 0 && (
              <div className="md:w-48">
                <select
                  value={filterClass}
                  onChange={(e) => setFilterClass(e.target.value)}
                  className="w-full px-md py-sm sm:py-md rounded-lg border-2 border-divider bg-white font-baloo text-sm sm:text-body focus:border-primary focus:outline-none"
                >
                  <option value="all">All Classes</option>
                  {classes.map((cls) => (
                    <option key={cls.id} value={cls.id}>
                      {cls.name || `Class ${cls.id.slice(0, 6)}`}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </Card>
      </motion.div>

      {/* Students Grid */}
      {filteredStudents.length > 0 ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.4 }}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-md sm:gap-lg"
        >
          {filteredStudents.map((student, index) => {
            const progress = 75 + Math.floor(Math.random() * 25); // Mock progress
            const assignments = Math.floor(Math.random() * 15); // Mock assignments
            const lastActive = ['2h ago', '5h ago', '1 day ago', '2 days ago'][Math.floor(Math.random() * 4)];

            return (
              <motion.div
                key={student.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.4 + index * 0.05 }}
                whileHover={{ scale: 1.02, y: -5 }}
              >
                <Card className="hover:shadow-xl transition-shadow">
                  <div className="flex items-start gap-md mb-md">
                    <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-xl sm:rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg flex-shrink-0">
                      <span className="font-baloo font-extrabold text-xl text-white">
                        {(student.name || student.email)?.[0]?.toUpperCase() || '?'}
                      </span>
                    </div>
                    <div className="flex-1 overflow-hidden">
                      <h3 className="font-baloo font-bold text-lg text-text-dark truncate">
                        {student.name || student.email || 'Unknown'}
                      </h3>
                      <p className="font-baloo text-sm text-text-muted truncate">
                        {student.email || 'No email'}
                      </p>
                      <div className="flex items-center gap-xs mt-xs">
                        {student.age && (
                          <span className="bg-lavender-light px-sm py-xs rounded-full font-baloo text-xs font-semibold text-primary">
                            Age {student.age}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="mb-md">
                    <div className="flex items-center justify-between mb-xs">
                      <span className="font-baloo text-sm text-text-muted">Progress</span>
                      <span className="font-baloo text-sm font-bold text-text-dark">
                        {progress}%
                      </span>
                    </div>
                    <div className="w-full h-2 bg-divider rounded-full overflow-hidden">
                      <div
                        className={`h-full ${getProgressColor(progress)} transition-all duration-500`}
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="grid grid-cols-2 gap-sm">
                    <div className="bg-mint-light/50 px-sm py-sm rounded-lg">
                      <p className="font-baloo text-xs text-text-muted">Assignments</p>
                      <p className="font-baloo font-bold text-body text-text-dark">
                        {assignments}
                      </p>
                    </div>
                    <div className="bg-peach-light/50 px-sm py-sm rounded-lg">
                      <p className="font-baloo text-xs text-text-muted">Last Active</p>
                      <p className="font-baloo font-bold text-xs text-text-dark">
                        {lastActive}
                      </p>
                    </div>
                  </div>
                </Card>
              </motion.div>
            );
          })}
        </motion.div>
      ) : (
        <Card className="text-center py-lg sm:py-xxl">
          <span className="text-4xl sm:text-6xl mb-md block">
            {searchQuery || filterClass !== 'all' ? '🔍' : '👨‍🎓'}
          </span>
          <h3 className="font-baloo font-bold text-lg sm:text-xl text-text-dark mb-sm">
            {searchQuery || filterClass !== 'all' ? 'No students found' : 'No students yet'}
          </h3>
          <p className="font-baloo text-sm sm:text-body text-text-muted">
            {searchQuery || filterClass !== 'all'
              ? 'Try adjusting your search or filters'
              : 'Students will appear here once they join your classes'}
          </p>
        </Card>
      )}
    </div>
  );
}
