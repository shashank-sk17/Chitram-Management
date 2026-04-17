import { useEffect, useState } from 'react';
import { useAuth } from '../../features/auth/hooks/useAuth';
import { getStudentsByTeacher, getClassesByTeacher } from '../../services/firebase/firestore';
import { GamificationPanel, type GamificationStudent, type FilterOption } from '../../components/common/GamificationPanel';

export default function TeacherGamificationPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [students, setStudents] = useState<GamificationStudent[]>([]);
  const [classOptions, setClassOptions] = useState<FilterOption[]>([]);

  useEffect(() => {
    if (!user) return;
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
      setClassOptions((classesData as any[]).map(c => ({ id: c.id, name: c.name })));
      setStudents(
        (studentsData as any[]).map(s => ({
          id: s.id,
          name: s.name || s.email || 'Unknown',
          avatarColor: s.avatarColor || '#7C81FF',
          xp: s.analytics?.xp ?? 0,
          weeklyXP: s.analytics?.weeklyXP ?? 0,
          playerLevel: s.analytics?.playerLevel ?? 1,
          badges: s.analytics?.badges ?? [],
          streakDays: s.analytics?.streakDays ?? 0,
          learnedWords: s.analytics?.learnedWords ?? 0,
          classId: s.classId ?? s.classIds?.[0],
        }))
      );
    } catch (err) {
      console.error('Failed to load gamification data:', err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-7xl mx-auto space-y-lg">
      <div>
        <h1 className="font-baloo font-bold text-xxl text-text-dark">Gamification 🏆</h1>
        <p className="font-baloo text-sm text-text-muted">XP leaderboard, player levels and badges across your classes</p>
      </div>
      <GamificationPanel students={students} loading={loading} classes={classOptions} />
    </div>
  );
}
