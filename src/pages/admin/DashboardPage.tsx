import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '../../features/auth/hooks/useAuth';
import { useProjectStore } from '../../stores/projectStore';
import { Button } from '../../components/common/Button';
import { Card } from '../../components/common/Card';
import { CreateProjectModal } from '../../components/admin/CreateProjectModal';
import { CreateSchoolModal } from '../../components/admin/CreateSchoolModal';
import { InviteUserModal } from '../../components/admin/InviteUserModal';
import { getAllProjects, getAllSchools, getProject, getSchoolsInProject } from '../../services/firebase/firestore';
import type { ProjectDoc, SchoolDoc } from '../../types/firestore';

export default function AdminDashboardPage() {
  const { user, claims } = useAuth();
  const { setProjects, setSchools } = useProjectStore();
  const [projects, setProjectsLocal] = useState<Array<ProjectDoc & { id: string }>>([]);
  const [schools, setSchoolsLocal] = useState<Array<SchoolDoc & { id: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateProject, setShowCreateProject] = useState(false);
  const [showCreateSchool, setShowCreateSchool] = useState(false);
  const [showInviteUser, setShowInviteUser] = useState(false);

  const isProjectAdmin = claims?.role === 'projectAdmin';
  const myProjectId = claims?.projectId;

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      if (isProjectAdmin && myProjectId) {
        const [project, schoolsData] = await Promise.all([
          getProject(myProjectId),
          getSchoolsInProject(myProjectId),
        ]);
        const projectList = project ? [{ ...project, id: myProjectId }] : [];
        setProjectsLocal(projectList);
        setSchoolsLocal(schoolsData);
        setProjects(projectList);
        setSchools(schoolsData);
      } else {
        const [projectsData, schoolsData] = await Promise.all([
          getAllProjects(),
          getAllSchools(),
        ]);
        setProjectsLocal(projectsData);
        setSchoolsLocal(schoolsData);
        setProjects(projectsData);
        setSchools(schoolsData);
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  }

  const canSeeAllProjects = claims?.role === 'admin';
  const unassignedSchools = schools.filter((s) => !s.projectId);

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="mb-xl"
      >
        <h1 className="font-baloo font-bold text-xl sm:text-xxl text-text-dark mb-sm">
          {claims?.role === 'admin' ? 'Super Admin Dashboard' : 'Project Admin Dashboard'} 👑
        </h1>
        <p className="font-baloo text-sm sm:text-lg text-text-muted">
          {user?.email}
        </p>
      </motion.div>

      {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
        <>
          {/* Stats Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-sm sm:gap-md mb-lg sm:mb-xl">
            {[
              {
                icon: '📁',
                count: projects.length,
                label: canSeeAllProjects ? 'Total Projects' : 'Your Project',
                color: 'bg-gradient-to-br from-lavender-light to-primary/20',
              },
              {
                icon: '🏫',
                count: schools.filter((s) => s.projectId).length,
                label: 'Schools in Projects',
                color: 'bg-gradient-to-br from-mint-light to-secondary/20',
              },
              ...(!isProjectAdmin ? [{
                icon: '📋',
                count: unassignedSchools.length,
                label: 'Unassigned Schools',
                color: 'bg-gradient-to-br from-peach-light to-accent/20',
              }] : []),
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
                    <div className="w-12 h-12 sm:w-20 sm:h-20 rounded-2xl bg-white/50 flex items-center justify-center mx-auto mb-md shadow-md">
                      <span className="text-2xl sm:text-4xl">{stat.icon}</span>
                    </div>
                    <h3 className="font-baloo font-extrabold text-xl sm:text-hero text-text-dark mb-sm">
                      {stat.count}
                    </h3>
                    <p className="font-baloo text-xs sm:text-body text-text-muted font-semibold">
                      {stat.label}
                    </p>
                  </div>
                </Card>
              </motion.div>
            ))}
          </div>

          {/* Action Buttons - Only show if user has permission */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.3 }}
            className="flex flex-col sm:flex-row gap-sm sm:gap-md mb-lg sm:mb-xl"
          >
            {canSeeAllProjects && (
              <Button
                title="Create Project"
                onPress={() => setShowCreateProject(true)}
                variant="primary"
                size="sm"
                className="w-auto self-start sm:self-auto"
                icon={<span>➕</span>}
              />
            )}
            {(canSeeAllProjects || claims?.role === 'projectAdmin') && (
              <Button
                title="Create School"
                onPress={() => setShowCreateSchool(true)}
                variant="accent"
                size="sm"
                className="w-auto self-start sm:self-auto"
                icon={<span>🏫</span>}
              />
            )}
            {canSeeAllProjects && (
              <Button
                title="Invite User"
                onPress={() => setShowInviteUser(true)}
                variant="secondary"
                size="sm"
                className="w-auto self-start sm:self-auto"
                icon={<span>👤</span>}
              />
            )}
          </motion.div>

          {/* Projects List */}
          {projects.length > 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.4, delay: 0.4 }}
              className="mb-xl"
            >
              <h2 className="font-baloo font-bold text-xl text-text-dark mb-md">
                Projects
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-md sm:gap-lg">
                {projects.map((project) => {
                  const schoolCount = schools.filter(
                    (s) => s.projectId === project.name
                  ).length;

                  return (
                    <Card key={project.id}>
                      <div className="flex items-start justify-between mb-md">
                        <div>
                          <h3 className="font-baloo font-bold text-lg text-text-dark">
                            {project.name}
                          </h3>
                          {project.description && (
                            <p className="font-baloo text-md text-text-muted">
                              {project.description}
                            </p>
                          )}
                        </div>
                        <div className="bg-lavender-light px-md py-sm rounded-full">
                          <span className="font-baloo font-semibold text-sm text-primary">
                            {schoolCount} schools
                          </span>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            </motion.div>
          )}

          {/* Schools List */}
          {schools.length > 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.4, delay: 0.5 }}
            >
              <h2 className="font-baloo font-bold text-xl text-text-dark mb-md">
                All Schools
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-md sm:gap-lg">
                {schools.map((school) => (
                  <Card key={school.id}>
                    <div className="flex items-center gap-md mb-md">
                      <div className="w-12 h-12 rounded-full bg-secondary/20 flex items-center justify-center">
                        <span className="text-2xl">🏫</span>
                      </div>
                      <div className="flex-1">
                        <h3 className="font-baloo font-bold text-body text-text-dark">
                          {school.name}
                        </h3>
                        <p className="font-baloo text-sm text-text-muted">
                          Code: {school.code}
                        </p>
                      </div>
                    </div>
                    {school.projectId && (
                      <div className="bg-mint-light px-md py-sm rounded-lg">
                        <p className="font-baloo text-sm text-text-body">
                          📁 Project: {school.projectId}
                        </p>
                      </div>
                    )}
                    {!school.projectId && (
                      <div className="bg-rose-light px-md py-sm rounded-lg">
                        <p className="font-baloo text-sm text-error">
                          ⚠️ Not assigned to project
                        </p>
                      </div>
                    )}
                  </Card>
                ))}
              </div>
            </motion.div>
          )}

          {/* Empty State */}
          {projects.length === 0 && schools.length === 0 && (
            <Card className="text-center py-lg sm:py-xxl">
              <div className="w-24 h-24 rounded-full bg-lavender-light flex items-center justify-center mx-auto mb-md">
                <span className="text-4xl sm:text-5xl">🚀</span>
              </div>
              <h3 className="font-baloo font-bold text-lg sm:text-xl text-text-dark mb-sm">
                Welcome to Chitram Management
              </h3>
              <p className="font-baloo text-sm sm:text-body text-text-muted mb-lg">
                Get started by creating your first project and schools
              </p>
              {canSeeAllProjects && (
                <Button
                  title="Create Your First Project"
                  onPress={() => setShowCreateProject(true)}
                  variant="primary"
                />
              )}
            </Card>
          )}
        </>
      )}

      {/* Modals */}
      <CreateProjectModal
        isOpen={showCreateProject}
        onClose={() => setShowCreateProject(false)}
        onSuccess={loadData}
      />
      <CreateSchoolModal
        isOpen={showCreateSchool}
        onClose={() => setShowCreateSchool(false)}
        onSuccess={loadData}
      />
      <InviteUserModal
        isOpen={showInviteUser}
        onClose={() => setShowInviteUser(false)}
        onSuccess={loadData}
      />
    </div>
  );
}
