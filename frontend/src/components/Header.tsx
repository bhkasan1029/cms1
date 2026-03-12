import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiSearch, FiBell, FiUser, FiSettings, FiLogOut, FiUserCheck, FiX, FiSun, FiMoon } from 'react-icons/fi';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useNotifications } from '../context/NotificationContext';
import { changePasswordApi, getAccountApi, updateEmailNotificationsApi } from '../api/auth';
import NotificationPanel from './NotificationPanel';

interface HeaderProps {
  sidebarCollapsed?: boolean;
}

function Header({ sidebarCollapsed }: HeaderProps) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const { unreadCount } = useNotifications();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const goToAccount = () => {
    setDropdownOpen(false);
    navigate('/account');
  };

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const [cpCurrent, setCpCurrent] = useState('');
  const [cpNew, setCpNew] = useState('');
  const [cpConfirm, setCpConfirm] = useState('');
  const [cpError, setCpError] = useState('');
  const [cpSuccess, setCpSuccess] = useState('');
  const [cpLoading, setCpLoading] = useState(false);
  const [emailNotifsEnabled, setEmailNotifsEnabled] = useState(true);
  const [emailNotifsLoading, setEmailNotifsLoading] = useState(false);

  const openChangePassword = () => {
    setSettingsOpen(false);
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

  const goToSettings = () => {
    setDropdownOpen(false);
    setSettingsOpen(true);
    getAccountApi()
      .then((acc) => setEmailNotifsEnabled(acc.emailNotificationsEnabled ?? true))
      .catch(() => {});
  };

  const toggleEmailNotifs = async () => {
    setEmailNotifsLoading(true);
    try {
      const updated = await updateEmailNotificationsApi(!emailNotifsEnabled);
      setEmailNotifsEnabled(updated.emailNotificationsEnabled ?? !emailNotifsEnabled);
    } catch {
      // ignore
    } finally {
      setEmailNotifsLoading(false);
    }
  };

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <>
      <header className="app-header">
        {sidebarCollapsed && <div className="header-brand">slateCMS</div>}
        <div className="header-search">
          <FiSearch className="header-search-icon" />
          <input type="text" placeholder="Search..." readOnly />
        </div>

        <div className="header-actions">
          <button
            className="header-icon-btn"
            title={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
            onClick={toggleTheme}
          >
            {theme === 'light' ? <FiMoon /> : <FiSun />}
          </button>

          <button
            className="header-icon-btn"
            title="Notifications"
            onClick={() => setNotifOpen((prev) => !prev)}
            style={{ position: 'relative' }}
          >
            <FiBell />
            {unreadCount > 0 && (
              <span className="notif-badge">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>

          <div className="header-profile" ref={dropdownRef}>
            <button
              className="header-avatar"
              onClick={() => setDropdownOpen((prev) => !prev)}
              title="Profile"
            >
              <FiUser />
            </button>

            {dropdownOpen && (
              <div className="header-dropdown">
                <div className="header-dropdown-info header-dropdown-clickable" onClick={goToAccount}>
                  <span className="header-dropdown-name">{user?.username}</span>
                  <span className="header-dropdown-role">{user?.role}</span>
                </div>
                <div className="header-dropdown-divider" />
                <button className="header-dropdown-item" onClick={goToAccount}>
                  <FiUserCheck size={14} />
                  Account
                </button>
                <button className="header-dropdown-item" onClick={goToSettings}>
                  <FiSettings size={14} />
                  Settings
                </button>
                <div className="header-dropdown-divider" />
                <button className="header-dropdown-item header-dropdown-logout" onClick={logout}>
                  <FiLogOut size={14} />
                  Logout
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <NotificationPanel open={notifOpen} onClose={() => setNotifOpen(false)} />

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

      {settingsOpen && (
        <>
          <div className="settings-overlay" onClick={() => setSettingsOpen(false)} />
          <div className="settings-modal">
            <div className="settings-modal-header">
              <h2 className="settings-modal-title">Settings</h2>
              <button className="settings-modal-close" onClick={() => setSettingsOpen(false)}>
                <FiX size={20} />
              </button>
            </div>
            <table className="settings-table">
              <thead>
                <tr>
                  <th>Setting</th>
                  <th>Description</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { label: 'Change Password', description: 'Update your account password', onClick: openChangePassword },
                  { label: 'Two-Factor Authentication', description: 'Add an extra layer of security' },
                  { label: 'Email Notifications', description: 'Receive emails for task events and admin actions', toggle: true },
                  { label: 'Privacy Settings', description: 'Control who can see your profile' },
                  { label: 'Language', description: 'Choose your preferred language' },
                  { label: 'Theme', description: `Currently: ${theme === 'light' ? 'Light' : 'Dark'} mode`, onClick: toggleTheme },
                  { label: 'Session Management', description: 'View and manage active sessions' },
                  { label: 'Delete Account', description: 'Permanently delete your account and data' },
                ].map((s) => (
                  <tr
                    key={s.label}
                    className={s.onClick ? 'settings-row-clickable' : undefined}
                    onClick={s.onClick}
                  >
                    <td className="settings-label">{s.label}</td>
                    <td className="settings-desc">
                      {'toggle' in s && s.toggle ? (
                        <div className="settings-toggle-cell">
                          <label className="toggle-switch" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              checked={emailNotifsEnabled}
                              disabled={emailNotifsLoading}
                              onChange={toggleEmailNotifs}
                            />
                            <span className="toggle-slider" />
                          </label>
                          <span>{s.description}</span>
                        </div>
                      ) : (
                        s.description
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}

export default Header;
