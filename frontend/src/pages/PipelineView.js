import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts';
import {
  ArrowLeft, Plus, Search, X, Trash2, Pencil, BarChart2,
  Users, Calendar, Globe, Building2, ChevronDown, ChevronUp,
  Thermometer, Snowflake, CheckCircle2, MinusCircle,
  MessageSquarePlus, Trash, CircleDot,
} from 'lucide-react';
import Header from '../components/layout/Header';
import api from '../utils/api';
import toast from 'react-hot-toast';
import './PipelineView.css';

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

const LEAD_STATUS       = ['hot', 'cold', 'onboarded', 'no_requirement'];
const LEAD_STATUS_LABELS = { hot: 'Hot', cold: 'Cold', onboarded: 'Onboarded', no_requirement: 'No Requirement' };
const LEAD_STATUS_ICONS  = {
  hot:            <Thermometer size={11} />,
  cold:           <Snowflake size={11} />,
  onboarded:      <CheckCircle2 size={11} />,
  no_requirement: <MinusCircle size={11} />,
};
const LEAD_STATUS_COLORS = { hot: '#e74c3c', cold: '#3498db', onboarded: '#27ae60', no_requirement: '#95a5a6' };
const CHART_COLORS = ['#3e72ae','#e67e22','#27ae60','#e74c3c','#8b5cf6','#14b8a6','#f59e0b','#ec4899'];

const fmt      = (d) => d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
const fmtShort = (d) => d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) : '';

