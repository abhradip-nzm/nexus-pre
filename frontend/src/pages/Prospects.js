import React, { useState, useEffect, useCallback, useRef } from 'react';
import Pagination from '../components/common/Pagination';
import { Plus, Pencil, Trash2, ArrowUpCircle, X, Save, DollarSign, Building, User, Phone, Mail, Tag, Layers, Download, Eye, Check, Users, Globe, Filter, Calendar, UserCheck } from 'lucide-react';
import Header from '../components/layout/Header';
import { useAuth } from '../contexts/AuthContext';
import api from '../utils/api';
import toast from 'react-hot-toast';
import { exportToExcel } from '../utils/exportExcel';
import { toProperCase, formatDate, getInitials, getAvatarColor } from '../utils/helpers';
import './Prospects.css';

const PRIORITIES = ['low', 'medium', 'high', 'critical'];

const PRIORITY_COLORS = {
  critical: '#dc3545',
  high: '#e67e22',
  medium: '#f59e0b',
  low: '#28a745',
};

const COUNTRIES = [
  'Afghanistan','Albania','Algeria','Andorra','Angola','Argentina','Armenia','Australia','Austria','Azerbaijan',
  'Bahamas','Bahrain','Bangladesh','Belarus','Belgium','Belize','Benin','Bhutan','Bolivia','Bosnia and Herzegovina',
  'Botswana','Brazil','Brunei','Bulgaria','Burkina Faso','Burundi','Cambodia','Cameroon','Canada','Cape Verde',
  'Central African Republic','Chad','Chile','China','Colombia','Comoros','Congo','Costa Rica','Croatia','Cuba',
  'Cyprus','Czech Republic','Denmark','Djibouti','Dominican Republic','Ecuador','Egypt','El Salvador','Estonia',
  'Ethiopia','Fiji','Finland','France','Gabon','Gambia','Georgia','Germany','Ghana','Greece','Guatemala',
  'Guinea','Haiti','Honduras','Hungary','Iceland','India','Indonesia','Iran','Iraq','Ireland','Israel','Italy',
  'Jamaica','Japan','Jordan','Kazakhstan','Kenya','Kuwait','Kyrgyzstan','Laos','Latvia','Lebanon','Lesotho',
  'Libya','Lithuania','Luxembourg','Madagascar','Malawi','Malaysia','Maldives','Mali','Malta','Mauritania',
  'Mauritius','Mexico','Moldova','Monaco','Mongolia','Montenegro','Morocco','Mozambique','Myanmar','Namibia',
  'Nepal','Netherlands','New Zealand','Nicaragua','Niger','Nigeria','North Korea','Norway','Oman','Pakistan',
  'Palestine','Panama','Papua New Guinea','Paraguay','Peru','Philippines','Poland','Portugal','Qatar','Romania',
  'Russia','Rwanda','Saudi Arabia','Senegal','Serbia','Sierra Leone','Singapore','Slovakia','Slovenia',
  'Somalia','South Africa','South Korea','Spain','Sri Lanka','Sudan','Suriname','Sweden','Switzerland','Syria',
  'Taiwan','Tajikistan','Tanzania','Thailand','Togo','Trinidad and Tobago','Tunisia','Turkey','Turkmenistan',
  'Uganda','Ukraine','United Arab Emirates','United Kingdom','United States','Uruguay','Uzbekistan','Venezuela',
  'Vietnam','Yemen','Zambia','Zimbabwe'
];

const emptyForm = {
  title: '',
  company_name: '',
  contact_name: '',
  contact_email: '',
  contact_phone: '',
  source: '',
  priority: 'medium',
  estimated_value: '',
  industry_ids: [],
  team_ids: [],
  member_ids: [],
  tags: [],
  notes: '',
  country: '',
  assignment_type: '',
  sales_director_id: '',
};

