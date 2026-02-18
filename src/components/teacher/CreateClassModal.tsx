import { useState } from 'react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { createClass } from '../../services/firebase/teacher';

interface CreateClassModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (classId: string, code: string) => void;
  teacherId: string;
  schoolId: string;
}

const GRADES = ['1', '2', '3', '4', '5'];

export function CreateClassModal({ isOpen, onClose, onSuccess, teacherId, schoolId }: CreateClassModalProps) {
  const [name, setName] = useState('');
  const [grade, setGrade] = useState('1');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit() {
    if (!name.trim()) {
      setError('Class name is required');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const { id, code } = await createClass({
        name: name.trim(),
        grade,
        teacherId,
        schoolId,
      });

      // Reset form
      setName('');
      setGrade('1');
      onSuccess(id, code);
      onClose();
    } catch (err: any) {
      console.error('Error creating class:', err);
      setError(err.message || 'Failed to create class');
    } finally {
      setLoading(false);
    }
  }

  function handleClose() {
    if (!loading) {
      setName('');
      setGrade('1');
      setError('');
      onClose();
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose}>
      <div className="flex flex-col gap-md sm:gap-lg">
        {/* Header */}
        <div>
          <h2 className="font-baloo font-bold text-xl text-text-dark mb-sm">
            Create New Class
          </h2>
          <p className="font-baloo text-sm sm:text-md text-text-muted">
            Students will use the generated code to join your class
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-rose-light border-2 border-error rounded-lg p-md">
            <p className="font-baloo text-sm sm:text-md text-error">{error}</p>
          </div>
        )}

        {/* Class Name */}
        <div>
          <label className="font-baloo font-semibold text-sm sm:text-md text-text-dark block mb-sm">
            Class Name *
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Section A, Morning Batch"
            className="w-full px-md py-sm sm:py-md rounded-lg border-2 border-divider bg-white font-baloo text-sm sm:text-body focus:border-primary focus:outline-none"
            disabled={loading}
          />
        </div>

        {/* Grade Selection */}
        <div>
          <label className="font-baloo font-semibold text-sm sm:text-md text-text-dark block mb-sm">
            Grade *
          </label>
          <div className="grid grid-cols-5 gap-sm sm:gap-md">
            {GRADES.map((g) => (
              <button
                key={g}
                onClick={() => setGrade(g)}
                className={`px-sm sm:px-md py-sm sm:py-md rounded-lg border-2 font-baloo text-sm sm:text-body transition-colors ${
                  grade === g
                    ? 'border-secondary bg-mint-light text-secondary font-bold'
                    : 'border-divider bg-white text-text-muted hover:border-secondary/50'
                }`}
                disabled={loading}
              >
                {g}
              </button>
            ))}
          </div>
        </div>

        {/* Info Banner */}
        <div className="bg-lavender-light border-2 border-primary rounded-lg p-md">
          <p className="font-baloo text-sm text-text-body">
            💡 <strong>Note:</strong> A unique 6-character code will be generated automatically.
            Share this code with students so they can join your class.
          </p>
        </div>

        {/* Actions */}
        <div className="flex gap-md justify-end">
          <Button
            title="Cancel"
            onPress={handleClose}
            variant="ghost"
            disabled={loading}
          />
          <Button
            title={loading ? 'Creating...' : 'Create Class'}
            onPress={handleSubmit}
            variant="primary"
            disabled={!name.trim() || loading}
            loading={loading}
          />
        </div>
      </div>
    </Modal>
  );
}
