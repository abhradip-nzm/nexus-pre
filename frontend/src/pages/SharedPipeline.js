import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import {
  Search, X, ChevronDown, ChevronUp, Plus, Pencil,
  Thermometer, Snowflake, CheckCircle2, MinusCircle,
  Globe, Building2, Users, MessageSquarePlus, Trash,
  Clock, AlertCircle,
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../utils/api';
import './SharedPipeline.css';

const LEAD_STATUS       = ['hot', 'cold', 'onboarded', 'no_requirement'];
const LEAD_STATUS_LABELS = { hot: 'Hot', cold: 'Cold', onboarded: 'Onboarded', no_requirement: 'No Requirement' };
const LEAD_STATUS_ICONS  = {
  hot:            <Thermometer size={11} />,
  cold:           <Snowflake size={11} />,
  onboarded:      <CheckCircle2 size={11} />,
  no_requirement: <MinusCircle size={11} />,
};
const LEAD_STATUS_COLORS = { hot: '#e74c3c', cold: '#3498db', onboarded: '#27ae60', no_requirement: '#95a5a6' };

const COUNTRIES = [
  'Afghanistan','Albania','Algeria','Andorra','Angola','Argentina','Armenia','Australia','Austria','Azerbaijan',
  'Bahamas','Bahrain','Bangladesh','Belarus','Belgium','Belize','Benin','Bhutan','Bolivia','Bosnia and Herzegovina',
  'Botswana','Brazil','Brunei','Bulgaria','Burkina Faso','Burundi','Cambodia','Cameroon','Canada','Cape Verde',
  'Central African Republic','Chad','Chile','China','Colombia','Comoros','Congo','Costa Rica','Croatia','Cuba',
  'Cyprus','Czech Republic','Denmark','Djibouti','Dominican Republic','Ecuador','Egypt','El Salvador','Estonia',
  'Eswatini','Ethiopia','Fiji','Finland','France','Gabon','Gambia','Georgia','Germany','Ghana','Greece','Guatemala',
  'Guinea','Haiti','Honduras','Hungary','Iceland','India','Indonesia','Iran','Iraq','Ireland','Israel','Italy',
  'Jamaica','Japan','Jordan','Kazakhstan','Kenya','Kuwait','Kyrgyzstan','Laos','Latvia','Lebanon','Lesotho',
  'Liberia','Libya','Lithuania','Luxembourg','Madagascar','Malawi','Malaysia','Maldives','Mali','Malta',
  'Mauritania','Mauritius','Mexico','Moldova','Monaco','Mongolia','Montenegro','Morocco','Mozambique','Myanmar',
  'Namibia','Nepal','Netherlands','New Zealand','Nicaragua','Niger','Nigeria','North Korea','North Macedonia',
  'Norway','Oman','Pakistan','Palestine','Panama','Papua New Guinea','Paraguay','Peru','Philippines','Poland',
  'Portugal','Qatar','Romania','Russia','Rwanda','Saudi Arabia','Senegal','Serbia','Sierra Leone','Singapore',
  'Slovakia','Slovenia','Somalia','South Africa','South Korea','South Sudan','Spain','Sri Lanka','Sudan',
  'Sweden','Switzerland','Syria','Taiwan','Tajikistan','Tanzania','Thailand','Togo','Trinidad and Tobago',
  'Tunisia','Turkey','Turkmenistan','Uganda','Ukraine','United Arab Emirates','United Kingdom','United States',
  'Uruguay','Uzbekistan','Venezuela','Vietnam','Yemen','Zambia','Zimbabwe',
];

const fmt      = (d) => d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
const fmtShort = (d) => d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) : '';

