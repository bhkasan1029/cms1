import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  FiTrendingUp,
  FiClock,
  FiAlertTriangle,
  FiFlag,
  FiUsers,
  FiChevronLeft,
  FiChevronRight,
  FiArrowUp,
  FiArrowDown,
  FiActivity,
  FiPieChart,
  FiBarChart2,
  FiFileText,
  FiCalendar,
  FiDownload,
} from 'react-icons/fi';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  PieChart, Pie, Cell, ResponsiveContainer, Legend,
} from 'recharts';
import { getTasksApi, getUsersApi } from '../api/auth';
import type { TaskRecord, UserRecord } from '../api/auth';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

type DateRange = 'today' | 'week' | 'month' | 'all';
type SortKey = 'name' | 'role' | 'assigned' | 'completed' | 'rate';
type SortDir = 'asc' | 'desc';
type TableSort = 'title' | 'assignee' | 'priority' | 'status' | 'created' | 'due';

const PAGE_SIZE = 8;

const STATUS_COLORS = ['#4ade80', '#60a5fa', '#94a3b8', '#ef4444'];

function ReportPage() {
  const reportRef = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState(false);
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

  const statusChartData = useMemo(() => [
    { name: 'Completed', value: statusDist.completed },
    { name: 'In Progress', value: statusDist.inProg },
    { name: 'Pending', value: statusDist.pending },
    { name: 'Overdue', value: statusDist.overdue },
  ], [statusDist]);

  // ── Priority Breakdown ──
  const priorityDist = useMemo(() => ({
    low: filtered.filter((t) => t.priority === 'low').length,
    medium: filtered.filter((t) => t.priority === 'medium').length,
    urgent: filtered.filter((t) => t.priority === 'urgent').length,
  }), [filtered]);

  const priorityChartData = useMemo(() => [
    { name: 'Low', value: priorityDist.low, fill: '#4ade80' },
    { name: 'Medium', value: priorityDist.medium, fill: '#fbbf24' },
    { name: 'Urgent', value: priorityDist.urgent, fill: '#ef4444' },
  ], [priorityDist]);

  // ── Risk Indicators ──
  const riskItems = useMemo(() => {
    const risks: { label: string; detail: string; severity: 'high' | 'medium' }[] = [];

    const overdueTasks = filtered.filter((t) => !t.finished && new Date(t.dueDate) < now);
    if (overdueTasks.length > 0) {
      risks.push({
        label: `${overdueTasks.length} overdue task${overdueTasks.length > 1 ? 's' : ''}`,
        detail: 'Immediate attention required',
        severity: 'high',
      });
    }

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

  const workloadChartData = useMemo(() =>
    workloadData.map((u) => ({
      name: u.name.length > 12 ? u.name.slice(0, 12) + '...' : u.name,
      tasks: u.assigned,
    })),
  [workloadData]);

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

  const handleExportPdf = useCallback(async () => {
    if (!reportRef.current || exporting) return;
    setExporting(true);
    try {
      const canvas = await html2canvas(reportRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: null,
      });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = pageWidth;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      let position = 0;
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      let remaining = imgHeight - pageHeight;
      while (remaining > 0) {
        position -= pageHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        remaining -= pageHeight;
      }

      const date = new Date().toISOString().slice(0, 10);
      pdf.save(`report-${date}.pdf`);
    } catch (err) {
      console.error('PDF export failed', err);
    } finally {
      setExporting(false);
    }
  }, [exporting]);

  function getInitials(first: string, last: string) {
    return `${first?.[0] || ''}${last?.[0] || ''}`.toUpperCase();
  }

  const SortIcon = ({ active, dir }: { active: boolean; dir: SortDir }) =>
    active ? (dir === 'asc' ? <FiArrowUp size={11} /> : <FiArrowDown size={11} />) : null;

  const priorityVariant = (p: string) => {
    if (p === 'urgent') return 'destructive' as const;
    if (p === 'medium') return 'default' as const;
    return 'secondary' as const;
  };

  const statusLabel = (t: TaskRecord) =>
    t.finished ? 'Completed' : t.status === 'in_progress' ? 'In Progress' : 'Frozen';

  // ── Loading skeleton ──
  if (loading) {
    return (
      <div className="flex flex-col gap-6 p-2">
        <div>
          <Skeleton className="h-7 w-56 mb-2" />
          <Skeleton className="h-4 w-80" />
        </div>
        <div className="grid grid-cols-5 gap-4">
          {[...Array(5)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-5">
                <Skeleton className="h-4 w-24 mb-3" />
                <Skeleton className="h-8 w-16" />
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="grid grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-5">
                <Skeleton className="h-40 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-2">
      {/* ── Title ── */}
      <div>
        <h2 className="text-xl font-bold" style={{ color: 'var(--text-1)' }}>Reports & Analytics</h2>
        <p className="text-sm" style={{ color: 'var(--text-3)' }}>
          Insights into task performance, team workload, and productivity.
        </p>
      </div>

      {/* ── Filter Bar ── */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1">
          {(['today', 'week', 'month', 'all'] as DateRange[]).map((r) => (
            <Button
              key={r}
              variant={dateRange === r ? 'default' : 'outline'}
              size="sm"
              onClick={() => { setDateRange(r); setTablePage(0); }}
            >
              {r === 'all' ? 'All Time' : r.charAt(0).toUpperCase() + r.slice(1)}
            </Button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <Select value={filterStatus} onValueChange={(v) => { setFilterStatus(v); setTablePage(0); }}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="All Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="frozen">Pending</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="overdue">Overdue</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterPriority} onValueChange={(v) => { setFilterPriority(v); setTablePage(0); }}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="All Priority" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Priority</SelectItem>
              <SelectItem value="low">Low</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="urgent">Urgent</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterUser} onValueChange={(v) => { setFilterUser(v); setTablePage(0); }}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="All Users" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Users</SelectItem>
              {users.filter((u) => !u.deletedAt).map((u) => (
                <SelectItem key={u.id} value={u.id}>{u.firstName} {u.lastName}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="ml-auto gap-1.5"
          disabled={exporting}
          onClick={handleExportPdf}
        >
          <FiDownload size={14} />
          {exporting ? 'Exporting…' : 'Export PDF'}
        </Button>
      </div>

      {/* ── Report Content (captured for PDF) ── */}
      <div ref={reportRef} className="flex flex-col gap-6">

      {/* ── Key Metrics ── */}
      <div className="grid grid-cols-5 gap-4">
        <Card style={{ background: 'var(--tint-green)' }}>
          <CardContent className="p-5 flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg" style={{ background: 'rgba(74,222,128,0.15)', color: '#4ade80' }}>
              <FiTrendingUp size={18} />
            </div>
            <div className="flex flex-col">
              <span className="text-2xl font-bold" style={{ color: 'var(--text-1)' }}>{completionRate}%</span>
              <span className="text-xs" style={{ color: 'var(--text-3)' }}>Completion Rate</span>
            </div>
            <span className="ml-auto text-[0.7rem]" style={{ color: 'var(--text-5)' }}>{completedCount} of {totalFiltered} tasks</span>
          </CardContent>
        </Card>
        <Card style={{ background: 'var(--tint-blue)' }}>
          <CardContent className="p-5 flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg" style={{ background: 'rgba(96,165,250,0.15)', color: '#60a5fa' }}>
              <FiClock size={18} />
            </div>
            <div className="flex flex-col">
              <span className="text-2xl font-bold" style={{ color: 'var(--text-1)' }}>{avgCompletionDays}d</span>
              <span className="text-xs" style={{ color: 'var(--text-3)' }}>Avg Completion Time</span>
            </div>
            <span className="ml-auto text-[0.7rem]" style={{ color: 'var(--text-5)' }}>Per task average</span>
          </CardContent>
        </Card>
        <Card style={{ background: 'var(--tint-red)' }}>
          <CardContent className="p-5 flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg" style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444' }}>
              <FiAlertTriangle size={18} />
            </div>
            <div className="flex flex-col">
              <span className="text-2xl font-bold" style={{ color: 'var(--text-1)' }}>{overdueRatio}%</span>
              <span className="text-xs" style={{ color: 'var(--text-3)' }}>Overdue Ratio</span>
            </div>
            <span className="ml-auto text-[0.7rem]" style={{ color: 'var(--text-5)' }}>{overdueCount} task{overdueCount !== 1 ? 's' : ''} overdue</span>
          </CardContent>
        </Card>
        <Card style={{ background: 'var(--tint-amber)' }}>
          <CardContent className="p-5 flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg" style={{ background: 'rgba(251,191,36,0.15)', color: '#fbbf24' }}>
              <FiFlag size={18} />
            </div>
            <div className="flex flex-col">
              <span className="text-2xl font-bold" style={{ color: 'var(--text-1)' }}>{highPriorityCount}</span>
              <span className="text-xs" style={{ color: 'var(--text-3)' }}>High Priority</span>
            </div>
            <span className="ml-auto text-[0.7rem]" style={{ color: 'var(--text-5)' }}>Urgent tasks</span>
          </CardContent>
        </Card>
        <Card style={{ background: 'var(--tint-purple)' }}>
          <CardContent className="p-5 flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg" style={{ background: 'rgba(167,139,250,0.15)', color: '#a78bfa' }}>
              <FiUsers size={18} />
            </div>
            <div className="flex flex-col">
              <span className="text-2xl font-bold" style={{ color: 'var(--text-1)' }}>{activeContributors}</span>
              <span className="text-xs" style={{ color: 'var(--text-3)' }}>Active Contributors</span>
            </div>
            <span className="ml-auto text-[0.7rem]" style={{ color: 'var(--text-5)' }}>With assigned tasks</span>
          </CardContent>
        </Card>
      </div>

      {/* ── Primary Analytics ── */}
      <div className="grid grid-cols-[3fr_2fr] gap-4">
        {/* Left column */}
        <div className="flex flex-col gap-4">
          {/* Task Performance Trends */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                <FiActivity size={15} style={{ color: 'var(--text-3)' }} /> Task Performance Trends
              </CardTitle>
              <span className="text-xs" style={{ color: 'var(--text-4)' }}>Last {trendDays} day{trendDays > 1 ? 's' : ''}</span>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={trendData} barGap={2}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--n4)" />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'var(--text-4)' }} />
                  <YAxis tick={{ fontSize: 11, fill: 'var(--text-4)' }} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{
                      background: 'var(--bg-elevated)',
                      border: '1px solid var(--n5)',
                      borderRadius: 8,
                      fontSize: 12,
                      color: 'var(--text-1)',
                    }}
                  />
                  <Legend
                    iconType="circle"
                    iconSize={8}
                    wrapperStyle={{ fontSize: 12, color: 'var(--text-3)' }}
                  />
                  <Bar dataKey="created" name="Created" fill="#60a5fa" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="completed" name="Completed" fill="#4ade80" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Status Distribution */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                <FiPieChart size={15} style={{ color: 'var(--text-3)' }} /> Status Distribution
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-8">
                <ResponsiveContainer width={180} height={180}>
                  <PieChart>
                    <Pie
                      data={statusChartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={80}
                      paddingAngle={2}
                      dataKey="value"
                      strokeWidth={0}
                    >
                      {statusChartData.map((_, idx) => (
                        <Cell key={idx} fill={STATUS_COLORS[idx]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        background: 'var(--bg-elevated)',
                        border: '1px solid var(--n5)',
                        borderRadius: 8,
                        fontSize: 12,
                        color: 'var(--text-1)',
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex flex-col gap-3">
                  {[
                    { label: 'Completed', value: statusDist.completed, color: '#4ade80' },
                    { label: 'In Progress', value: statusDist.inProg, color: '#60a5fa' },
                    { label: 'Pending', value: statusDist.pending, color: '#94a3b8' },
                    { label: 'Overdue', value: statusDist.overdue, color: '#ef4444' },
                  ].map((s) => (
                    <div key={s.label} className="flex items-center gap-2 text-sm">
                      <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: s.color }} />
                      <span style={{ color: 'var(--text-2)' }}>{s.label}</span>
                      <span className="font-semibold ml-auto" style={{ color: 'var(--text-1)' }}>{s.value}</span>
                      <span className="text-xs w-10 text-right" style={{ color: 'var(--text-4)' }}>
                        {totalFiltered > 0 ? Math.round((s.value / statusTotal) * 100) : 0}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right column */}
        <div className="flex flex-col gap-4">
          {/* Priority Breakdown */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                <FiBarChart2 size={15} style={{ color: 'var(--text-3)' }} /> Priority Breakdown
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={priorityChartData} layout="vertical" barSize={16}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--n4)" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11, fill: 'var(--text-4)' }} allowDecimals={false} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 12, fill: 'var(--text-2)' }} width={60} />
                  <Tooltip
                    contentStyle={{
                      background: 'var(--bg-elevated)',
                      border: '1px solid var(--n5)',
                      borderRadius: 8,
                      fontSize: 12,
                      color: 'var(--text-1)',
                    }}
                  />
                  <Bar dataKey="value" name="Tasks" radius={[0, 4, 4, 0]}>
                    {priorityChartData.map((entry, idx) => (
                      <Cell key={idx} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <div className="flex justify-between mt-2 px-1">
                {(['low', 'medium', 'urgent'] as const).map((p) => (
                  <span key={p} className="text-xs" style={{ color: 'var(--text-4)' }}>
                    {p.charAt(0).toUpperCase() + p.slice(1)}: {totalFiltered > 0 ? Math.round((priorityDist[p] / totalFiltered) * 100) : 0}%
                  </span>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Risk Indicators */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                <FiAlertTriangle size={15} style={{ color: 'var(--text-3)' }} /> Risk Indicators
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-2">
                {riskItems.length === 0 ? (
                  <p className="text-sm py-4 text-center" style={{ color: 'var(--text-4)' }}>No risks detected</p>
                ) : riskItems.map((r, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-2.5 rounded-lg px-3 py-2.5"
                    style={{
                      background: r.severity === 'high' ? 'rgba(239,68,68,0.08)' : 'rgba(251,191,36,0.08)',
                      border: `1px solid ${r.severity === 'high' ? 'rgba(239,68,68,0.15)' : 'rgba(251,191,36,0.15)'}`,
                    }}
                  >
                    <FiAlertTriangle
                      size={14}
                      className="mt-0.5 shrink-0"
                      style={{ color: r.severity === 'high' ? '#ef4444' : '#fbbf24' }}
                    />
                    <div className="flex flex-col">
                      <span className="text-[0.82rem] font-medium" style={{ color: 'var(--text-1)' }}>{r.label}</span>
                      <span className="text-[0.72rem]" style={{ color: 'var(--text-3)' }}>{r.detail}</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ── Secondary Analytics ── */}
      <div className="grid grid-cols-[3fr_2fr] gap-4">
        {/* User Insights Table */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <FiUsers size={15} style={{ color: 'var(--text-3)' }} /> User & Team Insights
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="max-h-[320px] overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="cursor-pointer select-none" onClick={() => toggleInsightSort('name')}>
                      <span className="inline-flex items-center gap-1">User <SortIcon active={insightSort === 'name'} dir={insightDir} /></span>
                    </TableHead>
                    <TableHead className="cursor-pointer select-none" onClick={() => toggleInsightSort('role')}>
                      <span className="inline-flex items-center gap-1">Role <SortIcon active={insightSort === 'role'} dir={insightDir} /></span>
                    </TableHead>
                    <TableHead className="cursor-pointer select-none" onClick={() => toggleInsightSort('assigned')}>
                      <span className="inline-flex items-center gap-1">Assigned <SortIcon active={insightSort === 'assigned'} dir={insightDir} /></span>
                    </TableHead>
                    <TableHead className="cursor-pointer select-none" onClick={() => toggleInsightSort('completed')}>
                      <span className="inline-flex items-center gap-1">Completed <SortIcon active={insightSort === 'completed'} dir={insightDir} /></span>
                    </TableHead>
                    <TableHead className="cursor-pointer select-none" onClick={() => toggleInsightSort('rate')}>
                      <span className="inline-flex items-center gap-1">Rate <SortIcon active={insightSort === 'rate'} dir={insightDir} /></span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {userInsights.map((u) => (
                    <TableRow key={u.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="flex h-[26px] w-[26px] items-center justify-center rounded-full text-[0.62rem] font-semibold shrink-0" style={{ background: 'rgba(167,139,250,0.15)', color: '#a78bfa' }}>{u.name.split(' ').map((n) => n[0]).join('').toUpperCase()}</div>
                          <span>{u.name}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="capitalize text-[0.7rem]">{u.role}</Badge>
                      </TableCell>
                      <TableCell>{u.assigned}</TableCell>
                      <TableCell>{u.completed}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-16 rounded-full" style={{ background: 'var(--n3)' }}>
                            <div className="h-full rounded-full" style={{ width: `${u.rate}%`, background: '#4ade80' }} />
                          </div>
                          <span className="text-xs" style={{ color: 'var(--text-3)' }}>{u.rate}%</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Workload Distribution */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <FiBarChart2 size={15} style={{ color: 'var(--text-3)' }} /> Workload Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            {workloadData.length === 0 ? (
              <p className="text-sm py-4 text-center" style={{ color: 'var(--text-4)' }}>No workload data</p>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={workloadChartData} layout="vertical" barSize={14}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--n4)" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11, fill: 'var(--text-4)' }} allowDecimals={false} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: 'var(--text-2)' }} width={90} />
                  <Tooltip
                    contentStyle={{
                      background: 'var(--bg-elevated)',
                      border: '1px solid var(--n5)',
                      borderRadius: 8,
                      fontSize: 12,
                      color: 'var(--text-1)',
                    }}
                  />
                  <Bar dataKey="tasks" name="Assigned Tasks" fill="#818cf8" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Detailed Reports Table ── */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold">
            <FiFileText size={15} style={{ color: 'var(--text-3)' }} /> Detailed Task Report
          </CardTitle>
          <span className="text-xs" style={{ color: 'var(--text-5)' }}>{sortedTableTasks.length} task{sortedTableTasks.length !== 1 ? 's' : ''}</span>
        </CardHeader>
        <CardContent>
          <div className="max-h-[420px] overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="cursor-pointer select-none" onClick={() => toggleTableSort('title')}>
                    <span className="inline-flex items-center gap-1">Title <SortIcon active={tableSort === 'title'} dir={tableDir} /></span>
                  </TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={() => toggleTableSort('assignee')}>
                    <span className="inline-flex items-center gap-1">Assigned To <SortIcon active={tableSort === 'assignee'} dir={tableDir} /></span>
                  </TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={() => toggleTableSort('priority')}>
                    <span className="inline-flex items-center gap-1">Priority <SortIcon active={tableSort === 'priority'} dir={tableDir} /></span>
                  </TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={() => toggleTableSort('status')}>
                    <span className="inline-flex items-center gap-1">Status <SortIcon active={tableSort === 'status'} dir={tableDir} /></span>
                  </TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={() => toggleTableSort('created')}>
                    <span className="inline-flex items-center gap-1">Created <SortIcon active={tableSort === 'created'} dir={tableDir} /></span>
                  </TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={() => toggleTableSort('due')}>
                    <span className="inline-flex items-center gap-1">Due Date <SortIcon active={tableSort === 'due'} dir={tableDir} /></span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pagedTasks.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="max-w-[220px] truncate font-medium">{t.title}</TableCell>
                    <TableCell>
                      {t.assignedTo ? (
                        <div className="flex items-center gap-2">
                          <div className="flex h-[26px] w-[26px] items-center justify-center rounded-full text-[0.62rem] font-semibold shrink-0" style={{ background: 'rgba(167,139,250,0.15)', color: '#a78bfa' }}>{getInitials(t.assignedTo.firstName, t.assignedTo.lastName)}</div>
                          <span>{t.assignedTo.firstName} {t.assignedTo.lastName}</span>
                        </div>
                      ) : '—'}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={priorityVariant(t.priority)}
                        className="text-xs"
                        style={t.priority === 'medium' ? { background: '#fbbf24', color: '#1f2937' } : undefined}
                      >
                        {t.priority === 'urgent' ? 'Urgent' : t.priority === 'medium' ? 'Medium' : 'Low'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        style={{
                          borderColor: t.finished ? '#4ade80' : t.status === 'in_progress' ? '#60a5fa' : '#94a3b8',
                          color: t.finished ? '#4ade80' : t.status === 'in_progress' ? '#60a5fa' : '#94a3b8',
                        }}
                      >
                        {statusLabel(t)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs whitespace-nowrap" style={{ color: 'var(--text-4)' }}>
                      {new Date(t.createdAt).toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </TableCell>
                    <TableCell
                      className="text-xs whitespace-nowrap"
                      style={{ color: !t.finished && new Date(t.dueDate) < now ? '#ef4444' : 'var(--text-4)' }}
                    >
                      {new Date(t.dueDate).toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-3 pt-4">
              <Button variant="outline" size="icon" disabled={tablePage === 0} onClick={() => setTablePage((p) => p - 1)}>
                <FiChevronLeft size={14} />
              </Button>
              <span className="text-xs" style={{ color: 'var(--text-3)' }}>Page {tablePage + 1} of {totalPages}</span>
              <Button variant="outline" size="icon" disabled={tablePage >= totalPages - 1} onClick={() => setTablePage((p) => p + 1)}>
                <FiChevronRight size={14} />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Report Preview Cards ── */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="flex items-center gap-4 p-4 transition-transform hover:-translate-y-0.5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg" style={{ background: 'rgba(96,165,250,0.15)', color: '#60a5fa' }}>
            <FiCalendar size={18} />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-medium" style={{ color: 'var(--text-1)' }}>Weekly Summary</span>
            <span className="text-xs" style={{ color: 'var(--text-3)' }}>
              {tasks.filter((t) => new Date(t.createdAt) >= new Date(now.getTime() - 7 * 86400000)).length} tasks this week
            </span>
          </div>
        </Card>
        <Card className="flex items-center gap-4 p-4 transition-transform hover:-translate-y-0.5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg" style={{ background: 'rgba(74,222,128,0.15)', color: '#4ade80' }}>
            <FiTrendingUp size={18} />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-medium" style={{ color: 'var(--text-1)' }}>Monthly Productivity</span>
            <span className="text-xs" style={{ color: 'var(--text-3)' }}>{completionRate}% completion rate</span>
          </div>
        </Card>
        <Card className="flex items-center gap-4 p-4 transition-transform hover:-translate-y-0.5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg" style={{ background: 'rgba(167,139,250,0.15)', color: '#a78bfa' }}>
            <FiUsers size={18} />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-medium" style={{ color: 'var(--text-1)' }}>User Performance</span>
            <span className="text-xs" style={{ color: 'var(--text-3)' }}>{activeContributors} active contributor{activeContributors !== 1 ? 's' : ''}</span>
          </div>
        </Card>
      </div>
      </div>
    </div>
  );
}

export default ReportPage;
