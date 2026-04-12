import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { collection, query, where, getCountFromServer } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useAuth } from '../../features/auth/hooks/useAuth';
import { useProjectStore } from '../../stores/projectStore';
import { useCurriculumStore } from '../../stores/curriculumStore';
import { Card, StatCard } from '../../components/common/Card';
import { CreateProjectModal } from '../../components/admin/CreateProjectModal';
import { CreateSchoolModal } from '../../components/admin/CreateSchoolModal';
import { Button } from '../../components/common/Button';
import { getAllProjects, getAllSchools, getProject, getSchoolsInProject } from '../../services/firebase/firestore';
import type { ProjectDoc, SchoolDoc } from '../../types/firestore';

type ProjectWithId = ProjectDoc & { id: string };
type SchoolWithId = SchoolDoc & { id: string };

export default function AdminDashboardPage() {
  const { claims } = useAuth();
  const { setProjects, setSchools } = useProjectStore();
  const { pendingWordsCount, pendingEditsCount, refreshBadgeCounts } = useCurriculumStore();

  const [projects, setProjectsLocal] = useState<ProjectWithId[]>([]);
  const [schools, setSchoolsLocal] = useState<SchoolWithId[]>([]);
  const [loading, setLoading] = useState(true);
  const [wordBankCount, setWordBankCount] = useState<number | null>(null);
  const [licenseCount, setLicenseCount] = useState<number | null>(null);
  const [showCreateProject, setShowCreateProject] = useState(false);
  const [showCreateSchool, setShowCreateSchool] = useState(false);

  const isProjectAdmin = claims?.role === 'projectAdmin';
  const myProjectId = claims?.projectId;
  const canSeeAllProjects = claims?.role === 'admin';

  useEffect(() => {
    loadData();
    refreshBadgeCounts();
    loadCounters();
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
    } catch (e) {
      console.error('Error loading data:', e);
    } finally {
      setLoading(false);
    }
  }

  async function loadCounters() {
    try {
      const [wbSnap, lkSnap] = await Promise.all([
        getCountFromServer(collection(db, 'wordBank')),
        getCountFromServer(query(collection(db, 'licenseKeys'), where('status', '==', 'unused'))),
      ]);
      setWordBankCount(wbSnap.data().count);
      setLicenseCount(lkSnap.data().count);
    } catch (e) {
      console.error('Error loading counters:', e);
    }
  }

  const stats: Array<{ icon: string; value: string | number; label: string; tone: 'primary' | 'secondary' | 'accent' | 'warning' | 'muted' }> = [
    { icon: '🏫', value: schools.length,        label: 'Total Schools',              tone: 'secondary' },
    { icon: '📁', value: projects.length,        label: canSeeAllProjects ? 'Total Projects' : 'Your Project', tone: 'primary' },
    { icon: '📚', value: wordBankCount ?? '—',   label: 'Words in Word Bank',         tone: 'accent' },
    { icon: '⏳', value: pendingWordsCount,       label: 'Pending Word Approvals',     tone: pendingWordsCount > 0 ? 'warning' : 'muted' },
    { icon: '🔍', value: pendingEditsCount,       label: 'Pending Curriculum Reviews', tone: pendingEditsCount > 0 ? 'warning' : 'muted' },
    { icon: '🔑', value: licenseCount ?? '—',    label: 'Active License Keys',        tone: 'primary' },
  ];

  return (
    <div className="max-w-7xl mx-auto space-y-xl">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
      >
        <h1 className="font-baloo font-extrabold text-xxl text-text-dark">
          {canSeeAllProjects ? 'Super Admin Dashboard' : 'Project Admin Dashboard'}
        </h1>
        <p className="font-baloo text-text-muted mt-xs">
          Platform overview and pending actions
        </p>
      </motion.div>

      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* Stat Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-sm sm:gap-md">
            {stats.map((stat, i) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, delay: i * 0.04 }}
              >
                <StatCard icon={stat.icon} value={stat.value} label={stat.label} tone={stat.tone} />
              </motion.div>
            ))}
          </div>

          {/* Pending Actions Panel */}
          {(pendingWordsCount > 0 || pendingEditsCount > 0) && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.2 }}
            >
              <Card className="bg-amber-50 border border-amber-200">
                <h2 className="font-baloo font-bold text-lg text-text-dark mb-md flex items-center gap-sm">
                  <span>⚠️</span> Pending Actions
                </h2>
                <div className="space-y-sm">
                  {pendingWordsCount > 0 && (
                    <div className="flex items-center justify-between bg-white rounded-xl px-md py-sm shadow-sm">
                      <div className="flex items-center gap-sm">
                        <span className="text-xl">📝</span>
                        <p className="font-baloo font-semibold text-sm text-text-dark">
                          Word submissions: <span className="text-amber-600 font-bold">{pendingWordsCount}</span> pending
                        </p>
                      </div>
                      <Link
                        to="/admin/word-bank"
                        className="px-md py-xs bg-primary text-white font-baloo font-semibold text-xs rounded-lg hover:bg-primary/90 transition-colors"
                      >
                        Go to Word Bank →
                      </Link>
                    </div>
                  )}
                  {pendingEditsCount > 0 && (
                    <div className="flex items-center justify-between bg-white rounded-xl px-md py-sm shadow-sm">
                      <div className="flex items-center gap-sm">
                        <span className="text-xl">🔍</span>
                        <p className="font-baloo font-semibold text-sm text-text-dark">
                          Curriculum edits: <span className="text-amber-600 font-bold">{pendingEditsCount}</span> pending
                        </p>
                      </div>
                      <Link
                        to="/admin/reviews"
                        className="px-md py-xs bg-primary text-white font-baloo font-semibold text-xs rounded-lg hover:bg-primary/90 transition-colors"
                      >
                        Go to Reviews →
                      </Link>
                    </div>
                  )}
                </div>
              </Card>
            </motion.div>
          )}

          {/* Quick Actions */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.25 }}
            className="flex flex-wrap gap-sm"
          >
            {canSeeAllProjects && (
              <Button
                title="Create Project"
                onPress={() => setShowCreateProject(true)}
                variant="primary"
                size="sm"
                icon={<span>➕</span>}
              />
            )}
            <Button
              title="Create School"
              onPress={() => setShowCreateSchool(true)}
              variant="accent"
              size="sm"
              icon={<span>🏫</span>}
            />
          </motion.div>

          {/* Recent Projects Table */}
          {projects.length > 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3, delay: 0.3 }}
            >
              <div className="flex items-center justify-between mb-md">
                <h2 className="font-baloo font-bold text-xl text-text-dark">Recent Projects</h2>
                {canSeeAllProjects && (
                  <Link
                    to="/admin/projects"
                    className="font-baloo text-sm text-primary hover:underline"
                  >
                    View all →
                  </Link>
                )}
              </div>
              <div className="bg-white rounded-2xl shadow-sm border border-divider overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-lavender-light/30 border-b border-divider">
                        <th className="px-md py-sm text-left font-baloo font-bold text-sm text-text-dark">Project Name</th>
                        <th className="px-md py-sm text-left font-baloo font-bold text-sm text-text-dark">Schools</th>
                        <th className="px-md py-sm text-left font-baloo font-bold text-sm text-text-dark">Description</th>
                      </tr>
                    </thead>
                    <tbody>
                      {projects.slice(0, 8).map((project, i) => {
                        const schoolCount = schools.filter(s => s.projectId === project.name || s.projectId === project.id).length;
                        return (
                          <tr
                            key={project.id}
                            className={`border-b border-divider hover:bg-lavender-light/20 transition-colors ${i % 2 === 0 ? '' : 'bg-gray-50/30'}`}
                          >
                            <td className="px-md py-sm font-baloo font-semibold text-sm text-text-dark">
                              {project.name}
                            </td>
                            <td className="px-md py-sm">
                              <span className="px-sm py-xs bg-mint-light text-secondary font-baloo font-semibold text-xs rounded-full">
                                {schoolCount} school{schoolCount !== 1 ? 's' : ''}
                              </span>
                            </td>
                            <td className="px-md py-sm font-baloo text-sm text-text-muted">
                              {project.description || '—'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </motion.div>
          )}

          {/* Empty state */}
          {projects.length === 0 && schools.length === 0 && (
            <Card className="text-center py-xxl">
              <span className="text-6xl block mb-md">🚀</span>
              <h3 className="font-baloo font-bold text-xl text-text-dark mb-sm">
                Welcome to Chitram Management
              </h3>
              <p className="font-baloo text-body text-text-muted mb-lg">
                Get started by creating your first project and schools.
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
    </div>
  );
}
