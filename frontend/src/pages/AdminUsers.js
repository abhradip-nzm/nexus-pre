import React, { useState, useEffect } from 'react';
import { Plus, Search, X, Check, RefreshCw, KeyRound, Copy, Download, Pencil, Eye, ToggleLeft, ToggleRight } from 'lucide-react';
import { formatRoleName } from '../utils/helpers';
import Header from '../components/layout/Header';
import PhoneInput from '../components/PhoneInput';
import api from '../utils/api';
import toast from 'react-hot-toast';
import { exportToExcel } from '../utils/exportExcel';
import './AdminUsers.css';

const FEATURES = [
  { module: 'kanban', key: 'view', label: 'View Board' },
  { module: 'kanban', key: 'create', label: 'Create Stories' },
  { module: 'kanban', key: 'edit', label: 'Edit Stories' },
  { module: 'kanban', key: 'delete', label: 'Delete Stories' },
  { module: 'kanban', key: 'move', label: 'Move Stories' },
  { module: 'dashboard', key: 'view', label: 'View Dashboard' },
  { module: 'dashboard', key: 'export', label: 'Export Reports' },
  { module: 'stories', key: 'view', label: 'View Stories' },
  { module: 'stories', key: 'assign', label: 'Assign Stories' },
  { module: 'stories', key: 'comment', label: 'Add Comments' },
  { module: 'calendar', key: 'view', label: 'View Calendar' },
  { module: 'calendar', key: 'create', label: 'Create Meetings' },
  { module: 'calendar', key: 'delete', label: 'Delete Meetings' },
  { module: 'whatsapp', key: 'access', label: 'Access WhatsApp' },
  { module: 'activity', key: 'view', label: 'View Activity Log' },
];

const MODULE_LABELS = {
  kanban: 'Kanban Board',
  dashboard: 'Dashboard',
  stories: 'User Stories',
  calendar: 'Calendar',
  whatsapp: 'WhatsApp',
  activity: 'Activity Log',
};

const ROLE_COLORS = {
  system_admin: '#c0392b',
  super_admin: '#8e44ad',
  pre_sales_manager: '#2980b9',
  pre_sales_executive: '#27ae60',
};

function getInitials(firstName, lastName) {
  return `${firstName?.[0] || ''}${lastName?.[0] || ''}`.toUpperCase();
}

