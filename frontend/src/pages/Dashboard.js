import React, { useState, useEffect, useRef } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, LineChart, Line, AreaChart, Area
} from 'recharts';
import {
  Target, CheckSquare, BookOpen, ListChecks, Clock, AlertTriangle,
  TrendingUp, Users, Briefcase, ArrowRight, BarChart2, Activity,
  CheckCircle2, Circle, AlertCircle, Calendar, DollarSign, Download
} from 'lucide-react';
import Header from '../components/layout/Header';
import { useAuth } from '../contexts/AuthContext';
import api from '../utils/api';
import { timeAgo } from '../utils/helpers';
import './Dashboard.css';

const PRIORITY_COLORS = { critical: '#dc3545', high: '#e67e22', medium: '#f59e0b', low: '#28a745' };
const CHART_COLORS = ['#3e72ae', '#6b5ea8', '#e67e22', '#27ae60', '#e74c3c', '#14b8a6', '#f59e0b', '#8b5cf6'];

const fmt = (n) => Number(n || 0).toLocaleString();
const fmtCurrency = (n) => {
  const v = Number(n || 0);
  if (v >= 1000000) return `$${(v / 1000000).toFixed(1)}M`;
  if (v >= 1000) return `$${(v / 1000).toFixed(0)}K`;
  return `$${v.toLocaleString()}`;
};

function StatCard({ icon: Icon, label, value, sub, color = '#3e72ae', trend }) {
  return (
    <div className="dash-stat-card">
      <div className="dash-stat-icon" style={{ background: color + '18', color }}>
        <Icon size={20} />
      </div>
      <div className="dash-stat-body">
        <div className="dash-stat-value">{value}</div>
        <div className="dash-stat-label">{label}</div>
        {sub && <div className="dash-stat-sub">{sub}</div>}
      </div>
      {trend !== undefined && (
        <div className={`dash-stat-trend ${trend >= 0 ? 'up' : 'down'}`}>
          <TrendingUp size={12} />
          {Math.abs(trend)}%
        </div>
      )}
    </div>
  );
}

function SectionTitle({ icon: Icon, children }) {
  return (
    <div className="dash-section-title">
      {Icon && <Icon size={16} />}
      <span>{children}</span>
    </div>
  );
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 8, padding: '10px 14px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', fontSize: 12 }}>
      {label && <p style={{ color: '#718096', marginBottom: 4, fontWeight: 600 }}>{label}</p>}
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color || '#3e72ae', fontWeight: 600, margin: '2px 0' }}>
          {p.name}: {typeof p.value === 'number' && p.value > 999 ? p.value.toLocaleString() : p.value}
        </p>
      ))}
    </div>
  );
};

