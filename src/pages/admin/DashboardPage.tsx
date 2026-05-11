import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import { collection, query, where, getCountFromServer } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useAuth } from '../../features/auth/hooks/useAuth';
import { useProjectStore } from '../../stores/projectStore';
import { useCurriculumStore } from '../../stores/curriculumStore';
import { StatCard } from '../../components/common/Card';
import { CreateProjectModal } from '../../components/admin/CreateProjectModal';
import { CreateSchoolModal } from '../../components/admin/CreateSchoolModal';
import { getAllProjects, getAllSchools, getProject, getSchoolsInProject } from '../../services/firebase/firestore';
import type { ProjectDoc, SchoolDoc } from '../../types/firestore';

type ProjectWithId = ProjectDoc & { id: string };
type SchoolWithId = SchoolDoc & { id: string };

export default function AdminDashboardPage() {
  const { claims } = useAuth();
  const navigate = useNavigate();
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

  const hasPending = pendingWordsCount > 0 || pendingEditsCount > 0;

  return (
    <div className="max-w-7xl mx-auto space-y-xl">

      {/* ── Page Header ─────────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="flex items-start justify-between gap-lg flex-wrap"
      >
        <div>
          <h1 className="font-baloo font-extrabold text-xl text-text-dark leading-tight">
            {canSeeAllProjects ? 'Super Admin Dashboard' : 'Project Dashboard'}
          </h1>
          <p className="font-baloo text-md text-text-muted mt-xs">
            Platform overview and pending actions
          </p>
        </div>
        {!loading && (
          <div className="flex items-center gap-sm flex-shrink-0">
            {canSeeAllProjects && (
              <button
                onClick={() => setShowCreateProject(true)}
                className="flex items-center gap-sm px-lg py-sm rounded-xl bg-primary text-white font-baloo font-bold text-md hover:bg-primary/90 transition-colors shadow-sm"
              >
                <span>＋</span> New Project
              </button>
            )}
            <button
              onClick={() => setShowCreateSchool(true)}
              className="flex items-center gap-sm px-lg py-sm rounded-xl font-baloo font-bold text-md transition-colors"
              style={{ background: '#EDEEFF', color: '#5558d9' }}
            >
              <span>🏫</span> Add School
            </button>
          </div>
        )}
      </motion.div>

      {loading ? (
        <div className="flex flex-col items-center justify-center h-64 gap-lg">
          <div className="w-12 h-12 border-[3px] border-primary border-t-transparent rounded-full animate-spin" />
          <p className="font-baloo text-md text-text-muted">Loading dashboard…</p>
        </div>
      ) : (
        <>
          {/* ── Pending Actions Banner ───────────────────────────────────── */}
          {hasPending && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
              className="rounded-2xl border-2 overflow-hidden"
              style={{ borderColor: '#FCD34D', background: '#FFFBEB' }}
            >
              <div className="flex items-center gap-md px-lg py-md" style={{ background: '#FEF3C7', borderBottom: '1px solid #FCD34D' }}>
                <span className="text-xl">⚠️</span>
                <p className="font-baloo font-bold text-md" style={{ color: '#92400E' }}>
                  Action Required — {(pendingWordsCount > 0 ? 1 : 0) + (pendingEditsCount > 0 ? 1 : 0)} item{(pendingWordsCount > 0 ? 1 : 0) + (pendingEditsCount > 0 ? 1 : 0) !== 1 ? 's' : ''} need your attention
                </p>
              </div>
              <div className="divide-y" style={{ borderColor: '#FDE68A' }}>
                {pendingWordsCount > 0 && (
                  <div className="flex items-center justify-between px-lg py-md">
                    <div className="flex items-center gap-md">
                      <span className="text-xl">📝</span>
                      <p className="font-baloo text-md font-semibold" style={{ color: '#78350F' }}>
                        <span className="font-extrabold" style={{ color: '#D97706' }}>{pendingWordsCount}</span> word{pendingWordsCount !== 1 ? 's' : ''} pending approval
                      </p>
                    </div>
                    <button
                      onClick={() => navigate('/admin/word-bank')}
                      className="font-baloo font-bold text-sm px-lg py-sm rounded-xl transition-colors"
                      style={{ background: '#D97706', color: 'white' }}
                    >
                      Review →
                    </button>
                  </div>
                )}
                {pendingEditsCount > 0 && (
                  <div className="flex items-center justify-between px-lg py-md">
                    <div className="flex items-center gap-md">
                      <span className="text-xl">🔍</span>
                      <p className="font-baloo text-md font-semibold" style={{ color: '#78350F' }}>
                        <span className="font-extrabold" style={{ color: '#D97706' }}>{pendingEditsCount}</span> curriculum edit{pendingEditsCount !== 1 ? 's' : ''} pending review
                      </p>
                    </div>
                    <button
                      onClick={() => navigate('/admin/reviews')}
                      className="font-baloo font-bold text-sm px-lg py-sm rounded-xl transition-colors"
                      style={{ background: '#D97706', color: 'white' }}
                    >
                      Review →
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* ── Stat Cards ───────────────────────────────────────────────── */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-md">
            {[
              { icon: '🏫', value: schools.length,       label: 'Total Schools',                            tone: 'secondary' as const },
              { icon: '📁', value: projects.length,      label: canSeeAllProjects ? 'Total Projects' : 'Your Project', tone: 'primary' as const },
              { icon: '📚', value: wordBankCount ?? '—', label: 'Words in Bank',                            tone: 'accent' as const },
              { icon: '⏳', value: pendingWordsCount,    label: 'Pending Approvals',                        tone: pendingWordsCount > 0 ? 'warning' as const : 'muted' as const },
              { icon: '🔍', value: pendingEditsCount,    label: 'Curriculum Reviews',                       tone: pendingEditsCount > 0 ? 'warning' as const : 'muted' as const },
              { icon: '🔑', value: licenseCount ?? '—',  label: 'Available License Keys',                   tone: 'primary' as const },
            ].map((stat, i) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, delay: i * 0.05 }}
              >
                <StatCard icon={stat.icon} value={stat.value} label={stat.label} tone={stat.tone} />
              </motion.div>
            ))}
          </div>

          {/* ── Recent Projects ──────────────────────────────────────────── */}
          {projects.length > 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3, delay: 0.25 }}
            >
              <div className="flex items-center justify-between mb-md">
                <h2 className="font-baloo font-bold text-lg text-text-dark">
                  {canSeeAllProjects ? 'All Projects' : 'Your Project'}
                </h2>
                {canSeeAllProjects && (
                  <Link to="/admin/projects" className="font-baloo font-semibold text-md text-primary hover:underline">
                    View all →
                  </Link>
                )}
              </div>

              <div className="bg-white rounded-2xl border border-divider shadow-sm overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr style={{ background: '#F7F6F3', borderBottom: '1px solid #F0EDE8' }}>
                      <th className="px-lg py-md text-left font-baloo font-bold text-sm text-text-muted uppercase tracking-wide">Project</th>
                      <th className="px-lg py-md text-left font-baloo font-bold text-sm text-text-muted uppercase tracking-wide hidden sm:table-cell">Schools</th>
                      <th className="px-lg py-md text-left font-baloo font-bold text-sm text-text-muted uppercase tracking-wide hidden md:table-cell">Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    {projects.slice(0, 8).map((project) => {
                      const schoolCount = schools.filter(s => s.projectId === project.name || s.projectId === project.id).length;
                      return (
                        <tr
                          key={project.id}
                          className="border-b border-divider last:border-0 hover:bg-lavender-light/20 transition-colors cursor-pointer"
                          onClick={() => navigate(`/admin/projects`)}
                        >
                          <td className="px-lg py-md">
                            <div className="flex items-center gap-md">
                              <div className="w-10 h-10 rounded-xl bg-lavender-light flex items-center justify-center text-xl flex-shrink-0">
                                📁
                              </div>
                              <span className="font-baloo font-bold text-md text-text-dark">{project.name}</span>
                            </div>
                          </td>
                          <td className="px-lg py-md hidden sm:table-cell">
                            <span
                              className="font-baloo font-semibold text-sm px-md py-xs rounded-full"
                              style={{ background: '#EBFFFE', color: '#00736a' }}
                            >
                              {schoolCount} school{schoolCount !== 1 ? 's' : ''}
                            </span>
                          </td>
                          <td className="px-lg py-md font-baloo text-md text-text-muted hidden md:table-cell">
                            {project.description || <span className="italic text-text-muted/60">No description</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </motion.div>
          )}

          {/* ── Empty State ──────────────────────────────────────────────── */}
          {projects.length === 0 && schools.length === 0 && (
            <motion.div
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white rounded-2xl border border-divider shadow-sm p-xxl text-center"
            >
              <span className="text-7xl block mb-lg">🚀</span>
              <h3 className="font-baloo font-extrabold text-xl text-text-dark mb-sm">
                Welcome to Chitram Management
              </h3>
              <p className="font-baloo text-md text-text-muted mb-xl max-w-sm mx-auto">
                Get started by creating your first project, then add schools to it.
              </p>
              {canSeeAllProjects && (
                <button
                  onClick={() => setShowCreateProject(true)}
                  className="px-xl py-md rounded-xl bg-primary text-white font-baloo font-bold text-md hover:bg-primary/90 transition-colors shadow-sm"
                >
                  Create Your First Project
                </button>
              )}
            </motion.div>
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
