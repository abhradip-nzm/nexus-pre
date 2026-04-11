import React, { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import {
  LayoutDashboard, Kanban, Users, Settings,
  ChevronDown, LogOut, KeyRound,
  UsersRound, LayoutGrid, UserCog,
  Calendar as CalendarIcon, Tag as TagIcon, Building2,
  GitBranch, CalendarCheck, Target
} from 'lucide-react';
import { formatRoleName } from '../../utils/helpers';
import api from '../../utils/api';
import './Sidebar.css';

function getNavItems(role) {
  const teamItemWithChildren = {
    label: 'Team', icon: Users,
    children: [
      { to: '/team', label: 'Team Members' },
      { to: '/executives', label: 'Executives' },
    ]
  };

  if (role === 'pre_sales_manager') {
    return [
      { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
      { to: '/kanban', icon: Kanban, label: 'Kanban Board' },
      { to: '/my-tasks', icon: CalendarCheck, label: 'My Tasks' },
      { to: '/executives', icon: Users, label: 'Team' },
      { to: '/calendar', icon: CalendarIcon, label: 'Calendar' },
    ];
  }
  if (role === 'pre_sales_executive') {
    return [
      { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
      { to: '/kanban', icon: Kanban, label: 'Kanban Board' },
      { to: '/my-tasks', icon: CalendarCheck, label: 'My Tasks' },
      { to: '/calendar', icon: CalendarIcon, label: 'Calendar' },
    ];
  }
  return [];
}

const adminNavItems = [
  { to: '/kanban', icon: Kanban, label: 'Kanban Board' },
  { to: '/all-tasks', icon: CalendarCheck, label: 'All Tasks' },
  { to: '/calendar', icon: CalendarIcon, label: 'Calendar' },
  { to: '/admin/users', icon: UserCog, label: 'User Management' },
  { to: '/admin/teams', icon: UsersRound, label: 'Teams' },
  { to: '/admin/business-team', icon: GitBranch, label: 'Business Team' },
  { to: '/admin/kanban', icon: LayoutGrid, label: 'Kanban Setup' },
  { to: '/admin/tags', icon: TagIcon, label: 'Manage Tags' },
  { to: '/admin/industries', icon: Building2, label: 'Manage Industries' },
  { to: '/prospects', icon: Target, label: 'Probable Prospects' },
  { to: '/settings', icon: Settings, label: 'Settings' },
];

export default function Sidebar() {
  const { user, logout } = useAuth();
  const [expanded, setExpanded] = useState({});
  const location = useLocation();
  const [showChangePw, setShowChangePw] = useState(false);
  const [pwForm, setPwForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [pwError, setPwError] = useState('');
  const [pwSuccess, setPwSuccess] = useState('');
  const [pwSaving, setPwSaving] = useState(false);

  const openChangePw = () => {
    setPwForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    setPwError('');
    setPwSuccess('');
    setShowChangePw(true);
  };

  const handleChangePw = async (e) => {
    e.preventDefault();
    setPwError('');
    setPwSuccess('');
    if (pwForm.newPassword.length < 8) {
      setPwError('New password must be at least 8 characters.');
      return;
    }
    if (pwForm.newPassword !== pwForm.confirmPassword) {
      setPwError('New passwords do not match.');
      return;
    }
    setPwSaving(true);
    try {
      await api.put('/auth/change-password', {
        currentPassword: pwForm.currentPassword,
        newPassword: pwForm.newPassword,
      });
      setPwSuccess('Password changed successfully!');
      setTimeout(() => setShowChangePw(false), 1500);
    } catch (err) {
      setPwError(err.response?.data?.error || 'Failed to change password.');
    } finally {
      setPwSaving(false);
    }
  };

  const isAdminUser = user?.role_name === 'system_admin' || user?.role_name === 'super_admin';

  const toggle = (label) => setExpanded(p => ({ ...p, [label]: !p[label] }));

  // For super_admin: show adminNavItems excluding Settings
  const visibleAdminItems = user?.role_name === 'super_admin'
    ? adminNavItems.filter(item => item.to !== '/settings')
    : adminNavItems;

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <div className="logo-mark">
          <span className="logo-n">N</span>
        </div>
        <div>
          <div className="logo-name">Nexus Pre</div>
          <div className="logo-tagline">Pre-Sales Platform</div>
        </div>
      </div>

      <nav className="sidebar-nav">
        {isAdminUser ? (
          <>
            <div className="nav-section-label">Admin Console</div>
            {visibleAdminItems.map((item) => (
              <NavLink key={item.to} to={item.to} className="nav-item">
                <item.icon size={18} />
                <span>{item.label}</span>
              </NavLink>
            ))}
          </>
        ) : (
          getNavItems(user?.role_name).map((item) => {
            if (item.children) {
              const isActive = item.children.some(c => location.pathname.startsWith(c.to));
              return (
                <div key={item.label}>
                  <button
                    className={`nav-item nav-group-trigger ${isActive ? 'active' : ''}`}
                    onClick={() => toggle(item.label)}
                  >
                    <item.icon size={18} />
                    <span>{item.label}</span>
                    <ChevronDown
                      size={14}
                      className="nav-chevron"
                      style={{ transform: expanded[item.label] ? 'rotate(180deg)' : 'none' }}
                    />
                  </button>
                  {(expanded[item.label] || isActive) && (
                    <div className="nav-children">
                      {item.children.map(child => (
                        <NavLink key={child.to} to={child.to} className="nav-child">
                          {child.label}
                        </NavLink>
                      ))}
                    </div>
                  )}
                </div>
              );
            }

            return (
              <NavLink key={item.to} to={item.to} className="nav-item">
                <item.icon size={18} />
                <span>{item.label}</span>
              </NavLink>
            );
          })
        )}
      </nav>

      <div className="sidebar-footer">
        <div className="sidebar-user">
          <div
            className="avatar"
            style={{
              background: 'linear-gradient(135deg, #3e72ae 0%, #16a085 100%)',
              color: 'white',
              fontSize: '13px'
            }}
          >
            {user?.first_name?.[0]}{user?.last_name?.[0]}
          </div>
          <div className="sidebar-user-info">
            <div className="sidebar-user-name">{user?.first_name} {user?.last_name}</div>
            <div className="sidebar-user-role">{formatRoleName(user?.role_name)}</div>
          </div>
          <button className="btn btn-ghost btn-icon" onClick={openChangePw} title="Change Password">
            <KeyRound size={16} />
          </button>
          <button className="btn btn-ghost btn-icon" onClick={logout} title="Logout">
            <LogOut size={16} />
          </button>
        </div>
      </div>

      {showChangePw && (
        <div className="cpw-overlay" onClick={() => setShowChangePw(false)}>
          <div className="cpw-modal" onClick={e => e.stopPropagation()}>
            <div className="cpw-header">
              <KeyRound size={16} />
              <span>Change Password</span>
              <button className="cpw-close" onClick={() => setShowChangePw(false)}>×</button>
            </div>
            <form onSubmit={handleChangePw} className="cpw-body">
              <div className="cpw-field">
                <label>Current Password</label>
                <input
                  type="password"
                  className="form-control"
                  value={pwForm.currentPassword}
                  onChange={e => setPwForm(p => ({ ...p, currentPassword: e.target.value }))}
                  required
                  autoFocus
                />
              </div>
              <div className="cpw-field">
                <label>New Password</label>
                <input
                  type="password"
                  className="form-control"
                  value={pwForm.newPassword}
                  onChange={e => setPwForm(p => ({ ...p, newPassword: e.target.value }))}
                  required
                  minLength={8}
                  placeholder="Min. 8 characters"
                />
              </div>
              <div className="cpw-field">
                <label>Confirm New Password</label>
                <input
                  type="password"
                  className="form-control"
                  value={pwForm.confirmPassword}
                  onChange={e => setPwForm(p => ({ ...p, confirmPassword: e.target.value }))}
                  required
                />
              </div>
              {pwError && <div className="cpw-error">{pwError}</div>}
              {pwSuccess && <div className="cpw-success">{pwSuccess}</div>}
              <div className="cpw-footer">
                <button type="button" className="btn btn-ghost" onClick={() => setShowChangePw(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={pwSaving}>
                  {pwSaving ? 'Saving…' : 'Update Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </aside>
  );
}
