import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Plus, Search, X, Trash2, Pencil, Check, Briefcase,
  Calendar, Users, User, ExternalLink, ChevronDown, Flag,
  Clock, AlertCircle, CheckSquare, CalendarCheck, Download
} from 'lucide-react';
import Header from '../components/layout/Header';
import api from '../utils/api';
import toast from 'react-hot-toast';
import { formatDate } from '../utils/helpers';
import { exportToExcel } from '../utils/exportExcel';
import './AdHocTasks.css';

const PRIORITIES = ['low', 'medium', 'high', 'critical'];
const PRIORITY_COLORS = { critical: '#dc3545', high: '#e67e22', medium: '#f59e0b', low: '#28a745' };
const STATUS_LABELS = { todo: 'To Do', in_progress: 'In Progress', done: 'Done' };
const BT_ROLE_LABELS = { cgo: 'CGO', asd: 'ASD', sales_manager: 'Sales Manager', sales_executive: 'Sales Executive' };
const BT_ROLE_ORDER = ['cgo', 'asd', 'sales_manager', 'sales_executive'];

// ── Task Form Modal ───────────────────────────────────────────────────────────
function AdHocTaskModal({ task, onClose, onSaved, businessTeam, teams, assignableUsers, stories, prospects }) {
  const isEdit = !!task;

  const [form, setForm] = useState({
    title: task?.title || '',
    description: task?.description || '',
    status: task?.status || 'todo',
    priority: task?.priority || 'medium',
    start_date: task?.start_date ? task.start_date.slice(0, 10) : '',
    due_date: task?.due_date ? task.due_date.slice(0, 10) : '',
    business_team_member_id: task?.business_team_member_id || '',
    story_id: task?.story_id || '',
    prospect_id: task?.prospect_id || '',
    link_type: task?.story_id ? 'story' : task?.prospect_id ? 'prospect' : 'none',
    assignment_type: (task?.team_assignments?.length > 0) ? 'team'
      : (task?.member_assignments?.length > 0) ? 'member' : '',
    team_ids: (task?.team_assignments || []).map(t => t.team_id),
    member_ids: (task?.member_assignments || []).map(m => m.user_id),
  });
  const [saving, setSaving] = useState(false);

  const set = (field, val) => setForm(p => ({ ...p, [field]: val }));

  const toggleTeam = (id) => {
    setForm(p => ({
      ...p, assignment_type: 'team', member_ids: [],
      team_ids: p.team_ids.includes(id) ? p.team_ids.filter(x => x !== id) : [...p.team_ids, id],
    }));
  };
  const toggleMember = (id) => {
    setForm(p => ({
      ...p, assignment_type: 'member', team_ids: [],
      member_ids: p.member_ids.includes(id) ? p.member_ids.filter(x => x !== id) : [...p.member_ids, id],
    }));
  };
  const setAssignType = (type) => {
    setForm(p => ({ ...p, assignment_type: type, team_ids: type === 'member' ? [] : p.team_ids, member_ids: type === 'team' ? [] : p.member_ids }));
  };

  // Group BT members by role
  const btByRole = BT_ROLE_ORDER.reduce((acc, role) => {
    const members = businessTeam.filter(m => m.role === role);
    if (members.length) acc[role] = members;
    return acc;
  }, {});

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) { toast.error('Title is required'); return; }
    setSaving(true);
    try {
      const payload = {
        title: form.title.trim(),
        description: form.description || null,
        status: form.status,
        priority: form.priority,
        start_date: form.start_date || null,
        due_date: form.due_date || null,
        business_team_member_id: form.business_team_member_id || null,
        story_id: form.link_type === 'story' ? (form.story_id || null) : null,
        prospect_id: form.link_type === 'prospect' ? (form.prospect_id || null) : null,
        team_ids: form.assignment_type !== 'member' ? form.team_ids : [],
        member_ids: form.assignment_type === 'member' ? form.member_ids : [],
      };
      let res;
      if (isEdit) {
        res = await api.put(`/adhoc-tasks/${task.id}`, payload);
        toast.success('Task updated!');
      } else {
        res = await api.post('/adhoc-tasks', payload);
        toast.success('Task created!');
      }
      onSaved(res.data.task);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save task');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal modal-xl">
        <div className="modal-header">
          <h2 className="modal-title">{isEdit ? 'Edit Ad-Hoc Task' : 'New Ad-Hoc Task'}</h2>
          <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} style={{ display: 'contents' }}>
          <div className="modal-body">
            <div className="adhoc-form-grid">

              {/* Left — main fields */}
              <div className="adhoc-form-main">
                <div className="form-group">
                  <label className="form-label">Title *</label>
                  <input className="form-control" value={form.title} onChange={e => set('title', e.target.value)}
                    placeholder="Describe the task…" autoFocus />
                </div>
                <div className="form-group">
                  <label className="form-label">Description</label>
                  <textarea className="form-control" value={form.description}
                    onChange={e => set('description', e.target.value)} rows={3}
                    placeholder="Any additional context or notes…" />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Start Date</label>
                    <input type="date" className="form-control" value={form.start_date}
                      onChange={e => set('start_date', e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Due Date</label>
                    <input type="date" className="form-control" value={form.due_date}
                      onChange={e => set('due_date', e.target.value)} />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Priority</label>
                  <div className="priority-selector">
                    {PRIORITIES.map(p => (
                      <button key={p} type="button"
                        className={`priority-btn ${form.priority === p ? 'active' : ''} priority-${p}`}
                        onClick={() => set('priority', p)}>{p}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Status</label>
                  <select className="form-control" value={form.status} onChange={e => set('status', e.target.value)}>
                    {Object.entries(STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </div>

                {/* Link to Story or Prospect */}
                <div className="form-group">
                  <label className="form-label">Link To</label>
                  <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                    {['none', 'story', 'prospect'].map(type => (
                      <button key={type} type="button"
                        className={`btn btn-sm ${form.link_type === type ? 'btn-primary' : 'btn-secondary'}`}
                        style={{ flex: 1, fontSize: 12, textTransform: 'capitalize' }}
                        onClick={() => set('link_type', type)}>
                        {type === 'none' ? 'None' : type === 'story' ? '📋 Story' : '🔍 Prospect'}
                      </button>
                    ))}
                  </div>
                  {form.link_type === 'story' && (
                    <select className="form-control" value={form.story_id} onChange={e => set('story_id', e.target.value)}>
                      <option value="">Select a story…</option>
                      {stories.map(s => <option key={s.id} value={s.id}>{s.title}{s.client_company ? ` — ${s.client_company}` : ''}</option>)}
                    </select>
                  )}
                  {form.link_type === 'prospect' && (
                    <select className="form-control" value={form.prospect_id} onChange={e => set('prospect_id', e.target.value)}>
                      <option value="">Select a prospect…</option>
                      {prospects.map(p => <option key={p.id} value={p.id}>{p.title}{p.company_name ? ` — ${p.company_name}` : ''}</option>)}
                    </select>
                  )}
                  {form.link_type === 'story' && form.story_id && (
                    <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                      If this prospect is later promoted to a story, the link will automatically follow.
                    </p>
                  )}
                  {form.link_type === 'prospect' && form.prospect_id && (
                    <p style={{ fontSize: 11, color: 'var(--primary)', marginTop: 4 }}>
                      ✓ If this prospect is promoted to a story, the link will automatically carry over.
                    </p>
                  )}
                </div>
              </div>

              {/* Right — BT + assignment */}
              <div className="adhoc-form-side">
                <div className="form-group">
                  <label className="form-label"><Briefcase size={12} /> BT Member</label>
                  <select className="form-control" value={form.business_team_member_id}
                    onChange={e => set('business_team_member_id', e.target.value)}>
                    <option value="">None</option>
                    {BT_ROLE_ORDER.filter(r => btByRole[r]).map(role => (
                      <optgroup key={role} label={BT_ROLE_LABELS[role]}>
                        {btByRole[role].map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                      </optgroup>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Assignment</label>
                  <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                    <button type="button"
                      className={`btn btn-sm ${form.assignment_type !== 'member' ? 'btn-primary' : 'btn-secondary'}`}
                      style={{ flex: 1, fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}
                      onClick={() => setAssignType('team')}>
                      <Users size={11} /> Teams
                    </button>
                    <button type="button"
                      className={`btn btn-sm ${form.assignment_type === 'member' ? 'btn-primary' : 'btn-secondary'}`}
                      style={{ flex: 1, fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}
                      onClick={() => setAssignType('member')}>
                      <User size={11} /> Members
                    </button>
                  </div>
                  {form.assignment_type !== 'member' && teams.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {teams.map(team => (
                        <button key={team.id} type="button" onClick={() => toggleTeam(team.id)}
                          style={{
                            padding: '4px 12px', borderRadius: 20, border: '1.5px solid', fontSize: 12,
                            cursor: 'pointer', fontWeight: 500,
                            background: form.team_ids.includes(team.id) ? (team.accent_color || '#3e72ae') : 'white',
                            borderColor: form.team_ids.includes(team.id) ? (team.accent_color || '#3e72ae') : 'var(--border)',
                            color: form.team_ids.includes(team.id) ? 'white' : 'var(--text-primary)',
                          }}>{team.name}</button>
                      ))}
                    </div>
                  )}
                  {form.assignment_type === 'member' && assignableUsers.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {assignableUsers.map(u => (
                        <button key={u.id} type="button" onClick={() => toggleMember(u.id)}
                          style={{
                            padding: '4px 12px', borderRadius: 20, border: '1.5px solid', fontSize: 12,
                            cursor: 'pointer', fontWeight: 500,
                            background: form.member_ids.includes(u.id) ? '#3e72ae' : 'white',
                            borderColor: form.member_ids.includes(u.id) ? '#3e72ae' : 'var(--border)',
                            color: form.member_ids.includes(u.id) ? 'white' : 'var(--text-primary)',
                          }}>{u.first_name} {u.last_name}</button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? <span className="btn-spinner" /> : <Check size={15} />}
              {saving ? 'Saving…' : isEdit ? 'Update Task' : 'Create Task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Complete Task Modal ───────────────────────────────────────────────────────
function CompleteModal({ task, onClose, onDone }) {
  const [details, setDetails] = useState('');
  const [saving, setSaving] = useState(false);

  const handleConfirm = async () => {
    if (!details.trim()) return;
    setSaving(true);
    try {
      await api.put(`/adhoc-tasks/${task.id}`, { status: 'done', response_details: details.trim() });
      toast.success('Task marked complete!');
      onDone();
    } catch {
      toast.error('Failed to complete task');
    } finally { setSaving(false); }
  };

  return (
    <div className="modal-overlay" style={{ zIndex: 1200 }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 440 }}>
        <div className="modal-header">
          <h3>Complete Task</h3>
          <button className="modal-close" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="modal-body" style={{ gap: 12 }}>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0 }}><strong>{task.title}</strong></p>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>
              Response Details <span style={{ color: 'var(--error)' }}>*</span>
            </label>
            <textarea className="form-control" rows={4} autoFocus value={details}
              onChange={e => setDetails(e.target.value)}
              placeholder="Describe what was done, outcomes, next steps…"
              style={{ resize: 'vertical', fontSize: 13 }}
            />
            {!details.trim() && (
              <p style={{ fontSize: 11, color: 'var(--error)', marginTop: 4 }}>Response details are required.</p>
            )}
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost btn-sm" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary btn-sm" onClick={handleConfirm}
            disabled={!details.trim() || saving}>
            <Check size={14} /> Mark Complete
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function AdHocTasks() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [businessTeam, setBusinessTeam] = useState([]);
  const [teams, setTeams] = useState([]);
  const [assignableUsers, setAssignableUsers] = useState([]);
  const [stories, setStories] = useState([]);
  const [prospects, setProspects] = useState([]);

  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterPriority, setFilterPriority] = useState('');

  const [showModal, setShowModal] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [completingTask, setCompletingTask] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const searchTimer = useRef(null);
  const [searchInput, setSearchInput] = useState('');

  const handleSearchChange = (val) => {
    setSearchInput(val);
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => setSearch(val), 350);
  };

  const loadOptions = useCallback(async () => {
    try {
      const [btRes, teamsRes, usersRes, storiesRes, prospectsRes] = await Promise.all([
        api.get('/business-team').catch(() => ({ data: [] })),
        api.get('/teams').catch(() => ({ data: { teams: [] } })),
        api.get('/users/assignable').catch(() => ({ data: { users: [] } })),
        api.get('/stories?limit=500').catch(() => ({ data: { stories: [] } })),
        api.get('/prospects').catch(() => ({ data: { prospects: [] } })),
      ]);
      setBusinessTeam(Array.isArray(btRes.data) ? btRes.data : []);
      setTeams(teamsRes.data.teams || []);
      setAssignableUsers(usersRes.data.users || []);
      setStories(storiesRes.data.stories || []);
      setProspects(prospectsRes.data.prospects || []);
    } catch { /* non-critical */ }
  }, []);

  const loadTasks = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      if (filterStatus) params.append('status', filterStatus);
      if (filterPriority) params.append('priority', filterPriority);
      const res = await api.get(`/adhoc-tasks?${params}`);
      setTasks(res.data.tasks || []);
    } catch { toast.error('Failed to load tasks'); }
    finally { setLoading(false); }
  }, [search, filterStatus, filterPriority]);

  useEffect(() => { loadOptions(); }, [loadOptions]);
  useEffect(() => { loadTasks(); }, [loadTasks]);

  const handleSaved = (saved) => {
    setTasks(prev => {
      const existing = prev.findIndex(t => t.id === saved.id);
      if (existing >= 0) { const n = [...prev]; n[existing] = saved; return n; }
      return [saved, ...prev];
    });
    setShowModal(false);
    setEditingTask(null);
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    setDeleting(true);
    try {
      await api.delete(`/adhoc-tasks/${deleteConfirm.id}`);
      setTasks(prev => prev.filter(t => t.id !== deleteConfirm.id));
      toast.success('Task deleted');
      setDeleteConfirm(null);
    } catch { toast.error('Failed to delete task'); }
    finally { setDeleting(false); }
  };

  const handleToggleReopen = async (task) => {
    try {
      await api.put(`/adhoc-tasks/${task.id}`, { status: 'todo', response_details: null });
      loadTasks();
      toast.success('Task reopened');
    } catch { toast.error('Failed to update task'); }
  };

  // Stats
  const totalCount = tasks.length;
  const doneCount = tasks.filter(t => t.status === 'done').length;
  const overdueCount = tasks.filter(t => {
    if (t.status === 'done') return false;
    if (!t.due_date) return false;
    return new Date(t.due_date) < new Date();
  }).length;
  const inProgressCount = tasks.filter(t => t.status === 'in_progress').length;

  if (loading) return (
    <div className="page-loading">
      <div className="page-spinner" />
      <p>Loading ad-hoc tasks…</p>
    </div>
  );

  return (
    <>
      {/* Create / Edit modal */}
      {(showModal || editingTask) && (
        <AdHocTaskModal
          task={editingTask}
          businessTeam={businessTeam}
          teams={teams}
          assignableUsers={assignableUsers}
          stories={stories}
          prospects={prospects}
          onClose={() => { setShowModal(false); setEditingTask(null); }}
          onSaved={handleSaved}
        />
      )}

      {/* Complete modal */}
      {completingTask && (
        <CompleteModal
          task={completingTask}
          onClose={() => setCompletingTask(null)}
          onDone={() => { setCompletingTask(null); loadTasks(); }}
        />
      )}

      {/* Delete confirmation */}
      {deleteConfirm && (
        <div className="modal-overlay" style={{ zIndex: 1200 }}
          onClick={e => e.target === e.currentTarget && setDeleteConfirm(null)}>
          <div className="modal" style={{ maxWidth: 420 }}>
            <div className="modal-header">
              <h3>Delete Task</h3>
              <button className="modal-close" onClick={() => setDeleteConfirm(null)}><X size={18} /></button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
                Are you sure you want to delete <strong>"{deleteConfirm.title}"</strong>?
                This action cannot be undone.
              </p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setDeleteConfirm(null)}>Cancel</button>
              <button className="btn btn-danger" onClick={handleDelete} disabled={deleting}>
                {deleting ? <span className="btn-spinner" /> : <Trash2 size={14} />} Delete
              </button>
            </div>
          </div>
        </div>
      )}

      <Header title="Ad-Hoc Tasks" subtitle="Standalone tasks created by system admin" />
      <div className="page-content adhoc-page">

        {/* Stats */}
        <div className="adhoc-stats">
          <div className="adhoc-stat">
            <div className="adhoc-stat-icon adhoc-stat-total"><CalendarCheck size={16} /></div>
            <div><div className="adhoc-stat-val">{totalCount}</div><div className="adhoc-stat-lbl">Total</div></div>
          </div>
          <div className="adhoc-stat">
            <div className="adhoc-stat-icon adhoc-stat-progress"><Clock size={16} /></div>
            <div><div className="adhoc-stat-val">{inProgressCount}</div><div className="adhoc-stat-lbl">In Progress</div></div>
          </div>
          <div className="adhoc-stat">
            <div className="adhoc-stat-icon adhoc-stat-overdue"><AlertCircle size={16} /></div>
            <div><div className="adhoc-stat-val">{overdueCount}</div><div className="adhoc-stat-lbl">Overdue</div></div>
          </div>
          <div className="adhoc-stat">
            <div className="adhoc-stat-icon adhoc-stat-done"><CheckSquare size={16} /></div>
            <div><div className="adhoc-stat-val">{doneCount}</div><div className="adhoc-stat-lbl">Completed</div></div>
          </div>
        </div>

        {/* Toolbar */}
        <div className="users-toolbar">
          <div className="users-search">
            <Search size={15} />
            <input className="users-search-input" placeholder="Search tasks, stories, prospects…"
              value={searchInput} onChange={e => handleSearchChange(e.target.value)} />
            {searchInput && (
              <button className="search-clear" onClick={() => { setSearchInput(''); setSearch(''); }}>
                <X size={14} />
              </button>
            )}
          </div>

          <select className="filter-select" value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}>
            <option value="">All Statuses</option>
            {Object.entries(STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>

          <select className="filter-select" value={filterPriority}
            onChange={e => setFilterPriority(e.target.value)}>
            <option value="">All Priorities</option>
            {PRIORITIES.map(p => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
          </select>

          <button className="btn btn-secondary btn-sm"
            onClick={() => {
              const data = tasks.map(t => ({
                Title: t.title, Status: t.status, Priority: t.priority,
                'BT Member': t.business_team_member_name || '',
                'Story': t.story_title || '', 'Prospect': t.prospect_title || '',
                'Start Date': formatDate(t.start_date), 'Due Date': formatDate(t.due_date),
                'Teams': (t.team_assignments || []).map(x => x.name).join(', '),
                'Members': (t.member_assignments || []).map(x => x.name).join(', '),
                'Response': t.response_details || '',
              }));
              exportToExcel(data, 'adhoc-tasks');
            }}
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Download size={15} /> Export
          </button>

          <button className="btn btn-primary btn-sm"
            style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}
            onClick={() => setShowModal(true)}>
            <Plus size={14} /> New Task
          </button>
        </div>

        {/* Tasks table */}
        {tasks.length === 0 ? (
          <div className="adhoc-empty">
            <CalendarCheck size={40} />
            <h3>No ad-hoc tasks yet</h3>
            <p>Create a standalone task and optionally link it to a story or prospect.</p>
            <button className="btn btn-primary" onClick={() => setShowModal(true)}>
              <Plus size={14} /> New Task
            </button>
          </div>
        ) : (
          <div className="adhoc-table-wrapper">
            <table className="adhoc-table">
              <thead>
                <tr>
                  <th>Status</th>
                  <th>Title</th>
                  <th>Priority</th>
                  <th>BT Member</th>
                  <th>Linked To</th>
                  <th>Assigned</th>
                  <th>Start Date</th>
                  <th>Due Date</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {tasks.map(task => {
                  const isOverdue = task.status !== 'done' && task.due_date && new Date(task.due_date) < new Date();
                  const priorityColor = PRIORITY_COLORS[task.priority] || '#718096';
                  return (
                    <tr key={task.id} className={`adhoc-row${task.status === 'done' ? ' adhoc-row--done' : ''}${isOverdue ? ' adhoc-row--overdue' : ''}`}>
                      <td>
                        <button
                          className={`adhoc-status-btn adhoc-status-${task.status}`}
                          onClick={() => task.status === 'done' ? handleToggleReopen(task) : setCompletingTask(task)}
                          title={task.status === 'done' ? 'Reopen task' : 'Mark complete'}
                        >
                          {task.status === 'done' ? <Check size={12} /> : <span className="adhoc-status-dot" />}
                          {STATUS_LABELS[task.status]}
                        </button>
                      </td>
                      <td className="adhoc-title-cell">
                        <span className={task.status === 'done' ? 'adhoc-title-done' : ''}>{task.title}</span>
                        {task.description && (
                          <span className="adhoc-desc-preview">{task.description}</span>
                        )}
                      </td>
                      <td>
                        <span className="adhoc-priority-badge"
                          style={{ background: `${priorityColor}18`, color: priorityColor, border: `1px solid ${priorityColor}33` }}>
                          <Flag size={9} />
                          {task.priority ? task.priority.charAt(0).toUpperCase() + task.priority.slice(1) : '—'}
                        </span>
                      </td>
                      <td>
                        {task.business_team_member_name ? (
                          <span className="adhoc-bt-cell">
                            <Briefcase size={11} />
                            <span>{task.business_team_member_name}</span>
                            <span className="adhoc-bt-role">{BT_ROLE_LABELS[task.business_team_member_role] || ''}</span>
                          </span>
                        ) : '—'}
                      </td>
                      <td>
                        {task.story_title ? (
                          <span className="adhoc-link-badge adhoc-link-story" title={`Story: ${task.story_title}`}>
                            📋 {task.story_title}
                          </span>
                        ) : task.prospect_title ? (
                          <span className="adhoc-link-badge adhoc-link-prospect" title={`Prospect: ${task.prospect_title}`}>
                            🔍 {task.prospect_title}
                          </span>
                        ) : '—'}
                      </td>
                      <td>
                        {(task.team_assignments?.length > 0 || task.member_assignments?.length > 0) ? (
                          <div className="adhoc-assign-cell">
                            {task.team_assignments?.map(t => (
                              <span key={t.team_id} className="adhoc-assign-chip adhoc-assign-team">
                                <Users size={9} /> {t.name}
                              </span>
                            ))}
                            {task.member_assignments?.map(m => (
                              <span key={m.user_id} className="adhoc-assign-chip adhoc-assign-member">
                                <User size={9} /> {m.name}
                              </span>
                            ))}
                          </div>
                        ) : '—'}
                      </td>
                      <td className={isOverdue ? 'adhoc-overdue-date' : ''}>
                        {formatDate(task.start_date) || '—'}
                      </td>
                      <td className={isOverdue ? 'adhoc-overdue-date' : ''}>
                        {formatDate(task.due_date) || '—'}
                        {isOverdue && <span className="adhoc-overdue-tag">Overdue</span>}
                      </td>
                      <td>
                        <div className="adhoc-actions">
                          <button className="tbl-btn tbl-btn-view"
                            title="Edit" onClick={() => setEditingTask(task)}>
                            <Pencil size={13} />
                          </button>
                          <button className="tbl-btn tbl-btn-delete"
                            title="Delete" onClick={() => setDeleteConfirm(task)}>
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
