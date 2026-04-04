import React, { useState, useEffect } from 'react';
import { X, Save, User, DollarSign, Calendar, Tag, Building } from 'lucide-react';
import api from '../../utils/api';
import toast from 'react-hot-toast';
import './StoryModal.css';

const PRIORITIES = ['low', 'medium', 'high', 'critical'];

export default function StoryModal({ story, columnId, columns, users, onClose, onSaved }) {
  const isEdit = !!story;

  const [form, setForm] = useState({
    title: story?.title || '',
    description: story?.description || '',
    client_name: story?.client_name || '',
    client_company: story?.client_company || '',
    client_email: story?.client_email || '',
    client_phone: story?.client_phone || '',
    column_id: story?.column_id || columnId || '',
    sub_stage_id: story?.sub_stage_id || '',
    assigned_to: story?.assigned_to || '',
    priority: story?.priority || 'medium',
    estimated_value: story?.estimated_value || '',
    due_date: story?.due_date ? story.due_date.slice(0, 10) : '',
    tags: story?.tags || [],
  });

  const [saving, setSaving] = useState(false);
  const [tagInput, setTagInput] = useState('');

  const selectedColumn = columns.find(c => String(c.id) === String(form.column_id));
  const subStages = selectedColumn?.sub_stages || [];

  const handleChange = (field, value) => {
    setForm(prev => ({
      ...prev,
      [field]: value,
      ...(field === 'column_id' ? { sub_stage_id: '' } : {})
    }));
  };

  const addTag = (e) => {
    if ((e.key === 'Enter' || e.key === ',') && tagInput.trim()) {
      e.preventDefault();
      const tag = tagInput.trim().toLowerCase();
      if (!form.tags.includes(tag)) {
        setForm(prev => ({ ...prev, tags: [...prev.tags, tag] }));
      }
      setTagInput('');
    }
  };

  const removeTag = (tag) => {
    setForm(prev => ({ ...prev, tags: prev.tags.filter(t => t !== tag) }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title.trim() || !form.column_id) {
      toast.error('Title and stage are required');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        ...form,
        estimated_value: form.estimated_value ? parseFloat(form.estimated_value) : null,
        sub_stage_id: form.sub_stage_id || null,
        assigned_to: form.assigned_to || null,
        due_date: form.due_date || null,
      };

      let res;
      if (isEdit) {
        res = await api.put(`/stories/${story.id}`, payload);
        toast.success('Story updated!');
      } else {
        res = await api.post('/stories', payload);
        toast.success('Story created!');
      }

      onSaved(isEdit ? { ...story, ...payload } : res.data.story);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save story');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal modal-lg">
        <div className="modal-header">
          <h2 className="modal-title">{isEdit ? 'Edit Story' : 'Create User Story'}</h2>
          <button className="btn btn-ghost btn-icon" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="story-form-grid">
              {/* Left column */}
              <div className="story-form-main">
                <div className="form-group">
                  <label className="form-label">Story Title *</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g., ABC Corp - CRM Integration Project"
                    value={form.title}
                    onChange={e => handleChange('title', e.target.value)}
                    autoFocus
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Description</label>
                  <textarea
                    className="form-control"
                    placeholder="Describe the requirement, context, and key details..."
                    value={form.description}
                    onChange={e => handleChange('description', e.target.value)}
                    rows={4}
                  />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label"><Building size={12} /> Client Name</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="Contact person"
                      value={form.client_name}
                      onChange={e => handleChange('client_name', e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Company</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="Company name"
                      value={form.client_company}
                      onChange={e => handleChange('client_company', e.target.value)}
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Client Email</label>
                    <input
                      type="email"
                      className="form-control"
                      placeholder="client@company.com"
                      value={form.client_email}
                      onChange={e => handleChange('client_email', e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Client Phone</label>
                    <input
                      type="tel"
                      className="form-control"
                      placeholder="+1 234 567 8900"
                      value={form.client_phone}
                      onChange={e => handleChange('client_phone', e.target.value)}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label"><Tag size={12} /> Tags</label>
                  <div className="tags-input-wrapper">
                    {form.tags.map(tag => (
                      <span key={tag} className="tag-chip">
                        {tag}
                        <button type="button" onClick={() => removeTag(tag)} className="tag-remove">×</button>
                      </span>
                    ))}
                    <input
                      type="text"
                      className="tag-input"
                      placeholder="Type tag + Enter"
                      value={tagInput}
                      onChange={e => setTagInput(e.target.value)}
                      onKeyDown={addTag}
                    />
                  </div>
                </div>
              </div>

              {/* Right sidebar */}
              <div className="story-form-sidebar">
                <div className="form-group">
                  <label className="form-label">Stage *</label>
                  <select
                    className="form-control"
                    value={form.column_id}
                    onChange={e => handleChange('column_id', e.target.value)}
                  >
                    <option value="">Select stage</option>
                    {columns.map(col => (
                      <option key={col.id} value={col.id}>{col.name}</option>
                    ))}
                  </select>
                </div>

                {subStages.length > 0 && (
                  <div className="form-group">
                    <label className="form-label">Sub Stage</label>
                    <select
                      className="form-control"
                      value={form.sub_stage_id}
                      onChange={e => handleChange('sub_stage_id', e.target.value)}
                    >
                      <option value="">Select sub-stage</option>
                      {subStages.map(ss => (
                        <option key={ss.id} value={ss.id}>{ss.name}</option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="form-group">
                  <label className="form-label"><User size={12} /> Assigned To</label>
                  <select
                    className="form-control"
                    value={form.assigned_to}
                    onChange={e => handleChange('assigned_to', e.target.value)}
                  >
                    <option value="">Unassigned</option>
                    {users.map(u => (
                      <option key={u.id} value={u.id}>
                        {u.first_name} {u.last_name}
                      </option>
                    ))}
                  </select>
                </div>

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
                  <label className="form-label"><DollarSign size={12} /> Est. Deal Value</label>
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
                  <label className="form-label"><Calendar size={12} /> Due Date</label>
                  <input
                    type="date"
                    className="form-control"
                    value={form.due_date}
                    onChange={e => handleChange('due_date', e.target.value)}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? <span className="btn-spinner" /> : <Save size={15} />}
              {saving ? 'Saving...' : isEdit ? 'Update Story' : 'Create Story'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
