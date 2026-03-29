import { useState, useEffect } from 'react';
import { FiUser, FiMail, FiCalendar, FiAtSign, FiFileText, FiEdit3, FiCheck, FiX } from 'react-icons/fi';
import { getAccountApi, updateBioApi, updateNameApi, changePasswordApi } from '../api/auth';
import type { UserRecord } from '../api/auth';

function AccountPage() {
  const [account, setAccount] = useState<UserRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingBio, setEditingBio] = useState(false);
  const [bioText, setBioText] = useState('');
  const [savingBio, setSavingBio] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [savingName, setSavingName] = useState(false);
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const [cpCurrent, setCpCurrent] = useState('');
  const [cpNew, setCpNew] = useState('');
  const [cpConfirm, setCpConfirm] = useState('');
  const [cpError, setCpError] = useState('');
  const [cpSuccess, setCpSuccess] = useState('');
  const [cpLoading, setCpLoading] = useState(false);

  useEffect(() => {
    getAccountApi()
      .then((data) => {
        setAccount(data);
        setBioText(data.bio || '');
        setFirstName(data.firstName);
        setLastName(data.lastName);
      })
      .catch((err) => console.error('Failed to fetch account', err))
      .finally(() => setLoading(false));
  }, []);

  const openChangePassword = () => {
    setCpCurrent('');
    setCpNew('');
    setCpConfirm('');
    setCpError('');
    setCpSuccess('');
    setChangePasswordOpen(true);
  };

  const handleChangePassword = async () => {
    setCpError('');
    setCpSuccess('');
    if (cpNew.length < 6) {
      setCpError('New password must be at least 6 characters');
      return;
    }
    if (cpNew !== cpConfirm) {
      setCpError('Passwords do not match');
      return;
    }
    setCpLoading(true);
    try {
      const res = await changePasswordApi(cpCurrent, cpNew);
      setCpSuccess(res.message);
      setCpCurrent('');
      setCpNew('');
      setCpConfirm('');
    } catch (err: any) {
      setCpError(err?.response?.data?.message || 'Failed to change password');
    } finally {
      setCpLoading(false);
    }
  };

  const handleSaveName = async () => {
    if (!firstName.trim() || !lastName.trim()) return;
    setSavingName(true);
    try {
      const updated = await updateNameApi(firstName.trim(), lastName.trim());
      setAccount(updated);
      setEditingName(false);
    } catch (err) {
      console.error('Failed to update name', err);
    } finally {
      setSavingName(false);
    }
  };

  const handleCancelName = () => {
    setFirstName(account?.firstName || '');
    setLastName(account?.lastName || '');
    setEditingName(false);
  };

  const handleSaveBio = async () => {
    setSavingBio(true);
    try {
      const updated = await updateBioApi(bioText);
      setAccount(updated);
      setEditingBio(false);
    } catch (err) {
      console.error('Failed to update bio', err);
    } finally {
      setSavingBio(false);
    }
  };

  const handleCancelBio = () => {
    setBioText(account?.bio || '');
    setEditingBio(false);
  };

  if (loading) {
    return <p>Loading...</p>;
  }

  if (!account) {
    return <p>Could not load account.</p>;
  }

  const joined = new Date(account.createdAt).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <div className="account-page">
      <div className="account-page-title">
        <h1>Account</h1>
        <div className="account-title-line" />
      </div>

      <div className="account-content">
        <div className="account-avatar-col">
          <div className="account-avatar-large">
            <FiUser />
          </div>
          <div className="account-settings-menu">
            <button className="account-settings-item" onClick={() => setEditingName(true)}>Change Name</button>
            <button className="account-settings-item" onClick={openChangePassword}>Change Password</button>
          </div>
        </div>

        <div className="account-info-col">
          {editingName ? (
            <div className="account-name-edit">
              <input
                className="account-name-input"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="First Name"
                autoFocus
              />
              <input
                className="account-name-input"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Last Name"
              />
              <div className="account-name-actions">
                <button className="account-bio-save" onClick={handleSaveName} disabled={savingName}>
                  <FiCheck size={14} />
                  {savingName ? 'Saving...' : 'Save'}
                </button>
                <button className="account-bio-cancel" onClick={handleCancelName}>
                  <FiX size={14} />
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <h2 className="account-name">{account.firstName} {account.lastName}</h2>
          )}
          <span className="account-role-badge">{account.role}</span>

          <div className="account-info-rows">
            <div className="account-info-item">
              <FiAtSign className="account-info-icon" />
              <div className="account-info-text">
                <span className="account-info-label">Username</span>
                <span className="account-info-value">@{account.username}</span>
              </div>
            </div>
            <div className="account-info-item">
              <FiMail className="account-info-icon" />
              <div className="account-info-text">
                <span className="account-info-label">Email</span>
                <span className="account-info-value">{account.email}</span>
              </div>
            </div>
            <div className="account-info-item">
              <FiCalendar className="account-info-icon" />
              <div className="account-info-text">
                <span className="account-info-label">Joined</span>
                <span className="account-info-value">{joined}</span>
              </div>
            </div>
            <div className="account-info-item">
              <FiFileText className="account-info-icon" />
              <div className="account-info-text">
                <div className="account-bio-label-row">
                  <span className="account-info-label">Bio</span>
                  {!editingBio && (
                    <button className="account-bio-edit-btn" onClick={() => setEditingBio(true)}>
                      <FiEdit3 size={13} />
                    </button>
                  )}
                </div>
                {editingBio ? (
                  <div className="account-bio-edit">
                    <textarea
                      className="account-bio-textarea"
                      value={bioText}
                      onChange={(e) => setBioText(e.target.value)}
                      placeholder="Write something about yourself..."
                      maxLength={300}
                      rows={6}
                    />
                    <div className="account-bio-actions">
                      <span className="account-bio-count">{bioText.length}/300</span>
                      <button className="account-bio-save" onClick={handleSaveBio} disabled={savingBio}>
                        <FiCheck size={14} />
                        {savingBio ? 'Saving...' : 'Save'}
                      </button>
                      <button className="account-bio-cancel" onClick={handleCancelBio}>
                        <FiX size={14} />
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  account.bio
                    ? <span className="account-bio-value">{account.bio}</span>
                    : <span className="account-bio-placeholder">No bio yet. Click the edit icon to add one.</span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {changePasswordOpen && (
        <>
          <div className="confirm-overlay" onClick={() => setChangePasswordOpen(false)} />
          <div className="confirm-modal">
            <button className="confirm-close" onClick={() => setChangePasswordOpen(false)}>
              <FiX size={18} />
            </button>
            <h3 className="confirm-title">Change Password</h3>
            <p className="confirm-message">Enter your current password and choose a new one.</p>
            <div className="confirm-password">
              <label>Current Password</label>
              <input
                type="password"
                value={cpCurrent}
                onChange={(e) => setCpCurrent(e.target.value)}
                placeholder="Current password"
              />
            </div>
            <div className="confirm-password">
              <label>New Password</label>
              <input
                type="password"
                value={cpNew}
                onChange={(e) => setCpNew(e.target.value)}
                placeholder="New password (min 6 characters)"
              />
            </div>
            <div className="confirm-password">
              <label>Confirm New Password</label>
              <input
                type="password"
                value={cpConfirm}
                onChange={(e) => setCpConfirm(e.target.value)}
                placeholder="Confirm new password"
              />
            </div>
            {cpError && <p className="confirm-error">{cpError}</p>}
            {cpSuccess && <p className="cp-success">{cpSuccess}</p>}
            <div className="confirm-actions">
              <button className="confirm-btn-cancel" onClick={() => setChangePasswordOpen(false)}>
                Cancel
              </button>
              <button
                className="confirm-btn-confirm cp-btn-submit"
                disabled={cpLoading || !cpCurrent || !cpNew || !cpConfirm}
                onClick={handleChangePassword}
              >
                {cpLoading ? 'Updating...' : 'Update Password'}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default AccountPage;
