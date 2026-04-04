import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Shield, ChevronRight, Save, X } from 'lucide-react';
import Header from '../components/layout/Header';
import api from '../utils/api';
import toast from 'react-hot-toast';
import './AdminRoles.css';

const MODULE_LABELS = {
  kanban: 'Kanban Board',
  dashboard: 'Dashboard',
  stories: 'User Stories',
  calendar: 'Calendar',
  whatsapp: 'WhatsApp',
  activity: 'Activity Log',
};

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

export default function AdminRoles() {
  const [roles, setRoles] = useState([]);
  const [selectedRole, setSelectedRole] = useState(null);
  const [accessControls, setAccessControls] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newRole, setNewRole] = useState({ name: '', description: '' });

  useEffect(() => {
    loadRoles();
  }, []);

  const loadRoles = async () => {
    try {
      const res = await api.get('/roles');
      setRoles(res.data.roles || []);
      if (res.data.roles?.length > 0 && !selectedRole) {
        selectRole(res.data.roles[0]);
      }
    } catch (err) {
      toast.error('Failed to load roles');
    } finally {
      setLoading(false);
    }
  };

  const selectRole = async (role) => {
    setSelectedRole(role);
    try {
      const res = await api.get(`/roles/${role.id}/access-controls`).catch(() => ({ data: { controls: [] } }));
      const map = {};
      FEATURES.forEach(f => { map[`${f.module}_${f.key}`] = true; });
      (res.data.controls || []).forEach(c => {
        map[`${c.module}_${c.feature_key}`] = c.is_enabled;
      });
      setAccessControls(map);
    } catch (err) {
      const map = {};
      FEATURES.forEach(f => { map[`${f.module}_${f.key}`] = true; });
      setAccessControls(map);
    }
  };

  const toggleFeature = (module, key) => {
    setAccessControls(prev => ({
      ...prev,
      [`${module}_${key}`]: !prev[`${module}_${key}`]
    }));
  };

  const saveAccessControls = async () => {
    if (!selectedRole) return;
    setSaving(true);
    try {
      const controls = FEATURES.map(f => ({
        module: f.module,
        feature_key: f.key,
        is_enabled: accessControls[`${f.module}_${f.key}`] ?? true,
      }));
      await api.put(`/roles/${selectedRole.id}/access-controls`, { controls });
      toast.success('Access controls saved');
    } catch (err) {
      toast.error('Failed to save access controls');
    } finally {
      setSaving(false);
    }
  };

  const createRole = async () => {
    if (!newRole.name.trim()) return;
    try {
      const res = await api.post('/roles', newRole);
      setRoles(prev => [...prev, res.data.role]);
      setShowAddModal(false);
      setNewRole({ name: '', description: '' });
      toast.success('Role created');
      selectRole(res.data.role);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to create role');
    }
  };

  const deleteRole = async (role) => {
    if (role.is_system) return toast.error('Cannot delete system roles');
    if (!window.confirm(`Delete role "${role.display_name}"?`)) return;
    try {
      await api.delete(`/roles/${role.id}`);
      setRoles(prev => prev.filter(r => r.id !== role.id));
      if (selectedRole?.id === role.id) {
        setSelectedRole(null);
        setAccessControls({});
      }
      toast.success('Role deleted');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to delete role');
    }
  };

  const groupedFeatures = FEATURES.reduce((acc, f) => {
    if (!acc[f.module]) acc[f.module] = [];
    acc[f.module].push(f);
    return acc;
  }, {});

  if (loading) return (
    <div className="page-loading"><div className="page-spinner" /><p>Loading roles...</p></div>
  );

  return (
    <>
      <Header title="Roles & Permissions" subtitle="Manage role-based access controls" />
      <div className="page-content admin-roles-page">
        <div className="roles-layout">

          {/* Left Panel - Role List */}
          <div className="roles-panel">
            <div className="roles-panel-header">
              <h3>Roles</h3>
              <button className="btn btn-primary btn-sm" onClick={() => setShowAddModal(true)}>
                <Plus size={14} /> Add Role
              </button>
            </div>
            <div className="roles-list">
              {roles.map(role => (
                <div
                  key={role.id}
                  className={`role-item ${selectedRole?.id === role.id ? 'active' : ''}`}
                  onClick={() => selectRole(role)}
                >
                  <Shield size={16} className="role-icon" />
                  <div className="role-item-info">
                    <div className="role-item-name">{role.display_name}</div>
                    {role.description && <div className="role-item-desc">{role.description}</div>}
                  </div>
                  <div className="role-item-badges">
                    {role.is_system ? (
                      <span className="badge badge-system">System</span>
                    ) : (
                      <button
                        className="btn-icon-sm danger"
                        onClick={(e) => { e.stopPropagation(); deleteRole(role); }}
                        title="Delete role"
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                    <ChevronRight size={14} className="role-arrow" />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right Panel - Access Controls */}
          <div className="access-panel">
            {selectedRole ? (
              <>
                <div className="access-panel-header">
                  <div>
                    <h3>{selectedRole.display_name}</h3>
                    <p>Configure feature access for this role</p>
                  </div>
                  <button className="btn btn-primary btn-sm" onClick={saveAccessControls} disabled={saving}>
                    {saving ? <><span className="btn-spinner" /> Saving...</> : <><Save size={14} /> Save Changes</>}
                  </button>
                </div>

                <div className="access-modules">
                  {Object.entries(groupedFeatures).map(([module, features]) => (
                    <div key={module} className="access-module">
                      <div className="module-title">{MODULE_LABELS[module] || module}</div>
                      <div className="module-features">
                        {features.map(f => (
                          <div key={`${f.module}_${f.key}`} className="feature-row">
                            <span className="feature-label">{f.label}</span>
                            <button
                              className={`toggle-switch ${accessControls[`${f.module}_${f.key}`] ? 'on' : 'off'}`}
                              onClick={() => toggleFeature(f.module, f.key)}
                            >
                              <span className="toggle-thumb" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="access-empty">
                <Shield size={40} />
                <p>Select a role to manage its permissions</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Add Role Modal */}
      {showAddModal && (
        <div className="modal-backdrop" onClick={() => setShowAddModal(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Create New Role</h3>
              <button className="modal-close" onClick={() => setShowAddModal(false)}><X size={18} /></button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>Role Name</label>
                <input
                  className="form-input"
                  placeholder="e.g. Sales Executive"
                  value={newRole.name}
                  onChange={e => setNewRole(p => ({ ...p, name: e.target.value }))}
                />
              </div>
              <div className="form-group">
                <label>Description</label>
                <input
                  className="form-input"
                  placeholder="Brief description of this role"
                  value={newRole.description}
                  onChange={e => setNewRole(p => ({ ...p, description: e.target.value }))}
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setShowAddModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={createRole}>Create Role</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
