import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  FiTrendingUp,
  FiClock,
  FiAlertTriangle,
  FiFlag,
  FiUsers,
  FiDownload,
  FiChevronLeft,
  FiChevronRight,
  FiArrowUp,
  FiArrowDown,
  FiActivity,
  FiPieChart,
  FiBarChart2,
  FiFileText,
  FiCalendar,
} from 'react-icons/fi';
import { getTasksApi, getUsersApi } from '../api/auth';
import type { TaskRecord, UserRecord } from '../api/auth';

type DateRange = 'today' | 'week' | 'month' | 'all';
type SortKey = 'name' | 'role' | 'assigned' | 'completed' | 'rate';
type SortDir = 'asc' | 'desc';
type TableSort = 'title' | 'assignee' | 'priority' | 'status' | 'created' | 'due';

const PAGE_SIZE = 8;

function ReportPage() {
  const [tasks, setTasks] = useState<TaskRecord[]>([]);
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [dateRange, setDateRange] = useState<DateRange>('month');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterPriority, setFilterPriority] = useState('all');
  const [filterUser, setFilterUser] = useState('all');

  // User insights sort
  const [insightSort, setInsightSort] = useState<SortKey>('assigned');
  const [insightDir, setInsightDir] = useState<SortDir>('desc');

  // Detail table sort & pagination
  const [tableSort, setTableSort] = useState<TableSort>('created');
  const [tableDir, setTableDir] = useState<SortDir>('desc');
  const [tablePage, setTablePage] = useState(0);

  useEffect(() => {
    Promise.all([getTasksApi(), getUsersApi()])
      .then(([t, u]) => {
        setTasks(t);
        setUsers(u);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const now = new Date();

  // ── Date-range filter ──
  const rangeStart = useMemo(() => {
    if (dateRange === 'today') {
      const d = new Date(now);
      d.setHours(0, 0, 0, 0);
      return d;
    }
    if (dateRange === 'week') return new Date(now.getTime() - 7 * 86400000);
    if (dateRange === 'month') return new Date(now.getTime() - 30 * 86400000);
    return new Date(0);
  }, [dateRange]);

  // ── Filtered tasks ──
  const filtered = useMemo(() => {
    return tasks.filter((t) => {
      if (new Date(t.createdAt) < rangeStart) return false;
      if (filterStatus !== 'all') {
        if (filterStatus === 'completed' && !t.finished) return false;
        if (filterStatus === 'in_progress' && (t.status !== 'in_progress' || t.finished)) return false;
        if (filterStatus === 'frozen' && t.status !== 'frozen') return false;
        if (filterStatus === 'overdue' && (t.finished || new Date(t.dueDate) >= now)) return false;
      }
      if (filterPriority !== 'all' && t.priority !== filterPriority) return false;
      if (filterUser !== 'all' && t.assignedToId !== filterUser) return false;
      return true;
    });
  }, [tasks, rangeStart, filterStatus, filterPriority, filterUser]);

  // ── Key Metrics ──
  const totalFiltered = filtered.length;
  const completedCount = filtered.filter((t) => t.finished).length;
  const completionRate = totalFiltered > 0 ? Math.round((completedCount / totalFiltered) * 100) : 0;

  const avgCompletionMs = useMemo(() => {
    const done = filtered.filter((t) => t.finished);
    if (done.length === 0) return 0;
    const total = done.reduce((acc, t) => {
      return acc + (new Date(t.updatedAt).getTime() - new Date(t.createdAt).getTime());
    }, 0);
    return total / done.length;
  }, [filtered]);
  const avgCompletionDays = Math.round(avgCompletionMs / 86400000);

  const overdueCount = filtered.filter((t) => !t.finished && new Date(t.dueDate) < now).length;
  const overdueRatio = totalFiltered > 0 ? Math.round((overdueCount / totalFiltered) * 100) : 0;

  const highPriorityCount = filtered.filter((t) => t.priority === 'urgent').length;

  const activeContributors = useMemo(() => {
    const ids = new Set(filtered.map((t) => t.assignedToId));
    return ids.size;
  }, [filtered]);

  // ── Task Performance Trends (last 7/30 days) ──
  const trendDays = dateRange === 'today' ? 1 : dateRange === 'week' ? 7 : 14;
  const trendData = useMemo(() => {
    const days: { label: string; created: number; completed: number }[] = [];
    for (let i = trendDays - 1; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 86400000);
      const ds = d.toISOString().slice(0, 10);
      const label = d.toLocaleDateString('en', { month: 'short', day: 'numeric' });
      days.push({
        label,
        created: tasks.filter((t) => t.createdAt?.slice(0, 10) === ds).length,
        completed: tasks.filter((t) => t.finished && t.updatedAt?.slice(0, 10) === ds).length,
      });
    }
    return days;
  }, [tasks, trendDays]);
  const trendMax = Math.max(1, ...trendData.map((d) => Math.max(d.created, d.completed)));

  // ── Status Distribution ──
  const statusDist = useMemo(() => {
    const inProg = filtered.filter((t) => t.status === 'in_progress' && !t.finished).length;
    const frozen = filtered.filter((t) => t.status === 'frozen' && !t.finished).length;
    const overdue = filtered.filter((t) => !t.finished && new Date(t.dueDate) < now).length;
    const completed = filtered.filter((t) => t.finished).length;
    const pending = Math.max(0, frozen);
    return { inProg, pending, completed, overdue };
  }, [filtered]);

  const statusTotal = statusDist.inProg + statusDist.pending + statusDist.completed + statusDist.overdue || 1;

  // ── Priority Breakdown ──
  const priorityDist = useMemo(() => ({
    low: filtered.filter((t) => t.priority === 'low').length,
    medium: filtered.filter((t) => t.priority === 'medium').length,
    urgent: filtered.filter((t) => t.priority === 'urgent').length,
  }), [filtered]);
  const priorityMax = Math.max(1, priorityDist.low, priorityDist.medium, priorityDist.urgent);

  // ── Risk Indicators ──
  const riskItems = useMemo(() => {
    const risks: { label: string; detail: string; severity: 'high' | 'medium' }[] = [];

    // Overdue tasks
    const overdueTasks = filtered.filter((t) => !t.finished && new Date(t.dueDate) < now);
    if (overdueTasks.length > 0) {
      risks.push({
        label: `${overdueTasks.length} overdue task${overdueTasks.length > 1 ? 's' : ''}`,
        detail: 'Immediate attention required',
        severity: 'high',
      });
    }

    // Bottlenecked users (>3 active tasks)
    const userLoad: Record<string, { name: string; count: number }> = {};
    filtered.filter((t) => !t.finished).forEach((t) => {
      if (!t.assignedTo) return;
      const key = t.assignedToId;
      if (!userLoad[key]) userLoad[key] = { name: `${t.assignedTo.firstName} ${t.assignedTo.lastName}`, count: 0 };
      userLoad[key].count++;
    });
    Object.values(userLoad).filter((u) => u.count > 3).forEach((u) => {
      risks.push({
        label: `${u.name} has ${u.count} active tasks`,
        detail: 'Potential bottleneck',
        severity: 'medium',
      });
    });

    // High priority not started
    const urgentFrozen = filtered.filter((t) => t.priority === 'urgent' && t.status === 'frozen' && !t.finished);
    if (urgentFrozen.length > 0) {
      risks.push({
        label: `${urgentFrozen.length} urgent task${urgentFrozen.length > 1 ? 's' : ''} not started`,
        detail: 'High priority items stalled',
        severity: 'high',
      });
    }

    return risks.slice(0, 5);
  }, [filtered]);

  // ── User Insights ──
  const userInsights = useMemo(() => {
    const activeUsers = users.filter((u) => !u.isBlocked && !u.deletedAt);
    const data = activeUsers.map((u) => {
      const assigned = filtered.filter((t) => t.assignedToId === u.id).length;
      const completed = filtered.filter((t) => t.assignedToId === u.id && t.finished).length;
      const rate = assigned > 0 ? Math.round((completed / assigned) * 100) : 0;
      return {
        id: u.id,
        name: `${u.firstName} ${u.lastName}`,
        role: u.role,
        assigned,
        completed,
        rate,
      };
    });
    data.sort((a, b) => {
      const av = a[insightSort === 'name' ? 'name' : insightSort === 'role' ? 'role' : insightSort];
      const bv = b[insightSort === 'name' ? 'name' : insightSort === 'role' ? 'role' : insightSort];
      if (typeof av === 'string' && typeof bv === 'string') {
        return insightDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
      }
      return insightDir === 'asc' ? (av as number) - (bv as number) : (bv as number) - (av as number);
    });
    return data;
  }, [users, filtered, insightSort, insightDir]);

  // ── Workload distribution ──
  const workloadData = useMemo(() => {
    return userInsights
      .filter((u) => u.assigned > 0)
      .sort((a, b) => b.assigned - a.assigned)
      .slice(0, 8);
  }, [userInsights]);
  const workloadMax = Math.max(1, ...workloadData.map((u) => u.assigned));

  // ── Detail Table ──
  const sortedTableTasks = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a, b) => {
      let av: string | number = '';
      let bv: string | number = '';
      switch (tableSort) {
        case 'title': av = a.title; bv = b.title; break;
        case 'assignee': av = a.assignedTo ? `${a.assignedTo.firstName} ${a.assignedTo.lastName}` : ''; bv = b.assignedTo ? `${b.assignedTo.firstName} ${b.assignedTo.lastName}` : ''; break;
        case 'priority': { const order = { urgent: 3, medium: 2, low: 1 }; av = order[a.priority]; bv = order[b.priority]; break; }
        case 'status': av = a.finished ? 'completed' : a.status; bv = b.finished ? 'completed' : b.status; break;
        case 'created': av = new Date(a.createdAt).getTime(); bv = new Date(b.createdAt).getTime(); break;
        case 'due': av = new Date(a.dueDate).getTime(); bv = new Date(b.dueDate).getTime(); break;
      }
      if (typeof av === 'string' && typeof bv === 'string') return tableDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
      return tableDir === 'asc' ? (av as number) - (bv as number) : (bv as number) - (av as number);
    });
    return arr;
  }, [filtered, tableSort, tableDir]);

  const totalPages = Math.max(1, Math.ceil(sortedTableTasks.length / PAGE_SIZE));
  const pagedTasks = sortedTableTasks.slice(tablePage * PAGE_SIZE, (tablePage + 1) * PAGE_SIZE);

  const toggleInsightSort = useCallback((key: SortKey) => {
    if (insightSort === key) setInsightDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setInsightSort(key); setInsightDir('desc'); }
  }, [insightSort]);

  const toggleTableSort = useCallback((key: TableSort) => {
    if (tableSort === key) setTableDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setTableSort(key); setTableDir('desc'); }
    setTablePage(0);
  }, [tableSort]);

  const handleExport = useCallback(() => {
    const headers = ['Title', 'Assigned To', 'Priority', 'Status', 'Created', 'Due Date'];
    const rows = sortedTableTasks.map((t) => [
      t.title,
      t.assignedTo ? `${t.assignedTo.firstName} ${t.assignedTo.lastName}` : '',
      t.priority,
      t.finished ? 'completed' : t.status,
      new Date(t.createdAt).toLocaleDateString(),
      new Date(t.dueDate).toLocaleDateString(),
    ]);
    const csv = [headers, ...rows].map((r) => r.map((c) => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `report-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [sortedTableTasks]);

  function getInitials(first: string, last: string) {
    return `${first?.[0] || ''}${last?.[0] || ''}`.toUpperCase();
  }

  const SortIcon = ({ active, dir }: { active: boolean; dir: SortDir }) =>
    active ? (dir === 'asc' ? <FiArrowUp size={11} /> : <FiArrowDown size={11} />) : null;

  if (loading) {
    return (
      <div className="rp-page">
        <div className="rp-title-section">
          <h2 className="rp-title">Reports & Analytics</h2>
          <p className="rp-subtitle">Loading data...</p>
        </div>
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
    <div className="rp-page">
      {/* ── Title ── */}
      <div className="rp-title-section">
        <h2 className="rp-title">Reports & Analytics</h2>
        <p className="rp-subtitle">Insights into task performance, team workload, and productivity.</p>
      </div>

      {/* ── Filter Bar ── */}
      <div className="rp-filter-bar">
        <div className="rp-filter-group">
          {(['today', 'week', 'month', 'all'] as DateRange[]).map((r) => (
            <button
              key={r}
              className={`rp-range-btn ${dateRange === r ? 'rp-range-active' : ''}`}
              onClick={() => { setDateRange(r); setTablePage(0); }}
            >
              {r === 'all' ? 'All Time' : r.charAt(0).toUpperCase() + r.slice(1)}
            </button>
          ))}
        </div>
        <div className="rp-filter-group">
          <select className="rp-filter-select" value={filterStatus} onChange={(e) => { setFilterStatus(e.target.value); setTablePage(0); }}>
            <option value="all">All Status</option>
            <option value="in_progress">In Progress</option>
            <option value="frozen">Pending</option>
            <option value="completed">Completed</option>
            <option value="overdue">Overdue</option>
          </select>
          <select className="rp-filter-select" value={filterPriority} onChange={(e) => { setFilterPriority(e.target.value); setTablePage(0); }}>
            <option value="all">All Priority</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="urgent">Urgent</option>
          </select>
          <select className="rp-filter-select" value={filterUser} onChange={(e) => { setFilterUser(e.target.value); setTablePage(0); }}>
            <option value="all">All Users</option>
            {users.filter((u) => !u.deletedAt).map((u) => (
              <option key={u.id} value={u.id}>{u.firstName} {u.lastName}</option>
            ))}
          </select>
        </div>
        <button className="rp-export-btn" onClick={handleExport}>
          <FiDownload size={14} /> Export CSV
        </button>
      </div>

      {/* ── Key Metrics ── */}
      <div className="db-hero">
        <div className="db-hero-card db-hero-tint-green">
          <div className="db-hero-icon db-icon-green"><FiTrendingUp /></div>
          <div className="db-hero-info">
            <span className="db-hero-number">{completionRate}%</span>
            <span className="db-hero-label">Completion Rate</span>
          </div>
          <span className="rp-micro">{completedCount} of {totalFiltered} tasks</span>
        </div>
        <div className="db-hero-card db-hero-tint-blue">
          <div className="db-hero-icon db-icon-blue"><FiClock /></div>
          <div className="db-hero-info">
            <span className="db-hero-number">{avgCompletionDays}d</span>
            <span className="db-hero-label">Avg Completion Time</span>
          </div>
          <span className="rp-micro">Per task average</span>
        </div>
        <div className="db-hero-card db-hero-tint-red">
          <div className="db-hero-icon db-icon-red"><FiAlertTriangle /></div>
          <div className="db-hero-info">
            <span className="db-hero-number">{overdueRatio}%</span>
            <span className="db-hero-label">Overdue Ratio</span>
          </div>
          <span className="rp-micro">{overdueCount} task{overdueCount !== 1 ? 's' : ''} overdue</span>
        </div>
        <div className="db-hero-card db-hero-tint-amber">
          <div className="db-hero-icon db-icon-amber"><FiFlag /></div>
          <div className="db-hero-info">
            <span className="db-hero-number">{highPriorityCount}</span>
            <span className="db-hero-label">High Priority</span>
          </div>
          <span className="rp-micro">Urgent tasks</span>
        </div>
        <div className="db-hero-card db-hero-tint-purple">
          <div className="db-hero-icon db-icon-purple"><FiUsers /></div>
          <div className="db-hero-info">
            <span className="db-hero-number">{activeContributors}</span>
            <span className="db-hero-label">Active Contributors</span>
          </div>
          <span className="rp-micro">With assigned tasks</span>
        </div>
      </div>

      {/* ── Primary Analytics ── */}
      <div className="db-main-grid">
        <div className="db-left-col">
          {/* Task Performance Trends */}
          <div className="db-panel">
            <div className="db-panel-header">
              <h3 className="db-panel-title"><FiActivity className="db-panel-title-icon" /> Task Performance Trends</h3>
              <span className="db-chart-range">Last {trendDays} day{trendDays > 1 ? 's' : ''}</span>
            </div>
            <div className="db-chart">
              <div className="db-chart-legend">
                <span className="db-legend-item"><span className="db-legend-dot db-legend-created" /> Created</span>
                <span className="db-legend-item"><span className="db-legend-dot db-legend-completed" /> Completed</span>
              </div>
              <div className="rp-line-chart">
                {/* Y-axis labels */}
                <div className="rp-line-y-axis">
                  <span>{trendMax}</span>
                  <span>{Math.round(trendMax / 2)}</span>
                  <span>0</span>
                </div>
                <div className="rp-line-area">
                  {/* Grid lines */}
                  <div className="rp-line-grid">
                    <div className="rp-grid-line" />
                    <div className="rp-grid-line" />
                    <div className="rp-grid-line" />
                  </div>
                  {/* Bars */}
                  <div className="db-chart-bars">
                    {trendData.map((d, i) => (
                      <div key={i} className="db-chart-col">
                        <div className="db-chart-bar-group">
                          <div className="db-chart-bar db-bar-created" style={{ height: `${(d.created / trendMax) * 100}%` }} title={`Created: ${d.created}`} />
                          <div className="db-chart-bar db-bar-completed" style={{ height: `${(d.completed / trendMax) * 100}%` }} title={`Completed: ${d.completed}`} />
                        </div>
                        <span className="db-chart-label">{d.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Status Distribution */}
          <div className="db-panel">
            <div className="db-panel-header">
              <h3 className="db-panel-title"><FiPieChart className="db-panel-title-icon" /> Status Distribution</h3>
            </div>
            <div className="rp-status-dist">
              <div className="rp-donut-wrap">
                <svg viewBox="0 0 36 36" className="rp-donut">
                  {(() => {
                    const segments = [
                      { value: statusDist.completed, color: '#4ade80' },
                      { value: statusDist.inProg, color: '#60a5fa' },
                      { value: statusDist.pending, color: '#94a3b8' },
                      { value: statusDist.overdue, color: '#ef4444' },
                    ];
                    let offset = 0;
                    return segments.map((s, i) => {
                      const pct = (s.value / statusTotal) * 100;
                      const el = (
                        <circle
                          key={i}
                          cx="18" cy="18" r="15.9155"
                          fill="none"
                          stroke={s.color}
                          strokeWidth="3"
                          strokeDasharray={`${pct} ${100 - pct}`}
                          strokeDashoffset={`${-offset}`}
                          strokeLinecap="round"
                        />
                      );
                      offset += pct;
                      return el;
                    });
                  })()}
                </svg>
                <div className="rp-donut-center">
                  <span className="rp-donut-number">{totalFiltered}</span>
                  <span className="rp-donut-label">Total</span>
                </div>
              </div>
              <div className="rp-status-legend">
                <div className="rp-status-leg-item">
                  <span className="rp-leg-dot" style={{ background: '#4ade80' }} />
                  <span className="rp-leg-label">Completed</span>
                  <span className="rp-leg-value">{statusDist.completed}</span>
                  <span className="rp-leg-pct">{totalFiltered > 0 ? Math.round((statusDist.completed / statusTotal) * 100) : 0}%</span>
                </div>
                <div className="rp-status-leg-item">
                  <span className="rp-leg-dot" style={{ background: '#60a5fa' }} />
                  <span className="rp-leg-label">In Progress</span>
                  <span className="rp-leg-value">{statusDist.inProg}</span>
                  <span className="rp-leg-pct">{totalFiltered > 0 ? Math.round((statusDist.inProg / statusTotal) * 100) : 0}%</span>
                </div>
                <div className="rp-status-leg-item">
                  <span className="rp-leg-dot" style={{ background: '#94a3b8' }} />
                  <span className="rp-leg-label">Pending</span>
                  <span className="rp-leg-value">{statusDist.pending}</span>
                  <span className="rp-leg-pct">{totalFiltered > 0 ? Math.round((statusDist.pending / statusTotal) * 100) : 0}%</span>
                </div>
                <div className="rp-status-leg-item">
                  <span className="rp-leg-dot" style={{ background: '#ef4444' }} />
                  <span className="rp-leg-label">Overdue</span>
                  <span className="rp-leg-value">{statusDist.overdue}</span>
                  <span className="rp-leg-pct">{totalFiltered > 0 ? Math.round((statusDist.overdue / statusTotal) * 100) : 0}%</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="db-right-col">
          {/* Priority Breakdown */}
          <div className="db-panel">
            <div className="db-panel-header">
              <h3 className="db-panel-title"><FiBarChart2 className="db-panel-title-icon" /> Priority Breakdown</h3>
            </div>
            <div className="rp-priority-chart">
              {([
                { key: 'low' as const, label: 'Low', color: '#4ade80', bg: 'rgba(74,222,128,0.15)' },
                { key: 'medium' as const, label: 'Medium', color: '#fbbf24', bg: 'rgba(251,191,36,0.15)' },
                { key: 'urgent' as const, label: 'Urgent', color: '#ef4444', bg: 'rgba(239,68,68,0.15)' },
              ]).map((p) => (
                <div key={p.key} className="rp-prio-row">
                  <div className="rp-prio-label-row">
                    <span className="rp-prio-label">{p.label}</span>
                    <span className="rp-prio-count" style={{ color: p.color }}>{priorityDist[p.key]}</span>
                  </div>
                  <div className="rp-prio-bar-bg">
                    <div className="rp-prio-bar-fill" style={{ width: `${(priorityDist[p.key] / priorityMax) * 100}%`, background: p.color }} />
                  </div>
                  <span className="rp-prio-pct">{totalFiltered > 0 ? Math.round((priorityDist[p.key] / totalFiltered) * 100) : 0}%</span>
                </div>
              ))}
            </div>
          </div>

          {/* Risk Indicators */}
          <div className="db-panel">
            <div className="db-panel-header">
              <h3 className="db-panel-title"><FiAlertTriangle className="db-panel-title-icon" /> Risk Indicators</h3>
            </div>
            <div className="rp-risks">
              {riskItems.length === 0 ? (
                <div className="db-task-empty">No risks detected</div>
              ) : riskItems.map((r, i) => (
                <div key={i} className={`rp-risk-item rp-risk-${r.severity}`}>
                  <FiAlertTriangle className="rp-risk-icon" />
                  <div className="rp-risk-content">
                    <span className="rp-risk-label">{r.label}</span>
                    <span className="rp-risk-detail">{r.detail}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Secondary Analytics ── */}
      <div className="rp-secondary-grid">
        {/* User Insights Table */}
        <div className="db-panel rp-insights-panel">
          <div className="db-panel-header">
            <h3 className="db-panel-title"><FiUsers className="db-panel-title-icon" /> User & Team Insights</h3>
          </div>
          <div className="rp-table-wrap">
            <table className="rp-table">
              <thead>
                <tr>
                  <th onClick={() => toggleInsightSort('name')} className="rp-th-sortable">
                    User <SortIcon active={insightSort === 'name'} dir={insightDir} />
                  </th>
                  <th onClick={() => toggleInsightSort('role')} className="rp-th-sortable">
                    Role <SortIcon active={insightSort === 'role'} dir={insightDir} />
                  </th>
                  <th onClick={() => toggleInsightSort('assigned')} className="rp-th-sortable">
                    Assigned <SortIcon active={insightSort === 'assigned'} dir={insightDir} />
                  </th>
                  <th onClick={() => toggleInsightSort('completed')} className="rp-th-sortable">
                    Completed <SortIcon active={insightSort === 'completed'} dir={insightDir} />
                  </th>
                  <th onClick={() => toggleInsightSort('rate')} className="rp-th-sortable">
                    Rate <SortIcon active={insightSort === 'rate'} dir={insightDir} />
                  </th>
                </tr>
              </thead>
              <tbody>
                {userInsights.map((u) => (
                  <tr key={u.id}>
                    <td>
                      <div className="rp-user-cell">
                        <div className="db-task-row-avatar">{u.name.split(' ').map((n) => n[0]).join('').toUpperCase()}</div>
                        <span>{u.name}</span>
                      </div>
                    </td>
                    <td><span className="rp-role-badge">{u.role}</span></td>
                    <td>{u.assigned}</td>
                    <td>{u.completed}</td>
                    <td>
                      <div className="rp-rate-cell">
                        <div className="rp-rate-bar-bg">
                          <div className="rp-rate-bar-fill" style={{ width: `${u.rate}%` }} />
                        </div>
                        <span className="rp-rate-val">{u.rate}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Workload Distribution */}
        <div className="db-panel">
          <div className="db-panel-header">
            <h3 className="db-panel-title"><FiBarChart2 className="db-panel-title-icon" /> Workload Distribution</h3>
          </div>
          <div className="rp-workload">
            {workloadData.length === 0 ? (
              <div className="db-task-empty">No workload data</div>
            ) : workloadData.map((u) => (
              <div key={u.id} className="rp-workload-row">
                <span className="rp-workload-name">{u.name}</span>
                <div className="rp-workload-bar-bg">
                  <div
                    className="rp-workload-bar-fill"
                    style={{ width: `${(u.assigned / workloadMax) * 100}%` }}
                  />
                </div>
                <span className="rp-workload-count">{u.assigned}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Detailed Reports Table ── */}
      <div className="db-panel rp-detail-panel">
        <div className="db-panel-header">
          <h3 className="db-panel-title"><FiFileText className="db-panel-title-icon" /> Detailed Task Report</h3>
          <span className="rp-micro">{sortedTableTasks.length} task{sortedTableTasks.length !== 1 ? 's' : ''}</span>
        </div>
        <div className="rp-detail-table-wrap">
          <table className="rp-detail-table">
            <thead>
              <tr>
                <th onClick={() => toggleTableSort('title')} className="rp-th-sortable">Title <SortIcon active={tableSort === 'title'} dir={tableDir} /></th>
                <th onClick={() => toggleTableSort('assignee')} className="rp-th-sortable">Assigned To <SortIcon active={tableSort === 'assignee'} dir={tableDir} /></th>
                <th onClick={() => toggleTableSort('priority')} className="rp-th-sortable">Priority <SortIcon active={tableSort === 'priority'} dir={tableDir} /></th>
                <th onClick={() => toggleTableSort('status')} className="rp-th-sortable">Status <SortIcon active={tableSort === 'status'} dir={tableDir} /></th>
                <th onClick={() => toggleTableSort('created')} className="rp-th-sortable">Created <SortIcon active={tableSort === 'created'} dir={tableDir} /></th>
                <th onClick={() => toggleTableSort('due')} className="rp-th-sortable">Due Date <SortIcon active={tableSort === 'due'} dir={tableDir} /></th>
              </tr>
            </thead>
            <tbody>
              {pagedTasks.map((t) => (
                <tr key={t.id}>
                  <td className="rp-detail-title">{t.title}</td>
                  <td>
                    {t.assignedTo ? (
                      <div className="rp-user-cell">
                        <div className="db-task-row-avatar">{getInitials(t.assignedTo.firstName, t.assignedTo.lastName)}</div>
                        <span>{t.assignedTo.firstName} {t.assignedTo.lastName}</span>
                      </div>
                    ) : '—'}
                  </td>
                  <td>
                    <span className={`db-task-row-priority db-priority-${t.priority}`}>
                      {t.priority === 'urgent' ? 'Urgent' : t.priority === 'medium' ? 'Medium' : 'Low'}
                    </span>
                  </td>
                  <td>
                    <span className={`db-task-row-status ${t.finished ? 'db-status-completed' : t.status === 'in_progress' ? 'db-status-progress' : 'db-status-frozen'}`}>
                      {t.finished ? 'Completed' : t.status === 'in_progress' ? 'In Progress' : 'Frozen'}
                    </span>
                  </td>
                  <td className="rp-date-cell">{new Date(t.createdAt).toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' })}</td>
                  <td className={`rp-date-cell ${!t.finished && new Date(t.dueDate) < now ? 'rp-overdue-text' : ''}`}>
                    {new Date(t.dueDate).toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div className="rp-pagination">
            <button className="rp-page-btn" disabled={tablePage === 0} onClick={() => setTablePage((p) => p - 1)}>
              <FiChevronLeft size={14} />
            </button>
            <span className="rp-page-info">Page {tablePage + 1} of {totalPages}</span>
            <button className="rp-page-btn" disabled={tablePage >= totalPages - 1} onClick={() => setTablePage((p) => p + 1)}>
              <FiChevronRight size={14} />
            </button>
          </div>
        )}
      </div>

      {/* ── Report Preview Cards ── */}
      <div className="rp-report-previews">
        <div className="rp-preview-card">
          <div className="rp-preview-icon db-icon-blue"><FiCalendar /></div>
          <div className="rp-preview-info">
            <span className="rp-preview-title">Weekly Summary</span>
            <span className="rp-preview-stat">{tasks.filter((t) => new Date(t.createdAt) >= new Date(now.getTime() - 7 * 86400000)).length} tasks this week</span>
          </div>
        </div>
        <div className="rp-preview-card">
          <div className="rp-preview-icon db-icon-green"><FiTrendingUp /></div>
          <div className="rp-preview-info">
            <span className="rp-preview-title">Monthly Productivity</span>
            <span className="rp-preview-stat">{completionRate}% completion rate</span>
          </div>
        </div>
        <div className="rp-preview-card">
          <div className="rp-preview-icon db-icon-purple"><FiUsers /></div>
          <div className="rp-preview-info">
            <span className="rp-preview-title">User Performance</span>
            <span className="rp-preview-stat">{activeContributors} active contributor{activeContributors !== 1 ? 's' : ''}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ReportPage;
