import React, { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import {
  LayoutDashboard, Kanban, Users, Settings,
  ChevronDown, LogOut, MessageSquare, Activity,
  Shield, UsersRound, LayoutGrid, UserCog
} from 'lucide-react';
import './Sidebar.css';

const regularNavItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard', roles: ['all'] },
  { to: '/kanban', icon: Kanban, label: 'Kanban Board', roles: ['all'] },
  {
    label: 'Team', icon: Users, roles: ['super_admin', 'pre_sales_manager'],
    children: [
      { to: '/team', label: 'Team Members' },
      { to: '/executives', label: 'Executives' },
    ]
  },
  { to: '/whatsapp', icon: MessageSquare, label: 'WhatsApp', roles: ['super_admin', 'pre_sales_manager'] },
  { to: '/activity', icon: Activity, label: 'Activity Log', roles: ['all'] },
  { to: '/settings', icon: Settings, label: 'Settings', roles: ['all'] },
];

const adminNavItems = [
  { to: '/admin/users', icon: UserCog, label: 'User Management' },
  { to: '/admin/teams', icon: UsersRound, label: 'Teams' },
  { to: '/admin/roles', icon: Shield, label: 'Roles & Permissions' },
  { to: '/admin/kanban', icon: LayoutGrid, label: 'Kanban Setup' },
  { to: '/settings', icon: Settings, label: 'Settings' },
];

export default function Sidebar() {
  const { user, logout } = useAuth();
  const [expanded, setExpanded] = useState({});
  const location = useLocation();

  const isSystemAdmin = user?.role_name === 'system_admin';

  const canSee = (roles) => {
    if (!roles || roles.includes('all')) return true;
    return roles.includes(user?.role_name);
  };

  const toggle = (label) => setExpanded(p => ({ ...p, [label]: !p[label] }));

  const roleLabel = {
    system_admin: 'System Admin',
    super_admin: 'Super Admin',
    pre_sales_manager: 'Pre-Sales Manager',
    pre_sales_executive: 'Pre-Sales Executive',
  };

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
        {isSystemAdmin ? (
          <>
            <div className="nav-section-label">Admin Console</div>
            {adminNavItems.map((item) => (
              <NavLink key={item.to} to={item.to} className="nav-item">
                <item.icon size={18} />
                <span>{item.label}</span>
              </NavLink>
            ))}
          </>
        ) : (
          regularNavItems.map((item) => {
            if (!canSee(item.roles)) return null;

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
              background: isSystemAdmin ? '#c0392b' : '#3e72ae',
              color: 'white',
              fontSize: '13px'
            }}
          >
            {user?.first_name?.[0]}{user?.last_name?.[0]}
          </div>
          <div className="sidebar-user-info">
            <div className="sidebar-user-name">{user?.first_name} {user?.last_name}</div>
            <div className="sidebar-user-role">{roleLabel[user?.role_name]}</div>
          </div>
          <button className="btn btn-ghost btn-icon" onClick={logout} title="Logout">
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </aside>
  );
}
