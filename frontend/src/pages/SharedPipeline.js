import React, { useState, useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import {
  Search, X, ChevronDown, ChevronUp, Plus, Pencil,
  Thermometer, Snowflake, CheckCircle2, MinusCircle,
  Users, MessageSquarePlus, Clock,
  AlertCircle, BarChart2, ClipboardList, Building2, Globe, UserCheck,
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../utils/api';
import './SharedPipeline.css';

const CHART_COLORS = ['#3e72ae','#e67e22','#27ae60','#e74c3c','#8b5cf6','#14b8a6','#f59e0b','#ec4899'];

const LEAD_STATUS        = ['hot', 'cold', 'onboarded', 'no_requirement'];
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
    if (!name.trim())  { toast.error('Please enter your name'); return; }
    if (!email.trim() || !email.includes('@')) { toast.error('Please enter a valid email'); return; }
    onConfirm({ name: name.trim(), email: email.trim().toLowerCase() });
  };

  return (
    <div className="sp-overlay">
      <div className="sp-identity-card">
        <div className="sp-identity-top">
          <div className="sp-identity-logo-mark">N</div>
          <h2>Identify Yourself</h2>
          <p>Please enter your name and email before viewing or editing this pipeline.</p>
        </div>
        <div className="sp-identity-body">
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
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
    </div>
  );
}

