import { useState, useEffect } from 'react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { createSchool, generateJoinCode, getAllProjects } from '../../services/firebase/firestore';
import { useAuthStore } from '../../stores/authStore';
import type { ProjectDoc } from '../../types/firestore';

interface CreateSchoolModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function CreateSchoolModal({ isOpen, onClose, onSuccess }: CreateSchoolModalProps) {
  const { user, claims } = useAuthStore();
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [projects, setProjects] = useState<Array<ProjectDoc & { id: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const isSuperAdmin = claims?.role === 'admin';
  const isProjectAdmin = claims?.role === 'projectAdmin';

  // Load projects on mount
  useEffect(() => {
    if (isOpen && isSuperAdmin) {
      loadProjects();
    }
  }, [isOpen, isSuperAdmin]);

  // Generate code on mount
  useEffect(() => {
    if (isOpen && !code) {
      setCode(generateJoinCode());
    }
  }, [isOpen]);

  async function loadProjects() {
    try {
      const projectsData = await getAllProjects();
      setProjects(projectsData);
    } catch (err) {
      console.error('Error loading projects:', err);
    }
  }

  async function handleSubmit() {
    if (!name.trim()) {
      setError('School name is required');
      return;
    }

    if (!code.trim()) {
      setError('School code is required');
      return;
    }

    if (!user) {
      setError('You must be logged in');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Determine projectId
      let projectId: string | undefined;
      if (isProjectAdmin) {
        projectId = claims.projectId;
      } else if (isSuperAdmin && selectedProjectId) {
        projectId = selectedProjectId;
      }

      await createSchool({
        name: name.trim(),
        code: code.trim().toUpperCase(),
        createdBy: user.uid,
        projectId,
      });

      // Reset form
      setName('');
      setCode('');
      setSelectedProjectId('');
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Error creating school:', err);
      setError(err.message || 'Failed to create school');
    } finally {
      setLoading(false);
    }
  }

  function handleClose() {
    if (!loading) {
      setName('');
      setCode('');
      setSelectedProjectId('');
      setError('');
      onClose();
    }
  }

  function regenerateCode() {
    setCode(generateJoinCode());
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose}>
      <div className="flex flex-col gap-md sm:gap-lg">
        {/* Header */}
        <div>
          <h2 className="font-baloo font-bold text-xl text-text-dark mb-sm">
            Create New School
          </h2>
          <p className="font-baloo text-sm sm:text-md text-text-muted">
            Schools can be assigned to projects for organized management
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-rose-light border-2 border-error rounded-lg p-md">
            <p className="font-baloo text-sm sm:text-md text-error">{error}</p>
          </div>
        )}

        {/* School Name */}
        <div>
          <label className="font-baloo font-semibold text-sm sm:text-md text-text-dark block mb-sm">
            School Name *
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Greenwood Primary School"
            className="w-full px-md py-sm sm:py-md rounded-lg border-2 border-divider bg-white font-baloo text-sm sm:text-body focus:border-primary focus:outline-none"
            disabled={loading}
          />
        </div>

        {/* School Code */}
        <div>
          <label className="font-baloo font-semibold text-sm sm:text-md text-text-dark block mb-sm">
            School Code *
          </label>
          <div className="flex gap-md">
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="CHTRM1"
              maxLength={6}
              className="flex-1 px-md py-sm sm:py-md rounded-lg border-2 border-divider bg-white font-baloo text-sm sm:text-body uppercase focus:border-primary focus:outline-none"
              disabled={loading}
            />
            <Button
              title="🔄"
              onPress={regenerateCode}
              variant="outline"
              size="md"
              disabled={loading}
            />
          </div>
          <p className="font-baloo text-sm text-text-muted mt-sm">
            Teachers will use this code to join the school
          </p>
        </div>

        {/* Project Selection - Only for Super Admin */}
        {isSuperAdmin && (
          <div>
            <label className="font-baloo font-semibold text-sm sm:text-md text-text-dark block mb-sm">
              Assign to Project (Optional)
            </label>
            <select
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              className="w-full px-md py-sm sm:py-md rounded-lg border-2 border-divider bg-white font-baloo text-sm sm:text-body focus:border-primary focus:outline-none"
              disabled={loading}
            >
              <option value="">No Project (Unassigned)</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Project Info - For Project Admin */}
        {isProjectAdmin && claims.projectId && (
          <div className="bg-lavender-light px-md py-md rounded-lg">
            <p className="font-baloo text-sm text-text-body">
              📁 This school will be assigned to your project: <strong>{claims.projectId}</strong>
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
            title={loading ? 'Creating...' : 'Create School'}
            onPress={handleSubmit}
            variant="primary"
            disabled={!name.trim() || !code.trim() || loading}
            loading={loading}
          />
        </div>
      </div>
    </Modal>
  );
}
