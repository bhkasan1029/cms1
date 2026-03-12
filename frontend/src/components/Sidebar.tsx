import { useNavigate, useLocation } from 'react-router-dom';
import {
  FiGrid,
  FiCheckSquare,
  FiBarChart2,
  FiPlusCircle,
  FiUsers,
  FiMenu,
  FiHexagon,
} from 'react-icons/fi';
import { useAuth } from '../context/AuthContext';

interface SidebarItem {
  label: string;
  icon: React.ReactNode;
  path: string;
  roles: string[];
}

const sidebarItems: SidebarItem[] = [
  { label: 'Dashboard', icon: <FiGrid />, path: '/dashboard', roles: ['admin', 'reviewer', 'user'] },
  { label: 'Tasks', icon: <FiCheckSquare />, path: '/tasks', roles: ['admin', 'reviewer', 'user'] },
  { label: 'Report', icon: <FiBarChart2 />, path: '/report', roles: ['admin', 'reviewer', 'user'] },
  { label: 'Create Task', icon: <FiPlusCircle />, path: '/create-task', roles: ['admin', 'reviewer'] },
  { label: 'User Management', icon: <FiUsers />, path: '/user-management', roles: ['admin', 'reviewer'] },
];

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const role = user?.role ?? 'user';

  const visibleItems = sidebarItems.filter((item) => item.roles.includes(role));

  return (
    <aside className={`app-sidebar ${collapsed ? 'sidebar-collapsed' : ''}`}>
      <div className="sidebar-top">
        {collapsed ? (
          <button className="sidebar-collapsed-btn" onClick={onToggle} title="Expand sidebar">
            <FiHexagon className="sidebar-collapsed-logo" />
            <FiMenu className="sidebar-collapsed-ham" />
          </button>
        ) : (
          <>
            <div className="sidebar-brand">
              <FiHexagon className="sidebar-logo-icon" />
              <span className="sidebar-logo-text">slateCMS</span>
            </div>
            <button className="sidebar-toggle" onClick={onToggle} title="Collapse sidebar">
              <FiMenu />
            </button>
          </>
        )}
      </div>
      <nav className="sidebar-nav">
        {visibleItems.map((item) => (
          <div
            key={item.label}
            className={`sidebar-item ${location.pathname === item.path ? 'sidebar-item-active' : ''}`}
            title={collapsed ? item.label : ''}
            onClick={() => navigate(item.path)}
          >
            <span className="sidebar-item-icon">{item.icon}</span>
            {!collapsed && <span className="sidebar-item-label">{item.label}</span>}
          </div>
        ))}
      </nav>
    </aside>
  );
}

export default Sidebar;
