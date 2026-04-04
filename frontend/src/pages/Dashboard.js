import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend
} from 'recharts';
import {
  TrendingUp, TrendingDown, Users, Target, DollarSign,
  Calendar, Clock, ArrowRight, Activity, Briefcase
} from 'lucide-react';
import Header from '../components/layout/Header';
import { useAuth } from '../contexts/AuthContext';
import { formatCurrency, formatDate, formatTime, getInitials, getAvatarColor, timeAgo } from '../utils/helpers';
import api from '../utils/api';
import './Dashboard.css';

const COLORS = ['#3e72ae', '#6b5ea8', '#e67e22', '#27ae60', '#e74c3c', '#7f8c8d'];

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div style={{
        background: 'white', border: '1px solid #e2e8f0', borderRadius: 8,
        padding: '10px 14px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
      }}>
        <p style={{ fontSize: 12, color: '#718096', marginBottom: 4 }}>{label}</p>
        {payload.map((p, i) => (
          <p key={i} style={{ fontSize: 13, fontWeight: 600, color: p.color }}>
            {p.name}: {p.value}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

export default function Dashboard() {
  const { user, isManager } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('30');

  useEffect(() => {
    loadDashboard();
  }, [period]);

  const loadDashboard = async () => {
    try {
      const res = await api.get(`/dashboard?period=${period}`);
      setData(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return (
    <div className="page-loading">
      <div className="page-spinner" />
      <p>Loading dashboard...</p>
    </div>
  );

  const kpis = data?.kpis || {};
  const pipeline = data?.pipeline || [];
  const trend = data?.trend || [];
  const activity = data?.recentActivity || [];
  const upcomingMeetings = data?.upcomingMeetings || [];
  const teamPerf = data?.teamPerformance || [];

  const winRate = kpis.total_stories > 0
    ? Math.round((kpis.won / kpis.total_stories) * 100)
    : 0;

  const statCards = [
    {
      label: 'Total Pipeline',
      value: formatCurrency(kpis.pipeline_value),
      icon: DollarSign,
      color: '#3e72ae',
      bg: '#eef4fb',
      sub: `${kpis.total_stories || 0} active deals`
    },
    {
      label: 'Won Revenue',
      value: formatCurrency(kpis.won_value),
      icon: TrendingUp,
      color: '#27ae60',
      bg: '#e8f5eb',
      sub: `${kpis.won || 0} deals closed`
    },
    {
      label: 'Win Rate',
      value: `${winRate}%`,
      icon: Target,
      color: '#6b5ea8',
      bg: '#f0eef8',
      sub: `${kpis.new_this_period || 0} new this period`
    },
    {
      label: 'Today\'s Meetings',
      value: kpis.today_meetings || 0,
      icon: Calendar,
      color: '#e67e22',
      bg: '#fef3ea',
      sub: `${kpis.upcoming_meetings || 0} upcoming`
    },
  ];

  const getChangeLabel = (label) => {
    const map = {
      title: 'Renamed', client_name: 'Client updated', column_id: 'Stage changed',
      assigned_to: 'Reassigned', estimated_value: 'Value updated'
    };
    return map[label] || 'Updated';
  };

  return (
    <>
      <Header
        title={`Good ${new Date().getHours() < 12 ? 'Morning' : new Date().getHours() < 17 ? 'Afternoon' : 'Evening'}, ${user?.first_name}`}
        subtitle="Here's what's happening with your pre-sales pipeline"
      />
      <div className="page-content">
        {/* Period selector */}
        <div className="dashboard-period">
          <div className="page-header" style={{ marginBottom: 0 }}>
            <div>
              <h1 className="page-title">Dashboard</h1>
              <p className="page-subtitle">Pre-sales performance overview</p>
            </div>
            <div className="period-tabs">
              {['7', '30', '90'].map(p => (
                <button
                  key={p}
                  className={`period-tab ${period === p ? 'active' : ''}`}
                  onClick={() => setPeriod(p)}
                >
                  {p}d
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="kpi-grid">
          {statCards.map((stat, i) => (
            <div className="stat-card" key={i}>
              <div className="stat-card-inner">
                <div>
                  <div className="stat-label">{stat.label}</div>
                  <div className="stat-value" style={{ color: stat.color }}>{stat.value}</div>
                  <div className="stat-sub">{stat.sub}</div>
                </div>
                <div className="stat-icon" style={{ background: stat.bg, color: stat.color }}>
                  <stat.icon size={22} />
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="dashboard-grid">
          {/* Pipeline by Stage */}
          <div className="card dashboard-chart-card">
            <div className="card-header">
              <div>
                <h3 className="card-title">Pipeline by Stage</h3>
                <p className="card-subtitle">Deal distribution across stages</p>
              </div>
            </div>
            <div className="card-body">
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={pipeline} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f2f5" />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#718096' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#718096' }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="count" fill="#3e72ae" radius={[4, 4, 0, 0]} name="Deals" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Trend */}
          <div className="card dashboard-chart-card">
            <div className="card-header">
              <div>
                <h3 className="card-title">New Leads Trend</h3>
                <p className="card-subtitle">Last 30 days</p>
              </div>
            </div>
            <div className="card-body">
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={trend} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3e72ae" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#3e72ae" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f2f5" />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#718096' }}
                    tickFormatter={d => d ? d.slice(5) : ''} />
                  <YAxis tick={{ fontSize: 11, fill: '#718096' }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="count" stroke="#3e72ae" strokeWidth={2}
                    fill="url(#colorCount)" name="New Leads" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Pipeline Distribution */}
          <div className="card">
            <div className="card-header">
              <div>
                <h3 className="card-title">Stage Distribution</h3>
                <p className="card-subtitle">By deal count</p>
              </div>
            </div>
            <div className="card-body">
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie
                    data={pipeline.filter(p => p.count > 0)}
                    cx="50%" cy="50%"
                    innerRadius={50} outerRadius={80}
                    dataKey="count"
                    nameKey="name"
                    paddingAngle={2}
                  >
                    {pipeline.map((entry, index) => (
                      <Cell key={index} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v, n) => [v, n]} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Upcoming Meetings */}
          <div className="card">
            <div className="card-header">
              <div>
                <h3 className="card-title">Upcoming Meetings</h3>
                <p className="card-subtitle">Next 7 days</p>
              </div>
              <Link to="/calendar" className="btn btn-ghost btn-sm">
                View all <ArrowRight size={14} />
              </Link>
            </div>
            <div className="card-body" style={{ padding: '8px 0' }}>
              {upcomingMeetings.length === 0 ? (
                <div className="empty-state-sm">
                  <Calendar size={32} color="#e2e8f0" />
                  <p>No upcoming meetings</p>
                </div>
              ) : (
                upcomingMeetings.map(meeting => (
                  <div key={meeting.id} className="meeting-item">
                    <div className="meeting-time">
                      <div className="meeting-date">{formatDate(meeting.start_time, 'MMM d')}</div>
                      <div className="meeting-hour">{formatTime(meeting.start_time)}</div>
                    </div>
                    <div className="meeting-info">
                      <div className="meeting-title">{meeting.title}</div>
                      {meeting.client_company && (
                        <div className="meeting-company">{meeting.client_company}</div>
                      )}
                    </div>
                    {meeting.meeting_link && (
                      <a href={meeting.meeting_link} target="_blank" rel="noreferrer"
                        className="btn btn-primary btn-sm">
                        Join
                      </a>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Recent Activity */}
          <div className="card dashboard-activity">
            <div className="card-header">
              <div>
                <h3 className="card-title">Recent Activity</h3>
                <p className="card-subtitle">Latest pipeline updates</p>
              </div>
            </div>
            <div className="card-body" style={{ padding: '8px 0' }}>
              {activity.length === 0 ? (
                <div className="empty-state-sm">
                  <Activity size={32} color="#e2e8f0" />
                  <p>No recent activity</p>
                </div>
              ) : (
                activity.map(log => (
                  <div key={log.id} className="activity-item">
                    <div
                      className="avatar avatar-sm"
                      style={{ background: getAvatarColor(log.user_name), color: 'white', fontSize: '10px', flexShrink: 0 }}
                    >
                      {getInitials(log.user_name)}
                    </div>
                    <div className="activity-content">
                      <div className="activity-text">
                        <strong>{log.user_name}</strong>
                        {' '}{log.field_name ? getChangeLabel(log.field_name) : 'updated'}{' '}
                        <Link to={`/kanban?story=${log.story_id}`} className="activity-link">
                          {log.story_title}
                        </Link>
                      </div>
                      <div className="activity-time">{timeAgo(log.created_at)}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Team Performance */}
          {isManager() && teamPerf.length > 0 && (
            <div className="card">
              <div className="card-header">
                <div>
                  <h3 className="card-title">Team Performance</h3>
                  <p className="card-subtitle">Executive leaderboard</p>
                </div>
                <Link to="/executives" className="btn btn-ghost btn-sm">
                  View all <ArrowRight size={14} />
                </Link>
              </div>
              <div className="card-body" style={{ padding: '8px 0' }}>
                {teamPerf.map((member, i) => (
                  <div key={member.id} className="team-item">
                    <span className="team-rank">#{i + 1}</span>
                    <div
                      className="avatar avatar-sm"
                      style={{ background: getAvatarColor(member.name), color: 'white', fontSize: '10px' }}
                    >
                      {getInitials(member.name)}
                    </div>
                    <div className="team-info">
                      <div className="team-name">{member.name}</div>
                      <div className="team-stats">{member.won} won · {member.total_stories} total</div>
                    </div>
                    <div className="team-value">{formatCurrency(member.won_value)}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
