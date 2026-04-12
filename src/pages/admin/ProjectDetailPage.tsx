import { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { getProject, getSchoolsInProject, getTeachersBySchool, removeSchoolFromProject } from '../../services/firebase/firestore';
import { Skeleton, StatCardSkeleton } from '../../components/common/Skeleton';
import type { ProjectDoc, SchoolDoc, StudentDoc } from '../../types/firestore';

type WithId<T> = T & { id: string };

interface SchoolMetrics {
  schoolId: string;
  totalStudents: number;
  activeToday: number;
  activeLast7d: number;
  activeRate: number;
  avgStreak: number;
  totalWordsLearned: number;
  teacherCount: number;
}

function ActivityBar({ pct }: { pct: number }) {
  return (
    <div className="flex items-center gap-2 min-w-[80px]">
      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${pct >= 70 ? 'bg-green-500' : pct >= 30 ? 'bg-amber-400' : 'bg-red-400'}`}
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>
      <span className="text-xs text-gray-500 w-7 text-right">{pct}%</span>
    </div>
  );
}

export default function ProjectDetailPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [project, setProject] = useState<WithId<ProjectDoc> | null>(null);
  const [schools, setSchools] = useState<WithId<SchoolDoc>[]>([]);
  const [studentDocs, setStudentDocs] = useState<WithId<StudentDoc>[]>([]);
  const [teacherCounts, setTeacherCounts] = useState<Map<string, number>>(new Map());
  const [removing, setRemoving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (projectId) loadData(projectId);
  }, [projectId]);

  async function loadData(pid: string) {
    setLoading(true);
    setError(null);
    try {
      const [projectData, schoolsData] = await Promise.all([
        getProject(pid),
        getSchoolsInProject(pid),
      ]);

      if (!projectData) {
        setError('Project not found.');
        setLoading(false);
        return;
      }

      setProject({ ...projectData, id: pid });
      setSchools(schoolsData);

      // Load students for all schools
      if (schoolsData.length > 0) {
        const schoolIds = schoolsData.map(s => s.id);
        const chunks: string[][] = [];
        for (let i = 0; i < schoolIds.length; i += 30) chunks.push(schoolIds.slice(i, i + 30));
        const allStudents: WithId<StudentDoc>[] = [];
        for (const chunk of chunks) {
          const snap = await getDocs(query(collection(db, 'students'), where('schoolId', 'in', chunk)));
          snap.docs.forEach(d => allStudents.push({ id: d.id, ...(d.data() as StudentDoc) }));
        }
        setStudentDocs(allStudents);

        // Load teacher counts per school
        const tcMap = new Map<string, number>();
        await Promise.all(schoolsData.map(async (school) => {
          try {
            const teachers = await getTeachersBySchool(school.id);
            tcMap.set(school.id, teachers.length);
          } catch {
            tcMap.set(school.id, school.teacherIds?.length ?? 0);
          }
        }));
        setTeacherCounts(tcMap);
      }
    } catch (e) {
      console.error('Error loading project detail:', e);
      setError('Failed to load project data.');
    } finally {
      setLoading(false);
    }
  }

  const schoolMetrics = useMemo((): Map<string, SchoolMetrics> => {
    const today = new Date().toISOString().split('T')[0];
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const sevenDaysAgoStr = sevenDaysAgo.toISOString().split('T')[0];

    const map = new Map<string, SchoolMetrics>();
    for (const school of schools) {
      const ss = studentDocs.filter(s => s.schoolId === school.id);
      const n = ss.length;
      const teacherCount = teacherCounts.get(school.id) ?? school.teacherIds?.length ?? 0;
      if (n === 0) {
        map.set(school.id, { schoolId: school.id, totalStudents: 0, activeToday: 0, activeLast7d: 0, activeRate: 0, avgStreak: 0, totalWordsLearned: 0, teacherCount });
        continue;
      }
      const activeToday = ss.filter(s => s.analytics?.lastStudyDate === today).length;
      const activeLast7d = ss.filter(s => s.analytics?.lastStudyDate && s.analytics.lastStudyDate >= sevenDaysAgoStr).length;
      const activeRate = Math.round((activeLast7d / n) * 100);
      const avgStreak = Math.round(ss.reduce((a, s) => a + (s.analytics?.streakDays ?? 0), 0) / n);
      const totalWordsLearned = ss.reduce((sum, s) => sum + (s.analytics?.totalWordsLearned ?? 0), 0);
      map.set(school.id, { schoolId: school.id, totalStudents: n, activeToday, activeLast7d, activeRate, avgStreak, totalWordsLearned, teacherCount });
    }
    return map;
  }, [schools, studentDocs, teacherCounts]);

  const summaryStats = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    const totalStudents = studentDocs.length;
    const totalTeachers = Array.from(teacherCounts.values()).reduce((a, b) => a + b, 0);
    const activeToday = studentDocs.filter(s => s.analytics?.lastStudyDate === today).length;
    return { schools: schools.length, teachers: totalTeachers, students: totalStudents, activeToday };
  }, [schools, studentDocs, teacherCounts]);

  async function handleUnassign(schoolId: string) {
    if (!projectId) return;
    if (!confirm('Remove this school from the project?')) return;
    setRemoving(schoolId);
    try {
      await removeSchoolFromProject(projectId, schoolId);
      setSchools(prev => prev.filter(s => s.id !== schoolId));
      setStudentDocs(prev => prev.filter(s => s.schoolId !== schoolId));
    } catch (e) {
      console.error('Failed to unassign school:', e);
      alert('Failed to remove school from project.');
    } finally {
      setRemoving(null);
    }
  }

  const createdDate = project?.createdAt
    ? new Date((project.createdAt as any).seconds * 1000).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
    : null;

  if (error) {
    return (
      <div className="max-w-5xl mx-auto py-12 text-center">
        <p className="text-gray-500 font-baloo text-lg">{error}</p>
        <button onClick={() => navigate('/admin/projects')} className="mt-4 text-primary font-baloo text-sm underline">
          Back to Projects
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm font-baloo text-gray-500 mb-6">
        <button onClick={() => navigate('/admin/projects')} className="hover:text-primary transition-colors">
          Projects
        </button>
        <span>/</span>
        {loading ? (
          <Skeleton className="h-4 w-32 inline-block" />
        ) : (
          <span className="text-text-dark font-semibold">{project?.name}</span>
        )}
      </nav>

      {/* Header */}
      {loading ? (
        <div className="mb-8">
          <Skeleton className="h-8 w-64 mb-2" />
          <Skeleton className="h-4 w-96" />
        </div>
      ) : (
        <div className="mb-8">
          <h1 className="font-baloo font-bold text-2xl text-text-dark mb-1">{project?.name}</h1>
          {project?.description && (
            <p className="font-baloo text-gray-500 text-base mb-1">{project.description}</p>
          )}
          {createdDate && (
            <p className="font-baloo text-xs text-gray-400">Created {createdDate}</p>
          )}
        </div>
      )}

      {/* Stats bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => <StatCardSkeleton key={i} />)
        ) : (
          [
            { label: 'Schools', value: summaryStats.schools },
            { label: 'Teachers', value: summaryStats.teachers },
            { label: 'Total Students', value: summaryStats.students },
            { label: 'Active Today', value: summaryStats.activeToday },
          ].map(stat => (
            <div key={stat.label} className="bg-white border border-gray-200 rounded-xl p-4">
              <p className="font-baloo text-xs text-gray-500 mb-1">{stat.label}</p>
              <p className="font-baloo font-bold text-2xl text-text-dark">{stat.value}</p>
            </div>
          ))
        )}
      </div>

      {/* Schools table */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="font-baloo font-semibold text-base text-text-dark">Schools in this project</h2>
        </div>
        {loading ? (
          <div className="p-5 space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : schools.length === 0 ? (
          <div className="px-5 py-10 text-center">
            <p className="font-baloo text-gray-400 text-sm">No schools assigned to this project yet.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm font-baloo">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">School</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Code</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Teachers</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Students</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Active Today</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Active Rate (7d)</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Avg Streak</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Words Learned</th>
                  <th className="w-8 px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {schools.map(school => {
                  const m = schoolMetrics.get(school.id);
                  return (
                    <tr key={school.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-5 py-3">
                        <Link
                          to={`/admin/schools/${school.id}`}
                          className="font-semibold text-text-dark hover:text-primary transition-colors"
                        >
                          {school.name}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-gray-500 font-mono text-xs">{school.code}</td>
                      <td className="px-4 py-3 text-right text-gray-700">{m?.teacherCount ?? '—'}</td>
                      <td className="px-4 py-3 text-right text-gray-700">{m?.totalStudents ?? '—'}</td>
                      <td className="px-4 py-3 text-right text-gray-700">{m?.activeToday ?? '—'}</td>
                      <td className="px-4 py-3">
                        {m ? <ActivityBar pct={m.activeRate} /> : <span className="text-gray-400">—</span>}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-700">{m && m.totalStudents > 0 ? `${m.avgStreak}d` : '—'}</td>
                      <td className="px-4 py-3 text-right text-gray-700">{m?.totalWordsLearned ?? '—'}</td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => handleUnassign(school.id)}
                          disabled={removing === school.id}
                          title="Remove from project"
                          className="w-6 h-6 rounded flex items-center justify-center text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-30"
                        >
                          {removing === school.id ? '…' : '✕'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