// ── Edit Lead Modal (public) ──────────────────────────────────────────────────
function EditLeadModal({ lead, token, viewer, onClose, onSaved }) {
  const [form, setForm]         = useState({
    account_name: lead.account_name,
    client_name:  lead.client_name,
    country:      lead.country || '',
    status:       lead.status,
  });
  const [updates, setUpdates]   = useState(lead.updates || []);
  const [newNote, setNewNote]   = useState('');
  const [newDate, setNewDate]   = useState(new Date().toISOString().slice(0, 10));
  const [addingNote, setAddingNote] = useState(false);
  const [saving, setSaving]     = useState(false);

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
        <div className="sp-modal-handle" />
        <div className="sp-modal-header">
          <h3>Edit Lead</h3>
          <button className="sp-icon-btn" onClick={onClose}><X size={18} /></button>
        </div>
        <form onSubmit={handleSave} style={{ display: 'contents' }}>
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
                  style={{ flex: 1, minWidth: 120 }}
                />
                <input
                  type="date"
                  className="sp-input sp-add-note-date"
                  value={newDate}
                  onChange={e => setNewDate(e.target.value)}
                />
                <button
                  type="button"
                  className="sp-btn-primary-sm"
                  onClick={handleAddNote}
                  disabled={addingNote}
                  style={{ flexShrink: 0, padding: '9px 14px' }}
                >
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
            <button type="submit" className="sp-btn-primary-sm" disabled={saving} style={{ padding: '9px 20px' }}>
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Lead Card (mobile) ────────────────────────────────────────────────────────
function SharedLeadCard({ lead, token, viewer, onUpdated }) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing]   = useState(false);
  const updCount = lead.updates?.length || 0;
  const color    = LEAD_STATUS_COLORS[lead.status];

  return (
    <div className="sp-lead-card">
      {/* Top: account + status */}
      <div className="sp-card-top">
        <div className="sp-card-main">
          <div className="sp-card-account">{lead.account_name}</div>
          <div className="sp-card-client">{lead.client_name}</div>
        </div>
        <div className="sp-card-status">
          <span
            className="sp-status-pill"
            style={{ background: color + '18', color, border: `1px solid ${color}40` }}
          >
            {LEAD_STATUS_ICONS[lead.status]} {LEAD_STATUS_LABELS[lead.status]}
          </span>
        </div>
      </div>

      {/* Meta: BM, industry, country */}
      <div className="sp-card-meta">
        <div className="sp-card-meta-item">
          <span className="sp-card-meta-label">Business Manager</span>
          <span className="sp-card-meta-value">{lead.business_manager_name || '—'}</span>
        </div>
        <div className="sp-card-meta-item">
          <span className="sp-card-meta-label">Industry</span>
          <span className="sp-card-meta-value">{lead.industry_name || '—'}</span>
        </div>
        <div className="sp-card-meta-item">
          <span className="sp-card-meta-label">Country</span>
          <span className="sp-card-meta-value">{lead.country || '—'}</span>
        </div>
      </div>

      {/* Footer: notes toggle + edit */}
      <div className="sp-card-footer">
        {updCount > 0 ? (
          <button className="sp-card-upd-btn" onClick={() => setExpanded(p => !p)}>
            {expanded ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
            {updCount} note{updCount !== 1 ? 's' : ''}
          </button>
        ) : (
          <span style={{ fontSize: 12, color: '#c5cdd8' }}>No notes</span>
        )}
        <button className="sp-card-edit-btn" onClick={() => setEditing(true)}>
          <Pencil size={13} /> Edit
        </button>
      </div>

      {/* Expanded notes */}
      {expanded && updCount > 0 && (
        <div className="sp-card-notes">
          {lead.updates.map((u, i) => (
            <div key={u.id || i} className="sp-card-note-item">
              <span className="sp-card-note-date">{fmtShort(u.update_date)}</span>
              <span className="sp-card-note-text">{u.update_text}</span>
            </div>
          ))}
        </div>
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
    </div>
  );
}

// ── Lead Row (desktop table) ──────────────────────────────────────────────────
function SharedLeadRow({ lead, token, viewer, onUpdated }) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing]   = useState(false);
  const updCount = lead.updates?.length || 0;
  const color    = LEAD_STATUS_COLORS[lead.status];

  return (
    <>
      <tr className="sp-tr">
        <td className="sp-td">
          <div className="sp-account">{lead.account_name}</div>
          <div className="sp-client-sub">{lead.client_name}</div>
        </td>
        <td className="sp-td">{lead.business_manager_name || <span className="sp-na">—</span>}</td>
        <td className="sp-td">{lead.industry_name || <span className="sp-na">—</span>}</td>
        <td className="sp-td">{lead.country || <span className="sp-na">—</span>}</td>
        <td className="sp-td">
          <span
            className="sp-status-pill"
            style={{ background: color + '18', color, border: `1px solid ${color}40` }}
          >
            {LEAD_STATUS_ICONS[lead.status]} {LEAD_STATUS_LABELS[lead.status]}
          </span>
        </td>
        <td className="sp-td">
          {updCount > 0 ? (
            <button className="sp-upd-expand" onClick={() => setExpanded(p => !p)}>
              {expanded ? <ChevronUp size={11} /> : <ChevronDown size={11} />} {updCount}
            </button>
          ) : <span className="sp-na">—</span>}
        </td>
        <td className="sp-td">
          <button className="sp-edit-btn" onClick={() => setEditing(true)}>
            <Pencil size={13} /> Edit
          </button>
        </td>
      </tr>

      {expanded && updCount > 0 && (
        <tr className="sp-upd-expand-row">
          <td colSpan={7} className="sp-td">
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

  const [pipeline, setPipeline]     = useState(null);
  const [leads, setLeads]           = useState([]);
  const [share, setShare]           = useState(null);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState(null);
  const [viewer, setViewer]         = useState(() => {
    try {
      const saved = sessionStorage.getItem('sp_viewer');
      return saved ? JSON.parse(saved) : null;
    } catch { return null; }
  });
  const [search, setSearch]         = useState('');
  const [tab, setTab]               = useState('leads');
  const [auditData, setAuditData]   = useState(null);
  const [auditLoading, setAuditLoading] = useState(false);

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

  // Load audit trail when that tab is opened for the first time
  useEffect(() => {
    if (tab === 'audit' && !auditData && !auditLoading) {
      setAuditLoading(true);
      api.get(`/public/pipeline-share/${token}/audit`)
        .then(res => setAuditData(res.data.audit || []))
        .catch(() => toast.error('Failed to load audit trail'))
        .finally(() => setAuditLoading(false));
    }
  }, [tab, token, auditData, auditLoading]);

  // Compute analytics client-side from the loaded leads (no extra API)
  const analytics = useMemo(() => {
    const total = leads.length;
    const industryMap = {};
    const countryMap  = {};
    const bmMap       = {};
    leads.forEach(l => {
      const ind = l.industry_name || 'Unspecified';
      const cty = l.country       || 'Unspecified';
      const bm  = l.business_manager_name || 'Unassigned';
      industryMap[ind] = (industryMap[ind] || 0) + 1;
      countryMap[cty]  = (countryMap[cty]  || 0) + 1;
      bmMap[bm]        = (bmMap[bm]        || 0) + 1;
    });
    const sortSlice = (obj, n = 8) =>
      Object.entries(obj).sort((a, b) => b[1] - a[1]).slice(0, n).map(([name, count]) => ({ name, count }));
    return {
      total,
      industryDist: sortSlice(industryMap),
      countryDist:  sortSlice(countryMap),
      bmDist:       sortSlice(bmMap, 12),
    };
  }, [leads]);

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

  const guestViewer = viewer || { name: 'Guest', email: '' };

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

      {/* ── Header ── */}
      <div className="sp-header">
        <div className="sp-header-bar" />
        <div className="sp-header-inner">
          <div className="sp-brand-wrap">
            <div className="sp-brand-dot">N</div>
            <span className="sp-brand-name">Nexus Pre</span>
          </div>
          <div className="sp-header-divider" />
          <div className="sp-header-meta">
            <h1 className="sp-pipeline-name">{pipeline.name}</h1>
            <div className="sp-pipeline-sub">
              <span>{fmt(pipeline.start_date)} – {fmt(pipeline.end_date)}</span>
              <span className={`sp-pipe-badge sp-pipe-badge-${pipeline.status}`}>
                {pipeline.status === 'active' ? 'Active' : 'Inactive'}
              </span>
            </div>
          </div>
          <span className="sp-shared-badge">
            <Clock size={10} /> Shared View
          </span>
        </div>
      </div>

      {/* ── Body ── */}
      <div className="sp-body">

        {/* Share note */}
        {share?.note && (
          <div className="sp-note-banner">
            <span className="sp-note-icon"><MessageSquarePlus size={14} /></span>
            {share.note}
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

        {/* ── Tabs ── */}
        <div className="sp-tabs">
          <button className={`sp-tab${tab === 'leads' ? ' active' : ''}`} onClick={() => setTab('leads')}>
            <Users size={13} /> Leads
          </button>
          <button className={`sp-tab${tab === 'analytics' ? ' active' : ''}`} onClick={() => setTab('analytics')}>
            <BarChart2 size={13} /> Analytics
          </button>
          <button className={`sp-tab${tab === 'audit' ? ' active' : ''}`} onClick={() => setTab('audit')}>
            <ClipboardList size={13} /> Audit Trail
          </button>
        </div>

        {/* ══ LEADS TAB ══ */}
        {tab === 'leads' && (
          <>
            {/* Status summary */}
            <div className="sp-stats-grid">
              {LEAD_STATUS.map(s => {
                const color = LEAD_STATUS_COLORS[s];
                return (
                  <div key={s} className="sp-stat-card" style={{ borderLeft: `3px solid ${color}` }}>
                    <div className="sp-stat-icon" style={{ background: color + '15', color }}>
                      {LEAD_STATUS_ICONS[s]}
                    </div>
                    <div className="sp-stat-info">
                      <div className="sp-stat-count" style={{ color }}>{statusCounts[s]}</div>
                      <div className="sp-stat-label">{LEAD_STATUS_LABELS[s]}</div>
                    </div>
                  </div>
                );
              })}
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

            {filteredLeads.length === 0 ? (
              <div className="sp-empty"><Users size={36} /><p>No leads found.</p></div>
            ) : (
              <>
                <div className="sp-cards">
                  {filteredLeads.map(lead => (
                    <SharedLeadCard key={lead.id} lead={lead} token={token} viewer={guestViewer} onUpdated={handleLeadUpdated} />
                  ))}
                </div>
                <div className="sp-table-wrap">
                  <table className="sp-table">
                    <thead>
                      <tr>
                        <th>Account / Client</th>
                        <th>Business Manager</th>
                        <th>Industry</th>
                        <th>Country</th>
                        <th>Status</th>
                        <th>Notes</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredLeads.map(lead => (
                        <SharedLeadRow key={lead.id} lead={lead} token={token} viewer={guestViewer} onUpdated={handleLeadUpdated} />
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </>
        )}

        {/* ══ ANALYTICS TAB ══ */}
        {tab === 'analytics' && (
          <div className="sp-analytics">

            {/* KPI row */}
            <div className="sp-kpi-row">
              <div className="sp-kpi-card" style={{ borderLeftColor: '#3e72ae' }}>
                <div className="sp-kpi-icon" style={{ background: '#3e72ae15', color: '#3e72ae' }}><Users size={16} /></div>
                <div><div className="sp-kpi-val">{analytics.total}</div><div className="sp-kpi-lbl">Total Leads</div></div>
              </div>
              {LEAD_STATUS.map(s => (
                <div key={s} className="sp-kpi-card" style={{ borderLeftColor: LEAD_STATUS_COLORS[s] }}>
                  <div className="sp-kpi-icon" style={{ background: LEAD_STATUS_COLORS[s] + '15', color: LEAD_STATUS_COLORS[s] }}>
                    {LEAD_STATUS_ICONS[s]}
                  </div>
                  <div>
                    <div className="sp-kpi-val" style={{ color: LEAD_STATUS_COLORS[s] }}>{statusCounts[s]}</div>
                    <div className="sp-kpi-lbl">{LEAD_STATUS_LABELS[s]}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Status breakdown */}
            <div className="sp-a-card">
              <div className="sp-a-title"><BarChart2 size={14} /> Status Breakdown</div>
              {LEAD_STATUS.map(s => {
                const cnt = statusCounts[s];
                const pct = analytics.total > 0 ? Math.round(cnt / analytics.total * 100) : 0;
                return (
                  <div key={s} className="sp-bar-row">
                    <span className="sp-bar-label">
                      <span className="sp-bar-dot" style={{ background: LEAD_STATUS_COLORS[s] }} />
                      {LEAD_STATUS_LABELS[s]}
                    </span>
                    <div className="sp-bar-track">
                      <div className="sp-bar-fill" style={{ width: `${pct}%`, background: LEAD_STATUS_COLORS[s] }} />
                    </div>
                    <span className="sp-bar-stats"><strong>{cnt}</strong> <span className="sp-bar-pct">{pct}%</span></span>
                  </div>
                );
              })}
            </div>

            {/* Industry distribution */}
            {analytics.industryDist.length > 0 && (
              <div className="sp-a-card">
                <div className="sp-a-title"><Building2 size={14} /> Industry Distribution</div>
                {analytics.industryDist.map((item, i) => {
                  const pct = analytics.total > 0 ? Math.round(item.count / analytics.total * 100) : 0;
                  return (
                    <div key={i} className="sp-bar-row">
                      <span className="sp-bar-label">{item.name}</span>
                      <div className="sp-bar-track">
                        <div className="sp-bar-fill" style={{ width: `${item.count / analytics.industryDist[0].count * 100}%`, background: CHART_COLORS[i % CHART_COLORS.length] }} />
                      </div>
                      <span className="sp-bar-stats"><strong>{item.count}</strong> <span className="sp-bar-pct">{pct}%</span></span>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Country distribution */}
            {analytics.countryDist.length > 0 && (
              <div className="sp-a-card">
                <div className="sp-a-title"><Globe size={14} /> Country Distribution</div>
                {analytics.countryDist.map((item, i) => {
                  const pct = analytics.total > 0 ? Math.round(item.count / analytics.total * 100) : 0;
                  return (
                    <div key={i} className="sp-bar-row">
                      <span className="sp-bar-label">{item.name}</span>
                      <div className="sp-bar-track">
                        <div className="sp-bar-fill" style={{ width: `${item.count / analytics.countryDist[0].count * 100}%`, background: CHART_COLORS[i % CHART_COLORS.length] }} />
                      </div>
                      <span className="sp-bar-stats"><strong>{item.count}</strong> <span className="sp-bar-pct">{pct}%</span></span>
                    </div>
                  );
                })}
              </div>
            )}

            {/* BM distribution */}
            {analytics.bmDist.length > 0 && (
              <div className="sp-a-card">
                <div className="sp-a-title"><UserCheck size={14} /> Business Manager Charter</div>
                {analytics.bmDist.map((item, i) => {
                  const pct = analytics.total > 0 ? Math.round(item.count / analytics.total * 100) : 0;
                  return (
                    <div key={i} className="sp-bar-row">
                      <span className="sp-bar-label">
                        <span className="sp-bm-dot" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }}>{item.name[0]}</span>
                        {item.name}
                      </span>
                      <div className="sp-bar-track">
                        <div className="sp-bar-fill" style={{ width: `${item.count / analytics.bmDist[0].count * 100}%`, background: CHART_COLORS[i % CHART_COLORS.length] }} />
                      </div>
                      <span className="sp-bar-stats"><strong>{item.count}</strong> <span className="sp-bar-pct">{pct}%</span></span>
                    </div>
                  );
                })}
              </div>
            )}

          </div>
        )}

        {/* ══ AUDIT TRAIL TAB ══ */}
        {tab === 'audit' && (
          <div className="sp-audit">
            {auditLoading ? (
              <div className="sp-audit-loading"><div className="sp-loading-spinner" style={{ width: 24, height: 24 }} /><span>Loading audit trail…</span></div>
            ) : !auditData || auditData.length === 0 ? (
              <div className="sp-empty"><ClipboardList size={36} /><p>No changes recorded yet.</p></div>
            ) : (
              auditData.map((entry, i) => {
                const changes = entry.changes || {};
                const isAddUpdate = entry.action === 'add_update';
                return (
                  <div key={entry.id || i} className="sp-audit-entry">
                    <div className="sp-audit-who">
                      <span className="sp-audit-avatar" style={{ background: entry.changed_by_email ? '#3e72ae' : '#95a5a6' }}>
                        {(entry.changed_by_name || entry.changed_by_email || '?')[0].toUpperCase()}
                      </span>
                      <div>
                        <div className="sp-audit-name">{entry.changed_by_name || entry.changed_by_email || 'Unknown'}</div>
                        {entry.changed_by_email && <div className="sp-audit-email">{entry.changed_by_email}</div>}
                      </div>
                    </div>
                    <div className="sp-audit-center">
                      <span className={`sp-audit-badge sp-audit-badge-${entry.action}`}>
                        {isAddUpdate ? '📝 Added note' : '✏️ Updated lead'}
                      </span>
                      <div className="sp-audit-lead">{entry.account_name}{entry.client_name ? ` · ${entry.client_name}` : ''}</div>
                      {!isAddUpdate && Object.entries(changes).map(([field, chg]) => (
                        <div key={field} className="sp-audit-change">
                          <span className="sp-audit-field">{field.replace(/_/g, ' ')}</span>
                          {chg.old != null && <span className="sp-audit-old">{String(chg.old)}</span>}
                          <span className="sp-audit-arrow">→</span>
                          <span className="sp-audit-new">{String(chg.new ?? '')}</span>
                        </div>
                      ))}
                      {isAddUpdate && changes.update_text && (
                        <div className="sp-audit-note-text">"{changes.update_text}"</div>
                      )}
                    </div>
                    <div className="sp-audit-time">
                      <Clock size={11} />
                      {new Date(entry.changed_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                      {' '}
                      {new Date(entry.changed_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        <div className="sp-footer">
          Powered by <strong>Nexus Pre</strong> · This is a shared view — changes are recorded.
        </div>
      </div>
    </div>
  );
}
