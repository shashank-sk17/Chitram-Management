import { useState } from 'react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { createProject } from '../../services/firebase/firestore';
import { useAuthStore } from '../../stores/authStore';

interface CreateProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function CreateProjectModal({ isOpen, onClose, onSuccess }: CreateProjectModalProps) {
  const { user } = useAuthStore();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit() {
    if (!name.trim()) {
      setError('Project name is required');
      return;
    }

    if (!user) {
      setError('You must be logged in');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await createProject({
        name: name.trim(),
        description: description.trim() || undefined,
        createdBy: user.uid,
      });

      // Reset form
      setName('');
      setDescription('');
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Error creating project:', err);
      setError(err.message || 'Failed to create project');
    } finally {
      setLoading(false);
    }
  }

  function handleClose() {
    if (!loading) {
      setName('');
      setDescription('');
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
            Create New Project
          </h2>
          <p className="font-baloo text-sm sm:text-md text-text-muted">
            Projects help organize multiple schools under a single management structure
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-rose-light border-2 border-error rounded-lg p-md">
            <p className="font-baloo text-sm sm:text-md text-error">{error}</p>
          </div>
        )}

        {/* Project Name */}
        <div>
          <label className="font-baloo font-semibold text-sm sm:text-md text-text-dark block mb-sm">
            Project Name *
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Maharashtra Schools 2024"
            className="w-full px-md py-sm sm:py-md rounded-lg border-2 border-divider bg-white font-baloo text-sm sm:text-body focus:border-primary focus:outline-none"
            disabled={loading}
          />
        </div>

        {/* Description */}
        <div>
          <label className="font-baloo font-semibold text-sm sm:text-md text-text-dark block mb-sm">
            Description (Optional)
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Brief description of this project..."
            rows={3}
            className="w-full px-md py-sm sm:py-md rounded-lg border-2 border-divider bg-white font-baloo text-sm sm:text-body focus:border-primary focus:outline-none resize-none"
            disabled={loading}
          />
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
            title={loading ? 'Creating...' : 'Create Project'}
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
