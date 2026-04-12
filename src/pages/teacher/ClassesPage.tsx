import { useEffect, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useAuth } from '../../features/auth/hooks/useAuth';
import { useTeacherStore } from '../../stores/teacherStore';
import { Button } from '../../components/common/Button';
import { Card } from '../../components/common/Card';
import { CreateClassModal } from '../../components/teacher/CreateClassModal';
import { useNavigate } from 'react-router-dom';
import type { TeacherDoc } from '../../types/firestore';

function CopyCodeButton({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  function handleCopy(e: React.MouseEvent) {
    e.stopPropagation();
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }
  return (
    <button
      onClick={handleCopy}
      title="Copy class code"
      className={`flex items-center gap-xs px-md py-sm rounded-full font-baloo font-semibold text-sm transition-all ${
        copied ? 'bg-secondary text-white' : 'bg-lavender-light text-primary hover:bg-primary hover:text-white'
      }`}
    >
      <span>{copied ? '✓' : '📋'}</span>
      {code}
    </button>
  );
}

export default function TeacherClassesPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const {
    classes,
    listenToTeacherClasses,
    listenToClassStudents,
    loadingClasses,
    getStudentsForClass,
    getPendingStudentsForClass,
  } = useTeacherStore();

  const [showCreateClass, setShowCreateClass] = useState(false);
  const [createdCode, setCreatedCode] = useState<string | null>(null);
  const [schoolId, setSchoolId] = useState<string>('');

  // Fetch teacher's schoolId from Firestore
  useEffect(() => {
    if (!user) return;
    getDoc(doc(db, 'teachers', user.uid)).then((snap) => {
      if (snap.exists()) {
        setSchoolId((snap.data() as TeacherDoc).schoolId ?? '');
      }
    });
  }, [user]);

  // Listen to teacher's classes
  useEffect(() => {
    if (user) {
      const unsubscribe = listenToTeacherClasses(user.uid);
      return unsubscribe;
    }
  }, [user]);

  // Listen to students in all classes
  useEffect(() => {
    if (classes.length > 0) {
      const unsubscribes = classes.map((c) => listenToClassStudents(c.id));
      return () => unsubscribes.forEach((unsub) => unsub());
    }
  }, [classes]);

  function handleClassCreated(_classId: string, code: string) {
    setCreatedCode(code);
    setTimeout(() => setCreatedCode(null), 10000); // Hide after 10 seconds
  }

  function handleClassClick(classId: string) {
    // Navigate to class detail page (to be created)
    navigate(`/teacher/classes/${classId}`);
  }

  return (
    <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-sm mb-lg sm:mb-xl">
          <div>
            <h1 className="font-baloo font-bold text-xl sm:text-xxl text-text-dark">
              My Classes
            </h1>
            <p className="font-baloo text-sm sm:text-body text-text-muted truncate">
              {user?.email} • Teacher
            </p>
          </div>
        </div>

        {/* Success Banner - Show after creating class */}
        {createdCode && (
          <Card className="bg-mint-light border-2 border-secondary mb-lg">
            <div className="flex items-start gap-md">
              <span className="text-3xl">🎉</span>
              <div className="flex-1">
                <h3 className="font-baloo font-bold text-lg text-text-dark mb-sm">
                  Class Created Successfully!
                </h3>
                <p className="font-baloo text-md text-text-body mb-md">
                  Share this code with your students:
                </p>
                <div className="bg-white rounded-lg p-md inline-block">
                  <p className="font-baloo font-bold text-xxl text-secondary tracking-wider">
                    {createdCode}
                  </p>
                </div>
              </div>
            </div>
          </Card>
        )}

        {/* Actions */}
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-sm mb-lg">
          <h2 className="font-baloo font-bold text-lg sm:text-xl text-text-dark">
            All Classes ({classes.length})
          </h2>
          <Button
            title="Create Class"
            onPress={() => setShowCreateClass(true)}
            variant="primary"
            size="sm"
            icon={<span>🏫</span>}
            disabled={!schoolId}
          />
        </div>

        {/* Loading State */}
        {loadingClasses && (
          <div className="flex justify-center items-center h-64">
            <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {/* Classes Grid */}
        {!loadingClasses && (
          <>
            {classes.length === 0 ? (
              <Card className="text-center py-lg sm:py-xxl">
                <div className="w-16 h-16 sm:w-24 sm:h-24 rounded-full bg-lavender-light flex items-center justify-center mx-auto mb-md">
                  <span className="text-3xl sm:text-5xl">🏫</span>
                </div>
                <h3 className="font-baloo font-bold text-lg sm:text-xl text-text-dark mb-sm">
                  No Classes Yet
                </h3>
                <p className="font-baloo text-sm sm:text-body text-text-muted mb-md sm:mb-lg">
                  Create your first class to start teaching
                </p>
                <Button
                  title="Create Your First Class"
                  onPress={() => setShowCreateClass(true)}
                  variant="primary"
                />
              </Card>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-md sm:gap-lg">
                {classes.map((classData) => {
                  const approvedStudents = getStudentsForClass(classData.id);
                  const pendingStudents = getPendingStudentsForClass(classData.id);

                  return (
                    <div
                      key={classData.id}
                      onClick={() => handleClassClick(classData.id)}
                      className="cursor-pointer"
                    >
                      <Card className="hover:shadow-md transition-shadow">
                      {/* Class Header */}
                      <div className="flex items-start justify-between mb-md">
                        <div className="flex-1">
                          <h3 className="font-baloo font-bold text-lg text-text-dark mb-xs">
                            {classData.name}
                          </h3>
                          <p className="font-baloo text-md text-text-muted">
                            Grade {classData.grade}
                          </p>
                        </div>
                        <CopyCodeButton code={classData.code} />
                      </div>

                      {/* Stats */}
                      <div className="grid grid-cols-2 gap-md mb-md">
                        <div className="bg-mint-light rounded-lg p-md text-center">
                          <p className="font-baloo font-bold text-xl text-secondary">
                            {approvedStudents.length}
                          </p>
                          <p className="font-baloo text-sm text-text-muted">
                            Students
                          </p>
                        </div>
                        {pendingStudents.length > 0 && (
                          <div className="bg-sunshine-light rounded-lg p-md text-center">
                            <p className="font-baloo font-bold text-xl text-warning">
                              {pendingStudents.length}
                            </p>
                            <p className="font-baloo text-sm text-text-muted">
                              Pending
                            </p>
                          </div>
                        )}
                      </div>

                      {/* Pending Badge */}
                      {pendingStudents.length > 0 && (
                        <div className="bg-warning/10 border-2 border-warning rounded-lg p-sm">
                          <p className="font-baloo text-sm text-warning text-center">
                            ⚠️ {pendingStudents.length} student{pendingStudents.length > 1 ? 's' : ''} waiting for approval
                          </p>
                        </div>
                      )}

                      {/* View Details Link */}
                      <div className="mt-md pt-md border-t-2 border-divider">
                        <p className="font-baloo text-md text-primary text-center">
                          View Details →
                        </p>
                      </div>
                    </Card>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* Create Class Modal */}
        <CreateClassModal
          isOpen={showCreateClass}
          onClose={() => setShowCreateClass(false)}
          onSuccess={handleClassCreated}
          teacherId={user?.uid || ''}
          schoolId={schoolId}
        />
    </div>
  );
}
