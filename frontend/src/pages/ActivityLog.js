import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Activity, Search } from 'lucide-react';
import Header from '../components/layout/Header';
import { formatDateTime, getInitials, getAvatarColor } from '../utils/helpers';
import api from '../utils/api';
import toast from 'react-hot-toast';
import './ActivityLog.css';

export default function ActivityLog() {
  const [stories, setStories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => { load(); }, []);

  const load = async () => {
    try {
      const res = await api.get('/stories?limit=200');
      setStories(res.data.stories || []);
    } catch { toast.error('Failed to load activity'); }
    finally { setLoading(false); }
  };

  const getChangeTypeLabel = (type) => {
    const map = {
      created: { label: 'Created', color: 'var(--success)', bg: 'var(--success-light)' },
      update: { label: 'Updated', color: 'var(--primary)', bg: 'var(--primary-50)' },
      moved: { label: 'Stage Changed', color: 'var(--warning)', bg: 'var(--warning-light)' },
      meeting_added: { label: 'Meeting Added', color: '#6b5ea8', bg: '#f0eef8' },
    };
    return map[type] || { label: type, color: 'var(--text-muted)', bg: 'var(--bg-tertiary)' };
  };

  return (
    <>
      <Header title="Activity Log" subtitle="Full audit trail of pre-sales pipeline changes" />
      <div className="page-content">
        <div className="page-header">
          <div className="search-bar">
            <Search size={15} />
            <input
              type="text"
              placeholder="Search by story or user..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>

        {loading ? (
          <div className="page-loading" style={{ margin: 0 }}>
            <div className="page-spinner" />
          </div>
        ) : (
          <div className="activity-timeline">
            {stories.length === 0 && (
              <div className="empty-state-sm">
                <Activity size={40} color="#e2e8f0" />
                <p>No activity yet</p>
              </div>
            )}
            {stories.map(story => (
              <div key={story.id} className="activity-story-group">
                <div className="asg-header">
                  <Link to={`/kanban?story=${story.id}`} className="asg-title">
                    {story.title}
                  </Link>
                  {story.client_company && (
                    <span className="asg-company">{story.client_company}</span>
                  )}
                  <span className="badge badge-muted" style={{ marginLeft: 'auto' }}>
                    {story.column_name}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
