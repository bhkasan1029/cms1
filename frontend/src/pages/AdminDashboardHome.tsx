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
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts';
import { getTasksApi, getUsersApi } from '../api/auth';
import type { TaskRecord, UserRecord } from '../api/auth';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

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

  const tabCounts: Record<TabKey, number> = {
    all: tasks.length,
    in_progress: tasks.filter((t) => t.status === 'in_progress' && !t.finished).length,
    pending: tasks.filter((t) => t.status === 'frozen' && !t.finished).length,
    completed: tasks.filter((t) => t.finished).length,
  };

  if (loading) {
    return (
      <div className="flex flex-col gap-6">
        <div className="grid grid-cols-5 gap-4">
          {[...Array(5)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-5">
                <Skeleton className="h-4 w-20 mb-3" />
                <Skeleton className="h-8 w-14" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* ── Hero Metrics ── */}
      <div className="grid grid-cols-5 gap-4">
        {[
          { icon: <FiCheckSquare size={18} />, value: totalTasks, label: 'Total Tasks', tint: 'var(--tint-blue)', iconBg: 'rgba(96,165,250,0.15)', iconColor: '#60a5fa', trend: <><FiTrendingUp size={12} /> Active</>, trendClass: 'bg-green-500/10 text-green-400' },
          { icon: <FiCalendar size={18} />, value: tasksDueToday, label: 'Due Today', tint: 'var(--tint-amber)', iconBg: 'rgba(251,191,36,0.15)', iconColor: '#fbbf24', trend: 'Today', trendClass: 'bg-yellow-500/10 text-yellow-400' },
          { icon: <FiAlertCircle size={18} />, value: overdueTasks, label: 'Overdue', tint: 'var(--tint-red)', iconBg: 'rgba(239,68,68,0.1)', iconColor: '#ef4444', trend: overdueTasks > 0 ? 'Attention' : null, trendClass: 'bg-red-500/10 text-red-400' },
          { icon: <FiTrendingUp size={18} />, value: completedThisWeek, label: 'Completed This Week', tint: 'var(--tint-green)', iconBg: 'rgba(74,222,128,0.15)', iconColor: '#4ade80', trend: <><FiTrendingUp size={12} /> +{completedThisWeek}</>, trendClass: 'bg-green-500/10 text-green-400' },
          { icon: <FiUsers size={18} />, value: activeUsers, label: 'Active Users', tint: 'var(--tint-purple)', iconBg: 'rgba(167,139,250,0.15)', iconColor: '#a78bfa', trend: <><FiTrendingUp size={12} /> Online</>, trendClass: 'bg-green-500/10 text-green-400' },
        ].map((m, i) => (
          <Card key={i} className="transition-transform hover:-translate-y-0.5" style={{ background: m.tint }}>
            <CardContent className="p-5 flex flex-col gap-3">
              <div className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-[10px]" style={{ background: m.iconBg, color: m.iconColor }}>
                {m.icon}
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-[1.75rem] font-bold leading-tight" style={{ color: 'var(--text-1)' }}>{m.value}</span>
                <span className="text-[0.78rem] font-medium uppercase tracking-wide" style={{ color: 'var(--text-3)' }}>{m.label}</span>
              </div>
              {m.trend && (
                <span className={`inline-flex w-fit items-center gap-1 rounded-md px-2 py-0.5 text-[0.72rem] font-medium ${m.trendClass}`}>
                  {m.trend}
                </span>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ── Main Content Grid ── */}
      <div className="grid grid-cols-[2fr_1fr] gap-4">
        {/* Left Column */}
        <div className="flex flex-col gap-4">
          {/* Task Overview Panel */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                <FiFileText size={15} style={{ color: 'var(--text-3)' }} /> Task Overview
              </CardTitle>
            </CardHeader>
            <CardContent>
              {/* Tabs */}
              <div className="flex border-b border-border mb-3">
                {([['all', 'All'], ['in_progress', 'In Progress'], ['pending', 'Pending'], ['completed', 'Completed']] as [TabKey, string][]).map(([key, label]) => (
                  <button
                    key={key}
                    className={`flex items-center gap-1.5 px-4 py-2.5 text-[0.82rem] font-medium border-b-2 transition-colors bg-transparent ${
                      activeTab === key
                        ? 'border-blue-400 text-[var(--text-1)]'
                        : 'border-transparent text-[var(--text-3)] hover:text-[var(--text-4)]'
                    }`}
                    style={{ boxShadow: 'none', borderRadius: 0 }}
                    onClick={() => setActiveTab(key)}
                  >
                    {label}
                    <span className={`text-[0.7rem] px-1.5 py-0.5 rounded ${
                      activeTab === key ? 'bg-blue-400/15 text-blue-400' : 'bg-[var(--n3)] text-[var(--text-4)]'
                    }`}>
                      {tabCounts[key]}
                    </span>
                  </button>
                ))}
              </div>
              {/* Task List */}
              <div className="max-h-[380px] overflow-y-auto flex flex-col gap-1">
                {filteredTasks.length === 0 ? (
                  <p className="py-8 text-center text-sm" style={{ color: 'var(--text-3)' }}>No tasks found</p>
                ) : filteredTasks.slice(0, 8).map((t) => (
                  <div
                    key={t.id}
                    className="flex items-center justify-between gap-4 px-3 py-2.5 rounded-[10px] cursor-pointer transition-colors hover:bg-[var(--n1)]"
                    onClick={() => navigate(`/tasks/${t.id}`)}
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <span className="text-[0.85rem] font-medium truncate" style={{ color: 'var(--text-1)' }}>{t.title}</span>
                      <Badge
                        variant={t.priority === 'urgent' ? 'destructive' : 'secondary'}
                        className="text-[0.68rem] shrink-0"
                        style={
                          t.priority === 'low' ? { background: 'rgba(74,222,128,0.12)', color: '#4ade80' } :
                          t.priority === 'medium' ? { background: 'rgba(251,191,36,0.12)', color: '#fbbf24' } :
                          undefined
                        }
                      >
                        {priorityLabel(t.priority)}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2.5 shrink-0">
                      <span className="flex items-center gap-1 text-xs" style={{ color: 'var(--text-3)' }}>
                        <FiClock size={12} />
                        {new Date(t.dueDate).toLocaleDateString('en', { month: 'short', day: 'numeric' })}
                      </span>
                      {t.assignedTo && (
                        <div className="flex h-[26px] w-[26px] items-center justify-center rounded-full text-[0.62rem] font-semibold shrink-0" style={{ background: 'rgba(167,139,250,0.15)', color: '#a78bfa' }} title={`${t.assignedTo.firstName} ${t.assignedTo.lastName}`}>
                          {getInitials(t.assignedTo.firstName, t.assignedTo.lastName)}
                        </div>
                      )}
                      <Badge
                        variant="outline"
                        className="text-[0.68rem]"
                        style={{
                          borderColor: t.finished ? '#4ade80' : t.status === 'in_progress' ? '#60a5fa' : '#94a3b8',
                          color: t.finished ? '#4ade80' : t.status === 'in_progress' ? '#60a5fa' : '#94a3b8',
                        }}
                      >
                        {statusLabel(t)}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Productivity & Task Flow */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                <FiBarChart2 size={15} style={{ color: 'var(--text-3)' }} /> Productivity & Task Flow
              </CardTitle>
              <span className="text-xs px-2.5 py-1 rounded-md" style={{ background: 'var(--n5)', color: 'var(--text-3)' }}>Last 7 days</span>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={chartData} barGap={2}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--n4)" />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'var(--text-3)' }} />
                  <YAxis tick={{ fontSize: 11, fill: 'var(--text-4)' }} allowDecimals={false} />
                  <Tooltip contentStyle={{ background: 'var(--bg-elevated)', border: '1px solid var(--n5)', borderRadius: 8, fontSize: 12, color: 'var(--text-1)' }} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, color: 'var(--text-3)' }} />
                  <Bar dataKey="created" name="Created" fill="#60a5fa" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="completed" name="Completed" fill="#4ade80" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* Right Column */}
        <div className="flex flex-col gap-4">
          {/* Quick Actions */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              <Button className="justify-start gap-2.5 w-full" style={{ background: 'rgba(96,165,250,0.15)', color: '#60a5fa' }} onClick={() => navigate('/create-task')}>
                <FiPlus /> Create New Task
              </Button>
              <Button variant="ghost" className="justify-start gap-2.5 w-full" onClick={() => navigate('/tasks')}>
                <FiUserPlus /> Assign Task
              </Button>
              <Button variant="ghost" className="justify-start gap-2.5 w-full" onClick={() => navigate('/report')}>
                <FiBarChart2 /> View Reports
              </Button>
            </CardContent>
          </Card>

          {/* Upcoming Deadlines */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                <FiClock size={15} style={{ color: 'var(--text-3)' }} /> Upcoming Deadlines
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-1">
                {upcomingDeadlines.length === 0 ? (
                  <p className="py-8 text-center text-sm" style={{ color: 'var(--text-3)' }}>No upcoming deadlines</p>
                ) : upcomingDeadlines.map((t) => (
                  <div
                    key={t.id}
                    className="flex items-stretch gap-3 px-3 py-2.5 rounded-[10px] cursor-pointer transition-colors hover:bg-[var(--n1)]"
                    onClick={() => navigate(`/tasks/${t.id}`)}
                  >
                    <div className="w-[3px] shrink-0 rounded-full" style={{ background: t.priority === 'urgent' ? '#ef4444' : t.priority === 'medium' ? '#fbbf24' : '#4ade80' }} />
                    <div className="flex flex-col gap-0.5 min-w-0">
                      <span className="text-[0.83rem] font-medium truncate" style={{ color: 'var(--text-1)' }}>{t.title}</span>
                      <span className="text-[0.72rem]" style={{ color: 'var(--text-3)' }}>{countdown(t.dueDate)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ── Secondary Section ── */}
      <div className="grid grid-cols-3 gap-4">
        {/* Activity Feed */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <FiActivity size={15} style={{ color: 'var(--text-3)' }} /> Recent Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="max-h-[280px] overflow-y-auto flex flex-col gap-2">
              {recentActivity.length === 0 ? (
                <p className="py-8 text-center text-sm" style={{ color: 'var(--text-3)' }}>No recent activity</p>
              ) : recentActivity.map((a, i) => (
                <div key={i} className="flex items-start gap-2.5 py-2 border-b border-[var(--n1)] last:border-0">
                  <div className="w-2 h-2 rounded-full shrink-0 mt-1.5" style={{ background: a.type === 'completed' ? '#4ade80' : a.type === 'assigned' ? '#60a5fa' : '#fbbf24' }} />
                  <div className="flex flex-col gap-0.5 min-w-0">
                    <span className="text-[0.8rem] leading-snug" style={{ color: 'var(--text-2)' }}>{a.text}</span>
                    <span className="text-[0.7rem]" style={{ color: 'var(--text-5)' }}>{timeAgo(a.time)}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* User Snapshot */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <FiUsers size={15} style={{ color: 'var(--text-3)' }} /> Team Overview
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-1">
              {userSnapshot.map((u) => (
                <div
                  key={u.id}
                  className="flex items-center justify-between px-2.5 py-2 rounded-[10px] cursor-pointer transition-colors hover:bg-[var(--n1)]"
                  onClick={() => navigate(`/profile/${u.id}`)}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="flex h-[30px] w-[30px] items-center justify-center rounded-full text-[0.65rem] font-semibold shrink-0" style={{ background: 'rgba(167,139,250,0.15)', color: '#a78bfa' }}>
                      {u.name.split(' ').map((n) => n[0]).join('').toUpperCase()}
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="text-[0.82rem] font-medium truncate" style={{ color: 'var(--text-1)' }}>{u.name}</span>
                      <span className="text-[0.7rem] capitalize" style={{ color: 'var(--text-3)' }}>{u.role}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <span className="text-[0.72rem]" style={{ color: 'var(--text-3)' }}>{u.taskCount} tasks</span>
                    <div className="w-2 h-2 rounded-full shrink-0" style={{ background: u.online ? '#4ade80' : '#4b5563', boxShadow: u.online ? 'var(--glow-green)' : 'none' }} />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Reports Preview */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <FiPieChart size={15} style={{ color: 'var(--text-3)' }} /> Reports Preview
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2.5">
            <Card className="flex flex-col items-center gap-1.5 p-4 cursor-pointer transition-transform hover:-translate-y-0.5" onClick={() => navigate('/report')}>
              <div className="flex h-[34px] w-[34px] items-center justify-center rounded-[10px]" style={{ background: 'rgba(74,222,128,0.15)', color: '#4ade80' }}>
                <FiTrendingUp />
              </div>
              <span className="text-[1.35rem] font-bold" style={{ color: 'var(--text-1)' }}>{completionRate}%</span>
              <span className="text-[0.72rem] text-center" style={{ color: 'var(--text-3)' }}>Completion Rate</span>
            </Card>
            <Card className="flex flex-col items-center gap-1.5 p-4 cursor-pointer transition-transform hover:-translate-y-0.5" onClick={() => navigate('/report')}>
              <div className="flex h-[34px] w-[34px] items-center justify-center rounded-[10px]" style={{ background: 'rgba(96,165,250,0.15)', color: '#60a5fa' }}>
                <FiUsers />
              </div>
              <span className="text-[1.35rem] font-bold" style={{ color: 'var(--text-1)' }}>{activeUsers}</span>
              <span className="text-[0.72rem] text-center" style={{ color: 'var(--text-3)' }}>Workload Distribution</span>
            </Card>
            <Card className="flex flex-col items-center gap-1.5 p-4 cursor-pointer transition-transform hover:-translate-y-0.5" onClick={() => navigate('/report')}>
              <div className="flex h-[34px] w-[34px] items-center justify-center rounded-[10px]" style={{ background: 'rgba(251,191,36,0.15)', color: '#fbbf24' }}>
                <FiPieChart />
              </div>
              <div className="flex w-full h-2 rounded gap-0.5 overflow-hidden my-1">
                <div className="rounded" style={{ flex: priorityBreakdown.low || 0.1, background: '#4ade80' }} />
                <div className="rounded" style={{ flex: priorityBreakdown.medium || 0.1, background: '#fbbf24' }} />
                <div className="rounded" style={{ flex: priorityBreakdown.urgent || 0.1, background: '#ef4444' }} />
              </div>
              <span className="text-[0.72rem] text-center" style={{ color: 'var(--text-3)' }}>Priority Breakdown</span>
            </Card>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default AdminDashboardHome;
