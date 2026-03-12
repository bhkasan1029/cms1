function SettingsPage() {
  const settings = [
    { label: 'Change Password', description: 'Update your account password' },
    { label: 'Two-Factor Authentication', description: 'Add an extra layer of security' },
    { label: 'Email Notifications', description: 'Manage email notification preferences' },
    { label: 'Privacy Settings', description: 'Control who can see your profile' },
    { label: 'Language', description: 'Choose your preferred language' },
    { label: 'Theme', description: 'Switch between light and dark mode' },
    { label: 'Session Management', description: 'View and manage active sessions' },
    { label: 'Delete Account', description: 'Permanently delete your account and data' },
  ];

  return (
    <div className="settings-page">
      <h1 className="settings-title">Settings</h1>
      <div className="settings-line" />

      <table className="settings-table">
        <thead>
          <tr>
            <th>Setting</th>
            <th>Description</th>
          </tr>
        </thead>
        <tbody>
          {settings.map((s) => (
            <tr key={s.label}>
              <td className="settings-label">{s.label}</td>
              <td className="settings-desc">{s.description}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default SettingsPage;
