import { useState } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../config/firebase';
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
  const [displayName, setDisplayName] = useState('');
  const [role, setRole] = useState<UserRole>('teacher');
  const [projectId, setProjectId] = useState('');
  const [schoolIds, setSchoolIds] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successLink, setSuccessLink] = useState('');
  const [linkCopied, setLinkCopied] = useState(false);

  async function handleSubmit() {
    if (!email.trim()) { setError('Email is required'); return; }
    if (!email.includes('@')) { setError('Please enter a valid email'); return; }
    if ((role === 'pm' || role === 'projectAdmin') && !projectId.trim()) {
      setError('Project ID is required for this role');
      return;
    }
    if (role === 'principal' && !schoolIds.trim()) {
      setError('School IDs are required for Principal');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const inviteUser = httpsCallable(functions, 'inviteUser');
      const result = await inviteUser({
        email: email.trim(),
        displayName: displayName.trim() || undefined,
        role,
        projectId: projectId.trim() || undefined,
        schoolIds: schoolIds.trim()
          ? schoolIds.split(',').map((s) => s.trim()).filter(Boolean)
          : undefined,
      });

      const { link } = result.data as { uid: string; link: string; isNewUser: boolean };
      setSuccessLink(link);
      onSuccess();
    } catch (err: any) {
      console.error('Error inviting user:', err);
      setError(err.message || 'Failed to invite user. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  function handleCopyLink() {
    navigator.clipboard.writeText(successLink).then(() => {
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    });
  }

  function handleClose() {
    if (loading) return;
    setEmail('');
    setDisplayName('');
    setRole('teacher');
    setProjectId('');
    setSchoolIds('');
    setError('');
    setSuccessLink('');
    setLinkCopied(false);
    onClose();
  }

  // Success state — show the password setup link
  if (successLink) {
    return (
      <Modal isOpen={isOpen} onClose={handleClose}>
        <div className="flex flex-col gap-md sm:gap-lg">
          <div className="text-center">
            <span className="text-5xl block mb-md">✅</span>
            <h2 className="font-baloo font-bold text-xl text-text-dark mb-sm">User Invited!</h2>
            <p className="font-baloo text-sm text-text-muted">
              Share this password setup link with the user. It expires after one use.
            </p>
          </div>

          <div className="bg-lavender-light rounded-lg p-md">
            <p className="font-baloo text-xs text-text-muted mb-sm">Password Setup Link</p>
            <p className="font-mono text-xs text-text-dark break-all bg-white rounded p-sm border border-divider">
              {successLink}
            </p>
          </div>

          <div className="flex gap-md justify-end">
            <Button
              title={linkCopied ? 'Copied!' : 'Copy Link'}
              onPress={handleCopyLink}
              variant="secondary"
            />
            <Button title="Done" onPress={handleClose} variant="primary" />
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose}>
      <div className="flex flex-col gap-md sm:gap-lg">
        {/* Header */}
        <div>
          <h2 className="font-baloo font-bold text-xl text-text-dark mb-sm">Invite User</h2>
          <p className="font-baloo text-sm sm:text-md text-text-muted">
            Creates an account and sends a password setup link
          </p>
        </div>

        {error && (
          <div className="bg-rose-light border-2 border-error rounded-lg p-md">
            <p className="font-baloo text-sm sm:text-md text-error">{error}</p>
          </div>
        )}

        {/* Display Name */}
        <div>
          <label className="font-baloo font-semibold text-sm sm:text-md text-text-dark block mb-sm">
            Full Name
          </label>
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="e.g. Priya Sharma"
            className="w-full px-md py-sm sm:py-md rounded-lg border-2 border-divider bg-white font-baloo text-sm sm:text-body focus:border-primary focus:outline-none"
            disabled={loading}
          />
        </div>

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

        {/* Role */}
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
            <option value="admin">Super Admin</option>
            <option value="projectAdmin">Project Admin</option>
            <option value="pm">Project Manager</option>
            <option value="principal">Principal</option>
            <option value="contentWriter">Content Writer</option>
            <option value="contentReviewer">Content Reviewer</option>
          </select>
          <p className="font-baloo text-xs text-text-muted mt-xs">
            {role === 'admin' && 'Full access to all projects, schools, and platform settings'}
            {role === 'projectAdmin' && 'Manage schools, teachers, and curriculum within their project'}
            {role === 'pm' && 'Read-only analytics and reporting for their project'}
            {role === 'principal' && 'Read-only access to assigned school(s) analytics'}
            {role === 'contentWriter' && 'Submit words and bulk CSV imports to the review queue'}
            {role === 'contentReviewer' && 'Approve or reject pending word submissions from content writers'}
          </p>
        </div>

        {/* Project ID — for projectAdmin and PM */}
        {(role === 'projectAdmin' || role === 'pm') && (
          <div>
            <label className="font-baloo font-semibold text-sm sm:text-md text-text-dark block mb-sm">
              Project ID *
            </label>
            <input
              type="text"
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              placeholder="Paste project Firestore ID"
              className="w-full px-md py-sm sm:py-md rounded-lg border-2 border-divider bg-white font-baloo text-sm sm:text-body focus:border-primary focus:outline-none"
              disabled={loading}
            />
          </div>
        )}

        {/* School IDs — for principal */}
        {role === 'principal' && (
          <div>
            <label className="font-baloo font-semibold text-sm sm:text-md text-text-dark block mb-sm">
              School IDs * <span className="font-normal text-text-muted">(comma-separated)</span>
            </label>
            <input
              type="text"
              value={schoolIds}
              onChange={(e) => setSchoolIds(e.target.value)}
              placeholder="schoolId1, schoolId2"
              className="w-full px-md py-sm sm:py-md rounded-lg border-2 border-divider bg-white font-baloo text-sm sm:text-body focus:border-primary focus:outline-none"
              disabled={loading}
            />
          </div>
        )}

        {/* Note for teacher role */}
        {role === 'teacher' && (
          <div className="bg-sunshine-light border-2 border-warning rounded-lg p-md">
            <p className="font-baloo text-sm text-text-body">
              Teachers self-register using a school code on the portal login page. Use this form for admin-level roles only.
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-md justify-end">
          <Button title="Cancel" onPress={handleClose} variant="ghost" disabled={loading} />
          <Button
            title={loading ? 'Inviting...' : 'Send Invitation'}
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
