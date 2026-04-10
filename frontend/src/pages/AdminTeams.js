import React, { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, X, Users, UserCheck, Crown, Download } from 'lucide-react';
import Header from '../components/layout/Header';
import api from '../utils/api';
import { formatRoleName } from '../utils/helpers';
import toast from 'react-hot-toast';
import { exportToExcel } from '../utils/exportExcel';
import './AdminTeams.css';

const ACCENT_COLORS = [
  '#3e72ae', '#e74c3c', '#27ae60', '#f39c12', '#8e44ad',
  '#16a085', '#2c3e50', '#d35400', '#c0392b', '#1abc9c'
];

function getInitials(name) {
  if (!name) return '?';
  const parts = name.trim().split(' ');
  return parts.length > 1 ? `${parts[0][0]}${parts[1][0]}`.toUpperCase() : name[0].toUpperCase();
}

function getAvatarColor(name) {
  const colors = ['#3e72ae', '#e74c3c', '#27ae60', '#f39c12', '#8e44ad'];
  let hash = 0;
  for (let i = 0; i < (name || '').length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

export default function AdminTeams() {
  const [teams, setTeams] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editTeam, setEditTeam] = useState(null);
  const emptyForm = { name: '', purpose: '', accent_color: '#3e72ae', manager_id: '', executive_ids: [] };
  const [form, setForm] = useState(emptyForm);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const [teamsRes, usersRes] = await Promise.all([
        api.get('/teams'),
        api.get('/users'),
      ]);
      setTeams(teamsRes.data.teams || []);
      setAllUsers(usersRes.data.users || []);
    } catch (err) {
      toast.error('Failed to load teams');
    } finally {
      setLoading(false);
    }
  };

  const openCreate = () => {
    setEditTeam(null);
    setForm(emptyForm);
    setShowModal(true);
  };

  const openEdit = (team) => {
    setEditTeam(team);
    const members = team.members || [];
    const manager = members.find(m => m.role_name === 'pre_sales_manager');
    const executives = members.filter(m => m.role_name === 'pre_sales_executive');
    setForm({
      name: team.name,
      purpose: team.purpose || '',
      accent_color: team.accent_color || '#3e72ae',
      manager_id: manager?.id || '',
      executive_ids: executives.map(e => e.id),
    });
    setShowModal(true);
  };

  const saveTeam = async () => {
    if (!form.name.trim()) return toast.error('Team name is required');
    try {
      const payload = {
        name: form.name,
        purpose: form.purpose,
        accent_color: form.accent_color,
        manager_id: form.manager_id || null,
        executive_ids: form.executive_ids,
      };
      if (editTeam) {
        const res = await api.put(`/teams/${editTeam.id}`, payload);
        setTeams(prev => prev.map(t => t.id === editTeam.id ? res.data.team : t));
        toast.success('Team updated');
      } else {
        const res = await api.post('/teams', payload);
        setTeams(prev => [...prev, res.data.team]);
        toast.success('Team created');
      }
      setShowModal(false);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save team');
    }
  };

  const deleteTeam = async (team) => {
    if (!window.confirm(`Delete team "${team.name}"?`)) return;
    try {
      await api.delete(`/teams/${team.id}`);
      setTeams(prev => prev.filter(t => t.id !== team.id));
      toast.success('Team deleted');
    } catch (err) {
      toast.error('Failed to delete team');
    }
  };

  const toggleExecutive = (userId) => {
    setForm(prev => ({
      ...prev,
      executive_ids: prev.executive_ids.includes(userId)
        ? prev.executive_ids.filter(id => id !== userId)
        : [...prev.executive_ids, userId]
    }));
  };

  // Filter users by role for the selectors
  const managers = allUsers.filter(u => u.role_name === 'pre_sales_manager');
  const executives = allUsers.filter(u => u.role_name === 'pre_sales_executive');

  // Determine which managers/executives are already in other teams (for warning display)
  const busyManagers = new Set();
  const busyExecutives = new Set();
  teams.forEach(t => {
    if (editTeam && t.id === editTeam.id) return; // skip current team
    (t.members || []).forEach(m => {
      if (m.role_name === 'pre_sales_manager') busyManagers.add(m.id);
      if (m.role_name === 'pre_sales_executive') busyExecutives.add(m.id);
    });
  });

  if (loading) return (
    <div className="page-loading"><div className="page-spinner" /><p>Loading teams...</p></div>
  );

  return (
    <>
      <Header title="Team Management" subtitle="Organize users into teams with a manager and executives" />
      <div className="page-content admin-teams-page">

        <div className="teams-header">
          <div className="teams-count">{teams.length} team{teams.length !== 1 ? 's' : ''}</div>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => {
              const data = teams.map(t => ({
                'Team Name': t.name,
                'Members Count': (t.members || []).length,
                'Created': t.created_at ? new Date(t.created_at).toLocaleDateString() : '',
              }));
              exportToExcel(data, 'teams');
            }}
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <Download size={15} /> Export Excel
          </button>
          <button className="btn btn-primary btn-sm" onClick={openCreate}>
            <Plus size={14} /> Create Team
          </button>
        </div>

        {teams.length === 0 ? (
          <div className="teams-empty">
            <Users size={40} />
            <h3>No teams yet</h3>
            <p>Create teams to organize your users</p>
            <button className="btn btn-primary" onClick={openCreate}><Plus size={14} /> Create Team</button>
          </div>
        ) : (
          <div className="teams-grid">
            {teams.map(team => {
              const manager = (team.members || []).find(m => m.role_name === 'pre_sales_manager');
              const execs = (team.members || []).filter(m => m.role_name === 'pre_sales_executive');
              return (
                <div key={team.id} className="team-card">
                  <div className="team-card-top" style={{ background: team.accent_color || '#3e72ae' }} />
                  <div className="team-card-body">
                    <div className="team-card-head">
                      <h3 className="team-name">{team.name}</h3>
                      <div className="team-actions">
                        <button className="btn-icon-sm" onClick={() => openEdit(team)} title="Edit">
                          <Pencil size={13} />
                        </button>
                        <button className="btn-icon-sm danger" onClick={() => deleteTeam(team)} title="Delete">
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>

                    {team.purpose && <p className="team-purpose">{team.purpose}</p>}

                    {manager && (
                      <div className="team-manager-row">
                        <Crown size={12} />
                        <span className="team-manager-name">{manager.full_name}</span>
                        <span className="team-manager-role">Manager</span>
                      </div>
                    )}

                    <div className="team-members">
                      <div className="members-avatars">
                        {execs.slice(0, 5).map((m, i) => (
                          <div
                            key={m.id}
                            className="member-avatar"
                            style={{ background: getAvatarColor(m.full_name), color: 'white', fontSize: '11px', zIndex: 10 - i }}
                            title={m.full_name}
                          >
                            {getInitials(m.full_name)}
                          </div>
                        ))}
                        {execs.length > 5 && (
                          <div className="member-avatar overflow" title={`+${execs.length - 5} more`}>
                            +{execs.length - 5}
                          </div>
                        )}
                      </div>
                      <span className="members-count">{execs.length} executive{execs.length !== 1 ? 's' : ''}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Team Modal */}
      {showModal && (
        <div className="modal-backdrop" onClick={() => setShowModal(false)}>
          <div className="modal-box team-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editTeam ? 'Edit Team' : 'Create Team'}</h3>
              <button className="modal-close" onClick={() => setShowModal(false)}><X size={18} /></button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>Team Name <span className="req">*</span></label>
                <input
                  className="form-input"
                  placeholder="e.g. Enterprise Sales"
                  value={form.name}
                  onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                />
              </div>
              <div className="form-group">
                <label>Purpose</label>
                <textarea
                  className="form-input"
                  placeholder="What does this team focus on?"
                  value={form.purpose}
                  onChange={e => setForm(p => ({ ...p, purpose: e.target.value }))}
                  rows={2}
                />
              </div>
              <div className="form-group">
                <label>Accent Color</label>
                <div className="color-swatches">
                  {ACCENT_COLORS.map(color => (
                    <button
                      key={color}
                      className={`color-swatch ${form.accent_color === color ? 'selected' : ''}`}
                      style={{ background: color }}
                      onClick={() => setForm(p => ({ ...p, accent_color: color }))}
                    />
                  ))}
                </div>
              </div>

              {/* Pre-Sales Manager */}
              <div className="form-group">
                <label className="team-section-label">
                  <Crown size={13} /> Pre-Sales Manager
                  <span className="team-section-hint">One per team</span>
                </label>
                <select
                  className="form-input"
                  value={form.manager_id}
                  onChange={e => setForm(p => ({ ...p, manager_id: e.target.value }))}
                >
                  <option value="">— No manager assigned —</option>
                  {managers.map(u => (
                    <option key={u.id} value={u.id} disabled={busyManagers.has(u.id)}>
                      {u.first_name} {u.last_name}{busyManagers.has(u.id) ? ' (in another team)' : ''}
                    </option>
                  ))}
                </select>
                {managers.length === 0 && (
                  <p className="team-no-users-hint">No Pre-Sales Managers found in the system.</p>
                )}
              </div>

              {/* Pre-Sales Executives */}
              <div className="form-group">
                <label className="team-section-label">
                  <UserCheck size={13} /> Pre-Sales Executives
                  <span className="team-section-hint">{form.executive_ids.length} selected</span>
                </label>
                {executives.length === 0 ? (
                  <p className="team-no-users-hint">No Pre-Sales Executives found in the system.</p>
                ) : (
                  <div className="members-select-list">
                    {executives.map(u => {
                      const busy = busyExecutives.has(u.id);
                      const selected = form.executive_ids.includes(u.id);
                      return (
                        <div
                          key={u.id}
                          className={`member-select-item ${selected ? 'selected' : ''} ${busy ? 'busy' : ''}`}
                          onClick={() => !busy && toggleExecutive(u.id)}
                        >
                          <div
                            className="avatar"
                            style={{ background: getAvatarColor(`${u.first_name} ${u.last_name}`), color: 'white', fontSize: '11px', width: 28, height: 28, flexShrink: 0 }}
                          >
                            {getInitials(`${u.first_name} ${u.last_name}`)}
                          </div>
                          <div className="member-info">
                            <div className="member-name">{u.first_name} {u.last_name}</div>
                            <div className="member-role">
                              {busy ? (
                                <span className="member-busy-tag">Already in another team</span>
                              ) : (
                                formatRoleName(u.role_name)
                              )}
                            </div>
                          </div>
                          {selected && !busy && (
                            <div className="member-check"><X size={11} /></div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={saveTeam}>{editTeam ? 'Save Changes' : 'Create Team'}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
