import React, { useState, useEffect } from 'react';
import {
  X, Plus, Send, Check, Pencil, Trash2, ChevronDown,
  Calendar, User, DollarSign, Activity, MessageSquare,
  CheckSquare, ExternalLink, Clock, Building
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { formatDate, formatDateTime, timeAgo, getInitials, getAvatarColor } from '../../utils/helpers';
import StoryModal from './StoryModal';
import api from '../../utils/api';
import toast from 'react-hot-toast';
import './StoryDetailModal.css';

const TABS = ['Details', 'Tasks', 'Comments', 'Meetings', 'Activity'];

export default function StoryDetailModal({ storyId, columns, users, onClose, onUpdated }) {
  const { user, canDo, isManager } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('Details');
  const [showEdit, setShowEdit] = useState(false);

  // Task state
  const [newTask, setNewTask] = useState('');
  const [addingTask, setAddingTask] = useState(false);

  // Comment state
  const [comment, setComment] = useState('');
  const [sendingComment, setSendingComment] = useState(false);

  useEffect(() => { loadStory(); }, [storyId]);

  const loadStory = async () => {
    try {
      const res = await api.get(`/stories/${storyId}`);
      setData(res.data);
    } catch {
      toast.error('Failed to load story');
    } finally {
      setLoading(false);
    }
  };

  const addTask = async () => {
    if (!newTask.trim()) return;
    setAddingTask(true);
    try {
      const res = await api.post(`/stories/${storyId}/tasks`, { title: newTask });
      setData(prev => ({ ...prev, tasks: [...prev.tasks, res.data.task] }));
      setNewTask('');
    } catch {
      toast.error('Failed to add task');
    } finally {
      setAddingTask(false);
    }
  };

  const toggleTask = async (task) => {
    const newStatus = task.status === 'done' ? 'todo' : 'done';
    try {
      await api.put(`/tasks/${task.id}`, { status: newStatus });
      setData(prev => ({
        ...prev,
        tasks: prev.tasks.map(t => t.id === task.id ? { ...t, status: newStatus } : t)
      }));
    } catch { toast.error('Failed to update task'); }
  };

  const deleteTask = async (taskId) => {
    try {
      await api.delete(`/tasks/${taskId}`);
      setData(prev => ({ ...prev, tasks: prev.tasks.filter(t => t.id !== taskId) }));
    } catch { toast.error('Failed to delete task'); }
  };

  const sendComment = async () => {
    if (!comment.trim()) return;
    setSendingComment(true);
    try {
      const res = await api.post(`/stories/${storyId}/comments`, { content: comment });
      const newComment = {
        ...res.data.comment,
        user_name: `${user.first_name} ${user.last_name}`,
      };
      setData(prev => ({ ...prev, comments: [...prev.comments, newComment] }));
      setComment('');
    } catch { toast.error('Failed to send comment'); }
    finally { setSendingComment(false); }
  };

  const handleUpdated = (updatedStory) => {
    setShowEdit(false);
    loadStory();
    onUpdated?.();
  };

  if (loading) return (
    <div className="modal-overlay">
      <div className="modal modal-xl">
        <div style={{ display: 'flex', justifyContent: 'center', padding: '80px' }}>
          <div className="page-spinner" />
        </div>
      </div>
    </div>
  );

  const { story, tasks = [], comments = [], changeLogs = [], meetings = [] } = data || {};
  if (!story) return null;

  const completedTasks = tasks.filter(t => t.status === 'done').length;
  const progress = tasks.length > 0 ? Math.round((completedTasks / tasks.length) * 100) : 0;

  const priorityColor = {
    critical: '#dc3545', high: '#e67e22', medium: '#f59e0b', low: '#28a745'
  }[story.priority] || '#718096';

  return (
    <>
      <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
        <div className="modal modal-xl story-detail-modal">
          <div className="story-detail-header">
            <div className="story-detail-title-row">
              <div className="story-priority-badge" style={{ background: `${priorityColor}20`, color: priorityColor }}>
                {story.priority?.toUpperCase()}
              </div>
              <div className="story-column-badge" style={{ background: story.column_color + '20', color: story.column_color }}>
                {story.column_name}
                {story.sub_stage_name && ` · ${story.sub_stage_name}`}
              </div>
            </div>
            <h2 className="story-detail-title">{story.title}</h2>
            <div className="story-detail-meta">
              {story.client_company && (
                <span className="detail-meta-item">
                  <Building size={13} /> {story.client_company}
                </span>
              )}
              {story.assigned_to_name && (
                <span className="detail-meta-item">
                  <User size={13} /> {story.assigned_to_name}
                </span>
              )}
              {story.due_date && (
                <span className="detail-meta-item">
                  <Calendar size={13} /> Due {formatDate(story.due_date)}
                </span>
              )}
              <span className="detail-meta-item text-muted">
                <Clock size={13} /> Created {timeAgo(story.created_at)}
              </span>
            </div>

            <div className="story-detail-actions">
              {canDo('user_stories', 'update') && (
                <button className="btn btn-secondary btn-sm" onClick={() => setShowEdit(true)}>
                  <Pencil size={14} /> Edit
                </button>
              )}
              <button className="btn btn-ghost btn-icon" onClick={onClose}>
                <X size={18} />
              </button>
            </div>
          </div>

          {tasks.length > 0 && (
            <div className="story-progress-bar">
              <div className="progress-fill" style={{ width: `${progress}%` }} />
              <span className="progress-label">{completedTasks}/{tasks.length} tasks · {progress}%</span>
            </div>
          )}

          <div className="story-detail-tabs">
            {TABS.map(tab => (
              <button
                key={tab}
                className={`detail-tab ${activeTab === tab ? 'active' : ''}`}
                onClick={() => setActiveTab(tab)}
              >
                {tab}
                {tab === 'Tasks' && tasks.length > 0 && <span className="tab-count">{tasks.length}</span>}
                {tab === 'Comments' && comments.length > 0 && <span className="tab-count">{comments.length}</span>}
                {tab === 'Activity' && changeLogs.length > 0 && <span className="tab-count">{changeLogs.length}</span>}
              </button>
            ))}
          </div>

          <div className="story-detail-body">
            {/* Details Tab */}
            {activeTab === 'Details' && (
              <div className="detail-content">
                <div className="detail-grid">
                  <div className="detail-main">
                    {story.description && (
                      <div className="detail-section">
                        <h4 className="detail-section-title">Description</h4>
                        <p className="detail-description">{story.description}</p>
                      </div>
                    )}

                    <div className="detail-section">
                      <h4 className="detail-section-title">Client Information</h4>
                      <div className="client-info-grid">
                        {story.client_name && (
                          <div className="client-info-item">
                            <span className="ci-label">Contact</span>
                            <span className="ci-value">{story.client_name}</span>
                          </div>
                        )}
                        {story.client_company && (
                          <div className="client-info-item">
                            <span className="ci-label">Company</span>
                            <span className="ci-value">{story.client_company}</span>
                          </div>
                        )}
                        {story.client_email && (
                          <div className="client-info-item">
                            <span className="ci-label">Email</span>
                            <a href={`mailto:${story.client_email}`} className="ci-value ci-link">{story.client_email}</a>
                          </div>
                        )}
                        {story.client_phone && (
                          <div className="client-info-item">
                            <span className="ci-label">Phone</span>
                            <a href={`tel:${story.client_phone}`} className="ci-value ci-link">{story.client_phone}</a>
                          </div>
                        )}
                      </div>
                    </div>

                    {story.tags?.length > 0 && (
                      <div className="detail-section">
                        <h4 className="detail-section-title">Tags</h4>
                        <div className="detail-tags">
                          {story.tags.map(tag => (
                            <span key={tag} className="tag-chip">{tag}</span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="detail-sidebar">
                    {story.estimated_value && (
                      <div className="sidebar-stat">
                        <span className="ss-label">Est. Value</span>
                        <span className="ss-value text-success">
                          ${parseFloat(story.estimated_value).toLocaleString()}
                        </span>
                      </div>
                    )}
                    <div className="sidebar-stat">
                      <span className="ss-label">Source</span>
                      <span className="ss-value">{story.source || 'Manual'}</span>
                    </div>
                    <div className="sidebar-stat">
                      <span className="ss-label">Created By</span>
                      <span className="ss-value">{story.created_by_name || '—'}</span>
                    </div>
                    <div className="sidebar-stat">
                      <span className="ss-label">Last Updated</span>
                      <span className="ss-value">{timeAgo(story.updated_at)}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Tasks Tab */}
            {activeTab === 'Tasks' && (
              <div className="detail-content">
                <div className="task-add-row">
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Add a sub-task..."
                    value={newTask}
                    onChange={e => setNewTask(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && addTask()}
                  />
                  <button className="btn btn-primary" onClick={addTask} disabled={addingTask || !newTask.trim()}>
                    <Plus size={15} /> Add
                  </button>
                </div>

                <div className="task-list">
                  {tasks.length === 0 ? (
                    <div className="empty-state-sm">
                      <CheckSquare size={32} color="#e2e8f0" />
                      <p>No tasks yet. Add tasks to track progress.</p>
                    </div>
                  ) : (
                    tasks.map(task => (
                      <div key={task.id} className={`task-item ${task.status === 'done' ? 'done' : ''}`}>
                        <button
                          className={`task-check ${task.status === 'done' ? 'checked' : ''}`}
                          onClick={() => toggleTask(task)}
                        >
                          {task.status === 'done' && <Check size={12} />}
                        </button>
                        <div className="task-content">
                          <span className="task-title">{task.title}</span>
                          {task.assigned_to_name && (
                            <span className="task-assignee">{task.assigned_to_name}</span>
                          )}
                        </div>
                        <button className="task-delete" onClick={() => deleteTask(task.id)}>
                          <Trash2 size={13} />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* Comments Tab */}
            {activeTab === 'Comments' && (
              <div className="detail-content">
                <div className="comment-list">
                  {comments.length === 0 ? (
                    <div className="empty-state-sm">
                      <MessageSquare size={32} color="#e2e8f0" />
                      <p>No comments yet. Start the conversation.</p>
                    </div>
                  ) : (
                    comments.map(c => (
                      <div key={c.id} className="comment-item">
                        <div
                          className="avatar avatar-sm"
                          style={{ background: getAvatarColor(c.user_name), color: 'white', fontSize: '10px' }}
                        >
                          {getInitials(c.user_name)}
                        </div>
                        <div className="comment-content">
                          <div className="comment-meta">
                            <strong>{c.user_name}</strong>
                            <span>{timeAgo(c.created_at)}</span>
                          </div>
                          <p className="comment-text">{c.content}</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                <div className="comment-input-row">
                  <div
                    className="avatar avatar-sm"
                    style={{ background: getAvatarColor(`${user.first_name} ${user.last_name}`), color: 'white', fontSize: '10px' }}
                  >
                    {getInitials(`${user.first_name} ${user.last_name}`)}
                  </div>
                  <div className="comment-input-wrapper">
                    <textarea
                      className="form-control comment-textarea"
                      placeholder="Write a comment..."
                      value={comment}
                      onChange={e => setComment(e.target.value)}
                      rows={2}
                      onKeyDown={e => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          sendComment();
                        }
                      }}
                    />
                    <button
                      className="btn btn-primary btn-sm comment-send"
                      onClick={sendComment}
                      disabled={sendingComment || !comment.trim()}
                    >
                      <Send size={14} />
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Meetings Tab */}
            {activeTab === 'Meetings' && (
              <div className="detail-content">
                {meetings.length === 0 ? (
                  <div className="empty-state-sm">
                    <Calendar size={32} color="#e2e8f0" />
                    <p>No meetings linked to this story.</p>
                  </div>
                ) : (
                  <div className="meeting-list-detail">
                    {meetings.map(m => (
                      <div key={m.id} className="meeting-detail-item">
                        <div className="meeting-detail-time">
                          <div className="mdt-date">{formatDate(m.start_time, 'MMM d, yyyy')}</div>
                          <div className="mdt-time">{formatDate(m.start_time, 'h:mm a')}</div>
                        </div>
                        <div className="meeting-detail-info">
                          <div className="mdi-title">{m.title}</div>
                          {m.location && <div className="mdi-loc">{m.location}</div>}
                        </div>
                        {(m.meeting_link || m.ms_teams_join_url) && (
                          <a
                            href={m.ms_teams_join_url || m.meeting_link}
                            target="_blank" rel="noreferrer"
                            className="btn btn-primary btn-sm"
                          >
                            <ExternalLink size={13} /> Join
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Activity/Changelog Tab */}
            {activeTab === 'Activity' && (
              <div className="detail-content">
                {changeLogs.length === 0 ? (
                  <div className="empty-state-sm">
                    <Activity size={32} color="#e2e8f0" />
                    <p>No activity recorded yet.</p>
                  </div>
                ) : (
                  <div className="changelog-list">
                    {changeLogs.map(log => (
                      <div key={log.id} className="changelog-item">
                        <div
                          className="avatar avatar-sm"
                          style={{ background: getAvatarColor(log.changed_by_name), color: 'white', fontSize: '10px' }}
                        >
                          {getInitials(log.changed_by_name)}
                        </div>
                        <div className="changelog-content">
                          <div className="changelog-text">
                            <strong>{log.changed_by_name}</strong>
                            {log.change_type === 'created' && ' created this story'}
                            {log.change_type === 'moved' && ' moved to a new stage'}
                            {log.change_type === 'update' && log.field_name && (
                              <> updated <em>{log.field_name.replace(/_/g, ' ')}</em></>
                            )}
                            {log.change_type === 'meeting_added' && ` — ${log.comment}`}
                            {log.comment && log.change_type !== 'meeting_added' && (
                              <span className="changelog-comment"> "{log.comment}"</span>
                            )}
                          </div>
                          {log.old_value && log.new_value && (
                            <div className="changelog-diff">
                              <span className="diff-old">{log.old_value}</span>
                              <span className="diff-arrow">→</span>
                              <span className="diff-new">{log.new_value}</span>
                            </div>
                          )}
                          <div className="changelog-time">{formatDateTime(log.created_at)}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {showEdit && (
        <StoryModal
          story={story}
          columns={columns}
          users={users}
          onClose={() => setShowEdit(false)}
          onSaved={handleUpdated}
        />
      )}
    </>
  );
}
