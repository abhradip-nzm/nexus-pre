import React, { useState, useEffect } from 'react';
import { Target, CheckCircle2, Clock, AlertCircle } from 'lucide-react';
import Header from '../components/layout/Header';
import { getInitials, getAvatarColor } from '../utils/helpers';
import api from '../utils/api';
import toast from 'react-hot-toast';
import './Executives.css';

export default function Executives() {
  const [users, setUsers] = useState([]);
  const [kpis, setKpis] = useState({});
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('30');

  useEffect(() => { load(); }, [period]);

  const load = async () => {
    try {
      const res = await api.get('/users');
      const execs = (res.data.users || []).filter(u => u.role_name === 'pre_sales_executive');
      setUsers(execs);

      // Load KPIs for each executive
      const kpiData = {};
      await Promise.all(execs.map(async u => {
        try {
          const kr = await api.get(`/users/${u.id}/kpis?period=${period}`);
          kpiData[u.id] = kr.data.kpis;
        } catch {}
      }));
      setKpis(kpiData);
    } catch { toast.error('Failed to load executives'); }
    finally { setLoading(false); }
  };

  if (loading) return <div className="page-loading"><div className="page-spinner" /></div>;

  return (
    <>
      <Header title="Executives" subtitle="Pre-sales executive performance overview" />
      <div className="page-content">
        <div className="page-header">
          <h1 className="page-title">Executive Performance</h1>
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

        {users.length === 0 ? (
          <div className="card">
            <div className="card-body" style={{ textAlign: 'center', padding: '60px' }}>
              <p style={{ color: 'var(--text-muted)' }}>No pre-sales executives found.</p>
            </div>
          </div>
        ) : (
          <div className="exec-grid">
            {users.map(u => {
              const k = kpis[u.id] || {};

              return (
                <div key={u.id} className="exec-card card">
                  <div className="exec-card-header">
                    <div
                      className="avatar avatar-lg"
                      style={{ background: getAvatarColor(`${u.first_name} ${u.last_name}`), color: 'white', fontSize: '18px' }}
                    >
                      {getInitials(`${u.first_name} ${u.last_name}`)}
                    </div>
                    <div>
                      <h3 className="exec-name">{u.first_name} {u.last_name}</h3>
                      <p className="exec-email">{u.email}</p>
                      <span className={`badge ${u.is_active ? 'badge-success' : 'badge-error'}`}>
                        {u.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                  </div>

                  <div className="exec-kpis">
                    <div className="exec-kpi">
                      <div className="ek-icon" style={{ background: '#eef4fb', color: 'var(--primary)' }}>
                        <Target size={16} />
                      </div>
                      <div>
                        <div className="ek-value">{k.total_stories || 0}</div>
                        <div className="ek-label">Assigned Stories</div>
                      </div>
                    </div>
                    <div className="exec-kpi">
                      <div className="ek-icon" style={{ background: 'var(--success-light)', color: 'var(--success)' }}>
                        <CheckCircle2 size={16} />
                      </div>
                      <div>
                        <div className="ek-value">{k.completed_tasks || 0}</div>
                        <div className="ek-label">Completed Tasks</div>
                      </div>
                    </div>
                    <div className="exec-kpi">
                      <div className="ek-icon" style={{ background: '#fef3c7', color: '#d97706' }}>
                        <Clock size={16} />
                      </div>
                      <div>
                        <div className="ek-value">{k.in_progress_tasks || 0}</div>
                        <div className="ek-label">In Progress</div>
                      </div>
                    </div>
                    <div className="exec-kpi">
                      <div className="ek-icon" style={{ background: '#fef2f2', color: 'var(--error)' }}>
                        <AlertCircle size={16} />
                      </div>
                      <div>
                        <div className="ek-value">{k.overdue_tasks || 0}</div>
                        <div className="ek-label">Overdue Tasks</div>
                      </div>
                    </div>
                  </div>

                  <div className="exec-stats-row">
                    <div className="exec-stat">
                      <span className="es-label">Stories ({period}d)</span>
                      <span className="es-value" style={{ color: 'var(--primary)' }}>{k.total_stories || 0}</span>
                    </div>
                    <div className="exec-stat">
                      <span className="es-label">Done</span>
                      <span className="es-value" style={{ color: 'var(--success)' }}>{k.completed_tasks || 0}</span>
                    </div>
                    <div className="exec-stat">
                      <span className="es-label">Overdue</span>
                      <span className="es-value" style={{ color: 'var(--error)' }}>{k.overdue_tasks || 0}</span>
                    </div>
                  </div>

                  {(k.completed_tasks > 0 || k.in_progress_tasks > 0 || k.overdue_tasks > 0) && (() => {
                    const total = (k.completed_tasks || 0) + (k.in_progress_tasks || 0) + (k.overdue_tasks || 0);
                    const completedPct = total > 0 ? Math.round((k.completed_tasks / total) * 100) : 0;
                    return (
                      <div className="exec-progress-section">
                        <div className="exec-progress-bar">
                          <div
                            className="exec-progress-fill"
                            style={{ width: `${completedPct}%` }}
                          />
                        </div>
                        <span className="exec-progress-label">{completedPct}% tasks completed</span>
                      </div>
                    );
                  })()}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
