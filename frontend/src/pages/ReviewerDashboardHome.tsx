import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FiCheckSquare,
  FiClock,
  FiTrendingUp,
  FiAlertCircle,
  FiFileText,
  FiActivity,
  FiBarChart2,
} from 'react-icons/fi';
import { useAuth } from '../context/AuthContext';
import { getTasksApi } from '../api/auth';
import type { TaskRecord } from '../api/auth';

type TabKey = 'all' | 'in_progress' | 'pending' | 'completed';

function ReviewerDashboardHome() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tasks, setTasks] = useState<TaskRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabKey>('all');

  useEffect(() => {
    getTasksApi()
      .then(setTasks)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const myTasks = useMemo(
    () => tasks.filter((t) => t.reviewerId === user?.userId),
    [tasks, user],
  );

  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 86400000);

  const assignedToMe = myTasks.filter((t) => !t.finished).length;
  const awaitingReview = myTasks.filter(
    (t) => t.status === 'in_progress' && !t.finished,
  ).length;
  const reviewedThisWeek = myTasks.filter(
    (t) => t.finished && new Date(t.updatedAt) >= weekAgo,
  ).length;
  const overdue = myTasks.filter(
    (t) => !t.finished && new Date(t.dueDate) < now,
  ).length;

  const filteredTasks = useMemo(() => {
    if (activeTab === 'all') return myTasks;
    if (activeTab === 'completed') return myTasks.filter((t) => t.finished);
    if (activeTab === 'in_progress')
      return myTasks.filter((t) => t.status === 'in_progress' && !t.finished);
    return myTasks.filter((t) => t.status === 'frozen' && !t.finished);
  }, [myTasks, activeTab]);

  const upcomingDeadlines = useMemo(() => {
    const weekFromNow = new Date(now.getTime() + 7 * 86400000);
    return myTasks
      .filter(
        (t) =>
          !t.finished &&
          new Date(t.dueDate) >= now &&
          new Date(t.dueDate) <= weekFromNow,
      )
      .sort(
        (a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime(),
      )
      .slice(0, 5);
  }, [myTasks]);

  const recentActivity = useMemo(() => {
    return [...myTasks]
      .sort(
        (a, b) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
      )
      .slice(0, 6)
      .map((t) => {
        const name = t.assignedTo
          ? `${t.assignedTo.firstName} ${t.assignedTo.lastName}`
          : 'Unknown';
        return {
          text: t.finished
            ? `"${t.title}" reviewed & completed`
            : `"${t.title}" assigned to ${name}`,
          time: t.updatedAt,
          type: t.finished ? 'completed' : 'assigned',
        };
      });
  }, [myTasks]);

  function timeAgo(dateStr: string) {
    const diff = now.getTime() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  }

  function countdown(dateStr: string) {
    const diff = new Date(dateStr).getTime() - now.getTime();
    if (diff < 0) return 'Overdue';
    const hrs = Math.floor(diff / 3600000);
    if (hrs < 24) return `Due in ${hrs}h`;
    return `Due in ${Math.floor(hrs / 24)}d`;
  }

  const priorityLabel = (p: string) =>
    p === 'urgent' ? 'Urgent' : p === 'medium' ? 'Medium' : 'Low';

  const statusLabel = (t: TaskRecord) =>
    t.finished
      ? 'Completed'
      : t.status === 'in_progress'
        ? 'In Progress'
        : 'Frozen';

  if (loading) {
    return (
      <div className="db-home">
        <div className="db-hero">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="db-hero-card db-hero-skeleton">
              <div className="td-skeleton-line td-skeleton-title" />
              <div className="td-skeleton-line" style={{ width: '40%' }} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="db-home">
      <div className="db-hero" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        <div className="db-hero-card db-hero-tint-blue">
          <div className="db-hero-icon db-icon-blue"><FiCheckSquare /></div>
          <div className="db-hero-info">
            <span className="db-hero-number">{assignedToMe}</span>
            <span className="db-hero-label">Assigned to Me</span>
          </div>
        </div>
        <div className="db-hero-card db-hero-tint-amber">
          <div className="db-hero-icon db-icon-amber"><FiClock /></div>
          <div className="db-hero-info">
            <span className="db-hero-number">{awaitingReview}</span>
            <span className="db-hero-label">Awaiting Review</span>
          </div>
        </div>
        <div className="db-hero-card db-hero-tint-green">
          <div className="db-hero-icon db-icon-green"><FiTrendingUp /></div>
          <div className="db-hero-info">
            <span className="db-hero-number">{reviewedThisWeek}</span>
            <span className="db-hero-label">Reviewed This Week</span>
          </div>
          <span className="db-hero-trend db-trend-up"><FiTrendingUp size={12} /> +{reviewedThisWeek}</span>
        </div>
        <div className="db-hero-card db-hero-tint-red">
          <div className="db-hero-icon db-icon-red"><FiAlertCircle /></div>
          <div className="db-hero-info">
            <span className="db-hero-number">{overdue}</span>
            <span className="db-hero-label">Overdue</span>
          </div>
          {overdue > 0 && <span className="db-hero-trend db-trend-down">Attention</span>}
        </div>
      </div>

      <div className="db-main-grid">
        <div className="db-left-col">
          <div className="db-panel">
            <div className="db-panel-header">
              <h3 className="db-panel-title"><FiFileText className="db-panel-title-icon" /> Review Queue</h3>
            </div>
            <div className="db-tabs">
              {([['all', 'All'], ['in_progress', 'In Progress'], ['pending', 'Pending'], ['completed', 'Completed']] as [TabKey, string][]).map(([key, label]) => (
                <button key={key} className={`db-tab ${activeTab === key ? 'db-tab-active' : ''}`} onClick={() => setActiveTab(key)}>
                  {label}
                </button>
              ))}
            </div>
            <div className="db-task-list">
              {filteredTasks.length === 0 ? (
                <div className="db-task-empty">No tasks found</div>
              ) : filteredTasks.slice(0, 8).map((t) => (
                <div key={t.id} className="db-task-row" onClick={() => navigate(`/tasks/${t.id}`)}>
                  <div className="db-task-row-left">
                    <span className="db-task-row-title">{t.title}</span>
                    <span className={`db-task-row-priority db-priority-${t.priority}`}>{priorityLabel(t.priority)}</span>
                  </div>
                  <div className="db-task-row-right">
                    <span className="db-task-row-due"><FiClock size={12} />{new Date(t.dueDate).toLocaleDateString('en', { month: 'short', day: 'numeric' })}</span>
                    <span className={`db-task-row-status ${t.finished ? 'db-status-completed' : t.status === 'in_progress' ? 'db-status-progress' : 'db-status-frozen'}`}>{statusLabel(t)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="db-right-col">
          <div className="db-panel">
            <h3 className="db-panel-title">Quick Actions</h3>
            <div className="db-quick-actions">
              <button className="db-qa-btn db-qa-primary" onClick={() => navigate('/tasks')}><FiCheckSquare /> Review Tasks</button>
              <button className="db-qa-btn db-qa-secondary" onClick={() => navigate('/report')}><FiBarChart2 /> View Reports</button>
            </div>
          </div>
          <div className="db-panel">
            <h3 className="db-panel-title"><FiClock className="db-panel-title-icon" /> Upcoming Deadlines</h3>
            <div className="db-deadlines">
              {upcomingDeadlines.length === 0 ? (
                <div className="db-task-empty">No upcoming deadlines</div>
              ) : upcomingDeadlines.map((t) => (
                <div key={t.id} className="db-deadline-item" onClick={() => navigate(`/tasks/${t.id}`)}>
                  <div className={`db-deadline-strip db-priority-strip-${t.priority}`} />
                  <div className="db-deadline-info">
                    <span className="db-deadline-name">{t.title}</span>
                    <span className="db-deadline-time">{countdown(t.dueDate)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="db-secondary-grid" style={{ gridTemplateColumns: '1fr' }}>
        <div className="db-panel db-activity-panel">
          <h3 className="db-panel-title"><FiActivity className="db-panel-title-icon" /> Recent Activity</h3>
          <div className="db-activity-feed">
            {recentActivity.length === 0 ? (
              <div className="db-task-empty">No recent activity</div>
            ) : recentActivity.map((a, i) => (
              <div key={i} className="db-activity-item">
                <div className={`db-activity-dot ${a.type === 'completed' ? 'db-dot-green' : 'db-dot-blue'}`} />
                <div className="db-activity-content">
                  <span className="db-activity-text">{a.text}</span>
                  <span className="db-activity-time">{timeAgo(a.time)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default ReviewerDashboardHome;
