import React, { useState, useEffect } from 'react';
import { Tag, Pencil, Trash2, X, Download } from 'lucide-react';
import Header from '../components/layout/Header';
import api from '../utils/api';
import toast from 'react-hot-toast';
import { exportToExcel } from '../utils/exportExcel';
import { formatDate } from '../utils/helpers';
import './AdminTags.css';

export default function AdminTags() {
  const [tags, setTags] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null); // null = add mode, tag object = edit mode
  const [form, setForm] = useState({ name: '', color: '#3e72ae' });
  const [saving, setSaving] = useState(false);

  const PRESET_COLORS = ['#3e72ae','#16a085','#e74c3c','#f39c12','#9b59b6','#1abc9c','#e67e22','#2ecc71','#3498db','#e91e63'];

  useEffect(() => { loadTags(); }, []);

  const loadTags = async () => {
    try {
      const res = await api.get('/tags');
      setTags(res.data.tags || []);
    } catch { toast.error('Failed to load tags'); }
    finally { setLoading(false); }
  };

  const startEdit = (tag) => {
    setEditing(tag);
    setForm({ name: tag.name, color: tag.color });
  };

  const cancelEdit = () => {
    setEditing(null);
    setForm({ name: '', color: '#3e72ae' });
  };

  const save = async () => {
    if (!form.name.trim()) { toast.error('Tag name required'); return; }
    setSaving(true);
    try {
      if (editing) {
        await api.put(`/tags/${editing.id}`, form);
        toast.success('Tag updated');
      } else {
        await api.post('/tags', form);
        toast.success('Tag created');
      }
      cancelEdit();
      loadTags();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save tag');
    } finally { setSaving(false); }
  };

  const deleteTag = async (tag) => {
    if (!window.confirm(`Delete tag "${tag.name}"?`)) return;
    try {
      await api.delete(`/tags/${tag.id}`);
      toast.success('Tag deleted');
      loadTags();
    } catch { toast.error('Failed to delete tag'); }
  };

  if (loading) return <div className="page-loading"><div className="page-spinner" /></div>;

  return (
    <>
      <Header title="Manage Tags" subtitle="Create and manage tags for user stories" />
      <div className="page-content">
        <div className="tag-mgmt-layout">
          {/* Left: Tag List */}
          <div className="tag-list-panel">
            <div className="tag-list-header">
              <span className="tag-count">{tags.length} tags</span>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => {
                  const data = tags.map(t => ({
                    'Tag Name': t.name,
                    'Created': formatDate(t.created_at),
                  }));
                  exportToExcel(data, 'tags');
                }}
                style={{ display: 'flex', alignItems: 'center', gap: 6 }}
              >
                <Download size={15} /> Export Excel
              </button>
            </div>
            {tags.length === 0 ? (
              <div className="tag-empty">
                <Tag size={36} color="#e2e8f0" />
                <p>No tags yet. Create your first tag.</p>
              </div>
            ) : (
              <div className="tag-items">
                {tags.map(tag => (
                  <div key={tag.id} className={`tag-item ${editing?.id === tag.id ? 'tag-item-active' : ''}`}>
                    <span className="tag-color-dot" style={{ background: tag.color }} />
                    <span className="tag-name">{tag.name}</span>
                    <div className="tag-item-actions">
                      <button className="btn btn-ghost btn-icon btn-xs" onClick={() => startEdit(tag)}>
                        <Pencil size={13} />
                      </button>
                      <button className="btn btn-ghost btn-icon btn-xs tag-delete-btn" onClick={() => deleteTag(tag)}>
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Right: Form Panel */}
          <div className="tag-form-panel">
            <div className="tag-form-header">
              <h3>{editing ? 'Edit Tag' : 'New Tag'}</h3>
              {editing && <button className="btn btn-ghost btn-icon btn-sm" onClick={cancelEdit}><X size={16} /></button>}
            </div>
            <div className="form-group">
              <label className="form-label">Tag Name</label>
              <input
                className="form-control"
                placeholder="e.g. Hot Lead, Follow Up..."
                value={form.name}
                onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                onKeyDown={e => e.key === 'Enter' && save()}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Color</label>
              <div className="color-picker-row">
                <input type="color" className="color-input-native" value={form.color}
                  onChange={e => setForm(p => ({ ...p, color: e.target.value }))} />
                <div className="color-presets">
                  {PRESET_COLORS.map(c => (
                    <button key={c} className={`color-swatch ${form.color === c ? 'color-swatch-active' : ''}`}
                      style={{ background: c }} onClick={() => setForm(p => ({ ...p, color: c }))} />
                  ))}
                </div>
              </div>
            </div>
            <div className="tag-preview">
              <span className="tag-badge-preview" style={{ background: form.color + '22', color: form.color, border: `1.5px solid ${form.color}` }}>
                {form.name || 'Preview'}
              </span>
            </div>
            <div className="tag-form-actions">
              {editing && <button className="btn btn-secondary" onClick={cancelEdit}>Cancel</button>}
              <button className="btn btn-primary" onClick={save} disabled={saving}>
                {saving ? <><span className="btn-spinner" /> Saving...</> : editing ? 'Update Tag' : 'Create Tag'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