// ── Identity Modal ────────────────────────────────────────────────────────────
function IdentityModal({ onConfirm }) {
  const [name, setName]   = useState('');
  const [email, setEmail] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim()) { toast.error('Please enter your name'); return; }
    if (!email.trim() || !email.includes('@')) { toast.error('Please enter a valid email'); return; }
    onConfirm({ name: name.trim(), email: email.trim().toLowerCase() });
  };

  return (
    <div className="sp-overlay">
      <div className="sp-identity-card">
        <div className="sp-identity-logo">
          <span className="sp-logo-text">Nexus Pre</span>
        </div>
        <h2 className="sp-identity-title">Who are you?</h2>
        <p className="sp-identity-sub">Please identify yourself before viewing or editing this pipeline.</p>
        <form onSubmit={handleSubmit} className="sp-identity-form">
          <div className="sp-form-group">
            <label className="sp-label">Your Name</label>
            <input
              className="sp-input"
              placeholder="e.g. Jane Smith"
              value={name}
              onChange={e => setName(e.target.value)}
              autoFocus
            />
          </div>
          <div className="sp-form-group">
            <label className="sp-label">Your Email</label>
            <input
              className="sp-input"
              type="email"
              placeholder="e.g. jane@company.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
            />
          </div>
          <button type="submit" className="sp-btn-primary">
            Continue →
          </button>
        </form>
      </div>
    </div>
  );
}

