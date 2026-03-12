import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getUsersApi, createTaskApi } from '../api/auth';
import type { UserRecord } from '../api/auth';
import { useAuth } from '../context/AuthContext';

function CreateTaskPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<'low' | 'medium' | 'urgent'>('medium');
  const [dueDate, setDueDate] = useState('');
  const [dueTime, setDueTime] = useState('');
  const [assignedToId, setAssignedToId] = useState('');
  const [reviewerId, setReviewerId] = useState('');

  useEffect(() => {
    getUsersApi()
      .then((data) => setUsers(data))
      .catch(() => setError('Failed to load users'))
      .finally(() => setLoading(false));
  }, []);

  const reviewers = users.filter((u) => u.role === 'admin' || u.role === 'reviewer');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!title || !description || !dueDate || !assignedToId || !reviewerId) {
      setError('All fields are required');
      return;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const selected = new Date(dueDate);
    selected.setHours(0, 0, 0, 0);
    if (selected < today) {
      setError('Due date cannot be in the past');
      return;
    }

    const dueDatetime = dueTime
      ? new Date(`${dueDate}T${dueTime}`).toISOString()
      : new Date(`${dueDate}T23:59:59`).toISOString();

    setSubmitting(true);
    try {
      await createTaskApi({
        title,
        description,
        priority,
        dueDate: dueDatetime,
        assignedToId,
        reviewerId,
      });
      navigate('/tasks');
    } catch (err: any) {
      const msg = err?.response?.data?.message;
      setError(Array.isArray(msg) ? msg.join(', ') : msg || 'Failed to create task');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <>
        <h1 className="ct-title">Create Task</h1>
        <div className="ct-divider" />
        <p className="ct-loading">Loading...</p>
      </>
    );
  }

  return (
    <form className="ct-form" onSubmit={handleSubmit}>
      <h1 className="ct-title">Create Task</h1>
      <div className="ct-divider" />

      {/* ── Section 1: Core Details ── */}
      <div className="ct-section">
        <div className="ct-field">
          <label className="ct-label" htmlFor="ct-title">Title</label>
          <input
            id="ct-title"
            className="ct-input"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="What needs to be done?"
          />
        </div>

        <div className="ct-field">
          <label className="ct-label" htmlFor="ct-desc">Description</label>
          <textarea
            id="ct-desc"
            className="ct-textarea"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Add details, requirements, or context for this task..."
            rows={5}
          />
          <span className="ct-helper">Provide enough context for the assignee to understand the task.</span>
        </div>
      </div>

      <div className="ct-section-divider" />

      {/* ── Section 2: Priority & Schedule ── */}
      <div className="ct-section">
        <div className="ct-field">
          <label className="ct-label">Priority</label>
          <div className="ct-pills">
            {(['low', 'medium', 'urgent'] as const).map((p) => (
              <button
                key={p}
                type="button"
                className={`ct-pill ct-pill-${p} ${priority === p ? 'ct-pill-active' : ''}`}
                onClick={() => setPriority(p)}
              >
                {p.charAt(0).toUpperCase() + p.slice(1)}
              </button>
            ))}
          </div>
        </div>

        <div className="ct-field">
          <label className="ct-label">Due Date</label>
          <div className="ct-date-row">
            <div className="ct-date-field">
              <input
                className="ct-input"
                type="date"
                value={dueDate}
                min={new Date().toISOString().split('T')[0]}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
            <div className="ct-date-field">
              <input
                className="ct-input"
                type="time"
                value={dueTime}
                onChange={(e) => setDueTime(e.target.value)}
                placeholder="Optional"
              />
            </div>
          </div>
          <span className="ct-helper">Time is optional — defaults to end of day.</span>
        </div>
      </div>

      <div className="ct-section-divider" />

      {/* ── Section 3: Assignment ── */}
      <div className="ct-section">
        <div className="ct-field">
          <label className="ct-label" htmlFor="ct-assign">Assign To</label>
          <select
            id="ct-assign"
            className="ct-select"
            value={assignedToId}
            onChange={(e) => setAssignedToId(e.target.value)}
          >
            <option value="">Choose a team member...</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.firstName} {u.lastName} — @{u.username}
              </option>
            ))}
          </select>
          <span className="ct-helper">The user responsible for completing this task.</span>
        </div>

        <div className="ct-field">
          <label className="ct-label" htmlFor="ct-reviewer">Reviewer</label>
          <select
            id="ct-reviewer"
            className="ct-select"
            value={reviewerId}
            onChange={(e) => setReviewerId(e.target.value)}
          >
            <option value="">Choose a reviewer...</option>
            {reviewers.map((u) => (
              <option key={u.id} value={u.id}>
                {u.firstName} {u.lastName} — {u.role}
              </option>
            ))}
          </select>
          <span className="ct-helper">An admin or reviewer who will oversee progress.</span>
        </div>
      </div>

      {/* ── Error ── */}
      {error && (
        <>
          <div className="ct-section-divider" />
          <div className="ct-section">
            <p className="ct-error">{error}</p>
          </div>
        </>
      )}

      {/* ── Footer ── */}
      <div className="ct-footer">
        <button
          type="button"
          className="ct-btn-cancel"
          onClick={() => navigate('/tasks')}
        >
          Cancel
        </button>
        <button
          type="submit"
          className="ct-btn-submit"
          disabled={submitting}
        >
          {submitting ? 'Creating...' : 'Create Task'}
        </button>
      </div>
    </form>
  );
}

export default CreateTaskPage;
