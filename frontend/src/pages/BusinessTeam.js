import React, { useState, useEffect, useCallback } from 'react';
import {
  Plus, Pencil, Trash2, X, ChevronRight,
  Network, List, Phone, Mail, AlertCircle, UserCheck,
  ChevronDown, Search, GitBranch, Download
} from 'lucide-react';
import Header from '../components/layout/Header';
import PhoneInput from '../components/PhoneInput';
import api from '../utils/api';
import toast from 'react-hot-toast';
import { exportToExcel } from '../utils/exportExcel';
import './BusinessTeam.css';

const ROLES = [
  { value: 'cgo', label: 'Chief Growth Officer', short: 'CGO', color: '#3e72ae' },
  { value: 'asd', label: 'Associate Sales Director', short: 'ASD', color: '#6b5ea8' },
  { value: 'sales_manager', label: 'Sales Manager', short: 'SM', color: '#e67e22' },
  { value: 'sales_executive', label: 'Sales Executive', short: 'SE', color: '#16a085' },
];

const ROLE_MAP = Object.fromEntries(ROLES.map(r => [r.value, r]));

const PARENT_ROLE = {
  asd: 'cgo',
  sales_manager: 'asd',
  sales_executive: 'sales_manager',
};

function getRoleInfo(role) {
  return ROLE_MAP[role] || { label: role, short: role, color: '#888' };
}

function RoleBadge({ role }) {
  const info = getRoleInfo(role);
  return (
    <span
      className="bt-role-badge"
      style={{
        background: info.color + '18',
        color: info.color,
        border: `1px solid ${info.color}30`,
      }}
    >
      {info.short}
    </span>
  );
}

