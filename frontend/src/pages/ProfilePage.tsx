import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FiUser, FiMail, FiCalendar, FiAtSign, FiFileText, FiSlash, FiTrash2 } from 'react-icons/fi';
import { getUserByIdApi, blockUserApi, softDeleteUserApi } from '../api/auth';
import { useAuth } from '../context/AuthContext';
import ConfirmModal from '../components/ConfirmModal';
import type { UserRecord } from '../api/auth';
import axios from 'axios';

function ProfilePage() {
  const { userId } = useParams<{ userId: string }>();
  const { user: currentUser } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<UserRecord | null>(null);
  const [loading, setLoading] = useState(true);

  const [blockModalOpen, setBlockModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [modalError, setModalError] = useState('');

  const isAdmin = currentUser?.role === 'admin';
  const canManage = isAdmin && profile && profile.role !== 'admin';

  useEffect(() => {
    if (!userId) return;
    getUserByIdApi(userId)
      .then(setProfile)
      .catch((err) => console.error('Failed to fetch profile', err))
      .finally(() => setLoading(false));
  }, [userId]);

  const handleBlock = async (password: string) => {
    setModalError('');
    try {
      const updated = await blockUserApi(profile!.id, password);
      setProfile(updated);
      setBlockModalOpen(false);
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.data?.message) {
        setModalError(err.response.data.message);
      } else {
        setModalError('Something went wrong');
      }
      throw err;
    }
  };

  const handleDelete = async (password: string) => {
    setModalError('');
    try {
      await softDeleteUserApi(profile!.id, password);
      setDeleteModalOpen(false);
      navigate('/user-management');
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.data?.message) {
        setModalError(err.response.data.message);
      } else {
        setModalError('Something went wrong');
      }
      throw err;
    }
  };

  if (loading) {
    return <p>Loading...</p>;
  }

  if (!profile) {
    return <p>User not found.</p>;
  }

  const joined = new Date(profile.createdAt).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  const isBlocked = profile.isBlocked;
  const isDeleted = !!profile.deletedAt;

  return (
    <div className="account-page">
      <div className="account-page-title">
        <h1>Profile</h1>
        <div className="account-title-line" />
      </div>

      <div className="account-content">
        <div className="account-avatar-col">
          <div className="account-avatar-large">
            <FiUser />
          </div>
        </div>

        <div className="account-info-col">
          <h2 className="account-name">
            {profile.firstName} {profile.lastName}
            {isBlocked && <span className="profile-status-tag profile-blocked-tag">Blocked</span>}
            {isDeleted && <span className="profile-status-tag profile-deleted-tag">Pending Deletion</span>}
          </h2>
          <span className="account-role-badge">{profile.role}</span>

          <div className="account-info-rows">
            <div className="account-info-item">
              <FiAtSign className="account-info-icon" />
              <div className="account-info-text">
                <span className="account-info-label">Username</span>
                <span className="account-info-value">@{profile.username}</span>
              </div>
            </div>
            <div className="account-info-item">
              <FiMail className="account-info-icon" />
              <div className="account-info-text">
                <span className="account-info-label">Email</span>
                <span className="account-info-value">{profile.email}</span>
              </div>
            </div>
            <div className="account-info-item">
              <FiCalendar className="account-info-icon" />
              <div className="account-info-text">
                <span className="account-info-label">Joined</span>
                <span className="account-info-value">{joined}</span>
              </div>
            </div>
            {profile.bio && (
              <div className="account-info-item">
                <FiFileText className="account-info-icon" />
                <div className="account-info-text">
                  <span className="account-info-label">Bio</span>
                  <span className="account-bio-value">{profile.bio}</span>
                </div>
              </div>
            )}
          </div>

          {canManage && (
            <div className="profile-admin-actions">
              <button
                className="profile-action-btn profile-block-btn"
                onClick={() => { setModalError(''); setBlockModalOpen(true); }}
              >
                <FiSlash size={15} />
                {isBlocked ? 'Unblock Account' : 'Block Account'}
              </button>
              {!isDeleted && (
                <button
                  className="profile-action-btn profile-delete-btn"
                  onClick={() => { setModalError(''); setDeleteModalOpen(true); }}
                >
                  <FiTrash2 size={15} />
                  Delete Account
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      <ConfirmModal
        open={blockModalOpen}
        title={isBlocked ? 'Unblock Account' : 'Block Account'}
        message={
          isBlocked
            ? `Are you sure you want to unblock ${profile.firstName} ${profile.lastName}? They will be able to log in again.`
            : `Are you sure you want to block ${profile.firstName} ${profile.lastName}? They will be immediately logged out and unable to sign in.`
        }
        confirmLabel={isBlocked ? 'Yes, unblock' : 'Yes, block'}
        onConfirm={handleBlock}
        onCancel={() => setBlockModalOpen(false)}
        error={modalError}
      />

      <ConfirmModal
        open={deleteModalOpen}
        title="Delete Account"
        message={`Are you sure you want to delete ${profile.firstName} ${profile.lastName}'s account? The account will be permanently removed after 24 hours. This action cannot be undone.`}
        confirmLabel="Yes, delete"
        onConfirm={handleDelete}
        onCancel={() => setDeleteModalOpen(false)}
        error={modalError}
      />
    </div>
  );
}

export default ProfilePage;
