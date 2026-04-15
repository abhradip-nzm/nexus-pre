import React, { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import {
  LayoutDashboard, Kanban, Users, Settings,
  ChevronDown, LogOut,
  UsersRound, LayoutGrid, UserCog,
  Calendar as CalendarIcon, Tag as TagIcon, Building2,
  GitBranch, CalendarCheck, Target, FormInput, ListTodo
} from 'lucide-react';
import { formatRoleName } from '../../utils/helpers';
import './Sidebar.css';

function getNavItems(role) {
  if (role === 'pre_sales_manager') {
    return [
      { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
      { to: '/kanban', icon: Kanban, label: 'Kanban Board' },
      { to: '/prospects', icon: Target, label: 'Probable Prospects' },
      { to: '/my-tasks', icon: CalendarCheck, label: 'My Tasks' },
      { to: '/executives', icon: Users, label: 'Team' },
      { to: '/calendar', icon: CalendarIcon, label: 'Calendar' },
    ];
  }
  if (role === 'pre_sales_executive') {
    return [
      { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
      { to: '/kanban', icon: Kanban, label: 'Kanban Board' },
      { to: '/prospects', icon: Target, label: 'Probable Prospects' },
      { to: '/my-tasks', icon: CalendarCheck, label: 'My Tasks' },
      { to: '/calendar', icon: CalendarIcon, label: 'Calendar' },
    ];
  }
  return [];
}

const adminNavItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/kanban', icon: Kanban, label: 'Kanban Board' },
  { to: '/all-tasks', icon: CalendarCheck, label: 'All Tasks' },
  { to: '/adhoc-tasks', icon: ListTodo, label: 'Ad-Hoc Tasks', systemAdminOnly: true },
  { to: '/calendar', icon: CalendarIcon, label: 'Calendar' },
  { to: '/admin/users', icon: UserCog, label: 'User Management' },
  { to: '/admin/teams', icon: UsersRound, label: 'Teams' },
  { to: '/admin/business-team', icon: GitBranch, label: 'Business Team' },
  { to: '/executives', icon: Users, label: 'Executive Performance' },
  { to: '/admin/kanban', icon: LayoutGrid, label: 'Kanban Setup' },
  { to: '/admin/tags', icon: TagIcon, label: 'Manage Tags' },
  { to: '/admin/industries', icon: Building2, label: 'Manage Industries' },
  { to: '/admin/transition-forms', icon: FormInput, label: 'Transition Forms' },
  { to: '/prospects', icon: Target, label: 'Probable Prospects' },
  { to: '/settings', icon: Settings, label: 'Settings' },
];

export default function Sidebar() {
  const { user, logout } = useAuth();
  const [expanded, setExpanded] = useState({});
  const location = useLocation();

  const isAdminUser = user?.role_name === 'system_admin' || user?.role_name === 'super_admin';
  const toggle = (label) => setExpanded(p => ({ ...p, [label]: !p[label] }));

  const visibleAdminItems = adminNavItems.filter(item => {
    if (item.systemAdminOnly && user?.role_name !== 'system_admin') return false;
    if (item.to === '/settings' && user?.role_name !== 'system_admin') return false;
    return true;
  });

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
              fontSize: '13px',
              flexShrink: 0,
            }}
          >
            {user?.first_name?.[0]}{user?.last_name?.[0]}
          </div>
          <div className="sidebar-user-info">
            <div className="sidebar-user-name">{user?.first_name} {user?.last_name}</div>
            <div className="sidebar-user-role">{formatRoleName(user?.role_name)}</div>
          </div>
          <button className="btn btn-ghost btn-icon" onClick={logout} title="Logout">
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </aside>
  );
}