// ─── Tree Node ────────────────────────────────────────────────────────────────
function TreeNode({ node, onEdit, onDelete }) {
  const [expanded, setExpanded] = useState(true);
  const info = getRoleInfo(node.role);
  const hasChildren = node.children && node.children.length > 0;

  return (
    <div className="bt-tree-node">
      <div className="bt-tree-row">
        <button
          className={`bt-tree-expand ${!hasChildren ? 'invisible' : ''}`}
          onClick={() => setExpanded(v => !v)}
        >
          {hasChildren ? (expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />) : null}
        </button>

        <div className="bt-tree-card" style={{ borderLeftColor: info.color }}>
          <div className="bt-tree-avatar" style={{ background: info.color + '20', color: info.color }}>
            {node.name.charAt(0).toUpperCase()}
          </div>
          <div className="bt-tree-info">
            <div className="bt-tree-name">{node.name}</div>
            <div className="bt-tree-meta">
              <RoleBadge role={node.role} />
              <span className="bt-tree-contact"><Phone size={11} /> {node.phone}</span>
              <span className="bt-tree-contact"><Mail size={11} /> {node.email}</span>
            </div>
          </div>
          <div className="bt-tree-actions">
            <button className="tbl-btn tbl-btn-edit" onClick={() => onEdit(node)} title="Edit"><Pencil size={13} /></button>
            <button className="tbl-btn tbl-btn-delete" onClick={() => onDelete(node)} title="Remove"><Trash2 size={13} /></button>
          </div>
        </div>
      </div>

      {hasChildren && expanded && (
        <div className="bt-tree-children">
          {node.children.map(child => (
            <TreeNode key={child.id} node={child} onEdit={onEdit} onDelete={onDelete} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Member Modal ─────────────────────────────────────────────────────────────
function MemberModal({ member, members, onClose, onSave }) {
  const isEdit = !!member?.id;

  const [form, setForm] = useState({
    name: member?.name || '',
    phone: member?.phone || '',
    email: member?.email || '',
    role: member?.role || '',
    parent_id: member?.parent_id ? String(member.parent_id) : '',
  });
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});

  const set = (key, val) => {
    setForm(f => ({ ...f, [key]: val }));
    setErrors(e => ({ ...e, [key]: '' }));
  };

  const handleRoleChange = (val) => {
    setForm(f => ({ ...f, role: val, parent_id: '' }));
    setErrors(e => ({ ...e, role: '', parent_id: '' }));
  };

  const eligibleParents = form.role && PARENT_ROLE[form.role]
    ? members.filter(m => m.role === PARENT_ROLE[form.role] && m.id !== member?.id)
    : [];

  const validate = () => {
    const errs = {};
    if (!form.name.trim()) errs.name = 'Name is required';
    if (!form.phone.trim()) errs.phone = 'Phone is required';
    if (!form.email.trim()) errs.email = 'Email is required';
    else if (!/\S+@\S+\.\S+/.test(form.email)) errs.email = 'Invalid email';
    if (!form.role) errs.role = 'Role is required';
    if (form.role && PARENT_ROLE[form.role] && !form.parent_id) {
      errs.parent_id = `Must select a ${getRoleInfo(PARENT_ROLE[form.role]).label}`;
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      const payload = {
        ...form,
        parent_id: form.parent_id ? parseInt(form.parent_id) : null,
      };

      if (isEdit) {
        await api.put(`/business-team/${member.id}`, payload);
        toast.success('Member updated');
      } else {
        await api.post('/business-team', payload);
        toast.success('Member added');
      }
      onSave();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save member');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{isEdit ? 'Edit Member' : 'Add Team Member'}</h3>
          <button className="modal-close" onClick={onClose}><X size={18} /></button>
        </div>

        <div className="modal-body">
          <div className="bt-form">
            <div className="form-group">
              <label>Role <span className="req">*</span></label>
              <div className="bt-role-grid">
                {ROLES.map(r => (
                  <button
                    key={r.value}
                    type="button"
                    className={`bt-role-option ${form.role === r.value ? 'selected' : ''}`}
                    style={form.role === r.value ? {
                      borderColor: r.color,
                      background: r.color + '12',
                      color: r.color,
                    } : {}}
                    onClick={() => handleRoleChange(r.value)}
                  >
                    <span className="bt-role-short" style={{ background: r.color + '20', color: r.color }}>
                      {r.short}
                    </span>
                    <span className="bt-role-full">{r.label}</span>
                  </button>
                ))}
              </div>
              {errors.role && <span className="field-error">{errors.role}</span>}
            </div>

            {form.role && PARENT_ROLE[form.role] && (
              <div className="form-group">
                <label>
                  Reports To — {getRoleInfo(PARENT_ROLE[form.role]).label}
                  <span className="req"> *</span>
                </label>
                {eligibleParents.length === 0 ? (
                  <div className="bt-no-parent-warning">
                    <AlertCircle size={14} />
                    No {getRoleInfo(PARENT_ROLE[form.role]).label} found. Add one first.
                  </div>
                ) : (
                  <select
                    className="form-input"
                    value={form.parent_id}
                    onChange={e => set('parent_id', e.target.value)}
                  >
                    <option value="">Select {getRoleInfo(PARENT_ROLE[form.role]).label}…</option>
                    {eligibleParents.map(p => (
                      <option key={p.id} value={String(p.id)}>{p.name}</option>
                    ))}
                  </select>
                )}
                {errors.parent_id && <span className="field-error">{errors.parent_id}</span>}
              </div>
            )}

            <div className="form-grid">
              <div className="form-group full">
                <label>Full Name <span className="req">*</span></label>
                <input
                  className={`form-input ${errors.name ? 'input-error' : ''}`}
                  placeholder="e.g. John Smith"
                  value={form.name}
                  onChange={e => set('name', e.target.value)}
                />
                {errors.name && <span className="field-error">{errors.name}</span>}
              </div>

              <div className="form-group">
                <label>Phone <span className="req">*</span></label>
                <PhoneInput
                  value={form.phone}
                  onChange={val => set('phone', val)}
                  className={errors.phone ? 'input-error' : ''}
                />
                {errors.phone && <span className="field-error">{errors.phone}</span>}
              </div>

              <div className="form-group">
                <label>Official Email <span className="req">*</span></label>
                <input
                  className={`form-input ${errors.email ? 'input-error' : ''}`}
                  placeholder="john@company.com"
                  type="email"
                  value={form.email}
                  onChange={e => set('email', e.target.value)}
                />
                {errors.email && <span className="field-error">{errors.email}</span>}
              </div>
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSubmit} disabled={saving}>
            {saving ? <><span className="btn-spinner" /> Saving…</> : isEdit ? 'Update Member' : 'Add Member'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Delete Confirm Modal ─────────────────────────────────────────────────────
function DeleteModal({ member, onClose, onConfirm, loading }) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-box" style={{ width: 420 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Remove Member</h3>
          <button className="modal-close" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="modal-body">
          <div className="bt-delete-confirm">
            <div className="bt-delete-icon"><Trash2 size={22} /></div>
            <p>
              Are you sure you want to remove <strong>{member.name}</strong>?<br />
              <span className="text-muted" style={{ fontSize: 12 }}>
                This will fail if they have direct reports. Reassign or remove them first.
              </span>
            </p>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-danger" onClick={onConfirm} disabled={loading}>
            {loading ? <><span className="btn-spinner" /> Removing…</> : 'Remove'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function BusinessTeam() {
  const [members, setMembers] = useState([]);
  const [tree, setTree] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('list');
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [modalMember, setModalMember] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [listRes, treeRes] = await Promise.all([
        api.get('/business-team'),
        api.get('/business-team/tree'),
      ]);
      setMembers(listRes.data || []);
      setTree(treeRes.data || []);
    } catch {
      toast.error('Failed to load business team');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleDelete = async () => {
    setDeleteLoading(true);
    try {
      await api.delete(`/business-team/${deleteTarget.id}`);
      toast.success('Member removed');
      setDeleteTarget(null);
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Delete failed');
    } finally {
      setDeleteLoading(false);
    }
  };

  const stats = ROLES.map(r => ({
    ...r,
    count: members.filter(m => m.role === r.value).length,
  }));

  const filtered = members.filter(m => {
    const q = search.toLowerCase();
    const matchSearch = !q || m.name.toLowerCase().includes(q)
      || m.email.toLowerCase().includes(q)
      || m.phone.includes(q);
    const matchRole = !roleFilter || m.role === roleFilter;
    return matchSearch && matchRole;
  });

  if (loading) return (
    <div className="page-loading">
      <div className="page-spinner" />
    </div>
  );

  return (
    <>
      <Header title="Business Team" subtitle="Manage your sales hierarchy — CGO, ASD, Sales Managers and Executives" />

      <div className="page-content bt-page">
        {/* Stats Strip */}
        <div className="bt-stats">
          {stats.map(s => (
            <div className="bt-stat-card" key={s.value} style={{ borderTopColor: s.color }}>
              <div className="bt-stat-count" style={{ color: s.color }}>{s.count}</div>
              <div className="bt-stat-label">{s.label}</div>
              <div className="bt-stat-short" style={{ background: s.color + '15', color: s.color }}>{s.short}</div>
            </div>
          ))}
        </div>

        {/* Toolbar */}
        <div className="bt-toolbar">
          <div className="users-search">
            <Search size={15} />
            <input
              className="users-search-input"
              placeholder="Search by name, email or phone…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            {search && (
              <button className="search-clear" onClick={() => setSearch('')}><X size={14} /></button>
            )}
          </div>

          <select
            className="filter-select"
            value={roleFilter}
            onChange={e => setRoleFilter(e.target.value)}
          >
            <option value="">All Roles</option>
            {ROLES.map(r => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </select>

          <div className="bt-view-toggle">
            <button
              className={`bt-view-btn ${view === 'list' ? 'active' : ''}`}
              onClick={() => setView('list')}
            >
              <List size={15} /> List
            </button>
            <button
              className={`bt-view-btn ${view === 'tree' ? 'active' : ''}`}
              onClick={() => setView('tree')}
            >
              <Network size={15} /> Tree View
            </button>
          </div>

          <button
            className="btn btn-secondary btn-sm"
            onClick={() => {
              const data = filtered.map(m => ({
                'Name': m.name,
                'Role': getRoleInfo(m.role).label,
                'Email': m.email,
                'Phone': m.phone,
                'Parent/Manager': m.parent_name || '',
              }));
              exportToExcel(data, 'business-team');
            }}
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <Download size={15} /> Export Excel
          </button>

          <button className="btn btn-primary" onClick={() => setModalMember({})}>
            <Plus size={16} /> Add Member
          </button>
        </div>

        {/* List View */}
        {view === 'list' && (
          <div className="users-table-wrap">
            {filtered.length === 0 ? (
              <div className="bt-empty">
                <UserCheck size={36} />
                <p>
                  {members.length === 0
                    ? 'No team members yet. Add your first member to get started.'
                    : 'No members match your search.'}
                </p>
                {members.length === 0 && (
                  <button className="btn btn-primary" onClick={() => setModalMember({})}>
                    <Plus size={15} /> Add First Member
                  </button>
                )}
              </div>
            ) : (
              <table className="users-table">
                <thead>
                  <tr>
                    <th>Member</th>
                    <th>Role</th>
                    <th>Phone</th>
                    <th>Reports To</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(m => {
                    const info = getRoleInfo(m.role);
                    return (
                      <tr key={m.id}>
                        <td>
                          <div className="user-cell">
                            <div
                              className="avatar avatar-sm"
                              style={{ background: info.color + '20', color: info.color, fontSize: 13, fontWeight: 700 }}
                            >
                              {m.name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <div className="user-name">{m.name}</div>
                              <div className="user-email">{m.email}</div>
                            </div>
                          </div>
                        </td>
                        <td><RoleBadge role={m.role} /></td>
                        <td style={{ color: 'var(--text-muted)', fontSize: 13 }}>{m.phone}</td>
                        <td>
                          {m.parent_name ? (
                            <span className="bt-parent-cell">
                              {m.parent_name} <RoleBadge role={m.parent_role} />
                            </span>
                          ) : (
                            <span style={{ color: 'var(--text-light)', fontSize: 12 }}>—</span>
                          )}
                        </td>
                        <td>
                          <div className="user-actions">
                            <button className="tbl-btn tbl-btn-edit" onClick={() => setModalMember(m)} title="Edit"><Pencil size={13} /></button>
                            <button className="tbl-btn tbl-btn-delete" onClick={() => setDeleteTarget(m)} title="Remove"><Trash2 size={13} /></button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* Tree View */}
        {view === 'tree' && (
          <div className="bt-tree-wrap">
            {tree.length === 0 ? (
              <div className="bt-empty">
                <GitBranch size={36} />
                <p>No hierarchy to display yet. Add team members to build your tree.</p>
                <button className="btn btn-primary" onClick={() => setModalMember({})}>
                  <Plus size={15} /> Add First Member
                </button>
              </div>
            ) : (
              <>
                <div className="bt-tree-legend">
                  {ROLES.map(r => (
                    <span key={r.value} className="bt-legend-item">
                      <span className="bt-legend-dot" style={{ background: r.color }} />
                      {r.label}
                    </span>
                  ))}
                </div>
                <div className="bt-tree-root">
                  {tree.map(node => (
                    <TreeNode
                      key={node.id}
                      node={node}
                      onEdit={setModalMember}
                      onDelete={setDeleteTarget}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {modalMember !== null && (
        <MemberModal
          member={modalMember}
          members={members}
          onClose={() => setModalMember(null)}
          onSave={() => { setModalMember(null); fetchData(); }}
        />
      )}

      {deleteTarget && (
        <DeleteModal
          member={deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onConfirm={handleDelete}
          loading={deleteLoading}
        />
      )}
    </>
  );
}
