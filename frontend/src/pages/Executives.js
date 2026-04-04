import React, { useState, useEffect } from 'react';
import { TrendingUp, Target, DollarSign, Calendar } from 'lucide-react';
import Header from '../components/layout/Header';
import { formatCurrency, getInitials, getAvatarColor } from '../utils/helpers';
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

      // Load KPIs for each
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
              const winRate = k.total_stories > 0 ? Math.round((k.won / k.total_stories) * 100) : 0;

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
                        <div className="ek-label">Total Deals</div>
                      </div>
                    </div>
                    <div className="exec-kpi">
                      <div className="ek-icon" style={{ background: 'var(--success-light)', color: 'var(--success)' }}>
                        <TrendingUp size={16} />
                      </div>
                      <div>
                        <div className="ek-value">{winRate}%</div>
                        <div className="ek-label">Win Rate</div>
                      </div>
                    </div>
                    <div className="exec-kpi">
                      <div className="ek-icon" style={{ background: '#fef3c7', color: '#d97706' }}>
                        <DollarSign size={16} />
                      </div>
                      <div>
                        <div className="ek-value">{formatCurrency(k.total_revenue)}</div>
                        <div className="ek-label">Revenue Won</div>
                      </div>
                    </div>
                    <div className="exec-kpi">
                      <div className="ek-icon" style={{ background: '#f0eef8', color: '#6b5ea8' }}>
                        <Calendar size={16} />
                      </div>
                      <div>
                        <div className="ek-value">{k.total_meetings || 0}</div>
                        <div className="ek-label">Meetings</div>
                      </div>
                    </div>
                  </div>

                  <div className="exec-stats-row">
                    <div className="exec-stat">
                      <span className="es-label">Won</span>
                      <span className="es-value" style={{ color: 'var(--success)' }}>{k.won || 0}</span>
                    </div>
                    <div className="exec-stat">
                      <span className="es-label">Lost</span>
                      <span className="es-value" style={{ color: 'var(--error)' }}>{k.lost || 0}</span>
                    </div>
                    <div className="exec-stat">
                      <span className="es-label">Dark</span>
                      <span className="es-value" style={{ color: 'var(--text-muted)' }}>{k.dark_leads || 0}</span>
                    </div>
                  </div>

                  {k.total_stories > 0 && (
                    <div className="exec-progress-section">
                      <div className="exec-progress-bar">
                        <div
                          className="exec-progress-fill"
                          style={{ width: `${winRate}%` }}
                        />
                      </div>
                      <span className="exec-progress-label">{winRate}% win rate</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