export default function Dashboard() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const dashRef = useRef(null);

  useEffect(() => {
    api.get('/dashboard')
      .then(r => setData(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleExportPDF = async () => {
    setExporting(true);
    try {
      const html2canvasModule = await import('html2canvas');
      const html2canvas = html2canvasModule.default || html2canvasModule;
      const jsPDFModule = await import('jspdf');
      const jsPDF = jsPDFModule.jsPDF || jsPDFModule.default;
      const element = dashRef.current;
      if (!element) return;

      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#f8faff',
        width: element.scrollWidth,
        height: element.scrollHeight,
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const margin = 10;
      const headerH = 16;
      const usableW = pageW - margin * 2;
      const imgH = (canvas.height * usableW) / canvas.width;
      const usablePageH = pageH - margin * 2;

      // Header text on first page
      pdf.setFontSize(15);
      pdf.setTextColor(62, 114, 174);
      pdf.text('Nexus Pre \u2014 Dashboard Report', margin, margin + 5);
      pdf.setFontSize(9);
      pdf.setTextColor(113, 128, 150);
      const dateStr = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
      pdf.text(`Generated: ${dateStr}  |  ${user?.first_name} ${user?.last_name}`, margin, margin + 11);

      // Place full-height image starting after header on page 1
      const imgStartY = margin + headerH;
      pdf.addImage(imgData, 'PNG', margin, imgStartY, usableW, imgH, '', 'FAST');

      // Add extra pages if image overflows
      let heightLeft = imgH - (pageH - imgStartY - margin);
      let pageNum = 1;
      while (heightLeft > 0) {
        pdf.addPage();
        // On each new page, move image up so the next slice is visible
        const yPos = imgStartY - pageNum * (pageH - margin * 2);
        pdf.addImage(imgData, 'PNG', margin, yPos, usableW, imgH, '', 'FAST');
        heightLeft -= (pageH - margin * 2);
        pageNum++;
      }

      pdf.save(`nexus-dashboard-${new Date().toISOString().slice(0, 10)}.pdf`);
    } catch (err) {
      console.error('PDF export error:', err);
    } finally {
      setExporting(false);
    }
  };

  if (loading) return (
    <div className="page-loading">
      <div className="page-spinner" />
      <p>Loading dashboard…</p>
    </div>
  );

  if (!data) return null;

  const {
    storyStats = {}, storyTaskStats = {}, prospectStats = {}, prospectTaskStats = {},
    pipeline = [], storyPriority = [], prospectPriority = [],
    userBreakdown = [], teamBreakdown = [], trend = [],
    recentActivity = [], taskCompletion = [], isAdmin,
  } = data;

  const totalTasks = (Number(storyTaskStats.total || 0) + Number(prospectTaskStats.total || 0));
  const completedTasks = (Number(storyTaskStats.completed || 0) + Number(prospectTaskStats.completed || 0));
  const overdueTasks = (Number(storyTaskStats.overdue || 0) + Number(prospectTaskStats.overdue || 0));
  const inProgressTasks = (Number(storyTaskStats.in_progress || 0) + Number(prospectTaskStats.in_progress || 0));
  const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  // Priority chart data
  const priorityData = ['critical', 'high', 'medium', 'low'].map(p => ({
    name: p.charAt(0).toUpperCase() + p.slice(1),
    Stories: Number((storyPriority.find(x => x.priority === p) || {}).count || 0),
    Prospects: Number((prospectPriority.find(x => x.priority === p) || {}).count || 0),
    color: PRIORITY_COLORS[p],
  })).filter(d => d.Stories > 0 || d.Prospects > 0);

  // Task status pie
  const taskStatusData = [
    { name: 'Completed', value: completedTasks, color: '#16a34a' },
    { name: 'In Progress', value: inProgressTasks, color: '#3e72ae' },
    { name: 'Overdue', value: overdueTasks, color: '#dc3545' },
    { name: 'Upcoming', value: Number(storyTaskStats.upcoming || 0) + Number(prospectTaskStats.upcoming || 0), color: '#f59e0b' },
  ].filter(d => d.value > 0);

  // Trend chart
  const trendData = trend.map(t => ({
    month: t.month,
    Stories: Number(t.stories),
    Value: Number(t.value),
  }));

  const activityIcon = (type) => {
    if (type === 'moved') return <ArrowRight size={13} color="#3e72ae" />;
    if (type === 'created') return <CheckCircle2 size={13} color="#16a34a" />;
    if (type === 'completed') return <CheckCircle2 size={13} color="#16a34a" />;
    if (type === 'comment') return <Activity size={13} color="#8b5cf6" />;
    return <Circle size={13} color="#718096" />;
  };

  const firstName = user?.first_name || 'there';

  return (
    <>
      <Header
        title={`Welcome back, ${firstName} 👋`}
        subtitle={isAdmin ? 'System overview across all teams, stories, and prospects' : 'Your assigned stories and prospects overview'}
      />
      <div className="page-content dash-page">
        <div className="dash-export-row">
          <button
            className="btn btn-secondary btn-sm"
            onClick={handleExportPDF}
            disabled={exporting}
            style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 'auto' }}
          >
            <Download size={14} />
            {exporting ? 'Generating PDF...' : 'Export PDF'}
          </button>
        </div>
        <div ref={dashRef}>

        {/* ── KPI Row ────────────────────────────────────────────────── */}
        <div className="dash-kpi-grid">
          <StatCard icon={BookOpen} label="User Stories" value={fmt(storyStats.total_stories)} color="#3e72ae"
            sub={fmtCurrency(storyStats.pipeline_value) + ' pipeline'} />
          <StatCard icon={Target} label="Prospects" value={fmt(prospectStats.total_prospects)} color="#8b5cf6" />
          <StatCard icon={ListChecks} label="Total Tasks" value={fmt(totalTasks)} color="#e67e22"
            sub={`${completionRate}% completion rate`} />
          <StatCard icon={CheckCircle2} label="Completed Tasks" value={fmt(completedTasks)} color="#16a34a"
            sub={`${fmt(storyTaskStats.completed || 0)} story · ${fmt(prospectTaskStats.completed || 0)} prospect`} />
          <StatCard icon={AlertTriangle} label="Overdue Tasks" value={fmt(overdueTasks)} color="#dc3545"
            sub={`${fmt(storyTaskStats.overdue || 0)} story · ${fmt(prospectTaskStats.overdue || 0)} prospect`} />
          <StatCard icon={Clock} label="In Progress Tasks" value={fmt(inProgressTasks)} color="#f59e0b"
            sub={`${fmt(storyTaskStats.in_progress || 0)} story · ${fmt(prospectTaskStats.in_progress || 0)} prospect`} />
        </div>

        {/* ── Secondary Stats ────────────────────────────────────────── */}
        <div className="dash-secondary-grid">
          <div className="dash-card">
            <SectionTitle icon={BarChart2}>Story Tasks Breakdown</SectionTitle>
            <div className="dash-mini-stats">
              {[
                { label: 'Total', val: fmt(storyTaskStats.total), color: '#3e72ae' },
                { label: 'In Progress', val: fmt(storyTaskStats.in_progress), color: '#f59e0b' },
                { label: 'Overdue', val: fmt(storyTaskStats.overdue), color: '#dc3545' },
                { label: 'Completed', val: fmt(storyTaskStats.completed), color: '#16a34a' },
                { label: 'Upcoming', val: fmt(storyTaskStats.upcoming), color: '#8b5cf6' },
              ].map(s => (
                <div key={s.label} className="dash-mini-stat">
                  <div className="dash-mini-stat-val" style={{ color: s.color }}>{s.val}</div>
                  <div className="dash-mini-stat-label">{s.label}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="dash-card">
            <SectionTitle icon={Target}>Prospect Tasks Breakdown</SectionTitle>
            <div className="dash-mini-stats">
              {[
                { label: 'Total', val: fmt(prospectTaskStats.total), color: '#8b5cf6' },
                { label: 'In Progress', val: fmt(prospectTaskStats.in_progress), color: '#f59e0b' },
                { label: 'Overdue', val: fmt(prospectTaskStats.overdue), color: '#dc3545' },
                { label: 'Completed', val: fmt(prospectTaskStats.completed), color: '#16a34a' },
                { label: 'Upcoming', val: fmt(prospectTaskStats.upcoming), color: '#14b8a6' },
              ].map(s => (
                <div key={s.label} className="dash-mini-stat">
                  <div className="dash-mini-stat-val" style={{ color: s.color }}>{s.val}</div>
                  <div className="dash-mini-stat-label">{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Charts Row 1 ───────────────────────────────────────────── */}
        <div className="dash-charts-row">
          {/* Pipeline by Stage */}
          <div className="dash-card dash-card-wide">
            <SectionTitle icon={BarChart2}>Pipeline by Stage</SectionTitle>
            {pipeline.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={pipeline} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f4ff" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="count" name="Stories" radius={[4, 4, 0, 0]}>
                    {pipeline.map((entry, i) => (
                      <Cell key={i} fill={entry.color || CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : <div className="dash-empty">No pipeline data</div>}
          </div>

          {/* Task Status Pie */}
          <div className="dash-card">
            <SectionTitle icon={CheckSquare}>Task Status</SectionTitle>
            {taskStatusData.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={taskStatusData} cx="50%" cy="50%" innerRadius={50} outerRadius={80}
                    dataKey="value" nameKey="name" paddingAngle={2}>
                    {taskStatusData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                  <Legend iconType="circle" iconSize={10} wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            ) : <div className="dash-empty">No tasks yet</div>}
          </div>

          {/* Priority Distribution - clean custom bars */}
          <div className="dash-card">
            <SectionTitle icon={AlertCircle}>Priority Distribution</SectionTitle>
            {(() => {
              const rows = ['critical', 'high', 'medium', 'low'].map(p => ({
                p,
                stories: Number((storyPriority.find(x => x.priority === p) || {}).count || 0),
                prospects: Number((prospectPriority.find(x => x.priority === p) || {}).count || 0),
              }));
              const maxVal = Math.max(...rows.map(r => r.stories + r.prospects), 1);
              const hasData = rows.some(r => r.stories + r.prospects > 0);
              if (!hasData) return <div className="dash-empty">No data</div>;
              return (
                <div className="dash-priority-list">
                  {rows.map(({ p, stories, prospects }) => (
                    <div key={p} className="dash-priority-row">
                      <span className={`dash-priority-label dash-priority-${p}`}>{p}</span>
                      <div className="dash-priority-bar-track">
                        <div className="dash-priority-bar-fill"
                          style={{ width: `${((stories + prospects) / maxVal) * 100}%`, background: PRIORITY_COLORS[p] }} />
                      </div>
                      <div className="dash-priority-counts">
                        <span style={{ fontWeight: 600, color: '#3e72ae' }}>{stories}</span>
                        <span className="dash-priority-dot"> stories</span>
                        <span className="dash-priority-dot">·</span>
                        <span style={{ fontWeight: 600, color: '#8b5cf6' }}>{prospects}</span>
                        <span className="dash-priority-dot"> prospects</span>
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>
        </div>

        {/* ── Story Trend ────────────────────────────────────────────── */}
        {trendData.length > 0 && (
          <div className="dash-card dash-card-full">
            <SectionTitle icon={TrendingUp}>Story Creation Trend (Last 6 Months)</SectionTitle>
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={trendData} margin={{ top: 4, right: 16, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorStories" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3e72ae" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#3e72ae" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f4ff" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="Stories" stroke="#3e72ae" strokeWidth={2}
                  fill="url(#colorStories)" name="Stories Created" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* ── Bottom Row ─────────────────────────────────────────────── */}
        <div className="dash-bottom-row">
          {/* Per-user breakdown */}
          {userBreakdown.length > 0 && (
            <div className="dash-card dash-card-table">
              <SectionTitle icon={Users}>Team Members — Task Overview</SectionTitle>
              <div className="dash-table-wrap">
                <table className="dash-table">
                  <thead>
                    <tr>
                      <th>Member</th>
                      <th>Role</th>
                      <th>Story Tasks</th>
                      <th>Prospect Tasks</th>
                      <th>Overdue</th>
                      <th>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {userBreakdown.map(u => {
                      const total = Number(u.story_tasks) + Number(u.prospect_tasks);
                      const totalOverdue = Number(u.story_overdue) + Number(u.prospect_overdue);
                      return (
                        <tr key={u.id}>
                          <td>
                            <div className="dash-user-cell">
                              <div className="dash-avatar" style={{ background: '#3e72ae22', color: '#3e72ae' }}>
                                {u.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                              </div>
                              {u.name}
                            </div>
                          </td>
                          <td>
                            <span className="dash-role-badge">
                              {u.role_name === 'pre_sales_manager' ? 'Manager' : 'Executive'}
                            </span>
                          </td>
                          <td><span className="dash-num">{fmt(u.story_tasks)}</span></td>
                          <td><span className="dash-num dash-num--purple">{fmt(u.prospect_tasks)}</span></td>
                          <td>
                            {totalOverdue > 0
                              ? <span className="dash-num dash-num--red">{fmt(totalOverdue)}</span>
                              : <span style={{ color: '#16a34a', fontWeight: 600 }}>—</span>}
                          </td>
                          <td><span className="dash-num dash-num--bold">{fmt(total)}</span></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Per-team breakdown */}
          {teamBreakdown.length > 0 && (
            <div className="dash-card">
              <SectionTitle icon={Briefcase}>Teams Overview</SectionTitle>
              <div className="dash-team-list">
                {teamBreakdown.map(team => (
                  <div key={team.id} className="dash-team-item">
                    <div className="dash-team-dot" style={{ background: team.accent_color || '#3e72ae' }} />
                    <div className="dash-team-info">
                      <div className="dash-team-name">{team.name}</div>
                      <div className="dash-team-meta">
                        <span>{fmt(team.story_count)} stories</span>
                        <span>·</span>
                        <span>{fmt(team.prospect_count)} prospects</span>
                        <span>·</span>
                        <span>{fmt(team.task_count)} tasks</span>
                      </div>
                    </div>
                    <div className="dash-team-bars">
                      <div className="dash-team-bar-wrap" title={`${team.story_count} stories`}>
                        <div className="dash-team-bar" style={{ width: `${Math.min(100, (Number(team.story_count) / Math.max(1, ...teamBreakdown.map(t => Number(t.story_count)))) * 100)}%`, background: team.accent_color || '#3e72ae' }} />
                      </div>
                      <div className="dash-team-bar-wrap" title={`${team.prospect_count} prospects`}>
                        <div className="dash-team-bar" style={{ width: `${Math.min(100, (Number(team.prospect_count) / Math.max(1, ...teamBreakdown.map(t => Number(t.prospect_count)))) * 100)}%`, background: '#8b5cf6' }} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recent Activity */}
          {recentActivity.length > 0 && (
            <div className="dash-card">
              <SectionTitle icon={Activity}>Recent Activity</SectionTitle>
              <div className="dash-activity-list">
                {recentActivity.map((item, i) => (
                  <div key={i} className="dash-activity-item">
                    <div className="dash-activity-icon">{activityIcon(item.change_type)}</div>
                    <div className="dash-activity-body">
                      <span className="dash-activity-user">{item.user_name}</span>
                      <span className="dash-activity-action"> {item.change_type} </span>
                      <span className="dash-activity-story">"{item.story_title}"</span>
                    </div>
                    <div className="dash-activity-time">{timeAgo(item.created_at)}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── Task Completion Chart ─────────────────────────────────── */}
        {taskCompletion.length > 0 && (
          <div className="dash-card dash-card-full">
            <SectionTitle icon={CheckSquare}>Task Completion (Last 30 Days)</SectionTitle>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={taskCompletion} margin={{ top: 4, right: 16, left: -20, bottom: 40 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f4ff" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-30} textAnchor="end" interval={0} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="completed_30d" name="Completed" fill="#16a34a" radius={[4, 4, 0, 0]} />
                <Bar dataKey="total_assigned" name="Total Assigned" fill="#3e72ae22" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

      </div>
      </div>
    </>
  );
}
