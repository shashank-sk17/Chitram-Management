import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useProjectStore } from '../../stores/projectStore';
import { Button } from '../../components/common/Button';
import { Card } from '../../components/common/Card';
import { CreateProjectModal } from '../../components/admin/CreateProjectModal';
import { getAllProjects, getAllSchools, getProject, getSchoolsInProject } from '../../services/firebase/firestore';
import { useAuth } from '../../features/auth/hooks/useAuth';
import { usePermission } from '../../hooks/usePermission';
import type { ProjectDoc, SchoolDoc } from '../../types/firestore';

export default function ProjectsPage() {
  const navigate = useNavigate();
  const { claims } = useAuth();
  const { can } = usePermission();
  const { setProjects } = useProjectStore();
  const [projects, setProjectsLocal] = useState<Array<ProjectDoc & { id: string }>>([]);
  const [schools, setSchools] = useState<Array<SchoolDoc & { id: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateProject, setShowCreateProject] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const isProjectAdmin = claims?.role === 'projectAdmin';
  const myProjectId = claims?.projectId;

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      if (isProjectAdmin && myProjectId) {
        // Project admins see only their own project
        const [project, projectSchools] = await Promise.all([
          getProject(myProjectId),
          getSchoolsInProject(myProjectId),
        ]);
        const projectList = project ? [{ ...project, id: myProjectId }] : [];
        setProjectsLocal(projectList);
        setSchools(projectSchools);
        setProjects(projectList);
      } else {
        const [projectsData, schoolsData] = await Promise.all([
          getAllProjects(),
          getAllSchools(),
        ]);
        setProjectsLocal(projectsData);
        setSchools(schoolsData);
        setProjects(projectsData);
      }
    } catch (error) {
      console.error('Error loading projects:', error);
    } finally {
      setLoading(false);
    }
  }

  const filteredProjects = projects.filter((project) =>
    project.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    project.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getProjectStats = (projectId: string) => {
    const projectSchools = schools.filter((s) => s.projectId === projectId);
    return {
      schools: projectSchools.length,
      teachers: projectSchools.reduce((acc, s) => acc + (s.teacherIds?.length || 0), 0),
    };
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
        <div className="flex items-center justify-between gap-sm mb-md">
          <h1 className="font-baloo font-bold text-xl sm:text-xxl text-text-dark">
            {isProjectAdmin ? 'My Project' : 'Projects'}
          </h1>
          {can('projects.create') && (
            <Button
              title="Create Project"
              onPress={() => setShowCreateProject(true)}
              variant="primary"
              size="sm"
              icon={<span>➕</span>}
            />
          )}
        </div>
        <p className="font-baloo text-sm sm:text-lg text-text-muted">
          {isProjectAdmin ? 'Details for your assigned project' : 'Manage educational projects and their schools'}
        </p>
      </motion.div>

      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* Stats — only for super admins */}
          {!isProjectAdmin && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-sm sm:gap-md mb-lg sm:mb-xl">
              {[
                { label: 'Total Projects', count: projects.length, icon: '📁', color: 'bg-lavender-light' },
                { label: 'Total Schools', count: schools.filter((s) => s.projectId).length, icon: '🏫', color: 'bg-mint-light' },
                { label: 'Unassigned Schools', count: schools.filter((s) => !s.projectId).length, icon: '⚠️', color: 'bg-peach-light' },
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
                        <h3 className="font-baloo font-extrabold text-xl sm:text-hero text-text-dark">{stat.count}</h3>
                      </div>
                      <span className="text-2xl sm:text-4xl">{stat.icon}</span>
                    </div>
                  </Card>
                </motion.div>
              ))}
            </div>
          )}

          {/* Search — only for super admins with multiple projects */}
          {!isProjectAdmin && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.3 }}
              className="mb-lg"
            >
              <Card className="bg-white">
                <input
                  type="text"
                  placeholder="Search projects..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full px-md py-sm sm:py-md rounded-lg border-2 border-divider bg-white font-baloo text-sm sm:text-body focus:border-primary focus:outline-none"
                />
              </Card>
            </motion.div>
          )}

          {/* Projects Grid */}
          {filteredProjects.length > 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.4, delay: isProjectAdmin ? 0.1 : 0.4 }}
              className="grid grid-cols-1 md:grid-cols-2 gap-md sm:gap-lg"
            >
              {filteredProjects.map((project, index) => {
                const projStats = getProjectStats(project.id);
                return (
                  <motion.div
                    key={project.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: (isProjectAdmin ? 0.1 : 0.4) + index * 0.1 }}
                    whileHover={{ scale: 1.02, y: -5 }}
                    className="cursor-pointer"
                    onClick={() => navigate(`/admin/projects/${project.id}`)}
                  >
                    <Card className="hover:shadow-xl transition-shadow bg-white">
                      <div className="flex items-start gap-md mb-lg">
                        <div className="w-12 h-12 sm:w-20 sm:h-20 rounded-2xl bg-primary flex items-center justify-center shadow-lg">
                          <span className="text-2xl sm:text-4xl">📁</span>
                        </div>
                        <div className="flex-1">
                          <h3 className="font-baloo font-bold text-lg sm:text-xl text-text-dark mb-sm">
                            {project.name}
                          </h3>
                          {project.description && (
                            <p className="font-baloo text-md text-text-muted">{project.description}</p>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-md">
                        <div className="bg-white/80 backdrop-blur px-md py-md rounded-lg border border-secondary/20">
                          <div className="flex items-center gap-sm mb-xs">
                            <span className="text-2xl">🏫</span>
                            <span className="font-baloo text-xs text-text-muted">Schools</span>
                          </div>
                          <p className="font-baloo font-extrabold text-lg sm:text-xxl text-text-dark">
                            {projStats.schools}
                          </p>
                        </div>
                        <div className="bg-white/80 backdrop-blur px-md py-md rounded-lg border border-accent/20">
                          <div className="flex items-center gap-sm mb-xs">
                            <span className="text-2xl">👨‍🏫</span>
                            <span className="font-baloo text-xs text-text-muted">Teachers</span>
                          </div>
                          <p className="font-baloo font-extrabold text-lg sm:text-xxl text-text-dark">
                            {projStats.teachers}
                          </p>
                        </div>
                      </div>

                      <div className="mt-md pt-md border-t border-divider">
                        <div className="text-xs text-text-muted font-baloo">
                          Created: {new Date(project.createdAt?.seconds * 1000 || Date.now()).toLocaleDateString()}
                        </div>
                      </div>
                    </Card>
                  </motion.div>
                );
              })}
            </motion.div>
          ) : (
            <Card className="text-center py-lg sm:py-xxl">
              <span className="text-4xl sm:text-6xl mb-md block">{searchQuery ? '🔍' : '🚀'}</span>
              <h3 className="font-baloo font-bold text-lg sm:text-xl text-text-dark mb-sm">
                {searchQuery ? 'No projects found' : 'No projects yet'}
              </h3>
              <p className="font-baloo text-sm sm:text-body text-text-muted mb-lg">
                {searchQuery ? 'Try a different search term' : 'Create your first project to get started'}
              </p>
              {!searchQuery && !isProjectAdmin && (
                <Button title="Create Your First Project" onPress={() => setShowCreateProject(true)} variant="primary" />
              )}
            </Card>
          )}
        </>
      )}

      {!isProjectAdmin && (
        <CreateProjectModal
          isOpen={showCreateProject}
          onClose={() => setShowCreateProject(false)}
          onSuccess={loadData}
        />
      )}
    </div>
  );
}
