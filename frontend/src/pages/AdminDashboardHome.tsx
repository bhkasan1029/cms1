import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FiCheckSquare,
  FiCalendar,
  FiAlertCircle,
  FiTrendingUp,
  FiUsers,
  FiClock,
  FiPlus,
  FiUserPlus,
  FiBarChart2,
  FiFileText,
  FiActivity,
  FiPieChart,
} from 'react-icons/fi';
import { getTasksApi, getUsersApi } from '../api/auth';
import type { TaskRecord, UserRecord } from '../api/auth';

type TabKey = 'all' | 'in_progress' | 'pending' | 'completed';

function AdminDashboardHome() {
  const navigate = useNavigate();
  const [tasks, setTasks] = useState<TaskRecord[]>([]);
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabKey>('all');

  useEffect(() => {
    Promise.all([getTasksApi(), getUsersApi()])
      .then(([t, u]) => {
        setTasks(t);
        setUsers(u);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // ── Derived metrics ──
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);
  const weekAgo = new Date(now.getTime() - 7 * 86400000);

  const totalTasks = tasks.length;
  const tasksDueToday = tasks.filter(
    (t) => t.dueDate?.slice(0, 10) === todayStr && !t.finished,
  ).length;
  const overdueTasks = tasks.filter(
    (t) => !t.finished && new Date(t.dueDate) < now,
  ).length;
  const completedThisWeek = tasks.filter(
    (t) => t.finished && new Date(t.updatedAt) >= weekAgo,
  ).length;
  const activeUsers = users.filter((u) => !u.isBlocked && !u.deletedAt).length;

  // ── Filtered task list ──
  const filteredTasks = useMemo(() => {
    if (activeTab === 'all') return tasks;
    if (activeTab === 'completed') return tasks.filter((t) => t.finished);
    if (activeTab === 'in_progress')
      return tasks.filter((t) => t.status === 'in_progress' && !t.finished);
    // pending = frozen or not started
    return tasks.filter((t) => t.status === 'frozen' && !t.finished);
  }, [tasks, activeTab]);

  // ── Upcoming deadlines (next 7 days, not finished) ──
  const upcomingDeadlines = useMemo(() => {
    const weekFromNow = new Date(now.getTime() + 7 * 86400000);
    return tasks
      .filter(
        (t) =>
          !t.finished && new Date(t.dueDate) >= now && new Date(t.dueDate) <= weekFromNow,
      )
      .sort(
        (a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime(),
      )
      .slice(0, 5);
  }, [tasks]);

  // ── Productivity chart data (last 7 days) ──
  const chartData = useMemo(() => {
    const days: { label: string; created: number; completed: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 86400000);
      const ds = d.toISOString().slice(0, 10);
      const dayLabel = d.toLocaleDateString('en', { weekday: 'short' });
      days.push({
        label: dayLabel,
        created: tasks.filter((t) => t.createdAt?.slice(0, 10) === ds).length,
        completed: tasks.filter(
          (t) => t.finished && t.updatedAt?.slice(0, 10) === ds,
        ).length,
      });
    }
    return days;
  }, [tasks]);

  const chartMax = Math.max(
    1,
    ...chartData.map((d) => Math.max(d.created, d.completed)),
  );

  // ── Activity feed (recent task updates) ──
  const recentActivity = useMemo(() => {
    const activities: { text: string; time: string; type: string }[] = [];

    const sorted = [...tasks].sort(
      (a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    );

    sorted.slice(0, 8).forEach((t) => {
      const assigneeName = t.assignedTo
        ? `${t.assignedTo.firstName} ${t.assignedTo.lastName}`
        : 'Unknown';
      if (t.finished) {
        activities.push({
          text: `"${t.title}" marked completed by ${assigneeName}`,
          time: t.updatedAt,
          type: 'completed',
        });
      } else if (t.status === 'in_progress') {
        activities.push({
          text: `"${t.title}" assigned to ${assigneeName}`,
          time: t.updatedAt,
          type: 'assigned',
        });
      } else {
        activities.push({
          text: `"${t.title}" status changed to ${t.status}`,
          time: t.updatedAt,
          type: 'status',
        });
      }
    });

    return activities;
  }, [tasks]);

  // ── User snapshot ──
  const userSnapshot = useMemo(() => {
    return users.slice(0, 6).map((u) => ({
      id: u.id,
      name: `${u.firstName} ${u.lastName}`,
      role: u.role,
      taskCount: tasks.filter((t) => t.assignedToId === u.id && !t.finished)
        .length,
      online: !u.isBlocked && !u.deletedAt,
    }));
  }, [users, tasks]);

  // ── Report preview metrics ──
  const completionRate =
    totalTasks > 0
      ? Math.round((tasks.filter((t) => t.finished).length / totalTasks) * 100)
      : 0;
  const priorityBreakdown = {
    low: tasks.filter((t) => t.priority === 'low').length,
    medium: tasks.filter((t) => t.priority === 'medium').length,
    urgent: tasks.filter((t) => t.priority === 'urgent').length,
  };

  // ── Helpers ──
  function timeAgo(dateStr: string) {
    const diff = now.getTime() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return `${days}d ago`;
  }

  function countdown(dateStr: string) {
    const diff = new Date(dateStr).getTime() - now.getTime();
    if (diff < 0) return 'Overdue';
    const hrs = Math.floor(diff / 3600000);
    if (hrs < 24) return `Due in ${hrs}h`;
    const days = Math.floor(hrs / 24);
    return `Due in ${days}d`;
  }

  function getInitials(first: string, last: string) {
    return `${first?.[0] || ''}${last?.[0] || ''}`.toUpperCase();
  }

  const priorityLabel = (p: string) =>
    p === 'urgent' ? 'Urgent' : p === 'medium' ? 'Medium' : 'Low';

  const statusLabel = (t: TaskRecord) =>
    t.finished
      ? 'Completed'
      : t.status === 'in_progress'
        ? 'In Progress'
        : t.status === 'frozen'
          ? 'Frozen'
          : t.status;

  if (loading) {
    return (
      <div className="db-home">
        <div className="db-hero">
          {[...Array(5)].map((_, i) => (
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
      {/* ── Hero Metrics ── */}
      <div className="db-hero">
        <div className="db-hero-card db-hero-tint-blue">
          <div className="db-hero-icon db-icon-blue">
            <FiCheckSquare />
          </div>
          <div className="db-hero-info">
            <span className="db-hero-number">{totalTasks}</span>
            <span className="db-hero-label">Total Tasks</span>
          </div>
          <span className="db-hero-trend db-trend-up">
            <FiTrendingUp size={12} /> Active
          </span>
        </div>

        <div className="db-hero-card db-hero-tint-amber">
          <div className="db-hero-icon db-icon-amber">
            <FiCalendar />
          </div>
          <div className="db-hero-info">
            <span className="db-hero-number">{tasksDueToday}</span>
            <span className="db-hero-label">Due Today</span>
          </div>
          <span className="db-hero-trend db-trend-neutral">Today</span>
        </div>

        <div className="db-hero-card db-hero-tint-red">
          <div className="db-hero-icon db-icon-red">
            <FiAlertCircle />
          </div>
          <div className="db-hero-info">
            <span className="db-hero-number">{overdueTasks}</span>
            <span className="db-hero-label">Overdue</span>
          </div>
          {overdueTasks > 0 && (
            <span className="db-hero-trend db-trend-down">Attention</span>
          )}
        </div>

        <div className="db-hero-card db-hero-tint-green">
          <div className="db-hero-icon db-icon-green">
            <FiTrendingUp />
          </div>
          <div className="db-hero-info">
            <span className="db-hero-number">{completedThisWeek}</span>
            <span className="db-hero-label">Completed This Week</span>
          </div>
          <span className="db-hero-trend db-trend-up">
            <FiTrendingUp size={12} /> +{completedThisWeek}
          </span>
        </div>

        <div className="db-hero-card db-hero-tint-purple">
          <div className="db-hero-icon db-icon-purple">
            <FiUsers />
          </div>
          <div className="db-hero-info">
            <span className="db-hero-number">{activeUsers}</span>
            <span className="db-hero-label">Active Users</span>
          </div>
          <span className="db-hero-trend db-trend-up">
            <FiTrendingUp size={12} /> Online
          </span>
        </div>
      </div>

      {/* ── Main Content Grid ── */}
      <div className="db-main-grid">
        {/* Left Column (8 cols) */}
        <div className="db-left-col">
          {/* Task Overview Panel */}
          <div className="db-panel">
            <div className="db-panel-header">
              <h3 className="db-panel-title">
                <FiFileText className="db-panel-title-icon" /> Task Overview
              </h3>
            </div>
            <div className="db-tabs">
              {(
                [
                  ['all', 'All'],
                  ['in_progress', 'In Progress'],
                  ['pending', 'Pending'],
                  ['completed', 'Completed'],
                ] as [TabKey, string][]
              ).map(([key, label]) => (
                <button
                  key={key}
                  className={`db-tab ${activeTab === key ? 'db-tab-active' : ''}`}
                  onClick={() => setActiveTab(key)}
                >
                  {label}
                  <span className="db-tab-count">
                    {key === 'all'
                      ? tasks.length
                      : key === 'completed'
                        ? tasks.filter((t) => t.finished).length
                        : key === 'in_progress'
                          ? tasks.filter(
                              (t) =>
                                t.status === 'in_progress' && !t.finished,
                            ).length
                          : tasks.filter(
                              (t) => t.status === 'frozen' && !t.finished,
                            ).length}
                  </span>
                </button>
              ))}
            </div>
            <div className="db-task-list">
              {filteredTasks.length === 0 ? (
                <div className="db-task-empty">No tasks found</div>
              ) : (
                filteredTasks.slice(0, 8).map((t) => (
                  <div
                    key={t.id}
                    className="db-task-row"
                    onClick={() => navigate(`/tasks/${t.id}`)}
                  >
                    <div className="db-task-row-left">
                      <span className="db-task-row-title">{t.title}</span>
                      <span
                        className={`db-task-row-priority db-priority-${t.priority}`}
                      >
                        {priorityLabel(t.priority)}
                      </span>
                    </div>
                    <div className="db-task-row-right">
                      <span className="db-task-row-due">
                        <FiClock size={12} />
                        {new Date(t.dueDate).toLocaleDateString('en', {
                          month: 'short',
                          day: 'numeric',
                        })}
                      </span>
                      {t.assignedTo && (
                        <div className="db-task-row-avatar" title={`${t.assignedTo.firstName} ${t.assignedTo.lastName}`}>
                          {getInitials(
                            t.assignedTo.firstName,
                            t.assignedTo.lastName,
                          )}
                        </div>
                      )}
                      <span
                        className={`db-task-row-status ${
                          t.finished
                            ? 'db-status-completed'
                            : t.status === 'in_progress'
                              ? 'db-status-progress'
                              : 'db-status-frozen'
                        }`}
                      >
                        {statusLabel(t)}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Productivity & Task Flow */}
          <div className="db-panel">
            <div className="db-panel-header">
              <h3 className="db-panel-title">
                <FiBarChart2 className="db-panel-title-icon" /> Productivity &
                Task Flow
              </h3>
              <span className="db-chart-range">Last 7 days</span>
            </div>
            <div className="db-chart">
              <div className="db-chart-legend">
                <span className="db-legend-item">
                  <span className="db-legend-dot db-legend-created" /> Created
                </span>
                <span className="db-legend-item">
                  <span className="db-legend-dot db-legend-completed" />{' '}
                  Completed
                </span>
              </div>
              <div className="db-chart-bars">
                {chartData.map((d, i) => (
                  <div key={i} className="db-chart-col">
                    <div className="db-chart-bar-group">
                      <div
                        className="db-chart-bar db-bar-created"
                        style={{
                          height: `${(d.created / chartMax) * 100}%`,
                        }}
                        title={`Created: ${d.created}`}
                      />
                      <div
                        className="db-chart-bar db-bar-completed"
                        style={{
                          height: `${(d.completed / chartMax) * 100}%`,
                        }}
                        title={`Completed: ${d.completed}`}
                      />
                    </div>
                    <span className="db-chart-label">{d.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Right Column (4 cols) */}
        <div className="db-right-col">
          {/* Quick Actions */}
          <div className="db-panel">
            <h3 className="db-panel-title">Quick Actions</h3>
            <div className="db-quick-actions">
              <button
                className="db-qa-btn db-qa-primary"
                onClick={() => navigate('/create-task')}
              >
                <FiPlus /> Create New Task
              </button>
              <button
                className="db-qa-btn db-qa-secondary"
                onClick={() => navigate('/tasks')}
              >
                <FiUserPlus /> Assign Task
              </button>
              <button
                className="db-qa-btn db-qa-secondary"
                onClick={() => navigate('/report')}
              >
                <FiBarChart2 /> View Reports
              </button>
            </div>
          </div>

          {/* Upcoming Deadlines */}
          <div className="db-panel">
            <h3 className="db-panel-title">
              <FiClock className="db-panel-title-icon" /> Upcoming Deadlines
            </h3>
            <div className="db-deadlines">
              {upcomingDeadlines.length === 0 ? (
                <div className="db-task-empty">No upcoming deadlines</div>
              ) : (
                upcomingDeadlines.map((t) => (
                  <div
                    key={t.id}
                    className="db-deadline-item"
                    onClick={() => navigate(`/tasks/${t.id}`)}
                  >
                    <div
                      className={`db-deadline-strip db-priority-strip-${t.priority}`}
                    />
                    <div className="db-deadline-info">
                      <span className="db-deadline-name">{t.title}</span>
                      <span className="db-deadline-time">
                        {countdown(t.dueDate)}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Secondary Section ── */}
      <div className="db-secondary-grid">
        {/* Activity Feed */}
        <div className="db-panel db-activity-panel">
          <h3 className="db-panel-title">
            <FiActivity className="db-panel-title-icon" /> Recent Activity
          </h3>
          <div className="db-activity-feed">
            {recentActivity.length === 0 ? (
              <div className="db-task-empty">No recent activity</div>
            ) : (
              recentActivity.map((a, i) => (
                <div key={i} className="db-activity-item">
                  <div
                    className={`db-activity-dot ${
                      a.type === 'completed'
                        ? 'db-dot-green'
                        : a.type === 'assigned'
                          ? 'db-dot-blue'
                          : 'db-dot-amber'
                    }`}
                  />
                  <div className="db-activity-content">
                    <span className="db-activity-text">{a.text}</span>
                    <span className="db-activity-time">{timeAgo(a.time)}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* User Snapshot */}
        <div className="db-panel">
          <h3 className="db-panel-title">
            <FiUsers className="db-panel-title-icon" /> Team Overview
          </h3>
          <div className="db-user-snapshot">
            {userSnapshot.map((u) => (
              <div
                key={u.id}
                className="db-user-snap-row"
                onClick={() => navigate(`/profile/${u.id}`)}
              >
                <div className="db-user-snap-left">
                  <div className="db-user-snap-avatar">
                    {u.name
                      .split(' ')
                      .map((n) => n[0])
                      .join('')
                      .toUpperCase()}
                  </div>
                  <div className="db-user-snap-info">
                    <span className="db-user-snap-name">{u.name}</span>
                    <span className="db-user-snap-role">{u.role}</span>
                  </div>
                </div>
                <div className="db-user-snap-right">
                  <span className="db-user-snap-tasks">
                    {u.taskCount} tasks
                  </span>
                  <span
                    className={`db-user-snap-status ${u.online ? 'db-snap-online' : 'db-snap-offline'}`}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Reports Preview */}
        <div className="db-panel">
          <h3 className="db-panel-title">
            <FiPieChart className="db-panel-title-icon" /> Reports Preview
          </h3>
          <div className="db-report-cards">
            <div
              className="db-report-card"
              onClick={() => navigate('/report')}
            >
              <div className="db-report-icon db-icon-green">
                <FiTrendingUp />
              </div>
              <span className="db-report-value">{completionRate}%</span>
              <span className="db-report-label">Completion Rate</span>
            </div>
            <div
              className="db-report-card"
              onClick={() => navigate('/report')}
            >
              <div className="db-report-icon db-icon-blue">
                <FiUsers />
              </div>
              <span className="db-report-value">{activeUsers}</span>
              <span className="db-report-label">Workload Distribution</span>
            </div>
            <div
              className="db-report-card"
              onClick={() => navigate('/report')}
            >
              <div className="db-report-icon db-icon-amber">
                <FiPieChart />
              </div>
              <div className="db-report-priority-bar">
                <div
                  className="db-rpb-segment db-rpb-low"
                  style={{
                    flex: priorityBreakdown.low || 0.1,
                  }}
                  title={`Low: ${priorityBreakdown.low}`}
                />
                <div
                  className="db-rpb-segment db-rpb-medium"
                  style={{
                    flex: priorityBreakdown.medium || 0.1,
                  }}
                  title={`Medium: ${priorityBreakdown.medium}`}
                />
                <div
                  className="db-rpb-segment db-rpb-urgent"
                  style={{
                    flex: priorityBreakdown.urgent || 0.1,
                  }}
                  title={`Urgent: ${priorityBreakdown.urgent}`}
                />
              </div>
              <span className="db-report-label">Priority Breakdown</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AdminDashboardHome;
