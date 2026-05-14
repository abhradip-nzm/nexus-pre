import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';
import {
  ArrowLeft, Plus, Search, X, Trash2, Pencil, BarChart2,
  Users, Calendar, Globe, Building2, ChevronDown, ChevronUp,
  Thermometer, Snowflake, CheckCircle2, MinusCircle,
  MessageSquarePlus, Trash, CircleDot, Share2, Link2,
  Clock, UserCheck, Filter, Download,
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

// ── Avatar helpers ────────────────────────────────────────────────────────────
const AVATAR_COLORS = ['#3e72ae','#e67e22','#27ae60','#e74c3c','#8b5cf6','#14b8a6','#f59e0b','#ec4899','#0ea5e9','#f43f5e'];
const avatarColor = (str = '') => {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = str.charCodeAt(i) + ((h << 5) - h);
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
};
const avatarInitial = (name, email) => {
  const src = name?.trim() || email?.trim() || '?';
  return src[0].toUpperCase();
};

// ── Share Modal ───────────────────────────────────────────────────────────────
function ShareModal({ pipelineId, pipelineName, onClose, onCreated }) {
  const [recipients, setRecipients] = useState([{ email: '', name: '' }]);
  const [note, setNote]             = useState('');
  const [saving, setSaving]         = useState(false);
  const [created, setCreated]       = useState(null);

  const addRow    = () => setRecipients(prev => [...prev, { email: '', name: '' }]);
  const removeRow = (i) => setRecipients(prev => prev.filter((_, idx) => idx !== i));
  const setRow    = (i, field, val) => setRecipients(prev => {
    const next = [...prev];
    next[i] = { ...next[i], [field]: val };
    return next;
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    const valid = recipients.filter(r => r.email.trim());
    if (valid.length === 0) { toast.error('Add at least one recipient email'); return; }
    setSaving(true);
    try {
      const res = await api.post(`/pipelines/${pipelineId}/shares`, {
        recipients: valid,
        note: note.trim(),
      });
      setCreated(res.data.share);
      toast.success('Share link created and emails sent!');
      if (onCreated) onCreated();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to create share link');
    } finally {
      setSaving(false);
    }
  };

  const shareUrl = created
    ? `${window.location.origin}/share/pipeline/${created.id}`
    : null;

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal modal-md">
        <div className="modal-header">
          <h2 className="modal-title"><Share2 size={16} /> Share Pipeline</h2>
          <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={18} /></button>
        </div>
        {created ? (
          <>
            <div className="modal-body">
              <p className="plv-share-success-msg">
                <CheckCircle2 size={18} style={{ color: '#27ae60' }} />
                Link created &amp; emails sent to {created.recipients?.length} recipient{created.recipients?.length !== 1 ? 's' : ''}.
              </p>
              <div className="plv-share-link-box">
                <Link2 size={14} />
                <span className="plv-share-link-url">{shareUrl}</span>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => { navigator.clipboard.writeText(shareUrl); toast.success('Link copied!'); }}
                >Copy</button>
              </div>
              <p className="plv-share-hint">Recipients can view and update leads directly from this link.</p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-primary" onClick={onClose}>Done</button>
            </div>
          </>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Pipeline</label>
                <div className="plv-share-pipe-name">{pipelineName}</div>
              </div>
              <div className="form-group">
                <label className="form-label">Note <span className="plv-optional">(optional)</span></label>
                <input
                  className="form-control"
                  placeholder="Add a message for recipients…"
                  value={note}
                  onChange={e => setNote(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Recipients</label>
                <div className="plv-recipients-list">
                  {recipients.map((r, i) => (
                    <div key={i} className="plv-recipient-row">
                      <input
                        className="form-control"
                        type="email"
                        placeholder="Email address"
                        value={r.email}
                        onChange={e => setRow(i, 'email', e.target.value)}
                        required={i === 0}
                      />
                      <input
                        className="form-control"
                        placeholder="Name (optional)"
                        value={r.name}
                        onChange={e => setRow(i, 'name', e.target.value)}
                      />
                      {recipients.length > 1 && (
                        <button type="button" className="pl-icon-btn pl-icon-delete" onClick={() => removeRow(i)}>
                          <X size={12} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <button type="button" className="btn btn-ghost btn-sm plv-add-recipient-btn" onClick={addRow}>
                  <Plus size={13} /> Add Recipient
                </button>
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? 'Sending…' : <><Share2 size={14} /> Send &amp; Create Link</>}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

// ── Audit Trail Tab ────────────────────────────────────────────────────────────
function AuditTab({ auditData, auditLoading, onRefresh }) {
  if (auditLoading) return <div className="plv-loading"><div className="plv-spinner" /> Loading audit trail…</div>;
  if (!auditData)   return null;

  const fmtAuditDate = (d) => d ? new Date(d).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  }) : '—';

  const ACTION_META = {
    lead_created: { label: 'Lead Created',   color: '#27ae60', bg: '#eafaf1' },
    lead_updated: { label: 'Lead Updated',   color: '#2980b9', bg: '#ebf5fb' },
    note_added:   { label: 'Note Added',     color: '#8b5cf6', bg: '#f5f3ff' },
    note_edited:  { label: 'Note Edited',    color: '#e67e22', bg: '#fef9ee' },
    note_deleted: { label: 'Note Deleted',   color: '#e74c3c', bg: '#fef2f2' },
    // legacy names kept for backward compat
    update_lead:  { label: 'Lead Updated',   color: '#2980b9', bg: '#ebf5fb' },
    add_update:   { label: 'Note Added',     color: '#8b5cf6', bg: '#f5f3ff' },
  };

  const renderChanges = (action, changes) => {
    if (!changes) return null;
    const parsed = typeof changes === 'string' ? (() => { try { return JSON.parse(changes); } catch { return {}; } })() : changes;

    return Object.entries(parsed).map(([field, val]) => {
      const oldVal = val?.old;
      const newVal = val?.new;
      const label  = field.replace(/_/g, ' ');
      if (action === 'note_added' && field === 'update_text') {
        return <div key={field} className="plv-audit-field-change"><span className="plv-audit-new">"{newVal}"</span></div>;
      }
      if (action === 'note_deleted' && field === 'update_text') {
        return <div key={field} className="plv-audit-field-change"><span className="plv-audit-old">"{oldVal}"</span></div>;
      }
      if (field === 'update_date') return null; // skip date changes for notes — too noisy
      return (
        <div key={field} className="plv-audit-field-change">
          <span className="plv-audit-field">{label}</span>
          {oldVal != null && <><span className="plv-audit-old">{String(oldVal)}</span><span className="plv-audit-arrow">→</span></>}
          {newVal != null && <span className="plv-audit-new">{String(newVal)}</span>}
        </div>
      );
    }).filter(Boolean);
  };

  const isSharedUser = (entry) => !!entry.share_id;

  return (
    <div className="plv-audit-tab">
      <div className="plv-audit-header">
        <span className="plv-audit-count">{auditData.length} event{auditData.length !== 1 ? 's' : ''} recorded</span>
        <button className="btn btn-ghost btn-sm" onClick={onRefresh}><Clock size={13} /> Refresh</button>
      </div>
      {auditData.length === 0 ? (
        <div className="pl-empty-state pl-empty-full">
          <Clock size={36} className="pl-empty-icon" />
          <p>No changes recorded yet. All edits — by you or shared recipients — appear here.</p>
        </div>
      ) : (
        <div className="plv-audit-list">
          {auditData.map(entry => {
            const meta = ACTION_META[entry.action] || { label: entry.action, color: '#718096', bg: '#f7f8f9' };
            const who  = entry.changed_by_name || entry.changed_by_email || 'Unknown';
            return (
              <div key={entry.id} className="plv-audit-entry">
                {/* Left: avatar + who */}
                <div className="plv-audit-left">
                  <div className="plv-audit-avatar-row">
                    <div
                      className="plv-audit-avatar"
                      style={{ background: isSharedUser(entry) ? '#8b5cf6' : '#3e72ae' }}
                      title={isSharedUser(entry) ? 'Shared user' : 'Admin'}
                    >
                      {who[0]?.toUpperCase()}
                    </div>
                    <div className="plv-audit-who-info">
                      <span className="plv-audit-who-name">{who}</span>
                      {entry.changed_by_email && entry.changed_by_name && (
                        <span className="plv-audit-email">{entry.changed_by_email}</span>
                      )}
                      {isSharedUser(entry) && <span className="plv-audit-source-badge">via share link</span>}
                    </div>
                  </div>
                  <div className="plv-audit-lead-name">
                    {entry.account_name}{entry.client_name ? ` · ${entry.client_name}` : ''}
                  </div>
                </div>
                {/* Center: action + changes */}
                <div className="plv-audit-center">
                  <span
                    className="plv-audit-action"
                    style={{ color: meta.color, background: meta.bg }}
                  >
                    {meta.label}
                  </span>
                  <div className="plv-audit-changes">{renderChanges(entry.action, entry.changes)}</div>
                </div>
                {/* Right: timestamp */}
                <div className="plv-audit-right">
                  <Clock size={11} /> {fmtAuditDate(entry.changed_at)}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Share Manage Modal ────────────────────────────────────────────────────────
function ShareManageModal({ pipelineId, shares, onClose, onDeactivated }) {
  const [deactivating, setDeactivating] = useState(null);
  const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
  }) : '—';

  const handleDeactivate = async (shareId) => {
    setDeactivating(shareId);
    try {
      await api.delete(`/pipeline-shares/${shareId}`);
      toast.success('Share link deactivated');
      onDeactivated(shareId);
    } catch {
      toast.error('Failed to deactivate');
    } finally {
      setDeactivating(null);
    }
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal modal-md">
        <div className="modal-header">
          <h2 className="modal-title"><Users size={16} /> Shared With</h2>
          <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="modal-body plv-manage-modal-body">
          {shares.length === 0 ? (
            <div className="pl-empty-state" style={{ padding: '32px 0' }}>
              <Share2 size={28} className="pl-empty-icon" />
              <p>No active share links for this pipeline.</p>
            </div>
          ) : shares.map((share, idx) => {
            const allR    = Array.isArray(share.recipients) ? share.recipients : [];
            const shareUrl = `${window.location.origin}/share/pipeline/${share.id}`;
            return (
              <div key={share.id} className="plv-manage-share-block">
                {/* Header row */}
                <div className="plv-manage-share-header">
                  <div className="plv-manage-share-title">
                    <span className="plv-manage-share-num">Link {idx + 1}</span>
                    <span className="plv-manage-date"><Clock size={11} /> {fmtDate(share.created_at)}</span>
                    {share.note && <span className="plv-manage-note">"{share.note}"</span>}
                  </div>
                  <div className="plv-manage-share-btns">
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => { navigator.clipboard.writeText(shareUrl); toast.success('Link copied!'); }}
                    >
                      <Link2 size={12} /> Copy Link
                    </button>
                    <button
                      className="btn btn-danger btn-sm"
                      onClick={() => handleDeactivate(share.id)}
                      disabled={deactivating === share.id}
                    >
                      {deactivating === share.id ? 'Removing…' : 'Deactivate'}
                    </button>
                  </div>
                </div>
                {/* Recipients */}
                {allR.length === 0 ? (
                  <div className="plv-manage-no-recipients">No recipients recorded.</div>
                ) : (
                  <div className="plv-manage-recipients">
                    {allR.map(r => {
                      const displayName  = r.name?.trim() || '';
                      const displayEmail = r.email?.trim() || '';
                      const initial = displayName ? displayName[0].toUpperCase()
                                    : displayEmail ? displayEmail[0].toUpperCase() : '?';
                      return (
                        <div key={r.id ?? r.email} className="plv-manage-recipient">
                          <div className="plv-manage-avatar" style={{ background: avatarColor(displayEmail) }}>
                            {initial}
                          </div>
                          <div className="plv-manage-rinfo">
                            <span className="plv-manage-rname">
                              {displayName || displayEmail}
                            </span>
                            {displayName && displayEmail && (
                              <span className="plv-manage-remail">{displayEmail}</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

// ── Shared With Bar ───────────────────────────────────────────────────────────
function SharedWithBar({ shares, onManage }) {
  // Flatten all recipients across all active shares
  const allRecipients = shares.flatMap(s => (s.recipients || []).map(r => ({ ...r, shareId: s.id })));
  // Deduplicate by email
  const seen = new Set();
  const unique = allRecipients.filter(r => { if (seen.has(r.email)) return false; seen.add(r.email); return true; });
  if (unique.length === 0) return null;

  const visible = unique.slice(0, 5);
  const extra   = unique.length - visible.length;

  return (
    <div className="plv-shared-bar">
      <div className="plv-shared-avatars">
        {visible.map((r, i) => (
          <div
            key={r.email}
            className="plv-shared-avatar"
            style={{ background: avatarColor(r.email), zIndex: visible.length - i }}
            title={r.name ? `${r.name} (${r.email})` : r.email}
          >
            {avatarInitial(r.name, r.email)}
          </div>
        ))}
        {extra > 0 && (
          <div className="plv-shared-avatar plv-shared-avatar-more" title={`${extra} more`}>
            +{extra}
          </div>
        )}
      </div>
      <div className="plv-shared-info">
        <span className="plv-shared-label">
          Shared with <strong>{unique.length}</strong> {unique.length === 1 ? 'person' : 'people'}
        </span>
        <div className="plv-shared-emails">
          {visible.map(r => (
            <span key={r.email} className="plv-shared-email-chip">
              {r.name || r.email}
            </span>
          ))}
          {extra > 0 && <span className="plv-shared-email-chip plv-shared-more-chip">+{extra} more</span>}
        </div>
      </div>
      <button className="btn btn-ghost btn-sm plv-manage-btn" onClick={onManage}>
        Manage
      </button>
    </div>
  );
}

// ── Lead Form Modal ───────────────────────────────────────────────────────────
// normalise: updates from DB arrive as plain objects; ensure always an array
const normaliseUpdates = (raw) => {
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string') { try { const p = JSON.parse(raw); return Array.isArray(p) ? p : []; } catch { return []; } }
  return [];
};

function LeadModal({ lead, pipelineId, salesManagers, industries, onClose, onSaved, onUpdatesChanged }) {
  const isEdit = !!lead;
  const [form, setForm] = useState({
    account_name:        lead?.account_name        || '',
    client_name:         lead?.client_name         || '',
    business_manager_id: lead?.business_manager_id || '',
    industry_id:         lead?.industry_id         || '',
    country:             lead?.country             || '',
    status:              lead?.status              || 'hot',
  });
  const [updates, setUpdates]         = useState(() => normaliseUpdates(lead?.updates));
  const [newUpdate, setNewUpdate]     = useState('');
  const [newDate, setNewDate]         = useState(new Date().toISOString().slice(0, 10));
  const [addingUpd, setAddingUpd]     = useState(false);
  const [editingUpd, setEditingUpd]   = useState(null); // { id, text, date }
  const [savingUpd, setSavingUpd]     = useState(false);
  const [saving, setSaving]           = useState(false);

  const set = (f, v) => setForm(p => ({ ...p, [f]: v }));

  // Push update changes to parent immediately so the table stays in sync
  const applyUpdates = (next) => {
    setUpdates(next);
    if (isEdit && onUpdatesChanged) onUpdatesChanged(lead.id, next);
  };

  const handleAddUpdate = async () => {
    if (!newUpdate.trim()) return;
    if (!isEdit) { toast.error('Save the lead first, then add updates.'); return; }
    setAddingUpd(true);
    try {
      const res = await api.post(`/pipeline-leads/${lead.id}/updates`, {
        update_text: newUpdate.trim(),
        update_date: newDate,
      });
      const entry = {
        id:              res.data.update.id,
        update_text:     res.data.update.update_text,
        update_date:     res.data.update.update_date,
        created_by_name: 'You',
      };
      applyUpdates([entry, ...updates]);
      setNewUpdate('');
      toast.success('Update added!');
    } catch {
      toast.error('Failed to add update');
    } finally {
      setAddingUpd(false);
    }
  };

  const handleDeleteUpdate = async (uid) => {
    try {
      await api.delete(`/pipeline-lead-updates/${uid}`);
      applyUpdates(updates.filter(u => u.id !== uid));
    } catch {
      toast.error('Failed to delete update');
    }
  };

  const handleSaveEditUpdate = async () => {
    if (!editingUpd?.text?.trim()) return;
    setSavingUpd(true);
    try {
      const res = await api.put(`/pipeline-lead-updates/${editingUpd.id}`, {
        update_text: editingUpd.text.trim(),
        update_date: editingUpd.date,
      });
      applyUpdates(updates.map(u => u.id === editingUpd.id
        ? { ...u, update_text: res.data.update.update_text, update_date: res.data.update.update_date }
        : u
      ));
      setEditingUpd(null);
      toast.success('Update saved!');
    } catch {
      toast.error('Failed to save update');
    } finally {
      setSavingUpd(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.account_name.trim()) { toast.error('Account name is required'); return; }
    if (!form.client_name.trim())  { toast.error('Client name is required');  return; }
    setSaving(true);
    try {
      // Auto-save any pending update text before saving the lead
      let finalUpdates = [...updates];
      if (isEdit && newUpdate.trim()) {
        try {
          const updRes = await api.post(`/pipeline-leads/${lead.id}/updates`, {
            update_text: newUpdate.trim(),
            update_date: newDate,
          });
          const entry = {
            id:              updRes.data.update.id,
            update_text:     updRes.data.update.update_text,
            update_date:     updRes.data.update.update_date,
            created_by_name: 'You',
          };
          finalUpdates = [entry, ...finalUpdates];
          setNewUpdate('');
        } catch {
          // non-fatal — proceed with lead save
        }
      }

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
        // Merge: prefer DB updates (fresh from server) but fall back to finalUpdates
        const dbUpdates = normaliseUpdates(res.data.lead?.updates);
        onSaved({ ...res.data.lead, updates: dbUpdates.length > 0 ? dbUpdates : finalUpdates });
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
        <form onSubmit={handleSubmit} className="plv-lead-form">
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
                      {editingUpd?.id === u.id ? (
                        /* ── inline edit mode ── */
                        <div className="plv-update-edit-row">
                          <input
                            className="form-control plv-update-edit-input"
                            value={editingUpd.text}
                            onChange={e => setEditingUpd(p => ({ ...p, text: e.target.value }))}
                            onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleSaveEditUpdate())}
                            autoFocus
                          />
                          <input
                            type="date"
                            className="form-control plv-update-edit-date"
                            value={editingUpd.date}
                            onChange={e => setEditingUpd(p => ({ ...p, date: e.target.value }))}
                          />
                          <button type="button" className="btn btn-primary btn-sm" onClick={handleSaveEditUpdate} disabled={savingUpd}>
                            {savingUpd ? '…' : 'Save'}
                          </button>
                          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditingUpd(null)}>
                            Cancel
                          </button>
                        </div>
                      ) : (
                        /* ── read mode ── */
                        <>
                          <span className="plv-update-date">{fmtShort(u.update_date)}</span>
                          <span className="plv-update-text">{u.update_text}</span>
                          <div className="plv-update-actions">
                            <button
                              type="button"
                              className="plv-update-edit"
                              onClick={() => setEditingUpd({ id: u.id, text: u.update_text, date: u.update_date?.slice(0, 10) || new Date().toISOString().slice(0, 10) })}
                              title="Edit"
                            >
                              <Pencil size={11} />
                            </button>
                            <button type="button" className="plv-update-del" onClick={() => handleDeleteUpdate(u.id)} title="Remove">
                              <Trash size={11} />
                            </button>
                          </div>
                        </>
                      )}
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
  const safeUpdates = Array.isArray(lead.updates) ? lead.updates : [];
  const updCount = safeUpdates.length;

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
        <td className="plv-td">
          <div className="plv-actions-cell">
            <button className="pl-icon-btn pl-icon-edit" onClick={() => onEdit(lead)} title="Edit"><Pencil size={13} /></button>
            <button className="pl-icon-btn pl-icon-delete" onClick={() => onDelete(lead)} title="Delete"><Trash2 size={13} /></button>
          </div>
        </td>
      </tr>
      {expanded && updCount > 0 && (
        <tr className="plv-upd-expand-row">
          <td colSpan={7} className="plv-upd-expand-cell">
            <div className="plv-upd-inline-list">
              {safeUpdates.map((u, i) => (
                <div key={u.id ?? i} className="plv-upd-inline-item">
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

// ── Analytics helpers ─────────────────────────────────────────────────────────
const toIso = (d) => d.toISOString().slice(0, 10);

const PERIOD_OPTIONS = [
  { value: 'all',        label: 'All Time' },
  { value: 'this_year',  label: 'This Year' },
  { value: 'this_q',     label: 'This Quarter' },
  { value: 'last_6m',    label: 'Last 6 Months' },
  { value: 'last_3m',    label: 'Last 3 Months' },
  { value: 'this_month', label: 'This Month' },
  { value: 'last_month', label: 'Last Month' },
  { value: 'custom',     label: 'Custom Range' },
];

const computeDateParams = (period, from = '', to = '') => {
  const now = new Date();
  const today = toIso(now);
  switch (period) {
    case 'this_year':  return { from_date: `${now.getFullYear()}-01-01`, to_date: today };
    case 'this_q': {
      const q = Math.floor(now.getMonth() / 3);
      return { from_date: toIso(new Date(now.getFullYear(), q * 3, 1)), to_date: today };
    }
    case 'last_6m':    return { from_date: toIso(new Date(Date.now() - 180 * 86400000)), to_date: today };
    case 'last_3m':    return { from_date: toIso(new Date(Date.now() - 90  * 86400000)), to_date: today };
    case 'this_month': {
      const m = String(now.getMonth() + 1).padStart(2, '0');
      return { from_date: `${now.getFullYear()}-${m}-01`, to_date: today };
    }
    case 'last_month': {
      const s = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const e = new Date(now.getFullYear(), now.getMonth(), 0);
      return { from_date: toIso(s), to_date: toIso(e) };
    }
    case 'custom': return {
      ...(from ? { from_date: from } : {}),
      ...(to   ? { to_date:   to   } : {}),
    };
    default: return {};
  }
};

const getPeriodLabel = (period, from, to) => {
  if (period === 'custom') {
    if (from && to) return `${from} → ${to}`;
    if (from) return `From ${from}`;
    if (to)   return `Up to ${to}`;
    return 'Custom Range';
  }
  return PERIOD_OPTIONS.find(p => p.value === period)?.label || 'All Time';
};

// Transform industry/country × status rows into stacked bar format (status as stack keys)
const buildStatusGrouped = (rawData, groupKey) => {
  if (!rawData || rawData.length === 0) return { data: [], keys: [] };
  const groups = {};
  rawData.forEach(r => {
    const name = r[groupKey];
    if (!groups[name]) groups[name] = { hot: 0, cold: 0, onboarded: 0, no_requirement: 0, total: 0 };
    groups[name][r.status] = (groups[name][r.status] || 0) + r.count;
    groups[name].total += r.count;
  });
  const data = Object.entries(groups)
    .sort((a, b) => b[1].total - a[1].total)
    .slice(0, 12)
    .map(([name, counts]) => ({
      name: name.length > 22 ? name.slice(0, 20) + '…' : name,
      hot:            counts.hot,
      cold:           counts.cold,
      onboarded:      counts.onboarded,
      no_requirement: counts.no_requirement,
    }));
  // Only include statuses that appear at least once
  const keys = ['hot', 'cold', 'onboarded', 'no_requirement'].filter(k => data.some(d => d[k] > 0));
  return { data, keys };
};

// Transform raw BM×group data into stacked bar format
const buildStackedBM = (rawData, groupKey) => {
  if (!rawData || rawData.length === 0) return { data: [], keys: [] };
  const groupTotals = {};
  rawData.forEach(r => { groupTotals[r[groupKey]] = (groupTotals[r[groupKey]] || 0) + r.count; });
  const topKeys = Object.entries(groupTotals).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([k]) => k);
  const managers = [...new Set(rawData.map(r => r.manager))];
  const stackData = managers.map(manager => {
    const row = { manager: manager.length > 18 ? manager.slice(0, 16) + '…' : manager };
    let other = 0;
    rawData.filter(r => r.manager === manager).forEach(r => {
      if (topKeys.includes(r[groupKey])) row[r[groupKey]] = (row[r[groupKey]] || 0) + r.count;
      else other += r.count;
    });
    if (other > 0) row['Other'] = other;
    return row;
  });
  const hasOther = stackData.some(r => r['Other'] > 0);
  return { data: stackData, keys: [...topKeys, ...(hasOther ? ['Other'] : [])] };
};

// ── Analytics Tab ─────────────────────────────────────────────────────────────
function AnalyticsTab({ pipelineId, pipelineName }) {
  const [data, setData]             = useState(null);
  const [loading, setLoading]       = useState(true);
  const [exporting, setExporting]   = useState(false);
  const [period, setPeriod]         = useState('all');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo]     = useState('');
  const [appliedParams, setApplied] = useState({});
  const analyticsRef                = useRef(null);

  // Auto-apply when a preset is picked; only apply custom on button click
  const handlePeriodChange = (p) => {
    setPeriod(p);
    if (p !== 'custom') setApplied(computeDateParams(p));
  };

  useEffect(() => {
    setLoading(true);
    api.get(`/pipelines/${pipelineId}/analytics`, { params: appliedParams })
      .then(res => setData(res.data))
      .catch(() => toast.error('Failed to load analytics'))
      .finally(() => setLoading(false));
  }, [pipelineId, appliedParams]);

  const handleExportPDF = async () => {
    if (!analyticsRef.current) return;
    setExporting(true);
    try {
      const html2canvasModule = await import('html2canvas');
      const html2canvas = html2canvasModule.default || html2canvasModule;
      const jsPDFModule = await import('jspdf');
      const jsPDF = jsPDFModule.jsPDF || jsPDFModule.default;

      const element = analyticsRef.current;
      const canvas = await html2canvas(element, {
        scale: 2, useCORS: true, logging: false,
        backgroundColor: '#f8fafc',
        width: element.scrollWidth, height: element.scrollHeight,
      });

      const imgData  = canvas.toDataURL('image/png');
      const pdf      = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pageW    = pdf.internal.pageSize.getWidth();
      const pageH    = pdf.internal.pageSize.getHeight();
      const margin   = 10;
      const usableW  = pageW - margin * 2;
      const imgH     = (canvas.height * usableW) / canvas.width;
      const periodLbl = getPeriodLabel(period, customFrom, customTo);

      pdf.setFontSize(15); pdf.setTextColor(62, 114, 174);
      pdf.text(`Nexus Pre — ${pipelineName || 'Pipeline'} Analytics`, margin, margin + 5);
      pdf.setFontSize(9);  pdf.setTextColor(113, 128, 150);
      const dateStr = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
      pdf.text(`Generated: ${dateStr}  |  Period: ${periodLbl}`, margin, margin + 11);

      const imgStartY = margin + 16;
      pdf.addImage(imgData, 'PNG', margin, imgStartY, usableW, imgH, '', 'FAST');
      let heightLeft = imgH - (pageH - imgStartY - margin);
      let pageNum = 1;
      while (heightLeft > 0) {
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', margin, imgStartY - pageNum * (pageH - margin * 2), usableW, imgH, '', 'FAST');
        heightLeft -= (pageH - margin * 2); pageNum++;
      }
      const safeName = (pipelineName || 'pipeline').toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
      pdf.save(`nexus-${safeName}-analytics-${new Date().toISOString().slice(0, 10)}.pdf`);
    } catch (err) {
      console.error('PDF export error:', err);
      toast.error('Failed to export PDF');
    } finally { setExporting(false); }
  };

  if (loading) return <div className="plv-loading"><div className="plv-spinner" /> Loading analytics…</div>;
  if (!data)   return null;

  const totalLeads = data.status_breakdown.reduce((s, r) => s + r.count, 0);

  const statusData = LEAD_STATUS.map(s => ({
    name:  LEAD_STATUS_LABELS[s],
    value: data.status_breakdown.find(r => r.status === s)?.count || 0,
    color: LEAD_STATUS_COLORS[s],
  })).filter(d => d.value > 0);

  const bmIndustry    = buildStackedBM(data.bm_industry     || [], 'industry');
  const bmCountry     = buildStackedBM(data.bm_country      || [], 'country');
  const indByStatus   = buildStatusGrouped(data.industry_status || [], 'industry');
  const ctyByStatus   = buildStatusGrouped(data.country_status  || [], 'country');

  return (
    <div className="plv-analytics">

      {/* ── Filter + Export bar ── */}
      <div className="plv-a-filter-bar">
        <div className="plv-a-filter-group">
          <Calendar size={14} className="plv-a-filter-icon" />
          <select
            className="plv-a-period-select"
            value={period}
            onChange={e => handlePeriodChange(e.target.value)}
          >
            {PERIOD_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        {period === 'custom' && (
          <>
            <input
              type="date" className="plv-a-date-input"
              value={customFrom} onChange={e => setCustomFrom(e.target.value)}
            />
            <span className="plv-a-range-arrow">→</span>
            <input
              type="date" className="plv-a-date-input"
              value={customTo} onChange={e => setCustomTo(e.target.value)}
            />
            <button
              className="btn btn-primary btn-sm"
              onClick={() => setApplied(computeDateParams('custom', customFrom, customTo))}
              disabled={!customFrom && !customTo}
            >
              Apply
            </button>
          </>
        )}
        <div className="plv-a-filter-spacer" />
        <button
          className="btn btn-secondary btn-sm plv-export-btn"
          onClick={handleExportPDF}
          disabled={exporting}
        >
          <Download size={14} />
          {exporting ? 'Generating…' : 'Export PDF'}
        </button>
      </div>

      {/* ── KPI summary row ── */}
      <div className="plv-a-kpi-row">
        <div className="plv-a-kpi-card" style={{ borderLeftColor: '#3e72ae' }}>
          <div className="plv-a-kpi-icon" style={{ background: '#3e72ae18', color: '#3e72ae' }}>
            <Users size={18} />
          </div>
          <div>
            <div className="plv-a-kpi-val">{totalLeads}</div>
            <div className="plv-a-kpi-lbl">Total Leads</div>
          </div>
        </div>
        {LEAD_STATUS.map(s => (
          <div key={s} className="plv-a-kpi-card" style={{ borderLeftColor: LEAD_STATUS_COLORS[s] }}>
            <div className="plv-a-kpi-icon" style={{ background: LEAD_STATUS_COLORS[s] + '18', color: LEAD_STATUS_COLORS[s] }}>
              {LEAD_STATUS_ICONS[s]}
            </div>
            <div>
              <div className="plv-a-kpi-val" style={{ color: LEAD_STATUS_COLORS[s] }}>
                {data.status_breakdown.find(r => r.status === s)?.count || 0}
              </div>
              <div className="plv-a-kpi-lbl">{LEAD_STATUS_LABELS[s]}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ── All charts captured for PDF ── */}
      <div ref={analyticsRef} className="plv-analytics-grid">

        {/* Status Breakdown */}
        <div className="plv-a-card plv-a-card-full">
          <div className="plv-a-title"><CircleDot size={15} /> Status Breakdown</div>
          {statusData.length === 0 ? <p className="plv-a-empty">No data yet.</p> : (
            <div className="plv-a-status-row">
              <div className="plv-a-pie-wrap">
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={statusData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} paddingAngle={2}>
                      {statusData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                    </Pie>
                    <Tooltip formatter={(val, name) => [`${val} (${totalLeads > 0 ? Math.round(val/totalLeads*100) : 0}%)`, name]} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="plv-a-legend">
                {LEAD_STATUS.map(s => {
                  const cnt = data.status_breakdown.find(r => r.status === s)?.count || 0;
                  const pct = totalLeads > 0 ? Math.round(cnt / totalLeads * 100) : 0;
                  return (
                    <div key={s} className="plv-a-legend-row">
                      <span className="plv-a-dot" style={{ background: LEAD_STATUS_COLORS[s] }} />
                      <span className="plv-a-legend-lbl">{LEAD_STATUS_LABELS[s]}</span>
                      <span className="plv-a-legend-pct">{pct}%</span>
                      <span className="plv-a-legend-val">{cnt}</span>
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
            <div className="plv-chart-scroll">
              <div style={{ minWidth: Math.max(300, data.industry_distribution.length * 54) }}>
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={data.industry_distribution} margin={{ top: 5, right: 10, left: -15, bottom: 58 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f2f5" />
                    <XAxis dataKey="industry" tick={{ fontSize: 11 }} angle={-35} textAnchor="end" interval={0} />
                    <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                    <Tooltip />
                    <Bar dataKey="count" name="Leads" radius={[4, 4, 0, 0]}>
                      {data.industry_distribution.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>

        {/* Country Distribution */}
        <div className="plv-a-card">
          <div className="plv-a-title"><Globe size={15} /> Country Distribution</div>
          {data.country_distribution.length === 0 ? <p className="plv-a-empty">No data yet.</p> : (
            <div className="plv-chart-scroll">
              <div style={{ minWidth: Math.max(300, data.country_distribution.length * 54) }}>
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={data.country_distribution} margin={{ top: 5, right: 10, left: -15, bottom: 58 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f2f5" />
                    <XAxis dataKey="country" tick={{ fontSize: 11 }} angle={-35} textAnchor="end" interval={0} />
                    <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                    <Tooltip />
                    <Bar dataKey="count" name="Leads" fill="#3e72ae" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>

        {/* Monthly Trend */}
        <div className="plv-a-card">
          <div className="plv-a-title"><Calendar size={15} /> Monthly Lead Trend</div>
          {data.monthly_trend.length === 0 ? <p className="plv-a-empty">No data yet.</p> : (
            <div className="plv-chart-scroll">
              <div style={{ minWidth: Math.max(280, data.monthly_trend.length * 60) }}>
                <ResponsiveContainer width="100%" height={210}>
                  <BarChart data={data.monthly_trend} margin={{ top: 5, right: 10, left: -15, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f2f5" />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                    <Tooltip />
                    <Bar dataKey="count" name="New Leads" fill="#6b5ea8" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>

        {/* Business Manager Charter */}
        <div className="plv-a-card plv-a-card-full">
          <div className="plv-a-title"><UserCheck size={15} /> Business Manager Charter</div>
          {data.manager_performance.length === 0 ? <p className="plv-a-empty">No data yet.</p> : (
            <div className="plv-a-bm-wrap">
              <table className="plv-a-bm-table">
                <thead>
                  <tr>
                    <th>Manager</th>
                    <th>Total</th>
                    <th style={{ color: LEAD_STATUS_COLORS.hot }}>🔥 Hot</th>
                    <th style={{ color: LEAD_STATUS_COLORS.cold }}>❄️ Cold</th>
                    <th style={{ color: LEAD_STATUS_COLORS.onboarded }}>✅ Onboarded</th>
                    <th style={{ color: LEAD_STATUS_COLORS.no_requirement }}>➖ No Req.</th>
                  </tr>
                </thead>
                <tbody>
                  {data.manager_performance.map((row, i) => (
                    <tr key={i}>
                      <td className="plv-a-bm-name">
                        <div className="plv-a-bm-avatar" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }}>
                          {row.manager[0]}
                        </div>
                        {row.manager}
                      </td>
                      <td><strong className="plv-a-bm-total">{row.total}</strong></td>
                      <td><span className="plv-a-bm-cell" style={{ color: LEAD_STATUS_COLORS.hot }}>{row.hot}</span></td>
                      <td><span className="plv-a-bm-cell" style={{ color: LEAD_STATUS_COLORS.cold }}>{row.cold}</span></td>
                      <td><span className="plv-a-bm-cell" style={{ color: LEAD_STATUS_COLORS.onboarded }}>{row.onboarded}</span></td>
                      <td><span className="plv-a-bm-cell" style={{ color: LEAD_STATUS_COLORS.no_requirement }}>{row.no_requirement}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* BM × Industry */}
        {bmIndustry.data.length > 0 && (
          <div className="plv-a-card plv-a-card-full">
            <div className="plv-a-title"><Building2 size={15} /> Manager × Industry Breakdown</div>
            <div className="plv-chart-scroll">
              <div style={{ minWidth: Math.max(400, bmIndustry.data.length * 70) }}>
                <ResponsiveContainer width="100%" height={Math.max(220, bmIndustry.data.length * 46 + 60)}>
                  <BarChart data={bmIndustry.data} layout="vertical" margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f2f5" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                    <YAxis type="category" dataKey="manager" width={100} tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Legend iconSize={10} wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
                    {bmIndustry.keys.map((k, i) => (
                      <Bar key={k} dataKey={k} stackId="a" fill={CHART_COLORS[i % CHART_COLORS.length]}
                        radius={i === bmIndustry.keys.length - 1 ? [0, 4, 4, 0] : [0, 0, 0, 0]} />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}

        {/* BM × Country */}
        {bmCountry.data.length > 0 && (
          <div className="plv-a-card plv-a-card-full">
            <div className="plv-a-title"><Globe size={15} /> Manager × Country Breakdown</div>
            <div className="plv-chart-scroll">
              <div style={{ minWidth: Math.max(400, bmCountry.data.length * 70) }}>
                <ResponsiveContainer width="100%" height={Math.max(220, bmCountry.data.length * 46 + 60)}>
                  <BarChart data={bmCountry.data} layout="vertical" margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f2f5" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                    <YAxis type="category" dataKey="manager" width={100} tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Legend iconSize={10} wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
                    {bmCountry.keys.map((k, i) => (
                      <Bar key={k} dataKey={k} stackId="a" fill={CHART_COLORS[i % CHART_COLORS.length]}
                        radius={i === bmCountry.keys.length - 1 ? [0, 4, 4, 0] : [0, 0, 0, 0]} />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}

        {/* Industry × Status */}
        {indByStatus.data.length > 0 && (
          <div className="plv-a-card plv-a-card-full">
            <div className="plv-a-title"><Building2 size={15} /> Industry → Status Contribution</div>
            <div className="plv-chart-scroll">
              <div style={{ minWidth: Math.max(400, indByStatus.data.length * 70) }}>
                <ResponsiveContainer width="100%" height={Math.max(220, indByStatus.data.length * 46 + 60)}>
                  <BarChart data={indByStatus.data} layout="vertical" margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f2f5" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                    <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(val, name) => [val, LEAD_STATUS_LABELS[name] || name]} />
                    <Legend
                      iconSize={10}
                      wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
                      formatter={(value) => LEAD_STATUS_LABELS[value] || value}
                    />
                    {indByStatus.keys.map((k, i) => (
                      <Bar key={k} dataKey={k} stackId="a" fill={LEAD_STATUS_COLORS[k]}
                        name={k}
                        radius={i === indByStatus.keys.length - 1 ? [0, 4, 4, 0] : [0, 0, 0, 0]} />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}

        {/* Country × Status */}
        {ctyByStatus.data.length > 0 && (
          <div className="plv-a-card plv-a-card-full">
            <div className="plv-a-title"><Globe size={15} /> Country → Status Contribution</div>
            <div className="plv-chart-scroll">
              <div style={{ minWidth: Math.max(400, ctyByStatus.data.length * 70) }}>
                <ResponsiveContainer width="100%" height={Math.max(220, ctyByStatus.data.length * 46 + 60)}>
                  <BarChart data={ctyByStatus.data} layout="vertical" margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f2f5" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                    <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(val, name) => [val, LEAD_STATUS_LABELS[name] || name]} />
                    <Legend
                      iconSize={10}
                      wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
                      formatter={(value) => LEAD_STATUS_LABELS[value] || value}
                    />
                    {ctyByStatus.keys.map((k, i) => (
                      <Bar key={k} dataKey={k} stackId="a" fill={LEAD_STATUS_COLORS[k]}
                        name={k}
                        radius={i === ctyByStatus.keys.length - 1 ? [0, 4, 4, 0] : [0, 0, 0, 0]} />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}

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
  const [bmFilter, setBmFilter]       = useState('');
  const [industryFilter, setIndF]     = useState('');
  const [tab, setTab]                 = useState('leads');
  const [showLeadModal, setLeadModal] = useState(false);
  const [editLead, setEditLead]       = useState(null);
  const [deleteLead, setDeleteLead]   = useState(null);
  const [showShareModal, setShareModal]   = useState(false);
  const [shares, setShares]               = useState([]);
  const [showManageModal, setManageModal] = useState(false);
  const [auditData, setAuditData]         = useState(null);
  const [auditLoading, setAuditLoading]   = useState(false);

  const loadLeads = useCallback(async () => {
    try {
      const params = {};
      if (search.trim())  params.search              = search.trim();
      if (statusFilter)   params.status              = statusFilter;
      if (bmFilter)       params.business_manager_id = bmFilter;
      if (industryFilter) params.industry_id         = industryFilter;
      const res = await api.get(`/pipelines/${id}/leads`, { params });
      setLeads(res.data.leads);
    } catch {
      toast.error('Failed to load leads');
    }
  }, [id, search, statusFilter, bmFilter, industryFilter]);

  const loadAudit = useCallback(async () => {
    setAuditLoading(true);
    try {
      const res = await api.get(`/pipelines/${id}/audit`);
      setAuditData(res.data.audit);
    } catch {
      toast.error('Failed to load audit trail');
    } finally {
      setAuditLoading(false);
    }
  }, [id]);

  const loadShares = useCallback(() => {
    api.get(`/pipelines/${id}/shares`)
      .then(res => setShares((res.data.shares || []).filter(s => s.is_active)))
      .catch(() => {});
  }, [id]);

  useEffect(() => {
    Promise.all([
      api.get(`/pipelines/${id}`),
      api.get('/business-team'),
      api.get('/industries'),
    ])
      .then(([pRes, btRes, indRes]) => {
        setPipeline(pRes.data.pipeline);
        const team = Array.isArray(btRes.data) ? btRes.data : (btRes.data.members || btRes.data.team || []);
        setSM(team.filter(m => m.role === 'sales_manager'));
        setIndustries(indRes.data.industries || []);
      })
      .catch(() => toast.error('Failed to load pipeline data'))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => { if (!loading) loadShares(); }, [loading, loadShares]);

  useEffect(() => { if (!loading) loadLeads(); }, [loading, loadLeads]);
  useEffect(() => { if (tab === 'audit' && auditData === null) loadAudit(); }, [tab, auditData, loadAudit]);

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
    <>
      <Header title="Pipeline" />
      <div className="page-content plv-loading">Loading…</div>
    </>
  );

  if (!pipeline) return (
    <>
      <Header title="Pipeline not found" />
      <div className="page-content plv-loading">
        Pipeline not found.{' '}
        <button className="btn btn-ghost btn-sm" onClick={() => navigate('/pipelines')}>← Go back</button>
      </div>
    </>
  );

  return (
    <>
      {showLeadModal && (
        <LeadModal
          lead={editLead}
          pipelineId={id}
          salesManagers={salesManagers}
          industries={industries}
          onClose={() => { setLeadModal(false); setEditLead(null); }}
          onSaved={handleLeadSaved}
          onUpdatesChanged={(leadId, newUpdates) => {
            setLeads(prev => prev.map(l => l.id === leadId ? { ...l, updates: newUpdates } : l));
          }}
        />
      )}

      {showShareModal && (
        <ShareModal
          pipelineId={id}
          pipelineName={pipeline.name}
          onClose={() => setShareModal(false)}
          onCreated={loadShares}
        />
      )}

      {showManageModal && (
        <ShareManageModal
          pipelineId={id}
          shares={shares}
          onClose={() => setManageModal(false)}
          onDeactivated={(shareId) => {
            setShares(prev => prev.filter(s => s.id !== shareId));
          }}
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

      <Header
        title={pipeline.name}
        subtitle={`${leads.length} lead${leads.length !== 1 ? 's' : ''} · ${pipeline.status === 'active' ? 'Active' : 'Inactive'}`}
      />
      <div className="page-content plv-page">
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
        <div className="plv-tabs-row">
          <div className="plv-tabs">
            <button className={`plv-tab ${tab === 'leads' ? 'active' : ''}`} onClick={() => setTab('leads')}>
              <Users size={14} /> Leads
            </button>
            <button className={`plv-tab ${tab === 'analytics' ? 'active' : ''}`} onClick={() => setTab('analytics')}>
              <BarChart2 size={14} /> Analytics
            </button>
            <button className={`plv-tab ${tab === 'audit' ? 'active' : ''}`} onClick={() => setTab('audit')}>
              <Clock size={14} /> Audit Trail
            </button>
          </div>
          <button className="btn btn-ghost btn-sm plv-share-btn" onClick={() => setShareModal(true)}>
            <Share2 size={14} /> Share
          </button>
        </div>

        {/* Shared-with indicator */}
        {shares.length > 0 && (
          <SharedWithBar shares={shares} onManage={() => setManageModal(true)} />
        )}

        {/* ── LEADS TAB ── */}
        {tab === 'leads' && (
          <>
            <div className="pl-toolbar plv-toolbar-wrap">
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
              <div className="plv-filters-row">
                <select className="filter-select" value={statusFilter} onChange={e => setStatusF(e.target.value)}>
                  <option value="">All Statuses</option>
                  {LEAD_STATUS.map(s => <option key={s} value={s}>{LEAD_STATUS_LABELS[s]}</option>)}
                </select>
                <select className="filter-select" value={bmFilter} onChange={e => setBmFilter(e.target.value)}>
                  <option value="">All Managers</option>
                  {salesManagers.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
                <select className="filter-select" value={industryFilter} onChange={e => setIndF(e.target.value)}>
                  <option value="">All Industries</option>
                  {industries.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
                </select>
                {(statusFilter || bmFilter || industryFilter || search) && (
                  <button className="btn btn-ghost btn-sm" onClick={() => { setSearch(''); setStatusF(''); setBmFilter(''); setIndF(''); }}>
                    <Filter size={13} /> Clear
                  </button>
                )}
              </div>
              <div className="plv-toolbar-spacer" style={{ flex: 1 }} />
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
        {tab === 'analytics' && <AnalyticsTab pipelineId={id} pipelineName={pipeline.name} />}

        {/* ── AUDIT TAB ── */}
        {tab === 'audit' && (
          <AuditTab
            auditData={auditData}
            auditLoading={auditLoading}
            onRefresh={() => { setAuditData(null); loadAudit(); }}
          />
        )}
      </div>
    </>
  );
}
