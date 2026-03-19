import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getUsersApi, updateUserRoleApi } from '../api/auth';
import type { UserRecord } from '../api/auth';
import { useAuth } from '../context/AuthContext';

function UserManagementPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const isAdmin = user?.role === 'admin';

  const fetchUsers = async () => {
    try {
      const data = await getUsersApi();
      setUsers(data);
    } catch (err) {
      console.error('Failed to fetch users', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleRoleChange = async (userId: string, newRole: string) => {
    try {
      await updateUserRoleApi(userId, newRole);
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, role: newRole } : u)),
      );
    } catch (err) {
      console.error('Failed to update role', err);
    }
  };

  if (loading) return <p style={{ color: 'var(--text-3)' }}>Loading users...</p>;

  // Reviewers can't see admin users
  const visibleUsers = isAdmin ? users : users.filter((u) => u.role !== 'admin');

  return (
    <div>
      <h2 style={{ fontSize: '1.15rem', fontWeight: 600, marginBottom: '1.25rem', color: 'var(--text-1)' }}>User Management</h2>
      <table className="user-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Username</th>
            <th>Email</th>
            <th>Role</th>
          </tr>
        </thead>
        <tbody>
          {visibleUsers.map((u) => (
            <tr
              key={u.id}
              className={
                u.isBlocked
                  ? 'user-row-blocked'
                  : u.deletedAt
                    ? 'user-row-deleted'
                    : ''
              }
            >
              <td>
                <span
                  className="user-name-link"
                  onClick={() => navigate(`/profile/${u.id}`)}
                >
                  {u.firstName} {u.lastName}
                </span>
                {u.isBlocked && (
                  <span className="user-status-badge user-badge-blocked">
                    Blocked
                  </span>
                )}
                {u.deletedAt && (
                  <span className="user-status-badge user-badge-deleted">
                    Pending Deletion
                  </span>
                )}
              </td>
              <td>{u.username}</td>
              <td>{u.email}</td>
              <td>
                <select
                  className="role-select"
                  value={u.role}
                  onChange={(e) => handleRoleChange(u.id, e.target.value)}
                >
                  <option value="user">user</option>
                  <option value="reviewer">reviewer</option>
                  {isAdmin && <option value="admin">admin</option>}
                </select>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default UserManagementPage;
