import React, { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, X, Users } from 'lucide-react';
import Header from '../components/layout/Header';
import api from '../utils/api';
import toast from 'react-hot-toast';
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
  const [form, setForm] = useState({ name: '', purpose: '', accent_color: '#3e72ae', member_ids: [] });

  useEffect(() => {
    loadData();
  }, []);

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
    setForm({ name: '', purpose: '', accent_color: '#3e72ae', member_ids: [] });
    setShowModal(true);
  };

  const openEdit = (team) => {
    setEditTeam(team);
    setForm({
      name: team.name,
      purpose: team.purpose || '',
      accent_color: team.accent_color || '#3e72ae',
      member_ids: (team.members || []).map(m => m.id),
    });
    setShowModal(true);
  };

  const saveTeam = async () => {
    if (!form.name.trim()) return toast.error('Team name is required');
    try {
      if (editTeam) {
        const res = await api.put(`/teams/${editTeam.id}`, form);
        setTeams(prev => prev.map(t => t.id === editTeam.id ? res.data.team : t));
        toast.success('Team updated');
      } else {
        const res = await api.post('/teams', form);
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

  const toggleMember = (userId) => {
    setForm(prev => ({
      ...prev,
      member_ids: prev.member_ids.includes(userId)
        ? prev.member_ids.filter(id => id !== userId)
        : [...prev.member_ids, userId]
    }));
  };

  if (loading) return (
    <div className="page-loading"><div className="page-spinner" /><p>Loading teams...</p></div>
  );

  return (
    <>
      <Header title="Team Management" subtitle="Organize users into teams with purpose and color" />
      <div className="page-content admin-teams-page">

        <div className="teams-header">
          <div className="teams-count">{teams.length} team{teams.length !== 1 ? 's' : ''}</div>
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
            {teams.map(team => (
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

                  {team.purpose && (
                    <p className="team-purpose">{team.purpose}</p>
                  )}

                  <div className="team-members">
                    <div className="members-avatars">
                      {(team.members || []).slice(0, 6).map((m, i) => (
                        <div
                          key={m.id}
                          className="member-avatar"
                          style={{ background: getAvatarColor(m.full_name), color: 'white', fontSize: '11px', zIndex: 10 - i }}
                          title={m.full_name}
                        >
                          {getInitials(m.full_name)}
                        </div>
                      ))}
                      {(team.members || []).length > 6 && (
                        <div className="member-avatar overflow" title={`+${team.members.length - 6} more`}>
                          +{team.members.length - 6}
                        </div>
                      )}
                    </div>
                    <span className="members-count">{(team.members || []).length} member{(team.members || []).length !== 1 ? 's' : ''}</span>
                  </div>
                </div>
              </div>
            ))}
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
                <label>Team Name</label>
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
              <div className="form-group">
                <label>Members ({form.member_ids.length} selected)</label>
                <div className="members-select-list">
                  {allUsers.map(u => (
                    <div
                      key={u.id}
                      className={`member-select-item ${form.member_ids.includes(u.id) ? 'selected' : ''}`}
                      onClick={() => toggleMember(u.id)}
                    >
                      <div
                        className="avatar"
                        style={{ background: getAvatarColor(`${u.first_name} ${u.last_name}`), color: 'white', fontSize: '11px', width: 28, height: 28, flexShrink: 0 }}
                      >
                        {getInitials(`${u.first_name} ${u.last_name}`)}
                      </div>
                      <div className="member-info">
                        <div className="member-name">{u.first_name} {u.last_name}</div>
                        <div className="member-role">{u.role_display_name || u.role_name}</div>
                      </div>
                      {form.member_ids.includes(u.id) && (
                        <div className="member-check"><X size={11} /></div>
                      )}
                    </div>
                  ))}
                  {allUsers.length === 0 && (
                    <p style={{ color: 'var(--text-muted)', fontSize: 13, padding: '12px', textAlign: 'center' }}>No users available</p>
                  )}
                </div>
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
