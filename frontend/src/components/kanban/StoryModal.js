import React, { useState, useEffect } from 'react';
import { X, Save, User, DollarSign, Calendar, Tag, Building, Briefcase, Users } from 'lucide-react';
import api from '../../utils/api';
import PhoneInput from '../PhoneInput';
import toast from 'react-hot-toast';
import './StoryModal.css';

const PRIORITIES = ['low', 'medium', 'high', 'critical'];

const BT_ROLE_LABELS = {
  cgo: 'CGO',
  asd: 'ASD',
  sales_manager: 'Sales Manager',
  sales_executive: 'Sales Executive',
};

export default function StoryModal({
  story,
  columnId,
  columns,
  users,
  existingTeamIds = [],
  existingMemberIds = [],
  onClose,
  onSaved
}) {
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
    business_team_member_id: story?.business_team_member_id || '',
    team_ids: existingTeamIds,
    member_ids: existingMemberIds,
  });

  const [saving, setSaving] = useState(false);
  const [tagInput, setTagInput] = useState('');
  const [businessTeam, setBusinessTeam] = useState([]);
  const [teams, setTeams] = useState([]);

  // Load business team and teams data
  useEffect(() => {
    Promise.all([
      api.get('/business-team').catch(() => ({ data: [] })),
      api.get('/teams').catch(() => ({ data: { teams: [] } })),
    ]).then(([btRes, teamsRes]) => {
      const btData = Array.isArray(btRes.data) ? btRes.data : [];
      setBusinessTeam(btData);
      setTeams(teamsRes.data.teams || []);
    });
  }, []);

  const selectedColumn = columns.find(c => String(c.id) === String(form.column_id));
  const subStages = selectedColumn?.sub_stages || [];

  // Sales managers from business team
  const salesManagers = businessTeam.filter(m => m.role === 'sales_manager');

  // Assignable users: pre_sales_manager and pre_sales_executive
  const assignableUsers = users.filter(u =>
    ['pre_sales_manager', 'pre_sales_executive'].includes(u.role_name)
  );

  // Build hierarchy chain for a selected SM (SM → ASD → CGO)
  const getSmHierarchy = (smId) => {
    if (!smId) return [];
    const chain = [];
    let current = businessTeam.find(m => m.id === parseInt(smId));
    while (current) {
      chain.unshift(current);
      current = current.parent_id ? businessTeam.find(m => m.id === current.parent_id) : null;
    }
    return chain;
  };

  const smHierarchy = getSmHierarchy(form.business_team_member_id);

  const handleChange = (field, value) => {
    setForm(prev => ({
      ...prev,
      [field]: value,
      ...(field === 'column_id' ? { sub_stage_id: '' } : {})
    }));
  };

  const toggleTeam = (teamId) => {
    setForm(prev => ({
      ...prev,
      team_ids: prev.team_ids.includes(teamId)
        ? prev.team_ids.filter(id => id !== teamId)
        : [...prev.team_ids, teamId]
    }));
  };

  const toggleMember = (userId) => {
    setForm(prev => ({
      ...prev,
      member_ids: prev.member_ids.includes(userId)
        ? prev.member_ids.filter(id => id !== userId)
        : [...prev.member_ids, userId]
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
        business_team_member_id: form.business_team_member_id || null,
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
                    <PhoneInput
                      value={form.client_phone}
                      onChange={val => handleChange('client_phone', val)}
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

                {/* Sales Manager from Business Team */}
                <div className="form-group">
                  <label className="form-label"><Briefcase size={12} /> Sales Manager</label>
                  <select
                    className="form-control"
                    value={form.business_team_member_id}
                    onChange={e => handleChange('business_team_member_id', e.target.value)}
                  >
                    <option value="">None</option>
                    {salesManagers.map(sm => (
                      <option key={sm.id} value={sm.id}>{sm.name}</option>
                    ))}
                  </select>
                  {smHierarchy.length > 1 && (
                    <div className="sm-hierarchy">
                      {smHierarchy.map((node, i) => (
                        <span key={node.id} className="sm-hierarchy-node">
                          {i > 0 && <span className="sm-hierarchy-arrow">›</span>}
                          <span className="sm-hierarchy-role">{BT_ROLE_LABELS[node.role] || node.role}</span>
                          <span className="sm-hierarchy-name">{node.name}</span>
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Team Assignment */}
                {teams.length > 0 && (
                  <div className="form-group">
                    <label className="form-label"><Users size={12} /> Assign to Teams</label>
                    <div className="assign-checklist">
                      {teams.map(team => (
                        <label key={team.id} className="assign-check-item">
                          <input
                            type="checkbox"
                            checked={form.team_ids.includes(team.id)}
                            onChange={() => toggleTeam(team.id)}
                          />
                          <span
                            className="assign-check-dot"
                            style={{ background: team.accent_color || '#3e72ae' }}
                          />
                          <span className="assign-check-label">{team.name}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                {/* Individual Member Assignment */}
                {assignableUsers.length > 0 && (
                  <div className="form-group">
                    <label className="form-label"><User size={12} /> Assign Members</label>
                    <div className="assign-checklist">
                      {assignableUsers.map(u => (
                        <label key={u.id} className="assign-check-item">
                          <input
                            type="checkbox"
                            checked={form.member_ids.includes(u.id)}
                            onChange={() => toggleMember(u.id)}
                          />
                          <span className="assign-check-label">
                            {u.first_name} {u.last_name}
                          </span>
                          <span className="assign-check-role">
                            {u.role_name === 'pre_sales_manager' ? 'Manager' : 'Executive'}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

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
