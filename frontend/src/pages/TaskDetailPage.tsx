import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getTaskApi, updateTaskStatusApi, unfreezeTaskApi, deleteTaskApi } from '../api/auth';
import type { TaskRecord } from '../api/auth';
import { useAuth } from '../context/AuthContext';

function TaskDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [task, setTask] = useState<TaskRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;
    getTaskApi(id)
      .then((data) => setTask(data))
      .catch(() => setError('Task not found'))
      .finally(() => setLoading(false));
  }, [id]);

  const handleComplete = async () => {
    if (!task) return;
    setActionLoading(true);
    setError('');
    try {
      const updated = await updateTaskStatusApi(task.id, 'completed');
      setTask(updated);
    } catch (err: any) {
      const msg = err?.response?.data?.message;
      setError(typeof msg === 'string' ? msg : 'Failed to update status');
    } finally {
      setActionLoading(false);
    }
  };

  const handleUnfreeze = async () => {
    if (!task) return;
    setActionLoading(true);
    setError('');
    try {
      const updated = await unfreezeTaskApi(task.id);
      setTask(updated);
    } catch (err: any) {
      const msg = err?.response?.data?.message;
      setError(typeof msg === 'string' ? msg : 'Failed to unfreeze task');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!task) return;
    if (!window.confirm('Are you sure you want to delete this task?')) return;
    setActionLoading(true);
    setError('');
    try {
      await deleteTaskApi(task.id);
      navigate('/tasks');
    } catch (err: any) {
      const msg = err?.response?.data?.message;
      setError(typeof msg === 'string' ? msg : 'Failed to delete task');
      setActionLoading(false);
    }
  };

  const getStatusClass = (status: string) => {
    switch (status) {
      case 'in_progress': return 'task-badge-progress';
      case 'completed': return 'task-badge-completed';
      case 'frozen': return 'task-badge-frozen';
      default: return '';
    }
  };

  const getPriorityClass = (priority: string) => {
    switch (priority) {
      case 'low': return 'task-badge-low';
      case 'medium': return 'task-badge-medium';
      case 'urgent': return 'task-badge-urgent';
      default: return '';
    }
  };

  const formatStatus = (status: string) => {
    switch (status) {
      case 'in_progress': return 'In Progress';
      case 'completed': return 'Completed';
      case 'frozen': return 'Frozen';
      default: return status;
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <div className="dashboard-panel">
        <p>Loading task...</p>
      </div>
    );
  }

  if (!task) {
    return (
      <div className="dashboard-panel">
        <p className="error">{error || 'Task not found'}</p>
        <button className="task-back-btn" onClick={() => navigate('/tasks')}>
          Back to Tasks
        </button>
      </div>
    );
  }

  const isAssignedUser = user?.userId === task.assignedToId;
  const isCreator = user?.userId === task.assignedById;
  const isAdmin = user?.role === 'admin';

  return (
    <div className="dashboard-panel">
      <button className="task-back-btn" onClick={() => navigate('/tasks')}>
        Back to Tasks
      </button>

      <div className="task-detail-header">
        <h2>{task.title}</h2>
        <div className="task-detail-badges">
          <span className={`task-badge ${getStatusClass(task.status)}`}>
            {formatStatus(task.status)}
          </span>
          <span className={`task-badge ${getPriorityClass(task.priority)}`}>
            {task.priority}
          </span>
        </div>
      </div>

      <div className="task-detail-body">
        <div className="task-detail-section">
          <h3>Description</h3>
          <p className="task-detail-description">{task.description}</p>
        </div>

        <div className="task-detail-info">
          <div className="task-detail-row">
            <span className="task-detail-label">Assigned To</span>
            <span className="task-detail-value">
              {task.assignedTo
                ? `${task.assignedTo.firstName} ${task.assignedTo.lastName}`
                : '—'}
            </span>
          </div>
          <div className="task-detail-row">
            <span className="task-detail-label">Created By</span>
            <span className="task-detail-value">
              {task.assignedBy
                ? `${task.assignedBy.firstName} ${task.assignedBy.lastName}`
                : '—'}
            </span>
          </div>
          <div className="task-detail-row">
            <span className="task-detail-label">Reviewer</span>
            <span className="task-detail-value">
              {task.reviewer
                ? `${task.reviewer.firstName} ${task.reviewer.lastName}`
                : '—'}
            </span>
          </div>
          <div className="task-detail-row">
            <span className="task-detail-label">Due Date</span>
            <span className="task-detail-value">{formatDate(task.dueDate)}</span>
          </div>
          <div className="task-detail-row">
            <span className="task-detail-label">Created</span>
            <span className="task-detail-value">{formatDate(task.createdAt)}</span>
          </div>
          <div className="task-detail-row">
            <span className="task-detail-label">Last Updated</span>
            <span className="task-detail-value">{formatDate(task.updatedAt)}</span>
          </div>
        </div>
      </div>

      {error && <p className="error" style={{ marginTop: '1rem' }}>{error}</p>}

      <div className="task-detail-actions">
        {isAssignedUser && task.status === 'in_progress' && (
          <button
            className="task-action-btn task-btn-complete"
            onClick={handleComplete}
            disabled={actionLoading}
          >
            {actionLoading ? 'Updating...' : 'Mark Completed'}
          </button>
        )}

        {isCreator && task.status === 'frozen' && (
          <button
            className="task-action-btn task-btn-unfreeze"
            onClick={handleUnfreeze}
            disabled={actionLoading}
          >
            {actionLoading ? 'Unfreezing...' : 'Unfreeze Task'}
          </button>
        )}

        {isAdmin && (
          <button
            className="task-action-btn task-btn-delete"
            onClick={handleDelete}
            disabled={actionLoading}
          >
            {actionLoading ? 'Deleting...' : 'Delete Task'}
          </button>
        )}
      </div>
    </div>
  );
}

export default TaskDetailPage;
