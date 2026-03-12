import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FiX,
  FiActivity,
  FiMonitor,
  FiCheckCircle,
  FiMessageSquare,
  FiShield,
  FiAlertTriangle,
  FiUserX,
  FiUserCheck,
  FiTrash2,
  FiRotateCcw,
  FiStar,
} from 'react-icons/fi';
import { useNotifications } from '../context/NotificationContext';
import type { NotificationRecord } from '../api/notifications';

interface NotificationPanelProps {
  open: boolean;
  onClose: () => void;
}

type Tab = 'activity' | 'system';

const ICON_MAP: Record<string, { icon: React.ReactNode; className: string }> = {
  TASK_ASSIGNED: { icon: <FiStar size={16} />, className: 'notif-icon-blue' },
  TASK_REVIEW_REQUEST: { icon: <FiMessageSquare size={16} />, className: 'notif-icon-purple' },
  TASK_COMPLETED: { icon: <FiCheckCircle size={16} />, className: 'notif-icon-green' },
  TASK_FROZEN: { icon: <FiAlertTriangle size={16} />, className: 'notif-icon-amber' },
  TASK_UNFROZEN: { icon: <FiRotateCcw size={16} />, className: 'notif-icon-blue' },
  ROLE_CHANGED: { icon: <FiShield size={16} />, className: 'notif-icon-green' },
  ACCOUNT_BLOCKED: { icon: <FiUserX size={16} />, className: 'notif-icon-red' },
  ACCOUNT_UNBLOCKED: { icon: <FiUserCheck size={16} />, className: 'notif-icon-green' },
  DELETION_SCHEDULED: { icon: <FiTrash2 size={16} />, className: 'notif-icon-red' },
  ACCOUNT_RESTORED: { icon: <FiRotateCcw size={16} />, className: 'notif-icon-green' },
};

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const seconds = Math.floor((now - then) / 1000);

  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days > 1 ? 's' : ''} ago`;
}

function NotificationPanel({ open, onClose }: NotificationPanelProps) {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<Tab>('activity');
  const {
    notifications,
    isLoading,
    markAsRead,
    markAllAsRead,
    fetchNotifications,
  } = useNotifications();

  useEffect(() => {
    if (open) {
      fetchNotifications();
    }
  }, [open, fetchNotifications]);

  const filtered = notifications.filter((n) => n.category === activeTab);

  const handleItemClick = (n: NotificationRecord) => {
    if (!n.isRead) {
      markAsRead(n.id);
    }
    if (n.taskId) {
      onClose();
      navigate(`/tasks/${n.taskId}`);
    }
  };

  return (
    <>
      {open && <div className="notif-overlay" onClick={onClose} />}
      <div className={`notif-panel ${open ? 'notif-panel-open' : ''}`}>
        <div className="notif-header">
          <h3>Notifications</h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <button className="notif-mark-all-btn" onClick={markAllAsRead}>
              Mark all read
            </button>
            <button className="notif-close" onClick={onClose} title="Close">
              <FiX />
            </button>
          </div>
        </div>

        <div className="notif-tabs">
          <button
            className={`notif-tab ${activeTab === 'activity' ? 'notif-tab-active' : ''}`}
            onClick={() => setActiveTab('activity')}
          >
            <FiActivity size={14} />
            Activity
          </button>
          <button
            className={`notif-tab ${activeTab === 'system' ? 'notif-tab-active' : ''}`}
            onClick={() => setActiveTab('system')}
          >
            <FiMonitor size={14} />
            System
          </button>
        </div>

        <div className="notif-body">
          {isLoading ? (
            <div className="notif-empty">Loading...</div>
          ) : filtered.length === 0 ? (
            <div className="notif-empty">
              No {activeTab} notifications
            </div>
          ) : (
            <div className="notif-list">
              {filtered.map((n) => {
                const iconInfo = ICON_MAP[n.type] || {
                  icon: <FiActivity size={16} />,
                  className: 'notif-icon-blue',
                };
                return (
                  <div
                    key={n.id}
                    className={`notif-item ${!n.isRead ? 'notif-item-unread' : ''}`}
                    onClick={() => handleItemClick(n)}
                    style={{ cursor: n.taskId ? 'pointer' : 'default' }}
                  >
                    <div className={`notif-item-icon ${iconInfo.className}`}>
                      {iconInfo.icon}
                    </div>
                    <div className="notif-item-content">
                      <p className="notif-item-text">{n.message}</p>
                      <span className="notif-item-time">{timeAgo(n.createdAt)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

export default NotificationPanel;