function ProspectTasksSection({ prospectId }) {
  const [tasks, setTasks] = useState([]);
  const [assignableUsers, setAssignableUsers] = useState([]);

  // New task form
  const [showForm, setShowForm] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newStartDate, setNewStartDate] = useState('');
  const [newDueDate, setNewDueDate] = useState('');
  const [newAssigneeIds, setNewAssigneeIds] = useState([]);

  // Complete task
  const [completingTask, setCompletingTask] = useState(null);
  const [responseDetails, setResponseDetails] = useState('');

  // Edit task
  const [editingTaskId, setEditingTaskId] = useState(null);
  const [editTitle, setEditTitle] = useState('');
  const [editStartDate, setEditStartDate] = useState('');
  const [editDueDate, setEditDueDate] = useState('');
  const [editAssigneeIds, setEditAssigneeIds] = useState([]);
  const [editSaving, setEditSaving] = useState(false);

  useEffect(() => {
    api.get(`/prospects/${prospectId}/tasks`).then(r => setTasks(r.data.tasks || []));
    api.get(`/prospects/${prospectId}/assignable-users`).then(r => setAssignableUsers(r.data.users || [])).catch(() => {});
  }, [prospectId]);

  const toggleNewAssignee = (uid) =>
    setNewAssigneeIds(prev => prev.includes(uid) ? prev.filter(x => x !== uid) : [...prev, uid]);

  const toggleEditAssignee = (uid) =>
    setEditAssigneeIds(prev => prev.includes(uid) ? prev.filter(x => x !== uid) : [...prev, uid]);

  const addTask = async () => {
    if (!newTitle.trim()) return;
    try {
      const res = await api.post(`/prospects/${prospectId}/tasks`, {
        title: newTitle.trim(),
        start_date: newStartDate || null,
        due_date: newDueDate || null,
        assignee_ids: newAssigneeIds,
      });
      setTasks(prev => [...prev, res.data.task]);
      setNewTitle(''); setNewStartDate(''); setNewDueDate(''); setNewAssigneeIds([]); setShowForm(false);
    } catch {
      toast.error('Failed to add task');
    }
  };

  const startEdit = (task) => {
    setEditingTaskId(task.id);
    setEditTitle(task.title);
    setEditStartDate(task.start_date ? task.start_date.slice(0, 10) : '');
    setEditDueDate(task.due_date ? task.due_date.slice(0, 10) : '');
    setEditAssigneeIds(task.assignees ? task.assignees.map(a => a.id) : []);
    setCompletingTask(null);
  };

  const saveEdit = async () => {
    if (!editTitle.trim()) return;
    setEditSaving(true);
    try {
      const res = await api.put(`/prospect-tasks/${editingTaskId}`, {
        title: editTitle.trim(),
        start_date: editStartDate || null,
        due_date: editDueDate || null,
        assignee_ids: editAssigneeIds,
      });
      setTasks(prev => prev.map(t => t.id === editingTaskId ? res.data.task : t));
      setEditingTaskId(null);
    } catch {
      toast.error('Failed to update task');
    } finally {
      setEditSaving(false);
    }
  };

  const cancelEdit = () => { setEditingTaskId(null); };

  const toggleTask = (task) => {
    if (task.status !== 'done') { setCompletingTask(task); setResponseDetails(''); setEditingTaskId(null); return; }
    api.put(`/prospect-tasks/${task.id}`, { status: 'todo' }).then(() => {
      setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: 'todo', completed_at: null, response_details: null } : t));
    });
  };

  const confirmComplete = async () => {
    if (!responseDetails.trim()) return;
    const res = await api.put(`/prospect-tasks/${completingTask.id}`, { status: 'done', response_details: responseDetails.trim() });
    setTasks(prev => prev.map(t => t.id === completingTask.id ? res.data.task : t));
    setCompletingTask(null); setResponseDetails('');
  };

  const deleteTask = (id) => {
    api.delete(`/prospect-tasks/${id}`).then(() => setTasks(prev => prev.filter(t => t.id !== id)));
  };

  // Reusable assignee checklist
  const AssigneeChecklist = ({ selected, onToggle }) => {
    if (!assignableUsers.length) return null;
    return (
      <div>
        <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4, fontWeight: 600 }}>
          <Users size={11} style={{ marginRight: 4, verticalAlign: 'middle' }} />Assignees
        </label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3, border: '1.5px solid var(--border)', borderRadius: 6, padding: '6px 8px', maxHeight: 130, overflowY: 'auto' }}>
          {assignableUsers.map(u => {
            const name = `${u.first_name} ${u.last_name}`;
            const isSelected = selected.includes(u.id);
            return (
              <label key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', padding: '3px 4px', borderRadius: 4, background: isSelected ? 'var(--primary-50)' : 'transparent', transition: 'background 0.1s' }}>
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => onToggle(u.id)}
                  style={{ accentColor: 'var(--primary)', width: 13, height: 13 }}
                />
                <span style={{ width: 22, height: 22, borderRadius: '50%', background: getAvatarColor(name), color: 'white', fontSize: 8, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {getInitials(name)}
                </span>
                <span style={{ fontSize: 12, fontWeight: 500, flex: 1 }}>{name}</span>
                <span style={{ fontSize: 9, color: 'var(--text-muted)', background: 'var(--bg-tertiary)', padding: '1px 5px', borderRadius: 10 }}>
                  {u.role_name === 'pre_sales_executive' ? 'Executive' : u.role_name === 'pre_sales_manager' ? 'Manager' : u.role_name === 'system_admin' ? 'Admin' : u.role_name}
                </span>
              </label>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div style={{ marginTop: 20, borderTop: '1px solid var(--border-light)', paddingTop: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <h4 style={{ fontSize: 13, fontWeight: 700, margin: 0 }}>Tasks ({tasks.length})</h4>
        {!showForm && (
          <button className="btn btn-primary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: 4 }} onClick={() => setShowForm(true)}>
            <Plus size={13} /> Add Task
          </button>
        )}
      </div>

      {/* ── New task form ── */}
      {showForm && (
        <div style={{ background: 'var(--bg-secondary)', borderRadius: 8, padding: 12, marginBottom: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <input className="form-control" placeholder="Task title" value={newTitle} onChange={e => setNewTitle(e.target.value)} autoFocus />
          <div style={{ display: 'flex', gap: 8 }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 3 }}>Start Date</label>
              <input type="date" className="form-control form-control-sm" value={newStartDate} onChange={e => setNewStartDate(e.target.value)} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 3 }}>Due Date</label>
              <input type="date" className="form-control form-control-sm" value={newDueDate} onChange={e => setNewDueDate(e.target.value)} />
            </div>
          </div>
          <AssigneeChecklist selected={newAssigneeIds} onToggle={toggleNewAssignee} />
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-primary btn-sm" onClick={addTask} disabled={!newTitle.trim()}>Add</button>
            <button className="btn btn-ghost btn-sm" onClick={() => { setShowForm(false); setNewTitle(''); setNewAssigneeIds([]); }}>Cancel</button>
          </div>
        </div>
      )}

      {/* ── Complete task prompt ── */}
      {completingTask && (
        <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: 12, marginBottom: 12 }}>
          <p style={{ fontSize: 13, fontWeight: 600, margin: '0 0 8px' }}>Complete: {completingTask.title}</p>
          <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Response Details <span style={{ color: '#dc3545' }}>*</span></label>
          <textarea className="form-control" rows={3} placeholder="Describe outcome…" value={responseDetails} onChange={e => setResponseDetails(e.target.value)} autoFocus style={{ resize: 'vertical', fontFamily: 'inherit', fontSize: 13 }} />
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button className="btn btn-primary btn-sm" onClick={confirmComplete} disabled={!responseDetails.trim()} style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Check size={13} /> Confirm</button>
            <button className="btn btn-ghost btn-sm" onClick={() => setCompletingTask(null)}>Cancel</button>
          </div>
        </div>
      )}

      {/* ── Task list ── */}
      {tasks.length === 0 && !showForm ? (
        <p style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic' }}>No tasks yet.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {tasks.map(task => {
            const isDone = task.status === 'done';
            const isEditing = editingTaskId === task.id;
            return (
              <div key={task.id} style={{ border: '1px solid var(--border-light)', borderRadius: 8, overflow: 'hidden' }}>
                {isEditing ? (
                  /* ── Edit mode ── */
                  <div style={{ background: '#f8fafc', padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <input className="form-control" value={editTitle} onChange={e => setEditTitle(e.target.value)} autoFocus placeholder="Task title" />
                    <div style={{ display: 'flex', gap: 8 }}>
                      <div style={{ flex: 1 }}>
                        <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 3 }}>Start Date</label>
                        <input type="date" className="form-control form-control-sm" value={editStartDate} onChange={e => setEditStartDate(e.target.value)} />
                      </div>
                      <div style={{ flex: 1 }}>
                        <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 3 }}>Due Date</label>
                        <input type="date" className="form-control form-control-sm" value={editDueDate} onChange={e => setEditDueDate(e.target.value)} />
                      </div>
                    </div>
                    <AssigneeChecklist selected={editAssigneeIds} onToggle={toggleEditAssignee} />
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button className="btn btn-primary btn-sm" onClick={saveEdit} disabled={editSaving || !editTitle.trim()}>
                        {editSaving ? 'Saving…' : 'Save'}
                      </button>
                      <button className="btn btn-ghost btn-sm" onClick={cancelEdit}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  /* ── View mode ── */
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '8px 10px', background: isDone ? '#f8fffe' : 'white' }}>
                    <button
                      onClick={() => toggleTask(task)}
                      style={{ width: 18, height: 18, borderRadius: '50%', border: isDone ? 'none' : '2px solid var(--border)', background: isDone ? '#16a34a' : 'transparent', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0, marginTop: 2 }}
                      title={isDone ? 'Mark incomplete' : 'Mark complete'}
                    >
                      {isDone && <Check size={10} />}
                    </button>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 500, color: isDone ? 'var(--text-muted)' : 'var(--text-primary)', textDecoration: isDone ? 'line-through' : 'none' }}>{task.title}</div>

                      {/* Assignee avatars */}
                      {task.assignees && task.assignees.length > 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
                          {task.assignees.map(a => (
                            <span key={a.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'var(--bg-secondary)', border: '1px solid var(--border-light)', borderRadius: 12, padding: '1px 7px 1px 2px', fontSize: 11 }}>
                              <span style={{ width: 16, height: 16, borderRadius: '50%', background: getAvatarColor(a.name), color: 'white', fontSize: 7, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                {getInitials(a.name)}
                              </span>
                              <span style={{ fontWeight: 500, color: 'var(--text-secondary)' }}>{a.name}</span>
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Response details */}
                      {task.response_details && (
                        <div style={{ marginTop: 4, padding: '4px 8px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 5, fontSize: 11, color: '#166534' }}>
                          <strong>Response:</strong> {task.response_details}
                        </div>
                      )}

                      {/* Date range */}
                      {(task.start_date || task.due_date) && (
                        <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 3, display: 'flex', alignItems: 'center', gap: 4 }}>
                          <Calendar size={9} />
                          {formatDate(task.start_date) || '—'} → {task.due_date ? formatDate(task.due_date) : 'No due date'}
                        </div>
                      )}
                    </div>

                    {/* Action buttons */}
                    <div style={{ display: 'flex', gap: 4, alignItems: 'center', flexShrink: 0 }}>
                      {!isDone && (
                        <button onClick={() => startEdit(task)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 2, display: 'flex', alignItems: 'center' }} title="Edit task">
                          <Pencil size={12} />
                        </button>
                      )}
                      <button onClick={() => deleteTask(task.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 2, display: 'flex', alignItems: 'center' }} title="Delete">
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function Prospects() {
  const { user } = useAuth();
  const canCreateContent = ['system_admin', 'super_admin'].includes(user?.role_name);
  const [prospects, setProspects] = useState([]);
  const [industries, setIndustries] = useState([]);
  const [teams, setTeams] = useState([]);
  const [tagOptions, setTagOptions] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [asdMembers, setAsdMembers] = useState([]); // Associate Sales Directors
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingProspect, setEditingProspect] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [promoteConfirm, setPromoteConfirm] = useState(null);
  const [promoting, setPromoting] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [viewingProspect, setViewingProspect] = useState(null);
  const [tagInput, setTagInput] = useState('');
  const [showTagDropdown, setShowTagDropdown] = useState(false);
  const tagInputRef = useRef(null);
  const tagsWrapperRef = useRef(null);
  const [tagDropdownPos, setTagDropdownPos] = useState(null);

  // Filters
  const [showFilters, setShowFilters] = useState(false);
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [filterAsd, setFilterAsd] = useState('');
  const [filterTasks, setFilterTasks] = useState('');

  // Pagination
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState(null);
  const [refreshTick, setRefreshTick] = useState(0);

  const lblStyle = { fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', display: 'block', marginBottom: 4 };
  const valStyle = { fontSize: 13, color: 'var(--text-primary)', margin: 0 };

  const loadData = useCallback(async () => {
    try {
      const [prospectsRes, industriesRes, teamsRes, tagsRes, usersRes, bizRes] = await Promise.all([
        api.get('/prospects', { params: { page: 1, limit: 20 } }),
        api.get('/industries').catch(() => ({ data: { industries: [] } })),
        api.get('/teams').catch(() => ({ data: { teams: [] } })),
        api.get('/tags').catch(() => ({ data: { tags: [] } })),
        api.get('/users/assignable').catch(() => ({ data: { users: [] } })),
        api.get('/business-team').catch(() => ({ data: [] })),
      ]);
      setProspects(prospectsRes.data.prospects || []);
      setPagination(prospectsRes.data.pagination || null);
      setIndustries(industriesRes.data.industries || []);
      setTeams(teamsRes.data.teams || []);
      setTagOptions(tagsRes.data.tags || []);
      setAllUsers(usersRes.data.users || []);
      setAsdMembers((bizRes.data || []).filter(m => m.role === 'asd'));
    } catch {
      toast.error('Failed to load prospects');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // Reload prospects whenever page, filters, or refreshTick changes (after initial load)
  useEffect(() => {
    if (loading) return;
    const params = { page, limit: 20 };
    if (filterDateFrom) params.date_from = filterDateFrom;
    if (filterDateTo)   params.date_to   = filterDateTo;
    if (filterAsd)      params.asd        = filterAsd;
    if (filterTasks)    params.tasks_filter = filterTasks;
    api.get('/prospects', { params })
      .then(res => {
        setProspects(res.data.prospects || []);
        setPagination(res.data.pagination || null);
      })
      .catch(() => toast.error('Failed to reload prospects'));
  }, [page, filterDateFrom, filterDateTo, filterAsd, filterTasks, refreshTick]); // eslint-disable-line

  const openCreate = () => {
    setEditingProspect(null);
    setForm(emptyForm);
    setTagInput('');
    setShowModal(true);
  };

  const openEdit = (prospect) => {
    setEditingProspect(prospect);
    setForm({
      title: prospect.title || '',
      company_name: prospect.company_name || '',
      contact_name: prospect.contact_name || '',
      contact_email: prospect.contact_email || '',
      contact_phone: prospect.contact_phone || '',
      source: prospect.source || '',
      priority: prospect.priority || 'medium',
      estimated_value: prospect.estimated_value || '',
      industry_ids: (prospect.industry_assignments || []).map(i => i.industry_id),
      team_ids: (prospect.team_assignments || []).map(t => t.team_id),
      member_ids: (prospect.member_assignments || []).map(m => m.user_id),
      tags: prospect.tags || [],
      notes: prospect.notes || '',
      country: prospect.country || '',
      assignment_type: (prospect.team_assignments || []).length > 0 ? 'team' : (prospect.member_assignments || []).length > 0 ? 'member' : '',
      sales_director_id: prospect.sales_director_id ? String(prospect.sales_director_id) : '',
    });
    setTagInput('');
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingProspect(null);
    setForm(emptyForm);
    setTagInput('');
  };

  const handleChange = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) {
      toast.error('Title is required');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ...form,
        estimated_value: form.estimated_value ? parseFloat(form.estimated_value) : null,
        sales_director_id: form.sales_director_id ? parseInt(form.sales_director_id) : null,
      };
      if (editingProspect) {
        await api.put(`/prospects/${editingProspect.id}`, payload);
        toast.success('Prospect updated');
      } else {
        await api.post('/prospects', payload);
        toast.success('Prospect created');
      }
      closeModal();
      setRefreshTick(t => t + 1);
    } catch {
      toast.error('Failed to save prospect');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await api.delete(`/prospects/${id}`);
      setDeleteConfirm(null);
      toast.success('Prospect deleted');
      // If we deleted the last item on this page, go back one page
      if (prospects.length === 1 && page > 1) {
        setPage(p => p - 1);
      } else {
        setRefreshTick(t => t + 1);
      }
    } catch {
      toast.error('Failed to delete prospect');
    }
  };

  const handlePromote = async (id) => {
    setPromoting(true);
    try {
      await api.post(`/prospects/${id}/promote`);
      setPromoteConfirm(null);
      toast.success('Prospect promoted to Story at L1 stage');
      setRefreshTick(t => t + 1);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to promote prospect');
    } finally {
      setPromoting(false);
    }
  };

  const formatValue = (val) => {
    if (!val) return '—';
    return '$' + parseFloat(val).toLocaleString();
  };

  // formatDate is imported from helpers — no local override needed

  if (loading) return (
    <div className="page-loading">
      <div className="page-spinner" />
      <p>Loading prospects...</p>
    </div>
  );

  const activeFilterCount = [filterDateFrom, filterDateTo, filterAsd, filterTasks].filter(Boolean).length;
  const totalProspects = pagination?.total ?? prospects.length;

  return (
    <>
      <Header title="Probable Prospects" subtitle="Manage and track potential opportunities before promoting to the pipeline" />
      <div className="page-content prospects-page">

        <div className="users-toolbar">
          <div className="users-stats">
            <span className="stat-pill">{totalProspects} prospect{totalProspects !== 1 ? 's' : ''}</span>
          </div>
          <button
            className={`btn btn-sm ${showFilters || activeFilterCount > 0 ? 'btn-secondary' : 'btn-ghost'}`}
            onClick={() => setShowFilters(v => !v)}
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <Filter size={14} />
            Filters
            {activeFilterCount > 0 && (
              <span style={{ background: 'var(--primary)', color: 'white', borderRadius: '50%', width: 16, height: 16, fontSize: 10, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>
                {activeFilterCount}
              </span>
            )}
          </button>
          <button
            className="btn btn-secondary btn-sm"
            onClick={async () => {
              try {
                const params = { page: 1, limit: 2000 };
                if (filterDateFrom) params.date_from = filterDateFrom;
                if (filterDateTo)   params.date_to   = filterDateTo;
                if (filterAsd)      params.asd        = filterAsd;
                if (filterTasks)    params.tasks_filter = filterTasks;
                const res = await api.get('/prospects', { params });
                const data = (res.data.prospects || []).map(p => ({
                  'Title': p.title,
                  'Company': p.company_name || '',
                  'Contact Name': p.contact_name || '',
                  'Email': p.contact_email || '',
                  'Phone': p.contact_phone || '',
                  'Source': p.source || '',
                  'Priority': p.priority || '',
                  'Estimated Value': p.estimated_value || '',
                  'Country': p.country || '',
                  'Notes': p.notes || '',
                  'Assoc. Sales Director': p.sales_director_name || '',
                  'Created': formatDate(p.created_at),
                }));
                exportToExcel(data, 'prospects');
              } catch {
                toast.error('Failed to export');
              }
            }}
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <Download size={15} /> Export Excel
          </button>
          {canCreateContent && (
            <button className="btn btn-primary btn-sm" onClick={openCreate}>
              <Plus size={14} /> Add Prospect
            </button>
          )}
        </div>

        {/* Filter Panel */}
        {showFilters && (
          <div className="kanban-filter-panel" style={{ marginBottom: 16 }}>
            <div className="filter-group">
              <label className="filter-label"><Calendar size={12} /> Created Date Range</label>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input
                  type="date"
                  className="form-control form-control-sm"
                  style={{ width: 150 }}
                  value={filterDateFrom}
                  onChange={e => { setPage(1); setFilterDateFrom(e.target.value); }}
                />
                <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>to</span>
                <input
                  type="date"
                  className="form-control form-control-sm"
                  style={{ width: 150 }}
                  value={filterDateTo}
                  onChange={e => { setPage(1); setFilterDateTo(e.target.value); }}
                />
              </div>
            </div>
            {asdMembers.length > 0 && (
              <div className="filter-group">
                <label className="filter-label"><UserCheck size={12} /> Assoc. Sales Director</label>
                <div className="filter-chips">
                  <button className={`filter-chip ${filterAsd === '' ? 'active' : ''}`} onClick={() => { setPage(1); setFilterAsd(''); }}>All</button>
                  <button className={`filter-chip ${filterAsd === 'none' ? 'active' : ''}`} onClick={() => { setPage(1); setFilterAsd(filterAsd === 'none' ? '' : 'none'); }}>Not Assigned</button>
                  {asdMembers.map(m => (
                    <button
                      key={m.id}
                      className={`filter-chip ${filterAsd === String(m.id) ? 'active' : ''}`}
                      onClick={() => { setPage(1); setFilterAsd(filterAsd === String(m.id) ? '' : String(m.id)); }}
                    >{m.name}</button>
                  ))}
                </div>
              </div>
            )}
            <div className="filter-group">
              <label className="filter-label">Tasks</label>
              <div className="filter-chips">
                {[
                  { value: '', label: 'All' },
                  { value: 'has_tasks', label: 'Has Tasks' },
                  { value: 'no_tasks', label: 'No Tasks' },
                  { value: 'has_incomplete', label: 'Has Incomplete' },
                  { value: 'all_complete', label: 'All Complete' },
                ].map(opt => (
                  <button
                    key={opt.value}
                    className={`filter-chip ${filterTasks === opt.value ? 'active' : ''}`}
                    onClick={() => { setPage(1); setFilterTasks(opt.value); }}
                  >{opt.label}</button>
                ))}
              </div>
            </div>
            {activeFilterCount > 0 && (
              <button className="btn btn-ghost btn-sm filter-clear-btn" onClick={() => { setPage(1); setFilterDateFrom(''); setFilterDateTo(''); setFilterAsd(''); setFilterTasks(''); }}>
                <X size={12} /> Clear filters
              </button>
            )}
          </div>
        )}

        {totalProspects === 0 ? (
          <div className="prospects-empty">
            <div className="prospects-empty-icon">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            </div>
            {activeFilterCount > 0
              ? <p>No prospects match the current filters.</p>
              : <p>No prospects yet. {canCreateContent ? 'Add your first probable prospect to get started.' : 'No probable prospects have been added yet.'}</p>
            }
            {canCreateContent && activeFilterCount === 0 && (
              <button className="btn btn-primary" onClick={openCreate}>
                <Plus size={14} /> Add Prospect
              </button>
            )}
          </div>
        ) : (
          <div className="users-table-wrap">
            <table className="users-table">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Company</th>
                  <th>Contact</th>
                  <th>Priority</th>
                  <th>Est. Value</th>
                  <th>ASD</th>
                  <th>Country</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {prospects.map(prospect => {
                  const pColor = PRIORITY_COLORS[prospect.priority] || '#718096';
                  return (
                    <tr key={prospect.id}>
                      <td>
                        <div className="user-name">{prospect.title}</div>
                        {prospect.source && (
                          <div className="user-email">{prospect.source}</div>
                        )}
                      </td>
                      <td>
                        {prospect.company_name ? (
                          <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 13 }}>
                            <Building size={12} /> {prospect.company_name}
                          </span>
                        ) : <span className="user-email">—</span>}
                      </td>
                      <td>
                        <div>
                          {prospect.contact_name && (
                            <div className="user-name" style={{ fontSize: 13 }}>{prospect.contact_name}</div>
                          )}
                          {prospect.contact_email && (
                            <div className="user-email">{prospect.contact_email}</div>
                          )}
                          {prospect.contact_phone && (
                            <div className="user-email">{prospect.contact_phone}</div>
                          )}
                          {!prospect.contact_name && !prospect.contact_email && !prospect.contact_phone && <span className="user-email">—</span>}
                        </div>
                      </td>
                      <td>
                        <span
                          className="role-badge"
                          style={{ background: `${pColor}20`, color: pColor, border: `1px solid ${pColor}40` }}
                        >
                          {prospect.priority ? prospect.priority.charAt(0).toUpperCase() + prospect.priority.slice(1) : '—'}
                        </span>
                      </td>
                      <td style={{ fontWeight: 500, color: 'var(--success)' }}>{formatValue(prospect.estimated_value)}</td>
                      <td>
                        {prospect.sales_director_name
                          ? <span style={{ fontSize: 12, background: '#6b5ea818', color: '#6b5ea8', padding: '2px 8px', borderRadius: 20, border: '1px solid #6b5ea830', fontWeight: 600, whiteSpace: 'nowrap' }}>{prospect.sales_director_name}</span>
                          : <span className="user-email">—</span>}
                      </td>
                      <td>{prospect.country || <span className="user-email">—</span>}</td>
                      <td className="last-login">{formatDate(prospect.created_at)}</td>
                      <td>
                        <div className="user-actions">
                          <button className="tbl-btn tbl-btn-view" onClick={() => setViewingProspect(prospect)} title="View">
                            <Eye size={13} />
                          </button>
                          <button className="tbl-btn tbl-btn-edit" onClick={() => openEdit(prospect)} title="Edit">
                            <Pencil size={13} />
                          </button>
                          <button className="tbl-btn tbl-btn-delete" onClick={() => setDeleteConfirm(prospect.id)} title="Delete">
                            <Trash2 size={13} />
                          </button>
                          <button className="tbl-btn tbl-btn-promote" onClick={() => setPromoteConfirm(prospect)} title="Promote to Story">
                            <ArrowUpCircle size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {pagination && pagination.totalPages > 1 && (
              <Pagination
                page={pagination.page}
                totalPages={pagination.totalPages}
                total={pagination.total}
                limit={pagination.limit}
                onPageChange={setPage}
              />
            )}
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && closeModal()}>
          <div className="modal modal-lg">
            <div className="modal-header">
              <h2 className="modal-title">{editingProspect ? 'Edit Prospect' : 'Add Prospect'}</h2>
              <button className="btn btn-ghost btn-icon" onClick={closeModal}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleSubmit} style={{ display: 'contents' }}>
              <div className="modal-body">
                <div className="story-form-grid">
                  <div className="story-form-main">
                    <div className="form-group">
                      <label className="form-label">Title *</label>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="e.g., ABC Corp - Cloud Migration"
                        value={form.title}
                        onChange={e => handleChange('title', e.target.value)}
                        autoFocus
                      />
                    </div>

                    <div className="form-row">
                      <div className="form-group">
                        <label className="form-label"><Building size={12} /> Company Name</label>
                        <input
                          type="text"
                          className="form-control"
                          placeholder="Company name"
                          value={form.company_name}
                          onChange={e => handleChange('company_name', e.target.value)}
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label"><User size={12} /> Contact Name</label>
                        <input
                          type="text"
                          className="form-control"
                          placeholder="Contact person"
                          value={form.contact_name}
                          onChange={e => handleChange('contact_name', e.target.value)}
                        />
                      </div>
                    </div>

                    <div className="form-row">
                      <div className="form-group">
                        <label className="form-label"><Mail size={12} /> Contact Email</label>
                        <input
                          type="email"
                          className="form-control"
                          placeholder="contact@company.com"
                          value={form.contact_email}
                          onChange={e => handleChange('contact_email', e.target.value)}
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label"><Phone size={12} /> Contact Phone</label>
                        <input
                          type="text"
                          className="form-control"
                          placeholder="+1 234 567 8900"
                          value={form.contact_phone}
                          onChange={e => handleChange('contact_phone', e.target.value)}
                        />
                      </div>
                    </div>

                    <div className="form-group">
                      <label className="form-label">Notes</label>
                      <textarea
                        className="form-control"
                        placeholder="Additional notes, context, or details..."
                        value={form.notes}
                        onChange={e => handleChange('notes', e.target.value)}
                        rows={3}
                      />
                    </div>

                    {/* Country */}
                    <div className="form-group">
                      <label className="form-label"><Globe size={12} /> Country</label>
                      <select className="form-control" value={form.country} onChange={e => handleChange('country', e.target.value)}>
                        <option value="">Select country</option>
                        {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>

                    {/* Industries multiselect */}
                    {industries.length > 0 && (
                      <div className="form-group">
                        <label className="form-label"><Layers size={12} /> Industries</label>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                          {industries.map(ind => (
                            <button
                              key={ind.id}
                              type="button"
                              onClick={() => setForm(prev => ({
                                ...prev,
                                industry_ids: prev.industry_ids.includes(ind.id)
                                  ? prev.industry_ids.filter(id => id !== ind.id)
                                  : [...prev.industry_ids, ind.id]
                              }))}
                              style={{
                                padding: '4px 12px', borderRadius: 20, border: '1.5px solid',
                                fontSize: 12, cursor: 'pointer', fontWeight: 500,
                                background: form.industry_ids.includes(ind.id) ? '#3e72ae' : 'white',
                                borderColor: form.industry_ids.includes(ind.id) ? '#3e72ae' : 'var(--border)',
                                color: form.industry_ids.includes(ind.id) ? 'white' : 'var(--text-primary)',
                              }}
                            >
                              {ind.name}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Tags */}
                    <div className="form-group">
                      <label className="form-label"><Tag size={12} /> Tags</label>
                      <div
                        className="tags-input-wrapper"
                        ref={tagsWrapperRef}
                      >
                        {form.tags.map(tag => {
                          const opt = tagOptions.find(t => t.name === tag);
                          return (
                            <span key={tag} className="tag-chip" style={opt ? { background: opt.color + '22', color: opt.color } : {}}>
                              {tag.toUpperCase()}
                              <button type="button" className="tag-remove"
                                onClick={() => setForm(prev => ({ ...prev, tags: prev.tags.filter(t => t !== tag) }))}>×</button>
                            </span>
                          );
                        })}
                        <input
                          ref={tagInputRef}
                          type="text"
                          className="tag-input"
                          placeholder={form.tags.length === 0 ? "Type or select a tag..." : "Add more..."}
                          value={tagInput}
                          onChange={e => { setTagInput(e.target.value); setShowTagDropdown(true); }}
                          onFocus={() => {
                            if (tagsWrapperRef.current) {
                              const r = tagsWrapperRef.current.getBoundingClientRect();
                              setTagDropdownPos({ top: r.bottom + 2, left: r.left, width: r.width });
                            }
                            setShowTagDropdown(true);
                          }}
                          onBlur={() => setTimeout(() => setShowTagDropdown(false), 150)}
                          onKeyDown={e => {
                            if ((e.key === 'Enter' || e.key === ',') && tagInput.trim()) {
                              e.preventDefault();
                              const tag = tagInput.trim().toLowerCase();
                              if (!form.tags.includes(tag)) setForm(prev => ({ ...prev, tags: [...prev.tags, tag] }));
                              setTagInput(''); setShowTagDropdown(false);
                            }
                          }}
                        />
                      </div>
                      {showTagDropdown && tagDropdownPos && (
                        <div className="tag-autocomplete-dropdown" style={{ position: 'fixed', top: tagDropdownPos.top, left: tagDropdownPos.left, width: tagDropdownPos.width, zIndex: 9999 }}>
                          {tagOptions.filter(t => !form.tags.includes(t.name) && (tagInput === '' || t.name.toLowerCase().includes(tagInput.toLowerCase()))).slice(0, 8).map(t => (
                            <button key={t.id} type="button" className="tag-autocomplete-option"
                              onMouseDown={e => {
                                e.preventDefault();
                                const tag = t.name.trim().toLowerCase();
                                if (!form.tags.includes(tag)) setForm(prev => ({ ...prev, tags: [...prev.tags, tag] }));
                                setTagInput(''); setShowTagDropdown(false);
                              }}>
                              <span className="tag-option-dot" style={{ background: t.color || '#3e72ae' }} />
                              {t.name.toUpperCase()}
                            </button>
                          ))}
                          {tagInput.trim() && !tagOptions.some(t => t.name.toLowerCase() === tagInput.toLowerCase()) && (
                            <button type="button" className="tag-autocomplete-option tag-create-new"
                              onMouseDown={e => {
                                e.preventDefault();
                                const tag = tagInput.trim().toLowerCase();
                                if (!form.tags.includes(tag)) setForm(prev => ({ ...prev, tags: [...prev.tags, tag] }));
                                setTagInput(''); setShowTagDropdown(false);
                              }}>
                              <Plus size={11} /> Create "{tagInput.toUpperCase()}"
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="story-form-sidebar">
                    <div className="form-group">
                      <label className="form-label">Priority</label>
                      <div className="priority-selector">
                        {PRIORITIES.map(p => (
                          <button
                            key={p}
                            type="button"
                            className={`priority-btn ${form.priority === p ? 'active' : ''} priority-${p}`}
                            onClick={() => handleChange('priority', p)}
                          >
                            {p}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="form-group">
                      <label className="form-label"><DollarSign size={12} /> Est. Value</label>
                      <input
                        type="number"
                        className="form-control"
                        placeholder="0.00"
                        value={form.estimated_value}
                        onChange={e => handleChange('estimated_value', e.target.value)}
                        min="0"
                        step="100"
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label"><Tag size={12} /> Source</label>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="e.g., LinkedIn, Referral, Website"
                        value={form.source}
                        onChange={e => handleChange('source', e.target.value)}
                      />
                    </div>

                    {/* Associate Sales Director */}
                    {asdMembers.length > 0 && (
                      <div className="form-group">
                        <label className="form-label"><UserCheck size={12} /> Associate Sales Director</label>
                        <select
                          className="form-control"
                          value={form.sales_director_id}
                          onChange={e => handleChange('sales_director_id', e.target.value)}
                        >
                          <option value="">— Not assigned —</option>
                          {asdMembers.map(m => (
                            <option key={m.id} value={String(m.id)}>{m.name}</option>
                          ))}
                        </select>
                      </div>
                    )}

                    {/* Assignment - Teams OR Members */}
                    <div className="form-group">
                      <label className="form-label">Assignment</label>
                      <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                        <button type="button"
                          className={`btn btn-sm ${form.assignment_type !== 'member' ? 'btn-primary' : 'btn-secondary'}`}
                          style={{ flex: 1, fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}
                          onClick={() => setForm(prev => ({ ...prev, assignment_type: 'team', member_ids: [] }))}>
                          <Users size={11} /> Assigned Teams
                        </button>
                        <button type="button"
                          className={`btn btn-sm ${form.assignment_type === 'member' ? 'btn-primary' : 'btn-secondary'}`}
                          style={{ flex: 1, fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}
                          onClick={() => setForm(prev => ({ ...prev, assignment_type: 'member', team_ids: [] }))}>
                          <User size={11} /> Assigned Members
                        </button>
                      </div>
                      {form.assignment_type !== 'member' && teams.length > 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                          {teams.map(team => (
                            <button key={team.id} type="button"
                              onClick={() => setForm(prev => ({
                                ...prev,
                                team_ids: prev.team_ids.includes(team.id) ? prev.team_ids.filter(id => id !== team.id) : [...prev.team_ids, team.id]
                              }))}
                              style={{
                                padding: '4px 12px', borderRadius: 20, border: '1.5px solid', fontSize: 12,
                                cursor: 'pointer', fontWeight: 500,
                                background: form.team_ids.includes(team.id) ? (team.accent_color || '#3e72ae') : 'white',
                                borderColor: form.team_ids.includes(team.id) ? (team.accent_color || '#3e72ae') : 'var(--border)',
                                color: form.team_ids.includes(team.id) ? 'white' : 'var(--text-primary)',
                              }}>
                              {team.name}
                            </button>
                          ))}
                        </div>
                      )}
                      {form.assignment_type === 'member' && allUsers.length > 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                          {allUsers.map(u => (
                            <button key={u.id} type="button"
                              onClick={() => setForm(prev => ({
                                ...prev,
                                member_ids: prev.member_ids.includes(u.id) ? prev.member_ids.filter(id => id !== u.id) : [...prev.member_ids, u.id]
                              }))}
                              style={{
                                padding: '4px 12px', borderRadius: 20, border: '1.5px solid', fontSize: 12,
                                cursor: 'pointer', fontWeight: 500,
                                background: form.member_ids.includes(u.id) ? '#3e72ae' : 'white',
                                borderColor: form.member_ids.includes(u.id) ? '#3e72ae' : 'var(--border)',
                                color: form.member_ids.includes(u.id) ? 'white' : 'var(--text-primary)',
                              }}>
                              {u.first_name} {u.last_name}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={closeModal}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? <span className="btn-spinner" /> : <Save size={15} />}
                  {saving ? 'Saving...' : editingProspect ? 'Update Prospect' : 'Create Prospect'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Promote Confirm Dialog */}
      {promoteConfirm && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setPromoteConfirm(null)}>
          <div className="modal modal-sm">
            <div className="modal-header">
              <h2 className="modal-title">Promote to Story</h2>
              <button className="btn btn-ghost btn-icon" onClick={() => setPromoteConfirm(null)}>
                <X size={18} />
              </button>
            </div>
            <div className="modal-body">
              <p style={{ marginBottom: 8 }}>
                This will create a new Story at <strong>L1 stage</strong> from:
              </p>
              <p style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: 16 }}>
                "{promoteConfirm.title}"
              </p>
              <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>
                The prospect will be marked as promoted and removed from this list. Continue?
              </p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setPromoteConfirm(null)}>Cancel</button>
              <button
                className="btn btn-primary"
                onClick={() => handlePromote(promoteConfirm.id)}
                disabled={promoting}
              >
                {promoting ? <span className="btn-spinner" /> : <ArrowUpCircle size={15} />}
                {promoting ? 'Promoting...' : 'Promote to Story'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm Dialog */}
      {deleteConfirm && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setDeleteConfirm(null)}>
          <div className="modal modal-sm">
            <div className="modal-header">
              <h2 className="modal-title">Delete Prospect</h2>
              <button className="btn btn-ghost btn-icon" onClick={() => setDeleteConfirm(null)}>
                <X size={18} />
              </button>
            </div>
            <div className="modal-body">
              <p>Are you sure you want to delete this prospect? This action cannot be undone.</p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setDeleteConfirm(null)}>Cancel</button>
              <button className="btn btn-danger" onClick={() => handleDelete(deleteConfirm)}>
                <Trash2 size={14} /> Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View Prospect Modal */}
      {viewingProspect && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setViewingProspect(null)}>
          <div className="modal modal-lg">
            <div className="modal-header">
              <h2 className="modal-title">{viewingProspect.title}</h2>
              <button className="btn btn-ghost btn-icon" onClick={() => setViewingProspect(null)}><X size={18} /></button>
            </div>
            <div className="modal-body">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div><label style={lblStyle}>Company</label><p style={valStyle}>{viewingProspect.company_name || '—'}</p></div>
                <div><label style={lblStyle}>Priority</label>
                  <span className="role-badge" style={{ background: `${PRIORITY_COLORS[viewingProspect.priority]}20`, color: PRIORITY_COLORS[viewingProspect.priority], border: `1px solid ${PRIORITY_COLORS[viewingProspect.priority]}40` }}>
                    {viewingProspect.priority ? viewingProspect.priority.charAt(0).toUpperCase() + viewingProspect.priority.slice(1) : '—'}
                  </span>
                </div>
                <div><label style={lblStyle}>Contact Name</label><p style={valStyle}>{viewingProspect.contact_name || '—'}</p></div>
                <div><label style={lblStyle}>Contact Email</label><p style={valStyle}>{viewingProspect.contact_email || '—'}</p></div>
                <div><label style={lblStyle}>Contact Phone</label><p style={valStyle}>{viewingProspect.contact_phone || '—'}</p></div>
                <div><label style={lblStyle}>Source</label><p style={valStyle}>{viewingProspect.source || '—'}</p></div>
                <div><label style={lblStyle}>Estimated Value</label><p style={valStyle}>{formatValue(viewingProspect.estimated_value)}</p></div>
                <div><label style={lblStyle}>Country</label><p style={valStyle}>{viewingProspect.country || '—'}</p></div>
                <div>
                  <label style={lblStyle}>Associate Sales Director</label>
                  {viewingProspect.sales_director_name
                    ? <span style={{ fontSize: 12, background: '#6b5ea818', color: '#6b5ea8', padding: '3px 10px', borderRadius: 20, border: '1px solid #6b5ea830', fontWeight: 600 }}>{viewingProspect.sales_director_name}</span>
                    : <p style={valStyle}>—</p>}
                </div>
                {(viewingProspect.industry_assignments || []).length > 0 && (
                  <div style={{ gridColumn: '1/-1' }}>
                    <label style={lblStyle}>Industries</label>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 2 }}>
                      {viewingProspect.industry_assignments.map(ia => (
                        <span key={ia.industry_id} style={{ fontSize: 11, background: 'var(--bg-secondary)', padding: '2px 8px', borderRadius: 4, border: '1px solid var(--border)' }}>{ia.industry_name}</span>
                      ))}
                    </div>
                  </div>
                )}
                {(viewingProspect.team_assignments || []).length > 0 && (
                  <div style={{ gridColumn: '1/-1' }}>
                    <label style={lblStyle}>Assigned Teams</label>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 2 }}>
                      {viewingProspect.team_assignments.map(ta => (
                        <span key={ta.team_id} style={{ fontSize: 11, background: (ta.accent_color || '#3e72ae') + '22', color: ta.accent_color || '#3e72ae', padding: '2px 8px', borderRadius: 4, border: `1px solid ${ta.accent_color || '#3e72ae'}40` }}>{ta.team_name}</span>
                      ))}
                    </div>
                  </div>
                )}
                {(viewingProspect.member_assignments || []).length > 0 && (
                  <div style={{ gridColumn: '1/-1' }}>
                    <label style={lblStyle}>Assigned Members</label>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 2 }}>
                      {viewingProspect.member_assignments.map(ma => (
                        <span key={ma.user_id} style={{ fontSize: 11, background: 'var(--bg-secondary)', padding: '2px 8px', borderRadius: 4, border: '1px solid var(--border)' }}>{ma.name}</span>
                      ))}
                    </div>
                  </div>
                )}
                {(viewingProspect.tags || []).length > 0 && (
                  <div style={{ gridColumn: '1/-1' }}>
                    <label style={lblStyle}>Tags</label>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 2 }}>
                      {viewingProspect.tags.map(tag => {
                        const opt = tagOptions.find(t => t.name === tag);
                        return (
                          <span key={tag} style={{ fontSize: 11, background: opt ? opt.color + '22' : 'var(--bg-secondary)', color: opt ? opt.color : 'var(--text-secondary)', padding: '2px 8px', borderRadius: 4, border: `1px solid ${opt ? opt.color + '40' : 'var(--border)'}` }}>{tag.toUpperCase()}</span>
                        );
                      })}
                    </div>
                  </div>
                )}
                <div style={{ gridColumn: '1/-1' }}><label style={lblStyle}>Notes</label><p style={{ ...valStyle, whiteSpace: 'pre-wrap' }}>{viewingProspect.notes || '—'}</p></div>
                <div><label style={lblStyle}>Created</label><p style={valStyle}>{formatDate(viewingProspect.created_at)}</p></div>
                <div><label style={lblStyle}>Created By</label><p style={valStyle}>{viewingProspect.created_by_name || '—'}</p></div>
              </div>

              <ProspectTasksSection prospectId={viewingProspect.id} />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
