import React, { useState, useEffect } from 'react';
import {
  Plus, Search, Pencil, Key, Shield, ToggleLeft, ToggleRight,
  X, Save, User, Mail, Phone, ChevronDown
} from 'lucide-react';
import Header from '../components/layout/Header';
import { useAuth } from '../contexts/AuthContext';
import { formatDate, timeAgo, getInitials, getAvatarColor } from '../utils/helpers';
import api from '../utils/api';
import toast from 'react-hot-toast';
import './Team.css';

const MODULES = ['user_stories', 'meetings', 'users', 'kanban', 'settings'];

export default function Team() {
  const { isSystemAdmin, user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [showCreate, setShowCreate] = useState(false);
  const [editUser, setEditUser] = useState(null);
  const [permUser, setPermUser] = useState(null);
  const [resetUser, setResetUser] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [uRes, rRes] = await Promise.all([
        api.get('/users'),
        api.get('/users/roles')
      ]);
      setUsers(uRes.data.users || []);
      setRoles(rRes.data.roles || []);
    } catch {
      toast.error('Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const toggleActive = async (u) => {
    try {
      await api.put(`/users/${u.id}`, { is_active: !u.is_active });
      setUsers(prev => prev.map(x => x.id === u.id ? { ...x, is_active: !x.is_active } : x));
      toast.success(`User ${u.is_active ? 'deactivated' : 'activated'}`);
    } catch { toast.error('Failed to update user'); }
  };

  const filtered = users.filter(u => {
    const q = search.toLowerCase();
    const matchSearch = !search || `${u.first_name} ${u.last_name} ${u.email}`.toLowerCase().includes(q);
    const matchRole = roleFilter === 'all' || u.role_name === roleFilter;
    return matchSearch && matchRole;
  });

  const roleLabel = {
    super_admin: 'Super Admin',
    pre_sales_manager: 'Manager',
    pre_sales_executive: 'Executive',
  };

  const roleBadgeClass = {
    super_admin: 'badge-primary',
    pre_sales_manager: 'badge-success',
    pre_sales_executive: 'badge-muted',
  };

  if (loading) return (
    <div className="page-loading">
      <div className="page-spinner" />
    </div>
  );

  return (
    <>
      <Header title="Team Management" subtitle="Manage pre-sales team members and access" />
      <div className="page-content">
        <div className="page-header">
          <div className="team-filters">
            <div className="search-bar">
              <Search size={15} />
              <input
                type="text"
                placeholder="Search users..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <select
              className="form-control"
              value={roleFilter}
              onChange={e => setRoleFilter(e.target.value)}
              style={{ width: 160 }}
            >
              <option value="all">All Roles</option>
              {roles.map(r => <option key={r.id} value={r.name}>{r.description || r.name}</option>)}
            </select>
          </div>

          {isSystemAdmin() && (
            <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
              <Plus size={15} /> Add User
            </button>
          )}
        </div>

        <div className="card">
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Role</th>
                  <th>Contact</th>
                  <th>Stories</th>
                  <th>Last Login</th>
                  <th>Status</th>
                  {isSystemAdmin() && <th>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {filtered.map(u => (
                  <tr key={u.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div
                          className="avatar"
                          style={{ background: getAvatarColor(`${u.first_name} ${u.last_name}`), color: 'white', fontSize: '12px' }}
                        >
                          {getInitials(`${u.first_name} ${u.last_name}`)}
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 13 }}>
                            {u.first_name} {u.last_name}
                            {u.id === currentUser.id && <span className="you-badge">You</span>}
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{u.email}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className={`badge ${roleBadgeClass[u.role_name] || 'badge-muted'}`}>
                        {roleLabel[u.role_name] || u.role_name}
                      </span>
                    </td>
                    <td>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                        {u.phone || '—'}
                      </div>
                    </td>
                    <td>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>{u.total_stories || 0}</div>
                      {u.won_stories > 0 && (
                        <div style={{ fontSize: 11, color: 'var(--success)' }}>{u.won_stories} won</div>
                      )}
                    </td>
                    <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      {u.last_login ? timeAgo(u.last_login) : 'Never'}
                    </td>
                    <td>
                      <span className={`badge ${u.is_active ? 'badge-success' : 'badge-error'}`}>
                        {u.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    {isSystemAdmin() && (
                      <td>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button className="btn btn-ghost btn-icon btn-sm" title="Edit" onClick={() => setEditUser(u)}>
                            <Pencil size={14} />
                          </button>
                          <button className="btn btn-ghost btn-icon btn-sm" title="Reset Password" onClick={() => setResetUser(u)}>
                            <Key size={14} />
                          </button>
                          {u.role_name === 'super_admin' && (
                            <button className="btn btn-ghost btn-icon btn-sm" title="Permissions" onClick={() => setPermUser(u)}>
                              <Shield size={14} />
                            </button>
                          )}
                          <button
                            className="btn btn-ghost btn-icon btn-sm"
                            title={u.is_active ? 'Deactivate' : 'Activate'}
                            onClick={() => toggleActive(u)}
                          >
                            {u.is_active ? <ToggleRight size={16} style={{ color: 'var(--success)' }} /> : <ToggleLeft size={16} />}
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={isSystemAdmin() ? 7 : 6} style={{ textAlign: 'center', padding: '48px', color: 'var(--text-muted)' }}>
                      No users found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {showCreate && (
        <UserFormModal
          roles={roles}
          onClose={() => setShowCreate(false)}
          onSaved={(u) => { setUsers(prev => [u, ...prev]); setShowCreate(false); }}
        />
      )}

      {editUser && (
        <UserFormModal
          user={editUser}
          roles={roles}
          onClose={() => setEditUser(null)}
          onSaved={() => { loadData(); setEditUser(null); }}
        />
      )}

      {resetUser && (
        <ResetPasswordModal
          user={resetUser}
          onClose={() => setResetUser(null)}
        />
      )}

      {permUser && (
        <PermissionsModal
          user={permUser}
          onClose={() => setPermUser(null)}
          onSaved={() => setPermUser(null)}
        />
      )}
    </>
  );
}

function UserFormModal({ user, roles, onClose, onSaved }) {
  const isEdit = !!user;
  const [form, setForm] = useState({
    first_name: user?.first_name || '',
    last_name: user?.last_name || '',
    email: user?.email || '',
    phone: user?.phone || '',
    role_id: user?.role_id || '',
    whatsapp_number: user?.whatsapp_number || '',
    is_active: user?.is_active ?? true,
    password: '',
  });
  const [saving, setSaving] = useState(false);

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (isEdit) {
        await api.put(`/users/${user.id}`, form);
        toast.success('User updated');
        onSaved();
      } else {
        const res = await api.post('/users', form);
        toast.success(`User created! Temp password: ${res.data.tempPassword || '(set)'}`);
        onSaved(res.data.user);
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save user');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal modal-md">
        <div className="modal-header">
          <h2 className="modal-title">{isEdit ? 'Edit User' : 'Add User'}</h2>
          <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={18} /></button>
        </div>
        <form onSubmit={save}>
          <div className="modal-body">
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">First Name *</label>
                <input className="form-control" value={form.first_name}
                  onChange={e => setForm(p => ({ ...p, first_name: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Last Name *</label>
                <input className="form-control" value={form.last_name}
                  onChange={e => setForm(p => ({ ...p, last_name: e.target.value }))} />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Email *</label>
              <input type="email" className="form-control" value={form.email} disabled={isEdit}
                onChange={e => setForm(p => ({ ...p, email: e.target.value }))} />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Phone</label>
                <input className="form-control" value={form.phone}
                  onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">WhatsApp Number</label>
                <input className="form-control" placeholder="+1234567890" value={form.whatsapp_number}
                  onChange={e => setForm(p => ({ ...p, whatsapp_number: e.target.value }))} />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Role *</label>
              <select className="form-control" value={form.role_id}
                onChange={e => setForm(p => ({ ...p, role_id: e.target.value }))}>
                <option value="">Select role</option>
                {roles.map(r => <option key={r.id} value={r.id}>{r.description || r.name}</option>)}
              </select>
            </div>
            {!isEdit && (
              <div className="form-group">
                <label className="form-label">Password (leave blank to auto-generate)</label>
                <input type="password" className="form-control" value={form.password}
                  onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                  placeholder="Min. 8 characters" />
              </div>
            )}
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? <span className="btn-spinner" /> : <Save size={15} />}
              {saving ? 'Saving...' : isEdit ? 'Update User' : 'Create User'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ResetPasswordModal({ user, onClose }) {
  const [newPassword, setNewPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState(null);

  const reset = async () => {
    setSaving(true);
    try {
      const res = await api.post(`/users/${user.id}/reset-password`, { newPassword: newPassword || undefined });
      setResult(res.data.tempPassword || 'Password reset successfully');
      toast.success('Password reset!');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to reset password');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal modal-sm">
        <div className="modal-header">
          <h2 className="modal-title">Reset Password</h2>
          <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="modal-body">
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
            Reset password for <strong>{user.first_name} {user.last_name}</strong>.
            Leave blank to auto-generate.
          </p>
          <div className="form-group">
            <label className="form-label">New Password</label>
            <input type="password" className="form-control" placeholder="Leave blank to auto-generate"
              value={newPassword} onChange={e => setNewPassword(e.target.value)} />
          </div>
          {result && (
            <div className="reset-result">
              <strong>Temporary password:</strong> <code>{result}</code>
              <br /><small>Share this with the user. They should change it immediately.</small>
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Close</button>
          <button className="btn btn-primary" onClick={reset} disabled={saving}>
            {saving ? <span className="btn-spinner" /> : <Key size={15} />}
            Reset Password
          </button>
        </div>
      </div>
    </div>
  );
}

function PermissionsModal({ user, onClose, onSaved }) {
  const [perms, setPerms] = useState(
    MODULES.reduce((acc, m) => ({
      ...acc,
      [m]: { module: m, can_create: true, can_read: true, can_update: true, can_delete: false }
    }), {})
  );
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get(`/users/${user.id}`).then(r => {
      const userPerms = r.data.permissions || [];
      if (userPerms.length > 0) {
        const newPerms = { ...perms };
        userPerms.forEach(p => { newPerms[p.module] = p; });
        setPerms(newPerms);
      }
    }).catch(() => {});
  }, [user.id]);

  const toggle = (module, field) => {
    setPerms(prev => ({
      ...prev,
      [module]: { ...prev[module], [field]: !prev[module][field] }
    }));
  };

  const save = async () => {
    setSaving(true);
    try {
      await api.put(`/users/${user.id}/permissions`, { permissions: Object.values(perms) });
      toast.success('Permissions updated');
      onSaved();
    } catch { toast.error('Failed to save permissions'); }
    finally { setSaving(false); }
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal modal-md">
        <div className="modal-header">
          <h2 className="modal-title">Permissions — {user.first_name} {user.last_name}</h2>
          <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="modal-body">
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
            Configure granular permissions for this Super Admin user.
          </p>
          <table className="table">
            <thead>
              <tr>
                <th>Module</th>
                <th style={{ textAlign: 'center' }}>Create</th>
                <th style={{ textAlign: 'center' }}>Read</th>
                <th style={{ textAlign: 'center' }}>Update</th>
                <th style={{ textAlign: 'center' }}>Delete</th>
              </tr>
            </thead>
            <tbody>
              {MODULES.map(m => (
                <tr key={m}>
                  <td style={{ fontWeight: 600, textTransform: 'capitalize' }}>{m.replace(/_/g, ' ')}</td>
                  {['can_create', 'can_read', 'can_update', 'can_delete'].map(field => (
                    <td key={field} style={{ textAlign: 'center' }}>
                      <input
                        type="checkbox"
                        checked={perms[m]?.[field] || false}
                        onChange={() => toggle(m, field)}
                        disabled={field === 'can_read'}
                        style={{ cursor: 'pointer', width: 16, height: 16 }}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={save} disabled={saving}>
            {saving ? <span className="btn-spinner" /> : <Save size={15} />}
            Save Permissions
          </button>
        </div>
      </div>
    </div>
  );
}
