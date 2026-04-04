import React, { useState, useEffect, useRef } from 'react';
import { Bell, Search, X, Check, CheckCheck, MessageSquare, Calendar, Info, AlertTriangle, XCircle } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { timeAgo } from '../../utils/helpers';
import api from '../../utils/api';
import './Header.css';

export default function Header({ title, subtitle }) {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [showNotifs, setShowNotifs] = useState(false);
  const [unread, setUnread] = useState(0);
  const notifRef = useRef(null);

  useEffect(() => {
    loadNotifications();
    const interval = setInterval(loadNotifications, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleClick = (e) => {
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        setShowNotifs(false);
      }
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
      whatsapp: <MessageSquare size={14} color="#25D366" />,
      meeting: <Calendar size={14} color="var(--primary)" />,
      info: <Info size={14} color="var(--info)" />,
      warning: <AlertTriangle size={14} color="var(--warning)" />,
      error: <XCircle size={14} color="var(--error)" />,
    };
    return iconMap[type] || <Bell size={14} color="var(--text-muted)" />;
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
        <div className="notif-wrapper" ref={notifRef}>
          <button
            className="header-icon-btn"
            onClick={() => setShowNotifs(!showNotifs)}
          >
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
            </div>
          )}
        </div>

        <div className="header-user">
          <div className="avatar avatar-sm" style={{ background: '#3e72ae', color: 'white', fontSize: '11px' }}>
            {user?.first_name?.[0]}{user?.last_name?.[0]}
          </div>
          <div className="header-user-info">
            <span className="header-user-name">{user?.first_name} {user?.last_name}</span>
          </div>
        </div>
      </div>
    </header>
  );
}
