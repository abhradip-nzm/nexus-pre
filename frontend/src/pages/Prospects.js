import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Pencil, Trash2, ArrowUpCircle, X, Save, DollarSign, Building, User, Phone, Mail, Tag, Layers, Download, Eye, Check } from 'lucide-react';
import Header from '../components/layout/Header';
import api from '../utils/api';
import toast from 'react-hot-toast';
import { exportToExcel } from '../utils/exportExcel';
import './Prospects.css';

const PRIORITIES = ['low', 'medium', 'high', 'critical'];

const PRIORITY_COLORS = {
  critical: '#dc3545',
  high: '#e67e22',
  medium: '#f59e0b',
  low: '#28a745',
};

const emptyForm = {
  title: '',
  company_name: '',
  contact_name: '',
  contact_email: '',
  contact_phone: '',
  source: '',
  priority: 'medium',
  estimated_value: '',
  industry_id: '',
  notes: '',
};

function ProspectTasksSection({ prospectId }) {
  const [tasks, setTasks] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newStartDate, setNewStartDate] = useState('');
  const [newDueDate, setNewDueDate] = useState('');
  const [completingTask, setCompletingTask] = useState(null);
  const [responseDetails, setResponseDetails] = useState('');

  useEffect(() => {
    api.get(`/prospects/${prospectId}/tasks`).then(r => setTasks(r.data.tasks || []));
  }, [prospectId]);

  const addTask = async () => {
    if (!newTitle.trim()) return;
    const res = await api.post(`/prospects/${prospectId}/tasks`, { title: newTitle, start_date: newStartDate || null, due_date: newDueDate || null });
    setTasks(prev => [...prev, res.data.task]);
    setNewTitle(''); setNewStartDate(''); setNewDueDate(''); setShowForm(false);
  };

  const toggleTask = (task) => {
    if (task.status !== 'done') { setCompletingTask(task); setResponseDetails(''); return; }
    api.put(`/prospect-tasks/${task.id}`, { status: 'todo' }).then(() => {
      setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: 'todo', completed_at: null } : t));
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

      {showForm && (
        <div style={{ background: 'var(--bg-secondary)', borderRadius: 8, padding: 12, marginBottom: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
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
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-primary btn-sm" onClick={addTask} disabled={!newTitle.trim()}>Add</button>
            <button className="btn btn-ghost btn-sm" onClick={() => { setShowForm(false); setNewTitle(''); }}>Cancel</button>
          </div>
        </div>
      )}

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

      {tasks.length === 0 && !showForm ? (
        <p style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic' }}>No tasks yet.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {tasks.map(task => {
            const isDone = task.status === 'done';
            return (
              <div key={task.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '8px 10px', background: isDone ? '#f8fffe' : 'white', border: '1px solid var(--border-light)', borderRadius: 8 }}>
                <button
                  onClick={() => toggleTask(task)}
                  style={{ width: 18, height: 18, borderRadius: '50%', border: isDone ? 'none' : '2px solid var(--border)', background: isDone ? '#16a34a' : 'transparent', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0, marginTop: 2 }}
                  title={isDone ? 'Mark incomplete' : 'Mark complete'}
                >
                  {isDone && <Check size={10} />}
                </button>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: isDone ? 'var(--text-muted)' : 'var(--text-primary)', textDecoration: isDone ? 'line-through' : 'none' }}>{task.title}</div>
                  {task.response_details && (
                    <div style={{ marginTop: 4, padding: '4px 8px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 5, fontSize: 11, color: '#166534' }}>
                      <strong>Response:</strong> {task.response_details}
                    </div>
                  )}
                  {(task.start_date || task.due_date) && (
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>
                      {task.start_date ? new Date(task.start_date).toLocaleDateString() : '—'} → {task.due_date ? new Date(task.due_date).toLocaleDateString() : 'No due date'}
                    </div>
                  )}
                </div>
                <button onClick={() => deleteTask(task.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 2, display: 'flex', alignItems: 'center' }} title="Delete">
                  <Trash2 size={12} />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function Prospects() {
  const [prospects, setProspects] = useState([]);
  const [industries, setIndustries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingProspect, setEditingProspect] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [promoteConfirm, setPromoteConfirm] = useState(null);
  const [promoting, setPromoting] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [viewingProspect, setViewingProspect] = useState(null);

  const lblStyle = { fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', display: 'block', marginBottom: 4 };
  const valStyle = { fontSize: 13, color: 'var(--text-primary)', margin: 0 };

  const loadData = useCallback(async () => {
    try {
      const [prospectsRes, industriesRes] = await Promise.all([
        api.get('/prospects'),
        api.get('/industries').catch(() => ({ data: { industries: [] } })),
      ]);
      setProspects(prospectsRes.data || []);
      setIndustries(industriesRes.data.industries || []);
    } catch {
      toast.error('Failed to load prospects');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const openCreate = () => {
    setEditingProspect(null);
    setForm(emptyForm);
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
      industry_id: prospect.industry_id || '',
      notes: prospect.notes || '',
    });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingProspect(null);
    setForm(emptyForm);
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
        industry_id: form.industry_id || null,
      };
      if (editingProspect) {
        await api.put(`/prospects/${editingProspect.id}`, payload);
        toast.success('Prospect updated');
      } else {
        await api.post('/prospects', payload);
        toast.success('Prospect created');
      }
      closeModal();
      loadData();
    } catch {
      toast.error('Failed to save prospect');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await api.delete(`/prospects/${id}`);
      setProspects(prev => prev.filter(p => p.id !== id));
      setDeleteConfirm(null);
      toast.success('Prospect deleted');
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
      loadData();
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

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  if (loading) return (
    <div className="page-loading">
      <div className="page-spinner" />
      <p>Loading prospects...</p>
    </div>
  );

  return (
    <>
      <Header title="Probable Prospects" subtitle="Manage and track potential opportunities before promoting to the pipeline" />
      <div className="page-content prospects-page">

        <div className="users-toolbar">
          <div className="users-stats">
            <span className="stat-pill">{prospects.length} prospect{prospects.length !== 1 ? 's' : ''}</span>
          </div>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => {
              const data = prospects.map(p => ({
                'Title': p.title,
                'Company': p.company_name || '',
                'Contact Name': p.contact_name || '',
                'Email': p.contact_email || '',
                'Phone': p.contact_phone || '',
                'Source': p.source || '',
                'Priority': p.priority || '',
                'Estimated Value': p.estimated_value || '',
                'Industry': p.industry_name || '',
                'Notes': p.notes || '',
                'Created': p.created_at ? new Date(p.created_at).toLocaleDateString() : '',
              }));
              exportToExcel(data, 'prospects');
            }}
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <Download size={15} /> Export Excel
          </button>
          <button className="btn btn-primary btn-sm" onClick={openCreate}>
            <Plus size={14} /> Add Prospect
          </button>
        </div>

        {prospects.length === 0 ? (
          <div className="prospects-empty">
            <div className="prospects-empty-icon">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            </div>
            <p>No prospects yet. Add your first probable prospect to get started.</p>
            <button className="btn btn-primary" onClick={openCreate}>
              <Plus size={14} /> Add Prospect
            </button>
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
                  <th>Industry</th>
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
                          {prospect.priority}
                        </span>
                      </td>
                      <td style={{ fontWeight: 500, color: 'var(--success)' }}>{formatValue(prospect.estimated_value)}</td>
                      <td>{prospect.industry_name || <span className="user-email">—</span>}</td>
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

                    {industries.length > 0 && (
                      <div className="form-group">
                        <label className="form-label"><Layers size={12} /> Industry</label>
                        <select
                          className="form-control"
                          value={form.industry_id}
                          onChange={e => handleChange('industry_id', e.target.value)}
                        >
                          <option value="">Select industry</option>
                          {industries.map(ind => (
                            <option key={ind.id} value={ind.id}>{ind.name}</option>
                          ))}
                        </select>
                      </div>
                    )}
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
                    {viewingProspect.priority}
                  </span>
                </div>
                <div><label style={lblStyle}>Contact Name</label><p style={valStyle}>{viewingProspect.contact_name || '—'}</p></div>
                <div><label style={lblStyle}>Contact Email</label><p style={valStyle}>{viewingProspect.contact_email || '—'}</p></div>
                <div><label style={lblStyle}>Contact Phone</label><p style={valStyle}>{viewingProspect.contact_phone || '—'}</p></div>
                <div><label style={lblStyle}>Source</label><p style={valStyle}>{viewingProspect.source || '—'}</p></div>
                <div><label style={lblStyle}>Estimated Value</label><p style={valStyle}>{formatValue(viewingProspect.estimated_value)}</p></div>
                <div><label style={lblStyle}>Industry</label><p style={valStyle}>{viewingProspect.industry_name || '—'}</p></div>
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
