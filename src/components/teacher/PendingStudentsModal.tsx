import { useState } from 'react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { useTeacherStore } from '../../stores/teacherStore';
import type { StudentDoc } from '../../types/firestore';

interface PendingStudentsModalProps {
  isOpen: boolean;
  onClose: () => void;
  classId: string;
  className: string;
}

export function PendingStudentsModal({ isOpen, onClose, classId, className }: PendingStudentsModalProps) {
  const { getPendingStudentsForClass, approveStudent, rejectStudent } = useTeacherStore();
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const pendingStudents = getPendingStudentsForClass(classId);

  async function handleApprove(student: StudentDoc & { id: string }) {
    setProcessingId(student.id);
    setError('');

    try {
      await approveStudent(classId, student.id);
    } catch (err: any) {
      console.error('Error approving student:', err);
      setError(err.message || 'Failed to approve student');
    } finally {
      setProcessingId(null);
    }
  }

  async function handleReject(student: StudentDoc & { id: string }) {
    if (!confirm(`Are you sure you want to reject ${student.name}?`)) {
      return;
    }

    setProcessingId(student.id);
    setError('');

    try {
      await rejectStudent(classId, student.id);
    } catch (err: any) {
      console.error('Error rejecting student:', err);
      setError(err.message || 'Failed to reject student');
    } finally {
      setProcessingId(null);
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <div className="flex flex-col gap-md sm:gap-lg">
        {/* Header */}
        <div>
          <h2 className="font-baloo font-bold text-xl text-text-dark mb-sm">
            Pending Students
          </h2>
          <p className="font-baloo text-sm sm:text-md text-text-muted">
            Review and approve students for {className}
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-rose-light border-2 border-error rounded-lg p-md">
            <p className="font-baloo text-sm sm:text-md text-error">{error}</p>
          </div>
        )}

        {/* Student List */}
        {pendingStudents.length === 0 ? (
          <div className="text-center py-lg">
            <div className="w-20 h-20 rounded-full bg-lavender-light flex items-center justify-center mx-auto mb-md">
              <span className="text-4xl">✅</span>
            </div>
            <h3 className="font-baloo font-bold text-lg text-text-dark mb-sm">
              All Caught Up!
            </h3>
            <p className="font-baloo text-sm sm:text-body text-text-muted">
              No pending students at the moment
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-md max-h-96 overflow-y-auto">
            {pendingStudents.map((student) => (
              <div
                key={student.id}
                className="bg-lavender-light rounded-lg p-md flex items-center gap-md"
              >
                {/* Avatar */}
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center font-baloo font-bold text-white"
                  style={{ backgroundColor: student.avatarColor }}
                >
                  {student.name.charAt(0).toUpperCase()}
                </div>

                {/* Student Info */}
                <div className="flex-1">
                  <h4 className="font-baloo font-bold text-sm sm:text-body text-text-dark">
                    {student.name}
                  </h4>
                  <div className="flex gap-md text-sm">
                    <span className="font-baloo text-text-muted">
                      Age: {student.age || 'N/A'}
                    </span>
                    {student.grade && (
                      <span className="font-baloo text-text-muted">
                        Grade: {student.grade}
                      </span>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-sm">
                  <Button
                    title={processingId === student.id ? '...' : '✓'}
                    onPress={() => handleApprove(student)}
                    variant="primary"
                    size="sm"
                    disabled={processingId === student.id}
                  />
                  <Button
                    title={processingId === student.id ? '...' : '✕'}
                    onPress={() => handleReject(student)}
                    variant="danger"
                    size="sm"
                    disabled={processingId === student.id}
                  />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Close Button */}
        <div className="flex justify-end">
          <Button
            title="Close"
            onPress={onClose}
            variant="ghost"
            disabled={processingId !== null}
          />
        </div>
      </div>
    </Modal>
  );
}
