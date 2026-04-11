import React, { useState, useEffect, useCallback } from 'react';
import { Bell, Check, CheckCheck, Calendar, MessageSquare, ArrowRight, ArrowUpCircle, Info, AlertTriangle, XCircle, CheckSquare } from 'lucide-react';
import Header from '../components/layout/Header';
import api from '../utils/api';
import { timeAgo } from '../utils/helpers';
import toast from 'react-hot-toast';

const TYPE_ICONS = {
  task_assigned: <CheckSquare size={16} color="#3e72ae" />,
  task_completed: <Check size={16} color="#16a34a" />,
  story_moved: <ArrowRight size={16} color="#3e72ae" />,
  comment: <MessageSquare size={16} color="#8b5cf6" />,
  meeting: <Calendar size={16} color="#3e72ae" />,
  promoted: <ArrowUpCircle size={16} color="#f59e0b" />,
  info: <Info size={16} color="#3b82f6" />,
  warning: <AlertTriangle size={16} color="#f59e0b" />,
  error: <XCircle size={16} color="#dc3545" />,
};

export default function Notifications() {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // all | unread

  const load = useCallback(async () => {
    try {
      const res = await api.get('/notifications/all');
      setNotifications(res.data.notifications || []);
    } catch {
      toast.error('Failed to load notifications');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const markRead = async (id) => {
    try {
      await api.put(`/notifications/${id}/read`);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
    } catch {}
  };

  const markAllRead = async () => {
    try {
      await api.put('/notifications/read-all');
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      toast.success('All marked as read');
    } catch {}
  };

  const displayed = filter === 'unread' ? notifications.filter(n => !n.is_read) : notifications;
  const unreadCount = notifications.filter(n => !n.is_read).length;

  if (loading) return (
    <div className="page-loading"><div className="page-spinner" /><p>Loading...</p></div>
  );

  return (
    <>
      <Header title="Notifications" subtitle="All your notifications in one place" />
      <div className="page-content">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              className={`btn btn-sm ${filter === 'all' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setFilter('all')}
            >All ({notifications.length})</button>
            <button
              className={`btn btn-sm ${filter === 'unread' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setFilter('unread')}
            >Unread ({unreadCount})</button>
          </div>
          {unreadCount > 0 && (
            <button className="btn btn-ghost btn-sm" onClick={markAllRead} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <CheckCheck size={14} /> Mark all read
            </button>
          )}
        </div>

        {displayed.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 24px', color: 'var(--text-muted)' }}>
            <Bell size={36} style={{ margin: '0 auto 12px', display: 'block', opacity: 0.3 }} />
            <p style={{ fontSize: 14 }}>{filter === 'unread' ? 'No unread notifications' : 'No notifications yet'}</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {displayed.map(notif => (
              <div
                key={notif.id}
                onClick={() => !notif.is_read && markRead(notif.id)}
                style={{
                  display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 16px',
                  background: notif.is_read ? 'white' : 'var(--primary-50, #eef4fb)',
                  border: '1px solid var(--border-light)', borderRadius: 10,
                  cursor: notif.is_read ? 'default' : 'pointer', transition: 'background 0.15s'
                }}
              >
                <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--bg-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 }}>
                  {TYPE_ICONS[notif.type] || <Bell size={16} color="var(--text-muted)" />}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: notif.is_read ? 500 : 700, color: 'var(--text-primary)' }}>{notif.title}</div>
                  {notif.message && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{notif.message}</div>}
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{timeAgo(notif.created_at)}</div>
                </div>
                {!notif.is_read && <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--primary)', flexShrink: 0, marginTop: 6 }} />}
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
