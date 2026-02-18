import { useEffect, useState, useMemo } from 'react';
import { useAuth } from '../../features/auth/hooks/useAuth';
import { useTeacherStore } from '../../stores/teacherStore';
import { useCurriculumStore } from '../../stores/curriculumStore';
import { Button } from '../../components/common/Button';
import { Card } from '../../components/common/Card';
import { CreateAssignmentModal } from '../../components/teacher/CreateAssignmentModal';

export default function TeacherAssignmentsPage() {
  const { user } = useAuth();
  const {
    classes,
    assignments,
    listenToTeacherClasses,
    listenToTeacherAssignments,
    loadingAssignments,
  } = useTeacherStore();

  const { listenToMotherCurriculum } = useCurriculumStore();

  const [showCreateAssignment, setShowCreateAssignment] = useState(false);
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'upcoming' | 'completed'>('all');
  const [filterClassId, setFilterClassId] = useState<string>('all');

  // Listen to teacher's data
  useEffect(() => {
    if (user) {
      const unsubClasses = listenToTeacherClasses(user.uid);
      const unsubAssignments = listenToTeacherAssignments(user.uid);
      const unsubCurriculum = listenToMotherCurriculum(['1', '2', '3', '4', '5']);

      return () => {
        unsubClasses();
        unsubAssignments();
        unsubCurriculum();
      };
    }
  }, [user]);

  // Filter assignments
  const filteredAssignments = useMemo(() => {
    let filtered = assignments;

    if (filterStatus !== 'all') {
      filtered = filtered.filter((a) => a.status === filterStatus);
    }

    if (filterClassId !== 'all') {
      filtered = filtered.filter((a) => a.classId === filterClassId);
    }

    // Sort by start date (newest first)
    return filtered.sort((a, b) => {
      return new Date(b.startDate).getTime() - new Date(a.startDate).getTime();
    });
  }, [assignments, filterStatus, filterClassId]);

  // Stats
  const stats = useMemo(() => {
    return {
      active: assignments.filter((a) => a.status === 'active').length,
      upcoming: assignments.filter((a) => a.status === 'upcoming').length,
      completed: assignments.filter((a) => a.status === 'completed').length,
    };
  }, [assignments]);

  function getStatusColor(status: string) {
    switch (status) {
      case 'active':
        return 'bg-mint-light text-secondary border-secondary';
      case 'upcoming':
        return 'bg-sunshine-light text-warning border-warning';
      case 'completed':
        return 'bg-lavender-light text-primary border-primary';
      default:
        return 'bg-white text-text-muted border-divider';
    }
  }

  function formatDate(dateStr: string) {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  return (
    <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-sm mb-lg sm:mb-xl">
          <div>
            <h1 className="font-baloo font-bold text-xl sm:text-xxl text-text-dark">
              Assignments
            </h1>
            <p className="font-baloo text-sm sm:text-body text-text-muted truncate">
              {user?.email} • Teacher
            </p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-sm sm:gap-md mb-md sm:mb-lg">
          <Card className="bg-mint-light text-center">
            <p className="font-baloo text-xs sm:text-sm text-text-muted mb-xs">Active</p>
            <p className="font-baloo font-bold text-lg sm:text-xl text-secondary">{stats.active}</p>
          </Card>
          <Card className="bg-sunshine-light text-center">
            <p className="font-baloo text-xs sm:text-sm text-text-muted mb-xs">Upcoming</p>
            <p className="font-baloo font-bold text-lg sm:text-xl text-warning">{stats.upcoming}</p>
          </Card>
          <Card className="bg-lavender-light text-center">
            <p className="font-baloo text-xs sm:text-sm text-text-muted mb-xs">Completed</p>
            <p className="font-baloo font-bold text-lg sm:text-xl text-primary">{stats.completed}</p>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-md mb-lg">
          <div className="flex-1">
            <label className="font-baloo font-semibold text-sm text-text-dark block mb-sm">
              Filter by Status
            </label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as any)}
              className="w-full px-md py-sm rounded-lg border-2 border-divider bg-white font-baloo text-sm sm:text-md focus:border-primary focus:outline-none"
            >
              <option value="all">All Statuses</option>
              <option value="active">Active</option>
              <option value="upcoming">Upcoming</option>
              <option value="completed">Completed</option>
            </select>
          </div>
          <div className="flex-1">
            <label className="font-baloo font-semibold text-sm text-text-dark block mb-sm">
              Filter by Class
            </label>
            <select
              value={filterClassId}
              onChange={(e) => setFilterClassId(e.target.value)}
              className="w-full px-md py-sm rounded-lg border-2 border-divider bg-white font-baloo text-sm sm:text-md focus:border-primary focus:outline-none"
            >
              <option value="all">All Classes</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-sm mb-lg">
          <h2 className="font-baloo font-bold text-lg sm:text-xl text-text-dark">
            All Assignments ({filteredAssignments.length})
          </h2>
          <Button
            title="Create Assignment"
            onPress={() => setShowCreateAssignment(true)}
            variant="primary"
            size="sm"
            icon={<span>📝</span>}
            className="w-auto self-start sm:self-auto"
          />
        </div>

        {/* Loading State */}
        {loadingAssignments && (
          <div className="flex justify-center items-center h-64">
            <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {/* Assignments List */}
        {!loadingAssignments && (
          <>
            {filteredAssignments.length === 0 ? (
              <Card className="text-center py-lg sm:py-xxl">
                <div className="w-16 h-16 sm:w-24 sm:h-24 rounded-full bg-lavender-light flex items-center justify-center mx-auto mb-md">
                  <span className="text-3xl sm:text-5xl">📝</span>
                </div>
                <h3 className="font-baloo font-bold text-lg sm:text-xl text-text-dark mb-sm">
                  {assignments.length === 0 ? 'No Assignments Yet' : 'No Matching Assignments'}
                </h3>
                <p className="font-baloo text-sm sm:text-body text-text-muted mb-md sm:mb-lg">
                  {assignments.length === 0
                    ? 'Create your first assignment to get started'
                    : 'Try adjusting your filters'}
                </p>
                {assignments.length === 0 && (
                  <Button
                    title="Create Your First Assignment"
                    onPress={() => setShowCreateAssignment(true)}
                    variant="primary"
                  />
                )}
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-md sm:gap-lg">
                {filteredAssignments.map((assignment) => {
                  const classData = classes.find((c) => c.id === assignment.classId);

                  return (
                    <Card key={assignment.id}>
                      {/* Status Badge */}
                      <div className="flex items-start justify-between mb-md">
                        <div className="flex-1">
                          <h3 className="font-baloo font-bold text-lg text-text-dark mb-xs">
                            {assignment.className}
                          </h3>
                          {classData && (
                            <p className="font-baloo text-md text-text-muted">
                              Grade {classData.grade}
                            </p>
                          )}
                        </div>
                        <div className={`px-md py-sm rounded-full border-2 ${getStatusColor(assignment.status)}`}>
                          <span className="font-baloo font-semibold text-sm capitalize">
                            {assignment.status}
                          </span>
                        </div>
                      </div>

                      {/* Word Set Info */}
                      <div className="bg-lavender-light rounded-lg p-md mb-md">
                        {assignment.curriculumSnapshot ? (
                          <div>
                            <p className="font-baloo text-sm text-text-muted mb-xs">
                              Curriculum-based Assignment
                            </p>
                            <p className="font-baloo font-semibold text-body text-text-dark">
                              📚 Grade {assignment.curriculumSnapshot.grade} • {assignment.curriculumSnapshot.wordIds.length} words
                            </p>
                            <p className="font-baloo text-xs text-text-muted mt-xs">
                              {assignment.curriculumSnapshot.sourceType === 'teacher-customized'
                                ? 'Customized curriculum'
                                : 'Mother curriculum'}
                            </p>
                          </div>
                        ) : (
                          <div>
                            <p className="font-baloo text-sm text-text-muted mb-xs">
                              Legacy Word Set
                            </p>
                            <p className="font-baloo font-semibold text-body text-text-dark">
                              📖 Set #{assignment.wordSetId}
                            </p>
                          </div>
                        )}
                      </div>

                      {/* Date Range */}
                      <div className="grid grid-cols-2 gap-md mb-md">
                        <div>
                          <p className="font-baloo text-sm text-text-muted mb-xs">Start Date</p>
                          <p className="font-baloo text-md text-text-dark">
                            {formatDate(assignment.startDate)}
                          </p>
                        </div>
                        <div>
                          <p className="font-baloo text-sm text-text-muted mb-xs">End Date</p>
                          <p className="font-baloo text-md text-text-dark">
                            {formatDate(assignment.endDate)}
                          </p>
                        </div>
                      </div>

                      {/* Assigned To */}
                      <div className="pt-md border-t-2 border-divider">
                        <p className="font-baloo text-sm text-text-muted">
                          Assigned to:{' '}
                          <span className="font-semibold text-text-dark">
                            {assignment.assignedTo === 'all'
                              ? 'All Students'
                              : `${assignment.assignedTo.length} students`}
                          </span>
                        </p>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* Create Assignment Modal */}
        <CreateAssignmentModal
          isOpen={showCreateAssignment}
          onClose={() => setShowCreateAssignment(false)}
          onSuccess={() => {
            // Assignment created successfully
          }}
          teacherId={user?.uid || ''}
        />
    </div>
  );
}