// ── Lead Form Modal ───────────────────────────────────────────────────────────
function LeadModal({ lead, pipelineId, salesManagers, industries, onClose, onSaved }) {
  const isEdit = !!lead;
  const [form, setForm] = useState({
    account_name:        lead?.account_name        || '',
    client_name:         lead?.client_name         || '',
    business_manager_id: lead?.business_manager_id || '',
    industry_id:         lead?.industry_id         || '',
    country:             lead?.country             || '',
    status:              lead?.status              || 'hot',
  });
  const [updates, setUpdates]     = useState(lead?.updates || []);
  const [newUpdate, setNewUpdate] = useState('');
  const [newDate, setNewDate]     = useState(new Date().toISOString().slice(0, 10));
  const [addingUpd, setAddingUpd] = useState(false);
  const [saving, setSaving]       = useState(false);

  const set = (f, v) => setForm(p => ({ ...p, [f]: v }));

  const handleAddUpdate = async () => {
    if (!newUpdate.trim()) return;
    if (!isEdit) { toast.error('Save the lead first, then add updates.'); return; }
    setAddingUpd(true);
    try {
      const res = await api.post(`/pipeline-leads/${lead.id}/updates`, {
        update_text: newUpdate.trim(),
        update_date: newDate,
      });
      setUpdates(prev => [{ ...res.data.update, created_by_name: 'You' }, ...prev]);
      setNewUpdate('');
    } catch {
      toast.error('Failed to add update');
    } finally {
      setAddingUpd(false);
    }
  };

  const handleDeleteUpdate = async (uid) => {
    try {
      await api.delete(`/pipeline-lead-updates/${uid}`);
      setUpdates(prev => prev.filter(u => u.id !== uid));
    } catch {
      toast.error('Failed to delete update');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.account_name.trim()) { toast.error('Account name is required'); return; }
    if (!form.client_name.trim())  { toast.error('Client name is required');  return; }
    setSaving(true);
    try {
      const payload = {
        account_name:        form.account_name.trim(),
        client_name:         form.client_name.trim(),
        business_manager_id: form.business_manager_id || null,
        industry_id:         form.industry_id         || null,
        country:             form.country             || null,
        status:              form.status,
      };
      let res;
      if (isEdit) {
        res = await api.put(`/pipeline-leads/${lead.id}`, payload);
        toast.success('Lead updated!');
        onSaved({ ...res.data.lead, updates });
      } else {
        res = await api.post(`/pipelines/${pipelineId}/leads`, payload);
        toast.success('Lead created!');
        onSaved(res.data.lead);
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save lead');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal modal-md">
        <div className="modal-header">
          <h2 className="modal-title">{isEdit ? 'Edit Lead' : 'New Lead'}</h2>
          <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body plv-modal-body">
            <div className="plv-form-grid">
              <div className="form-group">
                <label className="form-label">Account Name <span className="req">*</span></label>
                <input className="form-control" placeholder="Company / Account" value={form.account_name} onChange={e => set('account_name', e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Client Name <span className="req">*</span></label>
                <input className="form-control" placeholder="Contact person" value={form.client_name} onChange={e => set('client_name', e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Business Manager</label>
                <select className="form-control" value={form.business_manager_id} onChange={e => set('business_manager_id', e.target.value)}>
                  <option value="">— Select Manager —</option>
                  {salesManagers.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Industry</label>
                <select className="form-control" value={form.industry_id} onChange={e => set('industry_id', e.target.value)}>
                  <option value="">— Select Industry —</option>
                  {industries.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Country</label>
                <select className="form-control" value={form.country} onChange={e => set('country', e.target.value)}>
                  <option value="">— Select Country —</option>
                  {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Status</label>
                <select className="form-control" value={form.status} onChange={e => set('status', e.target.value)}>
                  {LEAD_STATUS.map(s => <option key={s} value={s}>{LEAD_STATUS_LABELS[s]}</option>)}
                </select>
              </div>
            </div>

            {/* Latest Updates — edit mode only */}
            {isEdit && (
              <div className="plv-updates-section">
                <div className="plv-updates-title">
                  <MessageSquarePlus size={14} /> Latest Updates
                </div>
                <div className="plv-add-update-row">
                  <input
                    className="form-control"
                    placeholder="Add an update note…"
                    value={newUpdate}
                    onChange={e => setNewUpdate(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleAddUpdate())}
                    style={{ flex: 1 }}
                  />
                  <input type="date" className="form-control" value={newDate} onChange={e => setNewDate(e.target.value)} style={{ width: 140, flexShrink: 0 }} />
                  <button type="button" className="btn btn-primary btn-sm" onClick={handleAddUpdate} disabled={addingUpd}>
                    {addingUpd ? '…' : <Plus size={14} />}
                  </button>
                </div>
                <div className="plv-updates-list">
                  {updates.length === 0 ? (
                    <p className="plv-no-updates">No updates yet.</p>
                  ) : updates.map(u => (
                    <div key={u.id} className="plv-update-entry">
                      <span className="plv-update-date">{fmtShort(u.update_date)}</span>
                      <span className="plv-update-text">{u.update_text}</span>
                      <button type="button" className="plv-update-del" onClick={() => handleDeleteUpdate(u.id)} title="Remove">
                        <Trash size={11} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Add Lead'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Lead Table Row ────────────────────────────────────────────────────────────
function LeadRow({ lead, onEdit, onDelete }) {
  const [expanded, setExpanded] = useState(false);
  const updCount = lead.updates?.length || 0;

  return (
    <>
      <tr className="plv-tr">
        <td className="plv-td">
          <div className="plv-account">{lead.account_name}</div>
          <div className="plv-client-sub">{lead.client_name}</div>
        </td>
        <td className="plv-td">{lead.business_manager_name || <span className="plv-na">—</span>}</td>
        <td className="plv-td">{lead.industry_name || <span className="plv-na">—</span>}</td>
        <td className="plv-td">{lead.country || <span className="plv-na">—</span>}</td>
        <td className="plv-td">
          <span
            className="plv-status-pill"
            style={{ background: LEAD_STATUS_COLORS[lead.status] + '18', color: LEAD_STATUS_COLORS[lead.status], border: `1px solid ${LEAD_STATUS_COLORS[lead.status]}40` }}
          >
            {LEAD_STATUS_ICONS[lead.status]} {LEAD_STATUS_LABELS[lead.status]}
          </span>
        </td>
        <td className="plv-td">
          {updCount > 0 ? (
            <button className="plv-upd-expand" onClick={() => setExpanded(p => !p)}>
              {expanded ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
              {updCount} update{updCount !== 1 ? 's' : ''}
            </button>
          ) : (
            <span className="plv-na">No updates</span>
          )}
        </td>
        <td className="plv-td plv-actions-cell">
          <button className="pl-icon-btn pl-icon-edit" onClick={() => onEdit(lead)} title="Edit"><Pencil size={13} /></button>
          <button className="pl-icon-btn pl-icon-delete" onClick={() => onDelete(lead)} title="Delete"><Trash2 size={13} /></button>
        </td>
      </tr>
      {expanded && updCount > 0 && (
        <tr className="plv-upd-expand-row">
          <td colSpan={7} className="plv-upd-expand-cell">
            <div className="plv-upd-inline-list">
              {lead.updates.map(u => (
                <div key={u.id} className="plv-upd-inline-item">
                  <span className="plv-upd-inline-date">{fmtShort(u.update_date)}</span>
                  <span className="plv-upd-inline-text">{u.update_text}</span>
                </div>
              ))}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ── Analytics Tab ─────────────────────────────────────────────────────────────
function AnalyticsTab({ pipelineId }) {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/pipelines/${pipelineId}/analytics`)
      .then(res => setData(res.data))
      .catch(() => toast.error('Failed to load analytics'))
      .finally(() => setLoading(false));
  }, [pipelineId]);

  if (loading) return <div className="plv-loading">Loading analytics…</div>;
  if (!data)   return null;

  const statusData = LEAD_STATUS.map(s => ({
    name:  LEAD_STATUS_LABELS[s],
    value: data.status_breakdown.find(r => r.status === s)?.count || 0,
    color: LEAD_STATUS_COLORS[s],
  })).filter(d => d.value > 0);

  return (
    <div className="plv-analytics">
      <div className="plv-analytics-grid">
        {/* Status Breakdown */}
        <div className="plv-a-card plv-a-card-full">
          <div className="plv-a-title"><CircleDot size={15} /> Status Breakdown</div>
          {statusData.length === 0 ? <p className="plv-a-empty">No data yet.</p> : (
            <div className="plv-a-status-row">
              <div style={{ flex: '0 0 260px' }}>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={statusData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={75}>
                      {statusData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="plv-a-legend">
                {LEAD_STATUS.map(s => {
                  const row = data.status_breakdown.find(r => r.status === s);
                  return (
                    <div key={s} className="plv-a-legend-row">
                      <span className="plv-a-dot" style={{ background: LEAD_STATUS_COLORS[s] }} />
                      <span className="plv-a-legend-lbl">{LEAD_STATUS_LABELS[s]}</span>
                      <span className="plv-a-legend-val">{row?.count || 0}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Industry Distribution */}
        <div className="plv-a-card">
          <div className="plv-a-title"><Building2 size={15} /> Industry Distribution</div>
          {data.industry_distribution.length === 0 ? <p className="plv-a-empty">No data yet.</p> : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={data.industry_distribution} margin={{ top: 5, right: 10, left: -15, bottom: 50 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f2f5" />
                <XAxis dataKey="industry" tick={{ fontSize: 11 }} angle={-30} textAnchor="end" interval={0} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="count" name="Leads" radius={[4, 4, 0, 0]}>
                  {data.industry_distribution.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Country Distribution */}
        <div className="plv-a-card">
          <div className="plv-a-title"><Globe size={15} /> Country Distribution</div>
          {data.country_distribution.length === 0 ? <p className="plv-a-empty">No data yet.</p> : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={data.country_distribution} margin={{ top: 5, right: 10, left: -15, bottom: 50 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f2f5" />
                <XAxis dataKey="country" tick={{ fontSize: 11 }} angle={-30} textAnchor="end" interval={0} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="count" name="Leads" fill="#3e72ae" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Monthly Trend */}
        <div className="plv-a-card">
          <div className="plv-a-title"><Calendar size={15} /> Monthly Lead Trend</div>
          {data.monthly_trend.length === 0 ? <p className="plv-a-empty">No data yet.</p> : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={data.monthly_trend} margin={{ top: 5, right: 10, left: -15, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f2f5" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="count" name="New Leads" fill="#6b5ea8" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* BM Performance */}
        <div className="plv-a-card plv-a-card-full">
          <div className="plv-a-title"><Users size={15} /> Business Manager Performance</div>
          {data.manager_performance.length === 0 ? <p className="plv-a-empty">No data yet.</p> : (
            <div className="plv-a-bm-wrap">
              <table className="plv-a-bm-table">
                <thead>
                  <tr>
                    <th>Manager</th>
                    <th>Total</th>
                    <th style={{ color: LEAD_STATUS_COLORS.hot }}>Hot</th>
                    <th style={{ color: LEAD_STATUS_COLORS.cold }}>Cold</th>
                    <th style={{ color: LEAD_STATUS_COLORS.onboarded }}>Onboarded</th>
                    <th style={{ color: LEAD_STATUS_COLORS.no_requirement }}>No Req.</th>
                  </tr>
                </thead>
                <tbody>
                  {data.manager_performance.map((row, i) => (
                    <tr key={i}>
                      <td className="plv-a-bm-name">{row.manager}</td>
                      <td><strong>{row.total}</strong></td>
                      <td>{row.hot}</td>
                      <td>{row.cold}</td>
                      <td>{row.onboarded}</td>
                      <td>{row.no_requirement}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main Pipeline View ────────────────────────────────────────────────────────
export default function PipelineView() {
  const { id }   = useParams();
  const navigate = useNavigate();

  const [pipeline, setPipeline]       = useState(null);
  const [leads, setLeads]             = useState([]);
  const [salesManagers, setSM]        = useState([]);
  const [industries, setIndustries]   = useState([]);
  const [loading, setLoading]         = useState(true);
  const [search, setSearch]           = useState('');
  const [statusFilter, setStatusF]    = useState('');
  const [tab, setTab]                 = useState('leads');
  const [showLeadModal, setLeadModal] = useState(false);
  const [editLead, setEditLead]       = useState(null);
  const [deleteLead, setDeleteLead]   = useState(null);

  const loadLeads = useCallback(async () => {
    try {
      const params = {};
      if (search.trim()) params.search = search.trim();
      if (statusFilter)  params.status = statusFilter;
      const res = await api.get(`/pipelines/${id}/leads`, { params });
      setLeads(res.data.leads);
    } catch {
      toast.error('Failed to load leads');
    }
  }, [id, search, statusFilter]);

  useEffect(() => {
    Promise.all([
      api.get(`/pipelines/${id}`),
      api.get('/business-team'),
      api.get('/industries'),
    ])
      .then(([pRes, btRes, indRes]) => {
        setPipeline(pRes.data.pipeline);
        const team = btRes.data.members || btRes.data.team || [];
        setSM(team.filter(m => m.role === 'sales_manager'));
        setIndustries(indRes.data.industries || []);
      })
      .catch(() => toast.error('Failed to load pipeline data'))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => { if (!loading) loadLeads(); }, [loading, loadLeads]);

  const handleLeadSaved = (saved) => {
    setLeads(prev => {
      const idx = prev.findIndex(l => l.id === saved.id);
      if (idx >= 0) { const next = [...prev]; next[idx] = saved; return next; }
      return [saved, ...prev];
    });
    setLeadModal(false);
    setEditLead(null);
  };

  const handleLeadDeleted = async () => {
    try {
      await api.delete(`/pipeline-leads/${deleteLead.id}`);
      setLeads(prev => prev.filter(l => l.id !== deleteLead.id));
      toast.success('Lead deleted');
      setDeleteLead(null);
    } catch {
      toast.error('Failed to delete lead');
    }
  };

  const statusCounts = LEAD_STATUS.reduce((acc, s) => {
    acc[s] = leads.filter(l => l.status === s).length;
    return acc;
  }, {});

  if (loading) return (
    <div className="page-container">
      <Header title="Pipeline" />
      <div className="plv-loading">Loading…</div>
    </div>
  );

  if (!pipeline) return (
    <div className="page-container">
      <Header title="Pipeline not found" />
      <div className="plv-loading">
        Pipeline not found.{' '}
        <button className="btn btn-ghost btn-sm" onClick={() => navigate('/pipelines')}>← Go back</button>
      </div>
    </div>
  );

  return (
    <div className="page-container">
      <Header
        title={pipeline.name}
        subtitle={`${leads.length} lead${leads.length !== 1 ? 's' : ''} · ${pipeline.status === 'active' ? 'Active' : 'Inactive'}`}
      />

      <div className="plv-page">
        {/* Top bar */}
        <div className="plv-topbar">
          <button className="btn btn-ghost btn-sm" onClick={() => navigate('/pipelines')}>
            <ArrowLeft size={14} /> All Pipelines
          </button>
          <div className="plv-pipe-info">
            <Calendar size={13} /> {fmt(pipeline.start_date)} → {fmt(pipeline.end_date)}
            <span className={`pl-status-badge pl-status-${pipeline.status}`} style={{ marginLeft: 10 }}>
              {pipeline.status === 'active' ? 'Active' : 'Inactive'}
            </span>
          </div>
        </div>

        {/* Status summary pills */}
        <div className="plv-summary-pills">
          {LEAD_STATUS.map(s => (
            <div key={s} className="plv-summary-pill" style={{ borderColor: LEAD_STATUS_COLORS[s] + '55', background: LEAD_STATUS_COLORS[s] + '10' }}>
              <span style={{ color: LEAD_STATUS_COLORS[s], display: 'flex', alignItems: 'center' }}>{LEAD_STATUS_ICONS[s]}</span>
              <span className="plv-sp-label" style={{ color: LEAD_STATUS_COLORS[s] }}>{LEAD_STATUS_LABELS[s]}</span>
              <strong className="plv-sp-val">{statusCounts[s]}</strong>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="plv-tabs">
          <button className={`plv-tab ${tab === 'leads' ? 'active' : ''}`} onClick={() => setTab('leads')}>
            <Users size={14} /> Leads
          </button>
          <button className={`plv-tab ${tab === 'analytics' ? 'active' : ''}`} onClick={() => setTab('analytics')}>
            <BarChart2 size={14} /> Analytics
          </button>
        </div>

        {/* ── LEADS TAB ── */}
        {tab === 'leads' && (
          <>
            <div className="pl-toolbar">
              <div className="users-search">
                <Search size={14} />
                <input
                  className="users-search-input"
                  placeholder="Search leads…"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
                {search && <button className="search-clear" onClick={() => setSearch('')}><X size={13} /></button>}
              </div>
              <select className="filter-select" value={statusFilter} onChange={e => setStatusF(e.target.value)}>
                <option value="">All Statuses</option>
                {LEAD_STATUS.map(s => <option key={s} value={s}>{LEAD_STATUS_LABELS[s]}</option>)}
              </select>
              <div style={{ flex: 1 }} />
              <button className="btn btn-primary" onClick={() => { setEditLead(null); setLeadModal(true); }}>
                <Plus size={15} /> Add Lead
              </button>
            </div>

            <div className="plv-table-wrap">
              {leads.length === 0 ? (
                <div className="pl-empty-state pl-empty-full">
                  <Users size={36} className="pl-empty-icon" />
                  <p>No leads yet. Add your first lead to get started.</p>
                </div>
              ) : (
                <table className="plv-table">
                  <thead>
                    <tr>
                      <th>Account / Client</th>
                      <th>Business Manager</th>
                      <th>Industry</th>
                      <th>Country</th>
                      <th>Status</th>
                      <th>Updates</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {leads.map(lead => (
                      <LeadRow
                        key={lead.id}
                        lead={lead}
                        onEdit={(l) => { setEditLead(l); setLeadModal(true); }}
                        onDelete={setDeleteLead}
                      />
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </>
        )}

        {/* ── ANALYTICS TAB ── */}
        {tab === 'analytics' && <AnalyticsTab pipelineId={id} />}
      </div>

      {showLeadModal && (
        <LeadModal
          lead={editLead}
          pipelineId={id}
          salesManagers={salesManagers}
          industries={industries}
          onClose={() => { setLeadModal(false); setEditLead(null); }}
          onSaved={handleLeadSaved}
        />
      )}

      {deleteLead && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setDeleteLead(null)}>
          <div className="modal modal-sm">
            <div className="modal-header">
              <h2 className="modal-title">Delete Lead</h2>
              <button className="btn btn-ghost btn-icon" onClick={() => setDeleteLead(null)}><X size={18} /></button>
            </div>
            <div className="modal-body">
              <p className="pl-confirm-text">
                Delete <strong>{deleteLead.account_name}</strong> ({deleteLead.client_name})? This cannot be undone.
              </p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setDeleteLead(null)}>Cancel</button>
              <button className="btn btn-danger" onClick={handleLeadDeleted}>Delete Lead</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
