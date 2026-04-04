import React, { useState, useEffect } from 'react';
import { Building2, Plus, Pencil, Trash2, X } from 'lucide-react';
import Header from '../components/layout/Header';
import api from '../utils/api';
import toast from 'react-hot-toast';
import './AdminIndustries.css';

export default function AdminIndustries() {
  const [industries, setIndustries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => { loadIndustries(); }, []);

  const loadIndustries = async () => {
    try {
      const res = await api.get('/industries');
      setIndustries(res.data.industries || []);
    } catch { toast.error('Failed to load industries'); }
    finally { setLoading(false); }
  };

  const startEdit = (industry) => {
    setEditing(industry);
    setForm({ name: industry.name });
  };

  const cancelEdit = () => {
    setEditing(null);
    setForm({ name: '' });
  };

  const save = async () => {
    if (!form.name.trim()) { toast.error('Industry name required'); return; }
    setSaving(true);
    try {
      if (editing) {
        await api.put(`/industries/${editing.id}`, form);
        toast.success('Industry updated');
      } else {
        await api.post('/industries', form);
        toast.success('Industry created');
      }
      cancelEdit();
      loadIndustries();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save industry');
    } finally { setSaving(false); }
  };

  const deleteIndustry = async (ind) => {
    if (!window.confirm(`Delete industry "${ind.name}"?`)) return;
    try {
      await api.delete(`/industries/${ind.id}`);
      toast.success('Industry deleted');
      loadIndustries();
    } catch { toast.error('Failed to delete industry'); }
  };

  if (loading) return <div className="page-loading"><div className="page-spinner" /></div>;

  return (
    <>
      <Header title="Manage Industries" subtitle="Define industries available for user stories" />
      <div className="page-content">
        <div className="ind-mgmt-layout">
          {/* Left: List */}
          <div className="ind-list-panel">
            <div className="ind-list-header">
              <span className="ind-count">{industries.length} industries</span>
              <button className="btn btn-primary btn-sm" onClick={cancelEdit}>
                <Plus size={14} /> New Industry
              </button>
            </div>
            {industries.length === 0 ? (
              <div className="ind-empty">
                <Building2 size={36} color="#e2e8f0" />
                <p>No industries yet. Add your first industry.</p>
              </div>
            ) : (
              <div className="ind-items">
                {industries.map((ind, idx) => (
                  <div key={ind.id} className={`ind-item ${editing?.id === ind.id ? 'ind-item-active' : ''}`}>
                    <span className="ind-number">{idx + 1}</span>
                    <span className="ind-name">{ind.name}</span>
                    <div className="ind-item-actions">
                      <button className="btn btn-ghost btn-icon btn-xs" onClick={() => startEdit(ind)}>
                        <Pencil size={13} />
                      </button>
                      <button className="btn btn-ghost btn-icon btn-xs ind-delete-btn" onClick={() => deleteIndustry(ind)}>
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Right: Form */}
          <div className="ind-form-panel">
            <div className="ind-form-header">
              <h3>{editing ? 'Edit Industry' : 'New Industry'}</h3>
              {editing && <button className="btn btn-ghost btn-icon btn-sm" onClick={cancelEdit}><X size={16} /></button>}
            </div>
            <div className="form-group">
              <label className="form-label">Industry Name</label>
              <input
                className="form-control"
                placeholder="e.g. Healthcare, Finance, Retail..."
                value={form.name}
                onChange={e => setForm({ name: e.target.value })}
                onKeyDown={e => e.key === 'Enter' && save()}
              />
            </div>
            <div className="ind-form-actions">
              {editing && <button className="btn btn-secondary" onClick={cancelEdit}>Cancel</button>}
              <button className="btn btn-primary" onClick={save} disabled={saving}>
                {saving ? 'Saving...' : editing ? 'Update' : 'Add Industry'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
