import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { getTasksApi, updateTaskStatusApi, deleteTaskApi } from '../api/auth';
import type { TaskRecord } from '../api/auth';
import { useAuth } from '../context/AuthContext';
import {
  FiPlus,
  FiSearch,
  FiCheckCircle,
  FiTrash2,
  FiClock,
  FiAlertCircle,
  FiInbox,
} from 'react-icons/fi';

function TasksPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tasks, setTasks] = useState<TaskRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [sortBy, setSortBy] = useState('newest');
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  useEffect(() => {
    getTasksApi()
      .then((data) => setTasks(data))
      .catch(() => setError('Failed to load tasks. Please try again.'))
      .finally(() => setLoading(false));
  }, []);

  const filteredTasks = useMemo(() => {
    let result = tasks;

    // Search
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          t.description.toLowerCase().includes(q),
      );
    }

    // Status filter
    if (statusFilter !== 'all') {
      result = result.filter((t) => t.status === statusFilter);
    }

    // Priority filter
    if (priorityFilter !== 'all') {
      result = result.filter((t) => t.priority === priorityFilter);
    }

    // Sort
    result = [...result].sort((a, b) => {
      switch (sortBy) {
        case 'due_date':
          return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
        case 'newest':
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        case 'priority': {
          const order = { urgent: 0, medium: 1, low: 2 };
          return order[a.priority] - order[b.priority];
        }
        default:
          return 0;
      }
    });

    return result;
  }, [tasks, search, statusFilter, priorityFilter, sortBy]);

  const handleComplete = async (e: React.MouseEvent, task: TaskRecord) => {
    e.stopPropagation();
    if (actionLoadingId) return;
    setActionLoadingId(task.id);
    try {
      const updated = await updateTaskStatusApi(task.id, 'completed');
      setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
    } catch {
      // silent — user can retry from detail page
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleDelete = async (e: React.MouseEvent, task: TaskRecord) => {
    e.stopPropagation();
    if (actionLoadingId) return;
    if (!window.confirm(`Delete "${task.title}"?`)) return;
    setActionLoadingId(task.id);
    try {
      await deleteTaskApi(task.id);
      setTasks((prev) => prev.filter((t) => t.id !== task.id));
    } catch {
      // silent
    } finally {
      setActionLoadingId(null);
    }
  };

  const isOverdue = (dateStr: string) => new Date(dateStr) < new Date();

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });

  const formatStatus = (status: string) => {
    switch (status) {
      case 'in_progress': return 'In Progress';
      case 'completed': return 'Completed';
      case 'frozen': return 'Frozen';
      default: return status;
    }
  };

  const getStatusClass = (status: string) => {
    switch (status) {
      case 'in_progress': return 'td-badge-progress';
      case 'completed': return 'td-badge-completed';
      case 'frozen': return 'td-badge-frozen';
      default: return '';
    }
  };

  const getPriorityClass = (priority: string) => {
    switch (priority) {
      case 'low': return 'td-priority-low';
      case 'medium': return 'td-priority-medium';
      case 'urgent': return 'td-priority-urgent';
      default: return '';
    }
  };

  const getInitials = (task: TaskRecord) => {
    if (!task.assignedTo) return '?';
    return (
      (task.assignedTo.firstName?.[0] ?? '') +
      (task.assignedTo.lastName?.[0] ?? '')
    ).toUpperCase();
  };

  const canCreate = user?.role === 'admin' || user?.role === 'reviewer';
  const isAdmin = user?.role === 'admin';

  // ── Skeleton loader ──
  if (loading) {
    return (
      <div className="td-page">
        <div className="td-header">
          <h1 className="td-title">My Tasks</h1>
        </div>
        <div className="td-divider" />
        <div className="td-grid">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="td-skeleton-card">
              <div className="td-skeleton-line td-skeleton-title" />
              <div className="td-skeleton-line td-skeleton-desc" />
              <div className="td-skeleton-line td-skeleton-desc-short" />
              <div className="td-skeleton-row">
                <div className="td-skeleton-badge" />
                <div className="td-skeleton-badge" />
              </div>
              <div className="td-skeleton-row">
                <div className="td-skeleton-avatar" />
                <div className="td-skeleton-line td-skeleton-date" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="td-page">
      {/* ── Header ── */}
      <div className="td-header">
        <h1 className="td-title">My Tasks</h1>
        {canCreate && (
          <button
            className="td-add-btn"
            onClick={() => navigate('/create-task')}
          >
            <FiPlus />
            <span>Add New Task</span>
          </button>
        )}
      </div>

      <div className="td-divider" />

      {/* ── Error banner ── */}
      {error && (
        <>
          <div className="td-error">
            <FiAlertCircle />
            <span>{error}</span>
          </div>
          <div className="td-divider" />
        </>
      )}

      {/* ── Utility bar ── */}
      <div className="td-toolbar">
        <div className="td-search-wrap">
          <FiSearch className="td-search-icon" />
          <input
            className="td-search"
            type="text"
            placeholder="Search tasks..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="td-filters">
          <select
            className="td-filter"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">All Statuses</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
            <option value="frozen">Frozen</option>
          </select>
          <select
            className="td-filter"
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
          >
            <option value="all">All Priorities</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="urgent">Urgent</option>
          </select>
          <select
            className="td-filter"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
          >
            <option value="newest">Newest First</option>
            <option value="due_date">Due Date</option>
            <option value="priority">Priority</option>
          </select>
        </div>
      </div>

      <div className="td-divider" />

      {/* ── Task grid ── */}
      {filteredTasks.length === 0 ? (
        <div className="td-empty">
          <FiInbox className="td-empty-icon" />
          <p className="td-empty-title">No tasks found</p>
          <p className="td-empty-sub">
            {tasks.length === 0
              ? 'Tasks assigned to you will appear here.'
              : 'Try adjusting your search or filters.'}
          </p>
        </div>
      ) : (
        <div className="td-grid">
          {filteredTasks.map((task) => (
            <div
              key={task.id}
              className="td-card"
              onClick={() => navigate(`/tasks/${task.id}`)}
            >
              {/* Priority strip */}
              <div className={`td-priority-strip ${getPriorityClass(task.priority)}`} />

              <div className="td-card-body">
                {/* Title + badges row */}
                <div className="td-card-top">
                  <h3 className="td-card-title">{task.title}</h3>
                  <div className="td-card-badges">
                    <span className={`td-badge ${getStatusClass(task.status)}`}>
                      {formatStatus(task.status)}
                    </span>
                  </div>
                </div>

                {/* Description */}
                <p className="td-card-desc">{task.description}</p>

                {/* Meta row */}
                <div className="td-card-meta">
                  <div className="td-card-assignee">
                    <span className="td-avatar">{getInitials(task)}</span>
                    <span className="td-assignee-name">
                      {task.assignedTo
                        ? `${task.assignedTo.firstName} ${task.assignedTo.lastName}`
                        : 'Unassigned'}
                    </span>
                  </div>
                  <div
                    className={`td-card-due ${
                      task.status !== 'completed' && isOverdue(task.dueDate)
                        ? 'td-due-overdue'
                        : ''
                    }`}
                  >
                    <FiClock />
                    <span>{formatDate(task.dueDate)}</span>
                  </div>
                </div>

                {/* Quick actions */}
                <div className="td-card-actions">
                  {user?.userId === task.assignedToId &&
                    task.status === 'in_progress' && (
                      <button
                        className="td-action td-action-complete"
                        onClick={(e) => handleComplete(e, task)}
                        disabled={actionLoadingId === task.id}
                        title="Mark Completed"
                      >
                        <FiCheckCircle />
                        <span>{actionLoadingId === task.id ? 'Updating...' : 'Complete'}</span>
                      </button>
                    )}
                  {isAdmin && (
                    <button
                      className="td-action td-action-delete"
                      onClick={(e) => handleDelete(e, task)}
                      disabled={actionLoadingId === task.id}
                      title="Delete Task"
                    >
                      <FiTrash2 />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default TasksPage;
