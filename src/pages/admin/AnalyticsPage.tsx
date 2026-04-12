import { useEffect, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, StatCard } from '../../components/common/Card';
import { StatCardSkeleton, RowSkeleton } from '../../components/common/Skeleton';
import { useAuth } from '../../features/auth/hooks/useAuth';
import { useCurriculumStore } from '../../stores/curriculumStore';
import { getAllProjects, getAllSchools, getProject, getSchoolsInProject } from '../../services/firebase/firestore';
import {
  collection,
  getDocs,
  getDoc,
  getCountFromServer,
  query,
  where,
  orderBy,
  limit,
  doc,
} from 'firebase/firestore';
import { db } from '../../config/firebase';
import type { ProjectDoc, SchoolDoc, StudentDoc, LicenseKeyDoc } from '../../types/firestore';

type ProjectWithId = ProjectDoc & { id: string };
type SchoolWithId = SchoolDoc & { id: string };
type StudentWithId = StudentDoc & { id: string };

interface SchoolMetrics {
  schoolId: string;
  totalStudents: number;
  activeToday: number;
  activeLast7d: number;
  activeRate: number; // 0–100
  avgStreak: number;
  totalWordsLearned: number;
  avgAccuracy: number | null;
  teacherCount: number;
  tier: 'high' | 'medium' | 'low' | 'empty';
}

interface ProjectMetrics {
  projectId: string;
  totalSchools: number;
  totalStudents: number;
  activeToday: number;
  activeLast7d: number;
  avgStreak: number;
  totalWordsLearned: number;
}

interface HardestWord {
  wordId: string;
  wordName: string;
  count: number;
}

interface LicenseKeySummary {
  unused: number;
  active: number;
  expired: number;
  recentExpired: Array<{ key: string; expiresAt: string }>;
}

function TierBadge({ tier }: { tier: SchoolMetrics['tier'] }) {
  if (tier === 'empty') return <span className="px-sm py-xs rounded-full text-xs font-baloo font-semibold bg-gray-100 text-text-muted">No data</span>;
  if (tier === 'high') return <span className="px-sm py-xs rounded-full text-xs font-baloo font-semibold bg-success/10 text-success">High</span>;
  if (tier === 'medium') return <span className="px-sm py-xs rounded-full text-xs font-baloo font-semibold bg-amber-100 text-amber-700">Medium</span>;
  return <span className="px-sm py-xs rounded-full text-xs font-baloo font-semibold bg-error/10 text-error">Low</span>;
}

