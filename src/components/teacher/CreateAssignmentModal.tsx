import { useState, useEffect } from 'react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { useCurriculumStore } from '../../stores/curriculumStore';
import { useTeacherStore } from '../../stores/teacherStore';
import { createAssignment } from '../../services/firebase/teacher';
import type { ClassDoc } from '../../types/firestore';

interface CreateAssignmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  teacherId: string;
  selectedClass?: ClassDoc & { id: string };
}

export function CreateAssignmentModal({
  isOpen,
  onClose,
  onSuccess,
  teacherId,
  selectedClass,
}: CreateAssignmentModalProps) {
  const { classes } = useTeacherStore();
  const { getFinalWordList } = useCurriculumStore();

  const [classId, setClassId] = useState('');
  const [useCurriculum, setUseCurriculum] = useState(true);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Set default class if provided
  useEffect(() => {
    if (selectedClass) {
      setClassId(selectedClass.id);
    }
  }, [selectedClass]);

  // Set default dates (today to 7 days from now)
  useEffect(() => {
    if (isOpen) {
      const today = new Date();
      const weekFromNow = new Date(today);
      weekFromNow.setDate(weekFromNow.getDate() + 7);

      setStartDate(today.toISOString().split('T')[0]);
      setEndDate(weekFromNow.toISOString().split('T')[0]);
    }
  }, [isOpen]);

  async function handleSubmit() {
    if (!classId) {
      setError('Please select a class');
      return;
    }

    if (!startDate || !endDate) {
      setError('Please select start and end dates');
      return;
    }

    if (new Date(startDate) > new Date(endDate)) {
      setError('End date must be after start date');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const selectedClassData = classes.find((c) => c.id === classId);
      if (!selectedClassData) {
        throw new Error('Class not found');
      }

      const grade = selectedClassData.grade;

      if (useCurriculum) {
        // Use curriculum-based assignment
        const finalWordList = getFinalWordList(grade, teacherId);

        if (finalWordList.length === 0) {
          setError('No words available in curriculum for Grade ' + grade);
          setLoading(false);
          return;
        }

        await createAssignment({
          wordSetId: `grade${grade}`,
          curriculumSnapshot: {
            grade,
            wordIds: finalWordList,
            sourceType: 'teacher-customized',
          },
          classId,
          className: selectedClassData.name,
          assignedTo: 'all',
          teacherId,
          startDate,
          endDate,
          status: new Date(startDate) > new Date() ? 'upcoming' : 'active',
        });
      } else {
        // Use legacy word set (1-55) - for backward compatibility
        setError('Legacy word sets not yet implemented. Please use curriculum-based assignments.');
        setLoading(false);
        return;
      }

      // Reset form
      setClassId(selectedClass?.id || '');
      setUseCurriculum(true);
      setStartDate('');
      setEndDate('');
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Error creating assignment:', err);
      setError(err.message || 'Failed to create assignment');
    } finally {
      setLoading(false);
    }
  }

  function handleClose() {
    if (!loading) {
      setClassId(selectedClass?.id || '');
      setUseCurriculum(true);
      setStartDate('');
      setEndDate('');
      setError('');
      onClose();
    }
  }

  const selectedClassData = classes.find((c) => c.id === classId);
  const wordCount = selectedClassData
    ? getFinalWordList(selectedClassData.grade, teacherId).length
    : 0;

  return (
    <Modal isOpen={isOpen} onClose={handleClose}>
      <div className="flex flex-col gap-md sm:gap-lg">
        {/* Header */}
        <div>
          <h2 className="font-baloo font-bold text-xl text-text-dark mb-sm">
            Create New Assignment
          </h2>
          <p className="font-baloo text-sm sm:text-md text-text-muted">
            Assign vocabulary words to your class
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-rose-light border-2 border-error rounded-lg p-md">
            <p className="font-baloo text-sm sm:text-md text-error">{error}</p>
          </div>
        )}

        {/* Class Selection */}
        <div>
          <label className="font-baloo font-semibold text-sm sm:text-md text-text-dark block mb-sm">
            Class *
          </label>
          <select
            value={classId}
            onChange={(e) => setClassId(e.target.value)}
            className="w-full px-md py-sm sm:py-md rounded-lg border-2 border-divider bg-white font-baloo text-sm sm:text-body focus:border-primary focus:outline-none"
            disabled={loading || !!selectedClass}
          >
            <option value="">Select a class...</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} (Grade {c.grade})
              </option>
            ))}
          </select>
        </div>

        {/* Word Set Type */}
        <div>
          <label className="font-baloo font-semibold text-sm sm:text-md text-text-dark block mb-sm">
            Word Set
          </label>
          <div className="flex gap-md">
            <button
              onClick={() => setUseCurriculum(true)}
              className={`flex-1 px-md py-sm sm:py-md rounded-lg border-2 font-baloo text-sm sm:text-body transition-colors ${
                useCurriculum
                  ? 'border-secondary bg-mint-light text-secondary'
                  : 'border-divider bg-white text-text-muted'
              }`}
              disabled={loading}
            >
              📚 Curriculum-based
            </button>
            <button
              onClick={() => setUseCurriculum(false)}
              className={`flex-1 px-md py-sm sm:py-md rounded-lg border-2 font-baloo text-sm sm:text-body transition-colors ${
                !useCurriculum
                  ? 'border-secondary bg-mint-light text-secondary'
                  : 'border-divider bg-white text-text-muted'
              }`}
              disabled={loading}
            >
              📖 Legacy Word Sets
            </button>
          </div>
          {useCurriculum && selectedClassData && (
            <p className="font-baloo text-sm text-text-muted mt-sm">
              ✓ {wordCount} words from your customized Grade {selectedClassData.grade} curriculum
            </p>
          )}
          {!useCurriculum && (
            <p className="font-baloo text-sm text-warning mt-sm">
              ⚠️ Legacy word sets (1-55) are for backward compatibility only
            </p>
          )}
        </div>

        {/* Date Range */}
        <div className="grid grid-cols-2 gap-md">
          <div>
            <label className="font-baloo font-semibold text-sm sm:text-md text-text-dark block mb-sm">
              Start Date *
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-md py-sm sm:py-md rounded-lg border-2 border-divider bg-white font-baloo text-sm sm:text-body focus:border-primary focus:outline-none"
              disabled={loading}
            />
          </div>
          <div>
            <label className="font-baloo font-semibold text-sm sm:text-md text-text-dark block mb-sm">
              End Date *
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-md py-sm sm:py-md rounded-lg border-2 border-divider bg-white font-baloo text-sm sm:text-body focus:border-primary focus:outline-none"
              disabled={loading}
            />
          </div>
        </div>

        {/* Info Banner */}
        {useCurriculum && selectedClassData && wordCount === 0 && (
          <div className="bg-sunshine-light border-2 border-warning rounded-lg p-md">
            <p className="font-baloo text-sm text-text-body">
              ⚠️ <strong>No words in curriculum!</strong> Go to the Curriculum page to add words for Grade {selectedClassData.grade}.
            </p>
          </div>
        )}

        {/* Summary */}
        {useCurriculum && selectedClassData && wordCount > 0 && (
          <div className="bg-lavender-light border-2 border-primary rounded-lg p-md">
            <p className="font-baloo text-sm text-text-body">
              📊 <strong>Assignment Summary:</strong> {wordCount} words will be assigned to all students in {selectedClassData.name} from {startDate} to {endDate}.
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-md justify-end">
          <Button
            title="Cancel"
            onPress={handleClose}
            variant="ghost"
            disabled={loading}
          />
          <Button
            title={loading ? 'Creating...' : 'Create Assignment'}
            onPress={handleSubmit}
            variant="primary"
            disabled={!classId || !startDate || !endDate || loading || (useCurriculum && wordCount === 0)}
            loading={loading}
          />
        </div>
      </div>
    </Modal>
  );
}
