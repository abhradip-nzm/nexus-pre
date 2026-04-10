import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Pencil, Trash2, ArrowUpCircle, X, Save, DollarSign, Building, User, Phone, Mail, Tag, Layers } from 'lucide-react';
import Header from '../components/layout/Header';
import api from '../utils/api';
import toast from 'react-hot-toast';
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

        <div className="prospects-toolbar">
          <div className="prospects-count">
            {prospects.length} prospect{prospects.length !== 1 ? 's' : ''}
          </div>
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
          <div className="prospects-table-wrapper">
            <table className="prospects-table">
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
                        <div className="prospect-title">{prospect.title}</div>
                        {prospect.source && (
                          <div className="prospect-source">{prospect.source}</div>
                        )}
                      </td>
                      <td>
                        {prospect.company_name ? (
                          <span className="prospect-company">
                            <Building size={12} /> {prospect.company_name}
                          </span>
                        ) : '—'}
                      </td>
                      <td>
                        <div className="prospect-contact">
                          {prospect.contact_name && (
                            <div><User size={11} /> {prospect.contact_name}</div>
                          )}
                          {prospect.contact_email && (
                            <div className="prospect-contact-detail"><Mail size={11} /> {prospect.contact_email}</div>
                          )}
                          {prospect.contact_phone && (
                            <div className="prospect-contact-detail"><Phone size={11} /> {prospect.contact_phone}</div>
                          )}
                          {!prospect.contact_name && !prospect.contact_email && !prospect.contact_phone && '—'}
                        </div>
                      </td>
                      <td>
                        <span
                          className="prospect-priority-badge"
                          style={{ background: `${pColor}20`, color: pColor, border: `1px solid ${pColor}40` }}
                        >
                          {prospect.priority}
                        </span>
                      </td>
                      <td className="prospect-value">{formatValue(prospect.estimated_value)}</td>
                      <td>{prospect.industry_name || '—'}</td>
                      <td className="prospect-date">{formatDate(prospect.created_at)}</td>
                      <td>
                        <div className="prospect-actions">
                          <button
                            className="btn btn-ghost btn-icon-sm"
                            onClick={() => openEdit(prospect)}
                            title="Edit"
                          >
                            <Pencil size={13} />
                          </button>
                          <button
                            className="btn btn-ghost btn-icon-sm btn-danger-hover"
                            onClick={() => setDeleteConfirm(prospect.id)}
                            title="Delete"
                          >
                            <Trash2 size={13} />
                          </button>
                          <button
                            className="btn btn-primary btn-sm prospect-promote-btn"
                            onClick={() => setPromoteConfirm(prospect)}
                            title="Promote to Story"
                          >
                            <ArrowUpCircle size={13} /> Promote
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
    </>
  );
}