function ActivityBar({ pct }: { pct: number }) {
  return (
    <div className="flex items-center gap-sm w-full">
      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${pct >= 70 ? 'bg-success' : pct >= 30 ? 'bg-amber-400' : 'bg-error/60'}`}
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>
      <span className="font-baloo text-xs text-text-muted w-8 text-right">{pct}%</span>
    </div>
  );
}

export default function AdminAnalyticsPage() {
  const { claims } = useAuth();
  const { pendingWordsCount, pendingEditsCount, refreshBadgeCounts } = useCurriculumStore();

  const [loadingPhase1, setLoadingPhase1] = useState(true);
  const [projects, setProjects] = useState<ProjectWithId[]>([]);
  const [schools, setSchools] = useState<SchoolWithId[]>([]);
  const [wordBankCount, setWordBankCount] = useState<number | null>(null);
  const [unusedLicenseCount, setUnusedLicenseCount] = useState<number | null>(null);
  const [studentDocs, setStudentDocs] = useState<StudentWithId[]>([]);

  const [loadingPhase2, setLoadingPhase2] = useState(true);
  const [hardestWords, setHardestWords] = useState<HardestWord[] | null>(null);

  const [loadingPhase3, setLoadingPhase3] = useState(false);
  const [licenseKeySummary, setLicenseKeySummary] = useState<LicenseKeySummary | null>(null);
  const [churnedStudents, setChurnedStudents] = useState<StudentWithId[] | null>(null);

  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());

  const isProjectAdmin = claims?.role === 'projectAdmin';
  const myProjectId = claims?.projectId;

  useEffect(() => {
    loadData();
    refreshBadgeCounts();
  }, []);

  useEffect(() => {
    if (!loadingPhase1) loadPhase2(schools);
  }, [loadingPhase1]);

  useEffect(() => {
    if (!loadingPhase2 && !loadingPhase1) loadPhase3(studentDocs);
  }, [loadingPhase2]);

  async function loadData() {
    setLoadingPhase1(true);
    try {
      const [wbSnap, unusedSnap] = await Promise.all([
        getCountFromServer(collection(db, 'wordBank')),
        getCountFromServer(query(collection(db, 'licenseKeys'), where('status', '==', 'unused'))),
      ]);
      setWordBankCount(wbSnap.data().count);
      setUnusedLicenseCount(unusedSnap.data().count);

      if (isProjectAdmin && myProjectId) {
        const [project, schoolsData] = await Promise.all([
          getProject(myProjectId),
          getSchoolsInProject(myProjectId),
        ]);
        const projectList = project ? [{ ...project, id: myProjectId }] : [];
        setProjects(projectList);
        setSchools(schoolsData);

        if (schoolsData.length > 0) {
          const schoolIds = schoolsData.map(s => s.id);
          const chunks: string[][] = [];
          for (let i = 0; i < schoolIds.length; i += 30) chunks.push(schoolIds.slice(i, i + 30));
          const allDocs: StudentWithId[] = [];
          for (const chunk of chunks) {
            const sSnap = await getDocs(query(collection(db, 'students'), where('schoolId', 'in', chunk)));
            sSnap.docs.forEach(d => allDocs.push({ id: d.id, ...(d.data() as StudentDoc) }));
          }
          setStudentDocs(allDocs);
        }
      } else {
        const [projectsData, schoolsData, allStudentsSnap] = await Promise.all([
          getAllProjects(),
          getAllSchools(),
          getDocs(collection(db, 'students')),
        ]);
        setProjects(projectsData);
        setSchools(schoolsData);
        setStudentDocs(allStudentsSnap.docs.map(d => ({ id: d.id, ...(d.data() as StudentDoc) })));
      }
    } catch (e) {
      console.error('Error loading analytics phase 1:', e);
    } finally {
      setLoadingPhase1(false);
    }
  }

  async function loadPhase2(schoolList: SchoolWithId[]) {
    setLoadingPhase2(true);
    try {
      const schoolsToQuery = isProjectAdmin && myProjectId
        ? schoolList.filter(s => s.projectId === myProjectId)
        : schoolList.slice(0, 50);

      const wordCounts = new Map<string, number>();
      for (const schoolDoc of schoolsToQuery) {
        try {
          const statsSnap = await getDocs(query(collection(db, 'schools', schoolDoc.id, 'stats'), orderBy('date', 'desc'), limit(1)));
          if (!statsSnap.empty) {
            const struggling: string[] = statsSnap.docs[0].data().strugglingWordIds ?? [];
            for (const wid of struggling) wordCounts.set(wid, (wordCounts.get(wid) ?? 0) + 1);
          }
        } catch { /* no stats yet */ }
      }

      const topWords = Array.from(wordCounts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 10);
      const wordNames = new Map<string, string>();
      await Promise.all(topWords.map(async ([wid]) => {
        try {
          const wSnap = await getDoc(doc(db, 'wordBank', wid));
          wordNames.set(wid, wSnap.exists() ? ((wSnap.data() as Record<string, any>).word?.en ?? wid) : wid);
        } catch { wordNames.set(wid, wid); }
      }));

      setHardestWords(topWords.map(([wid, count]) => ({ wordId: wid, wordName: wordNames.get(wid) ?? wid, count })));
    } catch (e) {
      console.error('Error loading analytics phase 2:', e);
      setHardestWords([]);
    } finally {
      setLoadingPhase2(false);
    }
  }

  async function loadPhase3(stuDocs: StudentWithId[]) {
    setLoadingPhase3(true);
    try {
      const [unusedSnap, activeSnap, expiredSnap, recentExpiredSnap] = await Promise.all([
        getCountFromServer(query(collection(db, 'licenseKeys'), where('status', '==', 'unused'))),
        getCountFromServer(query(collection(db, 'licenseKeys'), where('status', '==', 'active'))),
        getCountFromServer(query(collection(db, 'licenseKeys'), where('status', '==', 'expired'))),
        getDocs(query(collection(db, 'licenseKeys'), where('status', '==', 'expired'), orderBy('expiresAt', 'desc'), limit(5))),
      ]);

      const recentExpired = recentExpiredSnap.docs.map(d => {
        const data = d.data() as LicenseKeyDoc;
        const ts = data.expiresAt;
        const expiresAt = ts ? ((ts as any).toDate ? (ts as any).toDate().toLocaleDateString() : String(ts)) : '—';
        return { key: data.key, expiresAt };
      });

      setLicenseKeySummary({
        unused: unusedSnap.data().count,
        active: activeSnap.data().count,
        expired: expiredSnap.data().count,
        recentExpired,
      });

      const cutoff14d = new Date();
      cutoff14d.setDate(cutoff14d.getDate() - 14);
      const cutoffStr = cutoff14d.toISOString().split('T')[0];
      setChurnedStudents(stuDocs.filter(s => {
        const last = s.analytics?.lastStudyDate;
        return !last || last < cutoffStr;
      }));
    } catch (e) {
      console.error('Error loading analytics phase 3:', e);
    } finally {
      setLoadingPhase3(false);
    }
  }

  // ── Per-school metrics ──────────────────────────────────────────────────────
  const schoolMetricsMap = useMemo((): Map<string, SchoolMetrics> => {
    const today = new Date().toISOString().split('T')[0];
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const sevenDaysAgoStr = sevenDaysAgo.toISOString().split('T')[0];

    const map = new Map<string, SchoolMetrics>();

    for (const school of schools) {
      const schoolStudents = studentDocs.filter(s => s.schoolId === school.id);
      const n = schoolStudents.length;
      if (n === 0) {
        map.set(school.id, {
          schoolId: school.id,
          totalStudents: 0,
          activeToday: 0,
          activeLast7d: 0,
          activeRate: 0,
          avgStreak: 0,
          totalWordsLearned: 0,
          avgAccuracy: null,
          teacherCount: school.teacherIds?.length ?? 0,
          tier: 'empty',
        });
        continue;
      }

      const activeToday = schoolStudents.filter(s => s.analytics?.lastStudyDate === today).length;
      const activeLast7d = schoolStudents.filter(s => s.analytics?.lastStudyDate && s.analytics.lastStudyDate >= sevenDaysAgoStr).length;
      const activeRate = Math.round((activeLast7d / n) * 100);
      const streaks = schoolStudents.map(s => s.analytics?.streakDays ?? 0);
      const avgStreak = Math.round(streaks.reduce((a, b) => a + b, 0) / n);
      const totalWordsLearned = schoolStudents.reduce((sum, s) => sum + (s.analytics?.totalWordsLearned ?? 0), 0);
      const accuracies = schoolStudents.map(s => s.analytics?.quizAccuracy).filter((x): x is number => typeof x === 'number');
      const avgAccuracy = accuracies.length > 0
        ? Math.round(accuracies.reduce((a, b) => a + b, 0) / accuracies.length)
        : null;
      const tier: SchoolMetrics['tier'] = activeRate >= 70 ? 'high' : activeRate >= 30 ? 'medium' : 'low';

      map.set(school.id, {
        schoolId: school.id,
        totalStudents: n,
        activeToday,
        activeLast7d,
        activeRate,
        avgStreak,
        totalWordsLearned,
        avgAccuracy,
        teacherCount: school.teacherIds?.length ?? 0,
        tier,
      });
    }
    return map;
  }, [schools, studentDocs]);

  // ── Per-project metrics ─────────────────────────────────────────────────────
  const projectMetricsMap = useMemo((): Map<string, ProjectMetrics> => {
    const map = new Map<string, ProjectMetrics>();
    for (const project of projects) {
      const projectSchools = schools.filter(s => s.projectId === project.id);
      let totalStudents = 0, activeToday = 0, activeLast7d = 0, totalStreak = 0, streakCount = 0, totalWords = 0;
      for (const school of projectSchools) {
        const m = schoolMetricsMap.get(school.id);
        if (!m) continue;
        totalStudents += m.totalStudents;
        activeToday += m.activeToday;
        activeLast7d += m.activeLast7d;
        totalStreak += m.avgStreak * m.totalStudents;
        streakCount += m.totalStudents;
        totalWords += m.totalWordsLearned;
      }
      map.set(project.id, {
        projectId: project.id,
        totalSchools: projectSchools.length,
        totalStudents,
        activeToday,
        activeLast7d,
        avgStreak: streakCount > 0 ? Math.round(totalStreak / streakCount) : 0,
        totalWordsLearned: totalWords,
      });
    }
    return map;
  }, [projects, schools, schoolMetricsMap]);

  // ── Platform-level learner stats ────────────────────────────────────────────
  const platformStats = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const sevenDaysAgoStr = sevenDaysAgo.toISOString().split('T')[0];
    const n = studentDocs.length;
    if (n === 0) return null;

    const activeToday = studentDocs.filter(s => s.analytics?.lastStudyDate === today).length;
    const activeLast7d = studentDocs.filter(s => s.analytics?.lastStudyDate && s.analytics.lastStudyDate >= sevenDaysAgoStr).length;
    const streaks = studentDocs.map(s => s.analytics?.streakDays ?? 0).filter(x => x > 0);
    const avgStreak = streaks.length > 0 ? Math.round(streaks.reduce((a, b) => a + b, 0) / streaks.length) : 0;
    const totalWordsLearned = studentDocs.reduce((sum, s) => sum + (s.analytics?.totalWordsLearned ?? 0), 0);
    const studentsWithLongStreaks = studentDocs.filter(s => (s.analytics?.streakDays ?? 0) >= 7).length;
    const activeSchoolIds = new Set(
      studentDocs.filter(s => s.analytics?.lastStudyDate && s.analytics.lastStudyDate >= sevenDaysAgoStr && s.schoolId).map(s => s.schoolId!)
    );

    return { n, activeToday, activeLast7d, avgStreak, totalWordsLearned, studentsWithLongStreaks, activeSchoolsLast7d: activeSchoolIds.size };
  }, [studentDocs]);

  // ── School leaderboard ──────────────────────────────────────────────────────
  const schoolLeaderboard = useMemo(() => {
    return schools
      .map(school => ({ school, metrics: schoolMetricsMap.get(school.id)! }))
      .filter(x => x.metrics && x.metrics.totalStudents > 0)
      .sort((a, b) => {
        // Primary sort: words learned per student (engagement quality)
        const aWps = a.metrics.totalStudents > 0 ? a.metrics.totalWordsLearned / a.metrics.totalStudents : 0;
        const bWps = b.metrics.totalStudents > 0 ? b.metrics.totalWordsLearned / b.metrics.totalStudents : 0;
        return bWps - aWps;
      })
      .slice(0, 8);
  }, [schools, schoolMetricsMap]);

  const projectById = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of projects) m.set(p.id, p.name);
    return m;
  }, [projects]);

  const pendingItems = pendingWordsCount + pendingEditsCount;
  const assignedSchools = schools.filter(s => s.projectId).length;

  return (
    <div className="max-w-7xl mx-auto space-y-xl">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
        <h1 className="font-baloo font-extrabold text-xxl text-text-dark">
          {claims?.role === 'admin' ? 'System Analytics' : 'Project Analytics'}
        </h1>
        <p className="font-baloo text-text-muted mt-xs">Platform-wide metrics, school health, and engagement data</p>
      </motion.div>

      {loadingPhase1 ? (
        <div className="space-y-lg">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-sm sm:gap-md">
            {Array.from({ length: 8 }).map((_, i) => <StatCardSkeleton key={i} />)}
          </div>
          <RowSkeleton rows={4} />
          <RowSkeleton rows={3} />
        </div>
      ) : (
        <>
          {/* ── Row 1: Core Platform Numbers ────────────────────────────── */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-sm sm:gap-md">
            {([
              { icon: '👨‍🎓', value: studentDocs.length,              label: 'Total Students',       tone: 'primary'   },
              { icon: '🏫',   value: assignedSchools,                  label: 'Active Schools',       tone: 'secondary' },
              { icon: '📁',   value: projects.length,                  label: 'Projects',             tone: 'accent'    },
              { icon: '📚',   value: wordBankCount ?? '—',             label: 'Words in Bank',        tone: 'primary'   },
              { icon: '⏳',   value: pendingItems,                     label: 'Pending Reviews',      tone: pendingItems > 0 ? 'warning' : 'muted' },
              { icon: '🗝️',  value: unusedLicenseCount ?? '—',        label: 'Unused License Keys',  tone: 'accent'    },
              { icon: '📅',   value: platformStats?.activeToday ?? 0,  label: 'Active Today',         tone: 'secondary' },
              { icon: '🏫',   value: platformStats?.activeSchoolsLast7d ?? 0, label: 'Schools Active (7d)', tone: 'primary' },
            ] as Array<{ icon: string; value: string | number; label: string; tone: 'primary' | 'secondary' | 'accent' | 'warning' | 'muted' }>).map((m, i) => (
              <motion.div key={m.label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25, delay: i * 0.04 }}>
                <StatCard icon={m.icon} value={m.value} label={m.label} tone={m.tone} />
              </motion.div>
            ))}
          </div>

          {/* ── Learner Engagement Summary ───────────────────────────────── */}
          {platformStats && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.15 }}>
              <Card className="bg-white border border-divider">
                <h2 className="font-baloo font-bold text-lg text-text-dark mb-md flex items-center gap-sm">
                  <span>📊</span> Learner Engagement
                </h2>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-sm">
                  {[
                    { icon: '📅', label: 'Active last 7 days',   value: platformStats.activeLast7d,                       sub: `of ${platformStats.n} students`,    tone: 'primary'   },
                    { icon: '🔥', label: 'Avg Streak',            value: `${platformStats.avgStreak}d`,                    sub: 'across active students',            tone: 'accent'    },
                    { icon: '✏️', label: 'Total Words Learned',   value: platformStats.totalWordsLearned.toLocaleString(), sub: 'all time, all students',            tone: 'secondary' },
                    { icon: '🏆', label: 'Streak ≥ 7 days',       value: platformStats.studentsWithLongStreaks,             sub: 'students on a 7d+ run',             tone: 'warning'   },
                  ].map(item => {
                    const iconBg: Record<string, string> = { primary: 'bg-lavender-light', accent: 'bg-peach-light', secondary: 'bg-mint-light', warning: 'bg-amber-50' };
                    return (
                      <div key={item.label} className="border border-divider rounded-xl px-md py-md bg-white">
                        <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-lg mb-sm ${iconBg[item.tone]}`}>{item.icon}</div>
                        <p className="font-baloo font-extrabold text-xl text-text-dark leading-none">{item.value}</p>
                        <p className="font-baloo text-xs font-semibold text-text-dark mt-xs">{item.label}</p>
                        <p className="font-baloo text-xs text-text-muted">{item.sub}</p>
                      </div>
                    );
                  })}
                </div>
              </Card>
            </motion.div>
          )}

          {/* ── Projects (expandable) ────────────────────────────────────── */}
          {projects.length > 0 && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.2 }}>
              <h2 className="font-baloo font-bold text-xl text-text-dark mb-md">Projects</h2>
              <div className="space-y-md">
                {projects.map(project => {
                  const pm = projectMetricsMap.get(project.id);
                  const projectSchools = schools.filter(s => s.projectId === project.id);
                  const isExpanded = expandedProjects.has(project.id);
                  const activePct = pm && pm.totalStudents > 0 ? Math.round((pm.activeLast7d / pm.totalStudents) * 100) : 0;

                  return (
                    <div key={project.id} className="bg-white rounded-2xl border border-divider shadow-sm overflow-hidden">
                      {/* Project header row */}
                      <button
                        className="w-full text-left px-lg py-md hover:bg-lavender-light/10 transition-colors"
                        onClick={() => setExpandedProjects(prev => {
                          const next = new Set(prev);
                          next.has(project.id) ? next.delete(project.id) : next.add(project.id);
                          return next;
                        })}
                      >
                        <div className="flex items-center gap-md">
                          <div className="w-10 h-10 rounded-xl bg-lavender-light flex items-center justify-center shrink-0">
                            <span className="text-xl">📁</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-baloo font-bold text-text-dark">{project.name}</p>
                            {project.description && (
                              <p className="font-baloo text-xs text-text-muted truncate">{project.description}</p>
                            )}
                          </div>
                          {/* Summary pills */}
                          <div className="hidden sm:flex items-center gap-sm">
                            <span className="px-sm py-xs bg-lavender-light rounded-full font-baloo text-xs text-text-dark font-semibold">
                              {pm?.totalSchools ?? 0} schools
                            </span>
                            <span className="px-sm py-xs bg-mint-light rounded-full font-baloo text-xs text-text-dark font-semibold">
                              {pm?.totalStudents ?? 0} students
                            </span>
                            <span className="px-sm py-xs bg-peach-light rounded-full font-baloo text-xs text-text-dark font-semibold">
                              {pm?.activeToday ?? 0} active today
                            </span>
                            <span className="px-sm py-xs bg-amber-50 rounded-full font-baloo text-xs text-text-dark font-semibold">
                              {activePct}% active (7d)
                            </span>
                            <span className="px-sm py-xs bg-lavender-light/50 rounded-full font-baloo text-xs text-text-dark font-semibold">
                              🔥 {pm?.avgStreak ?? 0}d avg streak
                            </span>
                          </div>
                          <span className="text-text-muted text-sm ml-md shrink-0">{isExpanded ? '▲' : '▼'}</span>
                        </div>
                        {/* Mobile pills */}
                        <div className="flex sm:hidden flex-wrap gap-xs mt-sm">
                          <span className="px-sm py-xs bg-lavender-light rounded-full font-baloo text-xs text-text-dark">{pm?.totalSchools ?? 0} schools</span>
                          <span className="px-sm py-xs bg-mint-light rounded-full font-baloo text-xs text-text-dark">{pm?.totalStudents ?? 0} students</span>
                          <span className="px-sm py-xs bg-peach-light rounded-full font-baloo text-xs text-text-dark">{pm?.activeToday ?? 0} active today</span>
                        </div>
                      </button>

                      {/* Expanded: per-school breakdown */}
                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.25 }}
                            className="overflow-hidden border-t border-divider"
                          >
                            {projectSchools.length === 0 ? (
                              <div className="px-lg py-md">
                                <p className="font-baloo text-sm text-text-muted italic">No schools assigned to this project.</p>
                              </div>
                            ) : (
                              <div className="overflow-x-auto">
                                <table className="w-full">
                                  <thead>
                                    <tr className="bg-lavender-light/30 border-b border-divider text-left">
                                      <th className="px-md py-sm font-baloo font-bold text-xs text-text-dark">School</th>
                                      <th className="px-md py-sm font-baloo font-bold text-xs text-text-dark">Teachers</th>
                                      <th className="px-md py-sm font-baloo font-bold text-xs text-text-dark">Students</th>
                                      <th className="px-md py-sm font-baloo font-bold text-xs text-text-dark">Active Today</th>
                                      <th className="px-md py-sm font-baloo font-bold text-xs text-text-dark min-w-[140px]">Active Rate (7d)</th>
                                      <th className="px-md py-sm font-baloo font-bold text-xs text-text-dark">Avg Streak</th>
                                      <th className="px-md py-sm font-baloo font-bold text-xs text-text-dark">Words Learned</th>
                                      <th className="px-md py-sm font-baloo font-bold text-xs text-text-dark">Quiz Accuracy</th>
                                      <th className="px-md py-sm font-baloo font-bold text-xs text-text-dark">Tier</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {projectSchools.map((school, i) => {
                                      const m = schoolMetricsMap.get(school.id);
                                      const wps = m && m.totalStudents > 0 ? Math.round(m.totalWordsLearned / m.totalStudents) : 0;
                                      return (
                                        <tr key={school.id} className={`border-b border-divider hover:bg-lavender-light/10 transition-colors ${i % 2 === 0 ? '' : 'bg-gray-50/30'}`}>
                                          <td className="px-md py-sm">
                                            <div>
                                              <p className="font-baloo font-semibold text-sm text-text-dark">{school.name}</p>
                                              <p className="font-baloo text-xs text-text-muted font-mono">{school.code}</p>
                                            </div>
                                          </td>
                                          <td className="px-md py-sm font-baloo text-sm text-text-muted text-center">{m?.teacherCount ?? 0}</td>
                                          <td className="px-md py-sm font-baloo text-sm text-text-muted text-center">{m?.totalStudents ?? 0}</td>
                                          <td className="px-md py-sm font-baloo text-sm text-text-muted text-center">{m?.activeToday ?? 0}</td>
                                          <td className="px-md py-sm">
                                            {m && m.totalStudents > 0 ? <ActivityBar pct={m.activeRate} /> : <span className="font-baloo text-xs text-text-muted">—</span>}
                                          </td>
                                          <td className="px-md py-sm font-baloo text-sm text-center">
                                            {m && m.avgStreak > 0 ? (
                                              <span className={`font-semibold ${m.avgStreak >= 7 ? 'text-success' : m.avgStreak >= 3 ? 'text-amber-600' : 'text-text-muted'}`}>
                                                🔥 {m.avgStreak}d
                                              </span>
                                            ) : <span className="text-text-muted">—</span>}
                                          </td>
                                          <td className="px-md py-sm font-baloo text-sm text-text-muted text-center">
                                            <div>
                                              <p className="font-semibold text-text-dark">{m?.totalWordsLearned.toLocaleString() ?? 0}</p>
                                              {m && m.totalStudents > 0 && <p className="text-xs">{wps}/student</p>}
                                            </div>
                                          </td>
                                          <td className="px-md py-sm text-center">
                                            {m?.avgAccuracy !== null && m?.avgAccuracy !== undefined ? (
                                              <span className={`px-sm py-xs rounded-full font-baloo font-semibold text-xs ${m.avgAccuracy >= 80 ? 'bg-success/10 text-success' : m.avgAccuracy >= 60 ? 'bg-amber-100 text-amber-700' : 'bg-error/10 text-error'}`}>
                                                {m.avgAccuracy}%
                                              </span>
                                            ) : <span className="font-baloo text-xs text-text-muted">—</span>}
                                          </td>
                                          <td className="px-md py-sm">
                                            {m ? <TierBadge tier={m.tier} /> : <span className="font-baloo text-xs text-text-muted">—</span>}
                                          </td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                  {/* Project totals footer */}
                                  <tfoot>
                                    <tr className="bg-lavender-light/20 border-t-2 border-divider">
                                      <td className="px-md py-sm font-baloo font-bold text-xs text-text-dark" colSpan={2}>Project Total</td>
                                      <td className="px-md py-sm font-baloo font-bold text-xs text-text-dark text-center">{pm?.totalStudents ?? 0}</td>
                                      <td className="px-md py-sm font-baloo font-bold text-xs text-text-dark text-center">{pm?.activeToday ?? 0}</td>
                                      <td className="px-md py-sm">
                                        {pm && pm.totalStudents > 0 && <ActivityBar pct={Math.round((pm.activeLast7d / pm.totalStudents) * 100)} />}
                                      </td>
                                      <td className="px-md py-sm font-baloo font-bold text-xs text-text-dark text-center">🔥 {pm?.avgStreak ?? 0}d</td>
                                      <td className="px-md py-sm font-baloo font-bold text-xs text-text-dark text-center">{pm?.totalWordsLearned.toLocaleString() ?? 0}</td>
                                      <td colSpan={2} />
                                    </tr>
                                  </tfoot>
                                </table>
                              </div>
                            )}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          )}

          {/* Unassigned schools */}
          {schools.filter(s => !s.projectId).length > 0 && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3, delay: 0.25 }}>
              <div className="bg-white rounded-2xl border border-amber-200 shadow-sm overflow-hidden">
                <button
                  className="w-full text-left px-lg py-md hover:bg-amber-50/30 transition-colors"
                  onClick={() => setExpandedProjects(prev => {
                    const next = new Set(prev);
                    next.has('__unassigned__') ? next.delete('__unassigned__') : next.add('__unassigned__');
                    return next;
                  })}
                >
                  <div className="flex items-center gap-md">
                    <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
                      <span className="text-xl">⚠️</span>
                    </div>
                    <div className="flex-1">
                      <p className="font-baloo font-bold text-text-dark">Unassigned Schools</p>
                      <p className="font-baloo text-xs text-text-muted">Schools not yet linked to any project</p>
                    </div>
                    <span className="px-sm py-xs bg-amber-100 rounded-full font-baloo text-xs text-amber-700 font-semibold">
                      {schools.filter(s => !s.projectId).length} school{schools.filter(s => !s.projectId).length !== 1 ? 's' : ''}
                    </span>
                    <span className="text-text-muted text-sm ml-sm shrink-0">{expandedProjects.has('__unassigned__') ? '▲' : '▼'}</span>
                  </div>
                </button>
                <AnimatePresence>
                  {expandedProjects.has('__unassigned__') && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25 }} className="border-t border-amber-200 overflow-hidden">
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead>
                            <tr className="bg-amber-50 border-b border-amber-200 text-left">
                              <th className="px-md py-sm font-baloo font-bold text-xs text-text-dark">School</th>
                              <th className="px-md py-sm font-baloo font-bold text-xs text-text-dark">Code</th>
                              <th className="px-md py-sm font-baloo font-bold text-xs text-text-dark">Teachers</th>
                              <th className="px-md py-sm font-baloo font-bold text-xs text-text-dark">Students</th>
                            </tr>
                          </thead>
                          <tbody>
                            {schools.filter(s => !s.projectId).map((school, i) => {
                              const m = schoolMetricsMap.get(school.id);
                              return (
                                <tr key={school.id} className={`border-b border-divider ${i % 2 === 0 ? '' : 'bg-gray-50/30'}`}>
                                  <td className="px-md py-sm font-baloo font-semibold text-sm text-text-dark">{school.name}</td>
                                  <td className="px-md py-sm font-baloo text-sm text-text-muted font-mono">{school.code}</td>
                                  <td className="px-md py-sm font-baloo text-sm text-text-muted text-center">{m?.teacherCount ?? 0}</td>
                                  <td className="px-md py-sm font-baloo text-sm text-text-muted text-center">{m?.totalStudents ?? 0}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          )}

          {/* ── School Leaderboard ───────────────────────────────────────── */}
          {schoolLeaderboard.length > 0 && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.3 }}>
              <Card className="bg-white border border-divider">
                <h2 className="font-baloo font-bold text-lg text-text-dark mb-xs flex items-center gap-sm">
                  <span>🏆</span> Top Performing Schools
                </h2>
                <p className="font-baloo text-xs text-text-muted mb-md">Ranked by words learned per student</p>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-lavender-light/30 border-b border-divider text-left">
                        <th className="px-md py-sm font-baloo font-bold text-xs text-text-dark">#</th>
                        <th className="px-md py-sm font-baloo font-bold text-xs text-text-dark">School</th>
                        <th className="px-md py-sm font-baloo font-bold text-xs text-text-dark">Project</th>
                        <th className="px-md py-sm font-baloo font-bold text-xs text-text-dark">Students</th>
                        <th className="px-md py-sm font-baloo font-bold text-xs text-text-dark min-w-[130px]">Active Rate (7d)</th>
                        <th className="px-md py-sm font-baloo font-bold text-xs text-text-dark">Avg Streak</th>
                        <th className="px-md py-sm font-baloo font-bold text-xs text-text-dark">Words/Student</th>
                        <th className="px-md py-sm font-baloo font-bold text-xs text-text-dark">Tier</th>
                      </tr>
                    </thead>
                    <tbody>
                      {schoolLeaderboard.map(({ school, metrics }, i) => {
                        const wps = metrics.totalStudents > 0 ? Math.round(metrics.totalWordsLearned / metrics.totalStudents) : 0;
                        const projectName = school.projectId ? (projectById.get(school.projectId) ?? school.projectId) : '—';
                        return (
                          <tr key={school.id} className={`border-b border-divider hover:bg-amber-50/20 transition-colors ${i % 2 === 0 ? '' : 'bg-gray-50/30'}`}>
                            <td className="px-md py-sm">
                              <span className={`font-baloo font-extrabold text-sm ${i === 0 ? 'text-amber-500' : i === 1 ? 'text-gray-400' : i === 2 ? 'text-amber-700' : 'text-text-muted'}`}>
                                {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`}
                              </span>
                            </td>
                            <td className="px-md py-sm">
                              <p className="font-baloo font-semibold text-sm text-text-dark">{school.name}</p>
                              <p className="font-baloo text-xs text-text-muted font-mono">{school.code}</p>
                            </td>
                            <td className="px-md py-sm font-baloo text-xs text-text-muted">{projectName}</td>
                            <td className="px-md py-sm font-baloo text-sm text-text-muted text-center">{metrics.totalStudents}</td>
                            <td className="px-md py-sm"><ActivityBar pct={metrics.activeRate} /></td>
                            <td className="px-md py-sm font-baloo text-sm text-center">
                              {metrics.avgStreak > 0 ? (
                                <span className={`font-semibold ${metrics.avgStreak >= 7 ? 'text-success' : 'text-amber-600'}`}>🔥 {metrics.avgStreak}d</span>
                              ) : <span className="text-text-muted">—</span>}
                            </td>
                            <td className="px-md py-sm font-baloo font-bold text-sm text-text-dark text-center">{wps}</td>
                            <td className="px-md py-sm"><TierBadge tier={metrics.tier} /></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </Card>
            </motion.div>
          )}

          {/* ── Phase 2: Hardest Words ─────────────────────────────────── */}
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.35 }}>
            <Card className="bg-white border border-divider">
              <h2 className="font-baloo font-bold text-lg text-text-dark mb-md flex items-center gap-sm">
                <span>📉</span> Hardest Words Platform-Wide
              </h2>
              {loadingPhase2 ? (
                <RowSkeleton rows={5} />
              ) : hardestWords && hardestWords.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-lavender-light/30 border-b border-divider">
                        <th className="px-md py-sm text-left font-baloo font-bold text-xs text-text-dark">#</th>
                        <th className="px-md py-sm text-left font-baloo font-bold text-xs text-text-dark">Word</th>
                        <th className="px-md py-sm text-left font-baloo font-bold text-xs text-text-dark">ID</th>
                        <th className="px-md py-sm text-left font-baloo font-bold text-xs text-text-dark">Schools Flagged</th>
                      </tr>
                    </thead>
                    <tbody>
                      {hardestWords.map((w, i) => (
                        <tr key={w.wordId} className={`border-b border-divider hover:bg-peach-light/20 transition-colors ${i % 2 === 0 ? '' : 'bg-gray-50/30'}`}>
                          <td className="px-md py-sm font-baloo text-sm text-text-muted">{i + 1}</td>
                          <td className="px-md py-sm font-baloo font-semibold text-sm text-text-dark">{w.wordName}</td>
                          <td className="px-md py-sm font-baloo text-xs text-text-muted font-mono">{w.wordId}</td>
                          <td className="px-md py-sm">
                            <span className={`inline-flex items-center gap-xs font-baloo font-semibold text-xs px-sm py-xs rounded-full ${w.count >= 3 ? 'bg-error/10 text-error' : w.count >= 2 ? 'bg-amber-100 text-amber-700' : 'bg-mint-light text-secondary'}`}>
                              {w.count} {w.count === 1 ? 'school' : 'schools'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="font-baloo text-sm text-text-muted italic">
                  No data yet. School stats are written nightly by <code className="font-mono bg-gray-100 px-xs rounded text-xs">aggregateDaily</code>.
                </p>
              )}
            </Card>
          </motion.div>

          {/* ── Phase 3: License Key Health ───────────────────────────── */}
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.4 }}>
            <Card className="bg-white border border-divider">
              <h2 className="font-baloo font-bold text-lg text-text-dark mb-md flex items-center gap-sm">
                <span>🗝️</span> License Key Health
              </h2>
              {loadingPhase3 ? (
                <div className="space-y-md">
                  <div className="grid grid-cols-3 gap-sm">{Array.from({ length: 3 }).map((_, i) => <StatCardSkeleton key={i} />)}</div>
                  <RowSkeleton rows={3} />
                </div>
              ) : licenseKeySummary ? (
                <div className="space-y-lg">
                  <div className="grid grid-cols-3 gap-sm">
                    {[
                      { label: 'Unused Keys',  value: licenseKeySummary.unused,   color: 'bg-white border border-divider', icon: '🟢' },
                      { label: 'Active Keys',  value: licenseKeySummary.active,   color: 'bg-white border border-divider', icon: '🔵' },
                      { label: 'Expired Keys', value: licenseKeySummary.expired,  color: licenseKeySummary.expired > 0 ? 'bg-rose-light border border-error/20' : 'bg-white border border-divider', icon: '🔴' },
                    ].map(item => (
                      <div key={item.label} className={`${item.color} rounded-xl p-md text-center`}>
                        <span className="text-2xl block mb-xs">{item.icon}</span>
                        <p className="font-baloo font-extrabold text-xl text-text-dark leading-none">{item.value}</p>
                        <p className="font-baloo text-xs text-text-muted mt-xs">{item.label}</p>
                      </div>
                    ))}
                  </div>
                  {licenseKeySummary.recentExpired.length > 0 && (
                    <div>
                      <p className="font-baloo font-semibold text-sm text-text-dark mb-sm">Recently Expired Keys</p>
                      <div className="bg-white rounded-xl border border-divider overflow-hidden">
                        <table className="w-full">
                          <thead>
                            <tr className="bg-red-50 border-b border-divider">
                              <th className="px-md py-sm text-left font-baloo font-bold text-xs text-text-dark">Key</th>
                              <th className="px-md py-sm text-left font-baloo font-bold text-xs text-text-dark">Expired At</th>
                            </tr>
                          </thead>
                          <tbody>
                            {licenseKeySummary.recentExpired.map((k, i) => (
                              <tr key={k.key} className={`border-b border-divider ${i % 2 === 0 ? '' : 'bg-gray-50/30'}`}>
                                <td className="px-md py-sm font-baloo font-mono text-sm text-text-dark">{k.key}</td>
                                <td className="px-md py-sm font-baloo text-sm text-text-muted">{k.expiresAt}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <p className="font-baloo text-sm text-text-muted italic">Failed to load license key data.</p>
              )}
            </Card>
          </motion.div>

          {/* ── Phase 3: Churn Signal ─────────────────────────────────── */}
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.45 }}>
            <Card className={`border ${churnedStudents && churnedStudents.length > 0 ? 'bg-amber-50 border-amber-200' : 'bg-white border-divider'}`}>
              <h2 className="font-baloo font-bold text-lg text-text-dark mb-md flex items-center gap-sm">
                <span>⚠️</span> Inactive Students (14+ days)
              </h2>
              {loadingPhase3 ? (
                <RowSkeleton rows={3} />
              ) : churnedStudents !== null ? (
                <div className="space-y-md">
                  <div className={`flex items-center gap-md p-md rounded-xl ${churnedStudents.length > 0 ? 'bg-amber-100/60' : 'bg-mint-light/40'}`}>
                    <span className="text-3xl">{churnedStudents.length > 0 ? '😴' : '🎉'}</span>
                    <div className="flex-1">
                      <p className="font-baloo font-bold text-text-dark">
                        {churnedStudents.length > 0
                          ? `${churnedStudents.length} student${churnedStudents.length !== 1 ? 's' : ''} inactive for 14+ days`
                          : 'All students have practiced in the last 14 days!'}
                      </p>
                      <p className="font-baloo text-xs text-text-muted mt-xs">
                        Out of {studentDocs.length} total students
                      </p>
                    </div>
                    {churnedStudents.length > 0 && (
                      <span className="font-baloo font-extrabold text-xl text-amber-700 bg-amber-200 px-md py-xs rounded-full">
                        {Math.round((churnedStudents.length / Math.max(studentDocs.length, 1)) * 100)}%
                      </span>
                    )}
                  </div>

                  {/* Show first 10 inactive students */}
                  {churnedStudents.length > 0 && (
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="bg-amber-100/40 border-b border-amber-200 text-left">
                            <th className="px-md py-sm font-baloo font-bold text-xs text-text-dark">Student</th>
                            <th className="px-md py-sm font-baloo font-bold text-xs text-text-dark">School</th>
                            <th className="px-md py-sm font-baloo font-bold text-xs text-text-dark">Last Active</th>
                            <th className="px-md py-sm font-baloo font-bold text-xs text-text-dark">Words Learned</th>
                          </tr>
                        </thead>
                        <tbody>
                          {churnedStudents.slice(0, 10).map((s, i) => {
                            const school = schools.find(sc => sc.id === s.schoolId);
                            return (
                              <tr key={s.id} className={`border-b border-divider hover:bg-amber-50/40 ${i % 2 === 0 ? '' : 'bg-gray-50/30'}`}>
                                <td className="px-md py-sm">
                                  <div className="flex items-center gap-sm">
                                    <div className="w-6 h-6 rounded-full flex items-center justify-center font-baloo font-bold text-xs text-white shrink-0" style={{ backgroundColor: s.avatarColor || '#7C81FF' }}>
                                      {s.name?.[0]?.toUpperCase() ?? '?'}
                                    </div>
                                    <span className="font-baloo font-semibold text-sm text-text-dark">{s.name}</span>
                                  </div>
                                </td>
                                <td className="px-md py-sm font-baloo text-xs text-text-muted">{school?.name ?? (s.schoolId ? s.schoolId : 'Individual')}</td>
                                <td className="px-md py-sm">
                                  <span className={`font-baloo text-xs font-semibold ${!s.analytics?.lastStudyDate ? 'text-error' : 'text-amber-700'}`}>
                                    {s.analytics?.lastStudyDate ?? 'Never'}
                                  </span>
                                </td>
                                <td className="px-md py-sm font-baloo text-sm text-text-muted text-center">
                                  {s.analytics?.totalWordsLearned ?? 0}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                      {churnedStudents.length > 10 && (
                        <p className="font-baloo text-xs text-text-muted italic px-md py-sm">
                          Showing 10 of {churnedStudents.length} inactive students.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <p className="font-baloo text-sm text-text-muted italic">Failed to compute churn data.</p>
              )}
            </Card>
          </motion.div>
        </>
      )}
    </div>
  );
}
