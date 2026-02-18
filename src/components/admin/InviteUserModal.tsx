import { useState } from 'react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import type { UserRole } from '../../types/claims';

interface InviteUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function InviteUserModal({ isOpen, onClose, onSuccess }: InviteUserModalProps) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<UserRole>('teacher');
  const [projectId, setProjectId] = useState('');
  const [schoolIds, setSchoolIds] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit() {
    if (!email.trim()) {
      setError('Email is required');
      return;
    }

    if (!email.includes('@')) {
      setError('Please enter a valid email');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // TODO: Implement Cloud Function to invite user and set custom claims
      // For now, this is a placeholder
      console.log('Inviting user:', {
        email,
        role,
        projectId: projectId || undefined,
        schoolIds: schoolIds ? schoolIds.split(',').map(s => s.trim()) : undefined,
      });

      alert('User invitation feature coming soon!\n\nThis will require a Cloud Function to:\n1. Create Firebase Auth user\n2. Set custom claims\n3. Send invitation email');

      // Reset form
      setEmail('');
      setRole('teacher');
      setProjectId('');
      setSchoolIds('');
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Error inviting user:', err);
      setError(err.message || 'Failed to invite user');
    } finally {
      setLoading(false);
    }
  }

  function handleClose() {
    if (!loading) {
      setEmail('');
      setRole('teacher');
      setProjectId('');
      setSchoolIds('');
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
            Invite User
          </h2>
          <p className="font-baloo text-sm sm:text-md text-text-muted">
            Send an invitation and assign role-based permissions
          </p>
        </div>

        {/* Info Banner */}
        <div className="bg-sunshine-light border-2 border-warning rounded-lg p-md">
          <p className="font-baloo text-sm text-text-body">
            ⚠️ <strong>Note:</strong> This feature requires Cloud Functions to set custom claims. Implementation coming in Phase 3.
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-rose-light border-2 border-error rounded-lg p-md">
            <p className="font-baloo text-sm sm:text-md text-error">{error}</p>
          </div>
        )}

        {/* Email */}
        <div>
          <label className="font-baloo font-semibold text-sm sm:text-md text-text-dark block mb-sm">
            Email Address *
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="user@example.com"
            className="w-full px-md py-sm sm:py-md rounded-lg border-2 border-divider bg-white font-baloo text-sm sm:text-body focus:border-primary focus:outline-none"
            disabled={loading}
          />
        </div>

        {/* Role Selection */}
        <div>
          <label className="font-baloo font-semibold text-sm sm:text-md text-text-dark block mb-sm">
            Role *
          </label>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as UserRole)}
            className="w-full px-md py-sm sm:py-md rounded-lg border-2 border-divider bg-white font-baloo text-sm sm:text-body focus:border-primary focus:outline-none"
            disabled={loading}
          >
            <option value="teacher">Teacher</option>
            <option value="principal">Principal</option>
            <option value="pm">Project Manager</option>
            <option value="projectAdmin">Project Admin</option>
            <option value="admin">Super Admin</option>
          </select>
          <p className="font-baloo text-sm text-text-muted mt-sm">
            {role === 'admin' && 'Full access to all projects and schools'}
            {role === 'projectAdmin' && 'Manage schools within assigned project'}
            {role === 'pm' && 'Read-only access to project data'}
            {role === 'principal' && 'Read-only access to assigned schools'}
            {role === 'teacher' && 'Manage classes, students, and curriculum'}
          </p>
        </div>

        {/* Project ID - For projectAdmin and PM */}
        {(role === 'projectAdmin' || role === 'pm') && (
          <div>
            <label className="font-baloo font-semibold text-sm sm:text-md text-text-dark block mb-sm">
              Project ID *
            </label>
            <input
              type="text"
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              placeholder="project-123"
              className="w-full px-md py-sm sm:py-md rounded-lg border-2 border-divider bg-white font-baloo text-sm sm:text-body focus:border-primary focus:outline-none"
              disabled={loading}
            />
          </div>
        )}

        {/* School IDs - For principal */}
        {role === 'principal' && (
          <div>
            <label className="font-baloo font-semibold text-sm sm:text-md text-text-dark block mb-sm">
              School IDs (comma-separated)
            </label>
            <input
              type="text"
              value={schoolIds}
              onChange={(e) => setSchoolIds(e.target.value)}
              placeholder="school-1, school-2"
              className="w-full px-md py-sm sm:py-md rounded-lg border-2 border-divider bg-white font-baloo text-sm sm:text-body focus:border-primary focus:outline-none"
              disabled={loading}
            />
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
            title={loading ? 'Sending...' : 'Send Invitation'}
            onPress={handleSubmit}
            variant="primary"
            disabled={!email.trim() || loading}
            loading={loading}
          />
        </div>
      </div>
    </Modal>
  );
}