export default function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editUser, setEditUser] = useState(null);
  const [activeTab, setActiveTab] = useState('info');
  const [overrides, setOverrides] = useState({});
  const [roleDefaults, setRoleDefaults] = useState({});
  const [form, setForm] = useState({ first_name: '', last_name: '', email: '', phone: '', role_id: '', password: '' });
  const [newPasswordModal, setNewPasswordModal] = useState(null); // { name, password }

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [usersRes, rolesRes] = await Promise.all([
        api.get('/users'),
        api.get('/roles'),
      ]);
      setUsers(usersRes.data.users || []);
      setRoles(rolesRes.data.roles || []);
    } catch (err) {
      toast.error('Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const openCreate = () => {
    setEditUser(null);
    setForm({ first_name: '', last_name: '', email: '', phone: '', role_id: roles[0]?.id || '', password: '' });
    setActiveTab('info');
    setOverrides({});
    setRoleDefaults({});
    setShowModal(true);
  };

  const openEdit = async (user) => {
    setEditUser(user);
    setForm({ first_name: user.first_name, last_name: user.last_name, email: user.email, phone: user.phone || '', role_id: user.role_id, password: '' });
    setActiveTab('info');
    setShowModal(true);

    try {
      const [overRes] = await Promise.all([
        api.get(`/users/${user.id}/access-overrides`).catch(() => ({ data: { overrides: [] } })),
      ]);
      const overMap = {};
      (overRes.data.overrides || []).forEach(o => {
        overMap[`${o.module}_${o.feature_key}`] = { is_enabled: o.is_enabled, is_override: true };
      });
      setOverrides(overMap);

      // Load role defaults
      const roleRes = await api.get(`/roles/${user.role_id}/access-controls`).catch(() => ({ data: { controls: [] } }));
      const defMap = {};
      FEATURES.forEach(f => { defMap[`${f.module}_${f.key}`] = true; });
      (roleRes.data.controls || []).forEach(c => {
        defMap[`${c.module}_${c.feature_key}`] = c.is_enabled;
      });
      setRoleDefaults(defMap);
    } catch (e) {}
  };

  const saveUser = async () => {
    try {
      if (editUser) {
        await api.put(`/users/${editUser.id}`, {
          first_name: form.first_name,
          last_name: form.last_name,
          email: form.email,
          phone: form.phone || null,
          role_id: form.role_id,
        });
        toast.success('User updated');
      } else {
        if (!form.password) return toast.error('Password is required');
        await api.post('/users', {
          first_name: form.first_name,
          last_name: form.last_name,
          email: form.email,
          phone: form.phone || null,
          role_id: form.role_id,
          password: form.password,
        });
        toast.success('User created');
      }
      setShowModal(false);
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save user');
    }
  };

  const toggleUserStatus = async (user) => {
    try {
      await api.put(`/users/${user.id}`, { is_active: !user.is_active });
      setUsers(prev => prev.map(u => u.id === user.id ? { ...u, is_active: !u.is_active } : u));
      toast.success(user.is_active ? 'User deactivated' : 'User activated');
    } catch (err) {
      toast.error('Failed to update user status');
    }
  };

  const setOverride = async (module, key, value) => {
    const fKey = `${module}_${key}`;
    const newOverrides = { ...overrides, [fKey]: { is_enabled: value, is_override: true } };
    setOverrides(newOverrides);
    if (editUser) {
      try {
        await api.put(`/users/${editUser.id}/access-overrides`, {
          module, feature_key: key, is_enabled: value
        });
      } catch (e) {}
    }
  };

  const regeneratePassword = async (user) => {
    if (!window.confirm(`Reset password for ${user.first_name} ${user.last_name}?`)) return;
    try {
      const res = await api.post(`/users/${user.id}/reset-password`, {});
      setNewPasswordModal({ name: `${user.first_name} ${user.last_name}`, password: res.data.tempPassword });
    } catch (err) {
      toast.error('Failed to reset password');
    }
  };

  const clearOverride = async (module, key) => {
    const fKey = `${module}_${key}`;
    const newOverrides = { ...overrides };
    delete newOverrides[fKey];
    setOverrides(newOverrides);
    if (editUser) {
      try {
        await api.put(`/users/${editUser.id}/access-overrides`, {
          module, feature_key: key, is_enabled: null
        });
      } catch (e) {}
    }
  };

  const filtered = users.filter(u => {
    const q = search.toLowerCase();
    const matchQ = !q || u.first_name?.toLowerCase().includes(q) || u.last_name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q);
    const matchRole = !roleFilter || u.role_name === roleFilter;
    const matchStatus = !statusFilter || (statusFilter === 'active' ? u.is_active : !u.is_active);
    return matchQ && matchRole && matchStatus;
  });

  const groupedFeatures = FEATURES.reduce((acc, f) => {
    if (!acc[f.module]) acc[f.module] = [];
    acc[f.module].push(f);
    return acc;
  }, {});

  if (loading) return (
    <div className="page-loading"><div className="page-spinner" /><p>Loading users...</p></div>
  );

  return (
    <>
      <Header title="User Management" subtitle="Manage users, roles and access overrides" />
      <div className="page-content admin-users-page">

        {/* Toolbar */}
        <div className="users-toolbar">
          <div className="users-search">
            <Search size={15} />
            <input
              className="users-search-input"
              placeholder="Search users..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            {search && <button className="search-clear" onClick={() => setSearch('')}><X size={13} /></button>}
          </div>

          <div className="users-filters">
            <select className="filter-select" value={roleFilter} onChange={e => setRoleFilter(e.target.value)}>
              <option value="">All Roles</option>
              {roles.map(r => <option key={r.id} value={r.name}>{r.display_name}</option>)}
            </select>
            <select className="filter-select" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
              <option value="">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>

          <div className="users-stats">
            <span className="stat-pill">{users.length} total</span>
            <span className="stat-pill active">{users.filter(u => u.is_active).length} active</span>
          </div>

          <button
            className="btn btn-secondary btn-sm"
            onClick={() => {
              const data = filtered.map(u => ({
                'First Name': u.first_name,
                'Last Name': u.last_name,
                'Email': u.email,
                'Phone': u.phone || '',
                'Role': formatRoleName(u.role_name),
                'Status': u.is_active ? 'Active' : 'Inactive',
                'Created': u.created_at ? new Date(u.created_at).toLocaleDateString() : '',
              }));
              exportToExcel(data, 'users');
            }}
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <Download size={15} /> Export Excel
          </button>
          <button className="btn btn-primary btn-sm" onClick={openCreate}>
            <Plus size={14} /> Add User
          </button>
        </div>

        {/* Table */}
        <div className="users-table-wrap">
          <table className="users-table">
            <thead>
              <tr>
                <th>User</th>
                <th>Role</th>
                <th>Phone</th>
                <th>Status</th>
                <th>Last Login</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(user => (
                <tr key={user.id}>
                  <td>
                    <div className="user-cell">
                      <div
                        className="avatar"
                        style={{ background: ROLE_COLORS[user.role_name] || '#3e72ae', color: 'white', fontSize: '12px' }}
                      >
                        {getInitials(user.first_name, user.last_name)}
                      </div>
                      <div>
                        <div className="user-name">{user.first_name} {user.last_name}</div>
                        <div className="user-email">{user.email}</div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className="role-badge" style={{ background: `${ROLE_COLORS[user.role_name]}20`, color: ROLE_COLORS[user.role_name] || '#3e72ae' }}>
                      {formatRoleName(user.role_name)}
                    </span>
                  </td>
                  <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>{user.phone || <span style={{ color: 'var(--text-light)' }}>—</span>}</td>
                  <td>
                    <span className={`status-pill ${user.is_active ? 'active' : 'inactive'}`}>
                      {user.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="last-login">
                    {user.last_login_at ? new Date(user.last_login_at).toLocaleDateString() : 'Never'}
                  </td>
                  <td>
                    <div className="user-actions">
                      <button className="tbl-btn tbl-btn-edit" onClick={() => openEdit(user)} title="Edit">
                        <Pencil size={13} />
                      </button>
                      <button
                        className={`tbl-btn ${user.is_active ? 'tbl-btn-toggle-on' : 'tbl-btn-toggle-off'}`}
                        onClick={() => toggleUserStatus(user)}
                        title={user.is_active ? 'Deactivate' : 'Activate'}
                      >
                        {user.is_active ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}
                      </button>
                      <button className="tbl-btn tbl-btn-key" onClick={() => regeneratePassword(user)} title="Reset Password">
                        <KeyRound size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={5} className="table-empty">No users found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* New Password Modal */}
      {newPasswordModal && (
        <div className="modal-backdrop" onClick={() => setNewPasswordModal(null)}>
          <div className="modal-box" style={{ maxWidth: 420 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Password Reset</h3>
              <button className="modal-close" onClick={() => setNewPasswordModal(null)}><X size={18} /></button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
                New temporary password for <strong>{newPasswordModal.name}</strong>. Share this securely — it won't be shown again.
              </p>
              <div className="new-password-box">
                <code className="new-password-text">{newPasswordModal.password}</code>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => {
                    navigator.clipboard.writeText(newPasswordModal.password);
                    toast.success('Copied to clipboard');
                  }}
                >
                  <Copy size={13} /> Copy
                </button>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-primary" onClick={() => setNewPasswordModal(null)}>Done</button>
            </div>
          </div>
        </div>
      )}

      {/* User Modal */}
      {showModal && (
        <div className="modal-backdrop" onClick={() => setShowModal(false)}>
          <div className="modal-box wide" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editUser ? 'Edit User' : 'Add New User'}</h3>
              <button className="modal-close" onClick={() => setShowModal(false)}><X size={18} /></button>
            </div>

            {editUser && (
              <div className="modal-tabs">
                <button className={`modal-tab ${activeTab === 'info' ? 'active' : ''}`} onClick={() => setActiveTab('info')}>User Info</button>
                <button className={`modal-tab ${activeTab === 'access' ? 'active' : ''}`} onClick={() => setActiveTab('access')}>Access Overrides</button>
              </div>
            )}

            <div className="modal-body">
              {activeTab === 'info' ? (
                <div className="form-grid">
                  <div className="form-group">
                    <label>First Name</label>
                    <input className="form-input" value={form.first_name} onChange={e => setForm(p => ({ ...p, first_name: e.target.value }))} />
                  </div>
                  <div className="form-group">
                    <label>Last Name</label>
                    <input className="form-input" value={form.last_name} onChange={e => setForm(p => ({ ...p, last_name: e.target.value }))} />
                  </div>
                  <div className="form-group full">
                    <label>Email</label>
                    <input className="form-input" type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} />
                  </div>
                  <div className="form-group full">
                    <label>Phone Number</label>
                    <PhoneInput
                      value={form.phone}
                      onChange={val => setForm(p => ({ ...p, phone: val }))}
                      placeholder="Enter phone number"
                    />
                  </div>
                  <div className="form-group">
                    <label>Role</label>
                    <select className="form-input" value={form.role_id} onChange={e => setForm(p => ({ ...p, role_id: e.target.value }))}>
                      {roles.map(r => <option key={r.id} value={r.id}>{r.display_name}</option>)}
                    </select>
                  </div>
                  {!editUser && (
                    <div className="form-group">
                      <label>Password</label>
                      <input className="form-input" type="password" value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))} />
                    </div>
                  )}
                </div>
              ) : (
                <div className="access-overrides">
                  <p className="overrides-hint">Override specific feature access for this user. Overrides take priority over role defaults.</p>
                  {Object.entries(groupedFeatures).map(([module, features]) => (
                    <div key={module} className="override-module">
                      <div className="module-title">{MODULE_LABELS[module]}</div>
                      {features.map(f => {
                        const fKey = `${f.module}_${f.key}`;
                        const over = overrides[fKey];
                        const roleDefault = roleDefaults[fKey] ?? true;
                        const effectiveValue = over ? over.is_enabled : roleDefault;
                        return (
                          <div key={fKey} className="override-row">
                            <span className="feature-label">{f.label}</span>
                            <div className="override-controls">
                              {over && (
                                <button className="override-reset" title="Reset to role default" onClick={() => clearOverride(f.module, f.key)}>
                                  <RefreshCw size={11} /> Reset
                                </button>
                              )}
                              <span className={`override-source ${over ? 'custom' : 'inherited'}`}>
                                {over ? 'Custom' : 'Inherited'}
                              </span>
                              <button
                                className={`toggle-switch ${effectiveValue ? 'on' : 'off'}`}
                                onClick={() => setOverride(f.module, f.key, !effectiveValue)}
                              >
                                <span className="toggle-thumb" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {activeTab === 'info' && (
              <div className="modal-footer">
                <button className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
                <button className="btn btn-primary" onClick={saveUser}>
                  {editUser ? 'Save Changes' : 'Create User'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