// ── Edit Lead Modal (public) ──────────────────────────────────────────────────
function EditLeadModal({ lead, token, viewer, onClose, onSaved }) {
  const [form, setForm]     = useState({
    account_name: lead.account_name,
    client_name:  lead.client_name,
    country:      lead.country || '',
    status:       lead.status,
  });
  const [updates, setUpdates]     = useState(lead.updates || []);
  const [newNote, setNewNote]     = useState('');
  const [newDate, setNewDate]     = useState(new Date().toISOString().slice(0, 10));
  const [addingNote, setAddingNote] = useState(false);
  const [saving, setSaving]       = useState(false);

  const set = (f, v) => setForm(p => ({ ...p, [f]: v }));

  const handleAddNote = async () => {
    if (!newNote.trim()) return;
    setAddingNote(true);
    try {
      const res = await api.post(`/public/pipeline-share/${token}/leads/${lead.id}/updates`, {
        viewer_name:  viewer.name,
        viewer_email: viewer.email,
        update_text:  newNote.trim(),
        update_date:  newDate,
      });
      setUpdates(prev => [{ ...res.data.update }, ...prev]);
      setNewNote('');
      toast.success('Note added!');
    } catch {
      toast.error('Failed to add note');
    } finally {
      setAddingNote(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await api.put(`/public/pipeline-share/${token}/leads/${lead.id}`, {
        viewer_name:  viewer.name,
        viewer_email: viewer.email,
        account_name: form.account_name,
        client_name:  form.client_name,
        country:      form.country,
        status:       form.status,
      });
      toast.success('Lead updated!');
      onSaved({ ...res.data.lead, updates });
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="sp-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="sp-modal">
        <div className="sp-modal-header">
          <h3>Edit Lead</h3>
          <button className="sp-icon-btn" onClick={onClose}><X size={18} /></button>
        </div>
        <form onSubmit={handleSave}>
          <div className="sp-modal-body">
            <div className="sp-form-grid">
              <div className="sp-form-group">
                <label className="sp-label">Account Name</label>
                <input className="sp-input" value={form.account_name} onChange={e => set('account_name', e.target.value)} />
              </div>
              <div className="sp-form-group">
                <label className="sp-label">Client Name</label>
                <input className="sp-input" value={form.client_name} onChange={e => set('client_name', e.target.value)} />
              </div>
              <div className="sp-form-group">
                <label className="sp-label">Country</label>
                <select className="sp-input" value={form.country} onChange={e => set('country', e.target.value)}>
                  <option value="">— Select Country —</option>
                  {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="sp-form-group">
                <label className="sp-label">Status</label>
                <select className="sp-input" value={form.status} onChange={e => set('status', e.target.value)}>
                  {LEAD_STATUS.map(s => <option key={s} value={s}>{LEAD_STATUS_LABELS[s]}</option>)}
                </select>
              </div>
            </div>

            {/* Add note */}
            <div className="sp-notes-section">
              <div className="sp-notes-title"><MessageSquarePlus size={14} /> Add a Note</div>
              <div className="sp-add-note-row">
                <input
                  className="sp-input"
                  placeholder="Write a note…"
                  value={newNote}
                  onChange={e => setNewNote(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleAddNote())}
                  style={{ flex: 1 }}
                />
                <input
                  type="date"
                  className="sp-input"
                  value={newDate}
                  onChange={e => setNewDate(e.target.value)}
                  style={{ width: 140, flexShrink: 0 }}
                />
                <button type="button" className="sp-btn-primary sp-btn-sm" onClick={handleAddNote} disabled={addingNote}>
                  {addingNote ? '…' : <Plus size={14} />}
                </button>
              </div>
              {updates.length > 0 && (
                <div className="sp-notes-list">
                  {updates.map((u, i) => (
                    <div key={u.id || i} className="sp-note-item">
                      <span className="sp-note-date">{fmtShort(u.update_date)}</span>
                      <span className="sp-note-text">{u.update_text}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="sp-modal-footer">
            <button type="button" className="sp-btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="sp-btn-primary" disabled={saving}>
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Lead Row ──────────────────────────────────────────────────────────────────
function SharedLeadRow({ lead, token, viewer, onUpdated }) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing]   = useState(false);
  const updCount = lead.updates?.length || 0;

  return (
    <>
      <tr className="sp-tr">
        <td className="sp-td">
          <div className="sp-account">{lead.account_name}</div>
          <div className="sp-client-sub">{lead.client_name}</div>
        </td>
        <td className="sp-td sp-td-hide-sm">{lead.business_manager_name || <span className="sp-na">—</span>}</td>
        <td className="sp-td sp-td-hide-sm">{lead.industry_name || <span className="sp-na">—</span>}</td>
        <td className="sp-td sp-td-hide-xs">{lead.country || <span className="sp-na">—</span>}</td>
        <td className="sp-td">
          <span
            className="sp-status-pill"
            style={{
              background: LEAD_STATUS_COLORS[lead.status] + '18',
              color: LEAD_STATUS_COLORS[lead.status],
              border: `1px solid ${LEAD_STATUS_COLORS[lead.status]}40`,
            }}
          >
            {LEAD_STATUS_ICONS[lead.status]} {LEAD_STATUS_LABELS[lead.status]}
          </span>
        </td>
        <td className="sp-td">
          {updCount > 0 ? (
            <button className="sp-upd-expand" onClick={() => setExpanded(p => !p)}>
              {expanded ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
              {updCount}
            </button>
          ) : <span className="sp-na">—</span>}
        </td>
        <td className="sp-td sp-actions-cell">
          <button className="sp-edit-btn" onClick={() => setEditing(true)} title="Edit">
            <Pencil size={13} /> Edit
          </button>
        </td>
      </tr>

      {expanded && updCount > 0 && (
        <tr className="sp-upd-expand-row">
          <td colSpan={7} className="sp-upd-expand-cell">
            <div className="sp-upd-inline-list">
              {lead.updates.map((u, i) => (
                <div key={u.id || i} className="sp-upd-inline-item">
                  <span className="sp-upd-date">{fmtShort(u.update_date)}</span>
                  <span className="sp-upd-text">{u.update_text}</span>
                </div>
              ))}
            </div>
          </td>
        </tr>
      )}

      {editing && (
        <EditLeadModal
          lead={lead}
          token={token}
          viewer={viewer}
          onClose={() => setEditing(false)}
          onSaved={(updated) => { onUpdated(updated); setEditing(false); }}
        />
      )}
    </>
  );
}

// ── Main Shared Pipeline Page ─────────────────────────────────────────────────
export default function SharedPipeline() {
  const { token } = useParams();

  const [pipeline, setPipeline] = useState(null);
  const [leads, setLeads]       = useState([]);
  const [share, setShare]       = useState(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(null);
  const [viewer, setViewer]     = useState(() => {
    try {
      const saved = sessionStorage.getItem('sp_viewer');
      return saved ? JSON.parse(saved) : null;
    } catch { return null; }
  });
  const [search, setSearch]     = useState('');

  useEffect(() => {
    api.get(`/public/pipeline-share/${token}`)
      .then(res => {
        setPipeline(res.data.pipeline);
        setLeads(res.data.leads);
        setShare(res.data.share);
      })
      .catch(err => {
        setError(err.response?.data?.error || 'Failed to load pipeline');
      })
      .finally(() => setLoading(false));
  }, [token]);

  const handleIdentityConfirm = (v) => {
    sessionStorage.setItem('sp_viewer', JSON.stringify(v));
    setViewer(v);
  };

  const handleLeadUpdated = (updated) => {
    setLeads(prev => prev.map(l => l.id === updated.id ? updated : l));
  };

  const filteredLeads = leads.filter(l => {
    if (!search.trim()) return true;
    const s = search.toLowerCase();
    return (
      l.account_name?.toLowerCase().includes(s) ||
      l.client_name?.toLowerCase().includes(s) ||
      l.country?.toLowerCase().includes(s) ||
      l.business_manager_name?.toLowerCase().includes(s) ||
      l.industry_name?.toLowerCase().includes(s)
    );
  });

  const statusCounts = LEAD_STATUS.reduce((acc, s) => {
    acc[s] = leads.filter(l => l.status === s).length;
    return acc;
  }, {});

  if (loading) return (
    <div className="sp-full-center">
      <div className="sp-loading-spinner" />
      <p>Loading pipeline…</p>
    </div>
  );

  if (error) return (
    <div className="sp-full-center">
      <AlertCircle size={40} className="sp-error-icon" />
      <h2>{error}</h2>
      <p>This link may have been deactivated or expired.</p>
    </div>
  );

  return (
    <div className="sp-root">
      {!viewer && <IdentityModal onConfirm={handleIdentityConfirm} />}

      {/* Header */}
      <div className="sp-header">
        <div className="sp-header-inner">
          <div className="sp-brand">Nexus Pre</div>
          <div className="sp-header-meta">
            <h1 className="sp-pipeline-name">{pipeline.name}</h1>
            <div className="sp-pipeline-sub">
              <span>{fmt(pipeline.start_date)} – {fmt(pipeline.end_date)}</span>
              <span className={`sp-pipe-badge sp-pipe-badge-${pipeline.status}`}>
                {pipeline.status === 'active' ? 'Active' : 'Inactive'}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="sp-body">
        {/* Share note */}
        {share?.note && (
          <div className="sp-note-banner">
            <MessageSquarePlus size={14} /> {share.note}
          </div>
        )}

        {/* Viewer info */}
        {viewer && (
          <div className="sp-viewer-bar">
            <CheckCircle2 size={13} style={{ color: '#27ae60' }} />
            Viewing as <strong>{viewer.name}</strong> ({viewer.email}) ·{' '}
            <button
              className="sp-link-btn"
              onClick={() => { sessionStorage.removeItem('sp_viewer'); setViewer(null); }}
            >
              Not you?
            </button>
          </div>
        )}

        {/* Status summary */}
        <div className="sp-status-row">
          {LEAD_STATUS.map(s => (
            <div key={s} className="sp-stat-pill" style={{ borderColor: LEAD_STATUS_COLORS[s] + '55', background: LEAD_STATUS_COLORS[s] + '10' }}>
              <span style={{ color: LEAD_STATUS_COLORS[s] }}>{LEAD_STATUS_ICONS[s]}</span>
              <span style={{ color: LEAD_STATUS_COLORS[s], fontWeight: 600, fontSize: 12 }}>{LEAD_STATUS_LABELS[s]}</span>
              <strong style={{ fontSize: 16 }}>{statusCounts[s]}</strong>
            </div>
          ))}
        </div>

        {/* Search */}
        <div className="sp-search-bar">
          <Search size={14} />
          <input
            className="sp-search-input"
            placeholder="Search leads…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {search && <button className="sp-clear-btn" onClick={() => setSearch('')}><X size={13} /></button>}
          <span className="sp-lead-count">{filteredLeads.length} lead{filteredLeads.length !== 1 ? 's' : ''}</span>
        </div>

        {/* Table */}
        {filteredLeads.length === 0 ? (
          <div className="sp-empty">
            <Users size={36} />
            <p>No leads found.</p>
          </div>
        ) : (
          <div className="sp-table-wrap">
            <table className="sp-table">
              <thead>
                <tr>
                  <th>Account / Client</th>
                  <th className="sp-th-hide-sm">Business Manager</th>
                  <th className="sp-th-hide-sm">Industry</th>
                  <th className="sp-th-hide-xs">Country</th>
                  <th>Status</th>
                  <th>Notes</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filteredLeads.map(lead => (
                  <SharedLeadRow
                    key={lead.id}
                    lead={lead}
                    token={token}
                    viewer={viewer || { name: 'Guest', email: '' }}
                    onUpdated={handleLeadUpdated}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="sp-footer">
          Powered by <strong>Nexus Pre</strong> · This is a shared view — changes are recorded.
        </div>
      </div>
    </div>
  );
}
