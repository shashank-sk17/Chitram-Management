import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useProjectStore } from '../../stores/projectStore';
import { Button } from '../../components/common/Button';
import { Card } from '../../components/common/Card';
import { CreateSchoolModal } from '../../components/admin/CreateSchoolModal';
import { getAllSchools, getAllProjects, getSchoolsInProject } from '../../services/firebase/firestore';
import { useAuth } from '../../features/auth/hooks/useAuth';
import type { SchoolDoc, ProjectDoc } from '../../types/firestore';

export default function SchoolsPage() {
  const { claims } = useAuth();
  const { setSchools } = useProjectStore();
  const [schools, setSchoolsLocal] = useState<Array<SchoolDoc & { id: string }>>([]);
  const [projects, setProjects] = useState<Array<ProjectDoc & { id: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateSchool, setShowCreateSchool] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterProject, setFilterProject] = useState<string>('all');

  const isProjectAdmin = claims?.role === 'projectAdmin';
  const myProjectId = claims?.projectId;

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      if (isProjectAdmin && myProjectId) {
        const schoolsData = await getSchoolsInProject(myProjectId);
        setSchoolsLocal(schoolsData);
        setSchools(schoolsData);
      } else {
        const [schoolsData, projectsData] = await Promise.all([
          getAllSchools(),
          getAllProjects(),
        ]);
        setSchoolsLocal(schoolsData);
        setProjects(projectsData);
        setSchools(schoolsData);
      }
    } catch (error) {
      console.error('Error loading schools:', error);
    } finally {
      setLoading(false);
    }
  }

  const filteredSchools = schools.filter((school) => {
    const matchesSearch =
      school.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      school.code.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesProject =
      isProjectAdmin ||
      filterProject === 'all' ||
      (filterProject === 'unassigned' && !school.projectId) ||
      school.projectId === filterProject;
    return matchesSearch && matchesProject;
  });

  const stats = {
    total: schools.length,
    assigned: schools.filter((s) => s.projectId).length,
    unassigned: schools.filter((s) => !s.projectId).length,
  };

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="mb-xl"
      >
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-sm mb-md">
          <h1 className="font-baloo font-bold text-xl sm:text-xxl text-text-dark">
            Schools Management 🏫
          </h1>
          <Button
            title="Add School"
            onPress={() => setShowCreateSchool(true)}
            variant="primary"
            size="sm"
            className="w-auto self-start sm:self-auto"
            icon={<span>➕</span>}
          />
        </div>
        <p className="font-baloo text-sm sm:text-lg text-text-muted">
          {isProjectAdmin ? 'Schools in your project' : 'Manage all schools across projects'}
        </p>
      </motion.div>

      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* Stats */}
          <div className="grid grid-cols-3 gap-sm sm:gap-md mb-lg sm:mb-xl">
            {[
              { label: 'Total Schools', count: stats.total, icon: '🏫', color: 'bg-gradient-to-br from-lavender-light to-primary/20' },
              { label: 'Assigned', count: stats.assigned, icon: '✅', color: 'bg-gradient-to-br from-mint-light to-secondary/20' },
              ...(!isProjectAdmin ? [{ label: 'Unassigned', count: stats.unassigned, icon: '⚠️', color: 'bg-gradient-to-br from-peach-light to-accent/20' }] : []),
            ].map((stat, index) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3, delay: index * 0.1 }}
              >
                <Card className={`${stat.color}`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-baloo text-xs sm:text-md text-text-muted mb-sm">{stat.label}</p>
                      <h3 className="font-baloo font-extrabold text-xl sm:text-hero text-text-dark">
                        {stat.count}
                      </h3>
                    </div>
                    <span className="text-2xl sm:text-4xl">{stat.icon}</span>
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
                    placeholder="Search schools by name or code..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full px-md py-sm sm:py-md rounded-lg border-2 border-divider bg-white font-baloo text-sm sm:text-body focus:border-primary focus:outline-none"
                  />
                </div>
                {!isProjectAdmin && (
                  <div className="md:w-64">
                    <select
                      value={filterProject}
                      onChange={(e) => setFilterProject(e.target.value)}
                      className="w-full px-md py-sm sm:py-md rounded-lg border-2 border-divider bg-white font-baloo text-sm sm:text-body focus:border-primary focus:outline-none"
                    >
                      <option value="all">All Projects</option>
                      <option value="unassigned">Unassigned</option>
                      {projects.map((project) => (
                        <option key={project.id} value={project.name}>
                          {project.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            </Card>
          </motion.div>

          {/* Schools Grid */}
          {filteredSchools.length > 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.4, delay: 0.4 }}
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-md sm:gap-lg"
            >
              {filteredSchools.map((school, index) => (
                <motion.div
                  key={school.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: 0.4 + index * 0.05 }}
                  whileHover={{ scale: 1.02, y: -5 }}
                >
                  <Card className="hover:shadow-xl transition-shadow">
                    <div className="flex items-start gap-md mb-md">
                      <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-br from-secondary to-primary flex items-center justify-center shadow-lg">
                        <span className="text-3xl">🏫</span>
                      </div>
                      <div className="flex-1">
                        <h3 className="font-baloo font-bold text-lg text-text-dark mb-xs">
                          {school.name}
                        </h3>
                        <div className="flex items-center gap-xs">
                          <span className="font-baloo text-sm text-text-muted">Code:</span>
                          <span className="font-baloo font-semibold text-sm text-primary">
                            {school.code}
                          </span>
                        </div>
                      </div>
                    </div>

                    {school.projectId ? (
                      <div className="bg-mint-light px-md py-sm rounded-lg border border-secondary/20">
                        <div className="flex items-center gap-xs">
                          <span className="text-lg">📁</span>
                          <span className="font-baloo text-sm text-text-dark">{school.projectId}</span>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-rose-light px-md py-sm rounded-lg border border-error/20">
                        <div className="flex items-center gap-xs">
                          <span className="text-lg">⚠️</span>
                          <span className="font-baloo text-sm text-error font-semibold">
                            Not assigned to project
                          </span>
                        </div>
                      </div>
                    )}

                    <div className="mt-md pt-md border-t border-divider">
                      <div className="flex items-center justify-between text-xs text-text-muted font-baloo">
                        <span>Created: {new Date(school.createdAt?.seconds * 1000 || Date.now()).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </Card>
                </motion.div>
              ))}
            </motion.div>
          ) : (
            <Card className="text-center py-lg sm:py-xxl">
              <span className="text-4xl sm:text-6xl mb-md block">🔍</span>
              <h3 className="font-baloo font-bold text-lg sm:text-xl text-text-dark mb-sm">
                No schools found
              </h3>
              <p className="font-baloo text-sm sm:text-body text-text-muted">
                {searchQuery ? 'Try adjusting your filters' : 'Get started by creating your first school'}
              </p>
            </Card>
          )}
        </>
      )}

      <CreateSchoolModal
        isOpen={showCreateSchool}
        onClose={() => setShowCreateSchool(false)}
        onSuccess={loadData}
      />
    </div>
  );
}
