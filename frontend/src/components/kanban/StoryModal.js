import React, { useState, useEffect, useRef } from 'react';
import { X, Save, User, DollarSign, Tag, Building, Briefcase, Users, Plus, Layers, Globe } from 'lucide-react';
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

// Reusable multiselect pill component
function MultiSelectPills({ label, icon: Icon, options, selectedIds, onToggle, getOptionId, getOptionLabel, getOptionColor, placeholder }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filtered = options.filter(opt =>
    !selectedIds.includes(getOptionId(opt)) &&
    getOptionLabel(opt).toLowerCase().includes(search.toLowerCase())
  );
  const selected = options.filter(opt => selectedIds.includes(getOptionId(opt)));

  return (
    <div className="form-group" ref={ref}>
      <label className="form-label">{Icon && <Icon size={12} />} {label}</label>
      <div className="tags-input-wrapper" onClick={() => setOpen(true)} style={{ cursor: 'text', minHeight: 36 }}>
        {selected.map(opt => (
          <span key={getOptionId(opt)} className="tag-chip"
            style={getOptionColor ? { background: getOptionColor(opt) + '22', color: getOptionColor(opt) } : {}}>
            {getOptionLabel(opt)}
            <button type="button" className="tag-remove"
              onClick={e => { e.stopPropagation(); onToggle(getOptionId(opt)); }}>×</button>
          </span>
        ))}
        <input
          type="text"
          className="tag-input"
          placeholder={selected.length === 0 ? placeholder : 'Add more...'}
          value={search}
          onChange={e => { setSearch(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
        />
      </div>
      {open && filtered.length > 0 && (
        <div className="tag-autocomplete-dropdown">
          {filtered.slice(0, 10).map(opt => (
            <button key={getOptionId(opt)} type="button" className="tag-autocomplete-option"
              onMouseDown={e => { e.preventDefault(); onToggle(getOptionId(opt)); setSearch(''); }}>
              {getOptionColor && <span className="tag-option-dot" style={{ background: getOptionColor(opt) || '#3e72ae' }} />}
              {getOptionLabel(opt)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function StoryModal({
  story,
  columnId,
  columns,
  users,
  existingTeamIds = [],
  existingMemberIds = [],
  existingIndustryIds = [],
  onClose,
  onSaved
}) {
  const isEdit = !!story;
  const tagInputRef = useRef(null);

  const [form, setForm] = useState({
    title: story?.title || '',
    description: story?.description || '',
    client_name: story?.client_name || '',
    client_company: story?.client_company || '',
    client_email: story?.client_email || '',
    client_phone: story?.client_phone || '',
    country: story?.country || '',
    column_id: story?.column_id || columnId || '',
    sub_stage_id: story?.sub_stage_id || '',
    priority: story?.priority || 'medium',
    estimated_value: story?.estimated_value || '',
    effective_start_date: story?.effective_start_date ? story.effective_start_date.slice(0, 10) : '',
    tags: story?.tags || [],
    business_team_member_id: story?.business_team_member_id || '',
    team_ids: existingTeamIds,
    member_ids: existingMemberIds,
    industry_ids: existingIndustryIds,
    assignment_type: existingTeamIds.length > 0 ? 'team' : existingMemberIds.length > 0 ? 'member' : '',
  });

  const [saving, setSaving] = useState(false);
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [tagInput, setTagInput] = useState('');
  const [showTagDropdown, setShowTagDropdown] = useState(false);
  const [businessTeam, setBusinessTeam] = useState([]);
  const [teams, setTeams] = useState([]);
  const [tagOptions, setTagOptions] = useState([]);
  const [industryOptions, setIndustryOptions] = useState([]);

  useEffect(() => {
    setLoadingOptions(true);
    Promise.all([
      api.get('/business-team').catch(() => ({ data: [] })),
      api.get('/teams').catch(() => ({ data: { teams: [] } })),
      api.get('/tags').catch(() => ({ data: { tags: [] } })),
      api.get('/industries').catch(() => ({ data: { industries: [] } })),
    ]).then(([btRes, teamsRes, tagsRes, indRes]) => {
      setBusinessTeam(Array.isArray(btRes.data) ? btRes.data : []);
      setTeams(teamsRes.data.teams || []);
      setTagOptions(tagsRes.data.tags || []);
      setIndustryOptions(indRes.data.industries || []);
    }).finally(() => setLoadingOptions(false));
  }, []);

  const selectedColumn = columns.find(c => String(c.id) === String(form.column_id));
  const subStages = selectedColumn?.sub_stages || [];
  const salesExecutives = businessTeam.filter(m => m.role === 'sales_executive');
  const assignableUsers = users.filter(u => ['pre_sales_manager', 'pre_sales_executive'].includes(u.role_name));

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

  const seHierarchy = getSmHierarchy(form.business_team_member_id);

  const filteredTagOptions = tagOptions.filter(t =>
    !form.tags.includes(t.name) &&
    (tagInput.trim() === '' || t.name.toLowerCase().includes(tagInput.toLowerCase()))
  );

  const handleChange = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value, ...(field === 'column_id' ? { sub_stage_id: '' } : {}) }));
  };

  const addTagByName = (name) => {
    const tag = name.trim().toLowerCase();
    if (tag && !form.tags.includes(tag)) setForm(prev => ({ ...prev, tags: [...prev.tags, tag] }));
    setTagInput(''); setShowTagDropdown(false);
  };
  const handleTagKeyDown = (e) => {
    if ((e.key === 'Enter' || e.key === ',') && tagInput.trim()) { e.preventDefault(); addTagByName(tagInput); }
    if (e.key === 'Escape') setShowTagDropdown(false);
  };
  const removeTag = (tag) => setForm(prev => ({ ...prev, tags: prev.tags.filter(t => t !== tag) }));

  const setAssignmentType = (type) => {
    setForm(prev => ({
      ...prev,
      assignment_type: type,
      team_ids: type === 'member' ? [] : prev.team_ids,
      member_ids: type === 'team' ? [] : prev.member_ids,
    }));
  };

  const toggleTeam = (teamId) => {
    setForm(prev => ({
      ...prev,
      assignment_type: 'team',
      member_ids: [],
      team_ids: prev.team_ids.includes(teamId)
        ? prev.team_ids.filter(id => id !== teamId)
        : [...prev.team_ids, teamId]
    }));
  };

  const toggleMember = (userId) => {
    setForm(prev => ({
      ...prev,
      assignment_type: 'member',
      team_ids: [],
      member_ids: prev.member_ids.includes(userId)
        ? prev.member_ids.filter(id => id !== userId)
        : [...prev.member_ids, userId]
    }));
  };

  const toggleIndustry = (industryId) => {
    setForm(prev => ({
      ...prev,
      industry_ids: prev.industry_ids.includes(industryId)
        ? prev.industry_ids.filter(id => id !== industryId)
        : [...prev.industry_ids, industryId]
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title.trim() || !form.column_id) { toast.error('Title and stage are required'); return; }
    setSaving(true);
    try {
      const payload = {
        ...form,
        estimated_value: form.estimated_value ? parseFloat(form.estimated_value) : null,
        sub_stage_id: form.sub_stage_id || null,
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
          <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={18} /></button>
        </div>

        <form key={story?.id || 'new'} onSubmit={handleSubmit} style={{ display: 'contents' }}>
          <div className="modal-body">
            <div className="story-form-grid">
              {/* Left column */}
              <div className="story-form-main">
                <div className="form-group">
                  <label className="form-label">Story Title *</label>
                  <input type="text" className="form-control" placeholder="e.g., ABC Corp - CRM Integration Project"
                    value={form.title} onChange={e => handleChange('title', e.target.value)} autoFocus />
                </div>
                <div className="form-group">
                  <label className="form-label">Description</label>
                  <textarea className="form-control" placeholder="Describe the requirement..." value={form.description}
                    onChange={e => handleChange('description', e.target.value)} rows={3} />
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label"><Building size={12} /> Client Name</label>
                    <input type="text" className="form-control" placeholder="Contact person" value={form.client_name}
                      onChange={e => handleChange('client_name', e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Company</label>
                    <input type="text" className="form-control" placeholder="Company name" value={form.client_company}
                      onChange={e => handleChange('client_company', e.target.value)} />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Client Email</label>
                    <input type="email" className="form-control" placeholder="client@company.com" value={form.client_email}
                      onChange={e => handleChange('client_email', e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Client Phone</label>
                    <PhoneInput value={form.client_phone} onChange={val => handleChange('client_phone', val)} />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label"><Globe size={12} /> Country</label>
                  <select className="form-control" value={form.country} onChange={e => handleChange('country', e.target.value)}>
                    <option value="">Select country</option>
                    {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>

                {/* Industries multiselect pills */}
                {industryOptions.length > 0 && (
                  <MultiSelectPills
                    label="Industries" icon={Layers}
                    options={industryOptions}
                    selectedIds={form.industry_ids}
                    onToggle={toggleIndustry}
                    getOptionId={o => o.id}
                    getOptionLabel={o => o.name}
                    placeholder="Select industries..."
                  />
                )}

                {/* Tags */}
                <div className="form-group" style={{ position: 'relative' }}>
                  <label className="form-label"><Tag size={12} /> Tags</label>
                  <div className="tags-input-wrapper">
                    {form.tags.map(tag => {
                      const opt = tagOptions.find(t => t.name === tag);
                      return (
                        <span key={tag} className="tag-chip" style={opt ? { background: opt.color + '22', color: opt.color } : {}}>
                          {tag}
                          <button type="button" onClick={() => removeTag(tag)} className="tag-remove">×</button>
                        </span>
                      );
                    })}
                    <input ref={tagInputRef} type="text" className="tag-input"
                      placeholder={form.tags.length === 0 ? "Type or select a tag..." : "Add more..."}
                      value={tagInput} onChange={e => { setTagInput(e.target.value); setShowTagDropdown(true); }}
                      onFocus={() => setShowTagDropdown(true)}
                      onBlur={() => setTimeout(() => setShowTagDropdown(false), 150)}
                      onKeyDown={handleTagKeyDown} />
                  </div>
                  {showTagDropdown && (filteredTagOptions.length > 0 || tagInput.trim()) && (
                    <div className="tag-autocomplete-dropdown">
                      {filteredTagOptions.slice(0, 8).map(t => (
                        <button key={t.id} type="button" className="tag-autocomplete-option"
                          onMouseDown={e => { e.preventDefault(); addTagByName(t.name); }}>
                          <span className="tag-option-dot" style={{ background: t.color || '#3e72ae' }} />
                          {t.name}
                        </button>
                      ))}
                      {tagInput.trim() && !filteredTagOptions.some(t => t.name.toLowerCase() === tagInput.toLowerCase()) && (
                        <button type="button" className="tag-autocomplete-option tag-create-new"
                          onMouseDown={e => { e.preventDefault(); addTagByName(tagInput); }}>
                          <Plus size={11} /> Create "{tagInput}"
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Right sidebar */}
              <div className="story-form-sidebar">
                <div className="form-group">
                  <label className="form-label">Stage *</label>
                  <select className="form-control" value={form.column_id} onChange={e => handleChange('column_id', e.target.value)}>
                    <option value="">Select stage</option>
                    {columns.map(col => <option key={col.id} value={col.id}>{col.name}</option>)}
                  </select>
                </div>
                {subStages.length > 0 && (
                  <div className="form-group">
                    <label className="form-label">Sub Stage</label>
                    <select className="form-control" value={form.sub_stage_id} onChange={e => handleChange('sub_stage_id', e.target.value)}>
                      <option value="">Select sub-stage</option>
                      {subStages.map(ss => <option key={ss.id} value={ss.id}>{ss.name}</option>)}
                    </select>
                  </div>
                )}
                <div className="form-group">
                  <label className="form-label">Priority</label>
                  <div className="priority-selector">
                    {PRIORITIES.map(p => (
                      <button key={p} type="button" className={`priority-btn ${form.priority === p ? 'active' : ''} priority-${p}`}
                        onClick={() => handleChange('priority', p)}>{p}</button>
                    ))}
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label"><DollarSign size={12} /> Est. Value</label>
                  <input type="number" className="form-control" placeholder="0.00" value={form.estimated_value}
                    onChange={e => handleChange('estimated_value', e.target.value)} min="0" step="100" />
                </div>
                <div className="form-group">
                  <label className="form-label">Effective Start Date</label>
                  <input type="date" className="form-control" value={form.effective_start_date}
                    onChange={e => handleChange('effective_start_date', e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label"><Briefcase size={12} /> Sales Executive</label>
                  <select className="form-control" value={form.business_team_member_id}
                    onChange={e => handleChange('business_team_member_id', e.target.value)}>
                    <option value="">None</option>
                    {salesExecutives.map(se => <option key={se.id} value={se.id}>{se.name}</option>)}
                  </select>
                  {seHierarchy.length > 1 && (
                    <div className="sm-hierarchy">
                      {seHierarchy.map((node, i) => (
                        <span key={node.id} className="sm-hierarchy-node">
                          {i > 0 && <span className="sm-hierarchy-arrow">›</span>}
                          <span className="sm-hierarchy-role">{BT_ROLE_LABELS[node.role] || node.role}</span>
                          <span className="sm-hierarchy-name">{node.name}</span>
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Assignment: Teams OR Members (mutually exclusive) */}
                <div className="form-group">
                  <label className="form-label" style={{ marginBottom: 8 }}>Assignment</label>
                  <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                    <button type="button"
                      className={`btn btn-sm ${form.assignment_type !== 'member' ? 'btn-primary' : 'btn-secondary'}`}
                      style={{ flex: 1, fontSize: 12 }}
                      onClick={() => setAssignmentType('team')}>
                      <Users size={11} /> Assigned Teams
                    </button>
                    <button type="button"
                      className={`btn btn-sm ${form.assignment_type === 'member' ? 'btn-primary' : 'btn-secondary'}`}
                      style={{ flex: 1, fontSize: 12 }}
                      onClick={() => setAssignmentType('member')}>
                      <User size={11} /> Assigned Members
                    </button>
                  </div>

                  {(form.assignment_type !== 'member') && teams.length > 0 && (
                    <MultiSelectPills
                      label="Assigned Teams" icon={Users}
                      options={teams}
                      selectedIds={form.team_ids}
                      onToggle={toggleTeam}
                      getOptionId={o => o.id}
                      getOptionLabel={o => o.name}
                      getOptionColor={o => o.accent_color}
                      placeholder="Select teams..."
                    />
                  )}

                  {form.assignment_type === 'member' && assignableUsers.length > 0 && (
                    <MultiSelectPills
                      label="Assigned Members" icon={User}
                      options={assignableUsers}
                      selectedIds={form.member_ids}
                      onToggle={toggleMember}
                      getOptionId={o => o.id}
                      getOptionLabel={o => `${o.first_name} ${o.last_name}`}
                      placeholder="Select members..."
                    />
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
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
