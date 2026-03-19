import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FiCheckSquare,
  FiClock,
  FiTrendingUp,
  FiAlertCircle,
  FiFileText,
  FiActivity,
} from 'react-icons/fi';
import { useAuth } from '../context/AuthContext';
import { getTasksApi } from '../api/auth';
import type { TaskRecord } from '../api/auth';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

type TabKey = 'all' | 'in_progress' | 'pending' | 'completed';

function UserDashboardHome() {
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
    () => tasks.filter((t) => t.assignedToId === user?.userId),
    [tasks, user],
  );

  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 86400000);

  const totalMyTasks = myTasks.length;
  const inProgress = myTasks.filter(
    (t) => t.status === 'in_progress' && !t.finished,
  ).length;
  const completedThisWeek = myTasks.filter(
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
      .map((t) => ({
        text: t.finished
          ? `"${t.title}" marked completed`
          : `"${t.title}" is ${t.status.replace('_', ' ')}`,
        time: t.updatedAt,
        type: t.finished ? 'completed' : 'assigned',
      }));
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
      <div className="flex flex-col gap-6">
        <div className="grid grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
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
      <div className="grid grid-cols-4 gap-4">
        {[
          { icon: <FiCheckSquare size={18} />, value: totalMyTasks, label: 'My Tasks', tint: 'var(--tint-blue)', iconBg: 'rgba(96,165,250,0.15)', iconColor: '#60a5fa' },
          { icon: <FiClock size={18} />, value: inProgress, label: 'In Progress', tint: 'var(--tint-amber)', iconBg: 'rgba(251,191,36,0.15)', iconColor: '#fbbf24' },
          { icon: <FiTrendingUp size={18} />, value: completedThisWeek, label: 'Completed This Week', tint: 'var(--tint-green)', iconBg: 'rgba(74,222,128,0.15)', iconColor: '#4ade80', trend: <><FiTrendingUp size={12} /> +{completedThisWeek}</> },
          { icon: <FiAlertCircle size={18} />, value: overdue, label: 'Overdue', tint: 'var(--tint-red)', iconBg: 'rgba(239,68,68,0.1)', iconColor: '#ef4444', trend: overdue > 0 ? 'Attention' : null, trendDown: true },
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
                <span className={`inline-flex w-fit items-center gap-1 rounded-md px-2 py-0.5 text-[0.72rem] font-medium ${m.trendDown ? 'bg-red-500/10 text-red-400' : 'bg-green-500/10 text-green-400'}`}>
                  {m.trend}
                </span>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ── Main Grid ── */}
      <div className="grid grid-cols-[2fr_1fr] gap-4">
        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                <FiFileText size={15} style={{ color: 'var(--text-3)' }} /> My Tasks
              </CardTitle>
            </CardHeader>
            <CardContent>
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
                  </button>
                ))}
              </div>
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
        </div>

        <div className="flex flex-col gap-4">
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

      {/* ── Activity ── */}
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
                <div className="w-2 h-2 rounded-full shrink-0 mt-1.5" style={{ background: a.type === 'completed' ? '#4ade80' : '#60a5fa' }} />
                <div className="flex flex-col gap-0.5 min-w-0">
                  <span className="text-[0.8rem] leading-snug" style={{ color: 'var(--text-2)' }}>{a.text}</span>
                  <span className="text-[0.7rem]" style={{ color: 'var(--text-5)' }}>{timeAgo(a.time)}</span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default UserDashboardHome;
