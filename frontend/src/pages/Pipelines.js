import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus, Search, X, Trash2, Pencil, Eye, GitBranch,
  Calendar, Users, ChevronRight, Layers,
} from 'lucide-react';
import Header from '../components/layout/Header';
import api from '../utils/api';
import toast from 'react-hot-toast';
import './Pipelines.css';

// ── Pipeline Form Modal ───────────────────────────────────────────────────────
function PipelineModal({ pipeline, onClose, onSaved }) {
  const isEdit = !!pipeline;
  const [form, setForm] = useState({
    name:       pipeline?.name       || '',
    start_date: pipeline?.start_date ? pipeline.start_date.slice(0, 10) : '',
    end_date:   pipeline?.end_date   ? pipeline.end_date.slice(0, 10)   : '',
    status:     pipeline?.status     || 'active',
  });
  const [saving, setSaving] = useState(false);

  const set = (f, v) => setForm(p => ({ ...p, [f]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) { toast.error('Pipeline name is required'); return; }
    setSaving(true);
    try {
      const payload = {
        name:       form.name.trim(),
        start_date: form.start_date || null,
        end_date:   form.end_date   || null,
        status:     form.status,
      };
      let res;
      if (isEdit) {
        res = await api.put(`/pipelines/${pipeline.id}`, payload);
        toast.success('Pipeline updated!');
      } else {
        res = await api.post('/pipelines', payload);
        toast.success('Pipeline created!');
      }
      onSaved(res.data.pipeline);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save pipeline');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal modal-sm">
        <div className="modal-header">
          <h2 className="modal-title">{isEdit ? 'Edit Pipeline' : 'New Pipeline'}</h2>
          <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body pl-modal-body">
            <div className="form-group">
              <label className="form-label">Pipeline Name <span className="req">*</span></label>
              <input
                className="form-control"
                placeholder="Enter pipeline name"
                value={form.name}
                onChange={e => set('name', e.target.value)}
                autoFocus
              />
            </div>
            <div className="pl-form-row">
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Start Date</label>
                <input className="form-control" type="date" value={form.start_date} onChange={e => set('start_date', e.target.value)} />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">End Date</label>
                <input className="form-control" type="date" value={form.end_date} onChange={e => set('end_date', e.target.value)} />
              </div>
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Status</label>
              <div className="pl-toggle-row">
                <button
                  type="button"
                  className={`toggle-switch ${form.status === 'active' ? 'on' : 'off'}`}
                  onClick={() => set('status', form.status === 'active' ? 'inactive' : 'active')}
                >
                  <span className="toggle-thumb" />
                </button>
                <span className={`pl-toggle-label ${form.status === 'active' ? 'pl-toggle-active' : 'pl-toggle-inactive'}`}>
                  {form.status === 'active' ? 'Active' : 'Inactive'}
                </span>
              </div>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Pipeline'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Delete Confirm ────────────────────────────────────────────────────────────
function DeleteConfirm({ pipeline, onClose, onDeleted }) {
  const [deleting, setDeleting] = useState(false);
  const handle = async () => {
    setDeleting(true);
    try {
      await api.delete(`/pipelines/${pipeline.id}`);
      toast.success('Pipeline deleted');
      onDeleted(pipeline.id);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to delete');
      setDeleting(false);
    }
  };
  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal modal-sm">
        <div className="modal-header">
          <h2 className="modal-title">Delete Pipeline</h2>
          <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="modal-body">
          <p className="pl-confirm-text">
            Are you sure you want to delete <strong>{pipeline.name}</strong>?
            This will permanently remove all leads inside it.
          </p>
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-danger" onClick={handle} disabled={deleting}>
            {deleting ? 'Deleting…' : 'Delete Pipeline'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function Pipelines() {
  const navigate = useNavigate();
  const [pipelines, setPipelines] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState('');
  const [statusFilter, setStatus] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editTarget, setEdit]     = useState(null);
  const [deleteTarget, setDelete] = useState(null);

  const load = useCallback(async () => {
    try {
      const params = {};
      if (search.trim()) params.search = search.trim();
      if (statusFilter)  params.status = statusFilter;
      const res = await api.get('/pipelines', { params });
      setPipelines(res.data.pipelines);
    } catch {
      toast.error('Failed to load pipelines');
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter]);

  useEffect(() => { load(); }, [load]);

  const handleSaved = (saved) => {
    setPipelines(prev => {
      const idx = prev.findIndex(p => p.id === saved.id);
      if (idx >= 0) { const next = [...prev]; next[idx] = saved; return next; }
      return [saved, ...prev];
    });
    setShowModal(false);
    setEdit(null);
  };
  const handleDeleted = (id) => {
    setPipelines(prev => prev.filter(p => p.id !== id));
    setDelete(null);
  };

  const fmt = (d) => d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

  const active     = pipelines.filter(p => p.status === 'active').length;
  const inactive   = pipelines.filter(p => p.status === 'inactive').length;
  const totalLeads = pipelines.reduce((s, p) => s + (p.lead_count || 0), 0);

  return (
    <>
      {showModal && (
        <PipelineModal
          pipeline={editTarget}
          onClose={() => { setShowModal(false); setEdit(null); }}
          onSaved={handleSaved}
        />
      )}
      {deleteTarget && (
        <DeleteConfirm
          pipeline={deleteTarget}
          onClose={() => setDelete(null)}
          onDeleted={handleDeleted}
        />
      )}

      <Header title="Pipelines" subtitle="Manage your sales pipelines and track leads" />
      <div className="page-content pl-page">
        {/* Stats */}
        <div className="pl-stats">
          <div className="pl-stat">
            <div className="pl-stat-icon pl-stat-total"><Layers size={18} /></div>
            <div><div className="pl-stat-val">{pipelines.length}</div><div className="pl-stat-lbl">Total Pipelines</div></div>
          </div>
          <div className="pl-stat">
            <div className="pl-stat-icon pl-stat-active"><GitBranch size={18} /></div>
            <div><div className="pl-stat-val">{active}</div><div className="pl-stat-lbl">Active</div></div>
          </div>
          <div className="pl-stat">
            <div className="pl-stat-icon pl-stat-inactive"><GitBranch size={18} /></div>
            <div><div className="pl-stat-val">{inactive}</div><div className="pl-stat-lbl">Inactive</div></div>
          </div>
          <div className="pl-stat">
            <div className="pl-stat-icon pl-stat-leads"><Users size={18} /></div>
            <div><div className="pl-stat-val">{totalLeads}</div><div className="pl-stat-lbl">Total Leads</div></div>
          </div>
        </div>

        {/* Toolbar */}
        <div className="pl-toolbar">
          <div className="users-search">
            <Search size={14} />
            <input
              className="users-search-input"
              placeholder="Search pipelines…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            {search && <button className="search-clear" onClick={() => setSearch('')}><X size={13} /></button>}
          </div>
          <select className="filter-select" value={statusFilter} onChange={e => setStatus(e.target.value)}>
            <option value="">All Statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
          <div style={{ flex: 1 }} />
          <button className="btn btn-primary" onClick={() => { setEdit(null); setShowModal(true); }}>
            <Plus size={15} /> New Pipeline
          </button>
        </div>

        {/* Cards grid */}
        {loading ? (
          <div className="pl-empty-state">Loading pipelines…</div>
        ) : pipelines.length === 0 ? (
          <div className="pl-empty-state pl-empty-full">
            <Layers size={40} className="pl-empty-icon" />
            <p>No pipelines found</p>
            <button className="btn btn-primary" onClick={() => setShowModal(true)}>
              <Plus size={14} /> Create your first pipeline
            </button>
          </div>
        ) : (
          <div className="pl-grid">
            {pipelines.map(pipe => (
              <div key={pipe.id} className="pl-card">
                <div className="pl-card-header">
                  <div className="pl-card-title">{pipe.name}</div>
                  <span className={`pl-status-badge pl-status-${pipe.status}`}>
                    {pipe.status === 'active' ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <div className="pl-card-meta">
                  <div className="pl-card-meta-row">
                    <Calendar size={12} />
                    <span>{fmt(pipe.start_date)} → {fmt(pipe.end_date)}</span>
                  </div>
                  <div className="pl-card-meta-row">
                    <Users size={12} />
                    <span>{pipe.lead_count} lead{pipe.lead_count !== 1 ? 's' : ''}</span>
                  </div>
                </div>
                <div className="pl-card-actions">
                  <button className="btn btn-secondary btn-sm pl-view-btn" onClick={() => navigate(`/pipelines/${pipe.id}`)}>
                    <Eye size={13} /> View <ChevronRight size={13} />
                  </button>
                  <button className="pl-icon-btn pl-icon-edit" title="Edit" onClick={() => { setEdit(pipe); setShowModal(true); }}>
                    <Pencil size={14} />
                  </button>
                  <button className="pl-icon-btn pl-icon-delete" title="Delete" onClick={() => setDelete(pipe)}>
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
