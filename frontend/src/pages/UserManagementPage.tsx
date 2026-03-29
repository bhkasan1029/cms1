import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getUsersApi, updateUserRoleApi } from '../api/auth';
import type { UserRecord } from '../api/auth';
import { useAuth } from '../context/AuthContext';

const getInitials = (firstName: string, lastName: string) =>
  `${firstName?.[0] ?? ''}${lastName?.[0] ?? ''}`.toUpperCase();

const roleBadgeStyle: Record<string, React.CSSProperties> = {
  admin: {
    background: 'rgba(245,158,11,0.10)',
    color: '#f59e0b',
    border: '1px solid rgba(245,158,11,0.20)',
  },
  reviewer: {
    background: 'rgba(168,85,247,0.10)',
    color: '#a855f7',
    border: '1px solid rgba(168,85,247,0.20)',
  },
  user: {
    background: 'rgba(59,130,246,0.10)',
    color: '#3b82f6',
    border: '1px solid rgba(59,130,246,0.20)',
  },
};

function Avatar({ firstName, lastName, photoUrl }: { firstName: string; lastName: string; photoUrl?: string }) {
  const initials = getInitials(firstName, lastName);

  if (photoUrl) {
    return (
      <img
        src={photoUrl}
        alt={initials}
        style={{
          width: 40,
          height: 40,
          borderRadius: '50%',
          objectFit: 'cover',
          flexShrink: 0,
          border: '2px solid rgba(255,255,255,0.08)',
        }}
      />
    );
  }

  return (
    <div
      style={{
        width: 40,
        height: 40,
        borderRadius: '50%',
        background: '#5B7FA6',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '0.8rem',
        fontWeight: 700,
        color: '#fff',
        flexShrink: 0,
        letterSpacing: '0.03em',
        border: '2px solid rgba(255,255,255,0.08)',
      }}
    >
      {initials}
    </div>
  );
}

function RoleBadge({ role }: { role: string }) {
  const style = roleBadgeStyle[role] ?? roleBadgeStyle.user;
  return (
    <span
      style={{
        ...style,
        padding: '2px 10px',
        borderRadius: 9999,
        fontSize: '0.72rem',
        fontWeight: 600,
        letterSpacing: '0.04em',
        textTransform: 'capitalize',
        display: 'inline-block',
        whiteSpace: 'nowrap',
      }}
    >
      {role}
    </span>
  );
}

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

  const visibleUsers = isAdmin ? users : users.filter((u) => u.role !== 'admin');

  return (
    <div>
      <h2 style={{ fontSize: '1.15rem', fontWeight: 600, marginBottom: '1.25rem', color: 'var(--text-1)' }}>
        User Management
      </h2>
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
                u.isBlocked ? 'user-row-blocked' : u.deletedAt ? 'user-row-deleted' : ''
              }
            >
              {/* ── Name + Avatar cell ── */}
              <td>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <Avatar
                    firstName={u.firstName}
                    lastName={u.lastName}
                  //photoUrl={u.photoUrl}
                  />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <span
                      className="user-name-link"
                      onClick={() => navigate(`/profile/${u.id}`)}
                      style={{ color: '#ffffff', fontWeight: 600, lineHeight: 1.2 }}
                    >
                      {u.firstName} {u.lastName}
                    </span>
                    <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                      {u.isBlocked && (
                        <span className="user-status-badge user-badge-blocked">Blocked</span>
                      )}
                      {u.deletedAt && (
                        <span className="user-status-badge user-badge-deleted">Pending Deletion</span>
                      )}
                    </div>
                  </div>
                </div>
              </td>

              {/* ── Username ── */}
              <td style={{ color: '#94a3b8', fontSize: '0.875rem' }}>{u.username}</td>

              {/* ── Email ── */}
              <td style={{ color: '#94a3b8', fontSize: '0.875rem' }}>{u.email}</td>

              {/* ── Role ── */}
              <td>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <RoleBadge role={u.role} />
                  <select
                    className="role-select"
                    value={u.role}
                    onChange={(e) => handleRoleChange(u.id, e.target.value)}
                  >
                    <option value="user">user</option>
                    <option value="reviewer">reviewer</option>
                    {isAdmin && <option value="admin">admin</option>}
                  </select>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default UserManagementPage;