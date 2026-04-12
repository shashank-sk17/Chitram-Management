import { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { collection, getDocs, query, where, getCountFromServer } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { getSchool, getProject, getTeachersBySchool, getClassesBySchool } from '../../services/firebase/firestore';
import { Skeleton, StatCardSkeleton } from '../../components/common/Skeleton';
import type { SchoolDoc, ProjectDoc, StudentDoc, TeacherDoc, ClassDoc } from '../../types/firestore';

interface TeacherStats {
  wordsSubmitted: number;
  assignmentsCreated: number;
  studentCount: number;
  avgQuizAccuracy: number | null;
  highestQuizAccuracy: number | null;
  lowestQuizAccuracy: number | null;
  activeStudentsThisWeek: number;
}

type WithId<T> = T & { id: string };

function lastActiveBadge(lastDate: string | undefined) {
  if (!lastDate) return <span className="text-xs text-gray-400">Never</span>;
  const today = new Date().toISOString().split('T')[0];
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const sevenDaysAgoStr = sevenDaysAgo.toISOString().split('T')[0];

  if (lastDate === today) {
    return <span className="text-xs font-semibold text-green-600">Today</span>;
  }
  if (lastDate >= sevenDaysAgoStr) {
    const d = new Date(lastDate);
    return <span className="text-xs font-semibold text-amber-600">{d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>;
  }
  const d = new Date(lastDate);
  return <span className="text-xs text-red-500">{d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>;
}

export default function SchoolDetailPage() {
  const { schoolId } = useParams<{ schoolId: string }>();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [school, setSchool] = useState<WithId<SchoolDoc> | null>(null);
  const [project, setProject] = useState<WithId<ProjectDoc> | null>(null);
  const [teachers, setTeachers] = useState<WithId<TeacherDoc>[]>([]);
  const [classes, setClasses] = useState<(ClassDoc & { id: string })[]>([]);
  const [students, setStudents] = useState<WithId<StudentDoc>[]>([]);
  const [teacherStats, setTeacherStats] = useState<Map<string, TeacherStats>>(new Map());
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [filterClass, setFilterClass] = useState('all');
  const [filterGrade, setFilterGrade] = useState('all');
  const [filterActivity, setFilterActivity] = useState('all');

  useEffect(() => {
    if (schoolId) loadData(schoolId);
  }, [schoolId]);

  async function loadData(sid: string) {
    setLoading(true);
    setError(null);
    try {
      const schoolData = await getSchool(sid);
      if (!schoolData) {
        setError('School not found.');
        setLoading(false);
        return;
      }
      setSchool({ ...schoolData, id: sid });

      const [teacherData, classData] = await Promise.all([
        getTeachersBySchool(sid),
        getClassesBySchool(sid),
      ]);
      setTeachers(teacherData);
      setClasses(classData as (ClassDoc & { id: string })[]);

      // Load project if assigned
      if (schoolData.projectId) {
        const projectData = await getProject(schoolData.projectId);
        if (projectData) setProject({ ...projectData, id: schoolData.projectId });
      }

      // Load students by schoolId
      const snap = await getDocs(query(collection(db, 'students'), where('schoolId', '==', sid)));
      const studentList = snap.docs.map(d => ({ id: d.id, ...(d.data() as StudentDoc) }));
      setStudents(studentList);

      // Build teacher stats (word submissions + assignment counts + student performance)
      if (teacherData.length > 0) {
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        const sevenDaysAgoStr = sevenDaysAgo.toISOString().split('T')[0];

        // Build class → teacher map and students per teacher
        const typedClassData = classData as (ClassDoc & { id: string })[];
        const classToTeacher = new Map<string, string>();
        typedClassData.forEach(c => classToTeacher.set(c.id, c.teacherId));
        const studentsByTeacher = new Map<string, typeof studentList>();
        studentList.forEach(s => {
          const studentClsId = typedClassData.find(c =>
            (c.studentIds ?? []).includes(s.id)
          )?.id;
          if (studentClsId) {
            const tid = classToTeacher.get(studentClsId);
            if (tid) {
              const existing = studentsByTeacher.get(tid) ?? [];
              studentsByTeacher.set(tid, [...existing, s]);
            }
          }
        });

        // Fetch word submission counts and assignment counts per teacher in parallel
        const statsMap = new Map<string, TeacherStats>();
        await Promise.all(teacherData.map(async teacher => {
          const [wordSnap, assignSnap] = await Promise.all([
            getCountFromServer(query(collection(db, 'wordBank'), where('submittedBy', '==', teacher.id))),
            getCountFromServer(query(collection(db, 'mcqAssignments'), where('teacherUid', '==', teacher.id))),
          ]);

          const teacherStudents = studentsByTeacher.get(teacher.id) ?? [];
          const accuracyValues = teacherStudents
            .map(s => s.analytics?.quizAccuracy)
            .filter((v): v is number => typeof v === 'number');
          const activeThisWeek = teacherStudents.filter(s =>
            s.analytics?.lastStudyDate && s.analytics.lastStudyDate >= sevenDaysAgoStr
          ).length;

          statsMap.set(teacher.id, {
            wordsSubmitted: wordSnap.data().count,
            assignmentsCreated: assignSnap.data().count,
            studentCount: teacherStudents.length,
            avgQuizAccuracy: accuracyValues.length > 0
              ? Math.round(accuracyValues.reduce((a, b) => a + b, 0) / accuracyValues.length)
              : null,
            highestQuizAccuracy: accuracyValues.length > 0 ? Math.max(...accuracyValues) : null,
            lowestQuizAccuracy: accuracyValues.length > 0 ? Math.min(...accuracyValues) : null,
            activeStudentsThisWeek: activeThisWeek,
          });
        }));
        setTeacherStats(statsMap);
      }
    } catch (e) {
      console.error('Error loading school detail:', e);
      setError('Failed to load school data.');
    } finally {
      setLoading(false);
    }
  }

  const summaryStats = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    const activeToday = students.filter(s => s.analytics?.lastStudyDate === today).length;
    return {
      teachers: teachers.length,
      students: students.length,
      classes: classes.length,
      activeToday,
    };
  }, [teachers, students, classes]);

  // Map teacherId -> teacher name for class table
  const teacherMap = useMemo(() => {
    const m = new Map<string, string>();
    teachers.forEach(t => m.set(t.id, t.name));
    return m;
  }, [teachers]);

  // Map teacherId -> class count
  const classesPerTeacher = useMemo(() => {
    const m = new Map<string, number>();
    classes.forEach(c => {
      m.set(c.teacherId, (m.get(c.teacherId) ?? 0) + 1);
    });
    return m;
  }, [classes]);

  // Map studentId -> classId (from classes.studentIds)
  const studentClassMap = useMemo(() => {
    const m = new Map<string, string>();
    classes.forEach(c => {
      (c.studentIds ?? []).forEach((sid: string) => m.set(sid, c.id));
    });
    return m;
  }, [classes]);

  // Unique grades present in students
  const uniqueGrades = useMemo(() => {
    const grades = new Set<string>();
    students.forEach(s => { if (s.grade) grades.add(String(s.grade)); });
    return Array.from(grades).sort();
  }, [students]);

  const filteredStudents = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const sevenDaysAgoStr = sevenDaysAgo.toISOString().split('T')[0];

    return students.filter(s => {
      if (searchQuery && !s.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      if (filterClass !== 'all' && studentClassMap.get(s.id) !== filterClass) return false;
      if (filterGrade !== 'all' && String(s.grade) !== filterGrade) return false;
      if (filterActivity === 'today' && s.analytics?.lastStudyDate !== today) return false;
      if (filterActivity === 'week' && (!s.analytics?.lastStudyDate || s.analytics.lastStudyDate < sevenDaysAgoStr)) return false;
      if (filterActivity === 'inactive' && s.analytics?.lastStudyDate && s.analytics.lastStudyDate >= sevenDaysAgoStr) return false;
      return true;
    });
  }, [students, searchQuery, filterClass, filterGrade, filterActivity, studentClassMap]);

  const createdDate = school?.createdAt
    ? new Date((school.createdAt as any).seconds * 1000).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
    : null;

  if (error) {
    return (
      <div className="max-w-5xl mx-auto py-12 text-center">
        <p className="text-gray-500 font-baloo text-lg">{error}</p>
        <button onClick={() => navigate('/admin/schools')} className="mt-4 text-primary font-baloo text-sm underline">
          Back to Schools
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm font-baloo text-gray-500 mb-6">
        <button onClick={() => navigate('/admin/schools')} className="hover:text-primary transition-colors">
          Schools
        </button>
        <span>/</span>
        {loading ? (
          <Skeleton className="h-4 w-32 inline-block" />
        ) : (
          <span className="text-text-dark font-semibold">{school?.name}</span>
        )}
      </nav>

      {/* Header */}
      {loading ? (
        <div className="mb-8">
          <Skeleton className="h-8 w-64 mb-2" />
          <Skeleton className="h-4 w-48" />
        </div>
      ) : (
        <div className="mb-8">
          <div className="flex flex-wrap items-center gap-3 mb-1">
            <h1 className="font-baloo font-bold text-2xl text-text-dark">{school?.name}</h1>
            <span className="font-mono text-sm bg-gray-100 text-gray-600 px-2 py-0.5 rounded border border-gray-200">
              {school?.code}
            </span>
            {project && (
              <Link
                to={`/admin/projects/${project.id}`}
                className="text-xs bg-blue-50 text-blue-600 border border-blue-200 px-2 py-0.5 rounded hover:bg-blue-100 transition-colors"
              >
                {project.name}
              </Link>
            )}
          </div>
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
            { label: 'Teachers', value: summaryStats.teachers },
            { label: 'Students', value: summaryStats.students },
            { label: 'Classes', value: summaryStats.classes },
            { label: 'Active Today', value: summaryStats.activeToday },
          ].map(stat => (
            <div key={stat.label} className="bg-white border border-gray-200 rounded-xl p-4">
              <p className="font-baloo text-xs text-gray-500 mb-1">{stat.label}</p>
              <p className="font-baloo font-bold text-2xl text-text-dark">{stat.value}</p>
            </div>
          ))
        )}
      </div>

      {/* Teachers table */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden mb-6">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="font-baloo font-semibold text-base text-text-dark">Teachers</h2>
        </div>
        {loading ? (
          <div className="p-5 space-y-3">
            {Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
          </div>
        ) : teachers.length === 0 ? (
          <div className="px-5 py-8 text-center">
            <p className="font-baloo text-gray-400 text-sm">No teachers assigned to this school.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm font-baloo">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Teacher</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Email</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Classes</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Students</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Active/wk</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Avg Quiz</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">High / Low</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Words</th>
                  <th className="text-right px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Assignments</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {teachers.map(teacher => {
                  const ts = teacherStats.get(teacher.id);
                  return (
                    <tr key={teacher.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <div
                            className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                            style={{ backgroundColor: teacher.avatarColor || '#7C81FF' }}
                          >
                            {teacher.name.charAt(0).toUpperCase()}
                          </div>
                          <span className="font-semibold text-text-dark">{teacher.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{teacher.email}</td>
                      <td className="px-4 py-3 text-right text-gray-700">{classesPerTeacher.get(teacher.id) ?? 0}</td>
                      <td className="px-4 py-3 text-right text-gray-700">{ts?.studentCount ?? <span className="text-gray-300">—</span>}</td>
                      <td className="px-4 py-3 text-right">
                        {ts ? (
                          <span className={`text-xs font-semibold ${
                            ts.studentCount > 0 && (ts.activeStudentsThisWeek / ts.studentCount) >= 0.7
                              ? 'text-green-600'
                              : ts.studentCount > 0 && (ts.activeStudentsThisWeek / ts.studentCount) >= 0.3
                              ? 'text-amber-600'
                              : 'text-red-500'
                          }`}>
                            {ts.activeStudentsThisWeek}/{ts.studentCount}
                          </span>
                        ) : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {ts?.avgQuizAccuracy != null ? (
                          <span className={`text-xs font-semibold ${ts.avgQuizAccuracy >= 70 ? 'text-green-600' : ts.avgQuizAccuracy >= 40 ? 'text-amber-600' : 'text-red-500'}`}>
                            {ts.avgQuizAccuracy}%
                          </span>
                        ) : <span className="text-gray-300 text-xs">—</span>}
                      </td>
                      <td className="px-4 py-3 text-right text-xs text-gray-600">
                        {ts?.highestQuizAccuracy != null ? (
                          <span>
                            <span className="text-green-600">{ts.highestQuizAccuracy}%</span>
                            <span className="text-gray-400 mx-0.5">/</span>
                            <span className="text-red-500">{ts.lowestQuizAccuracy}%</span>
                          </span>
                        ) : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-700">{ts?.wordsSubmitted ?? <span className="text-gray-300">—</span>}</td>
                      <td className="px-5 py-3 text-right text-gray-700">{ts?.assignmentsCreated ?? <span className="text-gray-300">—</span>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Classes table */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden mb-6">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="font-baloo font-semibold text-base text-text-dark">Classes</h2>
        </div>
        {loading ? (
          <div className="p-5 space-y-3">
            {Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
          </div>
        ) : classes.length === 0 ? (
          <div className="px-5 py-8 text-center">
            <p className="font-baloo text-gray-400 text-sm">No classes in this school.</p>
          </div>
        ) : (
          <table className="w-full text-sm font-baloo">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Class</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Grade</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Teacher</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Students</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Language</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {classes.map(cls => (
                <tr key={cls.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-5 py-3 font-semibold text-text-dark">{cls.name}</td>
                  <td className="px-4 py-3 text-gray-600">{cls.grade}</td>
                  <td className="px-4 py-3 text-gray-600">{teacherMap.get(cls.teacherId) ?? <span className="text-gray-400 text-xs">Unknown</span>}</td>
                  <td className="px-4 py-3 text-right text-gray-700">{cls.studentIds?.length ?? 0}</td>
                  <td className="px-5 py-3">
                    <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded font-mono uppercase">
                      {cls.learningLanguage ?? '—'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Students table */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <h2 className="font-baloo font-semibold text-base text-text-dark">Students</h2>
            {!loading && students.length > 0 && (
              <span className="text-xs text-gray-400 font-baloo">
                {filteredStudents.length === students.length
                  ? `${students.length} total`
                  : `${filteredStudents.length} of ${students.length}`}
              </span>
            )}
          </div>
          {!loading && students.length > 0 && (
            <div className="flex flex-wrap gap-2">
              <input
                type="text"
                placeholder="Search students..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="px-3 py-1.5 text-xs font-baloo rounded-lg border border-gray-200 bg-white focus:border-primary focus:outline-none w-36"
              />
              <select
                value={filterGrade}
                onChange={e => { setFilterGrade(e.target.value); setFilterClass('all'); }}
                className="px-3 py-1.5 text-xs font-baloo rounded-lg border border-gray-200 bg-white focus:border-primary focus:outline-none"
              >
                <option value="all">All Grades</option>
                {uniqueGrades.map(g => (
                  <option key={g} value={g}>Grade {g}</option>
                ))}
              </select>
              <select
                value={filterClass}
                onChange={e => setFilterClass(e.target.value)}
                className="px-3 py-1.5 text-xs font-baloo rounded-lg border border-gray-200 bg-white focus:border-primary focus:outline-none"
              >
                <option value="all">All Classes</option>
                {classes
                  .filter(c => filterGrade === 'all' || String(c.grade) === filterGrade)
                  .map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
              </select>
              <select
                value={filterActivity}
                onChange={e => setFilterActivity(e.target.value)}
                className="px-3 py-1.5 text-xs font-baloo rounded-lg border border-gray-200 bg-white focus:border-primary focus:outline-none"
              >
                <option value="all">All Activity</option>
                <option value="today">Active Today</option>
                <option value="week">Active This Week</option>
                <option value="inactive">Inactive 7d+</option>
              </select>
              {(searchQuery || filterClass !== 'all' || filterGrade !== 'all' || filterActivity !== 'all') && (
                <button
                  onClick={() => { setSearchQuery(''); setFilterClass('all'); setFilterGrade('all'); setFilterActivity('all'); }}
                  className="px-3 py-1.5 text-xs font-baloo rounded-lg border border-gray-200 text-gray-500 hover:text-red-500 hover:border-red-200 transition-colors"
                >
                  Clear
                </button>
              )}
            </div>
          )}
        </div>
        {loading ? (
          <div className="p-5 space-y-3">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
          </div>
        ) : students.length === 0 ? (
          <div className="px-5 py-8 text-center">
            <p className="font-baloo text-gray-400 text-sm">No students in this school.</p>
          </div>
        ) : filteredStudents.length === 0 ? (
          <div className="px-5 py-8 text-center">
            <p className="font-baloo text-gray-400 text-sm">No students match the current filters.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm font-baloo">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Student</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Class</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Grade</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Last Active</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Streak</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Sessions</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Words</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Levels Done</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Quiz Acc.</th>
                  <th className="text-right px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Draw Acc.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filteredStudents.map(student => {
                  const streak = student.analytics?.streakDays ?? 0;
                  const words = student.analytics?.totalWordsLearned ?? 0;
                  const sessions = student.analytics?.totalSessions;
                  const quizAcc = student.analytics?.quizAccuracy;
                  const drawAcc = student.analytics?.drawingAccuracy;
                  const levelProgress = student.analytics?.levelProgress ?? {};
                  const levelsCompleted = Object.values(levelProgress).filter(l => l.completed).length;
                  const studentClass = classes.find(c => studentClassMap.get(student.id) === c.id);
                  return (
                    <tr key={student.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <div
                            className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                            style={{ backgroundColor: student.avatarColor || '#00BBAE' }}
                          >
                            {student.name.charAt(0).toUpperCase()}
                          </div>
                          <span className="font-semibold text-text-dark">{student.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{studentClass?.name ?? <span className="text-gray-300">—</span>}</td>
                      <td className="px-4 py-3 text-gray-600">{student.grade ?? '—'}</td>
                      <td className="px-4 py-3">{lastActiveBadge(student.analytics?.lastStudyDate)}</td>
                      <td className="px-4 py-3 text-right text-gray-700">
                        {streak > 0 ? <span>🔥 {streak}d</span> : <span className="text-gray-400">—</span>}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-600 text-xs">
                        {sessions != null && sessions > 0 ? sessions : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-700">{words > 0 ? words : <span className="text-gray-400">—</span>}</td>
                      <td className="px-4 py-3 text-right text-gray-600 text-xs">
                        {levelsCompleted > 0 ? levelsCompleted : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {typeof quizAcc === 'number' ? (
                          <span className={`text-xs font-semibold ${quizAcc >= 70 ? 'text-green-600' : quizAcc >= 40 ? 'text-amber-600' : 'text-red-500'}`}>
                            {quizAcc}%
                          </span>
                        ) : (
                          <span className="text-gray-300 text-xs">—</span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-right">
                        {typeof drawAcc === 'number' ? (
                          <span className={`text-xs font-semibold ${drawAcc >= 70 ? 'text-green-600' : drawAcc >= 40 ? 'text-amber-600' : 'text-red-500'}`}>
                            {drawAcc}%
                          </span>
                        ) : (
                          <span className="text-gray-300 text-xs">—</span>
                        )}
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
