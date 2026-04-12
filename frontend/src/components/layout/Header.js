import React, { useState, useEffect, useRef } from 'react';
import { Bell, Check, CheckCheck, MessageSquare, Calendar, Info, AlertTriangle, XCircle, ArrowRight, ArrowUpCircle, CheckSquare, KeyRound, PencilLine, LogOut, ChevronDown } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { timeAgo, formatRoleName } from '../../utils/helpers';
import api from '../../utils/api';
import toast from 'react-hot-toast';
import './Header.css';

export default function Header({ title, subtitle }) {
  const { user, logout, loadUser, updateProfileLocally } = useAuth();
  const navigate = useNavigate();

  // ── Notifications ──
  const [notifications, setNotifications] = useState([]);
  const [showNotifs, setShowNotifs] = useState(false);
  const [unread, setUnread] = useState(0);
  const notifRef = useRef(null);

  // ── User menu dropdown ──
  const [showUserMenu, setShowUserMenu] = useState(false);
  const userMenuRef = useRef(null);

  // ── Edit profile ──
  const [showProfile, setShowProfile] = useState(false);
  const [profForm, setProfForm] = useState({ first_name: '', last_name: '', phone: '' });
  const [profSaving, setProfSaving] = useState(false);

  // ── Change password ──
  const [showChangePw, setShowChangePw] = useState(false);
  const [pwForm, setPwForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [pwError, setPwError] = useState('');
  const [pwSuccess, setPwSuccess] = useState('');
  const [pwSaving, setPwSaving] = useState(false);

  // ── Notification polling ──
  useEffect(() => {
    loadNotifications();
    const interval = setInterval(loadNotifications, 30000);
    return () => clearInterval(interval);
  }, []);

  // ── Close dropdowns on outside click ──
  useEffect(() => {
    const handleClick = (e) => {
      if (notifRef.current && !notifRef.current.contains(e.target)) setShowNotifs(false);
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) setShowUserMenu(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const loadNotifications = async () => {
    try {
      const res = await api.get('/notifications');
      setNotifications(res.data.notifications || []);
      setUnread(res.data.notifications.filter(n => !n.is_read).length);
    } catch {}
  };

  const markRead = async (id) => {
    try {
      await api.put(`/notifications/${id}/read`);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
      setUnread(prev => Math.max(0, prev - 1));
    } catch {}
  };

  const markAllRead = async () => {
    try {
      await api.put('/notifications/read-all');
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setUnread(0);
    } catch {}
  };

  const getNotifIcon = (type) => {
    const iconMap = {
      task_assigned: <CheckSquare size={14} color="#3e72ae" />,
      task_completed: <Check size={14} color="#16a34a" />,
      story_moved: <ArrowRight size={14} color="var(--primary)" />,
      comment: <MessageSquare size={14} color="#8b5cf6" />,
      meeting: <Calendar size={14} color="var(--primary)" />,
      promoted: <ArrowUpCircle size={14} color="#f59e0b" />,
      info: <Info size={14} color="var(--info)" />,
      warning: <AlertTriangle size={14} color="var(--warning)" />,
      error: <XCircle size={14} color="var(--error)" />,
    };
    return iconMap[type] || <Bell size={14} color="var(--text-muted)" />;
  };

  // ── Profile handlers ──
  const openProfile = () => {
    setProfForm({
      first_name: user?.first_name || '',
      last_name: user?.last_name || '',
      phone: user?.phone || '',
    });
    setShowUserMenu(false);
    setShowProfile(true);
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    if (!profForm.first_name.trim() || !profForm.last_name.trim()) {
      toast.error('First and last name are required.');
      return;
    }
    setProfSaving(true);
    try {
      await api.put(`/users/${user.id}`, {
        first_name: profForm.first_name.trim(),
        last_name: profForm.last_name.trim(),
        phone: profForm.phone.trim() || null,
      });
      updateProfileLocally({
        first_name: profForm.first_name.trim(),
        last_name: profForm.last_name.trim(),
        phone: profForm.phone.trim() || null,
      });
      await loadUser();
      toast.success('Profile updated successfully!');
      setShowProfile(false);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update profile.');
    } finally {
      setProfSaving(false);
    }
  };

  // ── Password handlers ──
  const openChangePw = () => {
    setPwForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    setPwError('');
    setPwSuccess('');
    setShowUserMenu(false);
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

  return (
    <header className="header">
      <div className="header-left">
        {title && (
          <div>
            <h1 className="header-title">{title}</h1>
            {subtitle && <p className="header-subtitle">{subtitle}</p>}
          </div>
        )}
      </div>

      <div className="header-right">

        {/* ── Notifications ── */}
        <div className="notif-wrapper" ref={notifRef}>
          <button className="header-icon-btn" onClick={() => setShowNotifs(!showNotifs)}>
            <Bell size={18} />
            {unread > 0 && <span className="notif-badge">{unread > 9 ? '9+' : unread}</span>}
          </button>

          {showNotifs && (
            <div className="notif-dropdown">
              <div className="notif-header">
                <span className="notif-title">Notifications</span>
                {unread > 0 && (
                  <button className="notif-mark-all" onClick={markAllRead}>
                    <CheckCheck size={14} /> Mark all read
                  </button>
                )}
              </div>
              <div className="notif-list">
                {notifications.length === 0 ? (
                  <div className="notif-empty">No notifications</div>
                ) : (
                  notifications.map(notif => (
                    <div
                      key={notif.id}
                      className={`notif-item ${!notif.is_read ? 'unread' : ''}`}
                      onClick={() => markRead(notif.id)}
                    >
                      <span className="notif-icon">{getNotifIcon(notif.type)}</span>
                      <div className="notif-content">
                        <div className="notif-item-title">{notif.title}</div>
                        <div className="notif-message">{notif.message}</div>
                        <div className="notif-time">{timeAgo(notif.created_at)}</div>
                      </div>
                      {!notif.is_read && <div className="notif-dot" />}
                    </div>
                  ))
                )}
              </div>
              <div className="notif-footer">
                <button className="notif-see-all" onClick={() => { setShowNotifs(false); navigate('/notifications'); }}>
                  See all notifications
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ── User menu ── */}
        <div className="user-menu-wrapper" ref={userMenuRef}>
          <button className="header-user" onClick={() => setShowUserMenu(!showUserMenu)}>
            <div className="avatar avatar-sm" style={{ background: 'linear-gradient(135deg, #3e72ae 0%, #16a085 100%)', color: 'white', fontSize: '11px' }}>
              {user?.first_name?.[0]}{user?.last_name?.[0]}
            </div>
            <div className="header-user-info">
              <span className="header-user-name">{user?.first_name} {user?.last_name}</span>
            </div>
            <ChevronDown size={14} className={`user-menu-chevron ${showUserMenu ? 'open' : ''}`} />
          </button>

          {showUserMenu && (
            <div className="user-menu-dropdown">
              <div className="user-menu-profile-row">
                <div className="avatar" style={{ width: 36, height: 36, borderRadius: '50%', background: 'linear-gradient(135deg, #3e72ae 0%, #16a085 100%)', color: 'white', fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, flexShrink: 0 }}>
                  {user?.first_name?.[0]}{user?.last_name?.[0]}
                </div>
                <div>
                  <div className="user-menu-name">{user?.first_name} {user?.last_name}</div>
                  <div className="user-menu-role">{formatRoleName(user?.role_name)}</div>
                </div>
              </div>

              <div className="user-menu-divider" />

              <button className="user-menu-item" onClick={openProfile}>
                <PencilLine size={15} />
                Edit Profile
              </button>
              <button className="user-menu-item" onClick={openChangePw}>
                <KeyRound size={15} />
                Change Password
              </button>

              <div className="user-menu-divider" />

              <button className="user-menu-item danger" onClick={logout}>
                <LogOut size={15} />
                Sign Out
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Edit Profile Modal ── */}
      {showProfile && (
        <div className="cpw-overlay" onClick={() => setShowProfile(false)}>
          <div className="cpw-modal" style={{ width: 400 }} onClick={e => e.stopPropagation()}>
            <div className="cpw-header">
              <div className="avatar" style={{ width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(135deg, #3e72ae 0%, #16a085 100%)', color: 'white', fontSize: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, flexShrink: 0 }}>
                {(profForm.first_name?.[0] || user?.first_name?.[0] || '?').toUpperCase()}
                {(profForm.last_name?.[0] || user?.last_name?.[0] || '').toUpperCase()}
              </div>
              <span>My Profile</span>
              <button className="cpw-close" onClick={() => setShowProfile(false)}>×</button>
            </div>
            <form onSubmit={handleSaveProfile} className="cpw-body">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', background: 'var(--primary-50)', borderRadius: 8, marginBottom: 2 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {formatRoleName(user?.role_name)}
                </span>
                <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 'auto' }}>{user?.email}</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div className="cpw-field">
                  <label>First Name <span style={{ color: '#dc3545' }}>*</span></label>
                  <input className="form-control" value={profForm.first_name} onChange={e => setProfForm(p => ({ ...p, first_name: e.target.value }))} required autoFocus placeholder="First name" />
                </div>
                <div className="cpw-field">
                  <label>Last Name <span style={{ color: '#dc3545' }}>*</span></label>
                  <input className="form-control" value={profForm.last_name} onChange={e => setProfForm(p => ({ ...p, last_name: e.target.value }))} required placeholder="Last name" />
                </div>
              </div>
              <div className="cpw-field">
                <label>Phone Number</label>
                <input className="form-control" type="tel" value={profForm.phone} onChange={e => setProfForm(p => ({ ...p, phone: e.target.value }))} placeholder="+1 234 567 8900" />
                <span style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>Include country code, e.g. +91 98765 43210</span>
              </div>
              <div className="cpw-footer">
                <button type="button" className="btn btn-ghost" onClick={() => setShowProfile(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={profSaving}>{profSaving ? 'Saving…' : 'Save Profile'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Change Password Modal ── */}
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
                <input type="password" className="form-control" value={pwForm.currentPassword} onChange={e => setPwForm(p => ({ ...p, currentPassword: e.target.value }))} required autoFocus />
              </div>
              <div className="cpw-field">
                <label>New Password</label>
                <input type="password" className="form-control" value={pwForm.newPassword} onChange={e => setPwForm(p => ({ ...p, newPassword: e.target.value }))} required minLength={8} placeholder="Min. 8 characters" />
              </div>
              <div className="cpw-field">
                <label>Confirm New Password</label>
                <input type="password" className="form-control" value={pwForm.confirmPassword} onChange={e => setPwForm(p => ({ ...p, confirmPassword: e.target.value }))} required />
              </div>
              {pwError && <div className="cpw-error">{pwError}</div>}
              {pwSuccess && <div className="cpw-success">{pwSuccess}</div>}
              <div className="cpw-footer">
                <button type="button" className="btn btn-ghost" onClick={() => setShowChangePw(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={pwSaving}>{pwSaving ? 'Saving…' : 'Update Password'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </header>
  );
}
